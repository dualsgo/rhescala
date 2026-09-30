import { Employee, ShiftType } from '../../types';

export interface MigrationResult {
  employees: Employee[];
  hasChanged: boolean;
}

/**
 * Migra dados legados de colaboradores.
 * Atualmente: abrevia o termo legado 'ESTOQUE' para 'ESTQ' em:
 * - tacticalPositions
 * - shifts
 * - preferredPosition1
 * - preferredPosition2
 * 
 * Função pura: não depende de React, DOM, localStorage ou APIs externas.
 */
export function migrateLegacyEmployeeData(employees: Employee[]): MigrationResult {
  let hasChanged = false;

  const migratedEmployees = employees.map(emp => {
    let empChanged = false;

    // 1. Migração em tacticalPositions
    const newTactical = { ...emp.tacticalPositions };
    Object.keys(newTactical).forEach(key => {
      const row = newTactical[key];
      if (row && row.includes('ESTOQUE')) {
        newTactical[key] = row.map(v => (v === 'ESTOQUE' ? 'ESTQ' : v));
        empChanged = true;
      }
    });

    // 2. Migração em shifts
    const newShifts = { ...emp.shifts };
    Object.keys(newShifts).forEach(key => {
      const row = newShifts[key] as unknown as string[];
      if (row && row.includes('ESTOQUE')) {
        newShifts[key] = row.map(v => (v === 'ESTOQUE' ? 'ESTQ' : v) as ShiftType);
        empChanged = true;
      }
    });

    // 3. Migração em preferências de posição
    let pref1 = emp.preferredPosition1;
    if (pref1 === 'ESTOQUE') {
      pref1 = 'ESTQ';
      empChanged = true;
    }

    let pref2 = emp.preferredPosition2;
    if (pref2 === 'ESTOQUE') {
      pref2 = 'ESTQ';
      empChanged = true;
    }

    if (empChanged) {
      hasChanged = true;
      return {
        ...emp,
        tacticalPositions: newTactical,
        shifts: newShifts,
        preferredPosition1: pref1,
        preferredPosition2: pref2,
      };
    }

    return emp;
  });

  return {
    employees: hasChanged ? migratedEmployees : employees,
    hasChanged,
  };
}
