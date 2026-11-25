import { Employee, Holiday, JornadaSettings, MonthGuidelines, ScheduleRulesConfig } from '../../../types';
import {
  DEFAULT_JORNADA_SETTINGS,
  DEFAULT_SCHEDULE_RULES,
  isEmployeeHiddenInMonth,
} from './schedule-constants';
import { getDailyAvailability } from '../availability/daily-availability';

/**
 * Mescla regras globais salvas com os valores padrão seguros.
 */
export function resolveRulesConfig(settings?: JornadaSettings): ScheduleRulesConfig {
  const saved = settings?.rulesConfig;
  if (!saved) return { ...DEFAULT_SCHEDULE_RULES };
  return {
    ...DEFAULT_SCHEDULE_RULES,
    ...saved,
    estoqueFixedSundayOff: {
      ...DEFAULT_SCHEDULE_RULES.estoqueFixedSundayOff,
      ...(saved.estoqueFixedSundayOff || {}),
      roles: saved.estoqueFixedSundayOff?.roles?.length
        ? [...saved.estoqueFixedSundayOff.roles]
        : [...DEFAULT_SCHEDULE_RULES.estoqueFixedSundayOff.roles],
    },
    seasonalPeakPresets: {
      ...DEFAULT_SCHEDULE_RULES.seasonalPeakPresets,
      ...(saved.seasonalPeakPresets || {}),
    },
  };
}

/**
 * Gera diretrizes padrão de um mês a partir das Configurações Globais (F).
 * Precedência: Diretriz do Mês (G) > Configuração Global (F) > Padrão.
 */
export function getDefaultMonthGuidelines(
  month: number,
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): MonthGuidelines {
  const rules = resolveRulesConfig(settings);
  const presetDays = rules.seasonalPeakPresets[month] || [];
  return {
    estoqueFixedOffEnabled: Boolean(rules.estoqueFixedSundayOff.enabled),
    estoqueFixedOffWeekday: rules.estoqueFixedSundayOff.fixedWeekday ?? 0,
    peakDays: [...presetDays],
    lfCountsAsRest: Boolean(rules.lfCountsAsRest),
    fiveByTwoRestMode: rules.fiveByTwoRestMode || 'strict',
    coverageMinFloor: typeof rules.coverageMinFloor === 'number' ? rules.coverageMinFloor : 0.70,
    coverageTargetCap: typeof rules.coverageTargetCap === 'number' ? rules.coverageTargetCap : 0.80,
    minSundayWorkers: settings.minSundayWorkers ?? DEFAULT_JORNADA_SETTINGS.minSundayWorkers,
    allocatePendingHolidayCredits: true,
  };
}

/**
 * Resolve as diretrizes efetivas para um mês específico aplicando a ordem de precedência:
 * Diretriz explícita/salva do mês > Configuração global > Padrão.
 */
export function resolveMonthGuidelines(
  month: number,
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
  savedMonthGuidelines?: MonthGuidelines,
  explicitOverride?: Partial<MonthGuidelines>
): MonthGuidelines {
  const base = getDefaultMonthGuidelines(month, settings);
  return {
    ...base,
    ...(savedMonthGuidelines || {}),
    ...(explicitOverride || {}),
    peakDays: explicitOverride?.peakDays
      ? [...explicitOverride.peakDays]
      : savedMonthGuidelines?.peakDays
      ? [...savedMonthGuidelines.peakDays]
      : base.peakDays,
  };
}

export function isEmployeeAffectedByEstoqueRule(
  emp: Employee,
  rules: ScheduleRulesConfig,
  guidelines?: MonthGuidelines
): boolean {
  const enabled = guidelines ? guidelines.estoqueFixedOffEnabled : rules.estoqueFixedSundayOff.enabled;
  if (!enabled) return false;
  const targetRoles = rules.estoqueFixedSundayOff.roles || ['Estoque'];
  const empRole = (emp.primaryRole || emp.cargo || emp.role || '') as string;
  return targetRoles.some(r => r === empRole || (r === 'Estoque' && empRole === 'Estoquista'));
}

/**
 * Valida conflitos entre as diretrizes escolhidas e o pool real da equipe antes de gerar o mês.
 */
export function validateGuidelineConflicts(
  employees: Employee[],
  year: number,
  month: number,
  guidelines: MonthGuidelines,
  customHolidays: Holiday[] = [],
  deletedNationalHolidays: string[] = [],
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): string[] {
  const warnings: string[] = [];
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rules = resolveRulesConfig(settings);

  const visibleRegular = employees.filter(
    e => e.status === 'active' && !isEmployeeHiddenInMonth(e, monthKey) && !e.isYoungApprentice
  );

  // Verifica domingos do mês vs minSundayWorkers + eventual folga fixa de estoquista
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() !== 0) continue;
    const dateISO = `${monthKey}-${String(d).padStart(2, '0')}`;
    const avail = getDailyAvailability(visibleRegular, dateISO, customHolidays, deletedNationalHolidays, settings);
    if (avail.isClosedLF) continue;

    let eligibleForSunday = avail.availablePool.filter(emp => {
      if (guidelines.estoqueFixedOffEnabled && guidelines.estoqueFixedOffWeekday === 0) {
        if (isEmployeeAffectedByEstoqueRule(emp, rules, guidelines)) return false;
      }
      return true;
    }).length;

    if (eligibleForSunday < guidelines.minSundayWorkers) {
      warnings.push(
        `Domingo ${String(d).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}: pool disponível (${eligibleForSunday}) é menor que o mínimo configurado (${guidelines.minSundayWorkers})${
          guidelines.estoqueFixedOffEnabled ? ' considerando folga fixa de estoque' : ''
        }.`
      );
    }
  }

  if (guidelines.coverageMinFloor > guidelines.coverageTargetCap) {
    warnings.push(
      `Piso de cobertura (${Math.round(guidelines.coverageMinFloor * 100)}%) está maior que a meta (${Math.round(guidelines.coverageTargetCap * 100)}%).`
    );
  }

  return warnings;
}
