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
  onDistributePositions: () => void;
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
  onManualSave?: () => void;
  isSaving?: boolean;
  isJustSaved?: boolean;
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
  onDistributePositions,
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
  tacticalDisplayMode = 'positions',
  onToggleTacticalDisplayMode,
  onManualSave,
  isSaving = false,
  isJustSaved = false,
}) => {
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const currentMonthName = months[currentMY.month];

  const navItems = [
    { id: 'grid', label: 'Grade', icon: 'grid_view' },
    { id: 'analysis', label: 'Análise', icon: 'insights' },
    { id: 'requests', label: 'Solicitações', icon: 'assignment' },
  ];

  const configItems = [
    { id: 'team', label: 'Equipe Operacional', icon: 'groups' },
    { id: 'jornada', label: 'Parâmetros de Jornada', icon: 'schedule' },
    { id: 'feriados', label: 'Feriados & Folgas', icon: 'event_busy' },
    { id: 'worked-holidays', label: 'Feriados Trabalhados', icon: 'list_alt' },
    { id: 'cleaning', label: 'Limpeza da Copa', icon: 'cleaning_services' },
    { id: 'patrol', label: 'Ronda da Loja', icon: 'local_police' },
    { id: 'sections', label: 'Donos de Seção', icon: 'category' },
    { id: 'data', label: 'Banco de Dados & Backup', icon: 'storage' },
  ];

  return (
    <header className="bg-white dark:bg-black border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-50 shadow-sm transition-colors h-14">
      {/* Backdrop overlay to prevent clicking behind open dropdowns */}
      {(showConfigMenu || showShareMenu || showProfileMenu) && (
        <div 
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[0.5px]" 
          onClick={(e) => {
            e.stopPropagation();
            setShowConfigMenu(false);
            setShowShareMenu(false);
            setShowProfileMenu(false);
          }}
        />
      )}

      <div className="flex items-center justify-between px-3 sm:px-4 h-full gap-2 sm:gap-4 max-w-full relative z-50">
        
        {/* Left: Mobile Menu Trigger & Main Navigation */}
        <div className="flex items-center gap-2 lg:gap-4">
          <button 
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all z-[70] relative"
            title="Abrir Menu"
          >
            <Icon name={showMobileMenu ? 'close' : 'menu'} />
          </button>

          {!isReadOnly && (
            <nav className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200/50 dark:border-zinc-800">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id as any)}
                  className={`relative px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
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

              {/* Config Menu Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowConfigMenu(!showConfigMenu)}
                  onBlur={() => setTimeout(() => setShowConfigMenu(false), 200)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    ['team','jornada','data','feriados','worked-holidays','cleaning','patrol','sections'].includes(currentView) 
                      ? 'bg-white dark:bg-zinc-800 shadow-sm text-orange-600 dark:text-orange-400' 
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon name="settings" className="text-sm" />
                  <span>Configurações</span>
                  <Icon name={showConfigMenu ? 'expand_less' : 'expand_more'} className="text-xs" />
                </button>

                {showConfigMenu && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-200"
                  >
                    <div className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-zinc-800 mb-1">
                      Parâmetros do Sistema
                    </div>
                    {configItems.map(item => (
                      <button
                        key={item.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onViewChange(item.id as any);
                          setShowConfigMenu(false);
                        }}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold transition-all text-left ${
                          currentView === item.id 
                            ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400' 
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <Icon name={item.icon} className="text-base text-slate-400" />
                        <span>{item.label}</span>
                      </button>
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

          {/* Scale Status: Official vs Draft */}
          <button
            onClick={isReadOnly ? undefined : onToggleValidation}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border font-black text-[10px] uppercase tracking-wider transition-all shadow-sm ${
              isValidated
                ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse-subtle'
            } ${isReadOnly ? 'cursor-default' : 'hover:scale-[1.02] active:scale-95'}`}
            title={isReadOnly ? 'Status da Escala' : (isValidated ? 'Oficializada! Clique para alternar para Rascunho' : 'Rascunho. Clique para oficializar escala')}
          >
            <Icon name={isValidated ? 'verified' : 'pending_actions'} className="text-xs sm:text-sm" />
            <span className="hidden sm:inline">{isValidated ? 'Oficial' : 'Rascunho'}</span>
          </button>

          {/* Audit Diff Badge (when officialized and differences exist) */}
          {isValidated && onOpenDiffModal && diffCount > 0 && (
            <button
              onClick={onOpenDiffModal}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border bg-amber-500 border-amber-600 text-white shadow-sm font-black text-[10px] uppercase tracking-wider animate-pulse hover:scale-105 transition-all"
              title="Auditoria: Existem divergências em relação à versão oficial impressa"
            >
              <Icon name="difference" className="text-xs" />
              <span>{diffCount} {diffCount === 1 ? 'Alt.' : 'Alts.'}</span>
            </button>
          )}

          {/* Inconsistency / Violation Badge */}
          {onOpenInconsistencyModal && inconsistencyCount > 0 && (
            <button
              onClick={onOpenInconsistencyModal}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border bg-rose-500 border-rose-600 text-white shadow-sm font-black text-[10px] uppercase tracking-wider animate-pulse hover:scale-105 transition-all"
              title="Central de Alertas e Regras CLT"
            >
              <Icon name="warning" className="text-xs" />
              <span>{inconsistencyCount} {inconsistencyCount === 1 ? 'Alerta' : 'Alertas'}</span>
            </button>
          )}
        </div>

        {/* Right: Segmented Actions, Share & Profile Menus */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
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

          {/* Seletor de Formato de Escala no Modo Visualizador (Desktop) */}
          {isReadOnly && onToggleTacticalDisplayMode && (
            <div className="flex items-center bg-slate-100 dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 p-0.5 rounded-xl shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => onToggleTacticalDisplayMode('positions')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${
                  tacticalDisplayMode === 'positions'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Exibir posições táticas (P1, P2, P3, P4, ESTQ)"
              >
                <span className="hidden sm:inline">🏷️ Posições</span>
                <span className="inline sm:hidden">🏷️ Pos</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleTacticalDisplayMode('roles')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${
                  tacticalDisplayMode === 'roles'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Exibir funções (Caixa, Fiscal, Atendimento, Apoio, Estoque)"
              >
                <span className="hidden sm:inline">👔 Funções</span>
                <span className="inline sm:hidden">👔 Func</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleTacticalDisplayMode('off')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${
                  tacticalDisplayMode === 'off'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Exibir apenas T e Folgas"
              >
                <span className="hidden sm:inline">🔘 Padrão (T)</span>
                <span className="inline sm:hidden">🔘 T</span>
              </button>
            </div>
          )}

          {/* Botão Direto: Modo Edição */}
          {!isReadOnly && currentView === 'grid' && (
            <button
              type="button"
              onClick={onToggleEdit}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
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
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-sm bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-200 hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-zinc-800"
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
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border shadow-sm ${
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
                  <span>Guia de Posições & Funções</span>
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

      </div>

      {/* Mobile Navigation Drawer Overlay */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm animate-fade-in flex flex-col justify-end">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl p-6 border-t border-slate-200 dark:border-zinc-800 max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <span className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight block">
                  {isReadOnly ? 'Painel do Colaborador' : 'Navegação Principal'}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {isReadOnly ? 'Acesso rápido para consulta de escala' : 'Gestão de equipe e escalas'}
                </span>
              </div>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500">
                <Icon name="close" />
              </button>
            </div>

            {isReadOnly ? (
              <div className="space-y-2 pt-2">
                {/* Formato da Escala no Mobile */}
                {onToggleTacticalDisplayMode && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Icon name="badge" className="text-orange-500 text-sm" /> Exibição da Escala
                      </span>
                      <span className="text-[9px] font-black uppercase text-slate-400">
                        {tacticalDisplayMode === 'positions' ? 'Posições' : tacticalDisplayMode === 'roles' ? 'Funções' : 'Padrão (T)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-200/70 dark:bg-zinc-900 rounded-xl">
                      <button
                        onClick={() => {
                          onToggleTacticalDisplayMode('positions');
                        }}
                        className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center ${
                          tacticalDisplayMode === 'positions'
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        🏷️ Posições
                      </button>
                      <button
                        onClick={() => {
                          onToggleTacticalDisplayMode('roles');
                        }}
                        className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center ${
                          tacticalDisplayMode === 'roles'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        👔 Funções
                      </button>
                      <button
                        onClick={() => {
                          onToggleTacticalDisplayMode('off');
                        }}
                        className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center ${
                          tacticalDisplayMode === 'off'
                            ? 'bg-slate-700 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        🔘 Padrão (T)
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    onShowHelp();
                    setShowMobileMenu(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 flex items-center gap-3 text-xs font-black uppercase shadow-sm"
                >
                  <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-600">
                    <Icon name="badge" className="text-base" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span>Guia de Posições & Funções</span>
                    <span className="text-[10px] font-normal text-slate-400 lowercase">descrições de P1, P2, P3, P4 e Estoque</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onViewChange('feriados');
                    setShowMobileMenu(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 flex items-center gap-3 text-xs font-black uppercase shadow-sm"
                >
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600">
                    <Icon name="event_busy" className="text-base" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span>Feriados & Folgas da Loja</span>
                    <span className="text-[10px] font-normal text-slate-400 lowercase">calendário anual de feriados</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onSwitchRole();
                    setShowMobileMenu(false);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 flex items-center gap-3 text-xs font-black uppercase shadow-sm"
                >
                  <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-600">
                    <Icon name="admin_panel_settings" className="text-base" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span>Entrar como Administrador</span>
                    <span className="text-[10px] font-normal text-slate-400 lowercase">acesso de gestão para o gerente</span>
                  </div>
                </button>
              </div>
            ) : (
              <>
                {/* Botão de Salvar no Mobile (Admin) */}
                {onManualSave && (
                  <button
                    onClick={() => {
                      onManualSave();
                      setShowMobileMenu(false);
                    }}
                    disabled={isSaving}
                    className={`w-full p-3.5 rounded-2xl flex items-center justify-center gap-2.5 text-xs font-black uppercase shadow-md transition-all ${
                      isJustSaved
                        ? 'bg-emerald-600 text-white shadow-emerald-500/30'
                        : isSaving
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                    }`}
                  >
                    <Icon name={isJustSaved ? 'check_circle' : isSaving ? 'sync' : 'save'} className={`text-lg ${isSaving ? 'animate-spin' : ''}`} />
                    <span>{isJustSaved ? 'Escala Salva com Sucesso!' : isSaving ? 'Salvando...' : 'Salvar Escala Agora'}</span>
                  </button>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {navItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onViewChange(item.id as any);
                        setShowMobileMenu(false);
                      }}
                      className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 text-xs font-black uppercase transition-all ${
                        currentView === item.id 
                          ? 'bg-orange-500 text-white shadow-md' 
                          : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon name={item.icon} className="text-xl" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>

                {!isReadOnly && currentView === 'grid' && (
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowActionsModal(true);
                    }}
                    className="w-full p-3.5 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 flex items-center justify-center gap-2.5 text-xs font-black uppercase shadow-sm"
                  >
                    <Icon name="auto_fix_high" className="text-base text-orange-500" />
                    <span>Ações & Opções da Escala</span>
                  </button>
                )}

                <div className="space-y-1 pt-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block px-1">Configurações & Dados</span>
                  <div className="grid grid-cols-2 gap-2">
                    {configItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onViewChange(item.id as any);
                          setShowMobileMenu(false);
                        }}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 flex items-center gap-2 text-xs font-bold"
                      >
                        <Icon name={item.icon} className="text-sm text-slate-400" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
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
      />
    </header>
  );
};
