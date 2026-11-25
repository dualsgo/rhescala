
import React, { useState } from 'react';
import { JornadaSettings, ScheduleRulesConfig } from '../types';
import { DEFAULT_SCHEDULE_RULES } from '../src/engine/config/schedule-constants';
import { resolveRulesConfig } from '../src/engine/config/guidelines';
import { Icon } from './Icon';

interface JornadaManagerProps {
  settings: JornadaSettings;
  onUpdate: (settings: JornadaSettings) => void;
  onClose: () => void;
  isReadOnly?: boolean;
}

export const JornadaManager: React.FC<JornadaManagerProps> = ({ 
  settings, 
  onUpdate, 
  onClose,
  isReadOnly = false 
}) => {
  const [localSettings, setLocalSettings] = useState<JornadaSettings>(() => ({
    ...settings,
    rulesConfig: resolveRulesConfig(settings),
  }));

  const rules = localSettings.rulesConfig || DEFAULT_SCHEDULE_RULES;
  const updateRules = (patch: Partial<ScheduleRulesConfig>) => {
    setLocalSettings(prev => ({
      ...prev,
      rulesConfig: {
        ...resolveRulesConfig(prev),
        ...patch,
      },
    }));
  };

  const handleSave = () => {
    onUpdate(localSettings);
    onClose();
  };

  const updateShiftHour = (category: keyof JornadaSettings['shiftHours'], index: number, value: string) => {
    const current = localSettings.shiftHours[category] || [];
    const newHours = [...current];
    newHours[index] = value;
    setLocalSettings({
      ...localSettings,
      shiftHours: {
        ...localSettings.shiftHours,
        [category]: newHours
      }
    });
  };

  const addShiftHour = (category: keyof JornadaSettings['shiftHours']) => {
    const current = localSettings.shiftHours[category] || [];
    const newHours = [...current, '09h às 17h20'];
    setLocalSettings({
      ...localSettings,
      shiftHours: {
        ...localSettings.shiftHours,
        [category]: newHours
      }
    });
  };

  const removeShiftHour = (category: keyof JornadaSettings['shiftHours'], index: number) => {
    const current = localSettings.shiftHours[category] || [];
    const newHours = current.filter((_, i) => i !== index);
    setLocalSettings({
      ...localSettings,
      shiftHours: {
        ...localSettings.shiftHours,
        [category]: newHours
      }
    });
  };

  const updateLunchSlot = (category: keyof JornadaSettings['lunchRules'], index: number, value: string) => {
    if (category === 'holiday' || category === 'apprentice') {
        setLocalSettings({
            ...localSettings,
            lunchRules: { ...localSettings.lunchRules, [category]: value }
        });
        return;
    }
    const newSlots = [...(localSettings.lunchRules[category] as string[])];
    newSlots[index] = value;
    setLocalSettings({
      ...localSettings,
      lunchRules: {
        ...localSettings.lunchRules,
        [category]: newSlots
      }
    });
  };

  const addLunchSlot = (category: keyof JornadaSettings['lunchRules']) => {
    if (category === 'holiday' || category === 'apprentice') return;
    const newSlots = [...(localSettings.lunchRules[category] as string[]), '12h'];
    setLocalSettings({
      ...localSettings,
      lunchRules: {
        ...localSettings.lunchRules,
        [category]: newSlots
      }
    });
  };

  const removeLunchSlot = (category: keyof JornadaSettings['lunchRules'], index: number) => {
    if (category === 'holiday' || category === 'apprentice') return;
    const newSlots = (localSettings.lunchRules[category] as string[]).filter((_, i) => i !== index);
    setLocalSettings({
      ...localSettings,
      lunchRules: {
        ...localSettings.lunchRules,
        [category]: newSlots
      }
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center">
            <Icon name="schedule" className="text-2xl" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Configurações de Jornada</h2>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Defina horários padrão e regras de escala</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="space-y-12">
          
          {/* Sunday Rules */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg flex items-center justify-center">
                <Icon name="calendar_today" className="text-lg" />
              </div>
              <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Regras de Domingo</h3>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Operação Mínima (Colaboradores)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="1" 
                  max="15" 
                  value={localSettings.minSundayWorkers}
                  onChange={(e) => setLocalSettings({ ...localSettings, minSundayWorkers: parseInt(e.target.value) })}
                  disabled={isReadOnly}
                  className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="w-12 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center font-black text-indigo-600 shadow-sm">
                  {localSettings.minSundayWorkers}
                </span>
              </div>
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 italic">
                A folga alternada só será concedida se houver mais colaboradores disponíveis do que este valor.
              </p>
            </div>
          </section>

          {/* Shift Hours */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg flex items-center justify-center">
                <Icon name="access_time" className="text-lg" />
              </div>
              <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Horários Padrão</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(['weekday', 'sunday', 'holiday', 'apprentice', 'extended'] as const).map((cat) => (
                <div key={cat} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {cat === 'weekday' ? 'Dias de Semana' : cat === 'sunday' ? 'Domingos' : cat === 'holiday' ? 'Feriados' : cat === 'apprentice' ? 'Jovem Aprendiz' : 'Horário Estendido / Sazonal'}
                    </label>
                    {!isReadOnly && (
                      <button 
                        onClick={() => addShiftHour(cat)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-tighter"
                      >
                        + Adicionar
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {(localSettings.shiftHours[cat] || []).map((hour, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input 
                          type="text"
                          value={hour}
                          onChange={(e) => updateShiftHour(cat, idx, e.target.value)}
                          disabled={isReadOnly}
                          className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                        />
                        {!isReadOnly && (localSettings.shiftHours[cat] || []).length > 1 && (
                          <button 
                            onClick={() => removeShiftHour(cat, idx)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Icon name="delete" className="text-sm" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Lunch Rules */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg flex items-center justify-center">
                <Icon name="restaurant" className="text-lg" />
              </div>
              <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Regras de Almoço</h3>
            </div>

            <div className="space-y-6">
              {/* Holiday Lunch */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-bold uppercase tracking-tighter">Feriados (Fixo)</label>
                    <input 
                      type="text"
                      value={localSettings.lunchRules.holiday}
                      onChange={(e) => updateLunchSlot('holiday', 0, e.target.value)}
                      disabled={isReadOnly}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-bold uppercase tracking-tighter">Aprendiz (Fixo)</label>
                    <input 
                      type="text"
                      value={localSettings.lunchRules.apprentice}
                      onChange={(e) => updateLunchSlot('apprentice', 0, e.target.value)}
                      disabled={isReadOnly}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Sunday Lunch */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 space-y-4">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Domingos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Abertura (Fixo)</label>
                      <input 
                        type="text"
                        value={localSettings.lunchRules.sundayOpening}
                        onChange={(e) => setLocalSettings({ 
                          ...localSettings, 
                          lunchRules: { ...localSettings.lunchRules, sundayOpening: e.target.value } 
                        })}
                        disabled={isReadOnly}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                      />
                   </div>
                   <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-tighter">Fechamento (Slots)</label>
                        {!isReadOnly && (
                          <button onClick={() => addLunchSlot('sundayClosing')} className="text-[11px] font-black text-indigo-600 uppercase">+ Add</button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {localSettings.lunchRules.sundayClosing.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input 
                              type="text"
                              value={slot}
                              onChange={(e) => updateLunchSlot('sundayClosing', idx, e.target.value)}
                              disabled={isReadOnly}
                              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            />
                            {!isReadOnly && localSettings.lunchRules.sundayClosing.length > 1 && (
                              <button onClick={() => removeLunchSlot('sundayClosing', idx)} className="text-slate-300 hover:text-red-500"><Icon name="delete" className="text-sm" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
              </div>

              {/* Weekday Lunch */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 space-y-4">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Dias de Semana</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-tighter">Abertura (Slots)</label>
                        {!isReadOnly && (
                          <button onClick={() => addLunchSlot('weekdayOpening')} className="text-[11px] font-black text-indigo-600 uppercase">+ Add</button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {localSettings.lunchRules.weekdayOpening.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input 
                              type="text"
                              value={slot}
                              onChange={(e) => updateLunchSlot('weekdayOpening', idx, e.target.value)}
                              disabled={isReadOnly}
                              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            />
                            {!isReadOnly && localSettings.lunchRules.weekdayOpening.length > 1 && (
                              <button onClick={() => removeLunchSlot('weekdayOpening', idx)} className="text-slate-300 hover:text-red-500"><Icon name="delete" className="text-sm" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                   </div>
                   <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-tighter">Fechamento (Slots)</label>
                        {!isReadOnly && (
                          <button onClick={() => addLunchSlot('weekdayClosing')} className="text-[11px] font-black text-indigo-600 uppercase">+ Add</button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {localSettings.lunchRules.weekdayClosing.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input 
                              type="text"
                              value={slot}
                              onChange={(e) => updateLunchSlot('weekdayClosing', idx, e.target.value)}
                              disabled={isReadOnly}
                              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            />
                            {!isReadOnly && localSettings.lunchRules.weekdayClosing.length > 1 && (
                              <button onClick={() => removeLunchSlot('weekdayClosing', idx)} className="text-slate-300 hover:text-red-500"><Icon name="delete" className="text-sm" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
              </div>

            </div>
          </section>

          {/* 4. Regras Editáveis de Inteligência & Cobertura (Item F) */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
              <Icon name="tune" className="text-sm text-orange-500" />
              <span>Regras de Alocação de Folgas & Cobertura</span>
            </div>

            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                    Motor de Inteligência V2 (Pool Ativo + Diretrizes)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Considera disponibilidade diária real, priorização de picos e faixa 70%–80%.
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={Boolean(rules.useSmartRestAllocatorV2)}
                  onChange={(e) => updateRules({ useSmartRestAllocatorV2: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
              </label>

              <label className="flex items-center justify-between gap-3 cursor-pointer pt-3 border-t border-slate-200/70 dark:border-slate-700/70">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                    Folga fixa de domingo para Estoque (padrão: desativada)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Quando desativada, estoquistas entram na rotação dominical como os demais.
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={Boolean(rules.estoqueFixedSundayOff?.enabled)}
                  onChange={(e) =>
                    updateRules({
                      estoqueFixedSundayOff: {
                        ...rules.estoqueFixedSundayOff,
                        enabled: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 accent-orange-500"
                />
              </label>

              <label className="flex items-center justify-between gap-3 cursor-pointer pt-3 border-t border-slate-200/70 dark:border-slate-700/70">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                    Loja Fechada (LF) conta como folga na janela 5x2/6x1?
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Padrão: NÃO (25/12 e outros LF não substituem folga semanal, apenas zeram o streak).
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={Boolean(rules.lfCountsAsRest)}
                  onChange={(e) => updateRules({ lfCountsAsRest: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
              </label>

              <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Priorizar Sazonais nas folgas de dias de pico
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Padrão: SIM. Folgas inevitáveis no pico (inclusive domingos de pico) recaem primeiro sobre Sazonais; a equipe CLT mais antiga permanece ativa.
                  </span>
                </div>
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={rules.prioritizeSeasonalRestOnPeaks !== false}
                  onChange={(e) => updateRules({ prioritizeSeasonalRestOnPeaks: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-700/70">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Modo 5x2</label>
                  <select
                    disabled={isReadOnly}
                    value={rules.fiveByTwoRestMode}
                    onChange={(e) => updateRules({ fiveByTwoRestMode: e.target.value as 'strict' | 'flexible' })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="strict">Estrito (2 folgas/7d)</option>
                    <option value="flexible">Flexível (mín. 1/sem)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Piso Cobertura (%)</label>
                  <input
                    type="number"
                    min={40}
                    max={95}
                    disabled={isReadOnly}
                    value={Math.round((rules.coverageMinFloor ?? 0.7) * 100)}
                    onChange={(e) => updateRules({ coverageMinFloor: Math.max(0.4, Math.min(0.95, (parseInt(e.target.value, 10) || 70) / 100)) })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Meta Nivelamento (%)</label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    disabled={isReadOnly}
                    value={Math.round((rules.coverageTargetCap ?? 0.8) * 100)}
                    onChange={(e) => updateRules({ coverageTargetCap: Math.max(0.5, Math.min(1, (parseInt(e.target.value, 10) || 80) / 100)) })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Máx. Dom. Seguidos</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    disabled={isReadOnly}
                    value={rules.maxConsecutiveSundays ?? 2}
                    onChange={(e) => updateRules({ maxConsecutiveSundays: Math.max(1, Math.min(3, parseInt(e.target.value, 10) || 2)) })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Footer */}
      {!isReadOnly && (
        <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 sticky bottom-0">
          <button 
            onClick={handleSave}
            className="w-full bg-slate-950 dark:bg-white dark:text-slate-950 text-white font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-xs"
          >
            Salvar Alterações
          </button>
        </div>
      )}
    </div>
  );
};
