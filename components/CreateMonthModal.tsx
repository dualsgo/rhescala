import React, { useState } from 'react';
import { MonthYear } from '../types';
import { Icon } from './Icon';

interface CreateMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetMY: MonthYear;
  onConfirm: (mode: 'suggested_retro' | 'all_working') => void;
}

export const CreateMonthModal: React.FC<CreateMonthModalProps> = ({
  isOpen,
  onClose,
  targetMY,
  onConfirm,
}) => {
  const [selectedMode, setSelectedMode] = useState<'suggested_retro' | 'all_working'>('suggested_retro');

  if (!isOpen) return null;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const targetMonthName = monthNames[targetMY.month];

  const handleGenerate = () => {
    onConfirm(selectedMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm">
              <Icon name="auto_awesome" className="text-2xl" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                Criar Escala de {targetMonthName}/{targetMY.year}
              </h3>
              <p className="text-xs font-bold text-slate-400">Escolha o modelo de geração inicial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
            Selecione como a escala deve ser gerada:
          </label>

          {/* Opção 1: Sugerida Inteligente com Verificação Retroativa CLT */}
          <label
            onClick={() => setSelectedMode('suggested_retro')}
            className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${
              selectedMode === 'suggested_retro'
                ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/5'
                : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="createMode"
              checked={selectedMode === 'suggested_retro'}
              onChange={() => setSelectedMode('suggested_retro')}
              className="mt-1 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                  1. Escala Sugerida Inteligente (Retroativo CLT)
                </span>
                <span className="text-[9px] px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black rounded-md uppercase">
                  Recomendado
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Gera as folgas semanais a partir do <strong>último dia trabalhado no mês anterior</strong>:
              </p>
              <ul className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside font-medium">
                <li>Folga no dia 31 $\rightarrow$ trabalha de 1 a 6 e <strong>folga obrigatória no dia 7</strong>.</li>
                <li>Se trabalhou nos 2 últimos domingos anteriores $\rightarrow$ <strong>folga obrigatória no 1º domingo</strong>.</li>
                <li>Contratação no dia 1 $\rightarrow$ trabalha de 1 a 6 e <strong>folga no dia 7</strong>.</li>
                <li>Valida férias, atestados, aniversários e regras de aprendiz.</li>
              </ul>
            </div>
          </label>

          {/* Opção 2: 100% Trabalhada (Sem folgas automáticas) */}
          <label
            onClick={() => setSelectedMode('all_working')}
            className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${
              selectedMode === 'all_working'
                ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-500 shadow-md shadow-amber-500/5'
                : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="createMode"
              checked={selectedMode === 'all_working'}
              onChange={() => setSelectedMode('all_working')}
              className="mt-1 text-amber-600 focus:ring-amber-500"
            />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                  2. Escala Base 100% Trabalhada (Ajuste Manual)
                </span>
                <span className="text-[9px] px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-black rounded-md uppercase">
                  Manual
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Preenche <strong>todos os dias com turno de trabalho ("T")</strong> e horários diários oficiais, <strong>sem gerar folgas automáticas</strong>.
              </p>
              <ul className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside font-medium">
                <li>Ideal para quem prefere lançar as folgas manualmente uma a uma no grid.</li>
                <li>Preserva apenas férias ativas, atestados, aniversários e regras legais de aprendiz.</li>
              </ul>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black uppercase text-xs tracking-wider rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            <Icon name="check" className="text-base" /> Gerar Escala Agora
          </button>
        </div>
      </div>
    </div>
  );
};
