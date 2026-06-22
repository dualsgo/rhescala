
import { Employee, ShiftType, Holiday, JornadaSettings } from '../types';
import { SHIFT_HOURS, APPRENTICE_WORK_PERIOD, buildHolidaySet, getDefaultHourForDay, DEFAULT_JORNADA_SETTINGS } from '../constants';


// ─── Shared weekday names ─────────────────────────────────────────────────────

const WEEKDAY_NAMES = [
    'Domingo', 'Segunda', 'Terça', 'Quarta',
    'Quinta', 'Sexta', 'Sábado',
];

export function isWorkingShift(s: string | undefined): boolean {
    if (!s) return false;
    if (s === 'T') return true;
    if (['P1', 'P2', 'P3', 'P4', 'ESTQ'].includes(s)) return true;
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
    // 1c. Atestado
    if (emp.atestadoStart && emp.atestadoEnd) {
        if (dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) return true;
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
    // 5. Existing shift already FE (manually set vacation) or F or FF or AT
    const existing = (emp.shifts[monthKey] ?? [])[dayIdx] as string | undefined;
    if (existing === 'FE' || existing === 'F' || existing?.startsWith('FF') || existing === 'C' || existing === 'DO' || existing === 'AT') return true;
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
    initialConsecutive?: Map<string, number>,
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
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
        const maxRestIdeal = Math.max(0, available.length - settings.minSundayWorkers);
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
 * For holidays and Sundays, the employee's workPeriod is used to select the
 * proportional slot (so a "fechamento" employee keeps a closing-equivalent hour).
 */
function getTargetHours(emp: Employee, dow: number, isHoliday: boolean, settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS): string {
    if (emp.isYoungApprentice) {
        // Aprendiz folga Sábado, Domingo e Feriado
        if (dow === 0 || dow === 6 || isHoliday) return settings.shiftHours.sunday[0];
        return settings.shiftHours.apprentice[0];
    }

    const wp = emp.workPeriod || '';

    // Feriados (não-domingo)
    if (isHoliday && dow !== 0) {
        const holidaySlots = settings.shiftHours.holiday;
        // Map workPeriod → proportional holiday slot
        if (wp.startsWith('10h'))  return holidaySlots[0] ?? holidaySlots[0]; // 12h às 18h
        if (wp.startsWith('12h'))  return holidaySlots[1] ?? holidaySlots[0]; // 13h às 19h
        if (wp.startsWith('13h'))  return holidaySlots[holidaySlots.length - 1] ?? holidaySlots[0]; // 15h às 21h (fechamento)
        // Fallback: first slot
        return holidaySlots[0];
    }

    // Domingos
    if (dow === 0) {
        const sundaySlots = settings.shiftHours.sunday;
        // Abertura / Intermediário → opening Sunday; Fechamento → closing Sunday
        if (wp.startsWith('13h')) return sundaySlots[sundaySlots.length - 1] ?? sundaySlots[0]; // 13h às 21h
        return sundaySlots[0]; // 12h às 20h
    }

    // Dias de semana normais
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
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): { shifts: ShiftType[]; hours: string[] } {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);

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
            shifts.push('N/A'); hours.push(getTargetHours(emp, dow, isHoliday, settings)); continue;
        }

        // ── Overrides ──────────────────────────────────────────────────────
        if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) {
            shifts.push('FE'); hours.push(getTargetHours(emp, dow, isHoliday, settings)); continue;
        }
        if (emp.atestadoStart && emp.atestadoEnd && dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) {
            shifts.push('AT'); hours.push(getTargetHours(emp, dow, isHoliday, settings)); continue;
        }
        if (isBirthday(emp, dateStr)) {
            shifts.push('DO'); hours.push(getTargetHours(emp, dow, isHoliday, settings)); continue;
        }
        if ((emp.hiredAt && dateStr < emp.hiredAt) || (emp.firedAt && dateStr > emp.firedAt)) {
            shifts.push('F'); hours.push(getTargetHours(emp, dow, isHoliday, settings)); continue;
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
        const isPreferredDay = emp.preferredDayOff && (
            WEEKDAY_NAMES[dow] === emp.preferredDayOff || 
            `${WEEKDAY_NAMES[dow]}-feira` === emp.preferredDayOff ||
            WEEKDAY_NAMES[dow] === `${emp.preferredDayOff}-feira`
        );

        if (isPreferredDay) {
            shifts.push('F'); hours.push(getTargetHours(emp, dow, isHoliday, settings)); continue;
        }

        if (dow === 0) {
            if (sundayRestDays.has(dayIdx)) {
                shifts.push('F');
            } else {
                shifts.push('T');
            }
            hours.push(getTargetHours(emp, dow, isHoliday, settings));
            continue;
        }

        if (isHoliday) {
            shifts.push('T'); hours.push(getTargetHours(emp, dow, isHoliday, settings)); continue;
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
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
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
                activeRegular, year, month, sundaysInMonth, rollingConsecutive, settings
            );
            rollingConsecutive = nextConsecutive;

            // Generate each regular employee
            activeRegular.forEach(emp => {
                if (!result[emp.id]) result[emp.id] = {};
                result[emp.id][monthKey] = generateMonthForEmployee(
                    emp, year, month,
                    assignments.get(emp.id) ?? new Set(),
                    customHolidays,
                    deletedNationalHolidays
                );
            });

            // Pass: Tactical Positioning for the whole month
            for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
                const isHoliday = buildHolidaySet(year, customHolidays, deletedNationalHolidays).has(dateStr);
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

                const positions = resolveTacticalDay(empsForDay, monthKey, dayIdx, isHoliday, isSunday, settings);
                
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
                    customHolidays,
                    deletedNationalHolidays
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
    isOpening: boolean,
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): string[] {
    // 1. Fixed Rules
    if (isHoliday) return members.map(() => settings.lunchRules.holiday);

    // Filter people who need slot allocation (CLT regular employees)
    const allocatableIndices: number[] = [];
    const results: string[] = Array(members.length).fill('');

    members.forEach((m, idx) => {
        if (m.isYoungApprentice) {
            results[idx] = settings.lunchRules.apprentice;
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
                results[originalIdx] = settings.lunchRules.sundayOpening;
            });
        } else {
            const sundayClosingSlots = settings.lunchRules.sundayClosing;
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
        const openingSlots = settings.lunchRules.weekdayOpening;
        const OS = openingSlots.length;

        if (N <= OS) {
             // Fill from the end (later slots first)
             for (let i = 0; i < N; i++) {
                 openingPlan.push(openingSlots[OS - 1 - i]);
             }
             // Reverse to distribute evenly: e.g. for N=3 -> 13h, 13h30, 14h
             openingPlan.reverse();
        } else {
            for (let i = 0; i < N; i++) {
                if (i < OS) {
                    openingPlan.push(openingSlots[i]);
                } else {
                    // Extra people go to the last slot (14h) because the afternoon shift has arrived.
                    openingPlan.push(openingSlots[OS - 1]);
                }
            }
        }
        
        allocatableIndices.forEach((originalIdx, i) => {
            results[originalIdx] = openingPlan[i] || '14h';
        });

    } else {
        // 3. Closing Logic (Fechamento)
        // Slots: 15h, 16h, 16h30, 17h
        // Priority: Spread as much as possible before doubling up. 
        
        const closingSlots = settings.lunchRules.weekdayClosing;
        const closingPlan: string[] = [];
        const CS = closingSlots.length;

        if (N <= CS) {
             for (let i = 0; i < N; i++) {
                 closingPlan.push(closingSlots[i % CS]);
             }
        } else {
            // N > CS: Fill all slots first, then double up
            for (let i = 0; i < N; i++) {
                closingPlan.push(closingSlots[i % CS]);
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
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, { shifts: ShiftType[]; hours: string[] }> {
    const result: Record<string, { shifts: ShiftType[]; hours: string[] }> = {};

    const activeRegular = employees.filter(e => e.status === 'active' && !e.isYoungApprentice);
    const activeApprentices = employees.filter(e => e.status === 'active' && e.isYoungApprentice);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    // Find all Sundays in this month
    const sundaysInMonth: number[] = [];
    for (let d = 0; d < daysInMonth; d++) {
        if (new Date(year, month, d + 1).getDay() === 0) sundaysInMonth.push(d);
    }

    // Compute Sunday assignments — with cross-month carry (retro-analysis)
    const prevConsecutive = getPrevMonthConsecutive(activeRegular, year, month);
    const { assignments: sundayAssignments } = buildSundayAssignments(
        activeRegular, year, month, sundaysInMonth, prevConsecutive, settings
    );

    const today = new Date();
    const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());

    if (isPastMonth) {
        employees.forEach(emp => {
            const defaultHours = Array.from({ length: daysInMonth }, (_, i) => {
                const date = new Date(year, month, i + 1);
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                return getTargetHours(emp, date.getDay(), holidaySet.has(dateStr), settings);
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

    // Build a set of ALL hours the system could auto-generate — used below to
    // distinguish manual customisations from stale auto-generated values.
    const allSystemHours = new Set<string>([
        ...settings.shiftHours.weekday,
        ...settings.shiftHours.sunday,
        ...settings.shiftHours.holiday,
        ...settings.shiftHours.apprentice,
    ]);

    activeRegular.forEach(emp => {
        const restDays = sundayAssignments.get(emp.id) ?? new Set<number>();
        const existingShifts = emp.shifts[monthKey] || [];
        const existingHours = emp.dailyHours[monthKey] || [];
        const newShifts: ShiftType[] = Array(daysInMonth).fill('T');

        // Build hours: preserve truly manual overrides; recompute everything else.
        // A value is considered auto-generated (safe to overwrite) when it matches
        // the employee's workPeriod OR any value from the standard system slot lists.
        // Only hours that are NOT in those lists (e.g. a custom "11h30 às 19h50")
        // are treated as manual and preserved.
        const newHours: string[] = Array.from({ length: daysInMonth }, (_, i) => {
            const dow = new Date(year, month, i + 1).getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            const exH = existingHours[i];

            const wasAutoGenerated =
                !exH ||
                exH === emp.workPeriod ||
                allSystemHours.has(exH);

            if (exH && !wasAutoGenerated) return exH;
            return getTargetHours(emp, dow, holidaySet.has(dateStr), settings);
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

            // Apply preferred weekday-off in Pass 1
            const isPreferredDay = emp.preferredDayOff && (
                WEEKDAY_NAMES[dow] === emp.preferredDayOff || 
                `${WEEKDAY_NAMES[dow]}-feira` === emp.preferredDayOff ||
                WEEKDAY_NAMES[dow] === `${emp.preferredDayOff}-feira`
            );

            if (isPreferredDay) {
                newShifts[dayIdx] = 'F';
                continue;
            }

            // All remaining regular weekdays default to T (or keep existing if not overridden)
            if (!existingShifts[dayIdx] || existingShifts[dayIdx] === 'T') {
                newShifts[dayIdx] = 'T';
            }
        }

        // 2. Pass: Streak-based force-rest (6x1 or 5x2 compliance)
        let currentStreak = prevStreaks.get(emp.id) || 0;
        const maxStreak = emp.jornada === '5x2' ? 5 : 6;

        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const shift = newShifts[dayIdx];
            if (shift === 'FE' || shift === 'F' || shift?.startsWith('FF') || shift === 'C' || shift === 'N/A' || shift === 'DO' || shift === 'AT') {
                currentStreak = 0;
                continue;
            }

            currentStreak++;

            if (currentStreak > maxStreak) {
                // Force rest ONLY if they don't have another rest day coming in this legal window
                let hasFutureRest = false;
                for (let lookAhead = 1; lookAhead <= 2; lookAhead++) {
                    const nextDay = dayIdx + lookAhead;
                    if (nextDay < daysInMonth) {
                        const nextShift = newShifts[nextDay];
                        if (nextShift === 'F' || nextShift === 'FE' || nextShift === 'AT' || nextShift === 'DO' || nextShift?.startsWith('FF')) {
                            hasFutureRest = true;
                            break;
                        }
                    }
                }

                if (!hasFutureRest) {
                    newShifts[dayIdx] = 'F';
                    currentStreak = 0;
                }
            }
        }

        // 3. Pass: Clean Redundant Common Off-Days and Guarantee 5x2
        // Iterate by calendar week (Mon–Sun), but also handle the partial first week
        // if the month doesn't start on a Monday (so streak-forced 'F' days in that
        // first partial week are also cleaned up).
        const processWeek = (weekIndices: number[]) => {
            if (weekIndices.length === 0) return;

            const offIndices = weekIndices.filter(idx => newShifts[idx] === 'F' || newShifts[idx]?.startsWith('FF') || newShifts[idx] === 'FE' || newShifts[idx] === 'DO' || newShifts[idx] === 'AT');

            if (emp.jornada !== '5x2') {
                // 6x1 cleanup: if more than 1 plain 'F' on Mon-Fri, keep only the preferred.
                const monFriIndices = weekIndices.filter(idx => {
                    const d = new Date(year, month, idx + 1).getDay();
                    return d >= 1 && d <= 5;
                });
                const commonOffIndices = monFriIndices.filter(idx => newShifts[idx] === 'F');
                if (commonOffIndices.length > 1) {
                    const preferredIdx = monFriIndices.find(idx => {
                        const d = new Date(year, month, idx + 1).getDay();
                        return emp.preferredDayOff && (
                            WEEKDAY_NAMES[d] === emp.preferredDayOff ||
                            `${WEEKDAY_NAMES[d]}-feira` === emp.preferredDayOff ||
                            WEEKDAY_NAMES[d] === `${emp.preferredDayOff}-feira`
                        );
                    });

                    if (preferredIdx !== undefined) {
                        // Keep only the preferred day; convert extras back to work
                        commonOffIndices.forEach(idx => {
                            if (idx !== preferredIdx) newShifts[idx] = 'T';
                        });
                    } else {
                        // Preferred day is not in this (partial) week — keep the latest
                        // 'F' only (the one closest to the end of the week) so the
                        // streak stays legal, and revert the others.
                        const lastF = commonOffIndices[commonOffIndices.length - 1];
                        commonOffIndices.forEach(idx => {
                            if (idx !== lastF) newShifts[idx] = 'T';
                        });
                    }
                }
            } else {
                // 5x2 logic — unchanged
                if (offIndices.length < 2) {
                    const workingIndices = weekIndices.filter(idx => {
                        const d = new Date(year, month, idx + 1).getDay();
                        return newShifts[idx] === 'T' && d !== 0;
                    });
                    let needed = 2 - offIndices.length;
                    const preferredAddOrder = workingIndices.sort((a, b) => {
                        const dayA = new Date(year, month, a + 1).getDay();
                        const dayB = new Date(year, month, b + 1).getDay();
                        const scoreA = (dayA >= 2 && dayA <= 4) ? 0 : 1;
                        const scoreB = (dayB >= 2 && dayB <= 4) ? 0 : 1;
                        return scoreA - scoreB;
                    });
                    for (let i = 0; i < preferredAddOrder.length && needed > 0; i++) {
                        newShifts[preferredAddOrder[i]] = 'F';
                        needed--;
                    }
                } else if (offIndices.length > 2) {
                    const fIndices = weekIndices.filter(idx => newShifts[idx] === 'F');
                    let excess = offIndices.length - 2;
                    const toRemove = fIndices.sort((a, b) => {
                        const dayA = new Date(year, month, a + 1).getDay();
                        const dayB = new Date(year, month, b + 1).getDay();
                        const isPrefA = emp.preferredDayOff && WEEKDAY_NAMES[dayA].includes(emp.preferredDayOff.split('-')[0]) ? 1 : 0;
                        const isPrefB = emp.preferredDayOff && WEEKDAY_NAMES[dayB].includes(emp.preferredDayOff.split('-')[0]) ? 1 : 0;
                        const isSunA = dayA === 0 ? 1 : 0;
                        const isSunB = dayB === 0 ? 1 : 0;
                        return (isPrefA + isSunA * 2) - (isPrefB + isSunB * 2);
                    });
                    for (let i = 0; i < toRemove.length && excess > 0; i++) {
                        newShifts[toRemove[i]] = 'T';
                        excess--;
                    }
                }
            }
        };

        // Handle partial first week (day 0 up to the first Sunday or end of month)
        const firstDow = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon…
        if (firstDow !== 1) {
            // Month doesn't start on Monday — collect days before the first Monday
            const partialFirst: number[] = [];
            for (let idx = 0; idx < daysInMonth; idx++) {
                const d = new Date(year, month, idx + 1).getDay();
                if (d === 1 && idx > 0) break; // stop at first Monday (skip day 0 if it's Mon)
                partialFirst.push(idx);
            }
            if (partialFirst.length > 0) processWeek(partialFirst);
        }

        // Full weeks starting on Monday
        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const date = new Date(year, month, dayIdx + 1);
            if (date.getDay() === 1) { // Monday
                const weekIndices: number[] = [];
                for (let i = 0; i < 7; i++) {
                    if (dayIdx + i < daysInMonth) weekIndices.push(dayIdx + i);
                }
                processWeek(weekIndices);
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

        const positions = resolveTacticalDay(empsForDay, monthKey, dayIdx, isHoliday, isSunday, settings);
        
        // Update the shifts in result
        activeRegular.forEach(emp => {
            if (result[emp.id].shifts[dayIdx] === 'T' && positions[emp.id]) {
                result[emp.id].shifts[dayIdx] = positions[emp.id] as ShiftType;
            }
        });
    }

    return result;
}

export function distributeTacticalPositions(
    employees: Employee[],
    currentMY: MonthYear,
    customHolidays: Holiday[],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, { shifts: ShiftType[] }> {
    const { year, month } = currentMY;
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);

    const activeRegular = employees.filter(e => e.status === 'active' && !e.isHidden);
    const result: Record<string, { shifts: ShiftType[] }> = {};
    
    // Initialize with current shifts
    activeRegular.forEach(emp => {
        result[emp.id] = { 
            shifts: [...(emp.shifts[monthKey] || Array(daysInMonth).fill('T'))]
        };
    });

    for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
        const isHoliday = holidaySet.has(dateStr);
        const isSunday = new Date(year, month, dayIdx + 1).getDay() === 0;

        const positions = resolveTacticalDay(activeRegular, monthKey, dayIdx, isHoliday, isSunday, settings);
        
        activeRegular.forEach(emp => {
            const currentShift = result[emp.id].shifts[dayIdx];
            // Now allows replacing any working shift (T, P1, P2, P3, P4, ESTQ) 
            // to ensure changes in cargo/preferences are fully applied.
            if (isWorkingShift(currentShift) && positions[emp.id]) {
                result[emp.id].shifts[dayIdx] = positions[emp.id] as ShiftType;
            }
        });
    }

    return result;
}

export function getShiftClassification(hourRange: string, isSunday?: boolean, settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS): 'Abertura' | 'Intermediário' | 'Fechamento' | 'N/A' {

    if (!hourRange || hourRange === 'OFF' || hourRange === 'FOLGA') return 'N/A';
    
    // Apprentice is always considered 'Abertura' for positioning purposes
    if (settings.shiftHours.apprentice.includes(hourRange)) return 'Abertura';

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
    isSunday: boolean,
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, string> {
    const result: Record<string, string> = {};
    const groups: Record<string, Employee[]> = {};
    
    activeEmps.forEach(e => {
        const shift = e.shifts[monthKey]?.[dayIdx] || 'T';
        if (!isWorkingShift(shift) && !shift.startsWith('FF')) return;

        
        const hour = e.dailyHours[monthKey]?.[dayIdx] || getDefaultHourForDay(e, isHoliday, isSunday);
        const classification = getShiftClassification(hour, isSunday, settings);
        if (classification === 'N/A') return;

        if (!groups[classification]) groups[classification] = [];
        groups[classification].push(e);
    });

    const POSITIONS = ['P1', 'P2', 'P3', 'P4', 'ESTQ'];

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

        // 1. Manual Assignments (Tactical overrides)
        members.forEach(m => {
            const pos = m.tacticalPositions?.[monthKey]?.[dayIdx];
            if (pos && pos !== 'AUTO') {
                takenPositions.add(pos);
                result[m.id] = pos;
            } else {
                autoMembers.push(m);
            }
        });

        // 1.5 Default Role Assignments (Estoquista -> ESTQ, Fiscal -> P2)
        // Only if not already manually assigned and position is available
        autoMembers.forEach(m => {
            if (result[m.id]) return;

            if (m.cargo === 'Estoquista' && !takenPositions.has('ESTQ')) {
                result[m.id] = 'ESTQ';
                takenPositions.add('ESTQ');
            } else if (m.cargo === 'Fiscal' && !takenPositions.has('P2')) {
                result[m.id] = 'P2';
                takenPositions.add('P2');
            }
        });

        // Randomize the pool for "aleatorio" fallback behavior
        for (let i = autoMembers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [autoMembers[i], autoMembers[j]] = [autoMembers[j], autoMembers[i]];
        }

        // 2. Define Hierarchy for Mandatory Positions (P1 and P2)
        const mandatoryToFill = ['P1', 'P2'];
        
        mandatoryToFill.forEach(pos => {
            if (!takenPositions.has(pos)) {
                // Priority A: People with Primary Preference for this position
                let candidate = autoMembers.find(m => !result[m.id] && m.preferredPosition1 === pos);
                
                // Priority B: People with Secondary Preference for this position
                if (!candidate) {
                    candidate = autoMembers.find(m => !result[m.id] && m.preferredPosition2 === pos);
                }
                
                // Priority C: Necessity (pick someone who doesn't have a preference for other mandatory positions first)
                if (!candidate) {
                    // Try to avoid picking someone who prefers another mandatory position that isn't filled yet
                    const otherMandatory = mandatoryToFill.filter(p => p !== pos && !takenPositions.has(p));
                    candidate = autoMembers.find(m => 
                        !result[m.id] && 
                        !otherMandatory.includes(m.preferredPosition1 || '') && 
                        !otherMandatory.includes(m.preferredPosition2 || '')
                    ) || autoMembers.find(m => !result[m.id]);
                }

                if (candidate) {
                    result[candidate.id] = pos;
                    takenPositions.add(pos);
                }
            }
        });

        // 3. Preferences for the rest (P3, P4, ESTQ)
        // For remaining staff, try to satisfy preferences, else auto-fill
        autoMembers.filter(m => !result[m.id]).forEach(m => {
            let assigned = false;
            
            // Check Preferred 1
            if (m.preferredPosition1 && POSITIONS.includes(m.preferredPosition1)) {
                // P1 and P2 are already filled or couldn't be filled by this person in step 2
                // If they prefer P3, P4 or ESTQ, let them have it (multiples allowed)
                if (!['P1', 'P2'].includes(m.preferredPosition1)) {
                    result[m.id] = m.preferredPosition1;
                    assigned = true;
                }
            }
            
            // Check Preferred 2
            if (!assigned && m.preferredPosition2 && POSITIONS.includes(m.preferredPosition2)) {
                if (!['P1', 'P2'].includes(m.preferredPosition2)) {
                    result[m.id] = m.preferredPosition2;
                    assigned = true;
                }
            }

            // 4. Final Auto-Fill fallback (Random/Balanced)
            if (!assigned) {
                // Order: P3 (max 2), P4 (max 2), ESTQ (max 1), then P3 again...
                const p3Count = Object.values(result).filter(v => v === 'P3').length;
                const p4Count = Object.values(result).filter(v => v === 'P4').length;
                const estqCount = Object.values(result).filter(v => v === 'ESTQ').length;

                if (p3Count < 2) result[m.id] = 'P3';
                else if (p4Count < 2) result[m.id] = 'P4';
                else if (estqCount < 1) result[m.id] = 'ESTQ';
                else result[m.id] = 'P3'; 
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
