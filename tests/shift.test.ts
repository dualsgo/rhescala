import { describe, it, expect } from 'vitest';
import { isWorkingShift } from '../hooks/useScheduleEngine';
import { isShiftType, normalizeShiftCode } from '../types';

describe('ShiftType & Normalization Domain Rules', () => {
  it('identifies standard working shifts correctly', () => {
    expect(isWorkingShift('T')).toBe(true);
    expect(isWorkingShift('P1')).toBe(true);
    expect(isWorkingShift('PC')).toBe(true);
    expect(isWorkingShift('P2')).toBe(true);
    expect(isWorkingShift('P3')).toBe(true);
    expect(isWorkingShift('P4')).toBe(true);
    expect(isWorkingShift('ESTQ')).toBe(true);
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
  });
});
