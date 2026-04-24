
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
          <button onClick={() => onViewChange('grid')} className="flex items-center gap-2 group">
            <div className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path clipRule="evenodd" d="M24 18.4228L42 11.475V34.3663C42 34.7796 41.7457 35.1504 41.3601 35.2992L24 42V18.4228Z" fill="currentColor" fillRule="evenodd" /><path clipRule="evenodd" d="M24 8.18819L33.4123 11.574L24 15.2071L14.5877 11.574L24 8.18819ZM9 15.8487L21 20.4805V37.6263L9 32.9945V15.8487ZM27 37.6263V20.4805L39 15.8487V32.9945L27 37.6263ZM25.354 2.29885C24.4788 1.98402 23.5212 1.98402 22.646 2.29885L4.98454 8.65208C3.7939 9.08038 3 10.2097 3 11.475V34.3663C3 36.0196 4.01719 37.5026 5.55962 38.098L22.9197 44.7987C23.6149 45.0671 24.3851 45.0671 25.0803 44.7987L42.4404 38.098C43.9828 37.5026 45 36.0196 45 34.3663V11.475C45 10.2097 44.2061 9.08038 43.0155 8.65208L25.354 2.29885Z" fill="currentColor" fillRule="evenodd" /></svg>
            </div>
            <span className="text-slate-900 dark:text-slate-100 font-black tracking-tighter text-lg hidden lg:block">RI HAPPY</span>
          </button>

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
            <Icon name="send" className="text-sm" /> WhatsApp
          </button>
          
          <div className={`w-2 h-2 rounded-full ${syncStatus.state === 'synced' ? 'bg-green-500' : syncStatus.state === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} title={syncStatus.state} />
        </div>
      </div>
    </header>
  );
};
