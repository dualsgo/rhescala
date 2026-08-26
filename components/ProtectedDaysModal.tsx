import React, { useState, useEffect } from 'react';
import { MonthYear } from '../types';
import { Icon } from './Icon';
import { normalizeProtectedDaysConfig, getSeasonalPresetProtectedDays } from '../constants';

interface ProtectedDaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMY: MonthYear;
  protectedConfig: Record<number, number>;
  onSaveConfig: (newConfig: Record<number, number>) => void;
  onOptimizeSchedule: (configToOptimize: Record<number, number>) => void;
  isReadOnly?: boolean;
}

const WEEKDAY_NAMES_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const ProtectedDaysModal: React.FC<ProtectedDaysModalProps> = ({
  isOpen,
  onClose,
  currentMY,
  protectedConfig,
  onSaveConfig,
  onOptimizeSchedule,
  isReadOnly = false,
}) => {
  const [draftConfig, setDraftConfig] = useState<Record<number, number>>({});
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();

  useEffect(() => {
    if (isOpen) {
      setDraftConfig(normalizeProtectedDaysConfig(protectedConfig));
    }
  }, [isOpen, protectedConfig]);

  if (!isOpen) return null;

  const configuredCount = Object.keys(draftConfig).length;

  const handleToggleDay = (dayNum: number) => {
    if (isReadOnly) return;
    setDraftConfig(prev => {
      const copy = { ...prev };
      if (copy[dayNum] !== undefined) {
        delete copy[dayNum];
      } else {
        copy[dayNum] = 0; // Padrão: 0 folgas (100% presença)
      }
      return copy;
    });
  };

  const handleSetMaxFolgas = (dayNum: number, maxFolgas: number) => {
    if (isReadOnly) return;
    setDraftConfig(prev => ({
      ...prev,
      [dayNum]: Math.max(0, maxFolgas)
    }));
  };

  const handleApplyPreset = (preset: Record<number, number>) => {
    if (isReadOnly) return;
    setDraftConfig(prev => ({
      ...prev,
      ...preset
    }));
  };

  const handleClearAll = () => {
    if (isReadOnly) return;
    setDraftConfig({});
  };

  const handleSaveOnly = () => {
    onSaveConfig(draftConfig);
    onClose();
  };

  const handleSaveAndOptimize = () => {
    onSaveConfig(draftConfig);
    onOptimizeSchedule(draftConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
              <Icon name="shield" className="text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                  Configurar Dias Protegidos
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase">
                  {configuredCount} {configuredCount === 1 ? 'dia ativo' : 'dias ativos'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-400">
                {MONTH_NAMES[currentMY.month]} de {currentMY.year} • Defina os dias e o limite máximo de folgas permitidas
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-400 transition-colors"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Quick Presets Toolbar */}
        <div className="px-6 py-3 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1">
            Sugestões Rápidas:
          </span>
          
          {currentMY.month === 9 && (
            <button
              onClick={() => handleApplyPreset(getSeasonalPresetProtectedDays(9))}
              className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50 hover:bg-orange-100 text-xs font-black uppercase flex items-center gap-1.5 transition-all"
            >
              <Icon name="celebration" className="text-sm" />
              <span>Semana da Criança (8 a 12)</span>
            </button>
          )}

          {currentMY.month === 11 && (
            <button
              onClick={() => handleApplyPreset(getSeasonalPresetProtectedDays(11))}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100 text-xs font-black uppercase flex items-center gap-1.5 transition-all"
            >
              <Icon name="auto_awesome" className="text-sm" />
              <span>Semana do Natal (20 a 24)</span>
            </button>
          )}

          {currentMY.month !== 9 && currentMY.month !== 11 && (
            <>
              <button
                onClick={() => handleApplyPreset({ 1: 0, 2: 0 })}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-[11px] font-bold uppercase transition-all"
              >
                Início do Mês
              </button>
            </>
          )}

          {configuredCount > 0 && (
            <button
              onClick={handleClearAll}
              className="ml-auto px-3 py-1 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[11px] font-black uppercase flex items-center gap-1 transition-all"
            >
              <Icon name="delete_sweep" className="text-sm" />
              <span>Limpar Seleção</span>
            </button>
          )}
        </div>

        {/* Calendar Day Grid */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: daysInMonth }, (_, idx) => {
              const dayNum = idx + 1;
              const date = new Date(currentMY.year, currentMY.month, dayNum);
              const dow = date.getDay();
              const isSunday = dow === 0;
              const isProtected = draftConfig[dayNum] !== undefined;
              const maxFolgas = isProtected ? draftConfig[dayNum] : 0;

              return (
                <div
                  key={dayNum}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                    isProtected
                      ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60 ring-2 ring-amber-400/20 shadow-sm'
                      : 'bg-slate-50/50 dark:bg-zinc-800/30 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                  }`}
                >
                  {/* Day Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center font-black shrink-0 ${
                          isProtected
                            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                            : isSunday
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                            : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-xs leading-none">{dayNum}</span>
                        <span className="text-[7px] uppercase tracking-tighter mt-0.5">{WEEKDAY_NAMES_SHORT[dow]}</span>
                      </div>
                      
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100 block">
                          Dia {String(dayNum).padStart(2, '0')}/{String(currentMY.month + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {isProtected 
                            ? (maxFolgas === 0 ? '🛡️ 100% da Equipe' : `🛡️ Máx. ${maxFolgas} ${maxFolgas === 1 ? 'Folga' : 'Folgas'}`) 
                            : 'Dia Normal'}
                        </span>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => handleToggleDay(dayNum)}
                      className={`p-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                        isProtected
                          ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 hover:bg-rose-100 hover:text-rose-600'
                          : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-600 border border-slate-200 dark:border-zinc-700'
                      }`}
                      title={isProtected ? 'Clique para desproteger este dia' : 'Clique para proteger este dia'}
                    >
                      <Icon name={isProtected ? 'shield' : 'shield_moon'} className="text-base" />
                    </button>
                  </div>

                  {/* Max Folgas Controls (if protected) */}
                  {isProtected && (
                    <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/40 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">
                        Máx. Folgas:
                      </span>
                      
                      <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded-xl border border-amber-200 dark:border-amber-800/60">
                        <button
                          type="button"
                          disabled={isReadOnly || maxFolgas <= 0}
                          onClick={() => handleSetMaxFolgas(dayNum, maxFolgas - 1)}
                          className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-amber-100 text-slate-700 dark:text-slate-200 disabled:opacity-30 font-black text-xs flex items-center justify-center transition-colors"
                        >
                          -
                        </button>
                        
                        <span className="w-8 text-center text-xs font-black text-amber-600 dark:text-amber-400">
                          {maxFolgas}
                        </span>

                        <button
                          type="button"
                          disabled={isReadOnly || maxFolgas >= 10}
                          onClick={() => handleSetMaxFolgas(dayNum, maxFolgas + 1)}
                          className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-amber-100 text-slate-700 dark:text-slate-200 disabled:opacity-30 font-black text-xs flex items-center justify-center transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* Quick 0 / 1 / 2 Badges */}
                      <div className="flex items-center gap-1">
                        {[0, 1, 2].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleSetMaxFolgas(dayNum, num)}
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-black transition-all ${
                              maxFolgas === num
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {num}F
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-bold text-slate-400">
            💡 <strong className="text-slate-600 dark:text-slate-300">0 Folgas</strong> garante 100% de presença CLT/Sazonal. <strong className="text-slate-600 dark:text-slate-300">X Folgas</strong> permite até X descansos sem violar o 6x1.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveOnly}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider transition-all"
            >
              Salvar Apenas
            </button>

            <button
              type="button"
              onClick={handleSaveAndOptimize}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-orange-500/20 active:scale-95 flex items-center gap-2"
            >
              <Icon name="auto_fix_high" className="text-sm" />
              <span>Salvar e Otimizar Escala</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
