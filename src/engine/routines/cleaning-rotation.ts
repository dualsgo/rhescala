import { Employee, MonthYear, Holiday } from '../../../types';
import {
    isEmployeeActiveInMonth,
    isEmployeeActiveOnDay,
    buildHolidaySet
} from '../config/schedule-constants';
import { isWorkingShift } from '../clt/clt-rules';

/**
 * Gera a escala mensal de Limpeza da Copa (distribuindo de forma justa 1 responsável por dia)
 */
export function getCleaningSchedule(
    employees: Employee[],
    currentMY: MonthYear,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = []
): { day: number; empName: string; empId?: string }[] {
    const activeEmps = employees.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month) && !e.isYoungApprentice && e.cargo !== 'Estoque');
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
    const _holidaySet = buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays);
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
        schedule.push({ day: d + 1, empName: selected.name, empId: selected.id });

        cleanCounts.set(selected.id, (cleanCounts.get(selected.id) || 0) + 1);
        lastCleanDay.set(selected.id, d);
    }

    return schedule;
}
