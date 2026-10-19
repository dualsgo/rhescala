import React, { useMemo, useState } from 'react';
import { Employee, MonthYear, ShiftType } from '../types';
import { Icon } from './Icon';
import { detectInconsistencies, Inconsistency } from './InconsistencyPanel';

interface InconsistencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  currentMY: MonthYear;
  today: Date;
  onSelectDay: (idx: number) => void;
  onApplyFix: (empId: string, dayIdx: number, shift: ShiftType) => void;
  onApplyBulkFixes: (updates: { empId: string; dayIdx: number; newShift: ShiftType }[]) => void;
}

export const InconsistencyModal: React.FC<InconsistencyModalProps> = ({
  isOpen,
  onClose,
  employees,
  currentMY,
  today,
  onSelectDay,
  onApplyFix,
  onApplyBulkFixes,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'consecutive_work' | 'consecutive_sunday' | 'sunday_understaffed'>('all');

  const issues = useMemo(
    () => detectInconsistencies(employees, currentMY.year, currentMY.month, today),
    [employees, currentMY, today]
  );

  const filteredIssues = useMemo(() => {
    if (filterType === 'all') return issues;
    return issues.filter(i => i.type === filterType);
  }, [issues, filterType]);

  const workIssuesCount = issues.filter(i => i.type === 'consecutive_work').length;
  const sundayIssuesCount = issues.filter(i => i.type === 'consecutive_sunday').length;
  const understaffedCount = issues.filter(i => i.type === 'sunday_understaffed').length;

  if (!isOpen) return null;

  const handleApplyFix = (issue: Inconsistency) => {
    if (!issue.fix) return;
    onApplyFix(issue.fix.empId, issue.fix.dayIdx, issue.fix.newShift);
  };

  const handleApplyAll = () => {
    const MIN_WORKERS = 6;
    const fixesAppliedPerDay = new Map<number, number>();
    const bulkUpdates: { empId: string; dayIdx: number; newShift: ShiftType }[] = [];

    // Prioridade 1: Quebra 6x1 / 7 dias seguidos
    const workInconsistencies = issues.filter(i => i.type === 'consecutive_work');
    for (const issue of workInconsistencies) {
      if (issue.fix) {
        bulkUpdates.push({
          empId: issue.fix.empId,
          dayIdx: issue.fix.dayIdx,
          newShift: issue.fix.newShift,
        });
        if (new Date(currentMY.year, currentMY.month, issue.fix.dayIdx + 1).getDay() === 0) {
          fixesAppliedPerDay.set(issue.fix.dayIdx, (fixesAppliedPerDay.get(issue.fix.dayIdx) || 0) + 1);
        }
      }
    }

    // Prioridade 2: 3+ Domingos Seguidos
    const sundayInconsistencies = issues.filter(i => i.type === 'consecutive_sunday');
    const mKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

    for (const issue of sundayInconsistencies) {
      if (!issue.fix) continue;
      const dayIdx = issue.fix.dayIdx;
      const currentWorkers = employees.filter(e => {
        if (e.isYoungApprentice || e.status !== 'active') return false;
        const shift = e.shifts[mKey]?.[dayIdx];
        return shift === 'T' || ['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'].includes(shift as string);
      }).length;

      const alreadyScheduledOff = fixesAppliedPerDay.get(dayIdx) ?? 0;
      if (currentWorkers - alreadyScheduledOff - 1 >= MIN_WORKERS) {
        bulkUpdates.push({
          empId: issue.fix.empId,
          dayIdx: issue.fix.dayIdx,
          newShift: issue.fix.newShift,
        });
        fixesAppliedPerDay.set(dayIdx, alreadyScheduledOff + 1);
      }
    }

    if (bulkUpdates.length > 0) {
      onApplyBulkFixes(bulkUpdates);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-zinc-800 bg-amber-500 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Icon name="warning" className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Central de Alertas e Inconsistências</h2>
              <p className="text-xs font-bold opacity-90">
                {issues.length === 0
                  ? 'Nenhuma inconsistência encontrada para este mês.'
                  : `${issues.length} alerta${issues.length > 1 ? 's' : ''} detectado${issues.length > 1 ? 's' : ''} na escala`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {issues.some(i => i.fix) && (
              <button
                onClick={handleApplyAll}
                className="flex items-center gap-2 px-4 py-2 bg-white text-amber-700 hover:bg-amber-50 rounded-xl font-black text-xs uppercase transition-all shadow-md"
              >
                <Icon name="auto_fix_high" className="text-sm" />
                Corrigir Todos
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <Icon name="close" className="text-2xl" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 overflow-x-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterType === 'all'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            Todos ({issues.length})
          </button>
          <button
            onClick={() => setFilterType('consecutive_work')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterType === 'consecutive_work'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            7+ Dias Seguidos ({workIssuesCount})
          </button>
          <button
            onClick={() => setFilterType('consecutive_sunday')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterType === 'consecutive_sunday'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            3+ Dom. Seguidos ({sundayIssuesCount})
          </button>
          <button
            onClick={() => setFilterType('sunday_understaffed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterType === 'sunday_understaffed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Equipe Insuficiente ({understaffedCount})
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 divide-y divide-slate-100 dark:divide-zinc-800 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950">
          {filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                <Icon name="verified" className="text-3xl" fill />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Tudo Certo!</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-1 max-w-sm">
                Nenhum problema encontrado para a categoria selecionada. A escala cumpre as regras trabalhistas.
              </p>
            </div>
          ) : (
            filteredIssues.map(issue => {
              const empObj = employees.find(e => e.id === issue.empId);
              const displayName = empObj ? empObj.name : issue.empName;

              return (
                <div
                  key={issue.id}
                  className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm ${
                        issue.type === 'consecutive_work'
                          ? 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                          : issue.type === 'consecutive_sunday'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                          : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      <Icon
                        name={
                          issue.type === 'sunday_understaffed'
                            ? 'groups'
                            : issue.type === 'consecutive_sunday'
                            ? 'wb_sunny'
                            : 'block'
                        }
                        className="text-xl"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-slate-900 dark:text-white uppercase">
                          {displayName}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            issue.type === 'consecutive_work'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : issue.type === 'consecutive_sunday'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          }`}
                        >
                          {issue.type === 'consecutive_work'
                            ? '7+ Dias Seguidos (6×1)'
                            : issue.type === 'consecutive_sunday'
                            ? '3+ Dom. Seguidos'
                            : 'Mínimo Domingo'}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300 mt-1">
                        {issue.detail}
                      </p>

                      {issue.fix && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/50 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300">
                          <Icon name="auto_fix_high" className="text-xs" />
                          <span>Sugestão: {issue.fix.label}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        onSelectDay(issue.dayIdx);
                        onClose();
                      }}
                      className="px-3 py-2 text-xs font-extrabold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-xl transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Icon name="arrow_forward" className="text-sm" />
                      Ver na Grade
                    </button>
                    {issue.fix && (
                      <button
                        onClick={() => handleApplyFix(issue)}
                        className="px-3 py-2 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-all shadow-md flex items-center gap-1"
                      >
                        <Icon name="check" className="text-sm" />
                        Aplicar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
          <span>* As regras analisam continuidades entre meses para garantir conformidade legal.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl font-bold transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
