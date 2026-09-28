import { OfficialScheduleSnapshot, Employee, MonthYear, ScheduleDiffItem } from '../../../types';
import { isWorkingShift } from '../clt/clt-rules';

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

        const _officialPos = snapshot.tacticalPositions?.[emp.id] || [];
        const _currentPos = emp.tacticalPositions?.[monthKey] || [];

        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const dateStr = `${String(dayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`;

            const offShift = officialShifts[dayIdx] || 'T';
            const curShift = currentShifts[dayIdx] || 'T';

            // 1. Mudança de Turno/Folga (apenas se alterou o status real de jornada)
            const offIsWork = isWorkingShift(offShift);
            const curIsWork = isWorkingShift(curShift);
            const isSameWorkStatus = offIsWork && curIsWork;

            if (offShift !== curShift && !isSameWorkStatus) {
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

            // 2. Mudança de Horário (quando trabalha e o horário oficial foi alterado)
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
        }
    });

    return diffs;
}
