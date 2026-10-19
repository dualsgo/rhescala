import { Employee, JornadaSettings, ProtectedDayDetail } from '../../../types';
import { DEFAULT_JORNADA_SETTINGS, normalizeProtectedDaysDetails } from '../config/schedule-constants';
import { isWorkingShift, isBirthday, isEmployeePreferredDayOff } from './clt-rules';

/**
 * Returns true if `emp` is UNAVAILABLE to work (or rest via rotation) on the
 * given Sunday date. All hard exceptions are listed here:
 *   1. Vacation (vacationStart..vacationEnd covers the date)
 *   2. Preferred day off is "Domingo"
 *   3. Hired after this date (hiredAt > dateStr)
 *   4. Fired/left before this date (firedAt < dateStr)
 *   5. Shift already marked FE in saved data (manual vacation mark)
 *
 * Employees failing this check will be treated as absent on Sundays and are
 * NOT counted toward MIN_SUNDAY_WORKERS.
 */
export function isSundayUnavailable(
  emp: Employee,
  dateStr: string,           // 'YYYY-MM-DD'
  monthKey: string,          // 'YYYY-MM'
  dayIdx: number             // 0-based day index
): boolean {
  // 1. Vacation
  if (emp.vacationStart && emp.vacationEnd) {
    if (dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) return true;
  }
  // 1c. Atestado
  if (emp.atestadoStart && emp.atestadoEnd) {
    if (dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) return true;
  }
  // 1b. Birthday
  if (isBirthday(emp, dateStr)) return true;
  // 2. Preferred day off is Sunday or Estoquista
  if (isEmployeePreferredDayOff(emp, 0) || emp.cargo === 'Estoquista') return true;
  // 3. Not yet hired
  if (emp.hiredAt && dateStr < emp.hiredAt) return true;
  // 4. Already fired
  if (emp.firedAt && dateStr > emp.firedAt) return true;
  // 5. Existing shift already FF (folga feriado), C (curso) or AT (atestado)
  const existing = (emp.shifts[monthKey] ?? [])[dayIdx] as string | undefined;
  if (existing?.startsWith('FF') || existing === 'C' || existing === 'AT') return true;
  return false;
}

/**
 * Scans the last 2 Sundays of the previous month to compute each employee's
 * "consecutive Sundays worked" count coming into the target month.
 */
export function getPrevMonthConsecutive(
  activeRegular: Employee[],
  year: number,
  month: number   // 0-indexed target month
): Map<string, number> {
  const result = new Map<string, number>();
  for (const emp of activeRegular) result.set(emp.id, 0);

  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }
  if (prevYear < 2020) return result;

  const prevMonthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

  // Collect the last 2 Sundays of the previous month (most-recent first)
  const prevSundays: number[] = [];
  for (let d = daysInPrevMonth - 1; d >= 0 && prevSundays.length < 2; d--) {
    if (new Date(prevYear, prevMonth, d + 1).getDay() === 0) prevSundays.push(d);
  }

  if (prevSundays.length === 0) return result;

  for (const emp of activeRegular) {
    const prevShifts = emp.shifts[prevMonthKey];
    if (!prevShifts) { result.set(emp.id, 0); continue; }

    const workedLast = isWorkingShift(prevShifts[prevSundays[0]]) || prevShifts[prevSundays[0]] === 'FF';
    const workedSecond = prevSundays.length > 1 &&
      (isWorkingShift(prevShifts[prevSundays[1]]) || prevShifts[prevSundays[1]] === 'FF');

    if (workedLast && workedSecond) {
      result.set(emp.id, 2);
    } else if (workedLast) {
      result.set(emp.id, 1);
    } else {
      result.set(emp.id, 0);
    }
  }

  return result;
}

/**
 * Core Sunday rotation algorithm — RECOMPUTED FRESH EACH MONTH.
 */
export function buildSundayAssignments(
  activeRegular: Employee[],
  year: number,
  month: number,
  sundaysInMonth: number[],
  initialConsecutive?: Map<string, number>,
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
  protectedDays?: Record<number, number | ProtectedDayDetail> | number[],
  targetEmpId?: string
): { assignments: Map<string, Set<number>>, nextConsecutive: Map<string, number> } {
  const assignments = new Map<string, Set<number>>();
  const consecutive = new Map<string, number>();

  for (const emp of activeRegular) {
    assignments.set(emp.id, new Set());
    consecutive.set(emp.id, initialConsecutive?.get(emp.id) ?? 0);
  }

  if (sundaysInMonth.length === 0 || activeRegular.length === 0) {
    return { assignments, nextConsecutive: consecutive };
  }

  const protectedDetails = normalizeProtectedDaysDetails(protectedDays);
  const rotationOffset = month % Math.max(activeRegular.length, 1);
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const rotIdx = (emp: Employee) => (activeRegular.indexOf(emp) - rotationOffset + activeRegular.length) % activeRegular.length;

  for (const sundayDayIdx of sundaysInMonth) {
    const dayNum = sundayDayIdx + 1;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const isProtectedSunday = protectedDetails[dayNum] !== undefined;
    const maxFolgas = isProtectedSunday ? protectedDetails[dayNum].maxFolgas : undefined;
    const mandatoryIds = isProtectedSunday ? protectedDetails[dayNum].mandatoryEmployeeIds : undefined;

    // Build the eligible pool for rotation
    const available = activeRegular.filter(
      emp => !isSundayUnavailable(emp, dateStr, monthKey, sundayDayIdx)
    );

    const resting = new Set<string>();
    const working = new Set<string>();

    // Quando calculando avulso para um colaborador específico, leva em conta quem já trabalha no domingo
    if (targetEmpId) {
      activeRegular.forEach(emp => {
        if (emp.id !== targetEmpId) {
          const shift = emp.shifts[monthKey]?.[sundayDayIdx];
          if (shift && isWorkingShift(shift)) {
            working.add(emp.id);
          } else if (shift && shift !== 'N/A') {
            resting.add(emp.id);
          }
        }
      });
    }

    if (isProtectedSunday && maxFolgas === 0 && (!mandatoryIds || mandatoryIds.length === 0)) {
      available.forEach(emp => working.add(emp.id));
    } else {
      if (mandatoryIds && mandatoryIds.length > 0) {
        available.forEach(emp => {
          if (mandatoryIds.includes(emp.id)) {
            working.add(emp.id);
          }
        });
      }

      const mustRest = available.filter(emp => !working.has(emp.id) && (consecutive.get(emp.id) ?? 0) >= 2);
      const canWork = available.filter(emp => !working.has(emp.id) && (consecutive.get(emp.id) ?? 0) < 2);

      const regularCanWork = canWork.filter(emp => emp.cargo !== 'Estoquista');
      const estoquistasCanWork = canWork.filter(emp => emp.cargo === 'Estoquista');

      const maxRestAllowed = maxFolgas !== undefined ? Math.max(0, maxFolgas) : available.length;

      mustRest.forEach(emp => {
        if (resting.size < maxRestAllowed) {
          resting.add(emp.id);
        } else {
          working.add(emp.id);
        }
      });

      const effectiveMinWorkers = Math.min(settings.minSundayWorkers, available.length);
      const neededWorkers = maxFolgas !== undefined
        ? Math.max(effectiveMinWorkers, available.length - maxRestAllowed)
        : effectiveMinWorkers;

      regularCanWork.sort((a, b) => {
        const streakA = consecutive.get(a.id) ?? 0;
        const streakB = consecutive.get(b.id) ?? 0;
        if (streakA !== streakB) return streakA - streakB;
        return rotIdx(a) - rotIdx(b);
      });

      estoquistasCanWork.sort((a, b) => {
        const streakA = consecutive.get(a.id) ?? 0;
        const streakB = consecutive.get(b.id) ?? 0;
        if (streakA !== streakB) return streakA - streakB;
        return rotIdx(a) - rotIdx(b);
      });

      for (const emp of regularCanWork) {
        if (working.size < neededWorkers) {
          working.add(emp.id);
        } else if (resting.size < maxRestAllowed) {
          resting.add(emp.id);
        } else {
          working.add(emp.id);
        }
      }

      for (const emp of estoquistasCanWork) {
        if (working.size < neededWorkers) {
          working.add(emp.id);
        } else if (resting.size < maxRestAllowed) {
          resting.add(emp.id);
        } else {
          working.add(emp.id);
        }
      }
    }

    for (const empId of resting) assignments.get(empId)!.add(sundayDayIdx);

    for (const emp of activeRegular) {
      if (!available.includes(emp)) {
        consecutive.set(emp.id, 0);
      } else {
        consecutive.set(
          emp.id,
          resting.has(emp.id) ? 0 : (consecutive.get(emp.id) ?? 0) + 1
        );
      }
    }
  }

  return { assignments, nextConsecutive: consecutive };
}

/**
 * Encontra infrações CLT de domingos (trabalhar 3 ou mais domingos seguidos).
 */
export function findSundayViolations(
  employees: Employee[],
  currentMY: { month: number; year: number }
): { empName: string; date: string }[] {
  const violations: { empName: string; date: string }[] = [];
  const allSundays: { dateStr: string; monthKey: string; dayIdx: number }[] = [];

  const currentMonthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const nextDate = new Date(currentMY.year, currentMY.month + 1, 1);
  const nextMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

  const targetMonthKeys = [currentMonthKey, nextMonthKey];

  targetMonthKeys.forEach(monthKey => {
    const [year, month] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 0; d < daysInMonth; d++) {
      const date = new Date(year, month - 1, d + 1);
      if (date.getDay() === 0) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
        allSundays.push({ dateStr, monthKey, dayIdx: d });
      }
    }
  });

  employees.forEach(emp => {
    let streak = 0;
    let lastSunDate: Date | null = null;

    allSundays.forEach(sun => {
      const shift = emp.shifts[sun.monthKey]?.[sun.dayIdx];
      const currentSunDate = new Date(sun.dateStr + 'T12:00:00');

      if (isWorkingShift(shift)) {
        if (lastSunDate) {
          const diffDays = Math.round((currentSunDate.getTime() - lastSunDate.getTime()) / (1000 * 3600 * 24));
          if (diffDays > 7) {
            streak = 0;
          }
        }
        streak++;
        lastSunDate = currentSunDate;
        if (streak >= 3) {
          violations.push({ empName: emp.name, date: sun.dateStr });
        }
      } else if (shift && shift !== 'N/A') {
        streak = 0;
        lastSunDate = currentSunDate;
      } else if (!shift) {
        streak = 0;
        lastSunDate = null;
      }
    });
  });

  return violations;
}
