import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday, JornadaSettings } from '../types';
import { isWorkingShift, getShiftClassification } from '../hooks/useScheduleEngine';
import { buildHolidaySet, getDefaultHourForDay, DEFAULT_JORNADA_SETTINGS } from '../constants';
import { Icon } from './Icon';
import { toPng } from 'html-to-image';

interface PatrolScheduleProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  jornadaSettings?: JornadaSettings;
  onClose: () => void;
}

const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const PatrolSchedule: React.FC<PatrolScheduleProps> = ({ employees, currentMY, customHolidays, jornadaSettings = DEFAULT_JORNADA_SETTINGS, onClose }) => {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const assignments = useMemo(() => {
    const activeEmps = employees
      .filter(e => !e.isHidden && e.status === 'active' && !e.isYoungApprentice)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (activeEmps.length === 0) return [];

    const schedule: { day: number, aberturaName: string, fechamentoName: string, isSunday: boolean, isHoliday: boolean }[] = [];
    
    // We want to distribute fairly. We'll keep track of how many times each person has patrolled.
    const patrolCounts = new Map<string, number>();
    activeEmps.forEach(e => patrolCounts.set(e.id, 0));

    // Also keep track of the LAST day each person patrolled to avoid back-to-back if possible
    const lastPatrolDay = new Map<string, number>();
    activeEmps.forEach(e => lastPatrolDay.set(e.id, -10));

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
        schedule.push({ day: d + 1, aberturaName: '-', fechamentoName: '-', isSunday, isHoliday });
        continue;
      }

      // Separate by shift
      const aberturaPool: Employee[] = [];
      const fechamentoPool: Employee[] = [];

      workingToday.forEach(emp => {
          const hour = emp.dailyHours[monthKey]?.[d] || getDefaultHourForDay(emp, isHoliday, isSunday);
          const classification = getShiftClassification(hour, isSunday, jornadaSettings);
          if (classification === 'Abertura') {
              aberturaPool.push(emp);
          } else if (classification === 'Fechamento' || classification === 'Intermediário') {
              // Group Intermediário with Fechamento for patrol purposes if needed, 
              // but prioritize Fechamento logic. Actually let's just group them into Fechamento if they aren't Abertura.
              fechamentoPool.push(emp);
          }
      });

      const pickPerson = (pool: Employee[], dayIdx: number) => {
          if (pool.length === 0) return '-';
          pool.sort((a, b) => {
            const countA = patrolCounts.get(a.id) || 0;
            const countB = patrolCounts.get(b.id) || 0;
            if (countA !== countB) return countA - countB;
            
            const lastA = lastPatrolDay.get(a.id) || 0;
            const lastB = lastPatrolDay.get(b.id) || 0;
            return lastA - lastB;
          });
          const selected = pool[0];
          patrolCounts.set(selected.id, (patrolCounts.get(selected.id) || 0) + 1);
          lastPatrolDay.set(selected.id, dayIdx);
          return selected.name.split(' ')[0];
      };

      const aberturaName = pickPerson(aberturaPool, d);
      const fechamentoName = pickPerson(fechamentoPool, d);

      schedule.push({ day: d + 1, aberturaName, fechamentoName, isSunday, isHoliday });
    }

    return schedule;
  }, [employees, currentMY, holidaySet, monthKey, daysInMonth, jornadaSettings]);

  const handleDownload = async () => {
    const el = document.getElementById('patrol-calendar-capture');
    if (el) {
      const dataUrl = await toPng(el, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: 1200, 
        style: { 
          padding: '40px',
          width: '1200px',
          margin: '0',
          display: 'block'
        }
      });
      const link = document.createElement('a');
      link.download = `ronda-loja-${monthKey}.png`;
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
            <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center">
              <Icon name="local_police" className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Escala de Ronda na Loja</h2>
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
          <div id="patrol-calendar-capture" className="bg-white dark:bg-slate-900 p-8 w-[1120px] mx-auto">
            
            {/* Title for Screenshot */}
            <div className="text-center mb-10">
               <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Cronograma de Ronda • Loja</h1>
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
                  className={`min-h-[110px] rounded-[2rem] border-2 p-3 flex flex-col gap-1 transition-all ${
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
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-black ${cell.isSunday ? 'text-rose-500' : 'text-slate-300 dark:text-slate-600'}`}>
                          {cell.day}
                        </span>
                        {cell.isHoliday && <Icon name="event_busy" className="text-amber-500 text-xs" />}
                      </div>
                      <div className="flex-1 flex flex-col justify-center gap-1.5">
                        <div className="flex items-center justify-between bg-sky-50 dark:bg-sky-900/20 rounded-xl px-2 py-1">
                          <span className="text-[8px] font-black text-sky-500 uppercase">Abert.</span>
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate max-w-[60px]">{cell.aberturaName}</span>
                        </div>
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-2 py-1">
                          <span className="text-[8px] font-black text-indigo-500 uppercase">Fech.</span>
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate max-w-[60px]">{cell.fechamentoName}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Legend/Notes for Screenshot */}
            <div className="mt-12 p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between gap-8">
                <div className="flex-1 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                        <Icon name="fact_check" className="text-xl" />
                        <p className="text-xs font-black uppercase tracking-widest">Responsabilidades (Checklist)</p>
                    </div>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 bg-sky-400 rounded-full mt-1.5" /> 
                            <span>Engajar o time para <b>varrer e passar pano</b> no chão do salão.</span>
                        </li>
                        <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 bg-sky-400 rounded-full mt-1.5" /> 
                            <span>Garantir que a loja seja <b>puxada de frente</b> (produtos organizados).</span>
                        </li>
                        <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <div className="w-1.5 h-1.5 bg-sky-400 rounded-full mt-1.5" /> 
                            <span>Assegurar que a loja fique <b>minimamente organizada</b> para o próximo turno.</span>
                        </li>
                    </ul>
                </div>

                <div className="flex-1 flex flex-col gap-4 border-l border-slate-200 dark:border-slate-700 pl-0 md:pl-8">
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                        <Icon name="schedule" className="text-xl" />
                        <p className="text-xs font-black uppercase tracking-widest">Momentos da Ronda</p>
                    </div>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <Icon name="wb_sunny" className="text-sm mt-0.5 text-amber-500" /> 
                            <span><b>Turno Abertura:</b> Realizar a ronda e engajar a equipe antes da saída (aprox. 30min antes).</span>
                        </li>
                        <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            <Icon name="nights_stay" className="text-sm mt-0.5 text-indigo-500" /> 
                            <span><b>Turno Fechamento:</b> Realizar a ronda ao final do dia para garantir que a loja amanheça arrumada.</span>
                        </li>
                    </ul>
                </div>
            </div>
          </div>
        </div>

        {/* Stats / Summary */}
        <div className="bg-sky-600 rounded-[2rem] p-8 text-white shadow-xl shadow-sky-200 dark:shadow-none flex items-center justify-between">
           <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">📋</div>
              <div>
                 <h3 className="text-xl font-black uppercase">Ronda Diária</h3>
                 <p className="text-white/70 text-xs font-bold">O sistema dividiu a responsabilidade de liderar a organização por turno.</p>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};
