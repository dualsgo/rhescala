import { describe, it, expect } from 'vitest';
import {
  allocateProportionalSlots,
  assignSundayAndHolidayHours,
  applyMonthUpdate,
} from '../src/engine/orchestration/month-generator';
import { DEFAULT_JORNADA_SETTINGS, buildHolidaySet } from '../constants';
import { getStoreClosedDatesForYear } from '../src/engine/config/schedule-constants';
import { createTestEmployee } from './fixtures';
import { Employee, ShiftType } from '../types';

describe('Turnos Proporcionais e Aleatórios em Domingos e Feriados', () => {
  it('allocateProportionalSlots distribui 7 pessoas em feriado na proporção 30/20/10/40 como 2, 1, 1, 3', () => {
    expect(allocateProportionalSlots(7, [0.30, 0.20, 0.10, 0.40])).toEqual([2, 1, 1, 3]);
  });

  it('allocateProportionalSlots distribui 6 pessoas no domingo na proporção 35/65 como 2 e 4', () => {
    expect(allocateProportionalSlots(6, [0.35, 0.65])).toEqual([2, 4]);
  });

  it('assignSundayAndHolidayHours aplica 35%/65% em domingos e 30%/20%/10%/40% em feriados', () => {
    // 7 colaboradores regulares trabalhando em Setembro/2026 (07/09 = Segunda feriado; 06/09 = Domingo)
    const team: Employee[] = Array.from({ length: 7 }, (_, i) =>
      createTestEmployee({
        id: `emp-${i + 1}`,
        name: `Colab ${i + 1}`,
        cargo: i < 2 ? 'Caixa' : 'Vendas',
        workPeriod: i < 3 ? '10h às 18h20' : '13h40 às 22h',
        shiftName: i < 3 ? 'Abertura' : 'Fechamento',
      })
    );

    const shiftsByEmp: Record<string, ShiftType[]> = {};
    const hoursByEmp: Record<string, string[]> = {};
    team.forEach(emp => {
      shiftsByEmp[emp.id] = Array(30).fill('T');
      // 1 folga para simular 6 trabalhando no domingo (emp-7 folga no dia 06/09 -> índice 5)
      if (emp.id === 'emp-7') shiftsByEmp[emp.id][5] = 'F';
      hoursByEmp[emp.id] = Array(30).fill(emp.workPeriod);
    });

    const holidaySet = buildHolidaySet(2026, [], []);
    const closedDates = getStoreClosedDatesForYear(2026, [], []);

    assignSundayAndHolidayHours(team, 2026, 8, shiftsByEmp, hoursByEmp, holidaySet, closedDates, DEFAULT_JORNADA_SETTINGS);

    // Domingo 06/09 (índice 5): 6 trabalhando -> 2 às 12h às 20h, 4 às 13h às 21h
    const sundayHours = team.slice(0, 6).map(e => hoursByEmp[e.id][5]);
    expect(sundayHours.filter(h => h === '12h às 20h')).toHaveLength(2);
    expect(sundayHours.filter(h => h === '13h às 21h')).toHaveLength(4);

    // Feriado 07/09 (índice 6): 7 trabalhando -> 2 (12h), 1 (13h), 1 (14h), 3 (15h)
    const holidayHours = team.map(e => hoursByEmp[e.id][6]);
    expect(holidayHours.filter(h => h === '12h às 18h')).toHaveLength(2);
    expect(holidayHours.filter(h => h === '13h às 19h')).toHaveLength(1);
    expect(holidayHours.filter(h => h === '14h às 20h')).toHaveLength(1);
    expect(holidayHours.filter(h => h === '15h às 21h')).toHaveLength(3);
  });

  it('applyMonthUpdate integra a distribuição proporcional nos domingos e feriados sem afetar dias úteis', () => {
    const team: Employee[] = Array.from({ length: 8 }, (_, i) =>
      createTestEmployee({
        id: `emp-${i + 1}`,
        name: `Colab ${i + 1}`,
        cargo: i < 2 ? 'Caixa' : 'Vendas',
        workPeriod: i < 4 ? '10h às 18h20' : '13h40 às 22h',
        shiftName: i < 4 ? 'Abertura' : 'Fechamento',
        preferredDayOff: (['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira'] as const)[i % 4],
      })
    );

    const res = applyMonthUpdate(team, 2026, 8, [], [], DEFAULT_JORNADA_SETTINGS, undefined, 'suggested_retro');

    // Dia útil 08/09 (terça-feira, índice 7): preserva workPeriod da semana para quem trabalha
    team.forEach(emp => {
      if (res[emp.id].shifts[7] === 'T') {
        expect(res[emp.id].hours[7]).toBe(emp.workPeriod);
      }
    });

    // Feriado 07/09 (segunda-feira, índice 6): todos que trabalham usam os 4 slots de feriado (6h)
    const allowedHolidaySlots = new Set(['12h às 18h', '13h às 19h', '14h às 20h', '15h às 21h']);
    team.forEach(emp => {
      if (res[emp.id].shifts[6] === 'T') {
        expect(allowedHolidaySlots.has(res[emp.id].hours[6])).toBe(true);
      }
    });
  });
});
