import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday, JornadaSettings } from '../types';
import { isWorkingShift, getShiftClassification } from '../hooks/useScheduleEngine';
import { buildHolidaySet, getDefaultHourForDay, DEFAULT_JORNADA_SETTINGS, getShortName, isEmployeeActiveInMonth } from '../constants';
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
      .filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month) && !e.isYoungApprentice)
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
          return getShortName(selected.name, employees);
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
          <div id="patrol-calendar-capture" className="bg-white p-8 w-[1120px] mx-auto text-black font-sans">
            
            {/* Title for Screenshot */}
            <div className="text-center mb-8 border-b-2 border-black pb-4">
               <h1 className="text-4xl font-black uppercase tracking-tighter">Cronograma de Ronda • Loja</h1>
               <p className="text-sm font-bold uppercase tracking-[0.3em] mt-1">{MONTH_NAMES[currentMY.month]} {currentMY.year}</p>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
              {WEEKDAY_NAMES.map(wd => (
                <div key={wd} className="text-center py-2 text-[10px] font-black uppercase tracking-widest border-b-2 border-black">
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell, idx) => (
                <div 
                  key={idx} 
                  className={`min-h-[110px] p-2 flex flex-col gap-1 ${
                    !cell 
                    ? 'border-transparent' 
                    : 'bg-white border-2 border-black'
                  }`}
                >
                  {cell && (
                    <>
                      <div className="flex justify-between items-center border-b border-gray-300 pb-1 mb-1">
                        <span className="text-sm font-black">
                          {cell.day}
                        </span>
                        {cell.isSunday && <span className="text-[9px] font-black uppercase">DOM</span>}
                        {cell.isHoliday && <span className="text-[9px] font-black uppercase border border-black px-1">FER</span>}
                      </div>
                      <div className="flex-1 flex flex-col justify-center gap-1.5">
                        <div className="flex items-center justify-between border border-black rounded-sm px-1 py-1">
                          <span className="text-[8px] font-black uppercase">ABERT.</span>
                          <span className="text-[10px] font-black uppercase truncate max-w-[60px]">{cell.aberturaName}</span>
                        </div>
                        <div className="flex items-center justify-between border border-black rounded-sm px-1 py-1">
                          <span className="text-[8px] font-black uppercase">FECH.</span>
                          <span className="text-[10px] font-black uppercase truncate max-w-[60px]">{cell.fechamentoName}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Legend/Notes for Screenshot */}
            <div className="mt-8 p-6 bg-white border-2 border-black flex flex-col md:flex-row justify-between gap-8">
                <div className="flex-1 flex flex-col gap-3">
                    <div className="flex items-center gap-2 border-b border-black pb-2">
                        <p className="text-xs font-black uppercase tracking-widest">Responsabilidades (Checklist)</p>
                    </div>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-[11px] font-bold">
                            <span className="font-black text-lg leading-none">•</span>
                            <span>Engajar o time para <b>varrer e passar pano</b> no chão do salão.</span>
                        </li>
                        <li className="flex items-start gap-2 text-[11px] font-bold">
                            <span className="font-black text-lg leading-none">•</span>
                            <span>Garantir que a loja seja <b>puxada de frente</b> (produtos organizados).</span>
                        </li>
                        <li className="flex items-start gap-2 text-[11px] font-bold">
                            <span className="font-black text-lg leading-none">•</span>
                            <span>Assegurar que a loja fique <b>minimamente organizada</b> para o próximo turno.</span>
                        </li>
                    </ul>
                </div>

                <div className="flex-1 flex flex-col gap-3 border-l-2 border-black pl-0 md:pl-8">
                    <div className="flex items-center gap-2 border-b border-black pb-2">
                        <p className="text-xs font-black uppercase tracking-widest">Momentos da Ronda</p>
                    </div>
                    <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-[11px] font-bold">
                            <span className="font-black text-lg leading-none">•</span>
                            <span><b>Turno Abertura:</b> Realizar a ronda e engajar a equipe antes da saída (aprox. 30min antes).</span>
                        </li>
                        <li className="flex items-start gap-2 text-[11px] font-bold">
                            <span className="font-black text-lg leading-none">•</span>
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
