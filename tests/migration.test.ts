import { describe, it, expect } from 'vitest';
import { migrateLegacyEmployeeData } from '../src/services/scheduleMigrationService';
import { Employee, ShiftType } from '../types';

describe('scheduleMigrationService - migrateLegacyEmployeeData', () => {
  it('deve converter cargos legados e códigos de turnos transitórios (P1..P4, ESTQ) para as funções canônicas e turnos "T"', () => {
    const legacyEmp: Employee = {
      id: 'emp-1',
      name: 'João Estoquista',
      cargo: 'Estoquista' as any,
      isYoungApprentice: false,
      status: 'active',
      statusColor: '#000',
      shifts: {
        '2026-10': ['ESTOQUE' as unknown as ShiftType, 'P1' as unknown as ShiftType, 'F'],
      },
      dailyHours: {
        '2026-10': ['10h às 18h20', '10h às 18h20', 'Folga'],
      },
      tacticalPositions: {
        '2026-10': ['ESTOQUE', 'P1', null],
      },
      workPeriod: '10h às 18h20',
      preferredDayOff: 'Domingo',
      shiftName: 'Abertura',
    };

    const result = migrateLegacyEmployeeData([legacyEmp]);

    expect(result.hasChanged).toBe(true);
    const migrated = result.employees[0];
    expect(migrated.cargo).toBe('Estoque');
    expect(migrated.role).toBe('Estoque');
    expect(migrated.shifts['2026-10'][0]).toBe('T');
    expect(migrated.shifts['2026-10'][1]).toBe('T');
    expect(migrated.shifts['2026-10'][2]).toBe('F');
  });

  it('não deve alterar colaboradores sem dados legados e manter hasChanged false', () => {
    const cleanEmp: Employee = {
      id: 'emp-2',
      name: 'Maria Vendedora',
      cargo: 'Vendas',
      role: 'Vendas',
      isYoungApprentice: false,
      status: 'active',
      statusColor: '#000',
      shifts: {
        '2026-10': ['T', 'F', 'T'],
      },
      dailyHours: {},
      workPeriod: '10h às 18h20',
      preferredDayOff: 'Segunda-feira',
      shiftName: 'Fechamento',
    };

    const result = migrateLegacyEmployeeData([cleanEmp]);

    expect(result.hasChanged).toBe(false);
    expect(result.employees[0]).toBe(cleanEmp);
  });
});
