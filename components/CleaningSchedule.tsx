
import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday } from '../types';
import { isWorkingShift } from '../hooks/useScheduleEngine';
import { buildHolidaySet } from '../constants';
import { Icon } from './Icon';
import { toPng } from 'html-to-image';

interface CleaningScheduleProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onClose: () => void;
}

const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const CleaningSchedule: React.FC<CleaningScheduleProps> = ({ employees, currentMY, customHolidays, onClose }) => {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const assignments = useMemo(() => {
    const activeEmps = employees
      .filter(e => !e.isHidden && e.status === 'active' && !e.isYoungApprentice)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (activeEmps.length === 0) return [];

    const schedule: { day: number, empName: string, isSunday: boolean, isHoliday: boolean }[] = [];
    
    // Simple rotation logic: 
    // We want to distribute fairly. We'll keep track of how many times each person has cleaned.
    const cleanCounts = new Map<string, number>();
    activeEmps.forEach(e => cleanCounts.set(e.id, 0));

    // Also keep track of the LAST day each person cleaned to avoid back-to-back if possible
    const lastCleanDay = new Map<string, number>();
    activeEmps.forEach(e => lastCleanDay.set(e.id, -10));

    for (let d = 0; d < daysInMonth; d++) {
      const date = new Date(currentMY.year, currentMY.month, d + 1);
      const isSunday = date.getDay() === 0;
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
      const isHoliday = holidaySet.has(dateStr);

      // 1. Find everyone working today
      const workingToday = activeEmps.filter(emp => {
        const shift = (emp.shifts[monthKey] || [])[d] || 'T';
        return isWorkingShift(shift);
      });

      if (workingToday.length === 0) {
        schedule.push({ day: d + 1, empName: 'Ninguém Escalado', isSunday, isHoliday });
        continue;
      }

      // 2. Pick the person who has cleaned the FEWEST times
      // and hasn't cleaned for the longest time
      workingToday.sort((a, b) => {
        const countA = cleanCounts.get(a.id) || 0;
        const countB = cleanCounts.get(b.id) || 0;
        if (countA !== countB) return countA - countB;
        
        const lastA = lastCleanDay.get(a.id) || 0;
        const lastB = lastCleanDay.get(b.id) || 0;
        return lastA - lastB;
      });

      const selected = workingToday[0];
      schedule.push({ day: d + 1, empName: selected.name.split(' ')[0], isSunday, isHoliday });
      
      cleanCounts.set(selected.id, (cleanCounts.get(selected.id) || 0) + 1);
      lastCleanDay.set(selected.id, d);
    }

    return schedule;
  }, [employees, currentMY, holidaySet, monthKey, daysInMonth]);

  const handleDownload = async () => {
    const el = document.getElementById('cleaning-calendar-capture');
    if (el) {
      const dataUrl = await toPng(el, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: 1200, // Force specific width
        style: { 
          padding: '40px',
          width: '1200px',
          margin: '0',
          display: 'block'
        }
      });
      const link = document.createElement('a');
      link.download = `limpeza-copa-${monthKey}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const calendarCells = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarCells.push(null);
  assignments.forEach(a => calendarCells.push(a));

  return (
    <div className="flex flex-col h-full animate-fade-in bg-slate-50 dark:bg-slate-950 p-6 overflow-hidden">
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
              <Icon name="cleaning_services" className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Escala de Limpeza da Copa</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{MONTH_NAMES[currentMY.month]} {currentMY.year}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
            >
              <Icon name="download" /> Baixar Imagem
            </button>
            <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <Icon name="close" className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Calendar Area */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl p-6 lg:p-10">
          <div id="cleaning-calendar-capture" className="bg-white dark:bg-slate-900 p-8 w-[1120px] mx-auto">
            
            {/* Title for Screenshot */}
            <div className="text-center mb-10">
               <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Cronograma de Limpeza • Copa</h1>
               <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">{MONTH_NAMES[currentMY.month]} {currentMY.year}</p>
            </div>

            <div className="grid grid-cols-7 gap-3 mb-3">
              {WEEKDAY_NAMES.map(wd => (
                <div key={wd} className="text-center py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-50 dark:border-slate-800">
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-3">
              {calendarCells.map((cell, idx) => (
                <div 
                  key={idx} 
                  className={`min-h-[110px] rounded-[2rem] border-2 p-4 flex flex-col gap-2 transition-all ${
                    !cell 
                    ? 'border-transparent' 
                    : cell.isSunday 
                      ? 'bg-rose-50/30 border-rose-100 dark:bg-rose-900/5 dark:border-rose-900/20' 
                      : cell.isHoliday
                        ? 'bg-amber-50/30 border-amber-100 dark:bg-amber-900/5 dark:border-amber-900/20'
                        : 'bg-white dark:bg-slate-800 border-slate-50 dark:border-slate-700/50 hover:shadow-md'
                  }`}
                >
                  {cell && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm font-black ${cell.isSunday ? 'text-rose-500' : 'text-slate-300 dark:text-slate-600'}`}>
                          {cell.day}
                        </span>
                        {cell.isHoliday && <Icon name="event_busy" className="text-amber-500 text-xs" />}
                      </div>
                      <div className="flex-1 flex flex-col justify-center items-center text-center">
                        <p className={`text-[11px] font-black uppercase leading-tight ${cell.isSunday ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}`}>
                          {cell.empName}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Legend/Notes for Screenshot */}
            <div className="mt-12 p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between gap-8">
                <div className="flex-1 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <Icon name="info" className="text-xl" />
                        <p className="text-xs font-black uppercase tracking-widest">Manutenção Leve (Coletiva)</p>
                    </div>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5" /> 
                            <span>Organizar bancada e mesa (<b>Quem suja, lava sua louça</b>)</span>
                        </li>
                        <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5" /> 
                            <span>Higienizar superfícies (bancada, mesa e micro-ondas)</span>
                        </li>
                        <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5" /> 
                            <span>Trocar sacos de lixo e organizar os utensílios comuns</span>
                        </li>
                    </ul>
                </div>

                <div className="flex-1 flex flex-col gap-4 border-l border-slate-200 dark:border-slate-700 pl-0 md:pl-8">
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                        <Icon name="schedule" className="text-xl" />
                        <p className="text-xs font-black uppercase tracking-widest">Horário e Regras</p>
                    </div>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <Icon name="history_toggle_off" className="text-sm mt-0.5 text-orange-500" /> 
                            <span>Realizar entre <b>14h e 18h</b> (período de baixo fluxo).</span>
                        </li>
                        <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <Icon name="groups" className="text-sm mt-0.5 text-orange-500" /> 
                            <span>Necessário mínimo de <b>3 pessoas</b> na loja para iniciar.</span>
                        </li>
                        <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <Icon name="notification_important" className="text-sm mt-0.5 text-rose-500" /> 
                            <span>Se houver apenas 2 pessoas, <b>não limpar</b> e avisar no grupo.</span>
                        </li>
                    </ul>
                </div>
            </div>
          </div>
        </div>

        {/* Stats / Summary */}
        <div className="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-between">
           <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">🧹</div>
              <div>
                 <h3 className="text-xl font-black uppercase">Revezamento Justo</h3>
                 <p className="text-white/70 text-xs font-bold">O sistema distribuiu a limpeza entre todos os colaboradores escalados para trabalhar.</p>
              </div>
           </div>
           <div className="flex gap-4">
              <div className="text-center">
                 <p className="text-[10px] font-black text-white/50 uppercase">Média por Colab.</p>
                 <p className="text-2xl font-black">{(daysInMonth / Math.max(employees.filter(e => !e.isYoungApprentice).length, 1)).toFixed(1)}</p>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};
