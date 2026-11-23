import React, { useEffect, useState } from 'react';
import { Badge, Button, Dialog, DialogHeader } from '@astryxdesign/core';
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

const BADGE_VARIANT: Record<RefreshChangeKind, 'warning' | 'info' | 'neutral' | 'success'> = {
  missing_schedule: 'warning',
  legal_override: 'info',
  hours_sync: 'neutral',
  shift_name_sync: 'success',
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

  if (!analysis) return null;

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
    <div data-astryx-theme="neutral">
      <Dialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        purpose="form"
        width={680}
        maxHeight="90dvh"
        padding={0}
      >
        <div className="flex flex-col max-h-[90dvh] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <DialogHeader
              title="Atualizar Informações da Grade"
              subtitle={`Referência: ${monthLabel}`}
              onOpenChange={(open) => {
                if (!open) onClose();
              }}
            />
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-4">
            {contextBanner && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <Icon name="info" className="text-base text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>{contextBanner}</span>
              </div>
            )}

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
                          <Badge variant={BADGE_VARIANT[chg.kind]} label={chg.label} />
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
              <Button variant="secondary" size="sm" label="Cancelar" onClick={onClose} />
              <Button
                variant="primary"
                size="sm"
                label="Confirmar Atualização"
                isDisabled={!canConfirm}
                onClick={() => onConfirm(generateIds)}
              />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
