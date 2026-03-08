
import React, { useMemo, useState } from 'react';
import { Employee, MonthYear, Holiday, ShiftType } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet } from '../constants';

interface AnalysisPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onClose: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ employees, currentMY, customHolidays, onClose }) => {
  const [viewMode, setViewMode] = useState<'insights' | 'team-calendar'>('insights');
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  // ── Data Processing ──────────────────────────────────────────────────────────

  const dailyCoverage = useMemo(() => {
    const coverage = [];
    for (let d = 0; d < daysInMonth; d++) {
      const activeEmps = employees.filter(e => !e.isHidden && e.status === 'active');
      const working = activeEmps.filter(e => {
        const s = (e.shifts[monthKey] || [])[d];
        return s === 'T' || s === 'C';
      });

      const shiftsCount = {
        abertura: working.filter(e => e.shiftName === 'Abertura').length,
        intermediario: working.filter(e => e.shiftName === 'Intermediário').length,
        fechamento: working.filter(e => e.shiftName === 'Fechamento').length,
      };

      coverage.push({
        day: d + 1,
        total: working.length,
        shifts: shiftsCount,
        isSunday: new Date(currentMY.year, currentMY.month, d + 1).getDay() === 0,
        isHoliday: holidaySet.has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`)
      });
    }
    return coverage;
  }, [employees, monthKey, daysInMonth, currentMY, holidaySet]);

  const employeeStats = useMemo(() => {
    return employees.filter(e => !e.isHidden && e.status === 'active').map(emp => {
      let worked = 0;
      let maxStreak = 0;
      let currentStreak = 0;
      const shifts = emp.shifts[monthKey] || [];

      for (let d = 0; d < daysInMonth; d++) {
        const s = shifts[d];
        if (s === 'T' || s === 'C') {
          worked++;
          currentStreak++;
          if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else {
          currentStreak = 0;
        }
      }

      return {
        id: emp.id,
        name: emp.name,
        worked,
        maxStreak,
        overlooked: maxStreak > 6,
        isHeavy: worked > 22
      };
    }).sort((a, b) => b.worked - a.worked);
  }, [employees, monthKey, daysInMonth]);

  const bottlenecks = useMemo(() => {
    return dailyCoverage.filter(c => c.total < 6);
  }, [dailyCoverage]);

  // ── Render Helpers ───────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
               <Icon name="insights" className="text-2xl" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Análise de Escala & Gargalos</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
                Visualização de Sobrecarga e Cobertura Operacional • {(currentMY.month + 1).toString().padStart(2, '0')}/{currentMY.year}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="bg-slate-100 p-1 rounded-2xl flex gap-1">
                <button 
                  onClick={() => setViewMode('insights')}
                  className={`px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${viewMode === 'insights' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                >
                  <Icon name="analytics" className="text-sm" /> Insights
                </button>
                <button 
                  onClick={() => setViewMode('team-calendar')}
                  className={`px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${viewMode === 'team-calendar' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                >
                  <Icon name="calendar_view_month" className="text-sm" /> Escala Geral
                </button>
             </div>
             <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-full transition-colors order-last ml-2">
               <Icon name="close" className="text-slate-400" />
             </button>
          </div>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar">
          
          {viewMode === 'insights' ? (
            <div className="space-y-8 animate-fade-in">
              
              {/* Row 1: Key Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <InsightCard 
                  label="Média de Equipe" 
                  description="Média de pessoas por dia"
                  value={(dailyCoverage.reduce((acc, c) => acc + c.total, 0) / daysInMonth).toFixed(1)} 
                  icon="group" color="indigo" 
                />
                <InsightCard 
                  label="Dias Críticos" 
                  description="Dias com menos de 6 pessoas"
                  value={bottlenecks.length.toString()} 
                  icon="warning" color="rose"
                  urgent={bottlenecks.length > 0}
                />
                <InsightCard 
                  label="Sobrecarga Ativa" 
                  description="Colaboradores com > 6 dias seguidos"
                  value={employeeStats.filter(s => s.overlooked).length.toString()} 
                  icon="timer" color="amber" 
                />
                <InsightCard 
                  label="Turno Mais Fraco" 
                  description="Menor cobertura média"
                  value="Intermed." 
                  icon="leaderboard" color="sky" 
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Visual Coverage Heatmap */}
                <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-lg font-black text-slate-800">Mapa de Calor: Cobertura Diária</h3>
                      <p className="text-xs font-bold text-slate-400">Total de pessoas escaladas por dia do mês</p>
                    </div>
                    <div className="flex gap-4">
                       <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                          <span className="w-3 h-3 bg-indigo-500 rounded-sm"></span> Equipe OK
                       </div>
                       <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                          <span className="w-3 h-3 bg-rose-500 rounded-sm"></span> Crítico (&lt;6)
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-15 gap-2">
                    {dailyCoverage.map(c => (
                      <div 
                        key={c.day}
                        className={`group relative flex flex-col items-center justify-center aspect-square rounded-xl border transition-all ${
                          c.total < 6 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                        } hover:scale-105 hover:shadow-md cursor-help`}
                      >
                        <span className="text-[10px] font-black">{c.total}</span>
                        <span className="text-[8px] font-bold opacity-40 absolute top-1 left-1">{c.day}</span>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-slate-900 text-white rounded-lg text-[10px] font-bold hidden group-hover:block z-50 whitespace-nowrap shadow-xl">
                           <p className="border-b border-slate-700 pb-1 mb-1">Dia {c.day} • {c.isSunday ? 'Domingo' : c.isHoliday ? 'Feriado' : 'Semana'}</p>
                           <p className="text-indigo-300">Abertura: {c.shifts.abertura}</p>
                           <p className="text-sky-300">Intermed: {c.shifts.intermediario}</p>
                           <p className="text-amber-300">Fechamento: {c.shifts.fechamento}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overload Ranking */}
                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm flex flex-col">
                   <div className="mb-6">
                      <h3 className="text-lg font-black text-slate-800">Ranking de Sobrecarga</h3>
                      <p className="text-xs font-bold text-slate-400">Maior volume de dias trabalhados</p>
                   </div>
                   <div className="flex-1 space-y-4">
                      {employeeStats.slice(0, 5).map((s, idx) => (
                        <div key={s.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100/50">
                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                              {idx + 1}
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-slate-900 uppercase truncate">{s.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                 <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${s.isHeavy ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${(s.worked / daysInMonth) * 100}%` }}></div>
                                 </div>
                                 <span className="text-[10px] font-black text-slate-500">{s.worked}d</span>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>

              </div>

              {/* Row 3: Critical Days List */}
              {bottlenecks.length > 0 && (
                <div className="bg-rose-50 border border-rose-100 rounded-[2.5rem] p-8 animate-pulse-subtle">
                   <div className="flex items-center gap-4 mb-6">
                      <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-200">
                         <Icon name="error" className="text-xl" />
                      </div>
                      <div>
                         <h3 className="text-lg font-black text-rose-900 uppercase tracking-tight">ALERTA DE GARGALO DETECTADO</h3>
                         <p className="text-xs font-bold text-rose-700">Identificamos dias onde a equipe está abaixo do mínimo operacional (6 pessoas).</p>
                      </div>
                   </div>
                   <div className="flex flex-wrap gap-3">
                      {bottlenecks.map(b => (
                        <div key={b.day} className="flex items-center gap-3 bg-white border border-rose-200 px-4 py-3 rounded-2xl shadow-sm">
                           <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-rose-500 uppercase leading-none">{WEEKDAY_NAMES[new Date(currentMY.year, currentMY.month, b.day).getDay()].substring(0, 3)}</span>
                              <span className="text-xl font-black text-slate-900 leading-none mt-1">{b.day}</span>
                           </div>
                           <div className="h-8 w-px bg-rose-100 mx-1"></div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Apenas</p>
                              <p className="text-sm font-black text-rose-600 leading-tight">{b.total} Pessoas</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              )}

            </div>
          ) : (
            <div className="h-full animate-fade-in bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm overflow-auto">
               <TeamMonthlyCalendar employees={employees} currentMY={currentMY} customHolidays={customHolidays} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-white border-t border-slate-100 flex items-center justify-between">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Insights Operacionais Mensal • Ri Happy Dashboard v2.0</p>
           <button 
             onClick={onClose} 
             className="px-10 py-3 bg-slate-950 text-white text-xs font-black rounded-2xl hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
           >
             Sair da Análise
           </button>
        </div>
      </div>
    </div>
  );
};

const InsightCard: React.FC<{ label: string, value: string, icon: any, color: any, description: string, urgent?: boolean }> = ({ label, value, icon, color, description, urgent }) => (
  <div className={`bg-white border rounded-[2rem] p-6 shadow-sm flex items-center gap-5 transition-all hover:translate-y-[-4px] hover:shadow-md ${urgent ? 'border-rose-300 ring-2 ring-rose-50' : 'border-slate-100'}`}>
     <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
       color === 'indigo' ? 'bg-indigo-50 text-indigo-600' : 
       color === 'rose' ? 'bg-rose-50 text-rose-600' : 
       color === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
     }`}>
        <Icon name={icon} className="text-2xl" />
     </div>
     <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <h4 className={`text-2xl font-black ${urgent ? 'text-rose-600' : 'text-slate-900'} leading-none mb-1`}>{value}</h4>
        <p className="text-[9px] font-bold text-slate-400 truncate">{description}</p>
     </div>
  </div>
);

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

const TeamMonthlyCalendar: React.FC<{ employees: Employee[], currentMY: MonthYear, customHolidays: Holiday[] }> = ({ employees, currentMY, customHolidays }) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const hSet = buildHolidaySet(currentMY.year, customHolidays);

  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ type: 'empty' });
  for (let i = 1; i <= daysInMonth; i++) {
    const workingDayData = employees.filter(e => !e.isHidden && e.status === 'active').map(emp => {
      const shift = (emp.shifts[monthKey] || [])[i - 1];
      const hours = (emp.dailyHours[monthKey] || [])[i - 1] || emp.workPeriod;
      return { name: emp.name.split(' ')[0], shift, hours, isOff: shift === 'F' || (typeof shift === 'string' && shift.startsWith('FF')) || shift === 'FE', isCourse: shift === 'C' };
    }).filter(d => !d.isOff);
    cells.push({ type: 'day', date: i, dayData: workingDayData });
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-3 mb-3">
        {WEEKDAY_NAMES.map(wd => (
          <div key={wd} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{wd.substring(0, 3)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-3">
        {cells.map((cell, idx) => (
          <div key={idx} className={`min-h-[140px] rounded-[1.5rem] border p-4 flex flex-col gap-1 transition-all ${cell.type === 'empty' ? 'border-transparent' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-lg'}`}>
            {cell.type === 'day' && (
              <>
                <span className="text-xs font-black text-slate-400 mb-2">{cell.date}</span>
                <div className="space-y-1 overflow-hidden">
                  {cell.dayData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-100/50">
                       <span className="text-[8px] font-black text-slate-700 uppercase truncate">{d.name}</span>
                       <span className="text-[7px] font-bold text-slate-400 shrink-0">{d.hours.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
