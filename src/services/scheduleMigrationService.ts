import { Employee, ShiftType, normalizeEmployeeRole, normalizeShiftCode } from '../../types';

export interface MigrationResult {
  employees: Employee[];
  hasChanged: boolean;
}

/**
 * Migra dados legados de colaboradores:
 * 1. Normaliza cargos e funções legadas para as 6 funções oficiais (Caixa, Pacote, Vendas, Apoio, Fiscal, Estoque)
 * 2. Normaliza códigos de turnos legados (P1..P4, ESTQ, REP, etc.) para 'T'
 * 3. Mantém compatibilidade com registros de posições legadas
 * 
 * Função pura: não depende de React, DOM, localStorage ou APIs externas.
 */
export function migrateLegacyEmployeeData(employees: Employee[]): MigrationResult {
  let hasChanged = false;

  const migratedEmployees = employees.map(emp => {
    let empChanged = false;

    // 1. Normalização do cargo/função
    const normalizedCargo = normalizeEmployeeRole(emp.cargo || emp.role);
    if (emp.cargo !== normalizedCargo || emp.role !== normalizedCargo) {
      empChanged = true;
    }

    // 2. Migração em shifts (converte códigos transitórios legados P1..P4 em 'T')
    const newShifts = { ...emp.shifts };
    Object.keys(newShifts).forEach(key => {
      const row = newShifts[key];
      if (Array.isArray(row)) {
        let rowChanged = false;
        const updatedRow = row.map(s => {
          const norm = normalizeShiftCode(s);
          if (norm !== s) {
            rowChanged = true;
            return norm;
          }
          return s;
        });
        if (rowChanged) {
          newShifts[key] = updatedRow;
          empChanged = true;
        }
      }
    });

    if (empChanged) {
      hasChanged = true;
      return {
        ...emp,
        cargo: normalizedCargo,
        role: normalizedCargo,
        shifts: newShifts,
      };
    }

    return emp;
  });

  return {
    employees: hasChanged ? migratedEmployees : employees,
    hasChanged,
  };
}
