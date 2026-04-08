import React, { useMemo } from 'react';
import { Employee, MonthYear, ShiftType, Holiday } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet } from '../constants';

interface HolidayCreditPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onApplyFix: (empId: string, dayIdx: number, shift: ShiftType) => void;
  onClose: () => void;
}

interface HolidayCreditItem {
  holidayDate: string;
  holidayName: string;
  empId: string;
  empName: string;
  isCompensated: boolean;
  compensationDayIdx?: number;
  compensationLabel?: string;
  suggestedDayIdx: number;
  suggestedDayLabel: string;
}

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export const HolidayCreditPanel: React.FC<HolidayCreditPanelProps> = ({
  employees,
  currentMY,
  customHolidays,
  onApplyFix,
  onClose,
}) => {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const credits = useMemo(() => {
    const list: HolidayCreditItem[] = [];
    
    // Get all holidays in the current month
    const holidaysInMonth: { date: string, name: string, dayIdx: number }[] = [];
    for (let d = 0; d < daysInMonth; d++) {
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
      if (holidaySet.has(dateStr)) {
        // Find holiday name
        const hName = customHolidays.find(h => h.date === dateStr)?.name || 'Feriado';
        holidaysInMonth.push({ date: dateStr, name: hName, dayIdx: d });
      }
    }

    if (holidaysInMonth.length === 0) return [];

    // For each employee
    employees.forEach(emp => {
      if (emp.status !== 'active' || emp.isYoungApprentice) return;

      const empShifts = emp.shifts?.[monthKey] || Array(daysInMonth).fill('F');
      
      // 1. Identify all holidays worked (Credits Unearned)
      const workedHolidays = holidaysInMonth.filter(h => {
        let s = empShifts[h.dayIdx];
        const hDateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(h.dayIdx + 1).padStart(2, '0')}`;
        if (emp.vacationStart && emp.vacationEnd && hDateStr >= emp.vacationStart && hDateStr <= emp.vacationEnd) {
            s = 'FE';
        }
        return s === 'T' || s === 'C';
      });

      // 2. Identify all compensatory days off (FF) present in the month
      const ffDays: { idx: number, label: string }[] = [];
      for (let i = 0; i < daysInMonth; i++) {
        const s = empShifts[i];
        if (s && s.startsWith('FF')) {
          ffDays.push({ idx: i, label: s });
        }
      }

      // 3. Match work holidays with FF days
      workedHolidays.forEach((h, index) => {
        const isCompensated = index < ffDays.length;
        const compensation = isCompensated ? ffDays[index] : undefined;

        // Suggest a day off ONLY if not compensated
        let bestDayIdx = -1;
        let maxCoverage = -1;
        let suggestionLabel = "";

        if (!isCompensated) {
          // Suggest logic
          for (let d = 0; d < daysInMonth; d++) {
            const date = new Date(currentMY.year, currentMY.month, d + 1);
            const dow = date.getDay();
            const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;

            if (dow === 0 || dow === 6) continue;
            if (holidaySet.has(dateStr)) continue;
            if (WEEKDAY_NAMES[dow] === emp.preferredDayOff) continue;
            
            const currentShift = empShifts[d] || 'F';
            const isOnVacation = emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd;
            if (currentShift !== 'T' || isOnVacation) continue;

            const coverage = employees.filter(e => {
              const sArr = e.shifts?.[monthKey] || [];
              let s = sArr[d] || 'F';
              const dDateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
              if (e.vacationStart && e.vacationEnd && dDateStr >= e.vacationStart && dDateStr <= e.vacationEnd) s = 'FE';
              return s === 'T';
            }).length;

            if (coverage > maxCoverage) {
              maxCoverage = coverage;
              bestDayIdx = d;
            }
          }

          if (bestDayIdx !== -1) {
            const date = new Date(currentMY.year, currentMY.month, bestDayIdx + 1);
            const dd = String(bestDayIdx + 1).padStart(2, '0');
            const mm = String(currentMY.month + 1).padStart(2, '0');
            suggestionLabel = `${dd}/${mm} (${WEEKDAY_NAMES[date.getDay()].split('-')[0]})`;
          }
        }

        list.push({
          holidayDate: h.date,
          holidayName: h.name,
          empId: emp.id,
          empName: emp.name,
          isCompensated,
          compensationDayIdx: compensation?.idx,
          compensationLabel: compensation?.label,
          suggestedDayIdx: bestDayIdx,
          suggestedDayLabel: suggestionLabel
        });
      });
    });

    return list;
  }, [employees, currentMY, customHolidays, holidaySet, monthKey, daysInMonth]);

  const pendingCount = credits.filter(c => !c.isCompensated).length;
  const compensatedCount = credits.filter(c => c.isCompensated).length;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in transition-colors">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border dark:border-slate-800">
        
        {/* Header Section */}
        <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
                    <Icon name="event_repeat" className="text-3xl" fill />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-3 underline decoration-rose-500 decoration-4 underline-offset-4">
                      Folgas de Feriado
                    </h3>
                    <div className="flex items-center gap-3 mt-2">
                       <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase">
                          <Icon name="history" className="text-xs" /> {pendingCount} Pendentes
                       </div>
                       <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase">
                          <Icon name="check_circle" className="text-xs" /> {compensatedCount} Compensadas
                       </div>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="w-12 h-12 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-90">
                <Icon name="close" className="text-slate-400 text-xl" />
            </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-950 transition-colors custom-scrollbar">
          {credits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-slate-600">
                <Icon name="celebration" className="text-7xl mb-6 opacity-20" />
                <p className="text-lg font-black uppercase tracking-widest">Tudo em dia!</p>
                <p className="text-sm font-medium mt-1">Nenhum crédito de feriado pendente para este mês.</p>
            </div>
          ) : (
            <div className="space-y-4">
               {/* Summary Bar */}
               <div className="flex items-center justify-between mb-8 p-6 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <div className="flex-1 pr-12">
                     <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progresso de Compensação</span>
                        <span className="text-xs font-black text-emerald-600">{Math.round((compensatedCount / credits.length) * 100)}%</span>
                     </div>
                     <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                        <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(compensatedCount / credits.length) * 100}%` }} />
                     </div>
                  </div>
                  <div className="text-right">
                      <p className="text-3xl font-black text-slate-800 dark:text-white leading-none">{credits.length}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Total de Créditos</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 gap-3">
                 {credits.map((item, idx) => {
                   const hDate = new Date(item.holidayDate + 'T00:00:00');
                   const dayLabel = `${String(hDate.getDate()).padStart(2, '0')}/${String(hDate.getMonth() + 1).padStart(2, '0')}`;
                   
                   return (
                     <div key={`${item.empId}-${item.holidayDate}-${idx}`} className={`group flex items-center justify-between p-5 rounded-[1.5rem] border transition-all ${item.isCompensated ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:shadow-xl hover:border-orange-200'}`}>
                        <div className="flex items-center gap-6">
                           {/* Holiday Info */}
                           <div className="flex flex-col min-w-[120px]">
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md self-start mb-1 uppercase tracking-tighter">Trabalhou no Feriado</span>
                              <div className="flex items-center gap-2">
                                 <span className="text-xs font-black text-slate-900 dark:text-slate-100">{item.holidayName}</span>
                                 <span className="text-[10px] font-bold text-slate-400">({dayLabel})</span>
                              </div>
                           </div>

                           {/* Connector */}
                           <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

                           {/* Employee Info */}
                           <div className="flex items-center gap-3 min-w-[180px]">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                                 {item.empName.charAt(0)}
                              </div>
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase truncate">{item.empName}</span>
                           </div>

                           <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

                           {/* Compensation/Suggestion */}
                           <div className="flex flex-col">
                              {item.isCompensated ? (
                                <div className="flex items-center gap-2 text-emerald-600">
                                   <Icon name="check_circle" className="text-lg" fill />
                                   <div className="flex flex-col">
                                      <span className="text-[10px] font-black uppercase">Compensada em</span>
                                      <span className="text-xs font-bold leading-tight">{item.compensationLabel}</span>
                                   </div>
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                   <span className="text-[9px] font-black text-amber-600 uppercase mb-0.5">Sugestão de Máxima Cobertura</span>
                                   <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                      <Icon name="auto_fix_high" className="text-xs" />
                                      <span className="text-xs font-black">{item.suggestedDayLabel}</span>
                                   </div>
                                </div>
                              )}
                           </div>
                        </div>

                        {/* Action */}
                        {!item.isCompensated && (
                          <button
                            onClick={() => {
                              onApplyFix(item.empId, item.suggestedDayIdx, `FF ${dayLabel}`);
                            }}
                            className="bg-orange-500 hover:bg-slate-900 text-white dark:hover:bg-white dark:hover:text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                          >
                            Agendar Folga
                          </button>
                        )}
                        {item.isCompensated && (
                           <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase">
                              OK
                           </div>
                        )}
                     </div>
                   );
                 })}
               </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col md:flex-row gap-8 items-center">
               <div className="flex-1">
                  <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-3">Critérios de Inteligência</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5"><Icon name="groups" className="text-sm" /></div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight font-medium">As sugestões priorizam dias onde a **equipe está mais completa**, garantindo que a loja nunca fique desassistida.</p>
                     </div>
                     <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5"><Icon name="calendar_today" className="text-sm" /></div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight font-medium">As folgas são selecionadas obrigatoriamente entre **segunda e sexta**, respeitando a operação de fins de semana.</p>
                     </div>
                  </div>
               </div>
               <div className="flex items-center gap-3 py-3 px-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <Icon name="verified" className="text-rose-500 text-xl" />
                  <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase leading-none">Sistema de Auditoria <br/><span className="text-rose-500 tracking-widest">ATIVADO</span></p>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
};
