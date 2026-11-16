import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { MonthRefreshAnalysis, RefreshChangeKind } from '../src/engine/orchestration/refresh-month';

interface RefreshMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthLabel: string;
  analysis: MonthRefreshAnalysis | null;
  contextBanner?: string | null;
  onConfirm: (generateForEmpIds: string[]) => void;
}

const BADGE_STYLE: Record<RefreshChangeKind, string> = {
  missing_schedule: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  legal_override: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
  hours_sync: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
  shift_name_sync: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
};

export const RefreshMonthModal: React.FC<RefreshMonthModalProps> = ({
  isOpen,
  onClose,
  monthLabel,
  analysis,
  contextBanner,
  onConfirm,
}) => {
  const [selectedGenerateIds, setSelectedGenerateIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen || !analysis) return;
    const defaults: Record<string, boolean> = {};
    analysis.previews.forEach(p => {
      if (p.hasMissingSchedule) defaults[p.empId] = true;
    });
    setSelectedGenerateIds(defaults);
  }, [isOpen, analysis]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !analysis) return null;

  const generateIds = Object.entries(selectedGenerateIds)
    .filter(([, checked]) => checked)
    .map(([id]) => id);

  const hasNonMissingChanges = analysis.previews.some(p =>
    p.changes.some(c => c.kind !== 'missing_schedule')
  );
  const canConfirm = generateIds.length > 0 || hasNonMissingChanges;

  const toggleGenerateId = (empId: string) => {
    setSelectedGenerateIds(prev => ({ ...prev, [empId]: !prev[empId] }));
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refresh-modal-title"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Icon name="sync" className="text-xl" />
            </div>
            <div>
              <h2 id="refresh-modal-title" className="text-base font-black text-zinc-900 dark:text-white tracking-tight">
                Atualizar Informações da Grade
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Referência: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{monthLabel}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {contextBanner && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <Icon name="info" className="text-base text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>{contextBanner}</span>
            </div>
          )}

          {/* Explicação de segurança */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed space-y-1">
            <p className="font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
              <Icon name="verified_user" className="text-sm text-emerald-500" />
              O que será atualizado com segurança:
            </p>
            <p>
              Esta atualização sincroniza mudanças feitas na aba <strong>Equipe</strong> (turno/horário padrão, férias, atestados, aniversários e vigência de contrato) <strong>sem apagar as folgas manuais</strong> de quem já está escalado. Caso exista alguém sem escala ou sem folgas (ex.: colaborador reexibido), você escolhe abaixo se deseja gerar a escala sugerida apenas para ele.
            </p>
          </div>

          {!analysis.hasAnyChanges ? (
            <div className="py-8 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <Icon name="check_circle" className="text-2xl" />
              </div>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">Tudo já está atualizado!</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                Nenhuma divergência foi encontrada entre o cadastro da Equipe e a grade de {monthLabel}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Prévia das alterações ({analysis.previews.length} colaborador{analysis.previews.length > 1 ? 'es' : ''})
              </p>

              {analysis.previews.map(item => (
                <div
                  key={item.empId}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{item.empName}</span>
                    {item.hasMissingSchedule && (
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300 cursor-pointer select-none bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-500/30">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedGenerateIds[item.empId])}
                          onChange={() => toggleGenerateId(item.empId)}
                          className="rounded border-amber-400 text-orange-600 focus:ring-orange-500"
                        />
                        Gerar escala sugerida só para este colaborador
                      </label>
                    )}
                  </div>

                  <ul className="space-y-1.5">
                    {item.changes.map((chg, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${BADGE_STYLE[chg.kind]}`}>
                          {chg.label}
                        </span>
                        <span className="leading-relaxed">{chg.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/90 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Icon name="undo" className="text-xs" />
            Alterações podem ser desfeitas com Ctrl+Z
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => onConfirm(generateIds)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Icon name="check" className="text-sm" />
              Confirmar Atualização
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
