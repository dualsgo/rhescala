
import { Employee, ShiftType, Holiday, JornadaSettings, MonthYear, OfficialScheduleSnapshot, ScheduleDiffItem, ProtectedDayDetail, ProtectedDaysConfig } from '../types';
import { SHIFT_HOURS, APPRENTICE_WORK_PERIOD, buildHolidaySet, getDefaultHourForDay, DEFAULT_JORNADA_SETTINGS, getShortName, isEmployeeActiveInMonth, isEmployeeActiveOnDay, normalizeProtectedDaysConfig, normalizeProtectedDaysDetails } from '../constants';


// ─── Shared weekday names ─────────────────────────────────────────────────────

const WEEKDAY_NAMES = [
    'Domingo', 'Segunda', 'Terça', 'Quarta',
    'Quinta', 'Sexta', 'Sábado',
];

export function isWorkingShift(s: string | undefined): boolean {
    if (!s) return false;
    if (s === 'T') return true;
    if (['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'].includes(s)) return true;
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
    // 5. Existing shift already FF (folga feriado), C (curso) or AT (atestado)
    const existing = (emp.shifts[monthKey] ?? [])[dayIdx] as string | undefined;
    if (existing?.startsWith('FF') || existing === 'C' || existing === 'AT') return true;
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
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
    protectedDays?: Record<number, number | ProtectedDayDetail> | number[]
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

        // Se o domingo for protegido com 100% de presença (maxFolgas === 0) e sem lista restritiva:
        if (isProtectedSunday && maxFolgas === 0 && (!mandatoryIds || mandatoryIds.length === 0)) {
            available.forEach(emp => working.add(emp.id));
        } else {
            // Se houver colaboradores com presença obrigatória definida
            if (mandatoryIds && mandatoryIds.length > 0) {
                available.forEach(emp => {
                    if (mandatoryIds.includes(emp.id)) {
                        working.add(emp.id);
                    }
                });
            }

            // Separa quem já atingiu o limite inegociável (streak >= 2) e NÃO está forçado a trabalhar
            const mustRest = available.filter(emp => !working.has(emp.id) && (consecutive.get(emp.id) ?? 0) >= 2);
            const canWork = available.filter(emp => !working.has(emp.id) && (consecutive.get(emp.id) ?? 0) < 2);

            const regularCanWork = canWork.filter(emp => emp.cargo !== 'Estoquista');
            const estoquistasCanWork = canWork.filter(emp => emp.cargo === 'Estoquista');

            const maxRestAllowed = maxFolgas !== undefined ? Math.max(0, maxFolgas) : available.length;

            // Quem TEM que folgar folga (até o limite de folgas permitidas no dia protegido)
            mustRest.forEach(emp => {
                if (resting.size < maxRestAllowed) {
                    resting.add(emp.id);
                } else {
                    working.add(emp.id);
                }
            });

            const neededWorkers = maxFolgas !== undefined
                ? Math.max(settings.minSundayWorkers, available.length - maxRestAllowed)
                : settings.minSundayWorkers;

            // Ordena para priorizar quem tem streak MENOR a trabalhar primeiro
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

            // 2. Aloca Regulares até atingir a meta
            for (const emp of regularCanWork) {
                if (working.size < neededWorkers) {
                    working.add(emp.id);
                } else if (resting.size < maxRestAllowed) {
                    resting.add(emp.id);
                } else {
                    working.add(emp.id);
                }
            }

            // 3. Se ainda faltar, completa com Estoquistas
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

        // Record assignments
        for (const empId of resting) assignments.get(empId)!.add(sundayDayIdx);

        // Atualizar streaks
        for (const emp of activeRegular) {
            if (!available.includes(emp)) {
                consecutive.set(emp.id, 0); // Ausência quebra o ciclo, começa do 0.
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
            shifts.push('N/A'); hours.push(getTargetHours(emp, dow, isHoliday, settings)); continue;
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

            const allActive = [...activeRegular, ...activeApprentices];

            // Pass: Tactical Positioning for the whole month
            for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
                const isHoliday = buildHolidaySet(year, customHolidays, deletedNationalHolidays).has(dateStr);
                const isSunday = new Date(year, month, dayIdx + 1).getDay() === 0;

                const empsForDay = allActive.map(emp => ({
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
                
                allActive.forEach(emp => {
                    if (result[emp.id][monthKey].shifts[dayIdx] === 'T' && positions[emp.id]) {
                        result[emp.id][monthKey].shifts[dayIdx] = positions[emp.id] as ShiftType;
                    }
                });
            }
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
    if (!members || members.length === 0) return [];

    // 1. Feriados (Pausa flexível de 15 min escalonada de 15 em 15 min)
    if (isHoliday) {
        let holidayPauseIdx = 0;
        return members.map(m => {
            if (m?.isYoungApprentice || m?.cargo === 'Aprendiz') {
                return settings?.lunchRules?.apprentice || '12h45';
            }
            if (m?.cargo === 'Estoquista') {
                return 'Flexível';
            }
            // Exibe a pausa de 15 min de forma escalonada (ex: 14h30, 14h45, 15h00, 15h15...)
            const startMins = 14 * 60 + 30 + (holidayPauseIdx % 6) * 15;
            holidayPauseIdx++;
            const h = Math.floor(startMins / 60);
            const min = startMins % 60;
            const timeStr = `${h}h${min === 0 ? '' : min}`;
            return `${timeStr} (15 min)`;
        });
    }

    const results: string[] = Array(members.length).fill('');
    const allocatable: { member: any; index: number; startHour: number; isIntermediario: boolean }[] = [];

    // 2. Separar papéis especiais (Jovem Aprendiz = Fixo 12h45, Estoquista = Flexível)
    members.forEach((m, idx) => {
        if (!m) return;
        if (m.isYoungApprentice || m.cargo === 'Aprendiz') {
            results[idx] = settings?.lunchRules?.apprentice || '12h45';
        } else if (m.cargo === 'Estoquista') {
            results[idx] = 'Flexível';
        } else {
            const periodStr = m.workPeriod || m.dailyHours || m.hour || '';
            const match = String(periodStr).match(/^(\d{1,2})[h:]/);
            const startHour = match ? parseInt(match[1], 10) : (isOpening ? 10 : 13);
            const isIntermediario = startHour >= 11 && startHour <= 12;
            allocatable.push({ member: m, index: idx, startHour, isIntermediario });
        }
    });

    const N = allocatable.length;
    if (N === 0) return results;

    // 3. Domingos (Lógica Simplificada e Escalonada de Domingo)
    if (isSunday) {
        if (isOpening) {
            // Abertura no Domingo (12h às 20h):
            // Abrem 2 pessoas às 12h e vão juntas almoçar às 13h (retornam às 14h).
            // Para equipes sazonais (N > 2), agrupam em duplas (13h, 13h30).
            allocatable.forEach((item, i) => {
                const wave = Math.floor(i / 2);
                results[item.index] = wave === 0 ? (settings?.lunchRules?.sundayOpening || '13h') : '13h30';
            });
        } else {
            // Fechamento no Domingo (13h às 21h):
            // Após retorno da Abertura às 14h, vão um de cada vez (14h, 15h, 16h, 17h).
            // Com equipe sazonal maior (N > 4), evolui automaticamente para duplas (14h, 15h, 16h...).
            const sundaySlots = ['14h', '15h', '16h', '17h'];
            allocatable.forEach((item, i) => {
                const maxPerSlot = N <= 4 ? 1 : 2;
                const waveIndex = Math.floor(i / maxPerSlot);
                results[item.index] = sundaySlots[Math.min(waveIndex, sundaySlots.length - 1)];
            });
        }
        return results;
    }

    // 4. Dias de Semana (Turno Abertura vs Fechamento)
    if (isOpening) {
        // Abertura (10h às 18h20):
        // Slots disponíveis: 13h, 13h45, 14h
        allocatable.sort((a, b) => a.startHour - b.startHour);

        allocatable.forEach((item, i) => {
            if (N === 1) {
                results[item.index] = '14h';
            } else if (N === 2) {
                results[item.index] = (i === 0) ? '13h45' : '14h';
            } else if (N === 3) {
                if (i === 0) results[item.index] = '13h45';
                else results[item.index] = '14h';
            } else if (N === 4) {
                if (i === 0) results[item.index] = '13h';
                else if (i === 1) results[item.index] = '13h45';
                else results[item.index] = '14h';
            } else {
                // Para N >= 5 (Equipe com Sazonais)
                if (i < Math.ceil(N / 4)) results[item.index] = '13h';
                else if (i < Math.ceil(N / 2)) results[item.index] = '13h45';
                else results[item.index] = '14h';
            }
        });
    } else {
        // Fechamento / Intermediário (13h40 às 22h, 12h às 20h20):
        // Entram às 13h40 -> almoçam a partir das 15h.
        // Slots: 15h, 15h30, 16h, 16h30, 17h
        allocatable.sort((a, b) => {
            if (a.isIntermediario && !b.isIntermediario) return -1;
            if (!a.isIntermediario && b.isIntermediario) return 1;
            return a.startHour - b.startHour;
        });

        const closingSlots = ['15h', '15h30', '16h', '16h30', '17h'];

        allocatable.forEach((item, i) => {
            if (N <= 5) {
                // 1 por slot para máxima cobertura sem sobreposição
                results[item.index] = closingSlots[i] || closingSlots[closingSlots.length - 1];
            } else {
                // Equipe sazonal maior (N > 5): 2 por slot em ondas escalonadas
                const waveIndex = Math.floor(i / 2);
                results[item.index] = closingSlots[Math.min(waveIndex, closingSlots.length - 1)];
            }
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
 *  - Protected Days & Seasonal Peaks (Oct 8-12, Dec 20-24)
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
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
    protectedDays?: ProtectedDaysConfig | number[],
    mode: 'suggested_retro' | 'all_working' = 'suggested_retro'
): Record<string, { shifts: ShiftType[]; hours: string[] }> {
    const result: Record<string, { shifts: ShiftType[]; hours: string[] }> = {};

    const activeRegular = employees.filter(e => e.status === 'active' && !e.isYoungApprentice);
    const activeApprentices = employees.filter(e => e.status === 'active' && e.isYoungApprentice);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    // Helper para verificar status legal/especial
    const getLegalOverride = (emp: Employee, dayIdx: number): ShiftType | null => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
        if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) return 'FE';
        if (emp.atestadoStart && emp.atestadoEnd && dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) return 'AT';
        if (isBirthday(emp, dateStr)) return 'DO';
        if ((emp.hiredAt && dateStr < emp.hiredAt) || (emp.firedAt && dateStr > emp.firedAt)) return 'N/A';
        return null;
    };

    // ── 1. Jovens Aprendizes ────────────────────────────────────────────────────
    activeApprentices.forEach(app => {
        const shifts: ShiftType[] = Array(daysInMonth).fill('T');
        const courseDayNorm = app.courseDay ? app.courseDay.replace('-feira', '').trim() : '';

        const hours: string[] = Array.from({ length: daysInMonth }, (_, i) => {
            const dow = new Date(year, month, i + 1).getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            return getTargetHours(app, dow, holidaySet.has(dateStr), settings);
        });

        for (let i = 0; i < daysInMonth; i++) {
            const date = new Date(year, month, i + 1);
            const dow = date.getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            const isHoliday = holidaySet.has(dateStr);

            const legal = getLegalOverride(app, i);
            if (legal) {
                shifts[i] = legal;
                continue;
            }

            if (dow === 0 || dow === 6 || isHoliday) {
                shifts[i] = 'F';
            } else if (courseDayNorm && WEEKDAY_NAMES[dow] === courseDayNorm) {
                shifts[i] = 'C';
            } else {
                shifts[i] = 'T';
            }
        }

        result[app.id] = { shifts, hours };
    });

    // ── 2. MODO: 100% Trabalhado (Sem folgas automáticas para ajuste manual) ──────
    if (mode === 'all_working') {
        activeRegular.forEach(emp => {
            const shifts: ShiftType[] = Array(daysInMonth).fill('T');
            const hours: string[] = Array.from({ length: daysInMonth }, (_, i) => {
                const dow = new Date(year, month, i + 1).getDay();
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                return getTargetHours(emp, dow, holidaySet.has(dateStr), settings);
            });

            for (let i = 0; i < daysInMonth; i++) {
                const legal = getLegalOverride(emp, i);
                if (legal) {
                    shifts[i] = legal;
                } else {
                    shifts[i] = 'T';
                }
            }

            result[emp.id] = { shifts, hours };
        });
        return result;
    }

    // ── 3. MODO: Sugerida Inteligente com Verificação Retroativa Estrita CLT ─────
    // Localiza todos os domingos do mês
    const sundaysInMonth: number[] = [];
    for (let d = 0; d < daysInMonth; d++) {
        if (new Date(year, month, d + 1).getDay() === 0) sundaysInMonth.push(d);
    }

    // Retro-análise dos 2 últimos domingos do mês anterior
    const prevConsecutive = getPrevMonthConsecutive(activeRegular, year, month);
    const { assignments: sundayAssignments } = buildSundayAssignments(
        activeRegular, year, month, sundaysInMonth, prevConsecutive, settings, protectedDays
    );

    // Retro-análise dos dias trabalhados no mês anterior até o dia 31
    const prevStreaks = getPrevMonthWorkStreak(activeRegular, year, month);

    activeRegular.forEach(emp => {
        const restSundays = sundayAssignments.get(emp.id) ?? new Set<number>();
        const is5x2 = emp.jornada === '5x2';
        const maxStreak = is5x2 ? 5 : 6;
        const shifts: ShiftType[] = Array(daysInMonth).fill('T');

        const hours: string[] = Array.from({ length: daysInMonth }, (_, i) => {
            const dow = new Date(year, month, i + 1).getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            return getTargetHours(emp, dow, holidaySet.has(dateStr), settings);
        });

        // Caminhamento dia a dia conectando o streak do mês anterior com o novo mês
        let currentStreak = prevStreaks.get(emp.id) || 0;

        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const dow = new Date(year, month, dayIdx + 1).getDay();
            const legal = getLegalOverride(emp, dayIdx);

            // 3.1 Se houver condição legal (Férias, Atestado, Aniversário, Não-contratado)
            if (legal) {
                shifts[dayIdx] = legal;
                currentStreak = 0;
                continue;
            }

            // 3.2 Se for domingo de folga da rotação CLT (ex: se trabalhou 2 domingos anteriores folga dia 5)
            if (dow === 0 && restSundays.has(dayIdx)) {
                shifts[dayIdx] = 'F';
                currentStreak = 0;
                continue;
            }

            // 3.3 Verificação de limite CLT 6x1 / 5x2 (se trabalhou 6 dias seguidos, o 7º dia é FOLGA OBRIGATÓRIA)
            if (currentStreak + 1 > maxStreak) {
                shifts[dayIdx] = 'F';
                currentStreak = 0;
                continue;
            }

            // 3.4 Senão, dia regular de trabalho
            shifts[dayIdx] = 'T';
            currentStreak++;
        }

        // 3.5 Para jornada 5x2: assegura 2 folgas por semana
        if (is5x2) {
            for (let w = 0; w < daysInMonth; w += 7) {
                const weekIndices: number[] = [];
                for (let k = 0; k < 7 && w + k < daysInMonth; k++) weekIndices.push(w + k);
                const weekRests = weekIndices.filter(k => ['F', 'FE', 'AT', 'DO', 'N/A'].includes(shifts[k]) || shifts[k]?.startsWith('FF'));
                if (weekRests.length < 2) {
                    const candidate = weekIndices.find(k => {
                        const d = new Date(year, month, k + 1).getDay();
                        return shifts[k] === 'T' && d !== 6 && !getLegalOverride(emp, k);
                    });
                    if (candidate !== undefined) {
                        shifts[candidate] = 'F';
                    }
                }
            }
        }

        result[emp.id] = { shifts, hours };
    });

    // Se houver dias protegidos configurados, otimiza com Peak-Centric
    const configuredDays = Object.keys(normalizeProtectedDaysDetails(protectedDays)).map(Number);
    if (configuredDays.length > 0) {
        const peakResult = optimizeProtectedDays(employees, monthKey, protectedDays || {}, customHolidays, deletedNationalHolidays, settings);
        activeRegular.forEach(emp => {
            if (peakResult[emp.id]) {
                result[emp.id].shifts = peakResult[emp.id].shifts;
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
    
    // Group working employees by shift classification (Abertura, Intermediário, Fechamento)
    activeEmps.forEach(e => {
        const shift = e.shifts?.[monthKey]?.[dayIdx] || 'T';
        if (!isWorkingShift(shift) && !(typeof shift === 'string' && shift.startsWith('FF'))) return;

        const hour = e.dailyHours?.[monthKey]?.[dayIdx] || getDefaultHourForDay(e, isHoliday, isSunday);
        const classification = getShiftClassification(hour, isSunday, settings);
        if (classification === 'N/A') return;

        if (!groups[classification]) groups[classification] = [];
        groups[classification].push(e);
    });

    const POSITIONS = ['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'];

    // Process each shift group (Abertura, Intermediário, Fechamento)
    const groupNames = Object.keys(groups).sort((a, b) => {
        const order = { 'Abertura': 0, 'Intermediário': 1, 'Fechamento': 2 };
        return (order[a as keyof typeof order] ?? 99) - (order[b as keyof typeof order] ?? 99);
    });

    groupNames.forEach(groupName => {
        const members = groups[groupName];
        const takenPositions = new Set<string>();
        const autoMembers: Employee[] = [];

        // 1. Manual Overrides (set in grid)
        members.forEach(m => {
            const pos = m.tacticalPositions?.[monthKey]?.[dayIdx];
            if (pos && pos !== 'AUTO') {
                takenPositions.add(pos);
                result[m.id] = pos;
            } else {
                autoMembers.push(m);
            }
        });

        // 2. Default Role Assignment for Estoquista:
        // Estoquista ALWAYS stays in 'ESTQ' by default and does NOT take P1, P2, P3, or P4.
        autoMembers.forEach(m => {
            if (result[m.id]) return;
            if (m.cargo === 'Estoquista') {
                result[m.id] = 'ESTQ';
                takenPositions.add('ESTQ');
            }
        });

        // Remaining candidates eligible for tactical positions (P1, PC, P2, P3, P4)
        const eligibleForStorePositions = autoMembers.filter(m => !result[m.id] && m.cargo !== 'Estoquista');

        const isFiscalOrAprendiz = (m: Employee) => 
            m.cargo === 'Fiscal' || m.cargo === 'Aprendiz' || m.isYoungApprentice === true;

        // 3. Fill Mandatory P1 (at least 1 per shift if eligible candidates exist)
        if (!takenPositions.has('P1')) {
            // Priority A: Candidate with preferredPosition1 === 'P1'
            let p1Candidate = eligibleForStorePositions.find(m => !result[m.id] && m.preferredPosition1 === 'P1');
            
            // Priority B: Candidate with preferredPosition2 === 'P1'
            if (!p1Candidate) {
                p1Candidate = eligibleForStorePositions.find(m => !result[m.id] && m.preferredPosition2 === 'P1');
            }

            // Priority C: Avoid picking Fiscal/Aprendiz if possible (reserving them for P2)
            if (!p1Candidate) {
                p1Candidate = eligibleForStorePositions.find(m => !result[m.id] && !isFiscalOrAprendiz(m))
                           || eligibleForStorePositions.find(m => !result[m.id]);
            }

            if (p1Candidate) {
                result[p1Candidate.id] = 'P1';
                takenPositions.add('P1');
            }
        }

        // 4. Fill Mandatory P2 (at least 1 per shift if eligible candidates exist)
        // Fiscal and Jovem Aprendiz HAVE PRIORITY for P2
        if (!takenPositions.has('P2')) {
            // Priority A: Fiscal or Jovem Aprendiz
            let p2Candidate = eligibleForStorePositions.find(m => !result[m.id] && isFiscalOrAprendiz(m));

            // Priority B: Candidate with preferredPosition1 === 'P2'
            if (!p2Candidate) {
                p2Candidate = eligibleForStorePositions.find(m => !result[m.id] && m.preferredPosition1 === 'P2');
            }

            // Priority C: Candidate with preferredPosition2 === 'P2'
            if (!p2Candidate) {
                p2Candidate = eligibleForStorePositions.find(m => !result[m.id] && m.preferredPosition2 === 'P2');
            }

            // Priority D: Any eligible candidate
            if (!p2Candidate) {
                p2Candidate = eligibleForStorePositions.find(m => !result[m.id]);
            }

            if (p2Candidate) {
                result[p2Candidate.id] = 'P2';
                takenPositions.add('P2');
            }
        }

        // 5. Fill Remaining Eligible Staff
        // Honor registered preferences first (PC, P3, P4, ESTQ), else default all remaining non-estoquista staff to P3
        eligibleForStorePositions.filter(m => !result[m.id]).forEach(m => {
            let assigned = false;

            // Check preferredPosition1
            if (m.preferredPosition1 && POSITIONS.includes(m.preferredPosition1)) {
                if (['PC', 'P4', 'P3', 'ESTQ'].includes(m.preferredPosition1)) {
                    result[m.id] = m.preferredPosition1;
                    assigned = true;
                }
            }

            // Check preferredPosition2
            if (!assigned && m.preferredPosition2 && POSITIONS.includes(m.preferredPosition2)) {
                if (['PC', 'P4', 'P3', 'ESTQ'].includes(m.preferredPosition2)) {
                    result[m.id] = m.preferredPosition2;
                    assigned = true;
                }
            }

            // Default for all remaining non-Estoquista staff after P1 & P2 are filled: P3
            if (!assigned) {
                result[m.id] = 'P3';
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

/**
 * Otimiza a semana de pico do Dia das Crianças (8 a 12 de Outubro) para concentrar
 * 100% da equipe disponível trabalhando nos dias 8, 9, 10, 11 e 12.
 * 
 * Regras e Engenharia CLT 6x1 / 5x2:
 * 1. Dias Críticos (8 a 12 de Outubro): Nenhum colaborador CLT regular folga nestes 5 dias.
 *    (Férias 'FE', Atestado 'AT', Aniversário 'DO' e 'N/A' são rigorosamente preservados).
 * 2. Janela Pré-Pico (Dias 6 e 7): Escalonamento estratégico das folgas:
 *    - Grupo A (empIdx % 2 === 0): Folga no Dia 6 (Oct 6), trabalha 7..12 (6 dias consecutivos).
 *    - Grupo B (empIdx % 2 === 1): Folga no Dia 7 (Oct 7), trabalha 8..13 (6 dias consecutivos).
 * 3. Janela Pós-Pico (Dias 13 e 14):
 *    - Grupo A: Folga OBRIGATÓRIA no Dia 13 (Oct 13), após 6 dias trabalhados (7..12).
 *    - Grupo B: Folga OBRIGATÓRIA no Dia 14 (Oct 14) (ou Dia 13 se não trabalhou dia 7).
 * 4. Validação Geral 6x1 e 5x2 no Mês (1..31):
 *    - Semanas 1, 3, 4 e 5: Mantém folgas semanais alinhadas às preferências e rotação de domingos,
 *      garantindo que em nenhum momento do mês ocorram mais de 6 dias seguidos de trabalho (CLT 6x1)
 *      ou 5 dias (5x2).
 * 5. Jovem Aprendiz:
 *    - Folga obrigatória aos sábados, domingos e no feriado de 12/10, além do dia de curso teórico.
 */
export function optimizeOctoberPeak(
    employees: Employee[],
    monthKey: string,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, { shifts: ShiftType[] }> {
    const result: Record<string, { shifts: ShiftType[] }> = {};
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // 31

    const activeRegular = employees.filter(e => e.status === 'active' && !e.isHidden && !e.isYoungApprentice);
    const prevStreaks = getPrevMonthWorkStreak(activeRegular, year, month);

    // Dias Críticos de Pico do Dia das Crianças: 8, 9, 10, 11, 12
    const criticalDays = [8, 9, 10, 11, 12];
    const criticalIndices = criticalDays.map(d => d - 1); // 7, 8, 9, 10, 11 (0-indexed)

    activeRegular.forEach((emp, empIdx) => {
        const shifts = [...(emp.shifts[monthKey] || Array(daysInMonth).fill('T'))];
        const is5x2 = emp.jornada === '5x2';
        const maxStreak = is5x2 ? 5 : 6;

        // Status protegidos que nunca são sobrescritos (Férias, Atestado, Aniversário, Não-admitido)
        const isProtected = (idx: number) => {
            const s = shifts[idx];
            return ['FE', 'AT', 'DO', 'N/A'].includes(s);
        };

        // 1. Limpa folgas comuns 'F' nos 5 dias de pico (8 a 12) -> presença 100%!
        criticalIndices.forEach(idx => {
            if (shifts[idx] === 'F') {
                shifts[idx] = 'T';
            }
        });

        // 2. Escalonamento cirúrgico de folgas Pré-Pico (dias 6 e 7) e Pós-Pico (dias 13 e 14)
        const isGroupA = empIdx % 2 === 0;

        if (isGroupA) {
            // Grupo A: Folga dia 6, trabalha 7..12 (6 dias), folga dia 13
            if (!isProtected(5)) shifts[5] = 'F';  // Dia 6
            if (!isProtected(6)) shifts[6] = 'T';  // Dia 7
            if (!isProtected(12)) shifts[12] = 'F'; // Dia 13
            if (!isProtected(13)) shifts[13] = 'T'; // Dia 14
        } else {
            // Grupo B: Folga dia 7, trabalha 8..13 (6 dias), folga dia 14
            if (!isProtected(5)) shifts[5] = 'T';  // Dia 6
            if (!isProtected(6)) shifts[6] = 'F';  // Dia 7
            if (!isProtected(12)) shifts[12] = 'T'; // Dia 13
            if (!isProtected(13)) shifts[13] = 'F'; // Dia 14
        }

        // 3. Validação do Início do Mês (Dias 1 a 5) para prevenir estouro de 6x1 antes do Dia 6/7
        const prevStreak = prevStreaks.get(emp.id) || 0;
        let streak = prevStreak;
        for (let i = 0; i < 5; i++) {
            if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(shifts[i]) || shifts[i]?.startsWith('FF')) {
                streak = 0;
            } else {
                streak++;
                if (streak > maxStreak) {
                    if (!isProtected(i)) {
                        shifts[i] = 'F';
                        streak = 0;
                    }
                }
            }
        }

        // 4. Suporte a jornada 5x2 (2 folgas semanais)
        if (is5x2) {
            const w1Rests = [0, 1, 2, 3, 4, 5, 6].filter(i => ['F', 'FE', 'AT', 'DO'].includes(shifts[i]));
            if (w1Rests.length < 2) {
                const addIdx = isGroupA ? 1 : 2;
                if (!isProtected(addIdx) && shifts[addIdx] === 'T') {
                    shifts[addIdx] = 'F';
                }
            }
        }

        // 5. Varredura completa do mês (dias 1 a 31) garantindo 0 violações 6x1 / 5x2
        streak = prevStreak;
        for (let i = 0; i < daysInMonth; i++) {
            const s = shifts[i];
            if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) {
                streak = 0;
            } else {
                streak++;
                if (streak > maxStreak) {
                    if (!criticalIndices.includes(i)) {
                        if (!isProtected(i)) {
                            shifts[i] = 'F';
                            streak = 0;
                        }
                    } else {
                        // Se atingir limite no pico, insere folga imediatamente antes nos dias permitidos
                        for (let b = i - 1; b >= 0; b--) {
                            if (!criticalIndices.includes(b) && !isProtected(b)) {
                                shifts[b] = 'F';
                                streak = i - b;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // 6. Otimização de cobertura fora do pico (remove folgas 'F' duplicadas consecutivas desnecessárias)
        for (let i = 1; i < daysInMonth; i++) {
            if (!is5x2 && shifts[i] === 'F' && shifts[i - 1] === 'F' && i !== 5 && i !== 6 && i !== 12 && i !== 13) {
                const nextRest = shifts.slice(i + 1).findIndex(x => ['F', 'FE', 'AT', 'DO', 'N/A'].includes(x));
                if (nextRest !== -1 && nextRest <= 5) {
                    shifts[i] = 'T';
                }
            }
        }

        result[emp.id] = { shifts };
    });

    return result;
}

/**
 * Otimiza a semana de pico do Natal (20 a 24 de Dezembro) para concentrar
 * 100% da equipe disponível trabalhando nos dias 20, 21, 22, 23 e 24.
 * 
 * Regras e Engenharia CLT 6x1 / 5x2:
 * 1. Dias Críticos (20 a 24 de Dezembro): Nenhum colaborador CLT regular folga nestes 5 dias.
 *    (Férias 'FE', Atestado 'AT', Aniversário 'DO' e 'N/A' são rigorosamente preservados).
 * 2. Janela Pré-Pico (Dias 18 e 19): Escalonamento estratégico das folgas:
 *    - Grupo A (empIdx % 2 === 0): Folga no Dia 18 (Dec 18), trabalha 19..24 (6 dias consecutivos).
 *    - Grupo B (empIdx % 2 === 1): Folga no Dia 19 (Dec 19), trabalha 20..24 (5 dias consecutivos).
 * 3. Janela Pós-Pico (Dia 25 - Feriado de Natal):
 *    - Dia 25 de Dezembro é feriado nacional de Natal. As lojas em geral operam com escala mínima ou fechadas.
 *    - Folga no Dia 25 zera o streak de 6x1 do Grupo A (trabalhou 19..24 = 6 dias) e do Grupo B (trabalhou 20..24 = 5 dias).
 * 4. Validação Geral 6x1 e 5x2 no Mês (1..31):
 *    - Semanas 1 e 2 (Dias 1 a 17): Mantém folgas semanais alinhadas às preferências e rotação de domingos.
 *    - Dias 26 a 31: Retoma a rotação regular de folgas com 0 violações 6x1/5x2.
 * 5. Jovem Aprendiz:
 *    - Folga obrigatória aos sábados, domingos e no feriado de Natal (25/12), além do dia de curso teórico.
 */
export function optimizeDecemberPeak(
    employees: Employee[],
    monthKey: string,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, { shifts: ShiftType[] }> {
    const result: Record<string, { shifts: ShiftType[] }> = {};
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // 31

    const activeRegular = employees.filter(e => e.status === 'active' && !e.isHidden && !e.isYoungApprentice);
    const prevStreaks = getPrevMonthWorkStreak(activeRegular, year, month);

    // Dias Críticos de Pico do Natal: 20, 21, 22, 23, 24
    const criticalDays = [20, 21, 22, 23, 24];
    const criticalIndices = criticalDays.map(d => d - 1); // 19, 20, 21, 22, 23 (0-indexed)

    activeRegular.forEach((emp, empIdx) => {
        const shifts = [...(emp.shifts[monthKey] || Array(daysInMonth).fill('T'))];
        const is5x2 = emp.jornada === '5x2';
        const maxStreak = is5x2 ? 5 : 6;

        const isProtected = (idx: number) => {
            const s = shifts[idx];
            return ['FE', 'AT', 'DO', 'N/A'].includes(s);
        };

        // 1. Limpa folgas comuns 'F' nos 5 dias de pico do Natal (20 a 24)
        criticalIndices.forEach(idx => {
            if (shifts[idx] === 'F') {
                shifts[idx] = 'T';
            }
        });

        // 2. Escalonamento cirúrgico de folgas Pré-Pico (dias 18 e 19) e Pós-Pico (dia 25)
        const isGroupA = empIdx % 2 === 0;

        if (isGroupA) {
            // Grupo A: Folga dia 18, trabalha 19..24 (6 dias), folga dia 25 (Natal)
            if (!isProtected(17)) shifts[17] = 'F'; // Dia 18
            if (!isProtected(18)) shifts[18] = 'T'; // Dia 19
            if (!isProtected(24)) shifts[24] = 'F'; // Dia 25
        } else {
            // Grupo B: Folga dia 19, trabalha 20..24 (5 dias), folga dia 25 (Natal)
            if (!isProtected(17)) shifts[17] = 'T'; // Dia 18
            if (!isProtected(18)) shifts[18] = 'F'; // Dia 19
            if (!isProtected(24)) shifts[24] = 'F'; // Dia 25
        }

        // 3. Validação do Período Anterior (Dias 1 a 17) para prevenir estouro 6x1 antes do Dia 18/19
        const prevStreak = prevStreaks.get(emp.id) || 0;
        let streak = prevStreak;
        for (let i = 0; i < 17; i++) {
            if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(shifts[i]) || shifts[i]?.startsWith('FF')) {
                streak = 0;
            } else {
                streak++;
                if (streak > maxStreak) {
                    if (!isProtected(i)) {
                        shifts[i] = 'F';
                        streak = 0;
                    }
                }
            }
        }

        // 4. Suporte a jornada 5x2
        if (is5x2) {
            const wRests = [10, 11, 12, 13, 14, 15, 16].filter(i => ['F', 'FE', 'AT', 'DO'].includes(shifts[i]));
            if (wRests.length < 2) {
                const addIdx = isGroupA ? 12 : 13;
                if (!isProtected(addIdx) && shifts[addIdx] === 'T') {
                    shifts[addIdx] = 'F';
                }
            }
        }

        // 5. Varredura completa do mês garantindo 0 violações 6x1 / 5x2
        streak = prevStreak;
        for (let i = 0; i < daysInMonth; i++) {
            const s = shifts[i];
            if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) {
                streak = 0;
            } else {
                streak++;
                if (streak > maxStreak) {
                    if (!criticalIndices.includes(i)) {
                        if (!isProtected(i)) {
                            shifts[i] = 'F';
                            streak = 0;
                        }
                    } else {
                        // Se atingir limite no pico, insere folga imediatamente antes (dias 18/19)
                        for (let b = i - 1; b >= 0; b--) {
                            if (!criticalIndices.includes(b) && !isProtected(b)) {
                                shifts[b] = 'F';
                                streak = i - b;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // 6. Otimização de cobertura fora do pico (remove folgas 'F' duplicadas consecutivas desnecessárias)
        for (let i = 1; i < daysInMonth; i++) {
            if (!is5x2 && shifts[i] === 'F' && shifts[i - 1] === 'F' && i !== 17 && i !== 18 && i !== 24 && i !== 25) {
                const nextRest = shifts.slice(i + 1).findIndex(x => ['F', 'FE', 'AT', 'DO', 'N/A'].includes(x));
                if (nextRest !== -1 && nextRest <= 5) {
                    shifts[i] = 'T';
                }
            }
        }

        result[emp.id] = { shifts };
    });

    return result;
}

/**
 * Otimiza a escala para QUALQUER conjunto customizado de Dias Protegidos / Períodos Sazonais.
 * 
 * Algoritmo Peak-Centric (Âncora no Pico -> Propagação para Trás e para Frente):
 * 1. Identifica os blocos de pico e quais colaboradores são de presença mandatória (todos ou específicos).
 * 2. Fixa presença (100% de trabalho) nos dias de pico para os colaboradores selecionados.
 * 3. Propagação para Trás (Lookback / Pré-Pico):
 *    - Escala folgas pré-pico nos dias D_start - 1, D_start - 2, D_start - 3 em grupos balanceados.
 *    - A partir dessa folga pré-pico, varre regressivamente até o Dia 1 garantindo conformidade 6x1 / 5x2.
 * 4. Propagação para Frente (Lookahead / Pós-Pico):
 *    - Imediatamente após D_end, agenda folgas obrigatórias nos dias D_end + 1, D_end + 2 em grupos.
 *    - A partir dessa folga pós-pico, varre progressivamente até o final do mês mantendo conformidade 6x1 / 5x2.
 */
export function optimizeProtectedDays(
    employees: Employee[],
    monthKey: string,
    protectedDays: Record<number, number | ProtectedDayDetail> | number[],
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, { shifts: ShiftType[] }> {
    const details = normalizeProtectedDaysDetails(protectedDays);
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);

    const protectedDaysList = Object.keys(details)
        .map(Number)
        .filter(d => d >= 1 && d <= daysInMonth)
        .sort((a, b) => a - b);

    const result: Record<string, { shifts: ShiftType[] }> = {};
    const activeRegular = employees.filter(e => e.status === 'active' && !e.isHidden && !e.isYoungApprentice);
    const activeApprentices = employees.filter(e => e.status === 'active' && !e.isHidden && e.isYoungApprentice);
    const prevStreaks = getPrevMonthWorkStreak(activeRegular, year, month);

    // Identifica todos os domingos do mês
    const sundaysInMonth: number[] = [];
    for (let d = 0; d < daysInMonth; d++) {
        if (new Date(year, month, d + 1).getDay() === 0) sundaysInMonth.push(d);
    }

    // Calcula rotação de domingos com histórico do mês anterior e respeito a domingos protegidos
    const prevConsecutive = getPrevMonthConsecutive(activeRegular, year, month);
    const { assignments: sundayAssignments } = buildSundayAssignments(
        activeRegular, year, month, sundaysInMonth, prevConsecutive, settings, details
    );

    // Identifica todos os índices protegidos no mês (0-indexed)
    const protectedIndicesSet = new Set(protectedDaysList.map(d => d - 1));

    // Agrupa dias protegidos em blocos contíguos (clusters)
    const clusters: { start: number; end: number; indices: number[] }[] = [];
    let currentCluster: number[] = [];

    for (let i = 0; i < protectedDaysList.length; i++) {
        const day = protectedDaysList[i];
        if (currentCluster.length === 0 || day === currentCluster[currentCluster.length - 1] + 1) {
            currentCluster.push(day);
        } else {
            clusters.push({
                start: currentCluster[0],
                end: currentCluster[currentCluster.length - 1],
                indices: currentCluster.map(d => d - 1)
            });
            currentCluster = [day];
        }
    }
    if (currentCluster.length > 0) {
        clusters.push({
            start: currentCluster[0],
            end: currentCluster[currentCluster.length - 1],
            indices: currentCluster.map(d => d - 1)
        });
    }

    // Helper para verificar status legal/especial
    const getLegalOverride = (emp: Employee, dayIdx: number): ShiftType | null => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
        if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) return 'FE';
        if (emp.atestadoStart && emp.atestadoEnd && dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) return 'AT';
        if (isBirthday(emp, dateStr)) return 'DO';
        if ((emp.hiredAt && dateStr < emp.hiredAt) || (emp.firedAt && dateStr > emp.firedAt)) return 'N/A';
        return null;
    };

    // 1. Processa Jovens Aprendizes conforme legislação estrita
    activeApprentices.forEach(app => {
        const shifts: ShiftType[] = Array(daysInMonth).fill('T');
        const courseDayNormalized = app.courseDay ? app.courseDay.replace('-feira', '').trim() : '';

        for (let i = 0; i < daysInMonth; i++) {
            const date = new Date(year, month, i + 1);
            const dow = date.getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            const isHoliday = holidaySet.has(dateStr);

            const legal = getLegalOverride(app, i);
            if (legal) {
                shifts[i] = legal;
                continue;
            }

            // Proibido fins de semana e feriados
            if (dow === 0 || dow === 6 || isHoliday) {
                shifts[i] = 'F';
            } else if (courseDayNormalized && WEEKDAY_NAMES[dow] === courseDayNormalized) {
                shifts[i] = 'C';
            } else {
                shifts[i] = 'T';
            }
        }
        result[app.id] = { shifts };
    });

    // 2. Processa Colaboradores Regulares com Arquitetura de Cenário Ideal (4 Grupos Balanceados)
    activeRegular.forEach((emp, empIdx) => {
        const shifts: ShiftType[] = Array(daysInMonth).fill('T');
        const is5x2 = emp.jornada === '5x2';
        const maxStreak = is5x2 ? 5 : 6;
        const restSundays = sundayAssignments.get(emp.id) ?? new Set<number>();

        // Grupo balanceado para distribuição ideal de folgas (0: Seg, 1: Ter, 2: Qua, 3: Qui)
        const idealGroupSlot = empIdx % 4; // 0=Seg(dow 1), 1=Ter(dow 2), 2=Qua(dow 3), 3=Qui(dow 4)

        // Pass 1: Estrutura Base de Cenário Ideal (Dias de Semana, Sábados 100% e Domingos)
        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const date = new Date(year, month, dayIdx + 1);
            const dow = date.getDay();

            const legal = getLegalOverride(emp, dayIdx);
            if (legal) {
                shifts[dayIdx] = legal;
                continue;
            }

            if (dow === 0) {
                // Domingo: segue rotação legal e domingos protegidos
                if (restSundays.has(dayIdx)) {
                    shifts[dayIdx] = 'F';
                } else {
                    shifts[dayIdx] = 'T';
                }
            } else if (dow === 6) {
                // Sábado: Cenário Ideal é 100% de Presença na loja
                shifts[dayIdx] = 'T';
            } else if (dow === 5) {
                // Sexta-feira: Alta Demanda (100% de trabalho na base)
                shifts[dayIdx] = 'T';
            } else {
                // Segunda a Quinta: Distribuição Harmônica de Folgas (~25% por dia)
                const groupTargetDow = idealGroupSlot + 1; // 1=Seg, 2=Ter, 3=Qua, 4=Qui
                if (dow === groupTargetDow) {
                    shifts[dayIdx] = 'F';
                } else {
                    shifts[dayIdx] = 'T';
                }
            }
        }

        // Pass 2: Aplicação do Motor Peak-Centric para Blocos de Dias Protegidos / Sazonais
        const relevantClusters = clusters.filter(cluster => {
            return cluster.indices.some(idx => {
                const dayNum = idx + 1;
                const dDetail = details[dayNum];
                if (!dDetail) return false;
                if (dDetail.mandatoryEmployeeIds && dDetail.mandatoryEmployeeIds.length > 0) {
                    return dDetail.mandatoryEmployeeIds.includes(emp.id);
                }
                return true;
            });
        });

        if (relevantClusters.length > 0) {
            // 2.1 Fixa Trabalho Contínuo no Pico (Peak Anchoring)
            relevantClusters.forEach(cluster => {
                cluster.indices.forEach(idx => {
                    const dayNum = idx + 1;
                    const dDetail = details[dayNum];
                    const isMandatory = !dDetail?.mandatoryEmployeeIds || dDetail.mandatoryEmployeeIds.length === 0 || dDetail.mandatoryEmployeeIds.includes(emp.id);
                    if (isMandatory && !getLegalOverride(emp, idx)) {
                        shifts[idx] = 'T';
                    }
                });
            });

            // 2.2 Lookback e Lookahead em 4 Grupos de Revezamento Simétricos
            relevantClusters.forEach((cluster, clusterIdx) => {
                const startIdx = cluster.indices[0];
                const endIdx = cluster.indices[cluster.indices.length - 1];
                const clusterLength = cluster.indices.length;

                // Lookback Pré-Pico: escalona folgas em D - 4, D - 3, D - 2, D - 1
                const lookbackSlots = Math.min(4, Math.max(2, maxStreak - clusterLength + 1));
                const groupSlot = (empIdx + clusterIdx) % lookbackSlots;
                const preRestOffset = groupSlot + 1;
                const preRestIdx = startIdx - preRestOffset;

                if (preRestIdx >= 0 && !getLegalOverride(emp, preRestIdx) && !protectedIndicesSet.has(preRestIdx)) {
                    shifts[preRestIdx] = 'F';

                    // Garante trabalho contínuo da folga pré-pico até o início do pico
                    for (let k = preRestIdx + 1; k < startIdx; k++) {
                        if (!getLegalOverride(emp, k)) {
                            shifts[k] = 'T';
                        }
                    }

                    // Propaga regressivamente para trás até o Dia 1
                    let backStreak = 0;
                    for (let b = preRestIdx - 1; b >= 0; b--) {
                        const s = shifts[b];
                        if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) {
                            backStreak = 0;
                        } else {
                            backStreak++;
                            if (backStreak >= maxStreak) {
                                if (!getLegalOverride(emp, b) && !protectedIndicesSet.has(b)) {
                                    shifts[b] = 'F';
                                    backStreak = 0;
                                }
                            }
                        }
                    }
                }

                // Lookahead Pós-Pico: escalona folgas pós-pico imediatas
                let workStreakAtPeakEnd = clusterLength;
                for (let k = startIdx - 1; k >= 0; k--) {
                    const s = shifts[k];
                    if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) break;
                    workStreakAtPeakEnd++;
                }

                const postRestOffset = (workStreakAtPeakEnd >= maxStreak) ? 1 : ((empIdx % 2 === 0) ? 1 : 2);
                const postRestIdx = endIdx + postRestOffset;

                if (postRestIdx < daysInMonth && !getLegalOverride(emp, postRestIdx) && !protectedIndicesSet.has(postRestIdx)) {
                    shifts[postRestIdx] = 'F';

                    if (postRestOffset === 2 && endIdx + 1 < daysInMonth && !getLegalOverride(emp, endIdx + 1)) {
                        shifts[endIdx + 1] = 'T';
                    }

                    // Propaga progressivamente para frente até o final do mês
                    let fwdStreak = 0;
                    for (let f = postRestIdx + 1; f < daysInMonth; f++) {
                        const s = shifts[f];
                        if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) {
                            fwdStreak = 0;
                        } else {
                            fwdStreak++;
                            if (fwdStreak >= maxStreak) {
                                if (!getLegalOverride(emp, f) && !protectedIndicesSet.has(f)) {
                                    shifts[f] = 'F';
                                    fwdStreak = 0;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Pass 3: Varredura de Integridade CLT 6x1 / 5x2 com Carryover do Mês Anterior
        const prevStreak = prevStreaks.get(emp.id) || 0;
        let streak = prevStreak;

        for (let i = 0; i < daysInMonth; i++) {
            const s = shifts[i];
            if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) {
                streak = 0;
            } else {
                streak++;
                if (streak > maxStreak) {
                    if (!protectedIndicesSet.has(i) && !getLegalOverride(emp, i)) {
                        shifts[i] = 'F';
                        streak = 0;
                    } else {
                        // Se o dia i for protegido, recua para encontrar o dia anterior não-protegido para folga
                        for (let b = i - 1; b >= 0; b--) {
                            if (!protectedIndicesSet.has(b) && !getLegalOverride(emp, b) && shifts[b] === 'T') {
                                shifts[b] = 'F';
                                streak = i - b;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Pass 4: Suporte e Equilíbrio Semanal para Jornadas 5x2 (Garante 2 folgas por semana)
        if (is5x2) {
            for (let w = 0; w < daysInMonth; w += 7) {
                const weekIndices = [];
                for (let k = 0; k < 7 && w + k < daysInMonth; k++) weekIndices.push(w + k);
                const weekRests = weekIndices.filter(k => ['F', 'FE', 'AT', 'DO', 'N/A'].includes(shifts[k]) || shifts[k]?.startsWith('FF'));
                if (weekRests.length < 2) {
                    const candidate = weekIndices.find(k => {
                        const d = new Date(year, month, k + 1).getDay();
                        return !protectedIndicesSet.has(k) && !getLegalOverride(emp, k) && shifts[k] === 'T' && d !== 6;
                    });
                    if (candidate !== undefined) {
                        shifts[candidate] = 'F';
                    }
                }
            }
        }

        result[emp.id] = { shifts };
    });

    return result;
}

/**
 * Otimiza a semana de pico (ex: Natal 18 a 24 de Dezembro) para concentrar 100% da equipe
 * nos dias críticos (22, 23 e 24), alocando as folgas obrigatórias da semana de forma
 * escalonada entre os dias 18 e 21 sem violar a regra CLT 6x1.
 */
export function optimizePeakWeek(
    employees: Employee[],
    monthKey: string,
    startDay: number = 18,
    endDay: number = 24,
    criticalDays: number[] = [22, 23, 24]
): Record<string, { shifts: ShiftType[] }> {
    const result: Record<string, { shifts: ShiftType[] }> = {};
    const activeEmps = employees.filter(e => e.status === 'active' && !e.isHidden && !e.isYoungApprentice);

    // Janela pré-pico para distribuição de folgas (ex: 18, 19, 20, 21)
    const prePeakDays: number[] = [];
    for (let d = startDay; d <= endDay; d++) {
        if (!criticalDays.includes(d)) {
            prePeakDays.push(d);
        }
    }

    activeEmps.forEach((emp, empIdx) => {
        const shifts = [...(emp.shifts[monthKey] || Array(31).fill('T'))];
        
        // 1. Remover folgas simples nos dias críticos de pico (ex: 22, 23, 24)
        criticalDays.forEach(day => {
            const dayIdx = day - 1;
            if (shifts[dayIdx] === 'F') {
                shifts[dayIdx] = 'T';
            }
        });

        // 2. Definir a folga semanal escalonada na janela pré-pico (18-21)
        if (prePeakDays.length > 0) {
            const assignedDay = prePeakDays[empIdx % prePeakDays.length];
            const assignedIdx = assignedDay - 1;

            // Limpa folgas comuns dos outros dias da semana de pico
            for (let d = startDay; d <= endDay; d++) {
                const idx = d - 1;
                if (shifts[idx] === 'F' && idx !== assignedIdx) {
                    shifts[idx] = 'T';
                }
            }

            // Atribui folga no dia escalonado (se não for Férias/Atestado/DayOff)
            if (!['FE', 'AT', 'DO'].includes(shifts[assignedIdx])) {
                shifts[assignedIdx] = 'F';
            }
        }

        // 3. Validação final de 6x1 (garante no máximo 6 dias seguidos de trabalho)
        let streak = 0;
        for (let i = 0; i < shifts.length; i++) {
            const s = shifts[i];
            if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) {
                streak = 0;
            } else {
                streak++;
                if (streak > 6) {
                    // Se estourar 6x1, insere folga antes do limite nos dias permitidos
                    if (i < shifts.length - 1 && !criticalDays.includes(i + 1)) {
                        shifts[i] = 'F';
                        streak = 0;
                    }
                }
            }
        }

        result[emp.id] = { shifts };
    });

    return result;
}

/**
 * Gera a escala mensal de Limpeza da Copa (distribuindo de forma justa 1 responsável por dia)
 */
export function getCleaningSchedule(
    employees: Employee[],
    currentMY: MonthYear,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = []
): { day: number; empName: string; empId?: string }[] {
    const activeEmps = employees.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month) && !e.isYoungApprentice && e.cargo !== 'Aprendiz' && e.cargo !== 'Estoquista');
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays);
    const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

    const cleanCounts = new Map<string, number>();
    activeEmps.forEach(e => cleanCounts.set(e.id, 0));

    const lastCleanDay = new Map<string, number>();
    activeEmps.forEach(e => lastCleanDay.set(e.id, -10));

    const schedule: { day: number; empName: string; empId?: string }[] = [];

    for (let d = 0; d < daysInMonth; d++) {
        const dStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
        const workingToday = activeEmps.filter(emp => {
            if (!isEmployeeActiveOnDay(emp, dStr, monthKey, d)) return false;
            const shift = (emp.shifts?.[monthKey] || [])[d] || 'T';
            return isWorkingShift(shift);
        });

        if (workingToday.length === 0) {
            schedule.push({ day: d + 1, empName: 'Ninguém Escalado' });
            continue;
        }

        workingToday.sort((a, b) => {
            const countA = cleanCounts.get(a.id) || 0;
            const countB = cleanCounts.get(b.id) || 0;
            if (countA !== countB) return countA - countB;

            const lastA = lastCleanDay.get(a.id) || 0;
            const lastB = lastCleanDay.get(b.id) || 0;
            return lastA - lastB;
        });

        const selected = workingToday[0];
        schedule.push({ day: d + 1, empName: getShortName(selected.name, employees), empId: selected.id });

        cleanCounts.set(selected.id, (cleanCounts.get(selected.id) || 0) + 1);
        lastCleanDay.set(selected.id, d);
    }

    return schedule;
}

/**
 * Aplica APENAS os horários padrão (diários, domingos e feriados)
 * MANTENDO 100% dos turnos e folgas atuais inalterados.
 * Pode ser aplicado para todos ou apenas para um colaborador (targetEmpId).
 */
export function applyHoursOnly(
    employees: Employee[],
    year: number,
    month: number,
    targetEmpId?: string,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
    const targetEmps = targetEmpId 
        ? employees.filter(e => e.id === targetEmpId)
        : employees.filter(e => e.status === 'active' && !e.isHidden);

    targetEmps.forEach(emp => {
        const hours: string[] = [];
        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const date = new Date(year, month, dayIdx + 1);
            const dow = date.getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
            const isHoliday = holidaySet.has(dateStr);
            hours.push(getTargetHours(emp, dow, isHoliday, settings));
        }
        result[emp.id] = hours;
    });

    return result;
}

/**
 * Aplica APENAS a rotação de folgas e domingos,
 * MANTENDO os horários diários (dailyHours) atuais inalterados.
 */
export function applyFolgasOnly(
    employees: Employee[],
    year: number,
    month: number,
    targetEmpId?: string,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
    protectedDays?: Record<number, number | ProtectedDayDetail> | number[]
): Record<string, ShiftType[]> {
    const monthData = applyMonthUpdate(employees, year, month, customHolidays, deletedNationalHolidays, settings, protectedDays);
    const result: Record<string, ShiftType[]> = {};

    if (targetEmpId) {
        if (monthData[targetEmpId]) {
            result[targetEmpId] = monthData[targetEmpId].shifts;
        }
    } else {
        Object.keys(monthData).forEach(empId => {
            result[empId] = monthData[empId].shifts;
        });
    }

    return result;
}

/**
 * Aplica APENAS as posições táticas (P1, P2, P3, P4, ESTQ) para o mês.
 */
export function applyTacticalOnly(
    employees: Employee[],
    year: number,
    month: number,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, (string | null)[]> {
    const result: Record<string, (string | null)[]> = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const activeEmps = employees.filter(e => e.status === 'active' && !e.isHidden);

    activeEmps.forEach(e => {
        result[e.id] = Array(daysInMonth).fill(null);
    });

    for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
        const date = new Date(year, month, dayIdx + 1);
        const dow = date.getDay();
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
        const isHoliday = holidaySet.has(dateStr);
        const isSunday = dow === 0;

        const resolved = resolveTacticalDay(activeEmps, monthKey, dayIdx, isHoliday, isSunday, settings);
        Object.entries(resolved).forEach(([empId, pos]) => {
            if (result[empId]) {
                result[empId][dayIdx] = pos;
            }
        });
    }

    return result;
}

/**
 * Detecta diferenças entre o Snapshot Oficial congelado e a escala atual do mês.
 */
export function detectScheduleDiffs(
    snapshot: OfficialScheduleSnapshot | undefined,
    employees: Employee[],
    currentMY: MonthYear
): ScheduleDiffItem[] {
    if (!snapshot) return [];

    const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
    if (snapshot.monthKey !== monthKey) return [];

    const diffs: ScheduleDiffItem[] = [];
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();

    employees.forEach(emp => {
        if (emp.isHidden) return;

        const officialShifts = snapshot.shifts?.[emp.id] || [];
        const currentShifts = emp.shifts?.[monthKey] || [];

        const officialHours = snapshot.dailyHours?.[emp.id] || [];
        const currentHours = emp.dailyHours?.[monthKey] || [];

        const officialPos = snapshot.tacticalPositions?.[emp.id] || [];
        const currentPos = emp.tacticalPositions?.[monthKey] || [];

        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const dateStr = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`;

            const offShift = officialShifts[dayIdx] || 'T';
            const curShift = currentShifts[dayIdx] || 'T';

            // 1. Mudança de Turno/Folga
            if (offShift !== curShift) {
                diffs.push({
                    id: `${emp.id}-shift-${dayIdx}`,
                    empId: emp.id,
                    empName: emp.name,
                    dayIdx,
                    dateStr,
                    type: 'shift',
                    officialVal: offShift,
                    currentVal: curShift
                });
            }

            // 2. Mudança de Horário (quando ambos trabalham ou se horário foi alterado)
            const offHour = officialHours[dayIdx] || emp.workPeriod || '';
            const curHour = currentHours[dayIdx] || emp.workPeriod || '';
            if (isWorkingShift(curShift) && offHour && curHour && offHour !== curHour) {
                diffs.push({
                    id: `${emp.id}-hour-${dayIdx}`,
                    empId: emp.id,
                    empName: emp.name,
                    dayIdx,
                    dateStr,
                    type: 'hour',
                    officialVal: offHour,
                    currentVal: curHour
                });
            }

            // 3. Mudança de Posição Tática
            const offP = officialPos[dayIdx];
            const curP = currentPos[dayIdx];
            if (offP && curP && offP !== curP && isWorkingShift(curShift)) {
                diffs.push({
                    id: `${emp.id}-pos-${dayIdx}`,
                    empId: emp.id,
                    empName: emp.name,
                    dayIdx,
                    dateStr,
                    type: 'position',
                    officialVal: offP,
                    currentVal: curP
                });
            }
        }
    });

    return diffs;
}

/**
 * Gera uma nova escala completa, limpa e inteligente para um mês-alvo.
 * 
 * Regras e validações automáticas aplicadas:
 * 1. Retro-análise do mês anterior (consecutivos de domingos + dias seguidos de trabalho CLT).
 * 2. Férias vigentes (aplica 'FE' APENAS nas datas reais e limpa férias antigas).
 * 3. Atestados vigentes (aplica 'AT' apenas durante as datas do atestado).
 * 4. Aniversário (aplica folga 'DO' no dia exato).
 * 5. Jovens Aprendizes (folga fim de semana + curso teórico 'C').
 * 6. Estoquistas (folga fixa domingo).
 * 7. CLT 6x1 e 5x2 (folgas fixas e rotação equitativa de domingos com limite inegociável de 2 domingos).
 * 8. Horários Diários (dailyHours baseados na jornada e workPeriod).
 * 9. Posições Táticas automáticas (P1 a P4 e ESTQ para quem trabalha).
 * 10. Otimização Peak-Centric para dias protegidos/sazonais configurados.
 */
export function generateCleanMonthSchedule(
    employees: Employee[],
    targetYear: number,
    targetMonth: number,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
    protectedDays?: Record<number, number | ProtectedDayDetail> | number[],
    mode: 'suggested_retro' | 'all_working' = 'suggested_retro'
): Employee[] {
    const targetKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    
    // 1. Gera folgas e horários validados (com suporte a modo retroativo ou 100% trabalhado)
    const monthData = applyMonthUpdate(employees, targetYear, targetMonth, customHolidays, deletedNationalHolidays, settings, protectedDays, mode);
    
    // 2. Aplica nos colaboradores
    const updatedEmps = employees.map(emp => {
        const d = monthData[emp.id];
        if (d) {
            return {
                ...emp,
                shifts: { ...emp.shifts, [targetKey]: d.shifts },
                dailyHours: { ...emp.dailyHours, [targetKey]: d.hours }
            };
        }
        return emp;
    });

    // 3. Distribui posições táticas automáticas (P1..P4 e ESTQ) para os turnos trabalhados
    const tacticalMap = applyTacticalOnly(updatedEmps, targetYear, targetMonth, customHolidays, deletedNationalHolidays, settings);

    return updatedEmps.map(emp => {
        if (tacticalMap[emp.id]) {
            return {
                ...emp,
                tacticalPositions: { ...emp.tacticalPositions, [targetKey]: tacticalMap[emp.id] }
            };
        }
        return emp;
    });
}
