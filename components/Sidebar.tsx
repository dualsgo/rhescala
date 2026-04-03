import React from 'react';
import { Icon } from './Icon';
import { SyncStatus, MonthYear } from '../types';

interface SidebarProps {
  currentView: 'grid' | 'team' | 'analysis' | 'credits';
  onViewChange: (view: 'grid' | 'team' | 'analysis' | 'credits') => void;
  currentMY: MonthYear;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  syncStatus: SyncStatus;
  onForceSync: () => Promise<void>;
  onExcel: () => void;
  onPDF: () => void;
  onBackup: () => void;
  onAutoFill: () => void;
  onUpdateFromTeam: () => void;
  onHolidayManager: () => void;
  onOpenCredits: () => void;
  isLocked: boolean;
  onToggleLock: (locked: boolean) => void;
  isEditable: boolean;
  onToggleEdit: () => void;
  isMenuMinimized: boolean;
  setIsMenuMinimized: (min: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  currentMY,
  onPrevMonth,
  onNextMonth,
  syncStatus,
  onForceSync,
  onExcel,
  onPDF,
  onBackup,
  onAutoFill,
  onUpdateFromTeam,
  onHolidayManager,
  onOpenCredits,
  isLocked,
  onToggleLock,
  isEditable,
  onToggleEdit,
  isMenuMinimized,
  setIsMenuMinimized,
}) => {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const navItems = [
    { id: 'grid', label: 'Escala Mensal', icon: 'table_rows' },
    { id: 'team', label: 'Equipe & Cargos', icon: 'groups' },
    { id: 'analysis', label: 'Análise de Escala', icon: 'insights' },
  ];

  const actions = [
    { id: 'excel', label: 'Exportar Excel', icon: 'table_view', color: 'text-emerald-600', hover: 'hover:bg-emerald-50 hover:text-emerald-700', action: onExcel },
    { id: 'pdf', label: 'Gerar PDF', icon: 'picture_as_pdf', color: 'text-rose-600', hover: 'hover:bg-rose-50 hover:text-rose-700', action: onPDF },
    { id: 'backup', label: 'Backup e Dados', icon: 'storage', color: 'text-sky-600', hover: 'hover:bg-sky-50 hover:text-sky-700', action: onBackup },
  ];

  return (
    <aside 
      className={`h-screen flex flex-col bg-white border-r border-slate-200 transition-all duration-300 z-[100] sticky top-0 ${
        isMenuMinimized ? 'w-[72px]' : 'w-72'
      }`}
    >
      {/* Sidebar Header: Month Selector */}
      <div className="p-4 border-b border-slate-100">
        <div className={`flex items-center gap-3 ${isMenuMinimized ? 'flex-col' : 'justify-between'}`}>
          {!isMenuMinimized && (
              <button 
                  onClick={onPrevMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-orange-500 transition-colors"
                  title="Mês Anterior"
              >
                  <Icon name="chevron_left" />
              </button>
          )}
          
          <div className="flex flex-col items-center">
            <span className={`text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 ${isMenuMinimized ? 'mb-1 text-[8px]' : ''}`}>
               {months[currentMY.month]}
            </span>
            {!isMenuMinimized && (
               <span className="text-sm font-black text-slate-800 uppercase">
                  {currentMY.year}
               </span>
            )}
          </div>

          {!isMenuMinimized && (
              <button 
                  onClick={onNextMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-orange-500 transition-colors"
                  title="Próximo Mês"
              >
                  <Icon name="chevron_right" />
              </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-6">
        
        {/* Section: Views */}
        <div className="flex flex-col gap-1">
          {!isMenuMinimized && <h4 className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Navegação</h4>}
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as any)}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                currentView === item.id 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' 
                : 'text-slate-500 hover:bg-slate-100'
              }`}
              title={isMenuMinimized ? item.label : ''}
            >
              <Icon name={item.icon} className={currentView === item.id ? 'fill-1' : ''} />
              {!isMenuMinimized && <span className="text-xs font-bold uppercase tracking-tight">{item.label}</span>}
            </button>
          ))}
        </div>

        {/* Section: Actions */}
        <div className="flex flex-col gap-1">
          <div className="space-y-1.5">
          <p className={`px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 transition-opacity ${isMenuMinimized ? 'opacity-0' : 'opacity-100'}`}>Motor de Escala</p>
          <button 
            onClick={onAutoFill}
            disabled={isLocked}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${isLocked ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:bg-orange-50 group hover:translate-x-1'}`}
          >
            <div className={`w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 shadow-sm transition-all ${!isLocked && 'group-hover:bg-orange-500 group-hover:text-white'}`}>
               <Icon name="auto_awesome" className="text-xl" />
            </div>
            {!isMenuMinimized && (
               <div className="text-left overflow-hidden">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Auto Preencher</p>
                  <p className="text-[9px] font-bold text-slate-400 truncate">Calibração Inteligente 6x1</p>
               </div>
            )}
          </button>

          <button 
            onClick={onUpdateFromTeam}
            disabled={isLocked}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${isLocked ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:bg-indigo-50 group hover:translate-x-1'}`}
          >
            <div className={`w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm transition-all ${!isLocked && 'group-hover:bg-indigo-500 group-hover:text-white'}`}>
               <Icon name="refresh" className="text-xl" />
            </div>
            {!isMenuMinimized && (
               <div className="text-left overflow-hidden">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Atualizar Regras</p>
                  <p className="text-[9px] font-bold text-slate-400 truncate">Aplica folgas sem alterar domingos</p>
               </div>
            )}
          </button>
        </div>

        {/* Gestão Coletiva */}
        <div className="pt-4 space-y-1.5 border-t border-slate-100 mt-4">
          <p className={`px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 transition-opacity ${isMenuMinimized ? 'opacity-0' : 'opacity-100'}`}>Gestão Adicional</p>
          <button 
            onClick={onOpenCredits}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all hover:bg-emerald-50 group hover:translate-x-1 ${currentView === 'credits' ? 'bg-emerald-50 ring-1 ring-emerald-200' : ''}`}
          >
            <div className={`w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm group-hover:bg-emerald-500 group-hover:text-white transition-all ${currentView === 'credits' ? 'bg-emerald-500 text-white' : ''}`}>
               <Icon name="verified" className="text-xl" />
            </div>
            {!isMenuMinimized && (
               <div className="text-left overflow-hidden">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Saldos de Feriado</p>
                  <p className="text-[9px] font-bold text-slate-400 truncate">Sugestões de Folga (FF)</p>
               </div>
            )}
          </button>

          <button 
            onClick={onHolidayManager}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all hover:bg-slate-50 group hover:translate-x-1`}
          >
            <div className={`w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 shadow-sm group-hover:bg-slate-900 group-hover:text-white transition-all`}>
               <Icon name="settings" className="text-xl" />
            </div>
            {!isMenuMinimized && (
               <div className="text-left overflow-hidden">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Config Feriados</p>
                  <p className="text-[9px] font-bold text-slate-400 truncate">Gerenciar datas do ano</p>
               </div>
            )}
          </button>
        </div>

          {actions.map(action => (
            <button
              key={action.id}
              onClick={action.action}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${action.color} ${action.hover}`}
              title={isMenuMinimized ? action.label : ''}
            >
              <Icon name={action.icon} />
              {!isMenuMinimized && <span className="text-xs font-bold uppercase tracking-tight">{action.label}</span>}
            </button>
          ))}
        </div>

        {/* Section: System Control */}
        <div className="flex flex-col gap-1">
          {!isMenuMinimized && <h4 className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Segurança</h4>}
          
          <button
            onClick={onToggleLock}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
              isLocked 
              ? 'bg-rose-50 text-rose-600' 
              : 'text-slate-500 hover:bg-slate-100'
            }`}
            title={isMenuMinimized ? (isLocked ? 'Desbloquear' : 'Bloquear') : ''}
          >
            <Icon name={isLocked ? 'lock' : 'lock_open'} fill={isLocked} />
            {!isMenuMinimized && <span className="text-xs font-bold uppercase tracking-tight">{isLocked ? 'Escala Bloqueada' : 'Bloquear Escala'}</span>}
          </button>

          <button
            onClick={onToggleEdit}
            disabled={isLocked}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
              isLocked ? 'opacity-40 cursor-not-allowed' :
              isEditable 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
              : 'text-slate-500 hover:bg-slate-100'
            }`}
            title={isMenuMinimized ? 'Modo Edição' : ''}
          >
            <Icon name={isEditable ? 'save' : 'edit_square'} fill={isEditable} />
            {!isMenuMinimized && <span className="text-xs font-bold uppercase tracking-tight">{isEditable ? 'Salvar Edições' : 'Ativar Edição'}</span>}
          </button>
        </div>
      </div>

      {/* Sidebar Footer: Sync & Minimize */}
      <div className="p-3 border-t border-slate-100 flex flex-col gap-3">
        
        {/* Sync Indicator */}
        <button
          onClick={onForceSync}
          className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
            syncStatus.state === 'syncing' ? 'bg-blue-50 border-blue-200 text-blue-600' :
            syncStatus.state === 'synced' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
            syncStatus.state === 'error' ? 'bg-rose-50 border-rose-200 text-rose-600' :
            'bg-slate-50 border-slate-200 text-slate-500'
          }`}
          title={isMenuMinimized ? 'Sincronizar Agora' : ''}
        >
          <Icon 
            name={
              syncStatus.state === 'syncing' ? 'sync' :
              syncStatus.state === 'synced' ? 'cloud_done' :
              syncStatus.state === 'error' ? 'cloud_off' :
              'cloud'
            } 
            className={`text-lg ${syncStatus.state === 'syncing' ? 'animate-spin' : ''}`} 
          />
          {!isMenuMinimized && (
            <div className="flex flex-col items-start leading-none">
              <span className="text-[9px] font-black uppercase tracking-tight">Sincronização</span>
              <span className="text-[8px] font-medium opacity-60">
                {syncStatus.state === 'syncing' ? 'Salvando...' : syncStatus.lastSync ? `Em ${syncStatus.lastSync.split(' ')[1]}` : 'Pronto'}
              </span>
            </div>
          )}
        </button>

        {/* Minimize Button */}
        <button 
          onClick={() => setIsMenuMinimized(!isMenuMinimized)}
          className="flex items-center gap-3 p-3 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all duration-200"
        >
          <Icon name={isMenuMinimized ? 'menu_open' : 'menu'} />
          {!isMenuMinimized && <span className="text-xs font-bold uppercase tracking-tight">Minimizar</span>}
        </button>
      </div>
    </aside>
  );
};
