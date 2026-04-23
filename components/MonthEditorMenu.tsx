
import React, { useMemo, useState } from 'react';
import { Employee, MonthYear, Holiday, ShiftType } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet } from '../constants';

interface MonthEditorMenuProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onSyncRules: (targetMY: MonthYear) => Promise<void>;
  onSortSchedule: (targetMY: MonthYear) => Promise<void>;
  onRunFullProcess: (targetMY: MonthYear) => Promise<void>;
  onClose: () => void;
  onJumpToMonth: (targetMY: MonthYear) => void;
}

const MONTHS_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export const MonthEditorMenu: React.FC<MonthEditorMenuProps> = ({
  employees,
  currentMY,
  customHolidays,
  onSyncRules,
  onSortSchedule,
  onRunFullProcess,
  onClose,
  onJumpToMonth,
}) => {
  const [selectedMY, setSelectedMY] = useState<MonthYear>(() => {
    // Default to next month
    const next = new Date(currentMY.year, currentMY.month + 1, 1);
    return { month: next.getMonth(), year: next.getFullYear() };
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const monthKey = `${selectedMY.year}-${String(selectedMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(selectedMY.year, selectedMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(selectedMY.year, customHolidays);

  // Calculate pending holiday credits for the selected month
  const holidayCredits = useMemo(() => {
    const holidaysInMonth: { date: string, name: string, dayIdx: number }[] = [];
    for (let d = 0; d < daysInMonth; d++) {
      const dateStr = `${selectedMY.year}-${String(selectedMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
      if (holidaySet.has(dateStr)) {
        const hName = customHolidays.find(h => h.date === dateStr)?.name || 'Feriado';
        holidaysInMonth.push({ date: dateStr, name: hName, dayIdx: d });
      }
    }

    const pending: { empName: string, holiday: string }[] = [];
    employees.forEach(emp => {
      if (emp.status !== 'active' || emp.isYoungApprentice) return;
      const empShifts = emp.shifts?.[monthKey] || [];
      
      holidaysInMonth.forEach(h => {
        const s = empShifts[h.dayIdx] || 'T'; // Default to work if not set?
        if (s === 'T' || s === 'C') {
          // Check if there is an FF in the month for this employee
          const hasFF = empShifts.some(shift => shift && shift.startsWith('FF'));
          if (!hasFF) {
            pending.push({ empName: emp.name, holiday: h.name });
          }
        }
      });
    });
    return pending;
  }, [employees, selectedMY, customHolidays, daysInMonth, holidaySet, monthKey]);

  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      // Sequence: Sync then Sort in a single atomic-like update
      await onRunFullProcess(selectedMY);
      onJumpToMonth(selectedMY);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg">
              <Icon name="auto_fix_high" className="text-2xl" fill />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Gerenciador de Escala Mensal</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Configuração e Automação de Período</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all">
            <Icon name="close" className="text-slate-400" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Month Selector */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Selecione o Mês para Editar</label>
            <div className="grid grid-cols-2 gap-4">
              <select 
                value={selectedMY.month}
                onChange={(e) => setSelectedMY(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-black text-slate-700 dark:text-slate-200 outline-none focus:ring-2 ring-orange-500/20 transition-all appearance-none cursor-pointer"
              >
                {MONTHS_NAMES.map((name, i) => <option key={i} value={i}>{name.toUpperCase()}</option>)}
              </select>
              <select 
                value={selectedMY.year}
                onChange={(e) => setSelectedMY(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-black text-slate-700 dark:text-slate-200 outline-none focus:ring-2 ring-orange-500/20 transition-all appearance-none cursor-pointer"
              >
                {[currentMY.year, currentMY.year + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Context Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-[1.5rem] border border-blue-100 dark:border-blue-800/50">
              <div className="flex items-center gap-3 mb-3 text-blue-600 dark:text-blue-400">
                <Icon name="history" className="text-xl" />
                <span className="text-[10px] font-black uppercase tracking-widest">Memória do Período</span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 font-bold leading-relaxed">
                O sistema analisará os últimos domingos trabalhados para garantir o revezamento correto neste novo mês.
              </p>
            </div>
            <div className="p-5 bg-rose-50 dark:bg-rose-900/20 rounded-[1.5rem] border border-rose-100 dark:border-rose-800/50">
              <div className="flex items-center gap-3 mb-3 text-rose-600 dark:text-rose-400">
                <Icon name="event_repeat" className="text-xl" />
                <span className="text-[10px] font-black uppercase tracking-widest">Folgas de Feriados</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">Pendências Detectadas:</span>
                <span className="px-2 py-1 bg-rose-500 text-white rounded-lg text-[10px] font-black">{holidayCredits.length}</span>
              </div>
              {holidayCredits.length > 0 && (
                <div className="mt-2 max-h-20 overflow-y-auto text-[9px] text-rose-600/70 dark:text-rose-400/70 font-medium italic">
                  {holidayCredits.slice(0, 3).map((c, i) => (
                    <div key={i}>• {c.empName} ({c.holiday})</div>
                  ))}
                  {holidayCredits.length > 3 && <div>e mais {holidayCredits.length - 3}...</div>}
                </div>
              )}
            </div>
          </div>

          {/* Rules Reminder */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Regras Aplicadas</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                <Icon name="check_circle" className="text-emerald-500 text-sm" />
                Sincronização de folgas fixas e feriados
              </li>
              <li className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                <Icon name="check_circle" className="text-emerald-500 text-sm" />
                Revezamento de domingos (CLT)
              </li>
              <li className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                <Icon name="check_circle" className="text-emerald-500 text-sm" />
                Regra de folga após 6 dias de trabalho
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex gap-4">
          <button 
            disabled={isProcessing}
            onClick={onClose}
            className="flex-1 px-6 py-4 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button 
            disabled={isProcessing}
            onClick={handleProcess}
            className="flex-[2] px-6 py-4 bg-orange-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-wait"
          >
            {isProcessing ? (
              <>
                <Icon name="sync" className="animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Icon name="rocket_launch" />
                Gerar Escala de {MONTHS_NAMES[selectedMY.month].toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
