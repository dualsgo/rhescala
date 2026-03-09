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
  
  const getEffectiveShift = (emp: Employee, dayIdx: number) => {
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    
    // Check if employee is on vacation
    if (emp.vacationStart) {
      const start = emp.vacationStart;
      // If no vacationEnd, assume 30 days
      const end = emp.vacationEnd || addDays(start, 30);
      if (dateStr >= start && dateStr <= end) return 'FE';
    }

    const monthShifts = emp.shifts[monthKey] || [];
    return monthShifts[dayIdx] || 'F';
  };

  // Helper inside AnalysisPanel for date math
  function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  // ── Data Processing ──────────────────────────────────────────────────────────

  const dailyCoverage = useMemo(() => {
    const coverage = [];
    for (let d = 0; d < daysInMonth; d++) {
      const activeEmps = employees.filter(e => !e.isHidden && e.status === 'active');
      const working = activeEmps.filter(e => {
        const s = getEffectiveShift(e, d);
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
    const theoreticalMax = daysInMonth - Math.floor(daysInMonth / 7);
    
    return employees.filter(e => !e.isHidden && e.status === 'active').map(emp => {
      let worked = 0;
      let totalHours = 0;
      let maxStreak = 0;
      let currentStreak = 0;
      let fullCycles = 0;
      let sundaysWorked = 0;
      let holidaysWorked = 0;

      for (let d = 0; d < daysInMonth; d++) {
        const s = getEffectiveShift(emp, d);
        const dayType = new Date(currentMY.year, currentMY.month, d + 1).getDay();
        const isSun = dayType === 0;
        const isHol = holidaySet.has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`);

        if (s === 'T' || s === 'C') {
          worked++;
          currentStreak++;
          if (currentStreak > maxStreak) maxStreak = currentStreak;
          if (currentStreak === 6) fullCycles++;
          
          if (isSun) sundaysWorked++;
          if (isHol) holidaysWorked++;

          // Hours calculation
          const hStr = (emp.dailyHours[monthKey] || [])[d] || emp.workPeriod || '';
          // Simple extraction: "08:00 às 16:20 (1h)" -> roughly 7.33h (standard)
          // If it mentions hours differently, we might need a better parser.
          // For now, let's assume 7.33 if 'T' or 'C'
          totalHours += 7.33; 
        } else {
          currentStreak = 0;
        }
      }

      const extraOffs = Math.max(0, theoreticalMax - worked);

      return {
        id: emp.id,
        name: emp.name,
        worked,
        totalHours: Math.round(totalHours),
        theoreticalMax,
        extraOffs,
        fullCycles,
        maxStreak,
        sundaysWorked,
        holidaysWorked,
        overlooked: maxStreak > 6,
        isHeavy: worked > 22,
        emp
      };
    }).sort((a, b) => b.worked - a.worked);
  }, [employees, daysInMonth, getEffectiveShift, monthKey, holidaySet]);

  const bottlenecks = useMemo(() => {
    return dailyCoverage.filter(c => c.total < 6);
  }, [dailyCoverage]);

  const selectedEmployee = useMemo(() => 
    employeeStats.find(s => s.id === selectedEmpId), [employeeStats, selectedEmpId]
  );

  // ── Render Helpers ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full animate-fade-in transition-colors bg-white dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-950 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col flex-1">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10 transition-colors no-print">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 dark:bg-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none">
               <Icon name="insights" className="text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={onClose}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mr-1"
                >
                  <Icon name="arrow_back" />
                </button>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Análise de Escala & Gargalos</h2>
              </div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1">
                Visualização de Sobrecarga e Cobertura Operacional • {(currentMY.month + 1).toString().padStart(2, '0')}/{currentMY.year}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex gap-1">
                {viewMode === 'team-calendar' && (
                  <button 
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-sm mr-2"
                  >
                    <Icon name="print" className="text-sm" /> Imprimir
                  </button>
                )}
                <button 
                  onClick={() => setViewMode('insights')}
                  className={`px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${viewMode === 'insights' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-orange-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  <Icon name="analytics" className="text-sm" /> Insights
                </button>
                <button 
                  onClick={() => setViewMode('team-calendar')}
                  className={`px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${viewMode === 'team-calendar' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-orange-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  <Icon name="calendar_view_month" className="text-sm" /> Escala Geral
                </button>
             </div>
             <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors order-last ml-2">
               <Icon name="close" className="text-slate-400 dark:text-slate-500" />
             </button>
          </div>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar transition-colors">
          
          {viewMode === 'insights' ? (
            <div className="space-y-8 animate-fade-in">
              
              {/* Key Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <InsightCard 
                  label="Horas Mensais" 
                  description="Total de horas CLT"
                  value={employeeStats.reduce((acc, s) => acc + s.totalHours, 0).toLocaleString('pt-BR') + 'h'} 
                  icon="schedule" color="indigo" 
                />
                <InsightCard 
                  label="Dias Críticos" 
                  description="Abaixo de 6 pessoas"
                  value={bottlenecks.length.toString()} 
                  icon="warning" color="rose"
                  urgent={bottlenecks.length > 0}
                />
                <InsightCard 
                  label="Justiça de Escala" 
                  description="Média de Domingos"
                  value={(employeeStats.reduce((acc, s) => acc + s.sundaysWorked, 0) / employeeStats.length).toFixed(1)} 
                  icon="balance" color="amber" 
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
                <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-6">
                  <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm h-full flex flex-col transition-colors">
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
                                getEffectiveShift={getEffectiveShift}
                            />
                        )}
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                            <p className="text-[10px] font-black text-indigo-400 dark:text-indigo-400 uppercase">Horas Estimadas</p>
                            <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{selectedEmployee?.totalHours}h</p>
                            <p className="text-[9px] font-bold text-indigo-400 dark:text-indigo-500">Mês completo ({selectedEmployee?.worked}d)</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                            <p className="text-[10px] font-black text-amber-500 dark:text-amber-500 uppercase">Domingos/Feriados</p>
                            <p className="text-2xl font-black text-amber-700 dark:text-amber-400">{selectedEmployee?.sundaysWorked}D / {selectedEmployee?.holidaysWorked}F</p>
                            <p className="text-[9px] font-bold text-amber-500 dark:text-amber-600">Presença em dias premium</p>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                            <p className="text-[10px] font-black text-rose-400 dark:text-rose-400 uppercase">Folgas Extras</p>
                            <p className="text-2xl font-black text-rose-600 dark:text-rose-400">+{selectedEmployee?.extraOffs}d</p>
                            <p className="text-[9px] font-bold text-rose-400 dark:text-rose-500">Além do mínimo legal</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Maior Sequência</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{selectedEmployee?.maxStreak}d</p>
                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{selectedEmployee?.overlooked ? '⚠️ Excede limite legal' : 'Dentro do limite'}</p>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Middle/Right: Overload Ranking with Click Interaction */}
                <div className="lg:col-span-12 xl:col-span-7 flex flex-col gap-6">
                   <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm flex flex-col max-h-[600px] transition-colors">
                        <div className="mb-6">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Ranking de Escala</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Clique no colaborador para ver o calendário individual</p>
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
                                        <p className={`text-xs font-black uppercase truncate ${selectedEmpId === s.id ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                                            {s.name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${selectedEmpId === s.id ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-800'}`}>
                                                <div className={`h-full rounded-full ${s.isHeavy ? 'bg-rose-400' : 'bg-indigo-400 dark:bg-indigo-500'}`} style={{ width: `${(s.worked / daysInMonth) * 100}%` }}></div>
                                            </div>
                                            <span className={`text-[9px] font-black shrink-0 ${selectedEmpId === s.id ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {s.worked}d • {s.sundaysWorked}D
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
                   <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm transition-colors">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Mapa de Cobertura Geral</h3>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 dark:text-slate-500">
                                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm"></span> OK
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 dark:text-slate-500">
                                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></span> Crítico
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {dailyCoverage.map(c => (
                                <div 
                                    key={c.day}
                                    className={`w-8 h-8 flex flex-col items-center justify-center rounded-lg border text-[9px] font-black transition-all ${
                                        c.total < 6 ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400' : 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
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
            <div id="printable-team-calendar" className="h-full animate-fade-in bg-white dark:bg-slate-950 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-auto transition-colors print:p-0 print:border-none print:shadow-none">
               <TeamMonthlyCalendar 
                 employees={employees} 
                 currentMY={currentMY} 
                 customHolidays={customHolidays} 
                 getEffectiveShift={getEffectiveShift}
               />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between sticky bottom-0 transition-colors no-print">
           <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Insights Operacionais Mensal • Ri Happy Dashboard v2.0</p>
           <button 
             onClick={onClose} 
             className="px-10 py-3 bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black rounded-2xl hover:bg-indigo-600 dark:hover:bg-white transition-all shadow-xl active:scale-95"
           >
             Sair da Análise
           </button>
        </div>
      </div>
    </div>
  );
};

 const InsightCard: React.FC<{ label: string, value: string, icon: any, color: any, description: string, urgent?: boolean }> = ({ label, value, icon, color, description, urgent }) => (
  <div className={`bg-white dark:bg-slate-900 border rounded-3xl p-6 shadow-sm flex items-center gap-5 transition-all hover:translate-y-[-4px] hover:shadow-md ${urgent ? 'border-rose-300 dark:border-rose-900 ring-2 ring-rose-50 dark:ring-rose-900/20' : 'border-slate-100 dark:border-slate-800'}`}>
     <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
       color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 
       color === 'rose' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 
       color === 'amber' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
     }`}>
        <Icon name={icon} className="text-xl" />
     </div>
     <div className="min-w-0">
        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">{label}</p>
        <h4 className={`text-xl font-black ${urgent ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'} leading-none`}>{value}</h4>
        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate">{description}</p>
     </div>
  </div>
);

const IndividualWeeklyCalendar: React.FC<{ 
    employee: Employee, 
    currentMY: MonthYear, 
    customHolidays: Holiday[],
    getEffectiveShift: (emp: Employee, dayIdx: number) => ShiftType
}> = ({ employee, currentMY, customHolidays, getEffectiveShift }) => {
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
        const shift = getEffectiveShift(employee, i - 1);
        const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        // Ausência é qualquer coisa que não seja T. 
        // Mas para visualização de "Folga" no calendário individual, ignoramos o Curso (que é externo)
        const isOff = shift !== 'T' && shift !== 'C'; 
        const isCourse = shift === 'C';
        const isVacation = shift === 'FE';
        const isHoliday = holidaySet.has(dateStr);
        const hours = (employee.dailyHours[monthKey] || [])[i - 1] || employee.workPeriod;
        calendarDays.push({ type: 'day', day: i, shift, isOff, isCourse, isVacation, isHoliday, hours });
    }

    return (
        <div className="w-full">
            <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAY_NAMES.map(wd => (
                    <div key={wd} className="text-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
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
                            title={cell.isVacation ? 'Férias' : (cell.shift as string)}
                            className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all relative ${
                                cell.shift === 'T' 
                                ? 'bg-indigo-600 dark:bg-indigo-700 border-indigo-700 dark:border-indigo-800 text-white shadow-sm' 
                                : cell.isCourse
                                ? 'bg-teal-500 dark:bg-teal-600 border-teal-600 dark:border-teal-700 text-white shadow-sm'
                                : cell.isVacation
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
                                : cell.isHoliday ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400' 
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600'
                            }`}
                        >
                            <span className={`text-[8px] font-black absolute top-1 left-1 ${cell.shift === 'T' || cell.isCourse ? 'text-white/80' : 'text-slate-500'}`}>{cell.day}</span>
                            <span className={`text-[11px] font-black mt-1 ${cell.isOff && !cell.isVacation ? 'opacity-30' : ''}`}>
                                {cell.shift === 'T' ? shiftLabel : cell.isCourse ? 'C' : cell.isVacation ? 'FE' : 'F'}
                            </span>
                            {!cell.isOff && (
                              <span className="text-[7px] font-bold opacity-80 mt-0.5 tracking-tighter">
                                {cell.hours.split(' ')[0]}
                              </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const TeamMonthlyCalendar: React.FC<{ 
    employees: Employee[], 
    currentMY: MonthYear, 
    customHolidays: Holiday[],
    getEffectiveShift: (emp: Employee, dayIdx: number) => ShiftType
}> = ({ employees, currentMY, customHolidays, getEffectiveShift }) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;

  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ type: 'empty' });
  for (let i = 1; i <= daysInMonth; i++) {
    const workingDayData = employees.filter(e => !e.isHidden && e.status === 'active').map(emp => {
      const shift = getEffectiveShift(emp, i - 1);
      const hours = (emp.dailyHours[monthKey] || [])[i - 1] || emp.workPeriod;
      const isOff = shift !== 'T' && shift !== 'C';
      return { 
        name: emp.name.split(' ')[0], 
        shift, 
        hours, 
        isOff, 
        isCourse: shift === 'C',
        isVacation: shift === 'FE'
      };
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
          <div key={idx} className={`min-h-[160px] rounded-[2rem] border p-5 flex flex-col gap-1.5 transition-all ${cell.type === 'empty' ? 'border-transparent' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
            {cell.type === 'day' && (
              <>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500">{cell.date}</span>
                  <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter">
                    {WEEKDAY_NAMES[new Date(currentMY.year, currentMY.month, cell.date).getDay()].split('-')[0]}
                  </span>
                </div>
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
