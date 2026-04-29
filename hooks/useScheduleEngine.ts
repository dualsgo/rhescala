
import { Employee, ShiftType, Holiday } from '../types';
import { SHIFT_HOURS, APPRENTICE_WORK_PERIOD, buildHolidaySet, getDefaultHourForDay } from '../constants';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Minimum CLT employees that must be WORKING on any Sunday.
 * Rotation (giving rest) only activates when available > this threshold.
 * Hard constraint verified by isSundayUnavailable + safety cap in buildSundayAssignments.
 */
const MIN_SUNDAY_WORKERS = 5;

// ─── Shared weekday names ─────────────────────────────────────────────────────

const WEEKDAY_NAMES = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export function isWorkingShift(s: string | undefined): boolean {
    if (!s) return false;
    if (s === 'T') return true;
    if (['P1', 'P2', 'P3', 'P4', 'ESTOQUE'].includes(s)) return true;
    return false;
}


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
    // 1b. Birthday
    if (emp.birthday) {
        const empMD = emp.birthday.length > 5 ? emp.birthday.substring(5) : emp.birthday;
        const dateMD = dateStr.length > 5 ? dateStr.substring(5) : dateStr;
        if (empMD === dateMD) return true;
    }
    // 2. Preferred day off is Sunday
    if (emp.preferredDayOff === 'Domingo') return true;
    // 3. Not yet hired
    if (emp.hiredAt && dateStr < emp.hiredAt) return true;
    // 4. Already fired
    if (emp.firedAt && dateStr > emp.firedAt) return true;
    // 5. Existing shift already FE (manually set vacation) or F or FF
    const existing = (emp.shifts[monthKey] ?? [])[dayIdx] as string | undefined;
    if (existing === 'FE' || existing === 'F' || existing?.startsWith('FF') || existing === 'C' || existing === 'DO') return true;
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
/**
 * Scans the last days of the previous month to compute each employee's
 * current work streak (consecutive days without a break).
 */
export function getPrevMonthWorkStreak(
    employees: Employee[],
    year: number,
    month: number
): Map<string, number> {
    const result = new Map<string, number>();
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }

    const prevMonthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

    for (const emp of employees) {
        let streak = 0;
        const shifts = emp.shifts[prevMonthKey];
        if (shifts) {
            for (let d = daysInPrevMonth - 1; d >= 0; d--) {
                const s = shifts[d];
                // Férias (FE) quebras a sequência de trabalho
                if (isWorkingShift(s) || s === 'C') {
                    streak++;
                } else {

                    break;
                }
            }
        }
        result.set(emp.id, streak);
    }
    return result;
}

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

/**
 * Checks if the given date string is the employee's birthday.
 */
function isBirthday(emp: Employee, dateStr: string): boolean {
    if (!emp.birthday) return false;
    // Both are ISO YYYY-MM-DD or MM-DD, we compare the MM-DD part
    // e.g., "1990-04-10" -> "04-10", "2026-04-10" -> "04-10"
    const empMD = emp.birthday.length > 5 ? emp.birthday.substring(5) : emp.birthday;
    const dateMD = dateStr.length > 5 ? dateStr.substring(5) : dateStr;
    return empMD === dateMD;
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
        if (isBirthday(emp, dateStr)) {
            shifts.push('DO'); hours.push(getTargetHours(emp, dow, isHoliday)); continue;
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

            // Pass: Tactical Positioning for the whole month
            for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
                const isHoliday = holidaySet.has(dateStr);
                const isSunday = new Date(year, month, dayIdx + 1).getDay() === 0;

                const empsForDay = activeRegular.map(emp => ({
                    ...emp,
                    shifts: {
                        ...emp.shifts,
                        [monthKey]: result[emp.id][monthKey].shifts
                    },
                    dailyHours: {
                        ...emp.dailyHours,
                        [monthKey]: result[emp.id][monthKey].hours
                    }
                }));

                const positions = resolveTacticalDay(empsForDay, monthKey, dayIdx, isHoliday, isSunday);
                
                activeRegular.forEach(emp => {
                    if (result[emp.id][monthKey].shifts[dayIdx] === 'T' && positions[emp.id]) {
                        result[emp.id][monthKey].shifts[dayIdx] = positions[emp.id] as ShiftType;
                    }
                });
            }

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

export function calculateLunches(
    members: any[],
    isHoliday: boolean,
    isSunday: boolean,
    isOpening: boolean
): string[] {
    // 1. Fixed Rules
    if (isHoliday) return members.map(() => '15 min');

    // Filter people who need slot allocation (CLT regular employees)
    const allocatableIndices: number[] = [];
    const results: string[] = Array(members.length).fill('');

    members.forEach((m, idx) => {
        if (m.isYoungApprentice) {
            results[idx] = '12h45';
        } else if (m.cargo === 'Estoquista') {
            results[idx] = 'Flexível';
        } else {
            allocatableIndices.push(idx);
        }
    });

    const N = allocatableIndices.length;
    if (N === 0) return results;

    if (isSunday) {
        // 4. Sunday Specific Logic
        // Turno 1 (Abertura 12h-20h) -> All at 13h
        // Turno 2 (13h-21h) -> Distributed in 14h, 15h, 16h, 17h
        if (isOpening) {
            allocatableIndices.forEach(originalIdx => {
                results[originalIdx] = '13h';
            });
        } else {
            const sundayClosingSlots = ['14h', '15h', '16h', '17h'];
            for (let i = 0; i < N; i++) {
                results[allocatableIndices[i]] = sundayClosingSlots[i % 4];
            }
            // Optional: Sort for consistency if N > 4
            if (N > 4) {
               // The loop already handles i % 4, so it's distributed.
            }
        }
        return results;
    }

    if (isOpening) {
        // 2. Opening Logic (Abertura/Domingo)
        // Slots: 13h, 13h30, 14h
        // Priority: Preservation of presence before 13h40. 14h is favored as closing team arrives.
        
        const openingPlan: string[] = [];
        if (N === 1) {
            openingPlan.push('14h');
        } else if (N === 2) {
            openingPlan.push('13h', '14h');
        } else if (N === 3) {
            openingPlan.push('13h', '14h', '14h');
        } else if (N === 4) {
            openingPlan.push('13h', '13h30', '14h', '14h');
        } else {
            // N > 4: Fill 14h and 13h30 first
            for (let i = 0; i < N; i++) {
                if (i % 3 === 0) openingPlan.push('14h');
                else if (i % 3 === 1) openingPlan.push('13h30');
                else openingPlan.push('13h');
            }
        }
        
        allocatableIndices.forEach((originalIdx, i) => {
            results[originalIdx] = openingPlan[i] || '14h';
        });

    } else {
        // 3. Closing Logic (Fechamento)
        // Slots: 15h, 16h, 16h30, 17h
        // Priority: Spread as much as possible before doubling up. 
        
        const closingSlots = ['15h', '16h', '16h30', '17h'];
        const closingPlan: string[] = [];

        if (N <= 4) {
            // Max spread logic
            if (N === 1) closingPlan.push('15h');
            else if (N === 2) closingPlan.push('15h', '17h');
            else if (N === 3) closingPlan.push('15h', '16h', '17h');
            else if (N === 4) closingPlan.push('15h', '16h', '16h30', '17h');
        } else {
            // N > 4: Fill all 4 slots first, then double up starting from 15h
            for (let i = 0; i < N; i++) {
                closingPlan.push(closingSlots[i % 4]);
            }
            // Sort plan to keep doubles together or ordered (optional, but consistent)
            closingPlan.sort((a, b) => {
                const order = { '15h': 0, '16h': 1, '16h30': 2, '17h': 3 };
                return order[a as keyof typeof order] - order[b as keyof typeof order];
            });
        }

        allocatableIndices.forEach((originalIdx, i) => {
            results[originalIdx] = closingPlan[i] || '15h';
        });
    }

    return results;
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
    const prevStreaks = getPrevMonthWorkStreak(activeRegular, year, month);

    activeRegular.forEach(emp => {
        const restDays = sundayAssignments.get(emp.id) ?? new Set<number>();
        const existingShifts = emp.shifts[monthKey] || [];
        const existingHours = emp.dailyHours[monthKey] || [];
        const newShifts: ShiftType[] = Array(daysInMonth).fill('T');

        // Build hours: preserve existing manual hourly changes, else use workPeriod/targetHours
        const newHours: string[] = Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(year, month, i + 1);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            const exH = existingHours[i];
            // Preserve explicit customization, otherwise recompute from workPeriod
            if (exH && exH !== emp.workPeriod) return exH;
            return getTargetHours(emp, date.getDay(), holidaySet.has(dateStr));
        });

        // 1. Pass: Apply absolute constraints and preferred day-off for ALL weekdays
        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
            const dow = new Date(year, month, dayIdx + 1).getDay();

            // Start from existing shift (preserve manual edits as baseline)
            if (existingShifts[dayIdx]) {
                newShifts[dayIdx] = existingShifts[dayIdx];
            }

            // Hard overrides (highest priority)
            if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) {
                newShifts[dayIdx] = 'FE'; continue;
            }
            if (isBirthday(emp, dateStr)) {
                newShifts[dayIdx] = 'DO'; continue;
            }
            if ((emp.hiredAt && dateStr < emp.hiredAt) || (emp.firedAt && dateStr > emp.firedAt)) {
                newShifts[dayIdx] = 'F'; continue;
            }

            // Sunday rotation logic
            if (dow === 0) {
                const ex = existingShifts[dayIdx];
                if (ex === 'FE' || ex?.startsWith('FF') || ex === 'F') {
                    newShifts[dayIdx] = ex; // Respect manual time off on Sundays
                } else if (emp.preferredDayOff === 'Domingo' || restDays.has(dayIdx)) {
                    newShifts[dayIdx] = 'F';
                } else {
                    newShifts[dayIdx] = 'T';
                }
                continue;
            }

            // Apply preferred weekday-off in Pass 1 (not deferred to streak pass)
            // This prevents the streak pass from accidentally voiding the preferred day
            if (emp.preferredDayOff && WEEKDAY_NAMES[dow] === emp.preferredDayOff) {
                newShifts[dayIdx] = 'F';
                continue;
            }

            // All remaining regular weekdays default to T (or keep existing if not overridden)
            if (!existingShifts[dayIdx] || existingShifts[dayIdx] === 'T') {
                newShifts[dayIdx] = 'T';
            }
        }

        // 2. Pass: Streak-based force-rest (6x1 compliance)
        // At this point preferred day-offs are already set — only enforce max-streak rule here
        let currentStreak = prevStreaks.get(emp.id) || 0;

        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const shift = newShifts[dayIdx];
            if (shift === 'FE' || shift === 'F' || shift?.startsWith('FF') || shift === 'C' || shift === 'N/A') {
                currentStreak = 0;
                continue;
            }

            // shift === 'T'
            currentStreak++;

            if (currentStreak > 6) {
                // Force a rest day — pick the next non-Sunday non-preferred day
                newShifts[dayIdx] = 'F';
                currentStreak = 0;
            }
        }

        result[emp.id] = { shifts: newShifts, hours: newHours };
    });

    // ── Apprentices ────────────────────────────────────────────────────────────
    activeApprentices.forEach(emp => {
        const existingShifts = emp.shifts[monthKey] || [];
        const newShifts: ShiftType[] = Array(daysInMonth).fill('T');
        
        const newHours: string[] = Array.from({ length: daysInMonth }, (_, i) => {
            const exH = (emp.dailyHours[monthKey] ?? [])[i];
            return exH || APPRENTICE_WORK_PERIOD;
        });

        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            if (existingShifts[dayIdx]) {
                newShifts[dayIdx] = existingShifts[dayIdx];
            }

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

            if (isBirthday(emp, dateStr)) {
                newShifts[dayIdx] = 'DO'; continue;
            }

            if (isHoliday) {
                if (!existingShifts[dayIdx] || (!['FE', 'FF', 'T'].includes(existingShifts[dayIdx]))) {
                    newShifts[dayIdx] = 'F';
                }
                continue;
            }
            if (dow === 0 || dow === 6) {
                if (!existingShifts[dayIdx] || (!['FE', 'FF', 'T'].includes(existingShifts[dayIdx]))) {
                    newShifts[dayIdx] = 'F';
                }
                continue;
            }
            if (WEEKDAY_NAMES[dow] === emp.courseDay) {
                if (existingShifts[dayIdx] !== 'FE' && !existingShifts[dayIdx]?.startsWith('FF') && existingShifts[dayIdx] !== 'F') {
                    newShifts[dayIdx] = 'C';
                }
                continue;
            }
        }

        result[emp.id] = { shifts: newShifts, hours: newHours };
    });

    // 3. Pass: Tactical Positioning (New Feature)
    for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
        const isHoliday = holidaySet.has(dateStr);
        const isSunday = new Date(year, month, dayIdx + 1).getDay() === 0;

        // Create virtual "active employees" with current pending shifts to resolve positions
        const empsForDay = activeRegular.map(emp => ({
            ...emp,
            shifts: {
                ...emp.shifts,
                [monthKey]: result[emp.id].shifts
            },
            dailyHours: {
                ...emp.dailyHours,
                [monthKey]: result[emp.id].hours
            }
        }));

        const positions = resolveTacticalDay(empsForDay, monthKey, dayIdx, isHoliday, isSunday);
        
        // Update the shifts in result
        activeRegular.forEach(emp => {
            if (result[emp.id].shifts[dayIdx] === 'T' && positions[emp.id]) {
                result[emp.id].shifts[dayIdx] = positions[emp.id] as ShiftType;
            }
        });
    }

    return result;
}

export function getShiftClassification(hourRange: string, isSunday?: boolean): 'Abertura' | 'Intermediário' | 'Fechamento' | 'N/A' {
    if (!hourRange || hourRange === 'OFF' || hourRange === 'FOLGA') return 'N/A';
    
    // Apprentice is always considered 'Abertura' for positioning purposes
    if (hourRange === APPRENTICE_WORK_PERIOD) return 'Abertura';

    const match = hourRange.match(/^(\d{1,2})[h:]/);
    if (!match) return 'Intermediário';
    const startHour = parseInt(match[1]);
    
    if (isSunday) {
        if (startHour <= 12) return 'Abertura';
        return 'Fechamento';
    }
    
    // Novas regras baseadas na solicitação:
    // 10h as 18h20 abertura
    // 12h as 20h20 intermediario
    // 13h40 as 22h fechamento
    
    if (startHour <= 10) return 'Abertura';
    if (startHour >= 13) return 'Fechamento'; // Captura 13h40 e 14h
    return 'Intermediário';
}

export function resolveTacticalDay(
    activeEmps: Employee[],
    monthKey: string,
    dayIdx: number,
    isHoliday: boolean,
    isSunday: boolean
): Record<string, string> {
    const result: Record<string, string> = {};
    const groups: Record<string, Employee[]> = {};
    
    activeEmps.forEach(e => {
        const shift = e.shifts[monthKey]?.[dayIdx] || 'T';
        if (!isWorkingShift(shift) && !shift.startsWith('FF')) return;

        
        const hour = e.dailyHours[monthKey]?.[dayIdx] || getDefaultHourForDay(e, isHoliday, isSunday);
        const classification = getShiftClassification(hour, isSunday);
        if (classification === 'N/A') return;

        if (!groups[classification]) groups[classification] = [];
        groups[classification].push(e);
    });

    const POSITIONS = ['P1', 'P2', 'P3', 'P4', 'ESTOQUE'];

    // Process each classification group (Abertura, Intermediário, Fechamento)
    // Sorting groups ensures Abertura is processed first if needed
    const groupNames = Object.keys(groups).sort((a, b) => {
        const order = { 'Abertura': 0, 'Intermediário': 1, 'Fechamento': 2 };
        return (order[a as keyof typeof order] ?? 99) - (order[b as keyof typeof order] ?? 99);
    });

    groupNames.forEach(groupName => {
        const members = groups[groupName];
        const takenPositions = new Set<string>();
        const autoMembers: Employee[] = [];

        members.forEach(m => {
            const pos = m.tacticalPositions?.[monthKey]?.[dayIdx];
            if (pos && pos !== 'AUTO') {
                takenPositions.add(pos);
                result[m.id] = pos;
            } else {
                autoMembers.push(m);
            }
        });

        // 2. Mandatory Fill: P1 (Caixa)
        if (!takenPositions.has('P1')) {
            // Try to find someone who prefers P1
            const prefersP1 = autoMembers.find(m => !result[m.id] && (m.preferredPosition1 === 'P1' || m.preferredPosition2 === 'P1'));
            const candidate = prefersP1 || autoMembers.find(m => !result[m.id]);
            if (candidate) {
                result[candidate.id] = 'P1';
                takenPositions.add('P1');
            }
        }

        // 3. Mandatory Fill: P2 (Porta)
        if (!takenPositions.has('P2')) {
            // Try to find someone who prefers P2
            const prefersP2 = autoMembers.find(m => !result[m.id] && (m.preferredPosition1 === 'P2' || m.preferredPosition2 === 'P2'));
            const candidate = prefersP2 || autoMembers.find(m => !result[m.id]);
            if (candidate) {
                result[candidate.id] = 'P2';
                takenPositions.add('P2');
            }
        }

        // 4. Preferences for the rest
        autoMembers.filter(m => !result[m.id]).forEach(m => {
            let assigned = false;
            if (m.preferredPosition1 && !takenPositions.has(m.preferredPosition1)) {
                // For P3/P4 we allow multiples, so we don't strictly "block" the position in takenPositions
                // unless it's P1 or P2 (which are already handled)
                result[m.id] = m.preferredPosition1;
                assigned = true;
            } else if (m.preferredPosition2 && !takenPositions.has(m.preferredPosition2)) {
                result[m.id] = m.preferredPosition2;
                assigned = true;
            }

            if (!assigned) {
                // 5. Final Auto-Fill (P3, P3, P4...)
                const p3Count = Object.values(result).filter(v => v === 'P3').length;
                if (p3Count < 2) {
                    result[m.id] = 'P3';
                } else {
                    result[m.id] = 'P4';
                }
            }
        });
    });

    return result;
}

export function findSundayViolations(employees: Employee[], currentMY: { month: number, year: number }): { empName: string, date: string }[] {
    const violations: { empName: string, date: string }[] = [];
    const allSundays: { dateStr: string, monthKey: string, dayIdx: number }[] = [];
    
    const currentMonthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
    const nextDate = new Date(currentMY.year, currentMY.month + 1, 1);
    const nextMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    
    const targetMonthKeys = [currentMonthKey, nextMonthKey];
    
    // Find all Sundays in these specific months
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

    // For each employee, check streak in allSundays
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
                // No data for this Sunday (e.g. month not generated yet)
                // We should probably reset streak to avoid false positives across gaps
                streak = 0;
                lastSunDate = null;
            }
        });
    });

    return violations;
}
