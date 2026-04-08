
import React from 'react';
import { Icon } from './Icon';
import { ChangeLogEntry } from '../types';

interface HistoryPanelProps {
  logs: ChangeLogEntry[];
  onClose: () => void;
  onClear: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ logs, onClose, onClear }) => {
  const reversedLogs = [...logs].reverse();

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-slate-900 shadow-2xl z-[150] flex flex-col border-l border-slate-200 dark:border-slate-800 animate-slide-left">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <Icon name="history" className="text-xl" fill />
            </div>
            <div className="flex flex-col">
               <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Histórico de Alterações</h4>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Registro de Auditoria</span>
            </div>
         </div>
         <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
            <Icon name="close" />
         </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
         {reversedLogs.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-20 opacity-40">
              <Icon name="history_toggle_off" className="text-6xl" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhum registro encontrado</p>
           </div>
         ) : (
           reversedLogs.map(log => (
             <div key={log.id} className="relative pl-6 border-l-2 border-slate-100 dark:border-slate-800 pb-2 group">
                <div className={`absolute -left-[7px] top-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${log.type === 'auto' ? 'bg-orange-500' : 'bg-indigo-600'}`} />
                <div className="flex flex-col gap-1">
                   <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight opacity-60">{log.timestamp}</span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${log.type === 'auto' ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'}`}>{log.type}</span>
                   </div>
                   <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight leading-tight">{log.action}</p>
                   <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 transition-colors">{log.details}</p>
                </div>
             </div>
           ))
         )}
      </div>

      <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <button 
            disabled={logs.length === 0}
            onClick={onClear}
            className="w-full py-3 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-rose-500 hover:text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2"
          >
             <Icon name="delete_sweep" className="text-lg" /> Limpar Histórico
          </button>
      </div>
    </div>
  );
};
