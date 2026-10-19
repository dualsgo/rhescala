import React from 'react';
import { Icon } from './Icon';

interface MobileNavBarProps {
  currentView: string;
  onViewChange: (view: any) => void;
  pendingRequestsCount?: number;
  inconsistencyCount?: number;
  onOpenMenu: () => void;
  onGoToToday: () => void;
  isReadOnly?: boolean;
  viewerModeType?: 'personal' | 'grid';
  onToggleViewerMode?: () => void;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({
  currentView,
  onViewChange,
  pendingRequestsCount = 0,
  inconsistencyCount = 0,
  onOpenMenu,
  onGoToToday,
  isReadOnly = false,
  viewerModeType = 'personal',
  onToggleViewerMode,
}) => {
  const isEscalaActive = currentView === 'grid';
  const isRequestsActive = currentView === 'requests';
  const isAnalysisActive = currentView === 'analysis';

  if (isReadOnly && viewerModeType === 'personal') {
    return null;
  }

  return (
    <nav 
      aria-label="Navegação móvel inferior"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 px-2 py-1 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[max(env(safe-area-inset-bottom),0.5rem)]"
    >
      <div className={`grid ${isReadOnly ? 'grid-cols-2 max-w-[240px]' : 'grid-cols-5 max-w-md'} items-center gap-1 mx-auto`}>
        {/* 1. Alternador Modo Pessoal / Grade da Loja (Viewer) ou Escala (Admin) */}
        <button
          type="button"
          onClick={() => {
            if (isReadOnly && onToggleViewerMode) {
              onToggleViewerMode();
            } else {
              onViewChange('grid');
            }
          }}
          className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
            isEscalaActive 
              ? 'text-orange-600 dark:text-orange-400 font-black' 
              : 'text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
          title={isReadOnly ? (viewerModeType === 'personal' ? 'Ver Grade da Loja' : 'Voltar para Meu Dia') : 'Ver Escala'}
        >
          <div className={`p-1 rounded-xl transition-all ${isEscalaActive ? 'bg-orange-50 dark:bg-orange-950/50 scale-105' : ''}`}>
            <Icon 
              name={isReadOnly ? (viewerModeType === 'personal' ? 'grid_view' : 'badge') : 'calendar_month'} 
              className="text-xl" 
            />
          </div>
          <span className="text-[11px] tracking-tight truncate mt-0.5">
            {isReadOnly ? (viewerModeType === 'personal' ? 'Grade' : 'Meu Dia') : 'Escala'}
          </span>
          {isEscalaActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 absolute bottom-0.5"></span>
          )}
        </button>

        {/* 2. Hoje (Salto rápido para o dia corrente) */}
        <button
          type="button"
          onClick={onGoToToday}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium active:scale-95"
          title="Ver o dia de hoje"
        >
          <div className="p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            <Icon name="today" className="text-xl text-orange-500" />
          </div>
          <span className="text-[11px] tracking-tight truncate mt-0.5 font-bold text-zinc-700 dark:text-zinc-300">Hoje</span>
        </button>

        {/* 3. Solicitações (Apenas Gestão / Admin para preservar privacidade) */}
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => onViewChange('requests')}
            className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
              isRequestsActive 
                ? 'text-orange-600 dark:text-orange-400 font-black' 
                : 'text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all relative ${isRequestsActive ? 'bg-orange-50 dark:bg-orange-950/50 scale-105' : ''}`}>
              <Icon name="assignment" className="text-xl" />
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-black leading-none shadow-sm animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </div>
            <span className="text-[11px] tracking-tight truncate mt-0.5">Pedidos</span>
            {isRequestsActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 absolute bottom-0.5"></span>
            )}
          </button>
        )}

        {/* 4. Análise (Apenas Gestão / Admin) */}
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => onViewChange('analysis')}
            className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
              isAnalysisActive 
                ? 'text-orange-600 dark:text-orange-400 font-black' 
                : 'text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${isAnalysisActive ? 'bg-orange-50 dark:bg-orange-950/50 scale-105' : ''}`}>
              <Icon name="insights" className="text-xl" />
            </div>
            <span className="text-[11px] tracking-tight truncate mt-0.5">Análise</span>
            {isAnalysisActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 absolute bottom-0.5"></span>
            )}
          </button>
        )}

        {/* 5. Menu / Mais (Apenas Gestão / Admin) */}
        {!isReadOnly && (
          <button
            type="button"
            onClick={onOpenMenu}
            className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium active:scale-95 relative"
          >
            <div className="p-1 rounded-xl relative">
              <Icon name="menu" className="text-xl" />
              {inconsistencyCount > 0 && (
                <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              )}
              {inconsistencyCount > 0 && (
                <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              )}
            </div>
            <span className="text-[11px] tracking-tight truncate mt-0.5">Mais</span>
          </button>
        )}
      </div>
    </nav>
  );
};
