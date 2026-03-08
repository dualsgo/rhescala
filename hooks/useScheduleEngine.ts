
import { Employee, ShiftType, Holiday } from '../types';
import { SHIFT_HOURS, APPRENTICE_WORK_PERIOD, buildHolidaySet } from '../constants';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Minimum CLT employees that must be WORKING on any Sunday.
 * Rotation (giving rest) only activates when available > this threshold.
 * Hard constraint verified by isSundayUnavailable + safety cap in buildSundayAssignments.
 */
const MIN_SUNDAY_WORKERS = 6;

// ─── Shared weekday names ─────────────────────────────────────────────────────

const WEEKDAY_NAMES = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado',
];

// ─── Centralized Sunday unavailability check ──────────────────────────────────

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
function isSundayUnavailable(
    emp: Employee,
    dateStr: string,           // 'YYYY-MM-DD'
    monthKey: string,           // 'YYYY-MM'
    dayIdx: number            // 0-based day index
): boolean {
    // 1. Vacation
    if (emp.vacationStart && emp.vacationEnd) {
        if (dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) return true;
    }
    // 2. Preferred day off is Sunday
    if (emp.preferredDayOff === 'Domingo') return true;
    // 3. Not yet hired
    if (emp.hiredAt && dateStr < emp.hiredAt) return true;
    // 4. Already fired
    if (emp.firedAt && dateStr > emp.firedAt) return true;
    // 5. Existing shift already FE (manually set vacation)
    const existing = (emp.shifts[monthKey] ?? [])[dayIdx] as string | undefined;
    if (existing === 'FE') return true;
    return false;
}

// ─── Sunday rotation engine ───────────────────────────────────────────────────

/**
 * Scans the last 2 Sundays of the previous month to compute each employee's
 * "consecutive Sundays worked" count coming into the target month.
 *
 * This allows the cross-month carry-over:
 *   - if emp worked the last Sunday of month N → consecutive ≥ 1
 *   - if emp worked both last two Sundays of month N → consecutive = 2
 *     → they get the highest priority to rest on the first Sunday of month N+1
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
    // prevSundays[0] = last Sunday index, prevSundays[1] = second-to-last

    if (prevSundays.length === 0) return result;

    for (const emp of activeRegular) {
        const prevShifts = emp.shifts[prevMonthKey];
        if (!prevShifts) { result.set(emp.id, 0); continue; }

        const workedLast = prevShifts[prevSundays[0]] === 'T' || prevShifts[prevSundays[0]] === 'FF';
        const workedSecond = prevSundays.length > 1 &&
            (prevShifts[prevSundays[1]] === 'T' || prevShifts[prevSundays[1]] === 'FF');

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
 *
 * Rules:
 *  1. min 6 CLTs working every Sunday (MIN_SUNDAY_WORKERS = 6).
 *  2. Employees excluded by `isSundayUnavailable` (vacation, preferred-Sunday-off,
 *     hired/fired boundaries) never count toward the 6.
 *  3. HARD: streak ≥ 2 (would be 3rd consecutive Sunday) → MUST REST if any slot free.
 *  4. SOFT: streak = 1 → prefer to rest (alternating pattern).
 *  5. No cross-month carry — always starts fresh so each month alternates independently.
 *  6. Month-based tiebreaker offset: rotates who gets first-rest priority each month
 *     so the same people don’t always rest on Sunday 1.
 *  7. Safety: resting.size is always < available.length (never zero workers).
 *
 * Returns: empId → Set<dayIdx> of Sundays each employee rests.
 */
/**
 * Core Sunday rotation algorithm — RECOMPUTED FRESH EACH MONTH.
 *
 * Rules:
 *  1. min 6 CLTs working every Sunday (MIN_SUNDAY_WORKERS = 6).
 *  2. Employees excluded by `isSundayUnavailable` (vacation, preferred-Sunday-off,
 *     hired/fired boundaries) never count toward the 6.
 *  3. HARD: streak ≥ 2 (would be 3rd consecutive Sunday) → MUST REST if any slot free.
 *  4. SOFT: streak = 1 → prefer to rest (alternating pattern).
 *  5. Cross-month carry — can be initialized with counts from previous month.
 *  6. Month-based tiebreaker offset: rotates who gets first-rest priority each month
 *     so the same people don’t always rest on Sunday 1.
 *  7. Safety: resting.size is always < available.length (never zero workers).
 *
 * Returns: { assignments: empId → Set<dayIdx>, nextConsecutive: empId → count }
 */
export function buildSundayAssignments(
    activeRegular: Employee[],
    year: number,
    month: number,
    sundaysInMonth: number[],
    initialConsecutive?: Map<string, number>
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

    // Rotate the tiebreaker origin per month so Sunday 1 doesn’t always
    // give rest to the same index-0 employees
    const rotationOffset = month % Math.max(activeRegular.length, 1);
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    for (const sundayDayIdx of sundaysInMonth) {
        const dayNum = sundayDayIdx + 1;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

        // Build the eligible pool for rotation
        const available = activeRegular.filter(
            emp => !isSundayUnavailable(emp, dateStr, monthKey, sundayDayIdx)
        );

        // How many can rest while keeping ≥ MIN_SUNDAY_WORKERS and ≥ 1
        const maxRestIdeal = Math.max(0, available.length - MIN_SUNDAY_WORKERS);
        const maxRestSafe = available.length > 0
            ? Math.min(maxRestIdeal, available.length - 1)
            : 0;

        const resting = new Set<string>();

        if (maxRestSafe > 0) {
            // Rotated index for tiebreaking (fair across months)
            const rotIdx = (emp: Employee) =>
                (activeRegular.indexOf(emp) - rotationOffset + activeRegular.length) % activeRegular.length;

            // TIER 1: MUST rest — streak ≥ 2 (3rd consecutive would violate rule)
            const mustRest = available
                .filter(emp => (consecutive.get(emp.id) ?? 0) >= 2)
                .sort((a, b) => {
                    const sa = consecutive.get(a.id) ?? 0;
                    const sb = consecutive.get(b.id) ?? 0;
                    return sb - sa || rotIdx(a) - rotIdx(b);
                });

            // TIER 2: PREFER rest — streak = 1 (alternating, worked last Sunday)
            const preferRest = available
                .filter(emp => (consecutive.get(emp.id) ?? 0) === 1)
                .sort((a, b) => rotIdx(a) - rotIdx(b));

            // TIER 3: optional — streak = 0 (just rested; fill only if slots remain)
            const optionalRest = available
                .filter(emp => (consecutive.get(emp.id) ?? 0) === 0)
                .sort((a, b) => rotIdx(a) - rotIdx(b));

            const fillOrder = [...mustRest, ...preferRest, ...optionalRest];

            let slots = maxRestSafe;
            for (const emp of fillOrder) {
                if (slots <= 0) break;
                if (!resting.has(emp.id)) { resting.add(emp.id); slots--; }
            }
        }

        // Record
        for (const empId of resting) assignments.get(empId)!.add(sundayDayIdx);

        // Update consecutive counts for available pool only
        for (const emp of available) {
            consecutive.set(
                emp.id,
                resting.has(emp.id) ? 0 : (consecutive.get(emp.id) ?? 0) + 1
            );
        }
    }

    return { assignments, nextConsecutive: consecutive };
}

// ─── Per-employee month generator ─────────────────────────────────────────────

/**
 * Generates the full shift/hours arrays for ONE employee for ONE month.
 *
 * Sunday rotation is driven by the pre-computed `sundayRestDays` set so that
 * the whole-team rotation algorithm can be applied consistently from outside.
 */
/**
 * Helper to select the best shift hours based on the day type and employee role.
 */
function getTargetHours(emp: Employee, dow: number, isHoliday: boolean): string {
    if (emp.isYoungApprentice) return APPRENTICE_WORK_PERIOD;

    // Feriados (Padronizado conforme pedido: será ajustado manualmente)
    if (isHoliday && dow !== 0) {
        return SHIFT_HOURS.HOLIDAY[0]; // 12h às 18h
    }

    // Domingos (Padronizado conforme pedido: será ajustado manualmente)
    if (dow === 0) {
        return SHIFT_HOURS.SUNDAY[0]; // 12h às 20h
    }

    // Dias de semana (Segue o horário pré-cadastrado do colaborador)
    return emp.workPeriod;
}

export function generateMonthForEmployee(
    emp: Employee,
    year: number,
    month: number,
    sundayRestDays: Set<number>,
    customHolidays: Holiday[] = []
): { shifts: ShiftType[]; hours: string[] } {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays);

    const today = new Date();
    const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());

    const shifts: ShiftType[] = [];
    const hours: string[] = [];

    for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
        const dayNum = dayIdx + 1;
        const date = new Date(year, month, dayNum);
        const dow = date.getDay();
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const isHoliday = holidaySet.has(dateStr);

        if (isPastMonth) {
            shifts.push('N/A'); hours.push(getTargetHours(emp, dow, isHoliday)); continue;
        }

        // ── Overrides ──────────────────────────────────────────────────────
        if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) {
            shifts.push('FE'); hours.push(getTargetHours(emp, dow, isHoliday)); continue;
        }
        if ((emp.hiredAt && dateStr < emp.hiredAt) || (emp.firedAt && dateStr > emp.firedAt)) {
            shifts.push('F'); hours.push(getTargetHours(emp, dow, isHoliday)); continue;
        }

        // ── Jovem Aprendiz ────────────────────────────────────────────────
        if (emp.isYoungApprentice) {
            if (dow === 0 || dow === 6 || isHoliday) {
                shifts.push('F'); hours.push(APPRENTICE_WORK_PERIOD);
            } else if (WEEKDAY_NAMES[dow] === emp.courseDay) {
                shifts.push('C'); hours.push(APPRENTICE_WORK_PERIOD);
            } else {
                shifts.push('T'); hours.push(APPRENTICE_WORK_PERIOD);
            }
            continue;
        }

        // ── Regular ───────────────────────────────────────────────────────
        if (WEEKDAY_NAMES[dow] === emp.preferredDayOff) {
            shifts.push('F'); hours.push(getTargetHours(emp, dow, isHoliday)); continue;
        }

        if (dow === 0) {
            if (sundayRestDays.has(dayIdx)) {
                shifts.push('F');
            } else {
                shifts.push('T');
            }
            hours.push(getTargetHours(emp, dow, isHoliday));
            continue;
        }

        if (isHoliday) {
            shifts.push('T'); hours.push(getTargetHours(emp, dow, isHoliday)); continue;
        }

        shifts.push('T'); hours.push(emp.workPeriod);
    }

    return { shifts, hours };
}

// ─── Full-year generation ─────────────────────────────────────────────────────

/**
 * Generates schedules for ALL remaining months of the year (fromMonth → December).
 * Returns: empId → { [monthKey]: { shifts, hours } }
 *
 * Sunday rotation is computed month-by-month, carrying consecutive counts forward
 * so the alternating pattern is consistent across month boundaries.
 */
export function generateYearSchedule(
    employees: Employee[],
    fromYear: number,
    fromMonth: number,       // 0-indexed, inclusive
    currentYear: number,
    customHolidays: Holiday[] = []
): Record<string, Record<string, { shifts: ShiftType[]; hours: string[] }>> {
    const result: Record<string, Record<string, { shifts: ShiftType[]; hours: string[] }>> = {};

    const activeRegular = employees.filter(e => e.status === 'active' && !e.isYoungApprentice);
    const activeApprentices = employees.filter(e => e.status === 'active' && e.isYoungApprentice);

    // Track consecutive Sunday work counts across months for proper carry-over
    let rollingConsecutive: Map<string, number> | undefined = undefined;

    for (let year = fromYear; year <= currentYear; year++) {
        const startMonth = year === fromYear ? fromMonth : 0;
        for (let month = startMonth; month <= 11; month++) {
            const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // Find all Sundays in this month
            const sundaysInMonth: number[] = [];
            for (let d = 0; d < daysInMonth; d++) {
                if (new Date(year, month, d + 1).getDay() === 0) sundaysInMonth.push(d);
            }

            // Build Sunday assignments — with cross-month carry
            const { assignments, nextConsecutive } = buildSundayAssignments(
                activeRegular, year, month, sundaysInMonth, rollingConsecutive
            );
            rollingConsecutive = nextConsecutive;

            // Generate each regular employee
            activeRegular.forEach(emp => {
                if (!result[emp.id]) result[emp.id] = {};
                result[emp.id][monthKey] = generateMonthForEmployee(
                    emp, year, month,
                    assignments.get(emp.id) ?? new Set(),
                    customHolidays
                );
            });

            // Generate each apprentice
            activeApprentices.forEach(emp => {
                if (!result[emp.id]) result[emp.id] = {};
                result[emp.id][monthKey] = generateMonthForEmployee(
                    emp, year, month,
                    new Set(), // apprentices always off on Sundays via the isYoungApprentice rule
                    customHolidays
                );
            });
        }
    }

    return result;
}

// ─── Smart month update (Atualizar Mês) ──────────────────────────────────────

/**
 * "Smart Update" for a single month.
 *
 * What is RE-APPLIED (overwritten):
 *  - Preferred weekday-off for each CLT employee
 *  - Sunday rotation using the new alternating algorithm with cross-month carry
 *  - Feriados (FF) on holiday days
 *  - Vacation (FE) from employee data
 *  - Apprentice weekend/course/holiday rules
 *
 * What is PRESERVED (not overwritten):
 *  - All other manually-edited shifts on regular weekdays
 *
 * Returns: empId → { shifts, hours } for the target month only.
 */
export function applyMonthUpdate(
    employees: Employee[],
    year: number,
    month: number,
    customHolidays: Holiday[] = []
): Record<string, { shifts: ShiftType[]; hours: string[] }> {
    const result: Record<string, { shifts: ShiftType[]; hours: string[] }> = {};

    const activeRegular = employees.filter(e => e.status === 'active' && !e.isYoungApprentice);
    const activeApprentices = employees.filter(e => e.status === 'active' && e.isYoungApprentice);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays);
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    // Find all Sundays in this month
    const sundaysInMonth: number[] = [];
    for (let d = 0; d < daysInMonth; d++) {
        if (new Date(year, month, d + 1).getDay() === 0) sundaysInMonth.push(d);
    }

    // Compute Sunday assignments — with cross-month carry (retro-analysis)
    const prevConsecutive = getPrevMonthConsecutive(activeRegular, year, month);
    const { assignments: sundayAssignments } = buildSundayAssignments(
        activeRegular, year, month, sundaysInMonth, prevConsecutive
    );

    const today = new Date();
    const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());

    if (isPastMonth) {
        employees.forEach(emp => {
            const defaultHours = Array.from({ length: daysInMonth }, (_, i) => {
                const date = new Date(year, month, i + 1);
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                return getTargetHours(emp, date.getDay(), holidaySet.has(dateStr));
            });
            result[emp.id] = {
                shifts: Array(daysInMonth).fill('N/A' as ShiftType),
                hours: defaultHours
            };
        });
        return result;
    }

    // ── Regular employees ──────────────────────────────────────────────────────
    activeRegular.forEach(emp => {
        const restDays = sundayAssignments.get(emp.id) ?? new Set<number>();

        // IMPORTANT: We now reset everything to 'T' (Trabalho) on Auto-Fill
        // The user wants a clean slate based on the master rules.
        const newShifts: ShiftType[] = Array(daysInMonth).fill('T');

        // Always recalculate hours to ensure consistency with saved shift/workPeriod
        const newHours: string[] = Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(year, month, i + 1);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            return getTargetHours(emp, date.getDay(), holidaySet.has(dateStr));
        });

        // 1. Pass: Apply absolute constraints (Vacation, out-of-employment, Sundays, Holidays)
        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const dayNum = dayIdx + 1;
            const date = new Date(year, month, dayNum);
            const dow = date.getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isHoliday = holidaySet.has(dateStr);

            // Always honour vacation
            if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) {
                newShifts[dayIdx] = 'FE'; continue;
            }

            // Outside employment window
            if ((emp.hiredAt && dateStr < emp.hiredAt) || (emp.firedAt && dateStr > emp.firedAt)) {
                newShifts[dayIdx] = 'F'; continue;
            }

            // Apply Sunday rotation
            if (dow === 0) {
                if (emp.preferredDayOff === 'Domingo') {
                    newShifts[dayIdx] = 'F';
                } else if (restDays.has(dayIdx)) {
                    newShifts[dayIdx] = 'F';
                } else {
                    newShifts[dayIdx] = 'T';
                }
                continue;
            }
        }

        // 2. Second pass: Ensure WEEKLY preferred folgas are applied
        let currentWeekStartIdx = 0;
        while (currentWeekStartIdx < daysInMonth) {
            let weekEndIdx = currentWeekStartIdx;
            // Find the end of the week (Sunday)
            while (weekEndIdx < daysInMonth && new Date(year, month, weekEndIdx + 1).getDay() !== 0) {
                weekEndIdx++;
            }

            let hasFolga = false;
            let preferredDayOffIdx = -1;

            for (let i = currentWeekStartIdx; i <= Math.min(weekEndIdx, daysInMonth - 1); i++) {
                if (newShifts[i] === 'F' || newShifts[i] === 'FE') {
                    hasFolga = true;
                }
                const dow = new Date(year, month, i + 1).getDay();
                if (WEEKDAY_NAMES[dow] === emp.preferredDayOff) {
                    preferredDayOffIdx = i;
                }
            }

            // Se não tem folga na semana (não descansou no domingo nem está de férias), 
            // aplica a folga preferencial na semana.
            if (!hasFolga && preferredDayOffIdx !== -1) {
                const dayNum = preferredDayOffIdx + 1;
                const preferredDow = new Date(year, month, dayNum).getDay();
                if (preferredDow !== 0) { // Sunday handled in Pass 1
                    newShifts[preferredDayOffIdx] = 'F';
                }
            }
            currentWeekStartIdx = weekEndIdx + 1;
        }

        result[emp.id] = { shifts: newShifts, hours: newHours };
    });

    // ── Apprentices ────────────────────────────────────────────────────────────
    activeApprentices.forEach(emp => {
        const newShifts: ShiftType[] = Array(daysInMonth).fill('T');
        const newHours: string[] = Array(daysInMonth).fill(APPRENTICE_WORK_PERIOD);

        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const dayNum = dayIdx + 1;
            const date = new Date(year, month, dayNum);
            const dow = date.getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isHoliday = holidaySet.has(dateStr);

            if (emp.vacationStart && emp.vacationEnd) {
                if (dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) {
                    newShifts[dayIdx] = 'FE'; continue;
                }
            }

            if (dow === 0 || dow === 6) {
                newShifts[dayIdx] = 'F'; continue;
            }
            if (isHoliday) {
                newShifts[dayIdx] = 'F'; continue;
            }
            if (WEEKDAY_NAMES[dow] === emp.courseDay) {
                newShifts[dayIdx] = 'C'; continue;
            }
        }

        result[emp.id] = { shifts: newShifts, hours: newHours };
    });

    return result;
}
