
import React, { useState } from 'react';
import { Icon } from './Icon';
import { MonthYear, SyncStatus } from '../types';

interface HeaderProps {
  currentView: 'grid' | 'analysis' | 'team' | 'jornada' | 'data' | 'feriados' | 'worked-holidays';
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
  showNotes: boolean;
  onToggleNotes: () => void;
  canGoNext: boolean;
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
  showNotes,
  onToggleNotes,
  canGoNext,
}) => {
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
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
    { id: 'data', label: 'Dados', icon: 'storage' },
  ];

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm transition-colors h-14">
      <div className="flex items-center justify-between px-4 h-full gap-4">
        {/* Left: Logo & Nav */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => onViewChange('grid')}>
            {/* Logo removed as requested */}
          </div>

          {!isReadOnly && (
            <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id as any)}
                  className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase transition-all ${currentView === item.id ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {item.label}
                </button>
              ))}
              <div className="relative">
                <button
                  onClick={() => setShowConfigMenu(!showConfigMenu)}
                  onBlur={() => setTimeout(() => setShowConfigMenu(false), 200)}
                  className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-1.5 ${['team','jornada','data','feriados','worked-holidays'].includes(currentView) ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Configurações <Icon name={showConfigMenu ? 'expand_less' : 'expand_more'} className="text-[14px]" />
                </button>
                {showConfigMenu && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    {configItems.map(item => (
                      <button
                        key={item.id}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent onBlur from firing before click
                          onViewChange(item.id as any); 
                          setShowConfigMenu(false); 
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg text-[11px] font-bold uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left"
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
        <div className="flex items-center gap-4">
          {/* Month Selector */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
            <button onClick={() => {
              const prev = new Date(currentMY.year, currentMY.month - 1);
              onMonthChange({ month: prev.getMonth(), year: prev.getFullYear() });
            }} className="p-1 hover:text-orange-500 transition-colors"><Icon name="chevron_left" /></button>
            <span className="px-3 text-[11px] font-black uppercase min-w-[120px] text-center text-slate-700 dark:text-slate-300">
              {months[currentMY.month]} {currentMY.year}
            </span>
            <button 
              onClick={() => {
                const next = new Date(currentMY.year, currentMY.month + 1);
                onMonthChange({ month: next.getMonth(), year: next.getFullYear() });
              }} 
              disabled={!canGoNext}
              className={`p-1 transition-colors ${!canGoNext ? 'opacity-20 cursor-not-allowed' : 'hover:text-orange-500'}`}
            >
              <Icon name="chevron_right" />
            </button>
          </div>

          {/* Period Filters */}
          <div className="hidden sm:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg gap-1">
            {[
              { id: 'all', label: 'Mês' },
              { id: 'sunday', label: 'Dom' },
              { id: 'holiday', label: 'Fer' },
              { id: 'week', label: 'Sem' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => onFilterChange(f.id as any)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${filter === f.id ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions & Status */}
        <div className="flex items-center gap-3">
          {/* Edit Group */}
          {currentView === 'grid' && !isReadOnly && (
            <div className="relative">
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
                  className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-2 ${isEditable ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
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
                    <Icon name="event_available" className="text-lg" /> Aplicar Folgas
                  </button>
                  <button 
                    onClick={() => { onSortearDomingo(); setShowEditMenu(false); }} 
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left"
                  >
                    <Icon name="casino" className="text-lg" /> Sortear Domingos
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

          {/* Print Group */}
          <div className="relative">
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
                  <Icon name="edit_note" className="text-lg" /> {showNotes ? 'Esconder Recados' : 'Editar Recados'}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onShareWhatsApp}
            className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-2 hover:bg-green-700 transition-all shadow-sm"
          >
            <Icon name="content_copy" className="text-sm" /> Copiar Texto
          </button>
          
          <div className={`w-2 h-2 rounded-full shrink-0 ${syncStatus.state === 'synced' ? 'bg-green-500' : syncStatus.state === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} title={syncStatus.state} />
        </div>
      </div>
    </header>
  );
};
