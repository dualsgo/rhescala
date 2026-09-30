import { describe, it, expect } from 'vitest';
import { migrateLegacyEmployeeData } from '../src/services/scheduleMigrationService';
import { Employee, ShiftType } from '../types';

describe('scheduleMigrationService - migrateLegacyEmployeeData', () => {
  it('deve converter "ESTOQUE" para "ESTQ" em tacticalPositions, shifts e preferências', () => {
    const legacyEmp: Employee = {
      id: 'emp-1',
      name: 'João Estoquista',
      isYoungApprentice: false,
      status: 'active',
      statusColor: '#000',
      shifts: {
        '2026-10': ['ESTOQUE' as unknown as ShiftType, 'T', 'F'],
      },
      dailyHours: {
        '2026-10': ['10h às 18h20', '10h às 18h20', 'Folga'],
      },
      tacticalPositions: {
        '2026-10': ['ESTOQUE', null, null],
      },
      workPeriod: '10h às 18h20',
      preferredDayOff: 'Domingo',
      preferredPosition1: 'ESTOQUE',
      preferredPosition2: 'ESTOQUE',
      shiftName: 'Abertura',
    };

    const result = migrateLegacyEmployeeData([legacyEmp]);

    expect(result.hasChanged).toBe(true);
    const migrated = result.employees[0];
    expect(migrated.shifts['2026-10'][0]).toBe('ESTQ');
    expect(migrated.tacticalPositions['2026-10'][0]).toBe('ESTQ');
    expect(migrated.preferredPosition1).toBe('ESTQ');
    expect(migrated.preferredPosition2).toBe('ESTQ');
  });

  it('não deve alterar colaboradores sem dados legados e manter hasChanged false', () => {
    const cleanEmp: Employee = {
      id: 'emp-2',
      name: 'Maria Vendedora',
      isYoungApprentice: false,
      status: 'active',
      statusColor: '#000',
      shifts: {
        '2026-10': ['T', 'F', 'P1'],
      },
      dailyHours: {},
      tacticalPositions: {
        '2026-10': ['P1', null, null],
      },
      workPeriod: '10h às 18h20',
      preferredDayOff: 'Segunda-feira',
      preferredPosition1: 'P1',
      preferredPosition2: 'P2',
      shiftName: 'Fechamento',
    };

    const result = migrateLegacyEmployeeData([cleanEmp]);

    expect(result.hasChanged).toBe(false);
    expect(result.employees[0]).toBe(cleanEmp);
  });
});
