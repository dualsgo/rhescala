
import React, { useState } from 'react';
import { Icon } from './Icon';
import { MonthYear, SyncStatus } from '../types';

interface HeaderProps {
  currentView: 'grid' | 'analysis' | 'team' | 'jornada' | 'data' | 'feriados' | 'worked-holidays' | 'cleaning' | 'activities' | 'routine' | 'notices';
  currentMY: MonthYear;
  filter: 'all' | 'sunday' | 'holiday' | 'week';
  onViewChange: (view: any) => void;
  onMonthChange: (my: MonthYear) => void;
  onFilterChange: (f: any) => void;
  onShareWhatsApp: () => void;
  syncStatus: SyncStatus;
  selectedDayIdx: number;
  // New Action Props
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
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  currentMY,
  filter,
  onViewChange,
  onMonthChange,
  onFilterChange,
  onShareWhatsApp,
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
  showNotes,

  onToggleNotes,
  canGoNext,
  sundayViolations,
  onLogout,
  onSwitchRole,
  onShowHelp,
  isValidated,
  onToggleValidation,
}) => {
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const navItems = [
    { id: 'grid', label: 'Grade', icon: 'grid_view' },
    { id: 'analysis', label: 'Análise', icon: 'insights' },
  ];

  const configItems = [
    { id: 'team', label: 'Equipe', icon: 'groups' },
    { id: 'jornada', label: 'Jornada', icon: 'schedule' },
    { id: 'feriados', label: 'Feriados', icon: 'event_busy' },
    { id: 'worked-holidays', label: 'Feriados Trabalhados', icon: 'list_alt' },
    /* 
    { id: 'cleaning', label: 'Limpeza Copa', icon: 'cleaning_services' },
    { id: 'activities', label: 'Atividades', icon: 'assignment_turned_in' },
    { id: 'routine', label: 'Rotina Diária', icon: 'event_repeat' },
    { id: 'notices', label: 'Mural de Recados', icon: 'campaign' },
    */
    { id: 'data', label: 'Dados', icon: 'storage' },
  ];

  return (
    <header className="bg-white dark:bg-black border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-50 shadow-md transition-colors h-14">
      <div className="flex items-center justify-between px-4 h-full gap-4">
        {/* Left: Mobile Menu Trigger & Logo */}
        <div className="flex items-center gap-2 lg:gap-6">
          <button 
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all z-[70] relative"
          >
            <Icon name={showMobileMenu ? 'close' : 'menu'} />
          </button>

          {!isReadOnly && (
            <nav className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-lg">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id as any)}
                  className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase transition-all ${currentView === item.id ? 'bg-white dark:bg-zinc-800 shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {item.label}
                </button>
              ))}
              <div className="relative">
                <button
                  onClick={() => setShowConfigMenu(!showConfigMenu)}
                  onBlur={() => setTimeout(() => setShowConfigMenu(false), 200)}
                  className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-1.5 ${['team','jornada','data','feriados','worked-holidays'].includes(currentView) ? 'bg-white dark:bg-zinc-800 shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Configurações <Icon name={showConfigMenu ? 'expand_less' : 'expand_more'} className="text-[14px]" />
                </button>
                {showConfigMenu && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    {configItems.map(item => (
                      <button
                        key={item.id}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent onBlur from firing before click
                          onViewChange(item.id as any); 
                          setShowConfigMenu(false); 
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg text-[11px] font-bold uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-left"
                      >
                        <Icon name={item.icon} className="text-base" /> {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          )}
        </div>

        {/* Center/Right: Month & Filters */}
        <div className="flex items-center gap-2 lg:gap-4 flex-1 justify-center lg:flex-none">
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-0.5 sm:p-1">
              <button onClick={() => {
                const prev = new Date(currentMY.year, currentMY.month - 1);
                onMonthChange({ month: prev.getMonth(), year: prev.getFullYear() });
              }} className="p-1 hover:text-orange-500 transition-colors"><Icon name="chevron_left" className="text-sm sm:text-base" /></button>
              <span className="px-1 sm:px-3 text-[10px] sm:text-[11px] font-black uppercase min-w-[80px] sm:min-w-[120px] text-center text-slate-700 dark:text-slate-300">
                <span className="xs:hidden">{months[currentMY.month].substring(0, 3)}</span>
                <span className="hidden xs:inline">{months[currentMY.month]}</span> {currentMY.year}
              </span>
              <button 
                onClick={() => {
                  const next = new Date(currentMY.year, currentMY.month + 1);
                  onMonthChange({ month: next.getMonth(), year: next.getFullYear() });
                }} 
                disabled={!canGoNext}
                className={`p-1 transition-colors ${!canGoNext ? 'opacity-20 cursor-not-allowed' : 'hover:text-orange-500'}`}
              >
                <Icon name="chevron_right" className="text-sm sm:text-base" />
              </button>
            </div>

            {/* Validation Badge */}
            <button
              onClick={() => !isReadOnly && onToggleValidation()}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border transition-all ${
                isValidated 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400' 
                  : 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400 animate-pulse-subtle'
              } ${isReadOnly ? 'cursor-default' : 'hover:scale-105 active:scale-95'}`}
              title={isReadOnly ? '' : (isValidated ? 'Clique para marcar como rascunho' : 'Clique para oficializar escala')}
            >
              <Icon name={isValidated ? 'verified' : 'edit_calendar'} className="text-xs sm:text-sm" />
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter sm:tracking-widest">
                <span className="inline sm:hidden">{isValidated ? 'OK' : 'Edit'}</span>
                <span className="hidden sm:inline">{isValidated ? 'Oficializado' : 'Rascunho'}</span>
              </span>
            </button>
          </div>

        </div>

        {/* Right: Actions & Status */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Edit Group */}
          {currentView === 'grid' && !isReadOnly && (
            <div className="hidden lg:relative lg:block">
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => {
                    if (!isEditable) {
                      onToggleEdit();
                      setShowEditMenu(true);
                    } else {
                      onToggleEdit();
                      setShowEditMenu(false);
                    }
                  }}
                  className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-2 ${isEditable ? 'bg-white dark:bg-zinc-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Icon name={isEditable ? 'save' : 'edit'} className="text-sm" />
                  {isEditable ? 'Salvar' : 'Editar'}
                </button>
                
                {isEditable && (
                  <button 
                    onClick={() => setShowEditMenu(!showEditMenu)}
                    className={`px-2 py-1.5 rounded-md transition-all ${showEditMenu ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    <Icon name={showEditMenu ? 'expand_less' : 'expand_more'} />
                  </button>
                )}
              </div>
              
              {isEditable && showEditMenu && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  <button 
                    onClick={() => { onCreateMonth(); setShowEditMenu(false); }} 
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-[10px] font-black uppercase text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all text-left"
                  >
                    <Icon name="add_circle" className="text-lg" /> Criar Mês (Gerar)
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2" />
                  <button 
                    onClick={() => { onApplyFolgas(); setShowEditMenu(false); }} 
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left"
                  >
                    <Icon name="event_available" className="text-lg" /> Aplicar Pré-definições
                  </button>
                  <button 
                    onClick={() => { onSortearDomingo(); setShowEditMenu(false); }} 
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left"
                  >
                    <Icon name="casino" className="text-lg" /> Sortear Domingos
                  </button>
                  <button 
                    onClick={() => { onDistributePositions(); setShowEditMenu(false); }} 
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-[10px] font-black uppercase text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-left"
                  >
                    <Icon name="strategy" className="text-lg" /> Distribuir Posições
                  </button>

                  <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2" />
                  <div className="flex items-center justify-between p-2.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Modo Retroativo</span>
                    <button
                      onClick={onToggleRetroactive}
                      className={`w-8 h-4 rounded-full relative transition-colors ${allowRetroactive ? 'bg-indigo-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${allowRetroactive ? 'left-4.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2" />
                  <button 
                    onClick={() => setShowEditMenu(false)}
                    className="w-full flex items-center justify-center p-2 rounded-lg text-[9px] font-black uppercase text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    Fechar Menu
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Print Group - Hidden for Viewers */}
          {!isReadOnly && (
            <div className="hidden lg:relative lg:block">
              <button
                onClick={() => setShowPrintMenu(!showPrintMenu)}
                className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 ${showPrintMenu ? 'ring-2 ring-indigo-500' : ''}`}
              >
                <Icon name="print" className="text-sm" /> Imprimir
              </button>
              {showPrintMenu && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-1">
                  <button 
                    onClick={() => { onPrint(); setShowPrintMenu(false); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    <Icon name="picture_as_pdf" className="text-lg text-rose-500" /> Gerar PDF Escala
                  </button>
                  <button 
                    onClick={() => { onToggleNotes(); setShowPrintMenu(false); }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${showNotes ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Icon name="edit_note" className="text-lg" />{showNotes ? 'Esconder Recados' : 'Editar Recados'}</button>
                </div>
              )}
            </div>
          )}

          {/* Sunday Violations Alert - Only for Admin */}
          {sundayViolations.length > 0 && !isReadOnly && (
            <div className="relative group">
              <div className="flex items-center justify-center w-8 h-8 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full cursor-help animate-pulse transition-transform hover:scale-110">
                <Icon name="error" className="text-xl" />
              </div>
              <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-2xl shadow-2xl z-50 p-4 hidden group-hover:block animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2 mb-3 border-b border-rose-100 dark:border-rose-900 pb-2">
                  <Icon name="warning" className="text-rose-500 text-lg" />
                  <h5 className="text-[10px] font-black uppercase text-rose-600 tracking-wider">Atenção: 3 Domingos Seguidos</h5>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                  {(() => {
                    // Group by employee for better visualization
                    const grouped = sundayViolations.reduce((acc, v) => {
                      if (!acc[v.empName]) acc[v.empName] = [];
                      acc[v.empName].push(v.date);
                      return acc;
                    }, {} as Record<string, string[]>);
                    
                    return Object.entries(grouped).map(([name, dates]) => (
                      <div key={name} className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase">{name}</span>
                        <div className="flex flex-wrap gap-1">
                          {dates.map(d => (
                            <span key={d} className="text-[8px] font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-500 px-1.5 py-0.5 rounded">
                              {d.split('-').reverse().join('/')}
                            </span>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {!isReadOnly && (
            <>
              <button
                onClick={onShareWhatsApp}
                className="hidden lg:flex bg-green-600 text-white px-4 py-1.5 rounded-lg text-[11px] font-black uppercase items-center gap-2 hover:bg-green-700 transition-all shadow-sm"
              >
                <Icon name="content_copy" className="text-sm" /> Copiar Texto
              </button>
              
              <button 
                onClick={onShowHelp}
                className="hidden lg:flex w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 hover:text-orange-600 transition-all items-center justify-center border border-slate-200 dark:border-slate-700"
                title="Ajuda e FAQs"
              >
                <Icon name="help_outline" className="text-xl" />
              </button>
            </>
          )}
          
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              onBlur={() => setTimeout(() => setShowProfileMenu(false), 200)}
              className="flex items-center gap-2 p-1 rounded-lg sm:p-1.5 sm:rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-all border border-slate-200 dark:border-slate-700"
            >
              <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center text-white ${isReadOnly ? 'bg-indigo-600' : 'bg-orange-500'}`}>
                <Icon name={isReadOnly ? 'person' : 'admin_panel_settings'} className="text-xs sm:text-sm" />
              </div>
              <div className="hidden lg:flex flex-col items-start pr-2">
                <span className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 leading-none">{isReadOnly ? 'Equipe' : 'Gerente'}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">Perfil</span>
              </div>
            </button>
            
            {showProfileMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1">
                 <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                   <p className="text-[9px] font-black text-slate-400 uppercase">Ações de Acesso</p>
                 </div>
                 <button 
                  onMouseDown={(e) => { e.preventDefault(); onSwitchRole(); setShowProfileMenu(false); }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all text-left"
                 >
                  <Icon name={isReadOnly ? 'admin_panel_settings' : 'visibility'} className="text-lg" /> 
                  {isReadOnly ? 'Acessar Gerência' : 'Ver como Equipe'}
                 </button>
                 <button 
                  onMouseDown={(e) => { e.preventDefault(); onLogout(); setShowProfileMenu(false); }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50 transition-all text-left"
                 >
                  <Icon name="logout" className="text-lg" /> Sair do Sistema
                 </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800">
            <div className={`w-1.5 h-1.5 rounded-full ${syncStatus.state === 'synced' ? 'bg-emerald-500' : syncStatus.state === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
              {syncStatus.state === 'synced' ? 'Nuvem OK' : syncStatus.state === 'syncing' ? 'Salvando' : 'Erro'}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-white dark:bg-black p-6 pt-20 animate-in slide-in-from-left duration-300 overflow-y-auto">

          <div className="flex flex-col gap-8">
            {/* Nav Items */}
            {!isReadOnly && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Navegação Principal</p>
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { onViewChange(item.id as any); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl text-sm font-black uppercase transition-all ${currentView === item.id ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
                  >
                    <Icon name={item.icon} className="text-xl" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {/* Config Items */}
            {!isReadOnly && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Configurações e Dados</p>
                {configItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { onViewChange(item.id as any); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl text-sm font-black uppercase transition-all ${currentView === item.id ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
                  >
                    <Icon name={item.icon} className="text-xl" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {/* Actions for Admins */}
            {!isReadOnly && currentView === 'grid' && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Ferramentas de Edição</p>
                <button
                  onClick={() => { onToggleEdit(); setShowMobileMenu(false); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl text-sm font-black uppercase transition-all ${isEditable ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
                >
                  <Icon name={isEditable ? 'save' : 'edit'} className="text-xl" />
                  {isEditable ? 'Salvar Edição' : 'Habilitar Edição'}
                </button>
                {isEditable && (
                  <>
                    <button onClick={() => { onCreateMonth(); setShowMobileMenu(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                      <Icon name="add_circle" className="text-xl text-orange-500" /> Criar Mês
                    </button>
                    <button onClick={() => { onApplyFolgas(); setShowMobileMenu(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                      <Icon name="event_available" className="text-xl" /> Aplicar Pré-definições
                    </button>
                  </>
                )}
                <button onClick={() => { onPrint(); setShowMobileMenu(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                  <Icon name="print" className="text-xl" /> Imprimir / PDF
                </button>
              </div>
            )}

            {/* General Actions */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Outras Opções</p>
              {!isReadOnly && (
                <button onClick={() => { onShareWhatsApp(); setShowMobileMenu(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-sm font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10">
                  <Icon name="content_copy" className="text-xl" /> Copiar para WhatsApp
                </button>
              )}
              <button onClick={() => { onShowHelp(); setShowMobileMenu(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-50">
                <Icon name="help_outline" className="text-xl" /> Ajuda e FAQs
              </button>
              <button onClick={() => { onLogout(); setShowMobileMenu(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl text-sm font-black uppercase text-rose-500 hover:bg-rose-50">
                <Icon name="logout" className="text-xl" /> Sair do Sistema
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
