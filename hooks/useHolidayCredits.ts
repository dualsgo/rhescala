
import { useMemo } from 'react';
import { Employee, Holiday } from '../types';
import { getNationalHolidays } from '../constants';

export interface HolidayCredit {
  holidayDate: string;
  holidayName: string;
  status: 'pending' | 'scheduled' | 'granted';
  offDate?: string;
}

export function useHolidayCredits(employees: Employee[], customHolidays: Holiday[], currentYear: number, trackingStartDate?: string) {
  
  const creditsPerEmployee = useMemo(() => {
    const results: Record<string, HolidayCredit[]> = {};
    const allHolidays = [...getNationalHolidays(currentYear), ...customHolidays]
      .filter(h => h.date.startsWith(String(currentYear)))
      .filter((h, i, self) => i === self.findIndex(t => t.date === h.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    const todayStr = new Date().toLocaleDateString('en-CA');

    employees.forEach(emp => {
      const workedHolidays: { date: string, name: string }[] = [];
      const offDays: { date: string, explicitHoliday?: string }[] = [];

      const sortedMonthKeys = Object.keys(emp.shifts).sort();

      sortedMonthKeys.forEach(monthKey => {
        if (!monthKey.startsWith(String(currentYear))) return;
        const monthShifts = emp.shifts[monthKey];
        
        monthShifts.forEach((shift, dayIdx) => {
          const dateStr = `${monthKey}-${String(dayIdx + 1).padStart(2, '0')}`;
          
          if (trackingStartDate && dateStr < trackingStartDate) return;

          const holiday = allHolidays.find(h => h.date === dateStr);
          // RULE: Only consider past holidays for credits (MUST BE BEFORE TODAY)
          const isStrictlyPast = dateStr < todayStr;

          if (holiday && isStrictlyPast && shift && !['F', 'FF', 'FE', 'C', 'N/A', 'DO'].includes(shift) && !shift.startsWith('FF')) {
            // Worked on holiday and it's already finished (at least 1 day ago)
            workedHolidays.push({ date: dateStr, name: holiday.name });
          }

          if (shift && shift.startsWith('FF')) {
            const explicit = shift.split(' ')[1]; // "FF 2026-04-21" -> "2026-04-21"
            offDays.push({ date: dateStr, explicitHoliday: explicit });
          }
        });
      });

      // Match them
      // 1. Matched explicit ones
      // 2. FIFO for the rest
      const usedOffDates = new Set<string>();
      
      const matched: HolidayCredit[] = workedHolidays.map(wh => {
        // Try to find an explicit match
        const explicitMatch = offDays.find(o => o.explicitHoliday === wh.date && !usedOffDates.has(o.date));
        if (explicitMatch) {
          usedOffDates.add(explicitMatch.date);
          return {
            holidayDate: wh.date,
            holidayName: wh.name,
            status: explicitMatch.date < todayStr ? 'granted' : 'scheduled',
            offDate: explicitMatch.date
          };
        }

        // FIFO: find first offDay that is NOT explicit for something else and not used
        const fifoMatch = offDays.find(o => !o.explicitHoliday && !usedOffDates.has(o.date));
        if (fifoMatch) {
          usedOffDates.add(fifoMatch.date);
          return {
            holidayDate: wh.date,
            holidayName: wh.name,
            status: fifoMatch.date < todayStr ? 'granted' : 'scheduled',
            offDate: fifoMatch.date
          };
        }

        return { holidayDate: wh.date, holidayName: wh.name, status: 'pending' };
      });

      results[emp.id] = matched;
    });

    return results;
  }, [employees, customHolidays, currentYear, trackingStartDate]);

  return creditsPerEmployee;
}
