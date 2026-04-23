
import React from 'react';
import { Icon } from './Icon';
import { MonthYear } from '../types';

interface HeaderProps {
  currentMY: MonthYear;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  currentView: string;
  onViewChange: (view: any) => void;
  isGridLocked: boolean;
  onToggleLock: () => void;
  isEditable: boolean;
  onToggleEdit: () => void;
  isZenMode: boolean;
  onToggleZen: () => void;
  syncStatus: any;
  onShowMonthEditor: () => void;
  filter: string;
  onFilterChange: (f: any) => void;
  months: string[];
}

export const Header: React.FC<HeaderProps> = ({
  currentMY,
  onNextMonth,
  onPrevMonth,
  currentView,
  onViewChange,
  isGridLocked,
  onToggleLock,
  isEditable,
  onToggleEdit,
  isZenMode,
  onToggleZen,
  syncStatus,
  onShowMonthEditor,
  filter,
  onFilterChange,
  months
}) => {
  const navItems = [
    { id: 'grid', label: 'Escala', icon: 'table_rows' },
    { id: 'calendar', label: 'Calendário', icon: 'calendar_view_month' },
    { id: 'team', label: 'Equipe', icon: 'groups' },
    { id: 'analysis', label: 'Análise', icon: 'insights' },
    { id: 'alerts', label: 'Alertas', icon: 'notifications_active' },
  ];

  return (
    <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-40 sticky top-0 shadow-sm transition-all">
      
      {/* Left: Branding & Module Navigation */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 mr-2 group cursor-pointer" onClick={onToggleZen}>
           <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-95 ${isZenMode ? 'bg-orange-500 text-white shadow-orange-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-orange-500'}`}>
              <Icon name={isZenMode ? "visibility" : "visibility_off"} fill={isZenMode} />
           </div>
           {!isZenMode && (
             <div className="flex flex-col leading-none hidden sm:flex">
                <span className="text-slate-950 dark:text-slate-100 text-lg font-black uppercase tracking-tight">ESCALA</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 transition-colors">Modo Exibição</span>
             </div>
           )}
        </div>

        {/* View Selection Tabs - Unified Navigation */}
        <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
           {navItems.map(item => (
             <button 
                key={item.id}
                onClick={() => onViewChange(item.id as any)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${currentView === item.id ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                title={item.label}
             >
                <Icon name={item.icon} className="text-sm" fill={currentView === item.id} /> 
                <span className={currentView === item.id ? 'block' : 'hidden xl:block'}>{item.label}</span>
             </button>
           ))}
        </nav>
      </div>

      {/* Center: Month Selector & Month Manager Trigger */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-900 dark:bg-slate-100 rounded-2xl p-1 shadow-xl border border-slate-700 dark:border-slate-200">
            <button onClick={onPrevMonth} className="p-2.5 text-slate-400 hover:text-orange-500 transition-colors"><Icon name="chevron_left" /></button>
            <div className="px-4 flex flex-col items-center min-w-[160px]">
               <span className="text-[11px] font-black text-white dark:text-slate-900 uppercase tracking-widest leading-none mb-1">
                 {months[currentMY.month]} {currentMY.year}
               </span>
               <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${syncStatus.state === 'synced' ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">Status: {syncStatus.state === 'synced' ? 'Sincronizado' : 'Pendente'}</span>
               </div>
            </div>
            <button onClick={onNextMonth} className="p-2.5 text-slate-400 hover:text-orange-500 transition-colors"><Icon name="chevron_right" /></button>
        </div>

        {/* Month Editor Trigger - High visibility next to month */}
        <button 
           onClick={onShowMonthEditor}
           className="w-12 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 transition-all hover:scale-105 active:scale-95 group relative"
           title="Gerenciar Mês (Auto-Escala, Domingos, Feriados)"
        >
           <Icon name="rocket_launch" className="text-xl" fill />
           <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center border-2 border-orange-500">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping" />
           </span>
        </button>
      </div>

      {/* Right: Actions & Controls */}
      <div className="flex items-center gap-3">
        
        {currentView === 'grid' && (
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/40 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
             {['all', 'today', 'sunday', 'week'].map((f) => (
                <button 
                  key={f}
                  onClick={() => onFilterChange(f as any)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filter === f ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm border border-slate-100 dark:border-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {f === 'all' ? 'Mês' : f === 'today' ? 'Hoje' : f === 'sunday' ? 'Dom' : 'Sem'}
                </button>
             ))}
          </div>
        )}

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />

        <div className="flex items-center gap-2">
           {/* Lock/Unlock Toggle */}
           <button 
              onClick={onToggleLock}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isGridLocked ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-600' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-600'}`}
           >
              <Icon name={isGridLocked ? "lock" : "lock_open"} className="text-sm" fill={isGridLocked} />
              <span className="hidden xl:block">{isGridLocked ? "Bloqueado" : "Liberado"}</span>
           </button>

           {/* Edit Toggle */}
           <button 
              onClick={onToggleEdit}
              disabled={isGridLocked}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isEditable ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'} ${isGridLocked ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
           >
              <Icon name={isEditable ? "save" : "edit_square"} className="text-sm" fill={isEditable} />
              <span>{isEditable ? "Salvar" : "Editar"}</span>
           </button>
        </div>
      </div>
    </header>
  );
};
