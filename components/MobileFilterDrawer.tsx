import React from 'react';
import { Icon } from './Icon';

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // Filters
  onlyWorkingToday: boolean;
  setOnlyWorkingToday: (val: boolean) => void;
  selectedGroup: string | null;
  setSelectedGroup: (val: string | null) => void;
  contractFilter: 'all' | 'clt' | 'sazonal';
  setContractFilter: (val: 'all' | 'clt' | 'sazonal') => void;
  tacticalDisplayMode?: 'positions' | 'roles' | 'off';
  onToggleTacticalDisplayMode?: (mode: 'positions' | 'roles' | 'off') => void;
  isCompactMode: boolean;
  setIsCompactMode: (val: boolean) => void;
  hidePastDays: boolean;
  setHidePastDays: (val: boolean) => void;
  isCurrentMonth: boolean;
  // Search
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onResetFilters: () => void;
}

export const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  isOpen,
  onClose,
  onlyWorkingToday,
  setOnlyWorkingToday,
  selectedGroup,
  setSelectedGroup,
  contractFilter,
  setContractFilter,
  tacticalDisplayMode = 'positions',
  onToggleTacticalDisplayMode,
  isCompactMode,
  setIsCompactMode,
  hidePastDays,
  setHidePastDays,
  isCurrentMonth,
  searchQuery,
  setSearchQuery,
  onResetFilters,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in lg:hidden">
      <div 
        className="w-full max-h-[85vh] bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up border-t border-slate-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar for touch */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-full mx-auto mt-3 mb-1" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Icon name="tune" className="text-orange-500 text-xl" />
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              Filtros da Escala
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {/* Busca Rápida por Nome */}
          <div>
            <label className="text-xs font-black uppercase text-slate-400 tracking-wider block mb-2">
              Buscar Colaborador
            </label>
            <div className="relative">
              <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nome do colaborador..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-zinc-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-zinc-700 focus:outline-none focus:border-orange-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                >
                  <Icon name="close" className="text-sm" />
                </button>
              )}
            </div>
          </div>

          {/* Presença Diária */}
          <div>
            <label className="text-xs font-black uppercase text-slate-400 tracking-wider block mb-2">
              Presença no Dia
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOnlyWorkingToday(false)}
                className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  !onlyWorkingToday 
                    ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-600 dark:text-orange-400 shadow-sm' 
                    : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon name="groups" className="text-base" />
                <span>Todos da Equipe</span>
              </button>
              <button
                type="button"
                onClick={() => setOnlyWorkingToday(true)}
                className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  onlyWorkingToday 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                    : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon name="check_circle" className="text-base" />
                <span>Apenas Escalados Hoje</span>
              </button>
            </div>
          </div>

          {/* Turno do Colaborador */}
          <div>
            <label className="text-xs font-black uppercase text-slate-400 tracking-wider block mb-2">
              Turno Predominante
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: null, label: 'Todos os Turnos', icon: 'all_inclusive' },
                { id: 'abertura', label: 'Abertura (A)', icon: 'wb_sunny' },
                { id: 'intermediario', label: 'Intermediário (I)', icon: 'wb_twilight' },
                { id: 'fechamento', label: 'Fechamento (F)', icon: 'nights_stay' },
                { id: 'folgas', label: 'Folgas no Dia', icon: 'beach_access' },
              ].map(t => (
                <button
                  key={t.id ?? 'all'}
                  type="button"
                  onClick={() => setSelectedGroup(t.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${
                    selectedGroup === t.id 
                      ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-600 dark:text-orange-400 shadow-sm' 
                      : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon name={t.icon} className="text-base shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de Contrato */}
          <div>
            <label className="text-xs font-black uppercase text-slate-400 tracking-wider block mb-2">
              Tipo de Contrato
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'clt', label: 'CLT' },
                { id: 'sazonal', label: 'Sazonal' },
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setContractFilter(c.id as any)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                    contractFilter === c.id 
                      ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-600 dark:text-orange-400 shadow-sm' 
                      : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>



          {/* Outras Opções */}
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
            {isCurrentMonth && (
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 cursor-pointer">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Ocultar Dias Passados</span>
                <input
                  type="checkbox"
                  checked={hidePastDays}
                  onChange={(e) => setHidePastDays(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400 cursor-pointer"
                />
              </label>
            )}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 cursor-pointer">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Espaçamento Compacto / Denso</span>
              <input
                type="checkbox"
                checked={isCompactMode}
                onChange={(e) => setIsCompactMode(e.target.checked)}
                className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center gap-3">
          <button
            type="button"
            onClick={onResetFilters}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Limpar Filtros
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase shadow-md shadow-orange-500/20 transition-all"
          >
            Ver Resultados
          </button>
        </div>
      </div>
    </div>
  );
};
