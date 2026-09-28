import { Employee, ShiftType, Holiday, JornadaSettings, MonthYear } from '../../../types';
import { DEFAULT_JORNADA_SETTINGS, getDefaultHourForDay, buildHolidaySet } from '../config/schedule-constants';
import { isWorkingShift } from '../clt/clt-rules';

import { getShiftClassification } from '../shifts/shift-predicates';
export { getShiftClassification };

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
      let p1Candidate = eligibleForStorePositions.find(m => !result[m.id] && m.preferredPosition1 === 'P1');

      if (!p1Candidate) {
        p1Candidate = eligibleForStorePositions.find(m => !result[m.id] && m.preferredPosition2 === 'P1');
      }

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
      let p2Candidate = eligibleForStorePositions.find(m => !result[m.id] && isFiscalOrAprendiz(m));

      if (!p2Candidate) {
        p2Candidate = eligibleForStorePositions.find(m => !result[m.id] && m.preferredPosition1 === 'P2');
      }

      if (!p2Candidate) {
        p2Candidate = eligibleForStorePositions.find(m => !result[m.id] && m.preferredPosition2 === 'P2');
      }

      if (!p2Candidate) {
        p2Candidate = eligibleForStorePositions.find(m => !result[m.id]);
      }

      if (p2Candidate) {
        result[p2Candidate.id] = 'P2';
        takenPositions.add('P2');
      }
    }

    // 5. Fill Remaining Eligible Staff
    eligibleForStorePositions.filter(m => !result[m.id]).forEach(m => {
      let assigned = false;

      if (m.preferredPosition1 && POSITIONS.includes(m.preferredPosition1)) {
        if (['PC', 'P4', 'P3', 'ESTQ'].includes(m.preferredPosition1)) {
          result[m.id] = m.preferredPosition1;
          assigned = true;
        }
      }

      if (!assigned && m.preferredPosition2 && POSITIONS.includes(m.preferredPosition2)) {
        if (['PC', 'P4', 'P3', 'ESTQ'].includes(m.preferredPosition2)) {
          result[m.id] = m.preferredPosition2;
          assigned = true;
        }
      }

      if (!assigned) {
        result[m.id] = 'P3';
      }
    });
  });

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
      if (isWorkingShift(currentShift) && positions[emp.id]) {
        result[emp.id].shifts[dayIdx] = positions[emp.id] as ShiftType;
      }
    });
  }

  return result;
}

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
