
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
    const rotIdx = (emp: Employee) => (activeRegular.indexOf(emp) - rotationOffset + activeRegular.length) % activeRegular.length;

    for (const sundayDayIdx of sundaysInMonth) {
        const dayNum = sundayDayIdx + 1;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

        // Build the eligible pool for rotation
        const available = activeRegular.filter(
            emp => !isSundayUnavailable(emp, dateStr, monthKey, sundayDayIdx)
        );

        // Separa quem já atingiu o limite inegociável (streak >= 2)
        const mustRest = available.filter(emp => (consecutive.get(emp.id) ?? 0) >= 2);
        const canWork = available.filter(emp => (consecutive.get(emp.id) ?? 0) < 2);

        // Separa elegíveis entre regulares e estoquistas
        const regularCanWork = canWork.filter(emp => emp.cargo !== 'Estoquista');
        const estoquistasCanWork = canWork.filter(emp => emp.cargo === 'Estoquista');

        const resting = new Set<string>();
        const working = new Set<string>();

        // 1. Quem TEM que folgar, folga (Restrição inegociável)!
        mustRest.forEach(emp => resting.add(emp.id));

        const neededWorkers = settings.minSundayWorkers;

        // Ordena para priorizar quem tem streak MENOR a trabalhar primeiro (ou seja, streak 0 trabalha antes de streak 1)
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

        // 2. Aloca Atendentes/Fiscais/Regulares até atingir a meta
        for (const emp of regularCanWork) {
            if (working.size < neededWorkers) {
                working.add(emp.id);
            } else {
                resting.add(emp.id);
            }
        }

        // 3. Se ainda faltar, completa com Estoquistas
        for (const emp of estoquistasCanWork) {
            if (working.size < neededWorkers) {
                working.add(emp.id);
            } else {
                resting.add(emp.id);
            }
        }

        // Record assignments
        for (const empId of resting) assignments.get(empId)!.add(sundayDayIdx);

        // Atualizar streaks.
        // Se a pessoa NÃO estava available (férias, folga forçada, etc), a sequência DELA zera.
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
                results[item.index] = closingSlots[i];
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
            if (emp.atestadoStart && emp.atestadoEnd && dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) {
                newShifts[dayIdx] = 'AT'; continue;
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
            if (shift === 'FE' || shift === 'F' || shift?.startsWith('FF') || shift === 'N/A' || shift === 'DO' || shift === 'AT') {
                currentStreak = 0;
                continue;
            }

            currentStreak++;

            if (currentStreak > maxStreak) {
                // Force rest on or before maxStreak (e.g. 7th consecutive day for 6x1)
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

    // 2.5 Pass: Peak Week Optimization for December (Natal - 18 a 24 de Dezembro)
    if (month === 11) {
        const peakResult = optimizePeakWeek(employees, monthKey, 18, 24, [22, 23, 24]);
        activeRegular.forEach(emp => {
            if (peakResult[emp.id]) {
                result[emp.id].shifts = peakResult[emp.id].shifts;
            }
        });
    }

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

    const POSITIONS = ['P1', 'P2', 'P3', 'P4', 'ESTQ'];

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

        // Remaining candidates eligible for tactical positions (P1, P2, P3, P4)
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
        // Honor registered preferences first (P3, P4, ESTQ), else default all remaining non-estoquista staff to P3
        eligibleForStorePositions.filter(m => !result[m.id]).forEach(m => {
            let assigned = false;

            // Check preferredPosition1
            if (m.preferredPosition1 && POSITIONS.includes(m.preferredPosition1)) {
                if (m.preferredPosition1 === 'P4' || m.preferredPosition1 === 'P3' || m.preferredPosition1 === 'ESTQ') {
                    result[m.id] = m.preferredPosition1;
                    assigned = true;
                }
            }

            // Check preferredPosition2
            if (!assigned && m.preferredPosition2 && POSITIONS.includes(m.preferredPosition2)) {
                if (m.preferredPosition2 === 'P4' || m.preferredPosition2 === 'P3' || m.preferredPosition2 === 'ESTQ') {
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
    const activeEmps = employees.filter(e => e.status === 'active' && !e.isHidden && !e.isYoungApprentice);
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays);
    const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

    const cleanCounts = new Map<string, number>();
    activeEmps.forEach(e => cleanCounts.set(e.id, 0));

    const lastCleanDay = new Map<string, number>();
    activeEmps.forEach(e => lastCleanDay.set(e.id, -10));

    const schedule: { day: number; empName: string; empId?: string }[] = [];

    for (let d = 0; d < daysInMonth; d++) {
        const workingToday = activeEmps.filter(emp => {
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
