
import React, { useState } from 'react';
import { Icon } from './Icon';
import { MonthYear, SyncStatus } from '../types';

interface SidebarProps {
  currentView: 'grid' | 'team' | 'analysis' | 'calendar' | 'alerts' | 'config';
  onViewChange: (view: 'grid' | 'team' | 'analysis' | 'calendar' | 'alerts' | 'config') => void;
  syncStatus: SyncStatus;
  onForceSync: () => Promise<void>;
  onImportClick: () => void;
  onShowHolidayManager: () => void;
  onShowPrintView: () => void;
  onShowHolidayCredit: () => void;
  onShowHistory: () => void;
  onShareWhatsApp: (idx: number) => void;
  selectedDayIdx: number;
}

const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  syncStatus,
  onForceSync,
  onImportClick,
  onShowHolidayManager,
  onShowPrintView,
  onShowHolidayCredit,
  onShowHistory,
  onShareWhatsApp,
  selectedDayIdx
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const navItems = [
    { id: 'grid', label: 'Escala', icon: 'table_rows' },
    { id: 'calendar', label: 'Calendário', icon: 'calendar_view_month' },
    { id: 'team', label: 'Equipe', icon: 'groups' },
    { id: 'analysis', label: 'Análise', icon: 'insights' },
    { id: 'alerts', label: 'Alertas', icon: 'notifications_active' },
  ];

  return (
    <aside 
      className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-50 sticky top-0 h-[calc(100vh-80px)] overflow-hidden ${
        isMinimized ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6 pt-4">
        
        {/* Section: Navigation */}
        <section>
          {!isMinimized && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-3">Módulos</p>}
          <nav className="flex flex-col gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id as any)}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  currentView === item.id 
                  ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-500 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                title={item.label}
              >
                <Icon name={item.icon} className="text-xl" fill={currentView === item.id} />
                {!isMinimized && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
        </section>

        {/* Section: Advanced Tools */}
        <section className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
           {!isMinimized && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Configurações</p>}
           <div className="flex flex-col gap-1">
              <SidebarToolButton icon="event_repeat" label="Créditos Feriado" onClick={onShowHolidayCredit} isMinimized={isMinimized} color="text-emerald-500" />
              <SidebarToolButton icon="history" label="Log de Auditoria" onClick={onShowHistory} isMinimized={isMinimized} color="text-indigo-500" />
              <SidebarToolButton icon="settings" label="Gerenciar Feriados" onClick={onShowHolidayManager} isMinimized={isMinimized} color="text-slate-500" />
              <SidebarToolButton icon="print" label="Versão Impressa" onClick={onShowPrintView} isMinimized={isMinimized} color="text-slate-500" />
           </div>
        </section>

        {/* Section: Data & Backup */}
        <section className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          {!isMinimized && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Dados</p>}
          <div className="flex flex-col gap-2">
             <div className={`flex gap-1 ${isMinimized ? 'flex-col' : 'px-1'}`}>
                <button title="Exportar Backup" className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700"><Icon name="cloud_download" /></button>
                <button onClick={onImportClick} title="Importar Backup" className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700"><Icon name="cloud_upload" /></button>
             </div>
             
             <button 
               onClick={onForceSync}
               className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all border ${
                 syncStatus.state === 'syncing' ? 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse' :
                 syncStatus.state === 'synced' ? 'bg-green-50 border-green-200 text-green-600' :
                 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500'
               }`}
             >
               <Icon name={syncStatus.state === 'syncing' ? 'sync' : 'cloud_done'} className={syncStatus.state === 'syncing' ? 'animate-spin' : ''} />
               {!isMinimized && (
                 <div className="flex flex-col items-start leading-none truncate">
                    <span className="text-[9px] font-black uppercase tracking-tight">{syncStatus.state === 'syncing' ? 'Sincronizando...' : 'Nuvem OK'}</span>
                    <span className="text-[7px] font-bold opacity-60 uppercase">Manual</span>
                 </div>
               )}
             </button>
          </div>
        </section>

      </div>

      {/* Footer: User & WhatsApp */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/10 backdrop-blur-sm">
          <div className={`p-2 bg-green-50 dark:bg-green-950/20 rounded-2xl flex flex-col gap-2 border border-green-100/50 dark:border-green-900/30 ${isMinimized ? 'items-center' : ''}`}>
             <button 
               onClick={() => onShareWhatsApp(selectedDayIdx)}
               className={`w-full py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase shadow-lg shadow-green-600/20 ${isMinimized ? 'px-0' : ''}`}
               title="Compartilhar via WhatsApp"
             >
               <Icon name="send" className="text-sm" />
               {!isMinimized && <span>WhatsApp</span>}
             </button>
          </div>
      </div>
      
      {/* Minimize Button at bottom */}
      <button 
        onClick={() => setIsMinimized(!isMinimized)}
        className="p-4 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border-t border-slate-100 dark:border-slate-800"
      >
        <Icon name={isMinimized ? 'last_page' : 'first_page'} />
      </button>
    </aside>
  );
};

const SidebarToolButton: React.FC<{ icon: string, label: string, onClick: () => void, isMinimized: boolean, color: string, active?: boolean }> = ({ icon, label, onClick, isMinimized, color, active }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-4 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all w-full text-left ${active ? 'bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30' : ''}`}
    title={label}
  >
    <Icon name={icon} className={`text-lg ${color}`} fill={active} />
    {!isMinimized && <span className={`${color} truncate`}>{label}</span>}
  </button>
);
