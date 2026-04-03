
import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday, ShiftType } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet } from '../constants';

interface DaySummaryCardProps {
  selectedDayIdx: number;
  employees:      Employee[];
  currentMY:      MonthYear;
  customHolidays: Holiday[];
}

export const DaySummaryCard: React.FC<DaySummaryCardProps> = ({ selectedDayIdx, employees, currentMY, customHolidays }) => {
  const dateStr = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}-${(selectedDayIdx + 1).toString().padStart(2, '0')}`;
  const date = new Date(currentMY.year, currentMY.month, selectedDayIdx + 1);
  const weekday = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][date.getDay()];
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
  const isHoliday = holidaySet.has(dateStr);
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

  const staffByShift = useMemo(() => {
    const working = employees.filter(e => !e.isHidden && e.status === 'active').filter(e => {
        const s = (e.shifts[monthKey] || [])[selectedDayIdx] || 'T';
        return s === 'T' || s.startsWith('FF');
    });

    const categories = [
        { label: '🌞 Abertura',     range: '10h às 18h20', emps: [] as Employee[] },
        { label: '⛅ Intermediário', range: '12h às 20h20', emps: [] as Employee[] },
        { label: '🌙 Fechamento',   range: '13h40 às 22h', emps: [] as Employee[] },
    ];

    if (isHoliday) {
        return [
            { label: 'OP. ABERTURA (H)', range: '12h às 18h', emps: working.filter(e => (e.dailyHours[monthKey] || [])[selectedDayIdx]?.includes('12h')) },
            { label: 'OP. INTERM (H)', range: '13h às 19h', emps: working.filter(e => (e.dailyHours[monthKey] || [])[selectedDayIdx]?.includes('13h')) },
            { label: 'OP. INTERM 2 (H)', range: '14h às 20h', emps: working.filter(e => (e.dailyHours[monthKey] || [])[selectedDayIdx]?.includes('14h')) },
            { label: 'OP. FECHAMENTO (H)', range: '15h às 21h', emps: working.filter(e => (e.dailyHours[monthKey] || [])[selectedDayIdx]?.includes('15h')) },
        ].filter(g => g.emps.length > 0);
    }

    return categories.map(cat => ({
        ...cat,
        emps: working.filter(e => e.shiftName === cat.label.split(' ')[1])
    }));
  }, [employees, monthKey, selectedDayIdx, isHoliday]);

  const offDuty = useMemo(() => {
    return employees.filter(e => !e.isHidden && e.status === 'active').filter(e => {
        const s = (e.shifts[monthKey] || [])[selectedDayIdx];
        return s === 'F' || s === 'FE' || s === 'C';
    });
  }, [employees, monthKey, selectedDayIdx]);

  return (
    <div className="bg-white rounded-[2rem] p-8 flex flex-col gap-8 shadow-inner animate-fade-in font-sans border-2 border-slate-100">
      <div className="flex flex-col items-center text-center gap-2 border-b-2 border-slate-100 pb-8">
         <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{weekday}</h3>
         <p className="text-sm font-black text-indigo-600 bg-indigo-50 px-6 py-1.5 rounded-full uppercase tracking-widest">{selectedDayIdx + 1} DE {['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'][currentMY.month]}</p>
         {isHoliday && <div className="text-xs font-black text-rose-500 bg-rose-50 px-4 py-1 rounded-full mt-2 ring-1 ring-rose-200">🚩 FERIADO NACIONAL</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {staffByShift.map((group, idx) => (
          <div key={idx} className="bg-slate-50 border border-slate-100 p-6 rounded-[2rem] flex flex-col gap-4">
             <div className="flex justify-between items-center border-b border-white pb-3">
                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{group.label}</span>
                <span className="text-[10px] font-black text-indigo-600 bg-white shadow-sm px-3 py-1 rounded-full">{group.range}</span>
             </div>
             <div className="flex flex-wrap gap-2">
                {group.emps.map(e => (
                  <div key={e.id} className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
                     <span className="text-xs font-black text-slate-800 uppercase">{e.name.split(' ')[0]}</span>
                  </div>
                ))}
                {group.emps.length === 0 && <span className="text-[10px] font-bold text-slate-300 italic">Nenhum alocado</span>}
             </div>
             <div className="mt-auto pt-2 flex justify-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total: {group.emps.length}</span>
             </div>
          </div>
        ))}

        {offDuty.length > 0 && (
          <div className="bg-rose-50/50 border border-rose-100 p-6 rounded-[2rem] flex flex-col gap-4">
             <div className="flex justify-between items-center border-b border-rose-100 pb-3">
                <span className="text-sm font-black text-rose-600 uppercase tracking-tight">Fora de Escala</span>
                <Icon name="person_off" className="text-rose-400 text-sm" />
             </div>
             <div className="flex flex-wrap gap-2">
                {offDuty.map(e => (
                  <div key={e.id} className="bg-white/80 px-3 py-1.5 rounded-xl border border-rose-100 flex items-center gap-2">
                    <span className="text-[11px] font-black text-rose-800 uppercase">{e.name.split(' ')[0]}</span>
                    <span className="text-[10px] font-bold text-rose-400 opacity-60">({(e.shifts[monthKey] || [])[selectedDayIdx]})</span>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>

      <div className="mt-4 p-6 bg-slate-950 rounded-[2.5rem] flex items-center justify-between shadow-2xl shadow-slate-200">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-lg">H</div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Ri Happy Riocentro</p>
               <p className="text-sm font-black text-white mt-1 uppercase tracking-tight">Gestão Operacional de Equipe</p>
            </div>
         </div>
         <div className="text-right">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Status</p>
            <p className="text-xs font-black text-emerald-500 mt-1 uppercase tracking-widest">Atendimento Ativo</p>
         </div>
      </div>
    </div>
  );
};
