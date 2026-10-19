import { Employee, ShiftType, Holiday, JornadaSettings, MonthYear, normalizeEmployeeRole } from '../../../types';
import { getShiftClassification } from '../shifts/shift-predicates';
export { getShiftClassification };

/**
 * @deprecated O conceito de posicionamento tático diário foi extinto.
 * Retorna diretamente a função canônica do colaborador para os dias trabalhados.
 */
import { isWorkingShift } from '../shifts/shift-predicates';

export function resolveTacticalDay(
  activeEmps: Employee[],
  monthKey?: string,
  dayIdx?: number,
  _isHoliday?: boolean,
  _isSunday?: boolean,
  _settings?: JornadaSettings
): Record<string, string> {
  const result: Record<string, string> = {};
  activeEmps.forEach(e => {
    if (monthKey !== undefined && dayIdx !== undefined) {
      const shift = e.shifts?.[monthKey]?.[dayIdx];
      if (shift && !isWorkingShift(shift)) return;
    }
    result[e.id] = normalizeEmployeeRole(e.cargo || e.role);
  });
  return result;
}

/**
 * @deprecated O conceito de posicionamento tático diário foi extinto.
 */
export function distributeTacticalPositions(
  employees: Employee[],
  currentMY: MonthYear,
  _customHolidays: Holiday[] = [],
  _deletedNationalHolidays: string[] = [],
  _settings?: JornadaSettings
): Record<string, { shifts: ShiftType[] }> {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const result: Record<string, { shifts: ShiftType[] }> = {};
  employees.forEach(emp => {
    result[emp.id] = {
      shifts: emp.shifts[monthKey] ? [...emp.shifts[monthKey]] : Array(daysInMonth).fill('T')
    };
  });
  return result;
}

/**
 * @deprecated O conceito de posicionamento tático diário foi extinto.
 */
export function applyTacticalOnly(
  employees: Employee[],
  year: number,
  month: number,
  _customHolidays: Holiday[] = [],
  _deletedNationalHolidays: string[] = [],
  _settings?: JornadaSettings
): Record<string, (string | null)[]> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: Record<string, (string | null)[]> = {};
  employees.forEach(emp => {
    const role = normalizeEmployeeRole(emp.cargo || emp.role);
    result[emp.id] = Array(daysInMonth).fill(role);
  });
  return result;
}
