import React, { useState, useEffect } from 'react';
import { Employee, InactiveReason, ROLE_METADATA_MAP, normalizeEmployeeRole } from '../types';
import { Icon } from './Icon';

interface DeactivateEmployeeModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (empId: string, reason: InactiveReason, effectiveDate: string) => void;
}

export const DeactivateEmployeeModal: React.FC<DeactivateEmployeeModalProps> = ({
  employee,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState<InactiveReason>('fim_contrato');
  const [effectiveDate, setEffectiveDate] = useState<string>('');

  useEffect(() => {
    if (employee && isOpen) {
      // Define motivo padrão baseado no tipo de contrato
      if (employee.contractType === 'Sazonal' || employee.isYoungApprentice) {
        setReason('fim_contrato');
      } else {
        setReason('demissao');
      }

      // Preenche a data efetiva: usa firedAt se já for passado/hoje, senão usa hoje para ocultar já no mês atual
      const today = new Date().toISOString().split('T')[0];
      setEffectiveDate(employee.firedAt && employee.firedAt <= today ? employee.firedAt : today);
    }
  }, [employee, isOpen]);

  if (!isOpen || !employee) return null;

  const role = normalizeEmployeeRole(employee.primaryRole || employee.cargo || employee.role);
  const meta = ROLE_METADATA_MAP[role];

  const handleConfirm = () => {
    if (!effectiveDate) return;
    onConfirm(employee.id, reason, effectiveDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
        {/* Header do Modal */}
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-inner">
              <Icon name="person_off" className="text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200/50 dark:border-rose-900/40">
                  Desativação de Colaborador
                </span>
                <span className="text-[10px] font-bold text-zinc-400">• Preserva Histórico</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight mt-0.5">
                {employee.name}
              </h3>
              <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>{meta.label}</span>
                <span>•</span>
                <span>{employee.contractType === 'Sazonal' ? 'Contrato Sazonal' : employee.isYoungApprentice ? 'Jovem Aprendiz' : 'CLT Efetivo'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* Card de Aviso / Garantia de Preservação de Dados */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 flex items-start gap-3">
            <Icon name="verified_user" className="text-amber-600 dark:text-amber-400 text-lg shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed font-medium">
              <strong className="font-black uppercase block tracking-wider text-[11px] mb-0.5 text-amber-950 dark:text-amber-200">
                Cadastro e Histórico 100% Preservados
              </strong>
              O cadastro não será apagado. Todas as escalas trabalhadas, folgas, relatórios e auditorias passadas continuam intactos no sistema. O colaborador poderá ser reativado a qualquer momento.
            </div>
          </div>

          {/* Seleção do Motivo */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase text-slate-600 dark:text-zinc-300 tracking-wider block">
              Motivo da Desativação:
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Opção: Fim de Contrato */}
              <label
                onClick={() => setReason('fim_contrato')}
                className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 select-none ${
                  reason === 'fim_contrato'
                    ? 'bg-orange-50/60 dark:bg-orange-950/30 border-orange-500 ring-2 ring-orange-500/20'
                    : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/60 hover:border-orange-300'
                }`}
              >
                <input
                  type="radio"
                  name="deactivate_reason"
                  checked={reason === 'fim_contrato'}
                  onChange={() => setReason('fim_contrato')}
                  className="mt-1 text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-900 dark:text-zinc-100">
                      Fim de Contrato / Término de Vigência
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 uppercase">
                      Temporário / Experiência
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 font-medium leading-normal">
                    Encerramento de contrato sazonal ou temporário, término de período de experiência ou conclusão de programa de aprendizagem.
                  </p>
                </div>
              </label>

              {/* Opção: Demissão / Desligamento */}
              <label
                onClick={() => setReason('demissao')}
                className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 select-none ${
                  reason === 'demissao'
                    ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-500 ring-2 ring-rose-500/20'
                    : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/60 hover:border-rose-300'
                }`}
              >
                <input
                  type="radio"
                  name="deactivate_reason"
                  checked={reason === 'demissao'}
                  onChange={() => setReason('demissao')}
                  className="mt-1 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-slate-900 dark:text-zinc-100">
                      Demissão / Rescisão Contratual
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 uppercase">
                      Desligamento
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 font-medium leading-normal">
                    Dispensa sem justa causa, pedido de demissão pelo colaborador ou rescisão contratual definitiva.
                  </p>
                </div>
              </label>

              {/* Opção: Outro */}
              <label
                onClick={() => setReason('outro')}
                className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 select-none ${
                  reason === 'outro'
                    ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-500 ring-2 ring-zinc-400/20'
                    : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/60 hover:border-zinc-300'
                }`}
              >
                <input
                  type="radio"
                  name="deactivate_reason"
                  checked={reason === 'outro'}
                  onChange={() => setReason('outro')}
                  className="mt-1 text-zinc-600 focus:ring-zinc-500"
                />
                <div>
                  <span className="text-xs font-black uppercase text-slate-900 dark:text-zinc-100 block">
                    Desativação Geral / Outro Motivo
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 font-medium leading-normal">
                    Encerramento administrativo ou afastamento definitivo do quadro de funcionários.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Campo de Data Efetiva de Desligamento */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase text-slate-600 dark:text-zinc-300 tracking-wider flex items-center justify-between">
              <span>Data do Desligamento / Último Dia:</span>
              <span className="text-rose-500 font-bold lowercase text-[10px]">*obrigatório</span>
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">
              💡 Os turnos dos dias <strong>posteriores a esta data</strong> serão preenchidos como <strong>N/A</strong> automaticamente. O colaborador não aparecerá em novos meses.
            </p>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="p-5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2.5 bg-slate-50/50 dark:bg-zinc-850/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold uppercase tracking-wider transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!effectiveDate}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Icon name="person_off" className="text-sm" />
            <span>Confirmar Desativação</span>
          </button>
        </div>
      </div>
    </div>
  );
};

