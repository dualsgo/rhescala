
import { Employee, ShiftType, Holiday } from '../types';
import { SHIFT_HOURS, APPRENTICE_WORK_PERIOD, buildHolidaySet } from '../constants';

/**
 * Generates the full shift schedule for a single employee for a single month.
 *
 * Rules:
 *  - Jovem Aprendiz: always off on Saturday (6) AND Sunday (0); gets 'C' on courseDay.
 *  - Regular employee: off on preferredDayOff.
 *  - Sunday rotation: among active regular employees who ARE scheduled to work on Sundays,
 *    we rotate who rests — 1 person per Sunday, cycling by teamIndex.
 *  - Holidays: shift becomes 'FF' (holiday off) unless employee is rostered to work — then 'T'.
 *  - Vacations: days within vacationStart–vacationEnd become 'FE'.
 *  - If firedAt is within the month, days after firedAt become 'F'.
 *  - If hiredAt is after the month starts, days before hiredAt become 'F'.
 */
export function generateMonthForEmployee(
    emp: Employee,
    year: number,
    month: number, // 0-indexed
    teamIndex: number, // index among active non-apprentice employees for Sunday rotation
    activeRegularCount: number, // total active non-apprentice employees
    customHolidays: Holiday[] = []
): { shifts: ShiftType[]; hours: string[] } {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays);
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    const weekdayNames = [
        'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
        'Quinta-feira', 'Sexta-feira', 'Sábado',
    ];

    const shifts: ShiftType[] = [];
    const hours: string[] = [];

    for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
        const dayNum = dayIdx + 1;
        const date = new Date(year, month, dayNum);
        const dow = date.getDay(); // 0=Sun, 6=Sat
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const isHoliday = holidaySet.has(dateStr);

        // ── Vacation override ─────────────────────────────────────────────
        if (emp.vacationStart && emp.vacationEnd) {
            if (dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) {
                shifts.push('FE');
                hours.push(emp.workPeriod);
                continue;
            }
        }

        // ── Hired/fired boundaries ────────────────────────────────────────
        if (emp.hiredAt && dateStr < emp.hiredAt) {
            shifts.push('F');
            hours.push(emp.workPeriod);
            continue;
        }
        if (emp.firedAt && dateStr > emp.firedAt) {
            shifts.push('F');
            hours.push(emp.workPeriod);
            continue;
        }

        // ── Jovem Aprendiz rules ──────────────────────────────────────────
        if (emp.isYoungApprentice) {
            if (dow === 0 || dow === 6) {
                // Always off on weekends
                shifts.push('F');
                hours.push(APPRENTICE_WORK_PERIOD);
            } else if (weekdayNames[dow] === emp.courseDay) {
                shifts.push('C');
                hours.push(APPRENTICE_WORK_PERIOD);
            } else if (isHoliday) {
                shifts.push('FF');
                hours.push(APPRENTICE_WORK_PERIOD);
            } else {
                shifts.push('T');
                hours.push(APPRENTICE_WORK_PERIOD);
            }
            continue;
        }

        // ── Regular employee rules ────────────────────────────────────────

        // Fixed day off
        if (weekdayNames[dow] === emp.preferredDayOff) {
            shifts.push('F');
            hours.push(emp.workPeriod);
            continue;
        }

        // Sunday rotation: 1 employee rests each Sunday, cycling
        if (dow === 0) {
            // Which Sunday is this? (0-indexed within the month)
            const sundayIndex = Math.floor(dayIdx / 7);
            // Which employee index rests on this Sunday?
            const restingIndex = sundayIndex % Math.max(activeRegularCount, 1);
            if (teamIndex === restingIndex) {
                shifts.push('F');
                hours.push(SHIFT_HOURS.SUNDAY[0]);
                continue;
            }
            // Works this Sunday
            if (isHoliday) {
                shifts.push('FF');
                hours.push(SHIFT_HOURS.HOLIDAY[0]);
            } else {
                shifts.push('T');
                hours.push(SHIFT_HOURS.SUNDAY[0]);
            }
            continue;
        }

        // Weekday holiday
        if (isHoliday) {
            shifts.push('FF');
            hours.push(SHIFT_HOURS.HOLIDAY[0]);
            continue;
        }

        // Normal workday
        shifts.push('T');
        hours.push(emp.workPeriod);
    }

    return { shifts, hours };
}

/**
 * Generates schedules for ALL remaining months of the year (from `fromMonth` to December).
 * Returns a map of empId → { [monthKey]: { shifts, hours } }.
 */
export function generateYearSchedule(
    employees: Employee[],
    fromYear: number,
    fromMonth: number, // 0-indexed, inclusive
    currentYear: number,
    customHolidays: Holiday[] = []
): Record<string, Record<string, { shifts: ShiftType[]; hours: string[] }>> {
    const result: Record<string, Record<string, { shifts: ShiftType[]; hours: string[] }>> = {};

    // Only active employees participate in rotation counting
    const activeRegular = employees.filter(e => e.status === 'active' && !e.isYoungApprentice);
    const activeApprentices = employees.filter(e => e.status === 'active' && e.isYoungApprentice);

    // Generate from fromMonth of fromYear to December of currentYear
    for (let year = fromYear; year <= currentYear; year++) {
        const startMonth = year === fromYear ? fromMonth : 0;
        for (let month = startMonth; month <= 11; month++) {
            const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

            // Regular employees
            activeRegular.forEach((emp, teamIndex) => {
                if (!result[emp.id]) result[emp.id] = {};
                result[emp.id][monthKey] = generateMonthForEmployee(
                    emp, year, month,
                    teamIndex,
                    activeRegular.length,
                    customHolidays
                );
            });

            // Apprentices (teamIndex irrelevant for rotation, pass 0)
            activeApprentices.forEach(emp => {
                if (!result[emp.id]) result[emp.id] = {};
                result[emp.id][monthKey] = generateMonthForEmployee(
                    emp, year, month,
                    0,
                    0,
                    customHolidays
                );
            });
        }
    }

    return result;
}
