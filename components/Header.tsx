
import React, { useState } from 'react';
import { Icon } from './Icon';
import { MonthYear, SyncStatus } from '../types';

interface HeaderProps {
  currentView: 'grid' | 'analysis' | 'team' | 'jornada' | 'data';
  currentMY: MonthYear;
  filter: 'all' | 'sunday' | 'holiday' | 'week';
  onViewChange: (view: any) => void;
  onMonthChange: (my: MonthYear) => void;
  onFilterChange: (f: any) => void;
  onShareWhatsApp: () => void;
  syncStatus: SyncStatus;
  selectedDayIdx: number;
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
}) => {
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const navItems = [
    { id: 'grid', label: 'Grade', icon: 'grid_view' },
    { id: 'analysis', label: 'Análise', icon: 'insights' },
  ];

  const configItems = [
    { id: 'team', label: 'Equipe', icon: 'groups' },
    { id: 'jornada', label: 'Jornada', icon: 'schedule' },
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
                className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-1.5 ${['team','jornada','data'].includes(currentView) ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Configurações <Icon name={showConfigMenu ? 'expand_less' : 'expand_more'} className="text-[14px]" />
              </button>
              {showConfigMenu && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1">
                  {configItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => { onViewChange(item.id as any); setShowConfigMenu(false); }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-[11px] font-bold uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      <Icon name={item.icon} className="text-base" /> {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>
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
            <button onClick={() => {
              const next = new Date(currentMY.year, currentMY.month + 1);
              onMonthChange({ month: next.getMonth(), year: next.getFullYear() });
            }} className="p-1 hover:text-orange-500 transition-colors"><Icon name="chevron_right" /></button>
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

          <button
            onClick={onShareWhatsApp}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:bg-green-700 transition-all shadow-sm"
          >
            <Icon name="send" className="text-sm" /> WhatsApp (Dia {selectedDayIdx + 1})
          </button>
          
          <div className={`w-2 h-2 rounded-full ${syncStatus.state === 'synced' ? 'bg-green-500' : syncStatus.state === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} title={syncStatus.state} />
        </div>
      </div>
    </header>
  );
};
