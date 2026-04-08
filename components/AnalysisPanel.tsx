import React, { useMemo, useState } from 'react';
import { Employee, MonthYear, Holiday, ShiftType } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet, getNationalHolidays } from '../constants';

interface AnalysisPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onClose: () => void;
  isEditable: boolean;
  isGridLocked: boolean;
  onUpdateShift: (empId: string, dayIdx: number, newShift: ShiftType) => void;
}

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ 
  employees, currentMY, customHolidays, onClose, isEditable, isGridLocked, onUpdateShift 
}) => {
  const [viewMode, setViewMode] = useState<'insights' | 'team-calendar'>('insights');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
  
  const getEffectiveShift = (emp: Employee, dayIdx: number) => {
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    
    if (emp.vacationStart) {
      const start = emp.vacationStart;
      const end = emp.vacationEnd || addDays(start, 30);
      if (dateStr >= start && dateStr <= end) return 'FE';
    }

    if (emp.birthday) {
      const empMD = emp.birthday.length > 5 ? emp.birthday.substring(5) : emp.birthday;
      const dateMD = dateStr.substring(5);
      if (empMD === dateMD) return 'F';
    }

    const monthShifts = emp.shifts[monthKey] || [];
    return monthShifts[dayIdx] || 'F';
  };

  function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  const dailyCoverage = useMemo(() => {
    const nationals = getNationalHolidays(currentMY.year);
    const coverage = [];
    for (let d = 0; d < daysInMonth; d++) {
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
      const activeEmps = employees.filter(e => !e.isHidden && e.status === 'active');
      const working = activeEmps.filter(e => {
        const s = getEffectiveShift(e, d);
        return s === 'T' || s === 'C';
      });

      const isHoliday = holidaySet.has(dateStr);
      let holidayName = null;
      if (isHoliday) {
         const h = [...customHolidays].find(h => {
             if (!h.date) return false;
             if (h.date.length === 5) return h.date === dateStr.substring(5);
             return h.date === dateStr;
         });
         holidayName = h?.name || 'Feriado';
      }

      coverage.push({
        day: d + 1,
        total: working.length,
        isSunday: new Date(currentMY.year, currentMY.month, d + 1).getDay() === 0,
        isHoliday,
        holidayName
      });
    }
    return coverage;
  }, [employees, daysInMonth, currentMY, holidaySet, customHolidays, getEffectiveShift]);


  const employeeStats = useMemo(() => {
    let sundaysInMonth = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(currentMY.year, currentMY.month, d).getDay() === 0) sundaysInMonth++;
    }
    const theoreticalMaxDays = daysInMonth - sundaysInMonth;
    const theoreticalMaxHours = Math.round(theoreticalMaxDays * 7.33);
    
    return employees.filter(e => !e.isHidden && e.status === 'active').map(emp => {
      let worked = 0;
      let workedHours = 0;
      let maxStreak = 0;
      let currentStreak = 0;
      let sundaysWorked = 0;
      let holidaysWorked = 0;
      let vacationDays = 0;
      let compensatoriaDays = 0;

      for (let d = 0; d < daysInMonth; d++) {
        const s = getEffectiveShift(emp, d);
        const date = new Date(currentMY.year, currentMY.month, d + 1);
        const isSun = date.getDay() === 0;
        const isHol = holidaySet.has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`);

        if (s === 'T' || s === 'C') {
          worked++;
          currentStreak++;
          if (currentStreak > maxStreak) maxStreak = currentStreak;
          if (isSun) sundaysWorked++;
          if (isHol) holidaysWorked++;
          workedHours += 7.33; 
        } else {
          currentStreak = 0;
          if (s === 'FE') vacationDays++;
          if (s && (s as string).startsWith('FF')) compensatoriaDays++;
        }
      }

      return {
        id: emp.id,
        name: emp.name,
        worked,
        totalHours: Math.round(workedHours),
        theoreticalMaxDays,
        theoreticalMaxHours,
        maxStreak,
        sundaysWorked,
        holidaysWorked,
        vacationDays,
        compensatoriaDays,
        overlooked: maxStreak > 6,
        isHeavy: worked > 22,
        emp
      };
    }).sort((a, b) => b.worked - a.worked);
  }, [employees, daysInMonth, getEffectiveShift, monthKey, holidaySet, currentMY]);

  const bottlenecks = useMemo(() => {
    return dailyCoverage.filter(c => c.total < 6);
  }, [dailyCoverage]);

  const selectedEmployee = useMemo(() => 
    employeeStats.find(s => s.id === selectedEmpId), [employeeStats, selectedEmpId]
  );

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
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Escala de Revezamento 6 por 1</h2>
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

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar transition-colors">
          {viewMode === 'insights' ? (
            <div className="space-y-12 animate-fade-in pb-12">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-10 shadow-sm transition-colors">
                  <div className="flex items-center justify-between mb-8">
                      <div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">ESCALA DE REVEZAMENTO 6 POR 1</h3>
                          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">Visão panorâmica de presença em loja por dia do mês</p>
                      </div>
                      <div className="flex gap-6">
                          <div className="flex items-center gap-2 text-[10px] font-black text-slate-500">
                              <span className="w-3 h-3 bg-indigo-500 rounded-md"></span> <span className="opacity-60">Ideal (≥6)</span>
                          </div>
                      </div>
                  </div>
                  <div className="grid grid-cols-5 md:grid-cols-7 lg:grid-cols-10 xl:grid-cols-11 gap-3">
                      {dailyCoverage.map(c => (
                          <div 
                              key={c.day}
                              title={c.isHoliday ? c.holidayName : (c.isSunday ? 'Domingo' : '')}
                              className={`aspect-square flex flex-col items-center justify-center rounded-2xl border transition-all hover:scale-[1.05] group ${
                                  c.total < 6 
                                  ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-900/50' 
                                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                              }`}
                          >
                              <span className={`text-[9px] font-black uppercase opacity-40 mb-1 ${c.total < 6 ? 'text-rose-600' : 'text-slate-400'}`}>Dia {c.day}</span>
                              <span className={`text-xl font-black ${
                                  c.total < 6 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'
                              }`}>
                                  {c.total}
                              </span>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-10 shadow-sm flex flex-col transition-colors">
                  <div className="mb-10 flex justify-between items-end">
                      <div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Estatísticas da Equipe</h3>
                          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">Dias trabalhados vs. Dias disponíveis (Exclui Férias e Compensatórias)</p>
                      </div>
                  </div>

                  <div className="space-y-6">
                      {employeeStats.map((s, idx) => {
                          const possibleDays = daysInMonth - (s.vacationDays || 0) - (s.compensatoriaDays || 0);
                          const perc = Math.min(100, Math.round((s.worked / (possibleDays || 1)) * 100));
                          
                          return (
                              <button 
                                  key={s.id} 
                                  onClick={() => setSelectedEmpId(s.id)}
                                  className="w-full group text-left outline-none"
                              >
                                  <div className="flex items-center justify-between mb-2 px-1">
                                      <div className="flex items-center gap-3">
                                          <span className="text-[10px] font-black text-slate-300 group-hover:text-indigo-500 transition-colors">#{idx + 1}</span>
                                          <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase group-hover:text-indigo-600 transition-colors tracking-tight">{s.name}</span>
                                          {s.overlooked && (
                                              <span className="bg-rose-50 dark:bg-rose-900/30 text-rose-500 text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse">6x1!</span>
                                          )}
                                      </div>
                                      <div className="flex items-center gap-4">
                                          <div className="flex flex-col items-end">
                                              <span className="text-xs font-black text-slate-900 dark:text-white">{s.worked} / {possibleDays}d</span>
                                              <span className="text-[8px] font-bold text-slate-400 uppercase">Trabalhados</span>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="relative h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-50 dark:border-slate-700/50 group-hover:border-indigo-100 transition-all">
                                      <div 
                                          className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out rounded-full ${
                                              s.isHeavy ? 'bg-gradient-to-r from-rose-400 to-rose-600' : 'bg-gradient-to-r from-indigo-500 to-indigo-700'
                                          }`} 
                                          style={{ width: `${perc}%` }}
                                      >
                                          {perc > 10 && (
                                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-white/90">{perc}%</span>
                                          )}
                                      </div>
                                  </div>
                              </button>
                          );
                      })}
                  </div>
              </div>

              {bottlenecks.length > 0 && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-[2.5rem] p-10 mt-12">
                   <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
                         <Icon name="priority_high" className="text-2xl" />
                      </div>
                      <div>
                         <h3 className="text-xl font-black text-rose-900 dark:text-rose-400 uppercase tracking-tight">Dias de Alerta Operacional</h3>
                         <p className="text-xs font-bold text-rose-700 dark:text-rose-500">Mínimo de 6 pessoas não atingido nas seguintes datas:</p>
                      </div>
                   </div>
                   <div className="flex flex-wrap gap-4">
                      {bottlenecks.map(b => (
                        <div key={b.day} className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 px-6 py-3 rounded-2xl shadow-sm">
                           <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-rose-500 leading-none">{WEEKDAY_NAMES[new Date(currentMY.year, currentMY.month, b.day).getDay()].substring(0, 3)}</span>
                              <span className="text-xl font-black text-slate-900 dark:text-white leading-none mt-1">{b.day}</span>
                           </div>
                           <div className="h-8 w-px bg-rose-100 dark:bg-rose-900 mx-1"></div>
                           <p className="text-md font-black text-rose-600 dark:text-rose-400">{b.total} CLT's</p>
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
                 isEditable={isEditable}
                 isGridLocked={isGridLocked}
                 onUpdateShift={onUpdateShift}
               />
            </div>
          )}
        </div>

        {selectedEmpId && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in no-print">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800">
                    <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl font-black">
                                {selectedEmployee?.name.charAt(0)}
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{selectedEmployee?.name}</h4>
                            </div>
                        </div>
                        <button onClick={() => setSelectedEmpId(null)} className="p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all text-slate-400 dark:text-slate-500">
                           <Icon name="close" className="text-xl" />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-10 custom-scrollbar grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-12 xl:col-span-7">
                            <IndividualWeeklyCalendar 
                                employee={selectedEmployee!.emp} 
                                currentMY={currentMY} 
                                customHolidays={customHolidays}
                                getEffectiveShift={getEffectiveShift}
                                isEditable={isEditable}
                                isGridLocked={isGridLocked}
                                onUpdateShift={onUpdateShift}
                            />
                        </div>
                        
                        <div className="lg:col-span-12 xl:col-span-5 grid grid-cols-2 gap-5 content-start">
                            <InsightDetailCard label="Jornada Mensal" value={`${selectedEmployee?.totalHours}h`} sub={`${selectedEmployee?.theoreticalMaxHours}h ideal`} color="indigo" icon="timer" />
                            <InsightDetailCard label="Trabalhados" value={`${selectedEmployee?.worked}d`} sub={`${daysInMonth - (selectedEmployee?.vacationDays || 0) - (selectedEmployee?.compensatoriaDays || 0)}d possíveis`} color="emerald" icon="done_all" />
                            <InsightDetailCard label="Semana Premium" value={`${selectedEmployee?.sundaysWorked}D / ${selectedEmployee?.holidaysWorked}F`} sub="Domingos e Feriados" color="amber" icon="star" />
                            <InsightDetailCard label="Série Máxima" value={`${selectedEmployee?.maxStreak}d`} sub={selectedEmployee?.overlooked ? '⚠️ Reduzir Sequência' : 'Sequência OK'} color={selectedEmployee?.overlooked ? 'rose' : 'sky'} icon="trending_up" />
                            <InsightDetailCard label="Ausências" value={`${(selectedEmployee?.vacationDays || 0) + (selectedEmployee?.compensatoriaDays || 0)}d`} sub="Férias e Compensatórias" color="slate" icon="event_busy" />
                        </div>
                    </div>
                    
                    <div className="px-10 py-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <button onClick={() => setSelectedEmpId(null)} className="px-8 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[10px] font-black uppercase rounded-2xl hover:bg-slate-50 transition-all">Fechar Detalhes</button>
                    </div>
                </div>
            </div>
        )}

        {/* Footer */}
        <div className="px-10 py-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between sticky bottom-0 transition-colors no-print">
           <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Escala de Revezamento 6 por 1 • Ri Happy</p>
           <button onClick={onClose} className="px-10 py-3 bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black rounded-2xl hover:bg-indigo-600 dark:hover:bg-white transition-all shadow-xl active:scale-95">
             Sair da Análise
           </button>
        </div>
      </div>
    </div>
  );
};

const InsightDetailCard: React.FC<{ label: string, value: string, sub: string, color: string, icon: string }> = ({ label, value, sub, color, icon }) => (
    <div className={`p-6 rounded-3xl border ${
        color === 'indigo' ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-900/50' :
        color === 'emerald' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/50' :
        color === 'amber' ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/50' :
        color === 'rose' ? 'bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/50' :
        color === 'sky' ? 'bg-sky-50 border-sky-100 dark:bg-sky-900/20 dark:border-sky-900/50' :
        'bg-slate-50 border-slate-200 dark:bg-slate-800/30'
    }`}>
        <div className="flex items-center gap-2 mb-3">
            <Icon name={icon} className={`text-sm ${
                color === 'indigo' ? 'text-indigo-600' :
                color === 'rose' ? 'text-rose-600' :
                color === 'amber' ? 'text-amber-600' :
                'text-slate-500'
            }`} />
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</span>
        </div>
        <p className={`text-xl font-black ${
            color === 'indigo' ? 'text-indigo-800 dark:text-indigo-300' :
            color === 'emerald' ? 'text-emerald-800 dark:text-emerald-400' :
            color === 'amber' ? 'text-amber-800 dark:text-amber-400' :
            color === 'rose' ? 'text-rose-800 dark:text-rose-400' :
            'text-slate-900 dark:text-white'
        }`}>{value}</p>
        <p className="text-[8px] font-bold text-slate-500 dark:text-slate-500 mt-0.5">{sub}</p>
    </div>
);

const IndividualWeeklyCalendar: React.FC<{ 
    employee: Employee, 
    currentMY: MonthYear, 
    customHolidays: Holiday[],
    getEffectiveShift: (emp: Employee, dayIdx: number) => ShiftType,
    isEditable: boolean,
    isGridLocked: boolean,
    onUpdateShift: (empId: string, dayIdx: number, newShift: ShiftType) => void
}> = ({ employee, currentMY, customHolidays, getEffectiveShift, isEditable, isGridLocked, onUpdateShift }) => {
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
    const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
    const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

    const calendarDays = [];
    for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push({ type: 'empty' });
    for (let i = 1; i <= daysInMonth; i++) {
        const shift = getEffectiveShift(employee, i - 1);
        const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
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
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(wd => (
                    <div key={wd} className="text-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{wd}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((cell, idx) => {
                    if (cell.type === 'empty') return <div key={idx} className="aspect-square"></div>;
                    const shiftLabel = (cell.shift as string)?.split(' ')[0] || '-';
                    const isFF = (cell.shift as string).startsWith('FF');
                    const ffLabel = isFF ? (cell.shift as string).replace(' ', '').split('/')[0] : 'F';

                    return (
                        <div key={idx} className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all relative ${
                                cell.shift === 'T' ? 'bg-emerald-600 border-emerald-700 text-white' : 
                                cell.isCourse ? 'bg-blue-600 border-blue-700 text-white' :
                                cell.isVacation ? 'bg-slate-400 border-slate-500 text-white opacity-60' :
                                isFF ? 'bg-rose-600 border-rose-700 text-white' : 
                                cell.isHoliday ? 'bg-slate-800 border-slate-700 text-white/50' :
                                'bg-slate-900 border-slate-800 text-white'
                            }`}
                        >
                            <span className="text-[8px] font-black absolute top-1 left-1 opacity-60">{cell.day}</span>
                            <span className="text-[11px] font-black mt-1">
                                {cell.shift === 'T' ? shiftLabel : cell.isCourse ? 'C' : cell.isVacation ? 'FE' : ffLabel}
                            </span>
                            {isEditable && !isGridLocked && cell.shift !== 'FE' && (
                                <select 
                                    value={isFF ? 'FF' : cell.shift}
                                    onChange={(e) => onUpdateShift(employee.id, (cell.day as number) - 1, e.target.value as ShiftType)}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                                >
                                    <option value="T">T</option>
                                    <option value="F">F</option>
                                    <option value="C">C</option>
                                    <option value="FF">FF</option>
                                    <option value="FE">FE</option>
                                </select>
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
    getEffectiveShift: (emp: Employee, dayIdx: number) => ShiftType,
    isEditable: boolean,
    isGridLocked: boolean,
    onUpdateShift: (empId: string, dayIdx: number, newShift: ShiftType) => void
}> = ({ employees, currentMY, customHolidays, getEffectiveShift, isEditable, isGridLocked, onUpdateShift }) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;

  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ type: 'empty' });
  const sortedEmployees = [...employees]
    .filter(e => !e.isHidden && e.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  for (let i = 1; i <= daysInMonth; i++) {
    const workingDayData = sortedEmployees.map(emp => {
      const shift = getEffectiveShift(emp, i - 1);
      const hours = (emp.dailyHours[monthKey] || [])[i - 1] || emp.workPeriod;
      const isOff = shift !== 'T' && shift !== 'C';
      const isFF = (shift as string).startsWith('FF');
      return { 
        name: emp.name.split(' ')[0], 
        shift, 
        hours, 
        isOff: isOff && !isFF, 
        isCourse: shift === 'C',
        isVacation: shift === 'FE',
        isFF,
        id: emp.id
      };
    }).filter(d => !d.isOff || d.isCourse || d.isFF); 
    cells.push({ type: 'day', date: i, dayData: workingDayData });
  }

  return (
    <div className="w-full print:px-2">
      <div className="grid grid-cols-7 gap-4 mb-4">
        {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(wd => (
          <div key={wd} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{wd}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-4">
        {cells.map((cell, idx) => (
          <div key={idx} className={`min-h-[160px] rounded-[2rem] border p-5 flex flex-col gap-1.5 ${cell.type === 'empty' ? 'border-transparent' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
            {cell.type === 'day' && (
              <>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-black text-slate-400">{cell.date}</span>
                </div>
                <div className="space-y-1.5">
                  {cell.dayData.map((d, i) => {
                    const isFF = d.isFF;
                    const displayShift = isFF ? (d.shift as string).replace(' ', '').split('/')[0] : (d.isCourse ? 'C' : d.hours.split(' ')[0]);
                    return (
                      <div key={i} className={`flex items-center justify-between gap-1 p-2 rounded-xl border relative ${d.isCourse ? 'bg-blue-600 text-white' : isFF ? 'bg-rose-600 text-white' : 'bg-slate-50 text-slate-800'}`}>
                         <span className="text-[9px] font-black uppercase truncate">{d.name}</span>
                         <span className="text-[8px] font-bold shrink-0">{displayShift}</span>
                         {isEditable && !isGridLocked && d.shift !== 'FE' && (
                             <select 
                                value={isFF ? 'FF' : d.shift}
                                onChange={(e) => onUpdateShift(d.id, cell.date - 1, e.target.value as ShiftType)}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                             >
                                <option value="T">T</option><option value="F">F</option><option value="C">C</option><option value="FF">FF</option><option value="FE">FE</option>
                             </select>
                         )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
