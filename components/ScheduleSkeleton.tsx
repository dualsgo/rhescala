import React from 'react';

interface ScheduleSkeletonProps {
  mode?: 'auto' | 'table' | 'mobile';
  rowsCount?: number;
}

export const ScheduleSkeleton: React.FC<ScheduleSkeletonProps> = ({
  mode = 'auto',
  rowsCount = 8,
}) => {
  return (
    <div 
      aria-label="Carregando escala..."
      role="status"
      className="w-full h-full flex flex-col gap-3 animate-pulse p-2 sm:p-4 select-none"
    >
      {/* 1. Modo Mobile (< lg) */}
      <div className={`${mode === 'table' ? 'hidden' : mode === 'mobile' ? 'flex' : 'flex lg:hidden'} flex-col gap-3.5 max-w-lg mx-auto w-full`}>
        {/* Header Colaborador Skeleton */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
              <div className="space-y-1.5">
                <div className="w-24 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                <div className="w-16 h-2.5 bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
              </div>
            </div>
            <div className="w-16 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="w-28 h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        {/* Hero Card Skeleton */}
        <div className="rounded-3xl p-6 bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="w-28 h-6 bg-zinc-300 dark:bg-zinc-800 rounded-xl" />
            <div className="w-20 h-6 bg-zinc-300 dark:bg-zinc-800 rounded-xl" />
          </div>
          <div className="w-44 h-10 bg-zinc-300 dark:bg-zinc-800 rounded-xl mt-2" />
          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-zinc-300/60 dark:border-zinc-800">
            <div className="h-14 bg-zinc-300 dark:bg-zinc-800/80 rounded-2xl" />
            <div className="h-14 bg-zinc-300 dark:bg-zinc-800/80 rounded-2xl" />
          </div>
        </div>

        {/* Agenda Cards Skeleton */}
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div 
              key={i} 
              className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between min-h-[56px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                <div className="space-y-1.5">
                  <div className="w-24 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                  <div className="w-16 h-2.5 bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
                </div>
              </div>
              <div className="w-16 h-6 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Modo Desktop Tabela (>= lg) */}
      <div className={`${mode === 'mobile' ? 'hidden' : mode === 'table' ? 'flex' : 'hidden lg:flex'} flex-col gap-3 w-full h-full overflow-hidden bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm`}>
        {/* Table Toolbar Skeleton */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-28 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="w-20 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="w-32 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        {/* Table Skeleton Header & Rows */}
        <div className="w-full flex-1 overflow-hidden flex flex-col gap-1.5">
          {/* Header Row (Cols 1 to 31) */}
          <div className="flex items-center gap-1 pb-1 border-b border-zinc-200 dark:border-zinc-800">
            <div className="w-36 h-9 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            <div className="hidden sm:block w-28 h-9 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            <div className="flex items-center gap-1 flex-1 overflow-hidden">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="flex-1 min-w-[34px] h-9 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0" />
              ))}
            </div>
          </div>

          {/* Body Rows */}
          {Array.from({ length: rowsCount }).map((_, rIdx) => (
            <div key={rIdx} data-testid="skeleton-table-row" className="flex items-center gap-1 py-1">
              <div className="w-36 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 shrink-0 flex items-center gap-2 px-2">
                <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="w-20 h-3 bg-zinc-200 dark:bg-zinc-800 rounded" />
              </div>
              <div className="hidden sm:block w-28 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 shrink-0 p-2">
                <div className="w-16 h-3 bg-zinc-200 dark:bg-zinc-800 rounded mt-1" />
              </div>
              <div className="flex items-center gap-1 flex-1 overflow-hidden">
                {Array.from({ length: 24 }).map((_, cIdx) => (
                  <div 
                    key={cIdx} 
                    className="flex-1 min-w-[34px] h-10 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 shrink-0" 
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Carregando dados da escala...</span>
    </div>
  );
};
