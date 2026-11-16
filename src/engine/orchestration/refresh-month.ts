import { Employee, Holiday, JornadaSettings, ProtectedDaysConfig, ShiftType } from '../../../types';
import {
  DEFAULT_JORNADA_SETTINGS,
  buildHolidaySet,
  getDefaultHourForDay,
  getStoreClosedDatesForYear,
  isEmployeeEligibleForMonth,
  isEmployeeHiddenInMonth,
} from '../config/schedule-constants';
import { getShiftClassification } from '../shifts/shift-predicates';
import { getLegalOverrideForDay } from '../clt/legal-overrides';
import { applyMonthUpdate, PendingHolidayCreditInput } from './month-generator';

export type RefreshChangeKind = 'missing_schedule' | 'legal_override' | 'hours_sync' | 'shift_name_sync';

export interface RefreshChangeDetail {
  kind: RefreshChangeKind;
  label: string;
  detail: string;
}

export interface EmployeeRefreshPreview {
  empId: string;
  empName: string;
  hasMissingSchedule: boolean;
  changes: RefreshChangeDetail[];
}

export interface MonthRefreshAnalysis {
  monthKey: string;
  previews: EmployeeRefreshPreview[];
  missingScheduleCount: number;
  hasAnyChanges: boolean;
}

const REST_OR_OFF_CODES = new Set(['F', 'LF', 'FE', 'AT', 'DO', 'N/A']);

function isRestCode(s: ShiftType | undefined): boolean {
  if (!s) return false;
  return REST_OR_OFF_CODES.has(s) || s.startsWith('FF');
}

function getExpectedShiftName(emp: Employee, settings: JornadaSettings): Employee['shiftName'] {
  if (emp.cargo === 'Estoque' || (emp.cargo as string) === 'Estoquista' || emp.role === 'Estoque') {
    return emp.shiftName || 'Abertura';
  }
  const c = getShiftClassification(emp.workPeriod, false, settings);
  if (c === 'Abertura' || c === 'Intermediário' || c === 'Fechamento') return c;
  return emp.shiftName || 'Abertura';
}

/**
 * Analisa divergências entre o cadastro atual da equipe e a grade do mês,
 * sem modificar os dados (usado para exibir o modal de contexto antes de confirmar).
 */
export function analyzeMonthRefresh(
  employees: Employee[],
  year: number,
  month: number,
  customHolidays: Holiday[] = [],
  deletedNationalHolidays: string[] = [],
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): MonthRefreshAnalysis {
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
  const storeClosedDates = getStoreClosedDatesForYear(year, customHolidays, deletedNationalHolidays);

  const previews: EmployeeRefreshPreview[] = [];

  for (const emp of employees) {
    if (!isEmployeeEligibleForMonth(emp, year, month) || isEmployeeHiddenInMonth(emp, monthKey)) {
      continue;
    }

    const changes: RefreshChangeDetail[] = [];
    const currentShifts = emp.shifts?.[monthKey] || [];
    const currentHours = emp.dailyHours?.[monthKey] || [];

    // 1. Detecta colaborador sem escala gerada ou sem nenhuma folga/ausência no mês (ex: reexibido após criação do mês)
    const hasNoArray = currentShifts.length < daysInMonth;
    const hasAnyRest = currentShifts.slice(0, daysInMonth).some(isRestCode);
    const hasMissingSchedule = !emp.isYoungApprentice && (hasNoArray || !hasAnyRest);

    if (hasMissingSchedule) {
      changes.push({
        kind: 'missing_schedule',
        label: 'Sem escala/folgas no mês',
        detail: hasNoArray
          ? 'Escala mensal ainda não foi gerada (ex.: estava oculto ao criar o mês).'
          : 'Todos os dias estão como trabalhados (T), sem nenhuma folga definida.',
      });
    }

    // 2. Verifica sobreposições legais do cadastro (férias, atestado, aniversário, início/fim de contrato, loja fechada)
    const legalDays: number[] = [];
    for (let d = 0; d < daysInMonth; d++) {
      const dateStr = `${monthKey}-${String(d + 1).padStart(2, '0')}`;
      const expectedLegal = getLegalOverrideForDay(emp, year, month, d)
        || (storeClosedDates.has(dateStr) ? 'LF' : null);

      if (expectedLegal && currentShifts[d] !== expectedLegal) {
        legalDays.push(d + 1);
      }
    }
    if (legalDays.length > 0 && !hasNoArray) {
      const sample = legalDays.slice(0, 6).join(', ') + (legalDays.length > 6 ? ` (+${legalDays.length - 6})` : '');
      changes.push({
        kind: 'legal_override',
        label: 'Regras de cadastro / afastamentos',
        detail: `Atualizar vigência, férias, atestado, aniversário ou loja fechada nos dias: ${sample}.`,
      });
    }

    // 3. Verifica sincronia de shiftName com workPeriod
    const expectedShiftName = getExpectedShiftName(emp, settings);
    if (expectedShiftName && emp.shiftName !== expectedShiftName) {
      changes.push({
        kind: 'shift_name_sync',
        label: 'Turno atualizado',
        detail: `Classificação do turno será alinhada de "${emp.shiftName || 'N/A'}" para "${expectedShiftName}".`,
      });
    }

    // 4. Verifica horários padrão faltantes ou desalinhados em dias de trabalho regular
    if (!hasNoArray) {
      let missingOrOutdatedHours = 0;
      for (let d = 0; d < daysInMonth; d++) {
        const s = currentShifts[d] || 'T';
        if (s !== 'T') continue;
        const date = new Date(year, month, d + 1);
        const dow = date.getDay();
        const dateStr = `${monthKey}-${String(d + 1).padStart(2, '0')}`;
        const expectedHour = getDefaultHourForDay(emp, holidaySet.has(dateStr), dow === 0);
        if (!currentHours[d]) {
          missingOrOutdatedHours++;
        } else if (
          emp.workPeriod &&
          dow !== 0 &&
          !holidaySet.has(dateStr) &&
          currentHours[d] !== emp.workPeriod &&
          !emp.isYoungApprentice
        ) {
          // Só sugere sincronizar se o horário salvo era um dos turnos padrão antigos (não um ajuste avulso)
          missingOrOutdatedHours++;
        } else if (expectedHour && !currentHours[d]) {
          missingOrOutdatedHours++;
        }
      }
      if (missingOrOutdatedHours > 0) {
        changes.push({
          kind: 'hours_sync',
          label: 'Horários de trabalho',
          detail: `${missingOrOutdatedHours} dia(s) de trabalho terão o horário sincronizado com o turno (${emp.workPeriod || 'padrão'}).`,
        });
      }
    }

    if (changes.length > 0) {
      previews.push({
        empId: emp.id,
        empName: emp.name,
        hasMissingSchedule,
        changes,
      });
    }
  }

  const missingScheduleCount = previews.filter(p => p.hasMissingSchedule).length;
  return {
    monthKey,
    previews,
    missingScheduleCount,
    hasAnyChanges: previews.length > 0,
  };
}

export interface ApplyMonthRefreshOptions {
  generateForEmpIds: string[];
  customHolidays?: Holiday[];
  deletedNationalHolidays?: string[];
  settings?: JornadaSettings;
  protectedDays?: ProtectedDaysConfig | number[];
  pendingCreditsByEmp?: Record<string, PendingHolidayCreditInput[]>;
}

/**
 * Aplica as atualizações confirmadas pelo gestor no modal de contexto:
 * - Para `generateForEmpIds`: gera a escala sugerida individual via `applyMonthUpdate(..., targetEmpId)`.
 * - Para os demais colaboradores com mudanças cadastrais/legais: aplica apenas sobreposições legais,
 *   horários padrão de dias úteis/faltantes e `shiftName`, preservando 100% das folgas existentes.
 */
export function applyMonthRefresh(
  employees: Employee[],
  year: number,
  month: number,
  options: ApplyMonthRefreshOptions
): Employee[] {
  const {
    generateForEmpIds,
    customHolidays = [],
    deletedNationalHolidays = [],
    settings = DEFAULT_JORNADA_SETTINGS,
    protectedDays,
    pendingCreditsByEmp,
  } = options;

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
  const storeClosedDates = getStoreClosedDatesForYear(year, customHolidays, deletedNationalHolidays);
  const generateSet = new Set(generateForEmpIds);

  // 1. Gera individualmente para os colaboradores selecionados que estavam sem escala
  let nextEmployees = [...employees];
  for (const empId of generateSet) {
    const updatedData = applyMonthUpdate(
      nextEmployees,
      year,
      month,
      customHolidays,
      deletedNationalHolidays,
      settings,
      protectedDays,
      'suggested_retro',
      empId,
      pendingCreditsByEmp
    );
    if (updatedData[empId]) {
      nextEmployees = nextEmployees.map(emp =>
        emp.id === empId
          ? {
              ...emp,
              shiftName: getExpectedShiftName(emp, settings),
              shifts: { ...emp.shifts, [monthKey]: updatedData[empId].shifts },
              dailyHours: { ...emp.dailyHours, [monthKey]: updatedData[empId].hours },
              decisionReasons: {
                ...(emp.decisionReasons || {}),
                [monthKey]: updatedData[empId].decisionReasons || {},
              },
              dailyAssignedRoles: {
                ...(emp.dailyAssignedRoles || {}),
                [monthKey]: updatedData[empId].dailyAssignedRoles || {},
              },
            }
          : emp
      );
    }
  }

  // 2. Aplica atualizações seguras (não-destrutivas) para os demais colaboradores
  return nextEmployees.map(emp => {
    if (generateSet.has(emp.id)) return emp;
    if (!isEmployeeEligibleForMonth(emp, year, month) || isEmployeeHiddenInMonth(emp, monthKey)) {
      return emp;
    }

    const existingShifts = emp.shifts?.[monthKey];
    if (!existingShifts || existingShifts.length < daysInMonth) {
      return emp;
    }

    const nextShifts = [...existingShifts];
    const nextHours = [...(emp.dailyHours?.[monthKey] || Array(daysInMonth).fill(''))];
    let changed = false;

    for (let d = 0; d < daysInMonth; d++) {
      const dateStr = `${monthKey}-${String(d + 1).padStart(2, '0')}`;
      const dow = new Date(year, month, d + 1).getDay();
      const legal = getLegalOverrideForDay(emp, year, month, d)
        || (storeClosedDates.has(dateStr) ? 'LF' : null);

      if (legal && nextShifts[d] !== legal) {
        nextShifts[d] = legal;
        changed = true;
      }

      if (nextShifts[d] === 'T') {
        const expectedHour = getDefaultHourForDay(emp, holidaySet.has(dateStr), dow === 0);
        if (!nextHours[d] && expectedHour) {
          nextHours[d] = expectedHour;
          changed = true;
        } else if (
          emp.workPeriod &&
          dow !== 0 &&
          !holidaySet.has(dateStr) &&
          nextHours[d] !== emp.workPeriod &&
          !emp.isYoungApprentice
        ) {
          nextHours[d] = emp.workPeriod;
          changed = true;
        }
      }
    }

    const expectedShiftName = getExpectedShiftName(emp, settings);
    if (expectedShiftName && emp.shiftName !== expectedShiftName) {
      changed = true;
    }

    if (!changed) return emp;

    return {
      ...emp,
      shiftName: expectedShiftName || emp.shiftName,
      shifts: { ...emp.shifts, [monthKey]: nextShifts },
      dailyHours: { ...emp.dailyHours, [monthKey]: nextHours },
    };
  });
}
