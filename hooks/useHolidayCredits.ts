import { useMemo } from 'react';
import { Employee, Holiday } from '../types';
import { getNationalHolidays } from '../constants';
import { isWorkingShift } from './useScheduleEngine';

export interface HolidayCredit {
  id: string;
  holidayDate: string;
  holidayName: string;
  status: 'pending' | 'scheduled' | 'granted';
  offDate?: string;
}

export function useHolidayCredits(
  employees: Employee[], 
  customHolidays: Holiday[], 
  currentYear: number, 
  trackingStartDate?: string,
  deletedNationalHolidays: string[] = []
) {
  const creditsPerEmployee = useMemo(() => {
    const results: Record<string, HolidayCredit[]> = {};
    const allHolidays = [
      ...getNationalHolidays(currentYear).filter(h => !deletedNationalHolidays.includes(h.id)),
      ...customHolidays
    ]
      .filter(h => h.date.startsWith(String(currentYear)))
      .filter((h, i, self) => i === self.findIndex(t => t.date === h.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    const todayStr = new Date().toLocaleDateString('en-CA');

    employees.forEach(emp => {
      // Jovem Aprendiz não trabalha em feriados/fins de semana e não gera créditos de feriado
      if (emp.isYoungApprentice || emp.cargo === 'Aprendiz') {
        results[emp.id] = [];
        return;
      }

      const workedHolidays: { id: string, date: string, name: string }[] = [];
      const offDays: { date: string, explicitHoliday?: string }[] = [];

      const sortedMonthKeys = Object.keys(emp.shifts || {}).sort();

      sortedMonthKeys.forEach(monthKey => {
        if (!monthKey.startsWith(String(currentYear))) return;
        const monthShifts = emp.shifts[monthKey] || [];
        
        monthShifts.forEach((rawShift, dayIdx) => {
          const dateStr = `${monthKey}-${String(dayIdx + 1).padStart(2, '0')}`;
          
          if (trackingStartDate && dateStr < trackingStartDate) return;

          // Resolve afastamentos e status efetivo no dia
          let shift = rawShift;
          if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) {
            shift = 'FE';
          } else if (emp.atestadoStart && emp.atestadoEnd && dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) {
            shift = 'AT';
          } else if (emp.birthday) {
            const empMD = emp.birthday.length > 5 ? emp.birthday.substring(5) : emp.birthday;
            const dateMD = dateStr.substring(5);
            if (empMD === dateMD && shift === 'DO') {
              shift = 'DO';
            }
          }

          const holiday = allHolidays.find(h => h.date === dateStr);

          // REGRA PRINCIPAL: Só gera crédito de feriado se o colaborador NÃO tiver nenhum tipo de folga
          // (F, FF, FE, C, DO, AT, N/A) no dia do feriado, ou seja, se estiver escalado para trabalhar (T ou Posições).
          // Mesmo que a data do feriado ainda vá acontecer no mês, o crédito fica pendente permitindo antecipar ou agendar a folga.
          if (holiday && isWorkingShift(shift)) {
            if (dateStr.endsWith('-05-01')) {
              // 1º de Maio: CLT concede 2 folgas compensatórias
              workedHolidays.push({ id: dateStr, date: dateStr, name: `${holiday.name} (Folga 1)` });
              workedHolidays.push({ id: `${dateStr}-extra`, date: dateStr, name: `${holiday.name} (Folga 2)` });
            } else {
              workedHolidays.push({ id: dateStr, date: dateStr, name: holiday.name });
            }
          }

          // Folgas compensatórias usufruídas ou agendadas
          if (shift && typeof shift === 'string' && shift.startsWith('FF')) {
            const explicit = shift.split(' ')[1]; // e.g. "2026-09-07" ou "07/09" ou "2026-05-01-extra"
            offDays.push({ date: dateStr, explicitHoliday: explicit });
          }
        });
      });

      // Casamento entre feriados trabalhados e folgas concedidas/agendadas
      const usedOffDates = new Set<string>();
      
      const matched: HolidayCredit[] = workedHolidays.map(wh => {
        // 1. Tentar encontrar casamento explícito pelo id ou data
        const explicitMatch = offDays.find(o => {
          if (usedOffDates.has(o.date) || !o.explicitHoliday) return false;
          if (o.explicitHoliday === wh.id || o.explicitHoliday === wh.date) return true;
          // Suporte a formato DD/MM ou MM-DD
          const cleanExplicit = o.explicitHoliday.replace('/', '-');
          return wh.date.endsWith(cleanExplicit) || wh.id.endsWith(cleanExplicit);
        });

        if (explicitMatch) {
          usedOffDates.add(explicitMatch.date);
          return {
            id: wh.id,
            holidayDate: wh.date,
            holidayName: wh.name,
            status: explicitMatch.date <= todayStr ? 'granted' : 'scheduled',
            offDate: explicitMatch.date
          };
        }

        // 2. FIFO: encontrar a primeira folga FF genérica (sem feriado explícito) ainda não utilizada
        const fifoMatch = offDays.find(o => (!o.explicitHoliday || o.explicitHoliday === 'FF') && !usedOffDates.has(o.date));
        if (fifoMatch) {
          usedOffDates.add(fifoMatch.date);
          return {
            id: wh.id,
            holidayDate: wh.date,
            holidayName: wh.name,
            status: fifoMatch.date <= todayStr ? 'granted' : 'scheduled',
            offDate: fifoMatch.date
          };
        }

        // 3. Folga de feriado ainda pendente (não compensada)
        return { 
          id: wh.id, 
          holidayDate: wh.date, 
          holidayName: wh.name, 
          status: 'pending' 
        };
      });

      results[emp.id] = matched;
    });

    return results;
  }, [employees, customHolidays, currentYear, trackingStartDate, deletedNationalHolidays]);

  return creditsPerEmployee;
}

