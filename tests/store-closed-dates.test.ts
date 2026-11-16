import { describe, it, expect } from 'vitest';
import { getStoreClosedDatesForYear, isStoreClosedDate } from '../src/engine/config/schedule-constants';
import { applyMonthUpdate } from '../src/engine/orchestration/month-generator';
import { optimizeDecemberPeak } from '../src/engine/peaks/seasonal-peaks';
import { isWorkingShift } from '../src/engine/shifts/shift-predicates';
import { isShiftType, Employee } from '../types';

describe('Status LF (Loja Fechada) — Datas sem Funcionamento no RJ', () => {
  const makeEmp = (id: string, isApprentice = false): Employee => ({
    id,
    name: `Colab ${id}`,
    isYoungApprentice: isApprentice,
    cargo: isApprentice ? 'Apoio' : 'Vendas',
    primaryRole: isApprentice ? 'Apoio' : 'Vendas',
    jornada: '6x1',
    status: 'active',
    statusColor: '#ff8400',
    shifts: {},
    dailyHours: {},
    workPeriod: isApprentice ? '10h às 16h15' : '10h às 18h20',
    preferredDayOff: 'Segunda-feira',
    shiftName: 'Abertura',
  });

  it('1. isShiftType reconhece LF e isWorkingShift retorna false', () => {
    expect(isShiftType('LF')).toBe(true);
    expect(isWorkingShift('LF')).toBe(false);
  });

  it('2. getStoreClosedDatesForYear(2026) identifica 01/01, Terça de Carnaval (17/02/2026), Dia do Comerciário e 25/12', () => {
    const closed = getStoreClosedDatesForYear(2026);
    expect(closed.has('2026-01-01')).toBe(true);
    expect(closed.has('2026-02-17')).toBe(true); // Terça-feira de Carnaval 2026
    expect(closed.has('2026-10-19')).toBe(true); // 3ª segunda-feira de outubro 2026
    expect(closed.has('2026-12-25')).toBe(true);

    // Quando há convenção com data específica (ex: 20/10), prioriza a data customizada
    const customClosed = getStoreClosedDatesForYear(2026, [
      { id: 'com-2026', date: '2026-10-20', name: 'Dia do Comerciário', type: 'municipal', recurring: false },
    ]);
    expect(customClosed.has('2026-10-20')).toBe(true);
    expect(customClosed.has('2026-10-19')).toBe(false);
  });

  it('3. applyMonthUpdate marca LF (e não F) em 01/01, Terça de Carnaval, Dia do Comerciário e 25/12', () => {
    const team = [makeEmp('1'), makeEmp('2', true)];

    const jan = applyMonthUpdate(team, 2026, 0);
    expect(jan['1'].shifts[0]).toBe('LF');
    expect(jan['2'].shifts[0]).toBe('LF');

    const feb = applyMonthUpdate(team, 2026, 1);
    expect(feb['1'].shifts[16]).toBe('LF'); // 17/02/2026
    expect(feb['2'].shifts[16]).toBe('LF');

    const oct = applyMonthUpdate(team, 2026, 9);
    expect(oct['1'].shifts[18]).toBe('LF'); // 19/10/2026
    expect(oct['2'].shifts[18]).toBe('LF');

    const dec = applyMonthUpdate(team, 2026, 11);
    expect(dec['1'].shifts[24]).toBe('LF'); // 25/12/2026
    expect(dec['2'].shifts[24]).toBe('LF');
  });

  it('4. optimizeDecemberPeak preserva status LF no dia 25/12 (Natal)', () => {
    const emp = makeEmp('1');
    emp.shifts['2026-12'] = Array(31).fill('T');
    const res = optimizeDecemberPeak([emp], '2026-12');
    expect(res['1'].shifts[24]).toBe('LF');
    expect(isStoreClosedDate('2026-12-25', 2026)).toBe(true);
  });
});
