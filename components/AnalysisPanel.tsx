import React, { useMemo, useState } from 'react';
import { Employee, MonthYear, Holiday, ShiftType, JornadaSettings } from '../types';
import { getShiftClassification, isWorkingShift } from '../hooks/useScheduleEngine';

import { Icon } from './Icon';
import { buildHolidaySet, SHIFT_HOURS, DEFAULT_JORNADA_SETTINGS, getShortName } from '../constants';
import { toPng } from 'html-to-image';


interface AnalysisPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onClose: () => void;
  onUpdateShift?: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateHour?: (empId: string, dayIdx: number, newHour: string) => void;
  jornadaSettings?: JornadaSettings;
}

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ employees, currentMY, customHolidays, onClose, onUpdateShift, onUpdateHour, jornadaSettings }) => {
  const [viewMode, setViewMode] = useState<'insights' | 'team-calendar'>('insights');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(employees.filter(e => !e.isHidden && e.status === 'active')[0]?.id || null);
  const [showIndividualModal, setShowIndividualModal] = useState(false);
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);
  
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
  
  const getEffectiveShift = (emp: Employee, dayIdx: number) => {
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    
    // Check if employee is on vacation
    if (emp.vacationStart) {
      const start = emp.vacationStart;
      // If no vacationEnd, assume 30 days including start day (so start + 29 days)
      const end = emp.vacationEnd || addDays(start, 29);
      if (dateStr >= start && dateStr <= end) return 'FE';
    }

    // Check if it's their birthday
    if (emp.birthday) {
      const empMD = emp.birthday.length > 5 ? emp.birthday.substring(5) : emp.birthday;
      const dateMD = dateStr.substring(5);
      if (empMD === dateMD) return 'DO';
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
        return isWorkingShift(s); // Conta como presença na LOJA
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
    // Standard workable days = Days in month - 1 mandatory leave per week (approx Sundays)
    const sundaysCount = dailyCoverage.filter(d => d.isSunday).length;
    const baseWorkableDays = daysInMonth - sundaysCount;
    
    return employees.filter(e => !e.isHidden && e.status === 'active').map(emp => {
      let worked = 0;
      let totalHours = 0;
      let maxStreak = 0;
      let currentStreak = 0;
      let fullCycles = 0;
      let sundaysWorked = 0;
      let holidaysWorked = 0;
      let vacationDays = 0;
      let ffDays = 0;
      let courseDays = 0;

      for (let d = 0; d < daysInMonth; d++) {
        const s = getEffectiveShift(emp, d);
        const dayType = new Date(currentMY.year, currentMY.month, d + 1).getDay();
        const isSun = dayType === 0;
        const isHol = holidaySet.has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`);
        const settings = jornadaSettings || DEFAULT_JORNADA_SETTINGS;

        if (isWorkingShift(s)) {
          worked++;

          currentStreak++;
          if (currentStreak > maxStreak) maxStreak = currentStreak;
          if (currentStreak === 6) fullCycles++;
          if (isSun) sundaysWorked++;
          if (isHol) holidaysWorked++;
          totalHours += 7.33; 
        } else {
          currentStreak = 0;
          if (s === 'FE') vacationDays++;
          else if (s?.startsWith('FF')) ffDays++;
          else if (s === 'C') courseDays++;
        }
      }

      // Adherence logic: Workable days for THIS employee
      // Base - Vacations - FF - Course
      const workableForEmp = Math.max(0, baseWorkableDays - vacationDays - ffDays - courseDays);
      const extraOffs = Math.max(0, workableForEmp - worked);
      const adherence = workableForEmp > 0 ? (worked / workableForEmp) * 100 : 0;

      return {
        id: emp.id,
        name: emp.name,
        worked,
        totalHours: Math.round(totalHours),
        theoreticalMax: workableForEmp,
        extraOffs,
        adherence,
        fullCycles,
        maxStreak,
        sundaysWorked,
        holidaysWorked,
        overlooked: maxStreak > 6,
        isHeavy: adherence > 100, // Worked more than scheduled
        emp
      };
    }).sort((a, b) => b.adherence - a.adherence);
  }, [employees, daysInMonth, getEffectiveShift, monthKey, holidaySet, dailyCoverage, currentMY]);

  const bottlenecks = useMemo(() => {
    return dailyCoverage.filter(c => c.total < 6);
  }, [dailyCoverage]);

  const selectedEmployee = useMemo(() => 
    employeeStats.find(s => s.id === selectedEmpId), [employeeStats, selectedEmpId]
  );

  // ── Render Helpers ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full animate-fade-in transition-colors bg-white ">
      <div className="bg-white  rounded-[2rem] border border-slate-200  shadow-sm overflow-hidden flex flex-col flex-1">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100  flex items-center justify-between bg-white  sticky top-0 z-10 transition-colors no-print">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600  text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 ">
               <Icon name="insights" className="text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={onClose}
                  className="p-1 hover:bg-slate-100  rounded-lg text-slate-400  hover:text-indigo-600  transition-colors mr-1"
                >
                  <Icon name="arrow_back" />
                </button>
                <h2 className="text-2xl font-black text-slate-900  tracking-tight">Análise de Escala & Gargalos</h2>
              </div>
              <p className="text-[10px] font-black text-slate-400  uppercase tracking-widest leading-none mt-1">
                Visualização de Sobrecarga e Cobertura Operacional • {(currentMY.month + 1).toString().padStart(2, '0')}/{currentMY.year}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {showIndividualModal && selectedEmployee && (
               <IndividualEditModal
                 employee={selectedEmployee.emp}
                 currentMY={currentMY}
                 customHolidays={customHolidays}
                 getEffectiveShift={getEffectiveShift}
                 onUpdateShift={onUpdateShift}
                 onUpdateHour={onUpdateHour}
                 onClose={() => setShowIndividualModal(false)}
               />
             )}
             <div className="bg-slate-100  p-1 rounded-2xl flex gap-1">
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
             <button onClick={onClose} className="p-2.5 hover:bg-slate-100  rounded-full transition-colors order-last ml-2">
               <Icon name="close" className="text-slate-400 " />
             </button>
          </div>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50  custom-scrollbar transition-colors">
          
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
                  <div className="bg-white  rounded-[2rem] border border-slate-200  p-8 shadow-sm h-full flex flex-col transition-colors">
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
                        {selectedEmployee && (
                          <button
                            onClick={async () => {
                              const el = document.getElementById('individual-calendar-capture');
                              if (el) {
                                // Add some padding/background for the screenshot
                                const dataUrl = await toPng(el, { 
                                  backgroundColor: '#ffffff',
                                  pixelRatio: 2,
                                  style: { 
                                    padding: '20px', 
                                    borderRadius: '32px',
                                    transform: 'scale(0.9)',
                                    transformOrigin: 'center'
                                  }
                                });
                                const link = document.createElement('a');
                                link.download = `escala-${selectedEmployee.name.toLowerCase().replace(/\s+/g, '-')}.png`;
                                link.href = dataUrl;
                                link.click();
                              }
                            }}
                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center ml-2"
                            title="Baixar Calendário"
                          >
                            <Icon name="download" className="text-sm" />
                          </button>
                        )}
                    </div>

                    <div className="flex-1">
                        <div id="individual-calendar-capture" className="bg-white p-4 rounded-3xl">
                          <div className="mb-4 text-center border-b border-slate-100 pb-4">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Escala Individual</p>
                              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{selectedEmployee?.name}</h3>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{(currentMY.month + 1).toString().padStart(2, '0')}/{currentMY.year}</p>
                          </div>
                        {selectedEmployee && (
                            <IndividualWeeklyCalendar 
                                employee={selectedEmployee.emp} 
                                currentMY={currentMY} 
                                customHolidays={customHolidays}
                                getEffectiveShift={getEffectiveShift}
                                onUpdateShift={onUpdateShift}
                            />
                        )}
                        </div>
                        {!selectedEmployee && (
                          <div className="flex items-center justify-center h-40 text-slate-300">
                            <p className="text-sm font-bold">Selecione um colaborador no ranking →</p>
                          </div>
                        )}
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4 pt-6 border-t border-slate-100 ">
                        <div className="bg-indigo-50  p-4 rounded-2xl border border-indigo-100 ">
                            <p className="text-[10px] font-black text-indigo-400  uppercase">Horas Estimadas</p>
                            <p className="text-2xl font-black text-indigo-700 ">{selectedEmployee?.totalHours}h</p>
                            <p className="text-[9px] font-bold text-indigo-400 ">Mês completo ({selectedEmployee?.worked}d)</p>
                        </div>
                        <div className="bg-amber-50  p-4 rounded-2xl border border-amber-100 ">
                            <p className="text-[10px] font-black text-amber-500  uppercase">Domingos/Feriados</p>
                            <p className="text-2xl font-black text-amber-700 ">{selectedEmployee?.sundaysWorked}D / {selectedEmployee?.holidaysWorked}F</p>
                            <p className="text-[9px] font-bold text-amber-500 ">Presença em dias premium</p>
                        </div>
                        <div className="bg-rose-50  p-4 rounded-2xl border border-rose-100 ">
                            <p className="text-[10px] font-black text-rose-400  uppercase">Aderência</p>
                            <p className="text-2xl font-black text-rose-600 ">{selectedEmployee?.adherence.toFixed(0)}%</p>
                            <p className="text-[9px] font-bold text-rose-400 ">Frente aos dias trabalháveis ({selectedEmployee?.theoreticalMax}d)</p>
                        </div>
                        <div className="bg-slate-50  p-4 rounded-2xl border border-slate-200 ">
                            <p className="text-[10px] font-black text-slate-400  uppercase">Maior Sequência</p>
                            <p className="text-2xl font-black text-slate-900 ">{selectedEmployee?.maxStreak}d</p>
                            <p className="text-[9px] font-bold text-slate-400 ">{selectedEmployee?.overlooked ? '⚠️ Excede limite legal' : 'Dentro do limite'}</p>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Middle/Right: Overload Ranking with Click Interaction */}
                <div className="lg:col-span-12 xl:col-span-7 flex flex-col gap-6">
                   <div className="bg-white  rounded-[2rem] border border-slate-200  p-8 shadow-sm flex flex-col max-h-[600px] transition-colors">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-black text-slate-800">Ranking de Escala</h3>
                              <p className="text-xs font-bold text-slate-400">Clique para ver o calendário individual</p>
                            </div>
                            {selectedEmployee && onUpdateShift && (
                              <button
                                onClick={() => setShowIndividualModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg hover:bg-indigo-700 transition-all"
                              >
                                <Icon name="edit" className="text-xs" /> Editar Escala
                              </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                            {employeeStats.map((s, idx) => (
                                <button 
                                    key={s.id} 
                                    onClick={() => { setSelectedEmpId(s.id); }}
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
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${selectedEmpId === s.id ? 'bg-white/20' : 'bg-slate-200'}`}>
                                                <div className={`h-full rounded-full ${s.isHeavy ? 'bg-rose-400' : 'bg-indigo-400'}`} style={{ width: `${(s.worked / daysInMonth) * 100}%` }}></div>
                                            </div>
                                            <span className={`text-[9px] font-black shrink-0 ${selectedEmpId === s.id ? 'text-white/80' : 'text-slate-500'}`}>
                                                {s.adherence.toFixed(0)}% • {s.worked}/{s.theoreticalMax}d
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
                   <div className="bg-white  rounded-[2rem] border border-slate-200  p-8 shadow-sm transition-colors">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-black text-slate-800  uppercase tracking-widest">Mapa de Cobertura Geral</h3>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 ">
                                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm"></span> OK
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 ">
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
            <div id="printable-team-calendar" className="h-full animate-fade-in bg-white  p-8 rounded-[2.5rem] border border-slate-200  shadow-sm overflow-auto transition-colors print:p-0 print:border-none print:shadow-none">
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
        <div className="px-10 py-6 bg-white  border-t border-slate-100  flex items-center justify-between sticky bottom-0 transition-colors no-print">
           <p className="text-[9px] font-black text-slate-400  uppercase tracking-[0.2em]">Insights Operacionais Mensal • Ri Happy Dashboard v2.0</p>
           <button 
             onClick={onClose} 
             className="px-10 py-3 bg-slate-950  text-white  text-xs font-black rounded-2xl hover:bg-indigo-600  transition-all shadow-xl active:scale-95"
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

const IndividualWeeklyCalendar: React.FC<{ 
    employee: Employee, 
    currentMY: MonthYear, 
    customHolidays: Holiday[],
    getEffectiveShift: (emp: Employee, dayIdx: number) => ShiftType,
    onUpdateShift?: (empId: string, dayIdx: number, newShift: ShiftType) => void
}> = ({ employee, currentMY, customHolidays, getEffectiveShift, onUpdateShift }) => {
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay(); // 0 is Sunday
    const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
    const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
    const canEdit = !!onUpdateShift;

    // Create a flat list of days including leading empty spaces for the first week
    const calendarDays: any[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push({ type: 'empty' });
    }
    for (let i = 1; i <= daysInMonth; i++) {
        const dayIdx = i - 1;
        const shift = getEffectiveShift(employee, dayIdx);
        const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const isOff = !isWorkingShift(shift) && shift !== 'C'; 
        const isCourse = shift === 'C';
        const isVacation = shift === 'FE';
        const isBirthday = shift === 'DO';
        const isHoliday = holidaySet.has(dateStr);
        const hours = (employee.dailyHours[monthKey] || [])[dayIdx] || employee.workPeriod;
        calendarDays.push({ type: 'day', day: i, dayIdx, shift, isOff, isCourse, isVacation, isBirthday, isHoliday, hours });
    }

    const shiftBg = (s: ShiftType) => {
        if (isWorkingShift(s)) return 'bg-indigo-600 border-indigo-700 text-white shadow-sm';
        if (s==='F') return 'bg-orange-50 border-orange-100 text-orange-600';
        if (s?.startsWith('FF')) return 'bg-red-50 border-red-100 text-red-600';
        if (s==='C') return 'bg-teal-500 border-teal-600 text-white shadow-sm';
        if (s==='FE') return 'bg-indigo-50 border-indigo-200 text-indigo-600';
        if (s==='DO') return 'bg-fuchsia-600 border-fuchsia-700 text-white shadow-sm';
        if (s==='AT') return 'bg-rose-50 border-rose-200 text-rose-600';
        return 'bg-slate-50 border-slate-100 text-slate-400';
    };

    return (
        <div className="w-full">
            <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAY_NAMES.map(wd => (
                    <div key={wd} className="text-center text-[9px] font-black text-slate-400  uppercase tracking-tighter">
                        {wd.substring(0, 3)}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((cell, idx) => {
                    if (cell.type === 'empty') return <div key={idx} className="aspect-square"></div>;
                    
                    return (
                        <div 
                            key={idx}
                            title={cell.isVacation ? 'Férias' : (cell.shift as string)}
                            className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all relative ${shiftBg(cell.shift)} ${canEdit ? 'hover:scale-105 hover:shadow-md cursor-pointer' : ''}`}
                        >
                            <span className={`text-[8px] font-black absolute top-1 left-1 ${isWorkingShift(cell.shift) || cell.isCourse ? 'text-white/80' : 'text-slate-400'}`}>{cell.day}</span>
                            <span className={`text-[11px] font-black mt-1 ${cell.isOff && !cell.isVacation && !cell.isBirthday ? 'opacity-40' : ''}`}>{isWorkingShift(cell.shift) ? 'T' : cell.isCourse ? 'C' : cell.isVacation ? 'FE' : cell.isBirthday ? 'DO' : (cell.shift?.startsWith('FF') ? 'FF' : 'F')}</span>


                            {canEdit && (
                                <select
                                    value={cell.shift}
                                    onChange={(e) => onUpdateShift(employee.id, cell.dayIdx, e.target.value as ShiftType)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                >
                                    <option value="T">Trabalha (T)</option>
                                    <option value="F">Folga (F)</option>
                                    <option value="C">Curso (C)</option>
                                    <option value="FE">Férias (FE)</option>
                                </select>
                            )}
                        </div>
                    );
                })}
            </div>
            {canEdit && (
                <p className="text-[9px] font-bold text-slate-400 mt-4 text-center animate-pulse">
                    <Icon name="touch_app" className="text-xs" /> Clique nos dias para mudar o status
                </p>
            )}
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
  const sortedEmployees = [...employees]
    .filter(e => !e.isHidden && e.status === 'active')
    .sort((a, b) => {
      const getStartHour = (wp: string) => {
        const match = wp.match(/(\d+)h/);
        return match ? parseInt(match[1]) : 99;
      };
      const hA = getStartHour(a.workPeriod || '');
      const hB = getStartHour(b.workPeriod || '');
      if (hA !== hB) return hA - hB;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

  for (let i = 1; i <= daysInMonth; i++) {
    const workingDayData = sortedEmployees.map(emp => {
      const shift = getEffectiveShift(emp, i - 1);
      const hours = (emp.dailyHours[monthKey] || [])[i - 1] || emp.workPeriod;
      const isOff = !isWorkingShift(shift) && shift !== 'C';

      return { 
        name: getShortName(emp.name, employees), 
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
    <div className="w-full print:px-2">
      <div className="grid grid-cols-7 gap-4 mb-4 print:gap-1 print:mb-2">
        {WEEKDAY_NAMES.map(wd => (
          <div key={wd} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{wd}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-4 print:gap-1">
        {cells.map((cell, idx) => (
          <div key={idx} className={`min-h-[160px] print:min-h-0 rounded-[2rem] print:rounded-lg border p-5 print:p-2 flex flex-col gap-1.5 print:gap-1 transition-all ${cell.type === 'empty' ? 'border-transparent' : 'bg-white border-slate-100'}`}>
            {cell.type === 'day' && (
              <>
                <div className="flex justify-between items-start mb-3 print:mb-1">
                  <span className="text-xs font-black text-slate-400  print:text-[10px]">{cell.date}</span>
                  <span className="text-[8px] font-black text-slate-300  uppercase tracking-tighter">
                    {WEEKDAY_NAMES[new Date(currentMY.year, currentMY.month, cell.date).getDay()].split('-')[0]}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {cell.dayData.map((d, i) => (
                    <div key={i} className={`flex items-center justify-between gap-1 p-2 print:p-1 rounded-xl print:rounded-md border ${d.isCourse ? 'bg-teal-50 border-teal-100 text-teal-700' : 'bg-slate-50 border-slate-100/50 text-slate-800'}`}>
                       <span className="text-[9px] print:text-[8px] font-black uppercase truncate">{d.name}</span>
                       <span className={`text-[8px] font-bold shrink-0 ${d.isCourse ? 'mt-[-2px]' : 'hidden'}`}>{d.isCourse && <Icon name="school" className="text-[10px]" />}</span>
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

// ─── Individual Edit Modal ───────────────────────────────────────────────────

const SHIFT_OPTIONS_MODAL = [
  { value: 'T', label: 'T — Trabalho' },
  { value: 'F', label: 'F — Folga' },
  { value: 'C', label: 'C — Curso' },
  { value: 'FE', label: 'FE — Férias' },
];

interface IndividualEditModalProps {
  employee: Employee;
  currentMY: MonthYear;
  customHolidays: Holiday[];
  getEffectiveShift: (emp: Employee, dayIdx: number) => ShiftType;
  onUpdateShift?: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateHour?: (empId: string, dayIdx: number, newHour: string) => void;
  onClose: () => void;
}

const IndividualEditModal: React.FC<IndividualEditModalProps> = ({
  employee, currentMY, customHolidays, getEffectiveShift,
  onUpdateShift, onUpdateHour, onClose,
}) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
  const canEdit = !!onUpdateShift;
  const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const getHour = (dayIdx: number): string => {
    const mh = (employee.dailyHours || {})[monthKey] || [];
    return mh[dayIdx] || employee.workPeriod || '';
  };

  const getAvailHours = (dayIdx: number): string[] => {
    const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
    const ds = `${currentMY.year}-${String(currentMY.month+1).padStart(2,'0')}-${String(dayIdx+1).padStart(2,'0')}`;
    const settings = jornadaSettings || DEFAULT_JORNADA_SETTINGS;
    if (holidaySet.has(ds)) return settings.shiftHours.holiday;
    if (date.getDay() === 0) return settings.shiftHours.sunday;
    return settings.shiftHours.weekday;
  };

  type CellDay = { type: 'day'; day: number; dayIdx: number; shift: ShiftType; isHoliday: boolean; isSunday: boolean; isSaturday: boolean; hour: string };
  type Cell = { type: 'empty' } | CellDay;
  const cells: Cell[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ type: 'empty' });
  for (let i = 1; i <= daysInMonth; i++) {
    const dayIdx = i - 1;
    const ds = `${currentMY.year}-${String(currentMY.month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const date = new Date(currentMY.year, currentMY.month, i);
    cells.push({ type: 'day', day: i, dayIdx, shift: getEffectiveShift(employee, dayIdx),
      isHoliday: holidaySet.has(ds), isSunday: date.getDay()===0, isSaturday: date.getDay()===6, hour: getHour(dayIdx) });
  }

  const shiftBg = (s: ShiftType) => {
    if (s==='T') return 'bg-sky-600';
    if (['P1', 'P2', 'P3', 'P4', 'ESTQ'].includes(s as string)) return 'bg-emerald-600';
    if (s==='F') return 'bg-orange-500';
    if (s?.startsWith('FF')) return 'bg-red-500';
    if (s==='C') return 'bg-teal-500';
    if (s==='FE') return 'bg-indigo-600';
    if (s==='DO') return 'bg-fuchsia-600';
    return 'bg-slate-300';
  };


  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white  rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-200  flex flex-col max-h-[92vh] overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100  flex items-center justify-between sticky top-0 bg-white  z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100  text-indigo-600  flex items-center justify-center font-black text-lg uppercase shadow-sm">
              {employee.name.substring(0,2)}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900  uppercase tracking-tight">{employee.name}</h3>
              <p className="text-[10px] font-bold text-slate-400  uppercase tracking-widest">
                Calendário Individual — {MONTH_NAMES[currentMY.month]} {currentMY.year}
                {canEdit && <span className="ml-2 text-indigo-500">• Clique para editar</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const el = document.getElementById('modal-calendar-capture');
                if (el) {
                  const dataUrl = await toPng(el, { 
                    backgroundColor: '#ffffff', 
                    pixelRatio: 2,
                    style: { 
                      padding: '30px', 
                      borderRadius: '32px',
                      transform: 'scale(0.9)',
                      transformOrigin: 'center'
                    } 
                  });
                  const link = document.createElement('a');
                  link.download = `escala-${employee.name.toLowerCase().replace(/\s+/g, '-')}.png`;
                  link.href = dataUrl;
                  link.click();
                }
              }}
              className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-full transition-colors"
              title="Baixar Calendário"
            >
              <Icon name="download" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100  rounded-full transition-colors">
              <Icon name="close" className="text-slate-400 " />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40  custom-scrollbar">
          <div id="modal-calendar-capture" className="bg-white p-6 rounded-3xl">
            <div className="mb-6 text-center border-b border-slate-100 pb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Escala Individual</p>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{employee.name}</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase">{MONTH_NAMES[currentMY.month]} {currentMY.year}</p>
            </div>
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {WEEKDAY_NAMES.map(wd => (
              <div key={wd} className="text-center text-[9px] font-black text-slate-400  uppercase">{wd.substring(0,3)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cell, idx) => {
              if (cell.type === 'empty') return <div key={idx} style={{minHeight:'70px'}} />;
              const { day, dayIdx, shift, isHoliday, isSunday, isSaturday, hour } = cell;
              const availH = getAvailHours(dayIdx);
              return (
                <div
                  key={idx}
                  style={{ minHeight: '70px' }}
                  className={`rounded-xl border flex flex-col items-center justify-start pt-1 gap-0.5 p-1 relative ${
                    isHoliday ? 'border-rose-300 bg-rose-50/70' :
                    isSunday  ? 'border-orange-300 bg-orange-50/70' :
                    isSaturday? 'border-slate-200 bg-slate-50' :
                    'border-slate-100 bg-white'
                  }`}
                >
                  <span className={`text-[8px] font-black self-start pl-0.5 ${isHoliday?'text-rose-400':isSunday?'text-orange-400':'text-slate-400'}`}>{day}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white shadow-sm ${shiftBg(shift)}`}>{shift?.split(' ')[0]}</div>
                  {canEdit && (
                    <select
                      value={shift}
                      onChange={e => onUpdateShift!(employee.id, dayIdx, e.target.value as ShiftType)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    >
                      {SHIFT_OPTIONS_MODAL.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      {shift?.startsWith('FF ') && <option value={shift}>{shift}</option>}
                    </select>
                  )}
                  {(shift==='T'||shift==='C') && (
                    <div className="w-full px-0.5 relative z-20" onClick={e=>e.stopPropagation()}>
                      {canEdit && onUpdateHour ? (
                        <select
                          value={hour}
                          onChange={e=>onUpdateHour!(employee.id, dayIdx, e.target.value)}
                          onClick={e=>e.stopPropagation()}
                          className="w-full text-[7px] font-bold text-slate-500  bg-transparent border-none outline-none text-center cursor-pointer"
                        >
                          {availH.map(h=><option key={h} value={h}>{h}</option>)}
                          {hour && !availH.includes(hour) && <option value={hour}>{hour}</option>}
                        </select>
                      ) : (
                        <span className="text-[7px] font-bold text-slate-400 block text-center truncate">{hour.split(' ')[0]}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
          {canEdit && (
            <div className="mt-4 p-3 bg-indigo-50  rounded-2xl border border-indigo-100  flex flex-wrap gap-3 items-center justify-center">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest w-full text-center">Clique em qualquer dia para alterar o turno • Alterações refletem na tabela principal</p>
              {SHIFT_OPTIONS_MODAL.map(o => (
                <div key={o.value} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-black text-white ${shiftBg(o.value as ShiftType)}`}>{o.value}</div>
                  {o.label.split('—')[1]?.trim()}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-8 py-4 border-t border-slate-100  flex justify-end bg-white ">
          <button onClick={onClose} className="px-8 py-2.5 bg-slate-900  text-white  text-xs font-black rounded-2xl hover:bg-indigo-600  transition-all shadow-lg active:scale-95">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
