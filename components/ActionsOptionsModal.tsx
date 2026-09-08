import React from 'react';
import { MonthYear, TacticalDisplayMode } from '../types';
import { Icon } from './Icon';

interface ActionsOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMY: MonthYear;
  isEditable: boolean;
  onToggleEdit: () => void;
  allowRetroactive: boolean;
  onToggleRetroactive: () => void;
  onCreateMonth: () => void;
  onOpenPresetModal?: () => void;
  onApplyFolgas: () => void;
  onSortearDomingo: () => void;
  onDistributePositions: () => void;
  onOptimizePeakWeek?: () => void;
  tacticalDisplayMode?: TacticalDisplayMode;
  onToggleTacticalDisplayMode?: (mode?: TacticalDisplayMode) => void;
}

export const ActionsOptionsModal: React.FC<ActionsOptionsModalProps> = ({
  isOpen,
  onClose,
  currentMY,
  isEditable,
  onToggleEdit,
  allowRetroactive,
  onToggleRetroactive,
  onCreateMonth,
  onOpenPresetModal,
  onApplyFolgas,
  onSortearDomingo,
  onDistributePositions,
  onOptimizePeakWeek,
  tacticalDisplayMode = 'positions',
  onToggleTacticalDisplayMode,
}) => {
  if (!isOpen) return null;

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const currentMonthName = months[currentMY.month];

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
              <Icon name="auto_fix_high" className="text-xl" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                Ações & Opções da Escala
              </h3>
              <p className="text-[11px] font-bold text-slate-400">
                {currentMonthName} de {currentMY.year}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-xl transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Fechar"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          
          {/* Seção 1: Modos de Edição da Grade */}
          <div>
            <div className="px-1 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest flex items-center gap-1.5 mb-2.5">
              <Icon name="tune" className="text-xs" />
              <span>Controles de Edição da Grade</span>
            </div>

            <div className="space-y-2">
              {/* Toggle: Modo Edição */}
              <div 
                onClick={onToggleEdit}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                  isEditable 
                    ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 shadow-sm' 
                    : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200/70 dark:border-zinc-700/60 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isEditable ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-300'}`}>
                    <Icon name={isEditable ? 'edit' : 'edit_off'} className="text-base" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">Modo Edição</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        isEditable ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {isEditable ? 'Ativo' : 'Bloqueado'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Permite alterar células, turnos e horários na grade
                    </span>
                  </div>
                </div>
                
                <div className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${isEditable ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-zinc-600'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${isEditable ? 'left-6' : 'left-1'}`} />
                </div>
              </div>

              {/* Toggle: Edição Retroativa */}
              <div 
                onClick={onToggleRetroactive}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                  allowRetroactive 
                    ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 shadow-sm' 
                    : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200/70 dark:border-zinc-700/60 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${allowRetroactive ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-300'}`}>
                    <Icon name={allowRetroactive ? 'history' : 'history_toggle_off'} className="text-base" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">Edição Retroativa</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        allowRetroactive ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {allowRetroactive ? 'Permitido' : 'Protegido'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Permite editar dias anteriores a hoje no mês corrente
                    </span>
                  </div>
                </div>

                <div className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${allowRetroactive ? 'bg-amber-500' : 'bg-slate-300 dark:bg-zinc-600'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${allowRetroactive ? 'left-6' : 'left-1'}`} />
                </div>
              </div>

              {/* Formato da Escala */}
              {onToggleTacticalDisplayMode && (
                <div className="p-3 rounded-2xl border border-slate-200/70 dark:border-zinc-700/60 bg-slate-50 dark:bg-zinc-800/60 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Icon name="badge" className="text-sm text-orange-500" />
                        Visualização da Escala
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Alternar entre códigos táticos, funções ou padrão
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 dark:bg-zinc-900 rounded-xl mt-1">
                    <button
                      type="button"
                      onClick={() => onToggleTacticalDisplayMode('positions')}
                      className={`py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                        tacticalDisplayMode === 'positions'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>🏷️ Posições</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => onToggleTacticalDisplayMode('roles')}
                      className={`py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                        tacticalDisplayMode === 'roles'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>👔 Funções</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleTacticalDisplayMode('off')}
                      className={`py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                        tacticalDisplayMode === 'off'
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>🔘 Padrão (T)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-zinc-800" />

          {/* Seção 2: Automação & Geração Inteligente */}
          <div>
            <div className="px-1 text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-widest flex items-center gap-1.5 mb-2.5">
              <Icon name="psychology" className="text-xs" />
              <span>Automações & Inteligência</span>
            </div>

            <div className="space-y-2">
              {/* Criar Próximo Mês */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateMonth();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-100/60 dark:hover:bg-orange-950/40 text-left transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                  <Icon name="add_circle" className="text-xl" />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-black uppercase text-orange-700 dark:text-orange-300">
                    Criar Novo Mês
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Gera escala sugerida ou base com análise retroativa CLT
                  </span>
                </div>
                <Icon name="chevron_right" className="text-orange-400 group-hover:translate-x-0.5 transition-transform shrink-0 text-base" />
              </button>

              {/* Aplicar Pré-definições */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenPresetModal) onOpenPresetModal();
                  else onApplyFolgas();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/40 text-left transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                  <Icon name="tune" className="text-xl" />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-300">
                    Aplicar Pré-definições
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Reaplicar seletivamente apenas horários, folgas ou posições
                  </span>
                </div>
                <Icon name="chevron_right" className="text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0 text-base" />
              </button>

              {/* Sortear Domingos CLT */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSortearDomingo();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800 text-left transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                  <Icon name="casino" className="text-xl" />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                    Sortear Domingos CLT
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Revezamento com limite de 2 domingos consecutivos
                  </span>
                </div>
                <Icon name="chevron_right" className="text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 text-base" />
              </button>

              {/* Distribuir Posições Táticas */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDistributePositions();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40 text-left transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                  <Icon name="view_in_ar" className="text-xl" />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-300">
                    Distribuir Posições Táticas
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Aloca P1 a P4 e Estoque respeitando abertura e fechamento
                  </span>
                </div>
                <Icon name="chevron_right" className="text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0 text-base" />
              </button>

              {/* Dias Protegidos & Limite de Folgas */}
              {onOptimizePeakWeek && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOptimizePeakWeek();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 text-left transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                    <Icon name={currentMY.month === 9 ? 'celebration' : 'shield'} className="text-xl" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">
                      Dias Protegidos & Limite de Folgas
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Definir teto de folgas em datas sazonais e de alta demanda
                    </span>
                  </div>
                  <Icon name="chevron_right" className="text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0 text-base" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-wider hover:opacity-90 transition-opacity shadow-sm"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
