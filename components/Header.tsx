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
  onClearFilters?: () => void;
  densityMode?: 'clean' | 'audit';
  onToggleDensityMode?: () => void;
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
  onClearFilters,
  densityMode = 'clean',
  onToggleDensityMode,
}) => {
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showPublishMenu, setShowPublishMenu] = useState(false);
  const [internalMobileMenu, setInternalMobileMenu] = useState(false);
  const showMobileMenu = isMobileMenuOpen !== undefined ? isMobileMenuOpen : internalMobileMenu;
  const setShowMobileMenu = onToggleMobileMenu || setInternalMobileMenu;

  const activeFiltersCount = (
    (filter !== 'all' ? 1 : 0) +
    (contractFilter !== 'all' ? 1 : 0) +
    (onlyWorkingToday ? 1 : 0) +
    (selectedGroup ? 1 : 0)
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
              : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:border-orange-400'
          }`}
          aria-label={`Filtros da Escala${activeFiltersCount > 0 ? ` (${activeFiltersCount} ativo${activeFiltersCount === 1 ? '' : 's'})` : ''}`}
          title="Filtros da Escala (Turnos, Presença, Contrato e Período)"
        >
          <Icon name="tune" className={`text-sm shrink-0 ${activeFiltersCount > 0 ? 'text-orange-500' : 'text-slate-500 dark:text-zinc-400'}`} />
          <span>Filtros</span>
          {activeFiltersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center shrink-0">
              {activeFiltersCount}
            </span>
          )}
          <Icon name={showFilterMenu ? 'expand_less' : 'expand_more'} className="text-xs opacity-70 shrink-0" />
        </button>

        {showFilterMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full right-0 mt-2 w-80 max-w-[90vw] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150 text-slate-800 dark:text-zinc-100"
          >
            {/* Header do Menu Filtros */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-slate-800 dark:text-zinc-100">
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
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-slate-200'
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
                      : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name={onlyWorkingToday ? 'check_circle' : 'group'} className="text-sm text-emerald-600 dark:text-emerald-400" />
                    <span>Apenas quem trabalha no dia</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    onlyWorkingToday ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'
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
                      !selectedGroup ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
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
                        selectedGroup === group ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
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
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-slate-200'
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
    <header className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50 shadow-sm transition-colors h-14">
      {/* Backdrop overlay to prevent clicking behind open dropdowns */}
      {(showConfigMenu || showShareMenu || showProfileMenu || showFilterMenu || showActionsMenu || showPublishMenu) && (
        <div 
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[0.5px]" 
          onClick={(e) => {
            e.stopPropagation();
            setShowConfigMenu(false);
            setShowShareMenu(false);
            setShowProfileMenu(false);
            setShowFilterMenu(false);
            setShowActionsMenu(false);
            setShowPublishMenu(false);
          }}
        />
      )}

      <div className="flex items-center justify-between px-2 sm:px-4 h-full gap-2 sm:gap-3 max-w-full relative z-50">
        
        {/* ============================================================== */}
        {/* BLOCO 1 (ESQUERDA): CONTEXTO & STATUS                          */}
        {/* Logo/Loja + Seletor Mês/Ano (40px) + Sincronização + Status    */}
        {/* ============================================================== */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Logo / Loja */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-sm font-black text-xs shrink-0">
              RH
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">Rhescala</span>
              <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 tracking-wider uppercase leading-none mt-0.5">
                {isReadOnly ? 'Colaborador' : 'Gestão'}
              </span>
            </div>
          </div>

          {/* Seletor de Mês/Ano (com botões < e > de min-h-[40px] min-w-[40px]) */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-xl p-0.5 border border-zinc-200/80 dark:border-zinc-800 shadow-inner">
            <button
              type="button"
              onClick={() => {
                let newMonth = currentMY.month - 1;
                let newYear = currentMY.year;
                if (newMonth < 0) {
                  newMonth = 11;
                  newYear--;
                }
                onMonthChange({ month: newMonth, year: newYear });
              }}
              className="min-h-[40px] min-w-[40px] p-1 sm:p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all flex items-center justify-center active:scale-95"
              title="Mês Anterior"
              aria-label="Mês Anterior"
            >
              <Icon name="chevron_left" className="text-base" />
            </button>

            <div className="px-1.5 sm:px-2.5 text-center select-none min-w-[64px] sm:min-w-[76px]">
              <span className="block text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tight">
                {currentMonthName}
              </span>
              <span className="block text-[8px] sm:text-[9px] font-bold text-zinc-400 tracking-widest">
                {currentMY.year}
              </span>
            </div>

            <button
              type="button"
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
              className={`min-h-[40px] min-w-[40px] p-1 sm:p-1.5 rounded-lg text-zinc-500 transition-all flex items-center justify-center ${
                canGoNext ? 'hover:bg-white dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer active:scale-95' : 'opacity-30 cursor-not-allowed'
              }`}
              title={canGoNext ? 'Próximo Mês' : 'Avanço restrito pelo perfil'}
              aria-label={canGoNext ? 'Próximo Mês' : 'Avanço restrito pelo perfil'}
            >
              <Icon name="chevron_right" className="text-base" />
            </button>
          </div>

          {/* Indicador Discreto de Status de Sincronização na Nuvem */}
          <div 
            className="hidden sm:flex items-center px-2 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/50 shrink-0"
            title={`Sincronização Nuvem: ${syncStatus.state}`}
          >
            <div className={`w-2 h-2 rounded-full ${
              syncStatus.state === 'idle' || syncStatus.state === 'synced' ? 'bg-emerald-500' :
              syncStatus.state === 'syncing' ? 'bg-amber-500 animate-pulse' :
              syncStatus.state === 'error' ? 'bg-rose-500' : 'bg-zinc-400'
            }`} />
          </div>

          {/* Status Oficial vs Rascunho */}
          <button
            type="button"
            onClick={isReadOnly ? undefined : onToggleValidation}
            aria-label={`Status da Escala: ${isValidated ? 'Oficializada' : 'Modo Rascunho'}`}
            className={`hidden md:flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border font-bold text-[10px] uppercase tracking-wider transition-all shadow-sm shrink-0 ${
              isValidated
                ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800'
            } ${isReadOnly ? 'cursor-default' : 'hover:scale-[1.02] active:scale-95'}`}
            title={isReadOnly ? 'Status da Escala' : (isValidated ? 'Oficializada! Clique para alternar para Rascunho' : 'Rascunho. Clique para oficializar escala')}
          >
            <Icon name={isValidated ? 'verified' : 'pending_actions'} className="text-xs sm:text-sm shrink-0" />
            <span>{isValidated ? 'Oficial' : 'Rascunho'}</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* BLOCO 2 (CENTRAL): SEGMENTED CONTROL DE VISTAS PRIMÁRIAS        */}
        {/* Grade • Análise • Solicitações/Pedidos • Operações & Loja       */}
        {/* ============================================================== */}
        {!isReadOnly && (
          <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800 shrink-0">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id as any)}
                aria-label={item.label}
                title={`Visualizar ${item.label}`}
                className={`relative px-2 xl:px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 xl:gap-1.5 whitespace-nowrap shrink-0 ${
                  currentView === item.id 
                    ? 'bg-white dark:bg-zinc-800 shadow-sm text-orange-600 dark:text-orange-400 font-black' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Icon name={item.icon} className="text-sm shrink-0" />
                {item.id === 'requests' ? (
                  <>
                    <span className="hidden xl:inline">{item.label}</span>
                    <span className="inline xl:hidden">Pedidos</span>
                  </>
                ) : (
                  <span>{item.label}</span>
                )}
                {item.id === 'requests' && pendingRequestsCount > 0 && (
                  <span 
                    className="flex h-4 w-4 ml-0.5 shrink-0" 
                    aria-label={`${pendingRequestsCount} solicitações pendentes`}
                  >
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
                type="button"
                onClick={() => setShowConfigMenu(!showConfigMenu)}
                onBlur={() => setTimeout(() => setShowConfigMenu(false), 200)}
                aria-label="Menu Operações & Loja"
                title="Menu Operações & Loja (Rotinas, Equipe, Jornada, Feriados e Dados)"
                className={`px-2 xl:px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 xl:gap-1.5 whitespace-nowrap shrink-0 ${
                  ['team','jornada','data','feriados','worked-holidays','cleaning','patrol','sections'].includes(currentView) 
                    ? 'bg-white dark:bg-zinc-800 shadow-sm text-orange-600 dark:text-orange-400 font-black' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Icon name="tune" className="text-sm shrink-0" />
                <span className="hidden 2xl:inline">Operações & Loja</span>
                <span className="inline 2xl:hidden">Operações</span>
                <Icon name={showConfigMenu ? 'expand_less' : 'expand_more'} className="text-xs shrink-0" />
              </button>

              {showConfigMenu && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-1 duration-150 space-y-2"
                >
                  {operationsSections.map((section, sIdx) => (
                    <div key={section.title} className={sIdx > 0 ? 'pt-1.5 border-t border-zinc-100 dark:border-zinc-800' : ''}>
                      <div className="px-2.5 py-1 text-[11px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">
                        {section.title}
                      </div>
                      <div className="space-y-0.5">
                        {section.items.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              onViewChange(item.id as any);
                              setShowConfigMenu(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all text-left ${
                              currentView === item.id 
                                ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold' 
                                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <Icon name={item.icon} className="text-base text-zinc-400 shrink-0" />
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

        {/* ============================================================== */}
        {/* BLOCO 3 (DIREITA): AÇÕES AGRUPADAS & FERRAMENTAS               */}
        {/* ============================================================== */}
        {isReadOnly ? (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Indicador de Nuvem / Sync */}
            <div className="flex items-center px-2 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/50">
              <div className={`w-2 h-2 rounded-full ${
                syncStatus.state === 'idle' || syncStatus.state === 'synced' ? 'bg-emerald-500' :
                syncStatus.state === 'syncing' ? 'bg-amber-500 animate-pulse' :
                syncStatus.state === 'error' ? 'bg-rose-500' : 'bg-zinc-400'
              }`} title={`Sincronização Nuvem: ${syncStatus.state}`} />
            </div>

            {/* Menu de Filtros (Colaborador) */}
            {renderFilterDropdown()}

            {/* Botão Acesso Gerencial (Admin) */}
            <button
              type="button"
              onClick={onSwitchRole}
              aria-label="Entrar com acesso gerencial de Administrador"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-orange-50 hover:border-orange-300 dark:hover:bg-orange-950/40 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-all shadow-xs"
              title="Entrar com a senha de Administrador/Gerente da loja"
            >
              <Icon name="admin_panel_settings" className="text-sm text-orange-500 shrink-0" />
              <span className="hidden sm:inline">Acesso Gerencial</span>
              <span className="inline sm:hidden">Admin</span>
            </button>

            {/* Sair da Conta */}
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sair da conta"
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all shadow-xs"
              title="Sair do modo de visualização"
            >
              <Icon name="logout" className="text-sm shrink-0" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 1. Toggle Rápido: Visão Limpa / Auditoria */}
            {onToggleDensityMode && (
              <button
                type="button"
                onClick={onToggleDensityMode}
                className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-xs ${
                  densityMode === 'audit'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-blue-500/20'
                    : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title={densityMode === 'audit' ? 'Alternar para Visão Limpa (ocultar contadores secundários)' : 'Alternar para Visão de Auditoria (exibir todos os badges e horários)'}
              >
                <Icon name={densityMode === 'audit' ? 'troubleshoot' : 'visibility'} className="text-xs" />
                <span>{densityMode === 'audit' ? 'Auditoria' : 'Visão Limpa'}</span>
              </button>
            )}

            {/* 2. Badges de Auditoria & Alertas */}
            {isValidated && onOpenDiffModal && diffCount > 0 && (
              <button
                type="button"
                onClick={onOpenDiffModal}
                aria-label={`${diffCount} divergência${diffCount === 1 ? '' : 's'} pós-oficialização`}
                className="hidden lg:flex items-center gap-1 px-2 xl:px-2.5 py-1.5 rounded-xl border bg-amber-500 border-amber-600 text-white shadow-sm font-bold text-[10px] uppercase tracking-wider hover:scale-105 transition-all"
                title={`Auditoria: ${diffCount} divergência${diffCount === 1 ? '' : 's'} em relação à versão oficial impressa`}
              >
                <Icon name="difference" className="text-xs shrink-0" />
                <span className="font-black">{diffCount}</span>
                <span className="hidden xl:inline">{diffCount === 1 ? 'Alt.' : 'Alts.'}</span>
              </button>
            )}

            {onOpenInconsistencyModal && inconsistencyCount > 0 && (
              <button
                type="button"
                onClick={onOpenInconsistencyModal}
                aria-label={`${inconsistencyCount} alerta${inconsistencyCount === 1 ? '' : 's'} de inconsistência CLT`}
                className="hidden lg:flex items-center gap-1 px-2 xl:px-2.5 py-1.5 rounded-xl border bg-rose-500 border-rose-600 text-white shadow-sm font-black text-[10px] uppercase tracking-wider animate-pulse hover:scale-105 transition-all"
                title={`Central de Alertas: ${inconsistencyCount} inconformidade${inconsistencyCount === 1 ? '' : 's'} com regras da CLT ou escalas`}
              >
                <Icon name="warning" className="text-xs shrink-0" />
                <span className="font-black">{inconsistencyCount}</span>
                <span className="hidden xl:inline">{inconsistencyCount === 1 ? 'Alerta' : 'Alertas'}</span>
              </button>
            )}

            {/* 3. Salvar Manual com Atalho Ctrl+S */}
            {onManualSave && (
              <button
                type="button"
                onClick={onManualSave}
                disabled={isSaving}
                aria-label={isSaving ? 'Salvando escala...' : isJustSaved ? 'Escala salva com sucesso' : 'Salvar escala agora (Atalho Ctrl+S)'}
                className={`hidden sm:flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all shadow-sm ${
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
                  className={`text-xs sm:text-sm shrink-0 ${isSaving ? 'animate-spin' : ''}`} 
                />
                <span className="inline">
                  {isJustSaved ? 'Salvo!' : isSaving ? 'Salvando...' : 'Salvar'}
                </span>
                <span className="hidden min-[1440px]:inline text-[8px] sm:text-[9px] opacity-80 bg-black/25 px-1 py-0.5 rounded font-mono">
                  Ctrl+S
                </span>
              </button>
            )}

            {/* 4. Menu de Filtros */}
            <div className="hidden lg:block">
              {renderFilterDropdown()}
            </div>

            {/* 5. Dropdown Menu "Ferramentas de Escala" */}
            <div className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => {
                  setShowActionsMenu(!showActionsMenu);
                  setShowPublishMenu(false);
                  setShowConfigMenu(false);
                  setShowFilterMenu(false);
                  setShowProfileMenu(false);
                }}
                aria-label="Menu de Ações, Ferramentas e Exportação da Escala"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all shadow-xs ${
                  showActionsMenu
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-zinc-300'
                }`}
                title="Ferramentas de Escala (Planejamento, Validação e Ajustes)"
              >
                <Icon name="handyman" className="text-sm text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span>Ferramentas</span>
                <Icon name={showActionsMenu ? 'expand_less' : 'expand_more'} className="text-xs opacity-70 shrink-0" />
              </button>

              {showActionsMenu && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150 text-zinc-800 dark:text-zinc-100"
                >
                  {/* Seção 1: Planejamento */}
                  <div>
                    <div className="px-2.5 py-1 text-[11px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center gap-1">
                      <Icon name="event_note" className="text-xs text-orange-500" />
                      <span>Planejamento</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      {/* Modo Edição */}
                      {currentView === 'grid' && (
                        <button
                          type="button"
                          onClick={() => {
                            onToggleEdit();
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all text-left ${
                            isEditable
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                              : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg ${isEditable ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}>
                              <Icon name={isEditable ? 'lock_open' : 'edit'} className="text-sm" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black uppercase text-[11px]">Modo Edição</span>
                              <span className="text-[10px] text-zinc-400">
                                {isEditable ? 'Edição liberada nas células' : 'Bloqueado contra cliques acidentais'}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isEditable ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                          }`}>
                            {isEditable ? 'Ativo' : 'Bloq.'}
                          </span>
                        </button>
                      )}

                      {/* Abrir Painel de Ações Inteligentes (Modal) */}
                      {currentView === 'grid' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowActionsModal(true);
                            setShowActionsMenu(false);
                          }}
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-all text-left"
                        >
                          <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/50 text-orange-600">
                            <Icon name="psychology" className="text-sm" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black uppercase text-[11px]">Opções & Automações</span>
                            <span className="text-[10px] text-zinc-400">Sorteio de domingos, folgas e funções</span>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                  {/* Seção 2: Validação & Auditoria */}
                  <div>
                    <div className="px-2.5 py-1 text-[11px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider flex items-center gap-1">
                      <Icon name="verified_user" className="text-xs" />
                      <span>Validação & Conformidade</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      {onOpenInconsistencyModal && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenInconsistencyModal();
                            setShowActionsMenu(false);
                          }}
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all text-left"
                        >
                          <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600">
                            <Icon name="gavel" className="text-sm" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black uppercase text-[11px]">Auditoria CLT Completa</span>
                            <span className="text-[10px] text-zinc-400">6x1, domingos e desfalques de equipe</span>
                          </div>
                        </button>
                      )}

                      {isValidated && onOpenDiffModal && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenDiffModal();
                            setShowActionsMenu(false);
                          }}
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all text-left"
                        >
                          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600">
                            <Icon name="difference" className="text-sm" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black uppercase text-[11px]">Divergências Pós-Oficial</span>
                            <span className="text-[10px] text-zinc-400">Comparar com snapshot congelado</span>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                  {/* Seção 3: Configurações & Mural */}
                  <div>
                    <div className="px-2.5 py-1 text-[11px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center gap-1">
                      <Icon name="settings" className="text-xs" />
                      <span>Configurações & Anotações</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onToggleNotes();
                          setShowActionsMenu(false);
                        }}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold transition-all text-left ${
                          showNotes ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600">
                          <Icon name="edit_note" className="text-sm" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[11px]">{showNotes ? 'Ocultar Recados' : 'Mural de Recados'}</span>
                          <span className="text-[10px] text-zinc-400">Anotações no rodapé da impressão</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onViewChange('jornada');
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-left"
                      >
                        <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600">
                          <Icon name="schedule" className="text-sm" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[11px]">Parâmetros de Jornada</span>
                          <span className="text-[10px] text-zinc-400">Faixas de turno e regras de almoço</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 6. CTA Primário Destacado em Laranja: "Publicar / Exportar" */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowPublishMenu(!showPublishMenu);
                  setShowActionsMenu(false);
                  setShowConfigMenu(false);
                  setShowFilterMenu(false);
                  setShowProfileMenu(false);
                }}
                aria-label="Publicar ou Exportar Escala"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/25 active:scale-95 transition-all"
                title="Publicar e Exportar Escala (Oficializar, WhatsApp, Imprimir)"
              >
                <Icon name="rocket_launch" className="text-sm" />
                <span className="hidden sm:inline">Publicar / Exportar</span>
                <span className="inline sm:hidden">Publicar</span>
                <Icon name={showPublishMenu ? 'expand_less' : 'expand_more'} className="text-xs" />
              </button>

              {showPublishMenu && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-150 text-zinc-800 dark:text-zinc-100"
                >
                  {/* Oficializar Escala */}
                  <button
                    type="button"
                    onClick={() => {
                      onToggleValidation();
                      setShowPublishMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left transition-all"
                  >
                    <div className={`p-1.5 rounded-lg ${isValidated ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600'}`}>
                      <Icon name="verified" className="text-sm" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black uppercase text-[11px] text-zinc-900 dark:text-zinc-100">
                        {isValidated ? 'Voltar para Rascunho' : 'Oficializar Escala'}
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Congela a versão oficial para auditoria</span>
                    </div>
                  </button>

                  <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                  {/* WhatsApp Escala do Dia */}
                  <button
                    type="button"
                    onClick={() => {
                      onShareWhatsApp();
                      setShowPublishMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left transition-all"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600">
                      <Icon name="chat" className="text-sm" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black uppercase text-[11px] text-zinc-900 dark:text-zinc-100">WhatsApp: Escala do Dia</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Resumo de turnos e almoços</span>
                    </div>
                  </button>

                  {/* Apoio Operacional */}
                  <button
                    type="button"
                    onClick={() => {
                      onShareApoioWhatsApp();
                      setShowPublishMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-950/40 text-left transition-all"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600">
                      <Icon name="assignment" className="text-sm" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black uppercase text-[11px] text-zinc-900 dark:text-zinc-100">WhatsApp: Apoio / Funções</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Postos de caixa, reposição e salão</span>
                    </div>
                  </button>

                  <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                  {/* Imprimir / PDF */}
                  <button
                    type="button"
                    onClick={() => {
                      onPrint();
                      setShowPublishMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left transition-all"
                  >
                    <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600">
                      <Icon name="print" className="text-sm" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black uppercase text-[11px] text-zinc-900 dark:text-zinc-100">Imprimir / Salvar PDF</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Layout oficial A4 paisagem</span>
                    </div>
                  </button>

                  {/* Salvar Escala (CSV) */}
                  {onExportCsv && (
                    <button
                      type="button"
                      onClick={() => {
                        onExportCsv();
                        setShowPublishMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left transition-all"
                    >
                      <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600">
                        <Icon name="table_view" className="text-sm" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black uppercase text-[11px] text-emerald-700 dark:text-emerald-300">Exportar Planilha (CSV)</span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Compatível com Excel e Sheets</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 7. Menu do Usuário & Perfil */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                onBlur={() => setTimeout(() => setShowProfileMenu(false), 200)}
                aria-label="Menu de Conta e Sessão"
                className="flex items-center gap-1.5 p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
                title="Conta e Sessão"
              >
                <div className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center font-black text-[10px] uppercase shadow-sm shrink-0">
                  RH
                </div>
                <Icon name="expand_more" className="text-xs text-zinc-400 shrink-0" />
              </button>

              {showProfileMenu && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                    <span className="block text-xs font-black uppercase text-zinc-800 dark:text-zinc-200">Gestão Loja</span>
                    <span className="block text-[10px] font-bold text-zinc-400">{isReadOnly ? 'Visualizador' : 'Administrador'}</span>
                  </div>

                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onShowHelp();
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-left"
                  >
                    <Icon name="badge" className="text-base text-orange-500" />
                    <span>Guia de Funções (Correlatas)</span>
                  </button>

                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSwitchRole();
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-left"
                  >
                    <Icon name="swap_horiz" className="text-base text-zinc-400" />
                    <span>{isReadOnly ? 'Entrar como Admin' : 'Modo Visualizador'}</span>
                  </button>

                  <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                  <button
                    type="button"
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

            {/* 8. Mobile Alerts Trigger (< lg) */}
            <div className="flex items-center gap-1.5 lg:hidden">
              {isValidated && onOpenDiffModal && diffCount > 0 && (
                <button
                  type="button"
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
                  type="button"
                  onClick={onOpenInconsistencyModal}
                  className="flex items-center gap-1 px-2 py-1 rounded-xl bg-rose-500 text-white font-black text-[10px] shadow-sm animate-pulse"
                  title="Alertas CLT"
                >
                  <Icon name="warning" className="text-xs" />
                  <span>{inconsistencyCount}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
                title="Menu da Loja"
              >
                <Icon name={showMobileMenu ? 'close' : 'menu'} className="text-lg" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Navigation Drawer Overlay - Apenas Gestão */}
      {!isReadOnly && showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-zinc-950/60 backdrop-blur-sm animate-fade-in flex flex-col justify-end">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl p-5 border-t border-slate-200 dark:border-zinc-800 max-h-[85vh] overflow-y-auto space-y-4 custom-scrollbar">
            {/* Handle */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-full mx-auto -mt-1 mb-2" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <span className="text-base font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight block">
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
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center gap-3 text-xs font-black uppercase"
                >
                  <Icon name="assignment" className="text-lg text-slate-400" />
                  <span>Minhas Solicitações de Folga</span>
                </button>

                <button
                  onClick={() => {
                    onViewChange('feriados');
                    setShowMobileMenu(false);
                  }}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center gap-3 text-xs font-black uppercase"
                >
                  <Icon name="event_busy" className="text-lg text-slate-400" />
                  <span>Feriados da Loja</span>
                </button>

                <button
                  onClick={() => {
                    onShowHelp();
                    setShowMobileMenu(false);
                  }}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center gap-3 text-xs font-black uppercase"
                >
                  <Icon name="info" className="text-lg text-slate-400" />
                  <span>Manual & Regras</span>
                </button>

                <button
                  onClick={() => {
                    onSwitchRole();
                    setShowMobileMenu(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center gap-3 text-xs font-black uppercase shadow-sm mt-3"
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
                    <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Status da Escala:</span>
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
                          : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
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
                              : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-700/80'
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
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center gap-2"
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
        tacticalDisplayMode={tacticalDisplayMode}
        onToggleTacticalDisplayMode={onToggleTacticalDisplayMode}
        onExportCsv={onExportCsv}
      />
    </header>
  );
};
