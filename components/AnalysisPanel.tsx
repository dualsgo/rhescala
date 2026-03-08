
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

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ employees, currentMY, customHolidays, onClose }) => {
  const [viewMode, setViewMode] = useState<'insights' | 'team-calendar'>('insights');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(employees.filter(e => !e.isHidden && e.status === 'active')[0]?.id || null);
  
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
        return s === 'T'; // Somente T conta como presença na LOJA
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
        // T e C contam como atividade (impede folga no 6x1)
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
        isHeavy: worked > 22,
        emp
      };
    }).sort((a, b) => b.worked - a.worked);
  }, [employees, monthKey, daysInMonth]);

  const bottlenecks = useMemo(() => {
    return dailyCoverage.filter(c => c.total < 6);
  }, [dailyCoverage]);

  const selectedEmployee = useMemo(() => 
    employeeStats.find(s => s.id === selectedEmpId), [employeeStats, selectedEmpId]
  );

  // ── Render Helpers ───────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[95vh]">
        
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
              
              {/* Key Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <InsightCard 
                  label="Média de Equipe" 
                  description="Média de pessoas por dia"
                  value={(dailyCoverage.reduce((acc, c) => acc + c.total, 0) / daysInMonth).toFixed(1)} 
                  icon="group" color="indigo" 
                />
                <InsightCard 
                  label="Dias Críticos" 
                  description="Abaixo de 6 pessoas"
                  value={bottlenecks.length.toString()} 
                  icon="warning" color="rose"
                  urgent={bottlenecks.length > 0}
                />
                <InsightCard 
                  label="Sobrecarga" 
                  description="Com > 6 dias seguidos"
                  value={employeeStats.filter(s => s.overlooked).length.toString()} 
                  icon="timer" color="amber" 
                />
                <InsightCard 
                  label="Escala Ativa" 
                  description="Total de colaboradores"
                  value={employeeStats.length.toString()} 
                  icon="person" color="sky" 
                />
              </div>

              {/* Main Interactive Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left: Individual Weekly Calendar */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm h-full flex flex-col">
                    <div className="mb-6 flex justify-between items-start">
                        <div className="min-w-0">
                            <h3 className="text-lg font-black text-slate-800 truncate">
                                {selectedEmployee?.name || 'Selecione um colaborador'}
                            </h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Calendário Semanal (Dom-Sáb)</p>
                        </div>
                        {selectedEmployee?.overlooked && (
                            <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-[10px] font-black animate-pulse">
                                ALERTA 6x1
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        {selectedEmployee && (
                            <IndividualWeeklyCalendar 
                                employee={selectedEmployee.emp} 
                                currentMY={currentMY} 
                                customHolidays={customHolidays}
                            />
                        )}
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                        <div className="bg-slate-50 p-4 rounded-2xl">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Dias Trabalhados</p>
                            <p className="text-2xl font-black text-slate-900">{selectedEmployee?.worked}d</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Maior Sequência</p>
                            <p className="text-2xl font-black text-slate-900">{selectedEmployee?.maxStreak}d</p>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Middle/Right: Overload Ranking with Click Interaction */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                   <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm flex flex-col max-h-[600px]">
                        <div className="mb-6">
                            <h3 className="text-lg font-black text-slate-800">Ranking de Escala</h3>
                            <p className="text-xs font-bold text-slate-400">Clique no colaborador para ver o calendário individual</p>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                            {employeeStats.map((s, idx) => (
                                <button 
                                    key={s.id} 
                                    onClick={() => setSelectedEmpId(s.id)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${
                                        selectedEmpId === s.id 
                                        ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100 scale-[1.02]' 
                                        : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                                        selectedEmpId === s.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                                    }`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <p className={`text-xs font-black uppercase truncate ${selectedEmpId === s.id ? 'text-white' : 'text-slate-900'}`}>
                                            {s.name}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${selectedEmpId === s.id ? 'bg-white/20' : 'bg-slate-200'}`}>
                                                <div className={`h-full rounded-full ${s.isHeavy ? 'bg-rose-400' : 'bg-indigo-400'}`} style={{ width: `${(s.worked / daysInMonth) * 100}%` }}></div>
                                            </div>
                                            <span className={`text-[10px] font-black shrink-0 ${selectedEmpId === s.id ? 'text-white/80' : 'text-slate-500'}`}>
                                                {s.worked} dias
                                            </span>
                                        </div>
                                    </div>
                                    {s.overlooked && (
                                        <Icon name="timer" className={selectedEmpId === s.id ? 'text-white' : 'text-rose-500'} />
                                    )}
                                </button>
                            ))}
                        </div>
                   </div>

                   {/* Heatmap moved to bottom of middle section */}
                   <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Mapa de Cobertura Geral</h3>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400">
                                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm"></span> OK
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400">
                                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></span> Crítico
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {dailyCoverage.map(c => (
                                <div 
                                    key={c.day}
                                    className={`w-8 h-8 flex flex-col items-center justify-center rounded-lg border text-[9px] font-black transition-all ${
                                        c.total < 6 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                                    }`}
                                >
                                    {c.total}
                                </div>
                            ))}
                        </div>
                   </div>
                </div>

              </div>

              {/* Botlenecks Alert */}
              {bottlenecks.length > 0 && (
                <div className="bg-rose-50 border border-rose-100 rounded-[2.5rem] p-8">
                   <div className="flex items-center gap-4 mb-6">
                      <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-200">
                         <Icon name="error" className="text-xl" />
                      </div>
                      <div>
                         <h3 className="text-lg font-black text-rose-900 uppercase tracking-tight">ALERTA DE EQUIPE INSUFICIENTE</h3>
                         <p className="text-xs font-bold text-rose-700">Identificamos dias onde a equipe está abaixo do mínimo operacional (6 pessoas).</p>
                      </div>
                   </div>
                   <div className="flex flex-wrap gap-3">
                      {bottlenecks.map(b => (
                        <div key={b.day} className="flex items-center gap-3 bg-white border border-rose-200 px-4 py-2 rounded-2xl shadow-sm">
                           <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-rose-500 leading-none">{WEEKDAY_NAMES[new Date(currentMY.year, currentMY.month, b.day).getDay()].substring(0, 3)}</span>
                              <span className="text-lg font-black text-slate-900 leading-none mt-1">{b.day}</span>
                           </div>
                           <div className="h-6 w-px bg-rose-100 mx-1"></div>
                           <p className="text-sm font-black text-rose-600">{b.total} CLT's</p>
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
        <div className="px-10 py-6 bg-white border-t border-slate-100 flex items-center justify-between sticky bottom-0">
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
  <div className={`bg-white border rounded-3xl p-6 shadow-sm flex items-center gap-5 transition-all hover:translate-y-[-4px] hover:shadow-md ${urgent ? 'border-rose-300 ring-2 ring-rose-50' : 'border-slate-100'}`}>
     <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
       color === 'indigo' ? 'bg-indigo-50 text-indigo-600' : 
       color === 'rose' ? 'bg-rose-50 text-rose-600' : 
       color === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
     }`}>
        <Icon name={icon} className="text-xl" />
     </div>
     <div className="min-w-0">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <h4 className={`text-xl font-black ${urgent ? 'text-rose-600' : 'text-slate-900'} leading-none`}>{value}</h4>
        <p className="text-[9px] font-bold text-slate-400 truncate">{description}</p>
     </div>
  </div>
);

const IndividualWeeklyCalendar: React.FC<{ employee: Employee, currentMY: MonthYear, customHolidays: Holiday[] }> = ({ employee, currentMY, customHolidays }) => {
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay(); // 0 is Sunday
    const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
    const shifts = employee.shifts[monthKey] || [];
    const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

    // Create a flat list of days including leading empty spaces for the first week
    const calendarDays = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push({ type: 'empty' });
    }
    for (let i = 1; i <= daysInMonth; i++) {
        const shift = shifts[i - 1];
        const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        // Ausência é qualquer coisa que não seja T. 
        // Mas para visualização de "Folga" no calendário individual, ignoramos o Curso (que é externo)
        const isOff = shift !== 'T' && shift !== 'C'; 
        const isCourse = shift === 'C';
        const isHoliday = holidaySet.has(dateStr);
        calendarDays.push({ type: 'day', day: i, shift, isOff, isCourse, isHoliday });
    }

    return (
        <div className="w-full">
            <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAY_NAMES.map(wd => (
                    <div key={wd} className="text-center text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                        {wd.substring(0, 3)}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((cell, idx) => {
                    if (cell.type === 'empty') return <div key={idx} className="aspect-square"></div>;
                    
                    const isWork = !cell.isOff;
                    const shiftLabel = (cell.shift as string)?.split(' ')[0] || '-';
                    
                    return (
                        <div 
                            key={idx}
                            className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all ${
                                cell.shift === 'T' 
                                ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' 
                                : cell.isCourse
                                ? 'bg-teal-500 border-teal-600 text-white shadow-sm'
                                : cell.isHoliday ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-100 text-slate-300'
                            }`}
                        >
                            <span className={`text-[8px] font-black absolute top-1 left-1 opacity-50 ${cell.shift === 'T' || cell.isCourse ? 'text-white/60' : ''}`}>{cell.day}</span>
                            <span className="text-[10px] font-black tracking-tighter">{cell.shift === 'T' ? shiftLabel : cell.isCourse ? 'C' : 'F'}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const TeamMonthlyCalendar: React.FC<{ employees: Employee[], currentMY: MonthYear, customHolidays: Holiday[] }> = ({ employees, currentMY, customHolidays }) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;

  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ type: 'empty' });
  for (let i = 1; i <= daysInMonth; i++) {
    const workingDayData = employees.filter(e => !e.isHidden && e.status === 'active').map(emp => {
      const shift = (emp.shifts[monthKey] || [])[i - 1];
      const hours = (emp.dailyHours[monthKey] || [])[i - 1] || emp.workPeriod;
      const isOff = shift !== 'T' && shift !== 'C';
      return { name: emp.name.split(' ')[0], shift, hours, isOff, isCourse: shift === 'C' };
    }).filter(d => !d.isOff || d.isCourse); // Mostramos T e C no calendário geral
    cells.push({ type: 'day', date: i, dayData: workingDayData });
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-4 mb-4">
        {WEEKDAY_NAMES.map(wd => (
          <div key={wd} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{wd}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-4">
        {cells.map((cell, idx) => (
          <div key={idx} className={`min-h-[160px] rounded-[2rem] border p-5 flex flex-col gap-1.5 transition-all ${cell.type === 'empty' ? 'border-transparent' : 'bg-white border-slate-100'}`}>
            {cell.type === 'day' && (
              <>
                <span className="text-xs font-black text-slate-400 mb-3">{cell.date}</span>
                <div className="space-y-1.5">
                  {cell.dayData.map((d, i) => (
                    <div key={i} className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${d.isCourse ? 'bg-teal-50 border-teal-100 text-teal-700' : 'bg-slate-50 border-slate-100/50 text-slate-800'}`}>
                       <span className="text-[9px] font-black uppercase truncate">{d.name}</span>
                       <span className={`text-[8px] font-bold shrink-0 ${d.isCourse ? 'mt-[-2px]' : 'text-slate-400'}`}>
                          {d.isCourse ? <Icon name="school" className="text-[10px]" /> : d.hours.split(' ')[0]}
                       </span>
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
