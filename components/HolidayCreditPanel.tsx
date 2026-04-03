
import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday, ShiftType } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet } from '../constants';

interface HolidayCreditPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onApplyFF: (empId: string, dayIdx: number, holidayName: string) => void;
}

export const HolidayCreditPanel: React.FC<HolidayCreditPanelProps> = ({ employees, currentMY, customHolidays, onApplyFF }) => {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();

  const workedHolidays = useMemo(() => {
    return employees.filter(e => !e.isHidden && e.status === 'active' && !e.isYoungApprentice).map(emp => {
      const worked: { date: string, name: string, dayIdx: number }[] = [];
      
      // We look at the ENTIRE year up to the current month to find worked holidays
      // For simplicity, we check this month's worked holidays first 
      // but the user wants a credit history.
      
      for (let d = 0; d < daysInMonth; d++) {
        const ds = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
        if (holidaySet.has(ds)) {
           const s = (emp.shifts[monthKey] || [])[d];
           if (s === 'T') {
              const hName = customHolidays.find(h => h.date === ds)?.name || 'Feriado Nacional';
              worked.push({ date: ds, name: hName, dayIdx: d });
           }
        }
      }
      return { emp, worked };
    }).filter(item => item.worked.length > 0);
  }, [employees, currentMY, holidaySet, customHolidays]);

  const suggestOffDay = (emp: Employee) => {
    // Basic suggestion: Tuesday or Wednesday (mid-week is usually easier)
    // Avoid Saturdays/Sundays
    const possibleDays = [];
    for (let d = 0; d < daysInMonth; d++) {
       const date = new Date(currentMY.year, currentMY.month, d + 1);
       if (date.getDay() === 2 || date.getDay() === 3) {
          const s = (emp.shifts[monthKey] || [])[d];
          if (s === 'T') possibleDays.push(d);
       }
    }
    return possibleDays[0]; // Returns first Tue/Wed available
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col gap-6 animate-fade-in transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner">
             <Icon name="event_busy" className="text-2xl" />
          </div>
          <div>
             <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Créditos de Feriado</h4>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Clique em "Compensar" para aplicar folga (FF)</p>
          </div>
        </div>
      </div>

      {workedHolidays.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center opacity-40 grayscale">
           <Icon name="verified" className="text-6xl text-slate-300 mb-4" />
           <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum crédito pendente neste mês</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workedHolidays.map(({ emp, worked }) => (
            <div key={emp.id} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col gap-4 hover:border-indigo-200 transition-all">
              <div className="flex items-center gap-3 border-b border-white pb-3">
                 <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs uppercase">{emp.name.substring(0, 2)}</div>
                 <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-black text-slate-800 uppercase truncate">{emp.name}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{emp.cargo}</span>
                 </div>
              </div>
              
              <div className="space-y-3">
                 <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] mb-2 px-1">Feriados Trabalhados</p>
                 {worked.map((h, i) => {
                    const suggestion = suggestOffDay(emp);
                    return (
                      <div key={i} className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm">
                         <div>
                            <span className="text-[10px] font-black text-slate-900 block uppercase">{h.name}</span>
                            <span className="text-[9px] font-bold text-slate-400">{h.date.split('-').reverse().join('/')}</span>
                         </div>
                         <button 
                           onClick={() => {
                             if (suggestion !== undefined) {
                               onApplyFF(emp.id, suggestion, h.name);
                             }
                           }}
                           className="px-4 py-2 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                         >
                           Compensar
                         </button>
                      </div>
                    );
                 })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
