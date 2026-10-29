import { describe, it, expect } from 'vitest';
import { isWorkingShift, resolveEffectiveShift } from '../hooks/useScheduleEngine';
import { isShiftType, normalizeShiftCode } from '../types';
import { createTestEmployee } from './fixtures';

describe('ShiftType & Normalization Domain Rules', () => {
  it('identifies standard working shifts correctly', () => {
    expect(isWorkingShift('T')).toBe(true);
    expect(isWorkingShift('P1')).toBe(true);
    expect(isWorkingShift('PC')).toBe(true);
    expect(isWorkingShift('P2')).toBe(true);
    expect(isWorkingShift('P3')).toBe(true);
    expect(isWorkingShift('P4')).toBe(true);
    expect(isWorkingShift('ESTQ')).toBe(true);
    expect(isWorkingShift('CX')).toBe(true);
    expect(isWorkingShift('REP')).toBe(true);
    expect(isWorkingShift('VEND')).toBe(true);
    expect(isWorkingShift('FISC')).toBe(true);
    expect(isWorkingShift('AP')).toBe(true);
  });

  it('identifies non-working shifts (rest, vacation, medical, apprentice course)', () => {
    expect(isWorkingShift('F')).toBe(false);
    expect(isWorkingShift('FF')).toBe(false);
    expect(isWorkingShift('FE')).toBe(false);
    expect(isWorkingShift('AT')).toBe(false);
    expect(isWorkingShift('C')).toBe(false);
    expect(isWorkingShift('DO')).toBe(false);
    expect(isWorkingShift('N/A')).toBe(false);
    expect(isWorkingShift(undefined)).toBe(false);
  });

  it('validates shift codes strictly via isShiftType', () => {
    expect(isShiftType('T')).toBe(true);
    expect(isShiftType('AT')).toBe(true);
    expect(isShiftType('FF 2026-05-01')).toBe(true);
    expect(isShiftType('FF 07/09')).toBe(true);
    expect(isShiftType('invalid_shift')).toBe(false);
    expect(isShiftType(123)).toBe(false);
  });

  it('normalizes legacy or unexpected shift values safely', () => {
    expect(normalizeShiftCode('T')).toBe('T');
    expect(normalizeShiftCode('AT')).toBe('AT');
    expect(normalizeShiftCode('FF 2026-10-12')).toBe('FF 2026-10-12');
    expect(normalizeShiftCode('unknown')).toBe('T');
    expect(normalizeShiftCode(null)).toBe('T');
    expect(normalizeShiftCode('  F  ')).toBe('F');
  });

  describe('Tabela de Casos de Turnos (Entrada -> Saída)', () => {
    const shiftTestCases = [
      { input: 'T', isWorking: true, valid: true },
      { input: 'P1', isWorking: true, valid: false },
      { input: 'PC', isWorking: true, valid: false },
      { input: 'P2', isWorking: true, valid: false },
      { input: 'P3', isWorking: true, valid: false },
      { input: 'P4', isWorking: true, valid: false },
      { input: 'ESTQ', isWorking: true, valid: false },
      { input: 'F', isWorking: false, valid: true },
      { input: 'FF', isWorking: false, valid: true },
      { input: 'FF 2026-12-25', isWorking: false, valid: true },
      { input: 'FE', isWorking: false, valid: true },
      { input: 'AT', isWorking: false, valid: true },
      { input: 'C', isWorking: false, valid: true },
      { input: 'DO', isWorking: false, valid: true },
      { input: 'N/A', isWorking: false, valid: true },
      { input: 'DESCONHECIDO', isWorking: false, valid: false }
    ];

    shiftTestCases.forEach(({ input, isWorking, valid }) => {
      it(`verifica código '${input}': isWorkingShift=${isWorking}, isShiftType=${valid}`, () => {
        expect(isWorkingShift(input)).toBe(isWorking);
        expect(isShiftType(input)).toBe(valid);
      });
    });
  });

  it('resolveEffectiveShift returns effective shift considering contract bounds and absence periods', () => {
    const emp = createTestEmployee({
      hiredAt: '2026-10-02',
      vacationStart: '2026-10-10',
      vacationEnd: '2026-10-12',
      shifts: { '2026-10': ['T', 'F', 'T'] },
    });

    expect(resolveEffectiveShift(emp, '2026-10-01', '2026-10', 0)).toBe('N/A');
    expect(resolveEffectiveShift(emp, '2026-10-02', '2026-10', 1)).toBe('F');
    expect(resolveEffectiveShift(emp, '2026-10-11', '2026-10', 10)).toBe('FE');
    expect(resolveEffectiveShift(emp, '2026-10-20', '2026-10', 19)).toBe('T');
  });
});
