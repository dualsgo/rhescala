
import React, { useState } from 'react';
import { Icon } from './Icon';
import { Employee, MonthYear, Holiday, SyncStatus, ShiftType } from '../types';
import { InconsistencyPanel } from './InconsistencyPanel';

interface SidebarProps {
  currentView: 'grid' | 'team' | 'analysis' | 'calendar' | 'alerts' | 'config';
  onViewChange: (view: 'grid' | 'team' | 'analysis' | 'calendar' | 'alerts' | 'config') => void;
  currentMY: MonthYear;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  employees: Employee[];
  customHolidays: Holiday[];
  syncStatus: SyncStatus;
  onForceSync: () => Promise<void>;
  onImportClick: () => void;
  isGridLocked: boolean;
  onToggleLock: () => void;
  isEditable: boolean;
  onToggleEdit: () => void;
  allowRetroactive: boolean;
  onToggleRetroactive: () => void;
  onSyncRules: () => void;
  onSortSchedule: () => void;
  onShowHolidayManager: () => void;
  onShowShiftManager: () => void;
  onShowPrintView: () => void;
  onSelectDay: (idx: number) => void;
  onShowHolidayCredit: () => void;
  isZenMode: boolean;
  onToggleZen: () => void;
  
  // Grid Filters & Actions
  filter: 'all' | 'sunday' | 'holiday' | 'week' | 'today' | 'tomorrow';
  onFilterChange: (f: 'all' | 'sunday' | 'holiday' | 'week' | 'today' | 'tomorrow') => void;
  selectedWeek: number;
  onWeekChange: (w: number) => void;
  weeksInMonth: number;
  daysInMonth: number;
  selectedDayIdx: number;
  onShareWhatsApp: (idx: number) => void;
  days: { num: number; weekday: string }[];
  today: Date;
  onUpdateShift: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateShifts: (updates: { empId: string, dayIdx: number, newShift: ShiftType }[]) => void;
  onShowHistory: () => void;
  onOpenAnalysis: () => void;
}

const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  currentMY,
  onNextMonth,
  onPrevMonth,
  employees,
  customHolidays,
  syncStatus,
  onForceSync,
  onImportClick,
  isGridLocked,
  onToggleLock,
  isEditable,
  onToggleEdit,
  allowRetroactive,
  onToggleRetroactive,
  onSyncRules,
  onSortSchedule,
  onShowHolidayManager,
  onShowShiftManager,
  onShowPrintView,
  onOpenAnalysis,
  onShowHolidayCredit,
  isZenMode,
  onToggleZen,
  filter,
  onFilterChange,
  selectedWeek,
  onWeekChange,
  weeksInMonth,
  daysInMonth,
  selectedDayIdx,
  onSelectDay,
  onShareWhatsApp,
  days,
  today,
  onUpdateShift,
  onUpdateShifts,
  onShowHistory
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const monthName = months[currentMY.month];
  const navItems = [
    { id: 'grid', label: 'Escala', icon: 'table_rows' },
    { id: 'calendar', label: 'Calendário', icon: 'calendar_view_month' },
    { id: 'team', label: 'Equipe', icon: 'groups' },
    { id: 'config', label: 'Jornadas', icon: 'settings' },
    { id: 'analysis', label: 'Análise', icon: 'insights' },
    { id: 'alerts', label: 'Alertas', icon: 'notifications_active' },
  ];

  return (
    <aside 
      className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-50 sticky top-0 h-screen overflow-hidden ${
        isMinimized ? 'w-20' : 'w-72'
      }`}
    >
      {/* Header / Logo */}
      <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
        {!isMinimized && (
          <div className="flex items-center gap-3 animate-fade-in truncate">
             <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-orange-200">
                <Icon name="calendar_month" className="text-2xl" fill />
             </div>
             <span className="text-slate-950 dark:text-slate-100 text-xl font-black uppercase tracking-tighter">ESCALA</span>
          </div>
        )}
        {isMinimized && (
          <div className="mx-auto text-orange-500">
             <Icon name="calendar_month" className="text-2xl" fill />
          </div>
        )}
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-all ${isMinimized ? 'absolute -right-4 top-10 bg-white border border-slate-200 shadow-md z-[60]' : ''}`}
        >
          <Icon name={isMinimized ? 'chevron_right' : 'menu_open'} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6 pt-4">
        
        {/* Section: View Modes (Lock Daily Use) */}
        {currentView === 'grid' && (
          <section className="space-y-2">
            {!isMinimized && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Segurança e Vista</p>}
             <button 
              onClick={onToggleZen}
              className={`flex items-center gap-4 px-4 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all w-full text-left shadow-lg active:scale-95 ${isZenMode ? 'bg-orange-500 text-white' : 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:bg-slate-800'}`}
              title="Ativar Modo Exibição (Tela Cheia)"
            >
              <Icon name="visibility" className="text-xl" fill />
              {!isMinimized && <span>MODO EXIBIÇÃO</span>}
            </button>
            <button 
              onClick={onToggleLock}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-full text-left border ${isGridLocked ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
              title={isGridLocked ? "Desbloquear Edições (Requer Senha)" : "Trancar Edições"}
            >
              <Icon name={isGridLocked ? "lock" : "lock_open"} className="text-lg" fill={isGridLocked} />
              {!isMinimized && <span>{isGridLocked ? "Edição Bloqueada" : "Bloquear Edição"}</span>}
            </button>
            {!isGridLocked && (
              <button 
                onClick={onToggleRetroactive}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-full text-left border ${allowRetroactive ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                title="Permitir editar hoje e dias passados"
              >
                <Icon name="history" className="text-lg" fill={allowRetroactive} />
                {!isMinimized && <span>{allowRetroactive ? "Retroativo Ativo" : "Permitir Retroativo"}</span>}
              </button>
            )}
          </section>
        )}

        {/* Section: Navigation */}
        <section>
          {!isMinimized && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-3">Navegação</p>}
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

        {/* Section: Period & Data Control */}
        {currentView === 'grid' && (
          <>
            <section className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-2 space-y-2 border border-slate-100 dark:border-slate-800">
              {!isMinimized && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 pt-2">Período Ativo</p>}
              <div className={`flex items-center gap-1 ${isMinimized ? 'flex-col py-1' : 'justify-between px-2'}`}>
                <button onClick={onPrevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-orange-500" title="Voltar Mês">
                    <Icon name="chevron_left" />
                </button>
                {!isMinimized && (
                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase whitespace-nowrap">
                    {monthName} {currentMY.year}
                  </span>
                )}
                <button onClick={onNextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-orange-500" title="Avançar Mês">
                    <Icon name="chevron_right" />
                </button>
              </div>
            </section>

            {/* Section: Grid Actions */}
            <section className="space-y-2">
              {!isMinimized && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Ações Rápidas</p>}
              <div className="flex flex-col gap-1">
                <SidebarActionButton 
                  icon={isEditable ? 'save' : 'edit_square'} 
                  label={isEditable ? 'Salvar Edição' : 'Editar Escala'} 
                  onClick={onToggleEdit} 
                  disabled={isGridLocked}
                  isMinimized={isMinimized} 
                  active={isEditable}
                  color={isEditable ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'text-slate-700 dark:text-slate-300'}
                />
                 <SidebarActionButton 
                   icon="sync" 
                   label="Sincronizar Dados" 
                   onClick={onSyncRules} 
                   disabled={isGridLocked || isZenMode}
                   isMinimized={isMinimized} 
                   color="bg-sky-600 text-white shadow-md font-black"
                 />
                 <SidebarActionButton 
                   icon="auto_fix_high" 
                   label="Sortear Escala" 
                   onClick={onSortSchedule} 
                   disabled={isGridLocked || isZenMode}
                   isMinimized={isMinimized} 
                   color="bg-orange-500 text-white shadow-md font-black"
                 />
              </div>
            </section>

            {/* Section: Filter Tabs */}
            <section className="space-y-2">
              {!isMinimized && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Visualização</p>}
              <div className={`flex flex-col gap-1 ${isMinimized ? 'items-center' : ''}`}>
                 <SidebarFilterItem id="all" label="Mês Inteiro" icon="calendar_view_month" current={filter} onClick={onFilterChange} isMinimized={isMinimized} />
                 <SidebarFilterItem id="today" label="Ver Hoje" icon="today" current={filter} onClick={onFilterChange} isMinimized={isMinimized} />
                 <SidebarFilterItem id="tomorrow" label="Ver Amanhã" icon="event" current={filter} onClick={onFilterChange} isMinimized={isMinimized} />
                 <SidebarFilterItem id="sunday" label="Domingos" icon="event_seat" current={filter} onClick={onFilterChange} isMinimized={isMinimized} />
                 <SidebarFilterItem id="holiday" label="Feriados" icon="event_busy" current={filter} onClick={onFilterChange} isMinimized={isMinimized} />
                 <SidebarFilterItem id="week" label="Por Semana" icon="view_week" current={filter} onClick={onFilterChange} isMinimized={isMinimized} />
              </div>
              

              
              {filter === 'week' && !isMinimized && (
                <div className="px-4 py-2 bg-orange-50 dark:bg-orange-950/20 rounded-xl grid grid-cols-5 gap-1 animate-fade-in border border-orange-100 dark:border-orange-900/30">
                  {Array.from({ length: weeksInMonth }, (_, i) => (
                    <button 
                      key={i} 
                      onClick={() => onWeekChange(i + 1)}
                      className={`py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedWeek === i+1 ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-600 hover:bg-orange-100'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Section: Validation & Tools */}
            <section className="space-y-2">
               {!isMinimized && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Ferramentas</p>}
               <div className="flex flex-col gap-1">
                   {/* O painel de inconsistências foi movido para uma página dedicada */}
                  <SidebarToolButton icon="event_repeat" label="Folgas Feriado" onClick={onShowHolidayCredit} isMinimized={isMinimized} color="text-emerald-500" />
                  <SidebarToolButton icon="history" label="Histórico" onClick={onShowHistory} isMinimized={isMinimized} color="text-indigo-500" />
                  <SidebarToolButton icon="print" label="Imprimir Escala" onClick={onShowPrintView} isMinimized={isMinimized} color="text-slate-600" />
                  <SidebarToolButton icon="settings" label="Config. Feriados" onClick={onShowHolidayManager} isMinimized={isMinimized} color="text-slate-400" />
               </div>
            </section>
          </>
        )}

        {/* Section: Export & Backup */}
        <section className="space-y-3">
          {!isMinimized && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Dados</p>}
          <div className="flex flex-col gap-2">
             <div className={`flex gap-1 ${isMinimized ? 'flex-col' : 'px-1'}`}>
                <button title="Exportar Excel" className="flex-1 p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all flex items-center justify-center shrink-0 border border-green-100"><Icon name="table_view" /></button>
                <button onClick={onImportClick} title="Importar Backup" className="flex-1 p-3 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-100 transition-all flex items-center justify-center shrink-0 border border-sky-100"><Icon name="cloud_upload" /></button>
             </div>
             
             <button 
               onClick={onForceSync}
               className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all border ${
                 syncStatus.state === 'syncing' ? 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse' :
                 syncStatus.state === 'synced' ? 'bg-green-50 border-green-200 text-green-600' :
                 syncStatus.state === 'error' ? 'bg-red-50 border-red-200 text-red-600' :
                 'bg-slate-50 border-slate-200 text-slate-500'
               }`}
               title="Status de Sincronização"
             >
               <Icon name={syncStatus.state === 'syncing' ? 'sync' : 'cloud_done'} className={syncStatus.state === 'syncing' ? 'animate-spin' : ''} />
               {!isMinimized && (
                 <div className="flex flex-col items-start leading-none truncate">
                    <span className="text-[9px] font-black uppercase tracking-tight">{syncStatus.state === 'syncing' ? 'Sincronizando...' : 'Nuvem Atualizada'}</span>
                    <span className="text-[7px] font-bold opacity-60 uppercase">{syncStatus.lastSync ? `Última: ${syncStatus.lastSync}` : 'Sincronizar Agora'}</span>
                 </div>
               )}
             </button>
          </div>
        </section>

      </div>

      {/* Footer: User & WhatsApp */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/10 backdrop-blur-sm">
        {currentView === 'grid' && (
          <div className={`mb-3 p-2 bg-green-50 dark:bg-green-950/20 rounded-2xl flex flex-col gap-2 border border-green-100/50 dark:border-green-900/30 ${isMinimized ? 'items-center' : ''}`}>
             {!isMinimized && (
               <div className="px-1 pt-1">
                 <p className="text-[8px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest mb-1.5 opacity-60">Enviar Escala Diária</p>
                 <select 
                   value={selectedDayIdx} 
                   onChange={(e) => onSelectDay(parseInt(e.target.value))}
                   className="w-full bg-transparent text-[11px] font-black text-green-800 dark:text-green-300 border-none p-0 focus:ring-0 outline-none uppercase"
                 >
                   {days.map((d, i) => <option key={i} value={i}>Dia {d.num} ({d.weekday})</option>)}
                 </select>
               </div>
             )}
             <button 
               onClick={() => onShareWhatsApp(selectedDayIdx)}
               className={`w-full py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase shadow-lg shadow-green-600/20 ${isMinimized ? 'px-0' : ''}`}
               title="Compartilhar via WhatsApp"
             >
               <Icon name="send" className="text-sm" />
               {!isMinimized && <span>Compartilhar</span>}
             </button>
          </div>
        )}

      </div>
    </aside>
  );
};

const SidebarActionButton: React.FC<{ icon: string, label: string, onClick: () => void, isMinimized: boolean, color?: string, active?: boolean, disabled?: boolean }> = ({ icon, label, onClick, isMinimized, color, active, disabled }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-4 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all w-full text-left border border-transparent ${color || 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'} ${disabled ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:scale-[1.02] active:scale-95 shadow-sm'}`}
    title={label}
  >
    <Icon name={icon} className="text-xl" fill={active} />
    {!isMinimized && <span className="truncate">{label}</span>}
  </button>
);

const SidebarFilterItem: React.FC<{ id: string, label: string, icon: string, current: string, onClick: (id: any) => void, isMinimized: boolean }> = ({ id, label, icon, current, onClick, isMinimized }) => {
  const active = current === id;
  return (
    <button 
      onClick={() => onClick(id)}
      className={`flex items-center gap-4 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-full text-left ${active ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
      title={label}
    >
      <Icon name={icon} className="text-lg" fill={active} />
      {!isMinimized && <span className="truncate">{label}</span>}
    </button>
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
