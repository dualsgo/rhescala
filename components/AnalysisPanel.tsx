
import React, { useMemo, useState } from 'react';
import { Employee, MonthYear, Holiday, ShiftType } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet, SHIFT_HOURS } from '../constants';

interface AnalysisPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onClose: () => void;
  onUpdateShift?: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateHour?: (empId: string, dayIdx: number, newHour: string) => void;
}

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ employees, currentMY, customHolidays, onClose, onUpdateShift, onUpdateHour }) => {
  const [viewMode, setViewMode] = useState<'insights' | 'team-calendar'>('insights');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(employees.filter(e => !e.isHidden && e.status === 'active')[0]?.id || null);
  const [showIndividualModal, setShowIndividualModal] = useState(false);
  
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
  
  const getEffectiveShift = (emp: Employee, dayIdx: number) => {
    const monthShifts = emp.shifts[monthKey] || [];
    return monthShifts[dayIdx] || 'T';
  };

  const dailyCoverage = useMemo(() => {
    const coverage = [];
    for (let d = 0; d < daysInMonth; d++) {
      const activeEmps = employees.filter(e => !e.isHidden && e.status === 'active');
      const working = activeEmps.filter(e => {
        const s = getEffectiveShift(e, d);
        return s === 'T' || s.startsWith('FF');
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
  }, [employees, daysInMonth, currentMY, holidaySet]);

  const employeeStats = useMemo(() => {
    return employees.filter(e => !e.isHidden && e.status === 'active').map(emp => {
      let worked = 0;
      let actualHours = 0;
      let totalHolidaysInMonth = 0;
      let workedHolidays = 0;
      let vacationDays = 0;
      let extraOffs = 0;
      let sundayOffs = 0;

      // Theoretical Max Calculation (6x1 logic: ~26 days of work in a 31-day month, ~22 for apprentice 5x2)
      let theoreticalMaxWorkedDays = 0;

      for (let d = 0; d < daysInMonth; d++) {
        const date = new Date(currentMY.year, currentMY.month, d + 1);
        const dayType = date.getDay();
        const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
        const isHol = holidaySet.has(dateStr);
        const isSun = dayType === 0;
        const isSat = dayType === 6;

        if (isHol) totalHolidaysInMonth++;

        // 6x1 Theoretical logic
        if (emp.isYoungApprentice) {
            if (!isSun && !isSat && !isHol) theoreticalMaxWorkedDays++;
        } else {
            if (!isSun) theoreticalMaxWorkedDays++; // simplistic theoretical max 
        }

        const s = getEffectiveShift(emp, d);
        if (s === 'T' || s.startsWith('FF')) {
          worked++;
          if (isHol) workedHolidays++;
          if (isSun) sundayOffs = 0; // tracking actual presence
          actualHours += 7.33; 
        } else if (s === 'FE') {
          vacationDays++;
        } else if (s === 'F' && !isSun) {
          extraOffs++;
        } else if (s === 'F' && isSun) {
          sundayOffs++;
        }
      }

      // 6x1 for CLT: 1 off for 6 worked. Usually 4-5 offs per month. 
      // User says: FF (Holiday-Off) are compensatory, FE (Vacation) are not Extra Offs.
      // So Extra Offs = Only those above regular 6x1 or special rules.
      
      const theoreticalHours = Math.round(theoreticalMaxWorkedDays * 7.33);

      return {
        id: emp.id,
        name: emp.name,
        worked,
        actualHours: Math.round(actualHours),
        theoreticalHours,
        extraOffs,
        workedHolidays,
        isHeavy: worked > 22,
        emp
      };
    }).sort((a, b) => b.worked - a.worked);
  }, [employees, daysInMonth, currentMY, holidaySet]);

  const selectedEmployee = useMemo(() => 
    employeeStats.find(s => s.id === selectedEmpId), [employeeStats, selectedEmpId]
  );

  return (
    <div className="flex flex-col h-full animate-fade-in transition-colors bg-white">
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 transition-colors no-print">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
               <Icon name="insights" className="text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={onClose}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors mr-1"
                >
                  <Icon name="arrow_back" />
                </button>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Análise de Escala & Gargalos</h2>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
                Sobrecarga e Performance CLT vs Aprendiz • {(currentMY.month + 1).toString().padStart(2, '0')}/{currentMY.year}
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

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar transition-colors">
          
          {viewMode === 'insights' ? (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Individual Mini-Calendar (Right Panel actually) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm h-full flex flex-col">
                    <div className="mb-6 flex justify-between items-start">
                        <div className="min-w-0">
                            <h3 className="text-lg font-black text-slate-800 truncate uppercase">
                                {selectedEmployee?.name || 'Selecione um colaborador'}
                            </h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resumo Estatístico</p>
                        </div>
                    </div>
                    
                    <div className="space-y-6 flex-1">
                        <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl">
                           <div className="flex items-center justify-between mb-4">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Horas Estimadas</span>
                              <Icon name="timer" className="text-indigo-400" />
                           </div>
                           <div className="flex items-end gap-2 text-indigo-900 leading-none">
                              <span className="text-3xl font-black">{selectedEmployee?.actualHours}h</span>
                              <span className="text-sm font-bold opacity-60">/ {selectedEmployee?.theoreticalHours}h</span>
                           </div>
                           <p className="text-[9px] font-bold text-indigo-400 mt-2">Simulação baseada na jornada 6x1 (CLT) ou 5x2 (Aprendiz)</p>
                        </div>

                        <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl">
                           <div className="flex items-center justify-between mb-4">
                              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Folgas Extras</span>
                              <Icon name="celebration" className="text-rose-400" />
                           </div>
                           <div className="text-3xl font-black text-rose-900 leading-none">{selectedEmployee?.extraOffs}d</div>
                           <p className="text-[9px] font-bold text-rose-400 mt-2">Folgas além do mínimo legal. (FF e FE não contabilizados)</p>
                        </div>

                        <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl">
                           <div className="flex items-center justify-between mb-4">
                              <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Feriados Trabalhados</span>
                              <Icon name="event_busy" className="text-amber-400" />
                           </div>
                           <div className="text-3xl font-black text-amber-900 leading-none">{selectedEmployee?.workedHolidays}d</div>
                           <p className="text-[9px] font-bold text-amber-400 mt-2">Créditos de feriado (FF) pendentes de compensação.</p>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Main Ranking Table */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                   <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm flex flex-col transition-colors">
                        <div className="mb-6">
                            <h3 className="text-lg font-black text-slate-800 uppercase">Ranking de Carga Horária</h3>
                            <p className="text-xs font-bold text-slate-400">Análise de equilíbrio e distribuição de horas mensais</p>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-12 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                               <div className="col-span-6">Colaborador</div>
                               <div className="col-span-2 text-center">Dias</div>
                               <div className="col-span-2 text-center">Horas</div>
                               <div className="col-span-2 text-center">Extras</div>
                            </div>
                            {employeeStats.map((s, idx) => (
                                <button 
                                    key={s.id} 
                                    onClick={() => setSelectedEmpId(s.id)}
                                    className={`w-full grid grid-cols-12 items-center gap-2 p-4 rounded-2xl transition-all border ${
                                        selectedEmpId === s.id 
                                        ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]' 
                                        : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                                    }`}
                                >
                                    <div className="col-span-6 flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                                            selectedEmpId === s.id ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-500'
                                        }`}>
                                            {s.name.substring(0,2)}
                                        </div>
                                        <div className="text-left min-w-0">
                                            <p className={`text-xs font-black uppercase truncate ${selectedEmpId === s.id ? 'text-white' : 'text-slate-900'}`}>{s.name.split(' ')[0]}</p>
                                            <p className={`text-[9px] font-bold opacity-60 ${selectedEmpId === s.id ? 'text-white/80' : 'text-slate-400'}`}>{s.emp.cargo}</p>
                                        </div>
                                    </div>
                                    <div className="col-span-2 text-center text-xs font-black">{s.worked}d</div>
                                    <div className="col-span-2 text-center text-xs font-black">{s.actualHours}h</div>
                                    <div className={`col-span-2 text-center text-xs font-black ${s.extraOffs > 0 ? 'text-emerald-500' : ''}`}>{s.extraOffs}</div>
                                </button>
                            ))}
                        </div>
                   </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full animate-fade-in bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm overflow-auto transition-colors">
               <TeamMonthlyCalendar 
                 employees={employees} 
                 currentMY={currentMY} 
                 customHolidays={customHolidays} 
                 getEffectiveShift={getEffectiveShift}
               />
            </div>
          )}
        </div>

        <div className="px-10 py-6 bg-white border-t border-slate-100 flex items-center justify-between sticky bottom-0 transition-colors no-print">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Dashboard de Insights Ri Happy • Versão Beta</p>
           <button 
             onClick={onClose} 
             className="px-10 py-3 bg-slate-950 text-white text-xs font-black rounded-2xl hover:bg-emerald-600 transition-all shadow-xl active:scale-95"
           >
             Sair da Análise
           </button>
        </div>
      </div>
    </div>
  );
};

// ... TeamMonthlyCalendar stays similar but optimized for grid
const TeamMonthlyCalendar: React.FC<{ 
    employees: Employee[], 
    currentMY: MonthYear, 
    customHolidays: Holiday[],
    getEffectiveShift: (emp: Employee, dayIdx: number) => ShiftType
}> = ({ employees, currentMY, customHolidays, getEffectiveShift }) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ type: 'empty' as const });
  const sortedEmployees = [...employees]
    .filter(e => !e.isHidden && e.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  for (let i = 1; i <= daysInMonth; i++) {
    const workingDayData = sortedEmployees.map(emp => {
      const shift = getEffectiveShift(emp, i - 1);
      const isOff = shift === 'F' || shift === 'FE' || shift === 'N/A';
      return { name: emp.name.split(' ')[0], shift, isOff };
    }).filter(d => !d.isOff);
    cells.push({ type: 'day' as const, date: i, dayData: workingDayData });
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
          <div key={idx} className={`min-h-[140px] rounded-3xl border border-slate-100 p-4 transition-all ${cell.type === 'empty' ? 'bg-slate-50/30' : 'bg-white shadow-sm hover:shadow-lg'}`}>
            {cell.type === 'day' && (
              <>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm font-black text-slate-800">{cell.date}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cell.dayData.map((d, i) => (
                    <div key={i} className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-[8px] font-black uppercase">
                       {d.name}
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
