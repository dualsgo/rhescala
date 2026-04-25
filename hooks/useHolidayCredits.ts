
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

    employees.forEach(emp => {
      const workedHolidays: { date: string, name: string }[] = [];
      const offDays: string[] = [];

      const sortedMonthKeys = Object.keys(emp.shifts).sort();

      sortedMonthKeys.forEach(monthKey => {
        if (!monthKey.startsWith(String(currentYear))) return;
        const monthShifts = emp.shifts[monthKey];
        
        monthShifts.forEach((shift, dayIdx) => {
          const dateStr = `${monthKey}-${String(dayIdx + 1).padStart(2, '0')}`;
          
          if (trackingStartDate && dateStr < trackingStartDate) return;

          const holiday = allHolidays.find(h => h.date === dateStr);
          if (holiday && shift && !['F', 'FF', 'FE', 'C', 'N/A'].includes(shift)) {
            // Worked on holiday
            workedHolidays.push({ date: dateStr, name: holiday.name });
          }

          if (shift === 'FF') {
            offDays.push(dateStr);
          }
        });
      });

      // Match them FIFO
      // Sort offDays to be sure
      offDays.sort();

      const matched: HolidayCredit[] = workedHolidays.map((wh, index) => {
        const offDate = offDays[index];
        if (!offDate) {
          return { holidayDate: wh.date, holidayName: wh.name, status: 'pending' };
        }

        // Compare with today (local time)
        const todayStr = new Date().toISOString().split('T')[0];
        const isPast = offDate < todayStr;
        
        return {
          holidayDate: wh.date,
          holidayName: wh.name,
          status: isPast ? 'granted' : 'scheduled',
          offDate: offDate
        };
      });

      results[emp.id] = matched;
    });

    return results;
  }, [employees, customHolidays, currentYear]);

  return creditsPerEmployee;
}
