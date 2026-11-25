import { Employee, JornadaSettings, MonthGuidelines, normalizeEmployeeRole, normalizeShiftCode } from '../../types';
import { DEFAULT_JORNADA_SETTINGS, DEFAULT_SCHEDULE_RULES } from '../engine/config/schedule-constants';

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

/**
 * Migra configurações de jornada legadas adicionando `rulesConfig` com os padrões seguros
 * sem sobrescrever nenhum parâmetro já configurado pelo usuário.
 */
export function migrateJornadaSettings(raw?: Partial<JornadaSettings> | null): JornadaSettings {
  const base = DEFAULT_JORNADA_SETTINGS;
  const savedRules = raw?.rulesConfig;
  return {
    minSundayWorkers: typeof raw?.minSundayWorkers === 'number' ? raw.minSundayWorkers : base.minSundayWorkers,
    shiftHours: {
      ...base.shiftHours,
      ...(raw?.shiftHours || {}),
    },
    lunchRules: {
      ...base.lunchRules,
      ...(raw?.lunchRules || {}),
    },
    rulesConfig: {
      ...DEFAULT_SCHEDULE_RULES,
      ...(savedRules || {}),
      estoqueFixedSundayOff: {
        ...DEFAULT_SCHEDULE_RULES.estoqueFixedSundayOff,
        ...(savedRules?.estoqueFixedSundayOff || {}),
      },
      seasonalPeakPresets: {
        ...DEFAULT_SCHEDULE_RULES.seasonalPeakPresets,
        ...(savedRules?.seasonalPeakPresets || {}),
      },
    },
  };
}

/**
 * Normaliza mapa legado de diretrizes mensais garantindo fallback seguro.
 */
export function migrateMonthGuidelines(
  raw?: Record<string, Partial<MonthGuidelines>> | null
): Record<string, MonthGuidelines> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, MonthGuidelines> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!val || typeof val !== 'object') continue;
    const monthPart = parseInt(key.split('-')[1] || '1', 10) - 1;
    const presetDays = DEFAULT_SCHEDULE_RULES.seasonalPeakPresets[monthPart] || [];
    result[key] = {
      estoqueFixedOffEnabled: Boolean(val.estoqueFixedOffEnabled),
      estoqueFixedOffWeekday: typeof val.estoqueFixedOffWeekday === 'number' ? val.estoqueFixedOffWeekday : 0,
      peakDays: Array.isArray(val.peakDays) ? [...val.peakDays] : [...presetDays],
      lfCountsAsRest: typeof val.lfCountsAsRest === 'boolean' ? val.lfCountsAsRest : false,
      fiveByTwoRestMode: val.fiveByTwoRestMode === 'flexible' ? 'flexible' : 'strict',
      coverageMinFloor: typeof val.coverageMinFloor === 'number' ? val.coverageMinFloor : 0.70,
      coverageTargetCap: typeof val.coverageTargetCap === 'number' ? val.coverageTargetCap : 0.80,
      minSundayWorkers: typeof val.minSundayWorkers === 'number' ? val.minSundayWorkers : DEFAULT_JORNADA_SETTINGS.minSundayWorkers,
      allocatePendingHolidayCredits: typeof val.allocatePendingHolidayCredits === 'boolean' ? val.allocatePendingHolidayCredits : true,
      prioritizeSeasonalRestOnPeaks: typeof val.prioritizeSeasonalRestOnPeaks === 'boolean' ? val.prioritizeSeasonalRestOnPeaks : true,
    };
  }
  return result;
}
