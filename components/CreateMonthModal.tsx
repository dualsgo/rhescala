import React, { useEffect, useMemo, useState } from 'react';
import { Employee, Holiday, JornadaSettings, MonthGuidelines, MonthYear } from '../types';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';
import { resolveMonthGuidelines, validateGuidelineConflicts } from '../src/engine/config/guidelines';
import { Icon } from './Icon';

interface CreateMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetMY: MonthYear;
  employees?: Employee[];
  customHolidays?: Holiday[];
  deletedNationalHolidays?: string[];
  settings?: JornadaSettings;
  savedGuidelines?: MonthGuidelines;
  onConfirm: (mode: 'suggested_retro' | 'all_working', guidelines?: MonthGuidelines) => void;
}

export const CreateMonthModal: React.FC<CreateMonthModalProps> = ({
  isOpen,
  onClose,
  targetMY,
  employees = [],
  customHolidays = [],
  deletedNationalHolidays = [],
  settings = DEFAULT_JORNADA_SETTINGS,
  savedGuidelines,
  onConfirm,
}) => {
  const [selectedMode, setSelectedMode] = useState<'suggested_retro' | 'all_working'>('suggested_retro');
  const [step, setStep] = useState<'mode' | 'guidelines'>('mode');
  const [guidelines, setGuidelines] = useState<MonthGuidelines>(() =>
    resolveMonthGuidelines(targetMY.month, settings, savedGuidelines)
  );
  const [peakDaysText, setPeakDaysText] = useState<string>(() =>
    resolveMonthGuidelines(targetMY.month, settings, savedGuidelines).peakDays.join(', ')
  );

  useEffect(() => {
    if (!isOpen) return;
    const resolved = resolveMonthGuidelines(targetMY.month, settings, savedGuidelines);
    setGuidelines(resolved);
    setPeakDaysText(resolved.peakDays.join(', '));
    setStep('mode');
  }, [isOpen, targetMY.month, settings, savedGuidelines]);

  const conflictWarnings = useMemo(() => {
    if (!isOpen || selectedMode !== 'suggested_retro' || employees.length === 0) return [];
    return validateGuidelineConflicts(
      employees,
      targetMY.year,
      targetMY.month,
      guidelines,
      customHolidays,
      deletedNationalHolidays,
      settings
    );
  }, [isOpen, selectedMode, employees, targetMY.year, targetMY.month, guidelines, customHolidays, deletedNationalHolidays, settings]);

  if (!isOpen) return null;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const targetMonthName = monthNames[targetMY.month];

  const handlePeakTextChange = (val: string) => {
    setPeakDaysText(val);
    const parsed = val
      .split(/[,;\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !Number.isNaN(n) && n >= 1 && n <= 31);
    setGuidelines(prev => ({ ...prev, peakDays: Array.from(new Set(parsed)).sort((a, b) => a - b) }));
  };

  const handleGenerate = () => {
    onConfirm(selectedMode, selectedMode === 'suggested_retro' ? guidelines : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] max-w-xl w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm">
              <Icon name="auto_awesome" className="text-2xl" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">
                Criar Escala de {targetMonthName}/{targetMY.year}
              </h3>
              <p className="text-xs font-bold text-slate-400">
                {step === 'mode' ? 'Etapa 1 de 2: Modelo de geração' : 'Etapa 2 de 2: Diretrizes do mês'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-slate-400"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
          {step === 'mode' ? (
            <>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                Selecione como a escala deve ser gerada:
              </label>

              <label
                onClick={() => setSelectedMode('suggested_retro')}
                className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedMode === 'suggested_retro'
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/5'
                    : 'bg-white dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="createMode"
                  checked={selectedMode === 'suggested_retro'}
                  onChange={() => setSelectedMode('suggested_retro')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">
                      1. Escala Sugerida Inteligente (Retroativo CLT)
                    </span>
                    <span className="text-[11px] px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black rounded-md uppercase">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed font-medium">
                    Gera as folgas a partir do carryover do mês anterior com diretrizes customizáveis para o mês.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setSelectedMode('all_working')}
                className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedMode === 'all_working'
                    ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-500 shadow-md shadow-amber-500/5'
                    : 'bg-white dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="createMode"
                  checked={selectedMode === 'all_working'}
                  onChange={() => setSelectedMode('all_working')}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">
                      2. Escala Base 100% Trabalhada (Ajuste Manual)
                    </span>
                    <span className="text-[11px] px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-black rounded-md uppercase">
                      Manual
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed font-medium">
                    Preenche todos os dias com trabalho ("T"), preservando apenas férias, atestados, aniversários, LF e aprendiz.
                  </p>
                </div>
              </label>
            </>
          ) : (
            <div className="space-y-3.5">
              <p className="text-xs text-slate-600 dark:text-zinc-300">
                Pré-preenchido com as Configurações Globais. Ajustes aqui valem apenas para <strong>{targetMonthName}/{targetMY.year}</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold cursor-pointer">
                  <span>Estoquista com folga fixa?</span>
                  <input
                    type="checkbox"
                    checked={guidelines.estoqueFixedOffEnabled}
                    onChange={(e) => setGuidelines(prev => ({ ...prev, estoqueFixedOffEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold cursor-pointer">
                  <span>LF (Loja Fechada) conta como folga?</span>
                  <input
                    type="checkbox"
                    checked={guidelines.lfCountsAsRest}
                    onChange={(e) => setGuidelines(prev => ({ ...prev, lfCountsAsRest: e.target.checked }))}
                    className="w-4 h-4 accent-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold cursor-pointer">
                  <span>Sazonais folgam primeiro nos dias de pico</span>
                  <input
                    type="checkbox"
                    checked={guidelines.prioritizeSeasonalRestOnPeaks !== false}
                    onChange={(e) => setGuidelines(prev => ({ ...prev, prioritizeSeasonalRestOnPeaks: e.target.checked }))}
                    className="w-4 h-4 accent-orange-500"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Dias de Pico (ex: 20, 21, 22)</label>
                  <input
                    type="text"
                    value={peakDaysText}
                    onChange={(e) => handlePeakTextChange(e.target.value)}
                    placeholder="Nenhum"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Modo de folgas 5x2</label>
                  <select
                    value={guidelines.fiveByTwoRestMode}
                    onChange={(e) => setGuidelines(prev => ({ ...prev, fiveByTwoRestMode: e.target.value as 'strict' | 'flexible' }))}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="strict">Estrito (2 folgas/7d)</option>
                    <option value="flexible">Flexível (mín. 1/sem)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Piso (%)</label>
                  <input
                    type="number"
                    min={40}
                    max={95}
                    value={Math.round(guidelines.coverageMinFloor * 100)}
                    onChange={(e) => setGuidelines(prev => ({ ...prev, coverageMinFloor: (parseInt(e.target.value, 10) || 70) / 100 }))}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Meta (%)</label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={Math.round(guidelines.coverageTargetCap * 100)}
                    onChange={(e) => setGuidelines(prev => ({ ...prev, coverageTargetCap: (parseInt(e.target.value, 10) || 80) / 100 }))}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Mín. Domingos</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={guidelines.minSundayWorkers}
                    onChange={(e) => setGuidelines(prev => ({ ...prev, minSundayWorkers: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold cursor-pointer">
                <span>Alocar créditos de feriado pendentes (FF) neste mês</span>
                <input
                  type="checkbox"
                  checked={guidelines.allocatePendingHolidayCredits}
                  onChange={(e) => setGuidelines(prev => ({ ...prev, allocatePendingHolidayCredits: e.target.checked }))}
                  className="w-4 h-4 accent-orange-500"
                />
              </label>

              {conflictWarnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-black uppercase text-[11px]">Conflitos detectados antes de gerar:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {conflictWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex items-center gap-3">
          {step === 'guidelines' ? (
            <button
              type="button"
              onClick={() => setStep('mode')}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-black uppercase text-xs tracking-wider rounded-xl transition-all"
            >
              Voltar
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-black uppercase text-xs tracking-wider rounded-xl transition-all"
            >
              Cancelar
            </button>
          )}

          {step === 'mode' && selectedMode === 'suggested_retro' ? (
            <button
              type="button"
              onClick={() => setStep('guidelines')}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              Diretrizes do Mês <Icon name="arrow_forward" className="text-base" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              <Icon name="check" className="text-base" /> Gerar Escala Agora
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
