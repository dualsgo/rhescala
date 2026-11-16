import { describe, it, expect } from 'vitest';
import { applyMonthUpdate } from '../src/engine/orchestration/month-generator';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';
import { createTestEmployee } from './fixtures';
import { Employee, ShiftType } from '../types';

function makeTeam(
  aberturaCount: number,
  fechamentoCount: number,
  overrides?: (idx: number, shift: 'Abertura' | 'Fechamento') => Partial<Employee>
): Employee[] {
  const list: Employee[] = [];
  for (let i = 0; i < aberturaCount; i++) {
    list.push(createTestEmployee({
      id: `ab-${i + 1}`,
      name: `Abertura ${i + 1}`,
      shiftName: 'Abertura',
      workPeriod: '09:40 às 18:00',
      cargo: i === 0 ? 'Caixa' : 'Vendas',
      preferredDayOff: 'Terça-feira',
      ...(overrides ? overrides(i, 'Abertura') : {}),
    }));
  }
  for (let i = 0; i < fechamentoCount; i++) {
    list.push(createTestEmployee({
      id: `fe-${i + 1}`,
      name: `Fechamento ${i + 1}`,
      shiftName: 'Fechamento',
      workPeriod: '13:40 às 22:00',
      cargo: i === 0 ? 'Caixa' : 'Vendas',
      preferredDayOff: 'Quarta-feira',
      ...(overrides ? overrides(i, 'Fechamento') : {}),
    }));
  }
  return list;
}

describe('Smart Month Generation (70% coverage, pending FF, DO & CLT rules)', () => {
  it('redistributes clustered preferredDayOff so overall and per-shift coverage stay >= 70%', () => {
    // 4 of 5 Abertura + 4 of 5 Fechamento all preferring Segunda-feira (without balancing Monday drops to 20%).
    // With the 70% balancer, at least ceil(5 * 0.7) = 4 per shift work every weekday.
    const team = makeTeam(5, 5, (idx) => ({
      preferredDayOff: idx < 4 ? 'Segunda-feira' : 'Quinta-feira',
    }));
    const res = applyMonthUpdate(team, 2026, 6, [], [], DEFAULT_JORNADA_SETTINGS, undefined, 'suggested_retro');

    const daysInJuly = 31; // month=6 (0-indexed) => July 2026 (ends on Friday, full last week)
    for (let d = 1; d <= daysInJuly; d++) {
      const idx = d - 1;
      const dow = new Date(2026, 6, d).getDay();
      if (dow === 0) continue; // Sundays follow minSundayWorkers rotation

      const abWorking = team.filter(e => e.shiftName === 'Abertura' && res[e.id].shifts[idx] === 'T').length;
      const feWorking = team.filter(e => e.shiftName === 'Fechamento' && res[e.id].shifts[idx] === 'T').length;

      expect(abWorking, `Abertura working on day ${d}`).toBeGreaterThanOrEqual(Math.ceil(5 * 0.7));
      expect(feWorking, `Fechamento working on day ${d}`).toBeGreaterThanOrEqual(Math.ceil(5 * 0.7));
      expect(abWorking + feWorking, `Total working on day ${d}`).toBeGreaterThanOrEqual(Math.ceil(10 * 0.7));
    }
  });

  it('allocates pending FF on the fullest weekday for the employee shift without dropping below 70%', () => {
    const team = makeTeam(5, 5, (idx, shift) => ({
      preferredDayOff: idx === 0 ? 'Terça-feira' : idx === 1 ? 'Quarta-feira' : idx === 2 ? 'Quinta-feira' : 'Sexta-feira',
      shiftName: shift,
    }));

    const pendingCredits = {
      'ab-2': [{ id: 'cred-1', holidayDate: '2026-06-04', holidayName: 'Corpus Christi' }],
    };

    const res = applyMonthUpdate(
      team,
      2026,
      7,
      [],
      [],
      DEFAULT_JORNADA_SETTINGS,
      undefined,
      'suggested_retro',
      undefined,
      pendingCredits
    );

    const ab2Shifts = res['ab-2'].shifts;
    const ffIndices = ab2Shifts
      .map((code, idx) => ({ code, idx }))
      .filter(({ code }) => typeof code === 'string' && code.startsWith('FF'))
      .map(({ idx }) => idx);

    expect(ffIndices.length).toBe(1);
    const chosenIdx = ffIndices[0];
    const chosenDay = chosenIdx + 1;
    const chosenDow = new Date(2026, 7, chosenDay).getDay();
    expect(chosenDow).toBeGreaterThanOrEqual(1);
    expect(chosenDow).toBeLessThanOrEqual(5);

    expect(res['ab-2'].decisionReasons?.[chosenIdx]).toBe('PREFERRED_DAY_OFF');

    // On the chosen FF date, Abertura & overall must still respect >= 70%
    const abWorking = team.filter(e => e.shiftName === 'Abertura' && res[e.id].shifts[chosenIdx] === 'T').length;
    const totalWorking = team.filter(e => res[e.id].shifts[chosenIdx] === 'T').length;
    expect(abWorking).toBeGreaterThanOrEqual(Math.ceil(5 * 0.7));
    expect(totalWorking).toBeGreaterThanOrEqual(Math.ceil(10 * 0.7));
  });

  it('infers pending FF from a worked holiday in the previous month when explicit list is not provided', () => {
    const team = makeTeam(5, 5, (idx) => ({
      preferredDayOff: (['Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'] as const)[idx % 5],
    }));

    // Simulate ab-3 working on 2026-05-01 (Dia do Trabalho, national holiday) in May 2026 without taking FF
    const mayShifts: ShiftType[] = Array(31).fill('T');
    team[2] = {
      ...team[2],
      shifts: {
        '2026-05': mayShifts,
      },
    };

    const res = applyMonthUpdate(team, 2026, 7, [], [], DEFAULT_JORNADA_SETTINGS, undefined, 'suggested_retro');
    const ffIndices = res['ab-3'].shifts.filter(code => typeof code === 'string' && code.startsWith('FF'));

    // Dia do Trabalho (1º de Maio) generates 2 compensatory credits when worked
    expect(ffIndices.length).toBeGreaterThanOrEqual(1);
  });

  it('preserves birthday DO and never exceeds 6 consecutive working days or 2 consecutive Sundays', () => {
    const team = makeTeam(5, 5, (idx) => ({
      preferredDayOff: idx < 3 ? 'Segunda-feira' : 'Terça-feira',
      // month=7 is August (0-indexed), so birthday in August -> day 15 (index 14)
      birthday: idx === 1 ? '1995-08-15' : undefined,
    }));

    const res = applyMonthUpdate(team, 2026, 7, [], [], DEFAULT_JORNADA_SETTINGS, undefined, 'suggested_retro');

    // Birthday DO preserved on August 15 (index 14)
    expect(res['ab-2'].shifts[14]).toBe('DO');

    // CLT consecutive work streak <= 6 & Sunday consecutive streak <= 2
    for (const emp of team) {
      let streak = 0;
      let sundayStreak = 0;
      for (let d = 1; d <= 31; d++) {
        const idx = d - 1;
        const code = res[emp.id].shifts[idx];
        const isWork = code === 'T';
        streak = isWork ? streak + 1 : 0;
        expect(streak, `${emp.id} consecutive streak on day ${d}`).toBeLessThanOrEqual(6);

        if (new Date(2026, 7, d).getDay() === 0) {
          sundayStreak = isWork ? sundayStreak + 1 : 0;
          expect(sundayStreak, `${emp.id} Sunday streak on day ${d}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });
});
