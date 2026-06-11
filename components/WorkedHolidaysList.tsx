import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday } from '../types';
import { buildHolidaySet, getNationalHolidays } from '../constants';
import { HolidayCredit } from '../hooks/useHolidayCredits';
import { Icon } from './Icon';
import { useDialog } from '../contexts/DialogContext';
import { isWorkingShift } from '../hooks/useScheduleEngine';


interface WorkedHolidaysListProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  holidayCredits: Record<string, HolidayCredit[]>;
  trackingStartDate?: string;
  onUpdateTrackingStartDate?: (date: string) => void;
  onClose: () => void;
}

export const WorkedHolidaysList: React.FC<WorkedHolidaysListProps> = ({
  employees,
  currentMY,
  customHolidays,
  holidayCredits,
  trackingStartDate,
  onUpdateTrackingStartDate,
  onClose,
}) => {
  const { showDialog } = useDialog();
  const relevantHolidays = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const allHolidays = [...getNationalHolidays(currentMY.year), ...customHolidays];
    return allHolidays
      .filter(h => h.date && (!trackingStartDate || h.date >= trackingStartDate) && h.date < todayStr)
      .filter((h, i, self) => i === self.findIndex(t => t.date === h.date)) // Deduplicate
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [customHolidays, currentMY.year, trackingStartDate]);

  const getWorkersForHoliday = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const targetMonthKey = `${year}-${month}`;
    const dayIdx = parseInt(day, 10) - 1;
    
    return employees.filter(emp => {
      const shift = (emp.shifts[targetMonthKey] || [])[dayIdx];
      // Only count as worked if it's a working shift (T or P1-P4)
      const hasWorked = isWorkingShift(shift);
      return hasWorked && !emp.isHidden && emp.status === 'active';
    });

  };

  const handleCopyPending = () => {
    let text = "*📋 COLABORADORES COM FOLGAS PENDENTES*\n\n";
    let found = false;
    
    const sortedEmployees = [...employees].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedEmployees.forEach(worker => {
      const pendingCredits = (holidayCredits[worker.id] || []).filter(c => c.status === 'pending');
      if (pendingCredits.length > 0) {
        found = true;
        text += `👤 *${worker.name.toUpperCase()}*\n`;
        pendingCredits.forEach(c => {
          const dateFormatted = c.holidayDate.split('-').reverse().join('/');
          text += `   • ${dateFormatted} - ${c.holidayName}\n`;
        });
        text += '\n';
      }
    });

    if (!found) {
      text = "Nenhuma folga pendente encontrada.";
    }

    navigator.clipboard.writeText(text);
    showDialog({ title: 'Copiado', message: 'A lista de pendentes foi copiada para a área de transferência!', type: 'info' });
  };

  const handleCopyScheduled = () => {
    let text = "*📅 FOLGAS DE FERIADO AGENDADAS*\n\n";
    let found = false;
    
    const sortedEmployees = [...employees].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedEmployees.forEach(worker => {
      const scheduledCredits = (holidayCredits[worker.id] || []).filter(c => c.status === 'scheduled');
      if (scheduledCredits.length > 0) {
        found = true;
        text += `👤 *${worker.name.toUpperCase()}*\n`;
        scheduledCredits.forEach(c => {
          const workedDate = c.holidayDate.split('-').reverse().join('/');
          const offDate = c.offDate?.split('-').reverse().join('/') || 'Não informada';
          text += `   • Trabalhou: ${workedDate} (${c.holidayName})\n`;
          text += `     ✅ Agendada para: *${offDate}*\n`;
        });
        text += '\n';
      }
    });

    if (!found) {
      text = "Nenhuma folga agendada encontrada.";
    }

    navigator.clipboard.writeText(text);
    showDialog({ title: 'Copiado', message: 'A lista de agendadas foi copiada para a área de transferência!', type: 'info' });
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-7xl mx-auto mt-6 animate-fade-in max-h-[85vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
            <Icon name="list_alt" className="text-2xl" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase text-slate-800 dark:text-slate-100">Controle de Créditos</h2>
            <p className="text-sm font-bold text-slate-400 mt-1">Gestão de feriados trabalhados e folgas compensatórias</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCopyPending}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all shadow-md active:scale-95"
          >
            <Icon name="content_copy" className="text-sm" /> Pendentes
          </button>
          <button 
            onClick={handleCopyScheduled}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all shadow-md active:scale-95"
          >
            <Icon name="event_available" className="text-sm" /> Agendadas
          </button>
          <button onClick={onClose} className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors">
            Voltar
          </button>
        </div>
      </div>

      {/* Configuration Section */}
      <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex flex-wrap items-center justify-between gap-4">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg flex items-center justify-center">
               <Icon name="history" className="text-sm" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase text-amber-900 dark:text-amber-500 tracking-tight">Marco Zero dos Créditos</p>
               <p className="text-[9px] font-bold text-amber-700/60 dark:text-amber-600/60 uppercase">Ignorar feriados e folgas antes desta data</p>
            </div>
         </div>
         <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-amber-800 dark:text-amber-400">Contar a partir de:</span>
            <input 
               type="date" 
               value={trackingStartDate || ''} 
               onChange={(e) => onUpdateTrackingStartDate?.(e.target.value)}
               className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/50 rounded-lg px-3 py-1.5 text-[11px] font-black text-amber-900 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500/20"
            />
         </div>
      </div>

      {relevantHolidays.length === 0 ? (
        <div className="text-center py-20 opacity-30">
          <Icon name="event_available" className="text-6xl text-slate-300 dark:text-slate-700 mb-4" />
          <p className="text-lg font-black uppercase tracking-widest text-slate-400">Nenhum feriado após o marco zero</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {relevantHolidays.map(holiday => {
            const workers = getWorkersForHoliday(holiday.date);
            return (
              <div key={holiday.date} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                      <div className="text-xl font-black text-rose-600 dark:text-rose-400">
                        {holiday.date.split('-')[2]}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase">{holiday.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           {holiday.type === 'national' ? 'Feriado Nacional' : 'Feriado Local'}
                        </p>
                      </div>
                   </div>
                   <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                     {workers.length} Colaboradores
                   </div>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                   {workers.length > 0 ? workers.map(worker => {
                     const credits = (holidayCredits[worker.id] || []).filter(c => c.holidayDate === holiday.date);
                     
                     return credits.map((credit, idx) => (
                       <div key={`${worker.id}-${credit.id || idx}`} className={`flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 ${idx > 0 ? 'mt-2' : ''}`}>
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-500">
                               {worker.name.charAt(0)}
                             </div>
                             <div>
                               <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase">{worker.name}</p>
                               <div className="flex items-center gap-2">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{worker.cargo}</p>
                                 {credits.length > 1 && (
                                   <span className="text-[8px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded uppercase">{credit.holidayName.includes('Folga 2') ? '2ª FOLGA' : '1ª FOLGA'}</span>
                                 )}
                               </div>
                             </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                             {credit?.status === 'pending' ? (
                                <span className="text-[8px] font-black uppercase text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-md">FOLGA PENDENTE</span>
                             ) : credit?.status === 'scheduled' ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md">AGENDADA</span>
                                  <span className="text-[7px] font-bold text-slate-400 mt-0.5">{credit.offDate?.split('-').reverse().join('/')}</span>
                                </div>
                             ) : credit?.status === 'granted' ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-[8px] font-black uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md">CONCEDIDA</span>
                                  <span className="text-[7px] font-bold text-slate-400 mt-0.5">{credit.offDate?.split('-').reverse().join('/')}</span>
                                </div>
                             ) : (
                                <span className="text-[8px] font-black uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md">TRABALHOU</span>
                             )}
                          </div>
                       </div>
                     ));
                   }) : (
                     <p className="text-[10px] font-bold text-slate-400 uppercase text-center py-4">Ninguém trabalhou neste dia</p>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
