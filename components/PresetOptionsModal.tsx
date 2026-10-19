import React, { useState } from 'react';
import { Employee, MonthYear, Holiday, JornadaSettings } from '../types';
import { Icon } from './Icon';

interface PresetOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  currentMY: MonthYear;
  initialEmployeeId?: string | null;
  onApply: (options: {
    scope: 'all' | 'single';
    targetEmpId?: string;
    applyMode: 'hours_only' | 'folgas_only' | 'full';
  }) => void;
}

export const PresetOptionsModal: React.FC<PresetOptionsModalProps> = ({
  isOpen,
  onClose,
  employees,
  currentMY,
  initialEmployeeId,
  onApply,
}) => {
  const [scope, setScope] = useState<'all' | 'single'>(initialEmployeeId ? 'single' : 'all');
  const [selectedEmpId, setSelectedEmpId] = useState<string>(initialEmployeeId || (employees[0]?.id || ''));
  const [applyMode, setApplyMode] = useState<'hours_only' | 'folgas_only' | 'full'>('hours_only');

  if (!isOpen) return null;

  const activeEmployees = employees.filter(e => e.status === 'active' && !e.isHidden);
  const targetEmployee = employees.find(e => e.id === selectedEmpId);

  const handleConfirm = () => {
    onApply({
      scope,
      targetEmpId: scope === 'single' ? selectedEmpId : undefined,
      applyMode,
    });
    onClose();
  };

  const monthName = new Date(currentMY.year, currentMY.month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] max-w-lg w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Icon name="tune" className="text-xl" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">
                Aplicar Pré-definições
              </h3>
              <p className="text-xs font-bold text-slate-400 capitalize">{monthName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-slate-400"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          {/* Escolha do Escopo */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2 block">
              1. Para quem deseja aplicar?
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  scope === 'all'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                }`}
              >
                <Icon name="groups" className="text-base" /> Toda a Equipe
              </button>
              <button
                type="button"
                onClick={() => setScope('single')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  scope === 'single'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                }`}
              >
                <Icon name="person" className="text-base" /> Individual
              </button>
            </div>

            {scope === 'single' && (
              <div className="mt-3 animate-fade-in">
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.workPeriod || 'Sem horário'} - {emp.cargo || 'Atendente'})
                    </option>
                  ))}
                </select>
                {targetEmployee && (
                  <p className="text-[10px] text-slate-400 mt-1 font-medium italic">
                    Horário padrão atual: <strong>{targetEmployee.workPeriod}</strong> | Folga preferencial: <strong>{targetEmployee.preferredDayOff || 'Não definida'}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Escolha do que Aplicar */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2 block">
              2. O que você deseja recalcular?
            </label>
            <div className="space-y-2">
              {/* Só Horários */}
              <label
                onClick={() => setApplyMode('hours_only')}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  applyMode === 'hours_only'
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500/50 shadow-sm'
                    : 'bg-white dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="applyMode"
                  checked={applyMode === 'hours_only'}
                  onChange={() => setApplyMode('hours_only')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-800 dark:text-zinc-100">Apenas Horários Diários</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-black rounded-md uppercase">Seguro</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Atualiza os horários de entrada/saída conforme o padrão do colaborador, <strong>mantendo todas as folgas, férias e atestados 100% intactos</strong>.
                  </p>
                </div>
              </label>

              {/* Só Folgas */}
              <label
                onClick={() => setApplyMode('folgas_only')}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  applyMode === 'folgas_only'
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500/50 shadow-sm'
                    : 'bg-white dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="applyMode"
                  checked={applyMode === 'folgas_only'}
                  onChange={() => setApplyMode('folgas_only')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <span className="text-xs font-black text-slate-800 dark:text-zinc-100">Apenas Folgas e Domingos</span>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Recalcula as folgas semanais e a rotação de domingos, <strong>mantendo os horários diários customizados já existentes</strong>.
                  </p>
                </div>
              </label>



              {/* Completo */}
              <label
                onClick={() => setApplyMode('full')}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  applyMode === 'full'
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500/50 shadow-sm'
                    : 'bg-white dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="applyMode"
                  checked={applyMode === 'full'}
                  onChange={() => setApplyMode('full')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <span className="text-xs font-black text-slate-800 dark:text-zinc-100">Redefinição Geral Completa</span>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Aplica o algoritmo padrão de geração completa (folgas, horários de loja e rotação de domingos).
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-black uppercase text-xs tracking-wider rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            <Icon name="check" className="text-base" /> Aplicar Agora
          </button>
        </div>
      </div>
    </div>
  );
};
