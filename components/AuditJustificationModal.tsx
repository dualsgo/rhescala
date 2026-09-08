import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { AuditChangeType } from '../types';

export interface AuditImpactPreview {
  empId: string;
  empName: string;
  dayIdx: number;
  dateStr: string;
  beforeVal: string;
  afterVal: string;
  changeType: AuditChangeType;
  humanDescription: string;
}

interface AuditJustificationModalProps {
  isOpen: boolean;
  impacts: AuditImpactPreview[];
  onConfirm: (justification: string) => void;
  onCancel: () => void;
}

const PRESET_CHIPS = [
  'Ajuste de cobertura',
  'Troca solicitada pelo colaborador',
  'Reorganização da equipe',
  'Ajuste operacional',
  'Cobertura de ausência',
  'Atendimento a demanda de pico',
];

export const AuditJustificationModal: React.FC<AuditJustificationModalProps> = ({
  isOpen,
  impacts,
  onConfirm,
  onCancel,
}) => {
  const [justification, setJustification] = useState('');
  const [customError, setCustomError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setJustification('Ajuste de cobertura');
      setCustomError('');
    }
  }, [isOpen]);

  if (!isOpen || impacts.length === 0) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = justification.trim();
    if (!trimmed) {
      setCustomError('Por favor, informe uma justificativa curta.');
      return;
    }
    onConfirm(trimmed);
  };

  const isMulti = impacts.length > 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <Icon name="verified" className="text-xl" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                Alteração em Escala Oficializada
              </h3>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Esta mudança afeta o compromisso oficial comunicado à equipe.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title="Cancelar alteração"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Impact summary */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center justify-between">
              <span>{isMulti ? `Colaboradores Afetados (${impacts.length})` : 'Alteração na Escala'}</span>
              <span className="text-orange-600 dark:text-orange-400 font-bold">Rastreabilidade Ativa</span>
            </label>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {impacts.map((imp, idx) => (
                <div 
                  key={`${imp.empId}-${imp.dayIdx}-${idx}`}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700/60 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 truncate">
                      {imp.empName}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] whitespace-nowrap">
                      Dia {imp.dateStr}
                    </span>
                  </div>

                  {/* Before ➔ After badges */}
                  <div className="flex items-center gap-2 text-[11px] font-semibold flex-wrap">
                    <span className="px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-black border border-rose-200 dark:border-rose-900/50 line-through opacity-80">
                      {imp.beforeVal}
                    </span>
                    <Icon name="arrow_forward" className="text-xs text-slate-400 shrink-0" />
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
                      {imp.afterVal}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic">
                    {imp.humanDescription}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Justification Chips */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
              Motivo da Alteração (Clique para preencher rápido)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_CHIPS.map((chip) => {
                const isSelected = justification === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setJustification(chip);
                      setCustomError('');
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                      isSelected
                        ? 'bg-orange-500 text-white shadow-sm scale-[1.02]'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Justification Input */}
          <div className="space-y-1">
            <input
              type="text"
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                if (e.target.value.trim()) setCustomError('');
              }}
              placeholder="Digite ou selecione o motivo da alteração..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-medium text-xs outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
              autoFocus
            />
            {customError && (
              <p className="text-[11px] text-rose-500 font-bold px-1">
                {customError}
              </p>
            )}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 px-1">
              Esta justificativa ficará visível no histórico individual do colaborador afetado e na auditoria geral.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-orange-600/20 active:scale-95"
            >
              <Icon name="check" className="text-sm" />
              <span>Confirmar Alteração</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
