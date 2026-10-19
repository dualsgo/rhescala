import { Employee, ShiftType, Holiday, JornadaSettings } from '../../../types';
import { DEFAULT_JORNADA_SETTINGS, APPRENTICE_WORK_PERIOD, buildHolidaySet } from '../config/schedule-constants';

export const WEEKDAY_NAMES = [
  'Domingo', 'Segunda', 'Terça', 'Quarta',
  'Quinta', 'Sexta', 'Sábado',
];

import { isWorkingShift } from '../shifts/shift-predicates';
export { isWorkingShift };

export function isEmployeePreferredDayOff(emp: Employee, dow: number): boolean {
  const isEstoque = emp.cargo === 'Estoque' || emp.role === 'Estoque' || (emp.cargo as string) === 'Estoquista';
  if (isEstoque && dow === 0) return true;
  if (!emp.preferredDayOff || emp.preferredDayOff === 'Nenhum') return false;
  const pref = emp.preferredDayOff.trim().toLowerCase().replace('-feira', '');
  const dayName = WEEKDAY_NAMES[dow].toLowerCase().replace('-feira', '');
  return pref === dayName;
}

export function isBirthday(emp: Employee, dateStr: string): boolean {
  if (!emp.birthday) return false;
  const empMD = emp.birthday.length > 5 ? emp.birthday.substring(5) : emp.birthday;
  const dateMD = dateStr.length > 5 ? dateStr.substring(5) : dateStr;
  return empMD === dateMD;
}

export function getTargetHours(
  emp: Employee,
  dow: number,
  isHoliday: boolean,
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): string {
  if (emp.isYoungApprentice) {
    // Aprendiz folga Sábado, Domingo e Feriado
    if (dow === 0 || dow === 6 || isHoliday) return settings.shiftHours.sunday[0];
    return settings.shiftHours.apprentice[0];
  }

  const wp = emp.workPeriod || '';

  // Feriados (não-domingo)
  if (isHoliday && dow !== 0) {
    const holidaySlots = settings.shiftHours.holiday;
    if (wp.startsWith('10h')) return holidaySlots[0] ?? holidaySlots[0];
    if (wp.startsWith('12h')) return holidaySlots[1] ?? holidaySlots[0];
    if (wp.startsWith('13h')) return holidaySlots[holidaySlots.length - 1] ?? holidaySlots[0];
    return holidaySlots[0];
  }

  // Domingos
  if (dow === 0) {
    const sundaySlots = settings.shiftHours.sunday;
    if (wp.startsWith('13h')) return sundaySlots[sundaySlots.length - 1] ?? sundaySlots[0];
    return sundaySlots[0];
  }

  // Dias de semana normais
  return emp.workPeriod;
}

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
    const isPreferredDay = isEmployeePreferredDayOff(emp, dow);

    if (isPreferredDay) {
      shifts.push('F'); hours.push(getTargetHours(emp, dow, isHoliday, settings)); continue;
    }

    if (dow === 0) {
      const isEstoque = emp.cargo === 'Estoque' || emp.role === 'Estoque' || (emp.cargo as string) === 'Estoquista';
      if (sundayRestDays.has(dayIdx) || isEstoque) {
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
