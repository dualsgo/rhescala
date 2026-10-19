import React, { useEffect, useState } from 'react';
import { SyncStatus } from '../types';
import { Icon } from './Icon';

interface SyncBlockingOverlayProps {
  syncStatus: SyncStatus;
  onRetrySync?: () => void;
}

export const SyncBlockingOverlay: React.FC<SyncBlockingOverlayProps> = ({ syncStatus, onRetrySync }) => {
  const [showOverlay, setShowOverlay] = useState(false);
  const [successPhase, setSuccessPhase] = useState(false);

  const isSyncing = syncStatus.state === 'syncing' && !syncStatus.isSilent;
  const isError = syncStatus.state === 'error';
  const isSynced = syncStatus.state === 'synced';

  const currentMessage = syncStatus.history && syncStatus.history.length > 0
    ? syncStatus.history[0].message
    : 'Processando alterações...';

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isSyncing) {
      setShowOverlay(true);
      setSuccessPhase(false);
    } else if (isError) {
      setShowOverlay(true);
      setSuccessPhase(false);
    } else if (isSynced && showOverlay) {
      // Exibe brevemente a fase de sucesso antes de fechar
      setSuccessPhase(true);
      timer = setTimeout(() => {
        setShowOverlay(false);
        setSuccessPhase(false);
      }, 600);
    }

    return () => clearTimeout(timer);
  }, [syncStatus.state, isSyncing, isError, isSynced]);

  if (!showOverlay) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950/75 glass-overlay flex items-center justify-center p-4 select-none animate-fade-in transition-all duration-300">
      <div className="glass-card bg-white/95 dark:bg-zinc-900/95 border border-slate-200/80 dark:border-zinc-800 shadow-2xl rounded-3xl p-6 sm:p-8 max-w-md w-full text-center relative overflow-hidden animate-scale-in">
        
        {/* Shimmer top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 dark:bg-zinc-800 overflow-hidden">
          {isSyncing && (
            <div className="h-full w-full bg-gradient-to-r from-amber-500 via-orange-500 to-blue-500 animate-shimmer" />
          )}
          {successPhase && (
            <div className="h-full w-full bg-emerald-500" />
          )}
          {isError && (
            <div className="h-full w-full bg-rose-500" />
          )}
        </div>

        {/* Ambient glow effect */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-orange-500/20 rounded-full blur-2xl pointer-events-none animate-pulse-glow" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none animate-pulse-glow" />

        {/* Icon & Animation Ring */}
        <div className="relative mx-auto w-20 h-20 mb-5 flex items-center justify-center">
          {isSyncing && (
            <>
              {/* Outer spinning ring */}
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 border-r-blue-500 animate-spin" />
              {/* Inner glowing pulse */}
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-orange-500/20 to-blue-500/20 flex items-center justify-center animate-pulse-glow">
                <Icon name="cloud_sync" className="text-3xl text-orange-500 dark:text-orange-400 animate-bounce" />
              </div>
            </>
          )}

          {successPhase && (
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center animate-scale-in">
              <Icon name="check_circle" className="text-4xl" />
            </div>
          )}

          {isError && !successPhase && (
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center animate-scale-in">
              <Icon name="cloud_off" className="text-4xl" />
            </div>
          )}
        </div>

        {/* Header Title */}
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
          {successPhase
            ? 'Alterações Salvas!'
            : isError
            ? 'Atenção no Salvamento'
            : 'Sincronizando com a Planilha'}
        </h3>

        {/* Dynamic Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4 bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/60">
          <span className={`w-2 h-2 rounded-full ${
            successPhase
              ? 'bg-emerald-500'
              : isError
              ? 'bg-rose-500 animate-ping'
              : 'bg-orange-500 animate-ping'
          }`} />
          {currentMessage || 'Gravando alterações no Google Sheets...'}
        </div>

        {/* Informative Description */}
        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
          {successPhase ? (
            'Seus dados foram atualizados no servidor com sucesso. A tela está pronta para uso.'
          ) : isError ? (
            'Não foi possível confirmar o salvamento na nuvem. Suas alterações permanecem salvas localmente.'
          ) : (
            'A tela está bloqueada temporariamente para evitar o acúmulo de edições simultâneas e garantir a integridade dos dados.'
          )}
        </p>

        {/* Bottom Lock Tag / Error Actions */}
        {isError && !successPhase ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {onRetrySync && (
              <button
                onClick={onRetrySync}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-medium text-sm transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
              >
                <Icon name="refresh" className="text-lg" />
                Tentar Novamente
              </button>
            )}
            <button
              onClick={() => setShowOverlay(false)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-medium text-sm transition-all"
            >
              Continuar Offline
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 dark:text-zinc-500 bg-slate-100/60 dark:bg-zinc-800/40 py-2.5 px-4 rounded-xl border border-slate-200/50 dark:border-zinc-800">
            <Icon name="lock" className="text-sm text-orange-500" />
            <span>Bloqueio temporário de edições ativo</span>
          </div>
        )}

      </div>
    </div>
  );
};
