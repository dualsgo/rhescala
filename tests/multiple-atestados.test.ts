import { describe, it, expect } from 'vitest';
import {
  buildAddAtestadoUpdate,
  buildRemoveAtestadoUpdate,
  getAtestadoDurationDays,
  getAtestadoOnDate,
  getEmployeeAtestados,
  isEmployeeOnAtestado,
} from '../src/utils/atestado';
import { resolveEffectiveShift } from '../src/engine/shifts/shift-predicates';
import { createTestEmployee } from './fixtures';

describe('Múltiplos Atestados Médicos Cumulativos e Distintos', () => {
  it('mantém atestado de 2 dias (23 e 24) ao lançar outro de 3 dias (25, 26 e 27)', () => {
    const baseEmp = createTestEmployee({
      id: 'emp-at-1',
      shifts: { '2026-11': Array(30).fill('T') },
    });

    // 1º lançamento: 2 dias (23 e 24/11)
    const u1 = buildAddAtestadoUpdate(baseEmp, '2026-11-23', 2);
    const empAfterFirst = { ...baseEmp, ...u1 };

    // 2º lançamento: 3 dias (25, 26 e 27/11)
    const u2 = buildAddAtestadoUpdate(empAfterFirst, '2026-11-25', 3);
    const empAfterBoth = { ...empAfterFirst, ...u2 };

    const list = getEmployeeAtestados(empAfterBoth);
    expect(list).toHaveLength(2);
    expect(list[0].start).toBe('2026-11-23');
    expect(list[0].end).toBe('2026-11-24');
    expect(getAtestadoDurationDays(list[0])).toBe(2);

    expect(list[1].start).toBe('2026-11-25');
    expect(list[1].end).toBe('2026-11-27');
    expect(getAtestadoDurationDays(list[1])).toBe(3);

    // Todos os 5 dias ficam 'AT' na escala
    for (const day of [23, 24, 25, 26, 27]) {
      const dStr = `2026-11-${String(day).padStart(2, '0')}`;
      expect(isEmployeeOnAtestado(empAfterBoth, dStr)).toBe(true);
      expect(resolveEffectiveShift(empAfterBoth, dStr, '2026-11', day - 1)).toBe('AT');
    }

    // Duração individual por data
    expect(getAtestadoDurationDays(getAtestadoOnDate(empAfterBoth, '2026-11-24')!)).toBe(2);
    expect(getAtestadoDurationDays(getAtestadoOnDate(empAfterBoth, '2026-11-26')!)).toBe(3);
  });

  it('remove apenas o atestado selecionado preservando os demais intactos', () => {
    const baseEmp = createTestEmployee({
      id: 'emp-at-2',
      shifts: { '2026-11': Array(30).fill('T') },
    });

    const emp1 = { ...baseEmp, ...buildAddAtestadoUpdate(baseEmp, '2026-11-23', 2) };
    const emp2 = { ...emp1, ...buildAddAtestadoUpdate(emp1, '2026-11-25', 3) };

    const list = getEmployeeAtestados(emp2);
    const removedFirst = { ...emp2, ...buildRemoveAtestadoUpdate(emp2, list[0].id) };

    expect(getEmployeeAtestados(removedFirst)).toHaveLength(1);
    expect(isEmployeeOnAtestado(removedFirst, '2026-11-23')).toBe(false);
    expect(isEmployeeOnAtestado(removedFirst, '2026-11-24')).toBe(false);
    expect(removedFirst.shifts['2026-11'][22]).toBe('T');
    expect(removedFirst.shifts['2026-11'][23]).toBe('T');

    // Segundo atestado (25..27) permanece intocado!
    expect(isEmployeeOnAtestado(removedFirst, '2026-11-25')).toBe(true);
    expect(isEmployeeOnAtestado(removedFirst, '2026-11-26')).toBe(true);
    expect(isEmployeeOnAtestado(removedFirst, '2026-11-27')).toBe(true);
    expect(removedFirst.shifts['2026-11'][24]).toBe('AT');
  });
});
