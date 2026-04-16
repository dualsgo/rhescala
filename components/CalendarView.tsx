
import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet, getNationalHolidays } from '../constants';

interface CalendarViewProps {
  employees: Employee[];
  currentMY: MonthYear;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  customHolidays: Holiday[];
  today: Date;
  onOpenDayDetail: (dayIdx: number) => void;
}

const WEEKDAY_NAMES = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  employees,
  currentMY,
  onNextMonth,
  onPrevMonth,
  customHolidays,
  today,
  onOpenDayDetail,
}) => {
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const holidaySet = useMemo(() => buildHolidaySet(currentMY.year, customHolidays), [currentMY.year, customHolidays]);
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

  const calendarDays = useMemo(() => {
    const cells = [];
    
    // Padding for first week
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ type: 'empty' as const });
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const date = new Date(currentMY.year, currentMY.month, d);
      const isSunday = date.getDay() === 0;
      const isHoliday = holidaySet.has(dateStr);
      const isToday = currentMY.year === today.getFullYear() && currentMY.month === today.getMonth() && d === today.getDate();

      // Find holiday name if it exists
      const hName = [...getNationalHolidays(currentMY.year), ...customHolidays].find(h => {
          if (!h.date) return false;
          if (h.date.length === 5) return h.date === `${String(currentMY.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          return h.date === dateStr;
      })?.name || null;

      // Calculate coverage
      const coverageCount = employees.filter(emp => {
        if (emp.status !== 'active') return false;
        // Check vacation
        if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) return false;
        const shift = (emp.shifts?.[monthKey] || [])[d - 1] || 'F';
        return shift === 'T' || shift === 'C';
      }).length;

      cells.push({
        type: 'day' as const,
        num: d,
        isSunday,
        isHoliday,
        isToday,
        isPast: date < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        coverage: coverageCount,
        holidayName: hName,
        dayIdx: d - 1,
      });
    }

    return cells;
  }, [currentMY, daysInMonth, firstDayOfMonth, holidaySet, employees, monthKey, today, customHolidays]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 border border-slate-200 dark:border-slate-800 animate-fade-in flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                  <Icon name="calendar_month" className="text-2xl" fill />
              </div>
              <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{months[currentMY.month]} {currentMY.year}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Visão Mensal de Cobertura</p>
              </div>
          </div>
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-100 dark:border-slate-800">
              <button onClick={onPrevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-orange-500"><Icon name="chevron_left" /></button>
              <button onClick={onNextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-orange-500"><Icon name="chevron_right" /></button>
          </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-4 mb-4">
        {WEEKDAY_NAMES.map((name, i) => (
          <div key={i} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {name}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-4">
        {calendarDays.map((cell, idx) => {
          if (cell.type === 'empty') return <div key={`empty-${idx}`} />;

          const day = cell as any;
          return (
            <button
              key={`day-${day.num}`}
              onClick={() => onOpenDayDetail(day.dayIdx)}
              title={day.isHoliday ? day.holidayName : (day.isSunday ? 'Domingo' : '')}
              className={`relative aspect-square flex flex-col items-center justify-center rounded-[1.5rem] transition-all border group hover:scale-[1.02] active:scale-95 shadow-sm
                ${day.isToday ? 'bg-orange-500 text-white border-orange-500 shadow-orange-500/20' : 
                  day.isHoliday ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400' :
                  day.isSunday ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400' :
                  'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-orange-200'
                }
                ${day.isPast && !day.isToday ? 'opacity-60' : ''}
              `}
            >
              {/* Day Number */}
              <span className={`absolute top-3 right-4 text-[10px] font-black opacity-40 group-hover:opacity-100 transition-opacity ${day.isToday ? 'text-white/80' : 'text-slate-400'}`}>
                {day.num}
              </span>

              {/* Coverage Info */}
              <div className="flex flex-col items-center gap-1">
                <span className={`text-2xl font-black ${day.isToday ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
                  {day.coverage}
                </span>
                <span className={`text-[8px] font-black uppercase tracking-tighter opacity-60 ${day.isToday ? 'text-white' : 'text-slate-400'}`}>
                  Colaboradores
                </span>
              </div>

              {/* Dot for today if not highlighted primary */}
              {day.isToday && (
                 <div className="absolute bottom-3 w-1.5 h-1.5 bg-white rounded-full shadow-sm" />
              )}
              
              {/* Holiday name on hover if it exists? We don't have it easily here but we could add it */}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-8 flex items-center justify-center gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-rose-100 dark:bg-rose-900/30 rounded shadow-sm"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Feriado</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-100 dark:bg-amber-900/30 rounded shadow-sm"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Domingo</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded shadow-sm"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hoje</span>
          </div>
      </div>
    </div>
  );
};
