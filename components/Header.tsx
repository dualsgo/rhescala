import React, { useState } from 'react';
import { Icon } from './Icon';
import { MonthYear, SyncStatus, TacticalDisplayMode } from '../types';
import { ActionsOptionsModal } from './ActionsOptionsModal';

interface HeaderProps {
  currentView: string;
  currentMY: MonthYear;
  filter: 'all' | 'sunday' | 'holiday' | 'week';
  onViewChange: (view: any) => void;
  onMonthChange: (my: MonthYear) => void;
  onFilterChange: (f: any) => void;
  onShareWhatsApp: () => void;
  onShareApoioWhatsApp: () => void;
  syncStatus: SyncStatus;
  selectedDayIdx: number;
  // Action Props
  isReadOnly: boolean;
  isEditable: boolean;
  onToggleEdit: () => void;
  allowRetroactive: boolean;
  onToggleRetroactive: () => void;
  onPrint: () => void;
  onCreateMonth: () => void;
  onApplyFolgas: () => void;
  onSortearDomingo: () => void;
  onDistributePositions?: () => void;
  showNotes: boolean;
  onToggleNotes: () => void;
  canGoNext: boolean;
  sundayViolations: { empName: string, date: string }[];
  onLogout: () => void;
  onSwitchRole: () => void;
  onShowHelp: () => void;
  isValidated: boolean;
  onToggleValidation: () => void;
  pendingRequestsCount: number;
  inconsistencyCount?: number;
  onOpenInconsistencyModal?: () => void;
  diffCount?: number;
  onOpenDiffModal?: () => void;
  onOpenPresetModal?: () => void;
  onOptimizePeakWeek?: () => void;
  tacticalDisplayMode?: TacticalDisplayMode;
  onToggleTacticalDisplayMode?: (mode?: TacticalDisplayMode) => void;
  isSaving?: boolean;
  isJustSaved?: boolean;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: (open: boolean) => void;
  onExportCsv?: () => void;
  onManualSave?: () => void;
  contractFilter?: 'all' | 'clt' | 'sazonal';
  onContractFilterChange?: (c: 'all' | 'clt' | 'sazonal') => void;
  onlyWorkingToday?: boolean;
  onToggleOnlyWorkingToday?: () => void;
  selectedGroup?: string | null;
  onSelectedGroupChange?: (g: string | null) => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  onClearFilters?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  currentMY,
  filter,
  onViewChange,
  onMonthChange,
  onFilterChange,
  onShareWhatsApp,
  onShareApoioWhatsApp,
  syncStatus,
  selectedDayIdx,
  isReadOnly,
  isEditable,
  onToggleEdit,
  allowRetroactive,
  onToggleRetroactive,
  onPrint,
  onCreateMonth,
  onApplyFolgas,
  onSortearDomingo,
  onDistributePositions = () => {},
  onOptimizePeakWeek,
  showNotes,
  onToggleNotes,
  canGoNext,
  sundayViolations,
  onLogout,
  onSwitchRole,
  onShowHelp,
  isValidated,
  onToggleValidation,
  pendingRequestsCount,
  inconsistencyCount = 0,
  onOpenInconsistencyModal,
  diffCount = 0,
  onOpenDiffModal,
  onOpenPresetModal,
  tacticalDisplayMode = 'off',
  onToggleTacticalDisplayMode,
  onManualSave,
  isSaving = false,
  isJustSaved = false,
  isMobileMenuOpen,
  onToggleMobileMenu,
  onExportCsv,
  contractFilter = 'all',
  onContractFilterChange,
  onlyWorkingToday = false,
  onToggleOnlyWorkingToday,
  selectedGroup = null,
  onSelectedGroupChange,
  searchQuery = '',
  onSearchQueryChange,
  onClearFilters,
}) => {
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [internalMobileMenu, setInternalMobileMenu] = useState(false);
  const showMobileMenu = isMobileMenuOpen !== undefined ? isMobileMenuOpen : internalMobileMenu;
  const setShowMobileMenu = onToggleMobileMenu || setInternalMobileMenu;

  const activeFiltersCount = (
    (filter !== 'all' ? 1 : 0) +
    (contractFilter !== 'all' ? 1 : 0) +
    (onlyWorkingToday ? 1 : 0) +
    (selectedGroup ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0)
  );

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const currentMonthName = months[currentMY.month];

  const navItems = [
    { id: 'grid', label: 'Grade', icon: 'grid_view' },
    { id: 'analysis', label: 'Análise', icon: 'insights' },
    { id: 'requests', label: 'Solicitações', icon: 'assignment' },
  ];

  const operationsSections = [
    {
      title: 'Rotinas da Loja',
      items: [
        { id: 'cleaning', label: 'Limpeza da Copa', icon: 'cleaning_services' },
        { id: 'patrol', label: 'Ronda da Loja', icon: 'local_police' },
        { id: 'sections', label: 'Donos de Seção', icon: 'category' },
      ]
    },
    {
      title: 'Gestão Operacional',
      items: [
        { id: 'team', label: 'Equipe Operacional', icon: 'groups' },
        { id: 'jornada', label: 'Parâmetros de Jornada', icon: 'schedule' },
        { id: 'feriados', label: 'Feriados & Folgas', icon: 'event_busy' },
        { id: 'worked-holidays', label: 'Feriados Trabalhados', icon: 'list_alt' },
      ]
    },
    {
      title: 'Sistema & Dados',
      items: [
        { id: 'data', label: 'Banco de Dados & Backup', icon: 'storage' },
      ]
    }
  ];

  const configItems = operationsSections.flatMap(s => s.items);

  const renderFilterDropdown = () => {
    if (currentView !== 'grid') return null;

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowFilterMenu(!showFilterMenu);
            setShowConfigMenu(false);
            setShowShareMenu(false);
            setShowProfileMenu(false);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all shadow-xs ${
            activeFiltersCount > 0
              ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-600 dark:text-orange-400 font-black shadow-sm'
              : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-200 hover:border-orange-400'
          }`}
          title="Filtros da Escala (Turnos, Presença, Contrato e Período)"
        >
          <Icon name="tune" className={`text-sm ${activeFiltersCount > 0 ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>Filtros</span>
          {activeFiltersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
          <Icon name={showFilterMenu ? 'expand_less' : 'expand_more'} className="text-xs opacity-70" />
        </button>

        {showFilterMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full right-0 mt-2 w-80 max-w-[90vw] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150 text-slate-800 dark:text-slate-100"
          >
            {/* Header do Menu Filtros */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100">
                <Icon name="tune" className="text-sm text-orange-500" />
                <span>Filtros da Grade</span>
              </div>
              {activeFiltersCount > 0 && onClearFilters && (
                <button
                  type="button"
                  onClick={() => {
                    onClearFilters();
                  }}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:underline uppercase tracking-wider"
                >
                  Limpar Todos
                </button>
              )}
            </div>

            {/* 1. Busca rápida por nome */}
            {onSearchQueryChange && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Buscar Colaborador</label>
                <div className="relative">
                  <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type="text"
                    value={searchQuery || ''}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    placeholder="Nome do colaborador..."
                    className="w-full pl-7 pr-7 py-1.5 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchQueryChange('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 2. Período da Grade */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Período da Grade</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-zinc-800/70 p-1 rounded-xl">
                {[
                  { id: 'all', label: 'Mês Todo' },
                  { id: 'sunday', label: 'Domingos' },
                  { id: 'holiday', label: 'Feriados' }
                ].map(p => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => onFilterChange(p.id)}
                    className={`py-1 text-[11px] font-black uppercase rounded-lg transition-all text-center ${
                      filter === p.id
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Presença Diária */}
            {onToggleOnlyWorkingToday && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Presença no Dia</label>
                <button
                  type="button"
                  onClick={onToggleOnlyWorkingToday}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                    onlyWorkingToday
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name={onlyWorkingToday ? 'check_circle' : 'group'} className="text-sm text-emerald-600 dark:text-emerald-400" />
                    <span>Apenas quem trabalha no dia</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    onlyWorkingToday ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {onlyWorkingToday ? 'Ativo' : 'Todos'}
                  </span>
                </button>
              </div>
            )}

            {/* 4. Turnos da Equipe */}
            {onSelectedGroupChange && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Turno</label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-zinc-800/70 p-1 rounded-xl text-center">
                  <button
                    type="button"
                    onClick={() => onSelectedGroupChange(null)}
                    className={`col-span-2 py-1 text-[11px] font-black uppercase rounded-lg transition-all ${
                      !selectedGroup ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Todos os Turnos
                  </button>
                  {['Abertura', 'Intermediário', 'Fechamento', 'Folgas/Outros'].map(group => (
                    <button
                      type="button"
                      key={group}
                      onClick={() => onSelectedGroupChange(group)}
                      className={`py-1 text-[11px] font-bold rounded-lg transition-all ${
                        selectedGroup === group ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {group.split('/')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Tipo de Contrato */}
            {onContractFilterChange && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tipo de Contrato</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-zinc-800/70 p-1 rounded-xl">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'clt', label: 'CLT' },
                    { id: 'sazonal', label: 'Sazonais' }
                  ].map(c => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => onContractFilterChange(c.id as any)}
                      className={`py-1 text-[11px] font-black uppercase rounded-lg transition-all text-center ${
                        contractFilter === c.id
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="bg-white dark:bg-black border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-50 shadow-sm transition-colors h-14">
      {/* Backdrop overlay to prevent clicking behind open dropdowns */}
      {(showConfigMenu || showShareMenu || showProfileMenu || showFilterMenu) && (
        <div 
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[0.5px]" 
          onClick={(e) => {
            e.stopPropagation();
            setShowConfigMenu(false);
            setShowShareMenu(false);
            setShowProfileMenu(false);
            setShowFilterMenu(false);
          }}
        />
      )}

      <div className="flex items-center justify-between px-3 sm:px-4 h-full gap-2 sm:gap-4 max-w-full relative z-50">
        
        {/* Left: Brand on Mobile, Nav on Large Screens */}
        <div className="flex items-center gap-2 lg:gap-4">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-sm font-black text-xs">
              RH
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-tight text-slate-900 dark:text-slate-100 leading-none">Rhescala</span>
              <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 tracking-wider uppercase leading-none mt-0.5">
                {isReadOnly ? 'Colaborador' : 'Gestão'}
              </span>
            </div>
          </div>

          {!isReadOnly && (
            <nav className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200/50 dark:border-zinc-800">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id as any)}
                  className={`relative px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    currentView === item.id 
                      ? 'bg-white dark:bg-zinc-800 shadow-sm text-orange-600 dark:text-orange-400' 
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon name={item.icon} className="text-sm" />
                  <span>{item.label}</span>
                  {item.id === 'requests' && pendingRequestsCount > 0 && (
                    <span className="flex h-4 w-4 ml-0.5">
                      <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 items-center justify-center text-[8px] font-black text-white shadow-sm">
                        {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                      </span>
                    </span>
                  )}
                </button>
              ))}

              {/* Operações & Loja Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowConfigMenu(!showConfigMenu)}
                  onBlur={() => setTimeout(() => setShowConfigMenu(false), 200)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    ['team','jornada','data','feriados','worked-holidays','cleaning','patrol','sections'].includes(currentView) 
                      ? 'bg-white dark:bg-zinc-800 shadow-sm text-orange-600 dark:text-orange-400' 
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon name="tune" className="text-sm" />
                  <span>Operações & Loja</span>
                  <Icon name={showConfigMenu ? 'expand_less' : 'expand_more'} className="text-xs" />
                </button>

                {showConfigMenu && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-1 duration-150 space-y-2"
                  >
                    {operationsSections.map((section, sIdx) => (
                      <div key={section.title} className={sIdx > 0 ? 'pt-1.5 border-t border-slate-100 dark:border-zinc-800' : ''}>
                        <div className="px-2.5 py-1 text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                          {section.title}
                        </div>
                        <div className="space-y-0.5">
                          {section.items.map(item => (
                            <button
                              key={item.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                onViewChange(item.id as any);
                                setShowConfigMenu(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all text-left ${
                                currentView === item.id 
                                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold' 
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <Icon name={item.icon} className="text-base text-slate-400 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          )}
        </div>

        {/* Center: Month Selector, Status & Audit Badges */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Month Selector Box */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-900 rounded-xl p-0.5 sm:p-1 border border-slate-200/60 dark:border-zinc-800 shadow-inner">
            <button
              onClick={() => {
                let newMonth = currentMY.month - 1;
                let newYear = currentMY.year;
                if (newMonth < 0) {
                  newMonth = 11;
                  newYear--;
                }
                onMonthChange({ month: newMonth, year: newYear });
              }}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all"
              title="Mês Anterior"
            >
              <Icon name="chevron_left" className="text-sm sm:text-base" />
            </button>

            <div className="px-2 sm:px-3 text-center select-none">
              <span className="block text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                {currentMonthName}
              </span>
              <span className="block text-[8px] sm:text-[9px] font-bold text-slate-400 tracking-widest">
                {currentMY.year}
              </span>
            </div>

            <button
              onClick={() => {
                if (!canGoNext) return;
                let newMonth = currentMY.month + 1;
                let newYear = currentMY.year;
                if (newMonth > 11) {
                  newMonth = 0;
                  newYear++;
                }
                onMonthChange({ month: newMonth, year: newYear });
              }}
              disabled={!canGoNext}
              className={`p-1 sm:p-1.5 rounded-lg text-slate-500 transition-all ${
                canGoNext ? 'hover:bg-white dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer' : 'opacity-30 cursor-not-allowed'
              }`}
              title={canGoNext ? 'Próximo Mês' : 'Avanço restrito pelo perfil'}
            >
              <Icon name="chevron_right" className="text-sm sm:text-base" />
            </button>
          </div>

          {/* Scale Status: Official vs Draft (Desktop & Tablet) */}
          <button
            onClick={isReadOnly ? undefined : onToggleValidation}
            className={`hidden sm:flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border font-bold text-[10px] uppercase tracking-wider transition-all shadow-sm ${
              isValidated
                ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800'
            } ${isReadOnly ? 'cursor-default' : 'hover:scale-[1.02] active:scale-95'}`}
            title={isReadOnly ? 'Status da Escala' : (isValidated ? 'Oficializada! Clique para alternar para Rascunho' : 'Rascunho. Clique para oficializar escala')}
          >
            <Icon name={isValidated ? 'verified' : 'pending_actions'} className="text-xs sm:text-sm" />
            <span>{isValidated ? 'Oficial' : 'Rascunho'}</span>
          </button>

          {/* Audit Diff Badge (Desktop) */}
          {!isReadOnly && isValidated && onOpenDiffModal && diffCount > 0 && (
            <button
              onClick={onOpenDiffModal}
              className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border bg-amber-500 border-amber-600 text-white shadow-sm font-bold text-[10px] uppercase tracking-wider hover:scale-105 transition-all"
              title="Auditoria: Existem divergências em relação à versão oficial impressa"
            >
              <Icon name="difference" className="text-xs" />
              <span>{diffCount} {diffCount === 1 ? 'Alt.' : 'Alts.'}</span>
            </button>
          )}

          {/* Inconsistency / Violation Badge (Desktop) */}
          {!isReadOnly && onOpenInconsistencyModal && inconsistencyCount > 0 && (
            <button
              onClick={onOpenInconsistencyModal}
              className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border bg-rose-500 border-rose-600 text-white shadow-sm font-black text-[10px] uppercase tracking-wider animate-pulse hover:scale-105 transition-all"
              title="Central de Alertas e Regras CLT"
            >
              <Icon name="warning" className="text-xs" />
              <span>{inconsistencyCount} {inconsistencyCount === 1 ? 'Alerta' : 'Alertas'}</span>
            </button>
          )}
        </div>

        {/* Right: Desktop Actions (>= lg) or Minimal Viewer Actions */}
        {isReadOnly ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Indicador de Nuvem / Sync */}
            <div className="flex items-center px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/50 dark:border-zinc-700/50">
              <div className={`w-2 h-2 rounded-full ${
                syncStatus.state === 'idle' || syncStatus.state === 'synced' ? 'bg-emerald-500' :
                syncStatus.state === 'syncing' ? 'bg-amber-500 animate-pulse' :
                syncStatus.state === 'error' ? 'bg-rose-500' : 'bg-slate-400'
              }`} title={`Sincronização Nuvem: ${syncStatus.state}`} />
            </div>

            {/* Menu de Filtros (Colaborador) */}
            {renderFilterDropdown()}

            {/* Botão Acesso Gerencial (Admin) */}
            <button
              type="button"
              onClick={onSwitchRole}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-orange-50 hover:border-orange-300 dark:hover:bg-orange-950/40 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-xs"
              title="Entrar com a senha de Administrador/Gerente da loja"
            >
              <Icon name="admin_panel_settings" className="text-sm text-orange-500" />
              <span className="hidden sm:inline">Acesso Gerencial</span>
              <span className="inline sm:hidden">Admin</span>
            </button>

            {/* Sair da Conta */}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all shadow-xs"
              title="Sair do modo de visualização"
            >
              <Icon name="logout" className="text-sm" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-1.5 sm:gap-2">
            {/* Menu de Filtros (Gestão) */}
            {renderFilterDropdown()}
          
          {/* Botão de Salvar Manual com Atalho Ctrl+S */}
          {!isReadOnly && onManualSave && (
            <button
              onClick={onManualSave}
              disabled={isSaving}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all shadow-sm ${
                isJustSaved
                  ? 'bg-emerald-600 border-emerald-700 text-white shadow-emerald-500/30 scale-[1.02]'
                  : isSaving
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 hover:scale-[1.02] active:scale-95 shadow-emerald-500/20'
              }`}
              title="Salvar escala agora para garantir que as alterações sejam preservadas (Atalho: Ctrl+S)"
            >
              <Icon 
                name={isJustSaved ? 'check_circle' : isSaving ? 'sync' : 'save'} 
                className={`text-xs sm:text-sm ${isSaving ? 'animate-spin' : ''}`} 
              />
              <span className="inline">
                {isJustSaved ? 'Salvo!' : isSaving ? 'Salvando...' : 'Salvar'}
              </span>
              <span className="hidden xl:inline text-[8px] sm:text-[9px] opacity-80 bg-black/25 px-1 py-0.5 rounded font-mono">
                Ctrl+S
              </span>
            </button>
          )}

          {/* Botão Direto: Modo Edição */}
          {!isReadOnly && currentView === 'grid' && (
            <button
              type="button"
              onClick={onToggleEdit}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
                isEditable
                  ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-500/20'
                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-200 hover:border-indigo-300'
              }`}
              title={isEditable ? 'Modo de Edição Ativo: clique para bloquear edição das células' : 'Clique para ativar o modo de edição das células'}
            >
              <Icon name={isEditable ? 'lock_open' : 'edit'} className="text-xs sm:text-sm" />
              <span className="hidden sm:inline">{isEditable ? 'Edição Ativa' : 'Modo Edição'}</span>
              <span className="inline sm:hidden">{isEditable ? 'Edição' : 'Editar'}</span>
            </button>
          )}

          {/* Botão: Painel de Ações & Opções da Escala (Abre Modal) */}
          {!isReadOnly && currentView === 'grid' && (
            <button
              type="button"
              onClick={() => {
                setShowActionsModal(true);
                setShowShareMenu(false);
                setShowConfigMenu(false);
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all shadow-sm bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-200 hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-zinc-800"
              title="Abrir painel de ações inteligentes e opções da escala"
            >
              <Icon name="auto_fix_high" className="text-xs sm:text-sm text-orange-500" />
              <span className="hidden md:inline">Ações & Opções</span>
              <span className="inline md:hidden">Opções</span>
            </button>
          )}

          {/* 2. Menu: Compartilhar & Exportar (Segmentado) */}
          {!isReadOnly && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowShareMenu(!showShareMenu);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border shadow-sm ${
                  showShareMenu
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                }`}
                title="Opções de envio WhatsApp, impressão e PDF"
              >
                <Icon name="share" className="text-sm" />
                <span className="hidden md:inline">Compartilhar</span>
                <Icon name={showShareMenu ? 'expand_less' : 'expand_more'} className="text-xs" />
              </button>

              {showShareMenu && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  
                  {/* WhatsApp */}
                  <div>
                    <div className="px-2.5 py-1 text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest flex items-center gap-1">
                      <Icon name="chat" className="text-xs" />
                      <span>WhatsApp da Loja</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      <button
                        onClick={() => {
                          onShareWhatsApp();
                          setShowShareMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all text-left"
                      >
                        <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600">
                          <Icon name="send" className="text-sm" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[11px]">Escala do Dia</span>
                          <span className="text-[9px] text-slate-400">resumo diário para a equipe</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          onShareApoioWhatsApp();
                          setShowShareMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all text-left"
                      >
                        <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600">
                          <Icon name="assignment" className="text-sm" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[11px]">Apoio Operacional</span>
                          <span className="text-[9px] text-slate-400">postos P1 a P4 e cobertura</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-zinc-800" />

                  {/* Impressão e PDF */}
                  <div>
                    <div className="px-2.5 py-1 text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest flex items-center gap-1">
                      <Icon name="print" className="text-xs" />
                      <span>Documentos & Relatórios</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      <button
                        onClick={() => {
                          onPrint();
                          setShowShareMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-left"
                      >
                        <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600">
                          <Icon name="picture_as_pdf" className="text-sm" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[11px]">Imprimir / PDF</span>
                          <span className="text-[9px] text-slate-400">escala mensal impressa</span>
                        </div>
                      </button>

                      {onExportCsv && (
                        <button
                          onClick={() => {
                            onExportCsv();
                            setShowShareMenu(false);
                          }}
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all text-left group"
                          title="Salvar escala mensal em arquivo CSV para Excel e Google Sheets"
                        >
                          <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 group-hover:scale-105 transition-transform">
                            <Icon name="table_view" className="text-sm" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black uppercase text-[11px] text-emerald-700 dark:text-emerald-300">Salvar Escala (CSV)</span>
                            <span className="text-[9px] text-slate-400">planilha Excel / Google Sheets</span>
                          </div>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onToggleNotes();
                          setShowShareMenu(false);
                        }}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold transition-all text-left ${
                          showNotes ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600">
                          <Icon name="edit_note" className="text-sm" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[11px]">{showNotes ? 'Ocultar Recados' : 'Mural de Recados'}</span>
                          <span className="text-[9px] text-slate-400">anotações no rodapé</span>
                        </div>
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* 3. Indicador de Nuvem / Sync */}
          <div className="flex items-center px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/50 dark:border-zinc-700/50">
            <div className={`w-2 h-2 rounded-full ${
              syncStatus.state === 'idle' || syncStatus.state === 'synced' ? 'bg-emerald-500' :
              syncStatus.state === 'syncing' ? 'bg-amber-500 animate-pulse' :
              syncStatus.state === 'error' ? 'bg-rose-500' : 'bg-slate-400'
            }`} title={`Sincronização Nuvem: ${syncStatus.state}`} />
          </div>

          {/* 4. Menu do Usuário & Perfil */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              onBlur={() => setTimeout(() => setShowProfileMenu(false), 200)}
              className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all border border-slate-200 dark:border-zinc-700"
              title="Conta e Sessão"
            >
              <div className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center font-black text-[10px] uppercase shadow-sm">
                RH
              </div>
              <Icon name="expand_more" className="text-xs text-slate-400" />
            </button>

            {showProfileMenu && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <div className="px-3 py-2 border-b border-slate-100 dark:border-zinc-800 mb-1">
                  <span className="block text-xs font-black uppercase text-slate-800 dark:text-slate-200">Gestão Loja</span>
                  <span className="block text-[10px] font-bold text-slate-400">{isReadOnly ? 'Visualizador' : 'Administrador'}</span>
                </div>

                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onShowHelp();
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-left"
                >
                  <Icon name="badge" className="text-base text-orange-500" />
                  <span>Guia de Funções (Correlatas)</span>
                </button>

                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSwitchRole();
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-left"
                >
                  <Icon name="swap_horiz" className="text-base text-slate-400" />
                  <span>{isReadOnly ? 'Entrar como Admin' : 'Modo Visualizador'}</span>
                </button>

                <div className="h-px bg-slate-100 dark:bg-zinc-800 my-1" />

                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onLogout();
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-black uppercase text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all text-left"
                >
                  <Icon name="logout" className="text-base text-rose-500" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Right: Mobile Alerts & Menu Trigger (< lg) - Apenas Gestão */}
        {!isReadOnly && (
          <div className="flex items-center gap-1.5 lg:hidden">
            {isValidated && onOpenDiffModal && diffCount > 0 && (
              <button
                onClick={onOpenDiffModal}
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500 text-white font-black text-[10px] shadow-sm"
                title="Divergências pós-oficialização"
              >
                <Icon name="difference" className="text-xs" />
                <span>{diffCount}</span>
              </button>
            )}

            {onOpenInconsistencyModal && inconsistencyCount > 0 && (
              <button
                onClick={onOpenInconsistencyModal}
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-rose-500 text-white font-black text-[10px] shadow-sm animate-pulse"
                title="Alertas CLT"
              >
                <Icon name="warning" className="text-xs" />
                <span>{inconsistencyCount}</span>
              </button>
            )}

            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
              title="Menu da Loja"
            >
              <Icon name={showMobileMenu ? 'close' : 'menu'} className="text-lg" />
            </button>
          </div>
        )}

      </div>

      {/* Mobile Navigation Drawer Overlay - Apenas Gestão */}
      {!isReadOnly && showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm animate-fade-in flex flex-col justify-end">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl p-5 border-t border-slate-200 dark:border-zinc-800 max-h-[85vh] overflow-y-auto space-y-4 custom-scrollbar">
            {/* Handle */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-full mx-auto -mt-1 mb-2" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <span className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight block">
                  {isReadOnly ? 'Painel do Colaborador' : 'Menu Operacional'}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {isReadOnly ? 'Consulta rápida da escala' : 'Gestão de equipe e rotinas'}
                </span>
              </div>
              <button 
                onClick={() => setShowMobileMenu(false)} 
                className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800"
              >
                <Icon name="close" className="text-lg" />
              </button>
            </div>

            {isReadOnly ? (
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    onViewChange('grid');
                    setShowMobileMenu(false);
                  }}
                  className="w-full p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 flex items-center gap-3 text-xs font-black uppercase shadow-xs"
                >
                  <Icon name="calendar_month" className="text-lg text-orange-500" />
                  <span>Ver Grade da Escala</span>
                </button>

                <button
                  onClick={() => {
                    onViewChange('requests');
                    setShowMobileMenu(false);
                  }}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 flex items-center gap-3 text-xs font-black uppercase"
                >
                  <Icon name="assignment" className="text-lg text-slate-400" />
                  <span>Minhas Solicitações de Folga</span>
                </button>

                <button
                  onClick={() => {
                    onViewChange('feriados');
                    setShowMobileMenu(false);
                  }}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 flex items-center gap-3 text-xs font-black uppercase"
                >
                  <Icon name="event_busy" className="text-lg text-slate-400" />
                  <span>Feriados da Loja</span>
                </button>

                <button
                  onClick={() => {
                    onShowHelp();
                    setShowMobileMenu(false);
                  }}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 flex items-center gap-3 text-xs font-black uppercase"
                >
                  <Icon name="info" className="text-lg text-slate-400" />
                  <span>Manual & Regras</span>
                </button>

                <button
                  onClick={() => {
                    onSwitchRole();
                    setShowMobileMenu(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 flex items-center gap-3 text-xs font-black uppercase shadow-sm mt-3"
                >
                  <div className="p-1.5 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-600">
                    <Icon name="admin_panel_settings" className="text-base" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span>Acesso Gerencial</span>
                    <span className="text-[10px] font-normal text-slate-400 lowercase">entrar como administrador</span>
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* Destaque: Salvar Escala & Status Oficial */}
                <div className="space-y-2 bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80">
                  {onManualSave && (
                    <button
                      onClick={() => {
                        onManualSave();
                        setShowMobileMenu(false);
                      }}
                      disabled={isSaving}
                      className={`w-full p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase shadow-md transition-all ${
                        isJustSaved
                          ? 'bg-emerald-600 text-white'
                          : isSaving
                          ? 'bg-indigo-600 text-white animate-pulse'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Icon name={isJustSaved ? 'check_circle' : isSaving ? 'sync' : 'save'} className={`text-base ${isSaving ? 'animate-spin' : ''}`} />
                      <span>{isJustSaved ? 'Escala Salva com Sucesso!' : isSaving ? 'Salvando...' : 'Salvar Escala Agora'}</span>
                    </button>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Status da Escala:</span>
                    <button
                      type="button"
                      onClick={onToggleValidation}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border shadow-xs ${
                        isValidated
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                      }`}
                    >
                      <Icon name={isValidated ? 'verified' : 'pending_actions'} className="text-xs" />
                      <span>{isValidated ? 'Oficializada' : 'Modo Rascunho'}</span>
                    </button>
                  </div>
                </div>

                {/* Ações da Escala */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block px-1">
                    Ações da Escala
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setShowMobileMenu(false);
                        setShowActionsModal(true);
                      }}
                      className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 flex items-center gap-2 text-xs font-black uppercase shadow-xs text-left"
                    >
                      <Icon name="auto_fix_high" className="text-base text-orange-500 shrink-0" />
                      <span>Ações & Opções</span>
                    </button>

                    <button
                      onClick={() => {
                        onToggleEdit?.();
                        setShowMobileMenu(false);
                      }}
                      className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold uppercase transition-all ${
                        isEditable 
                          ? 'bg-indigo-600 text-white border-indigo-700' 
                          : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-zinc-700'
                      }`}
                    >
                      <Icon name={isEditable ? 'lock_open' : 'edit'} className="text-base shrink-0" />
                      <span>{isEditable ? 'Edição Ativa' : 'Modo Edição'}</span>
                    </button>
                  </div>
                </div>

                {/* Rotinas da Loja */}
                {operationsSections.map(sec => (
                  <div key={sec.title} className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block px-1">
                      {sec.title}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {sec.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            onViewChange(item.id as any);
                            setShowMobileMenu(false);
                          }}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold text-left transition-all ${
                            currentView === item.id
                              ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                              : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-zinc-700/80'
                          }`}
                        >
                          <Icon name={item.icon} className={`text-sm shrink-0 ${currentView === item.id ? 'text-white' : 'text-slate-400'}`} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Sessão */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                  <button
                    onClick={() => {
                      onSwitchRole();
                      setShowMobileMenu(false);
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Icon name="visibility" className="text-base text-slate-400" />
                    <span>Alternar para Modo Colaborador</span>
                  </button>

                  <button
                    onClick={() => {
                      onLogout();
                      setShowMobileMenu(false);
                    }}
                    className="w-full p-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Icon name="logout" className="text-base text-rose-500" />
                    <span>Sair da Conta</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Ações & Opções da Escala (Sem sobreposição falha sobre a grade) */}
      <ActionsOptionsModal
        isOpen={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        currentMY={currentMY}
        isEditable={isEditable}
        onToggleEdit={onToggleEdit}
        allowRetroactive={allowRetroactive}
        onToggleRetroactive={onToggleRetroactive}
        onCreateMonth={onCreateMonth}
        onOpenPresetModal={onOpenPresetModal}
        onApplyFolgas={onApplyFolgas}
        onSortearDomingo={onSortearDomingo}
        onDistributePositions={onDistributePositions}
        onOptimizePeakWeek={onOptimizePeakWeek}
        tacticalDisplayMode={tacticalDisplayMode}
        onToggleTacticalDisplayMode={onToggleTacticalDisplayMode}
        onExportCsv={onExportCsv}
      />
    </header>
  );
};
