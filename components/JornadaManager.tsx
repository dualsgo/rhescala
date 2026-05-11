
import React, { useState } from 'react';
import { JornadaSettings } from '../types';
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
  const [localSettings, setLocalSettings] = useState<JornadaSettings>(settings);

  const handleSave = () => {
    onUpdate(localSettings);
    onClose();
  };

  const updateShiftHour = (category: keyof JornadaSettings['shiftHours'], index: number, value: string) => {
    const newHours = [...localSettings.shiftHours[category]];
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
    const newHours = [...localSettings.shiftHours[category], '00h às 00h'];
    setLocalSettings({
      ...localSettings,
      shiftHours: {
        ...localSettings.shiftHours,
        [category]: newHours
      }
    });
  };

  const removeShiftHour = (category: keyof JornadaSettings['shiftHours'], index: number) => {
    const newHours = localSettings.shiftHours[category].filter((_, i) => i !== index);
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
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Defina horários padrão e regras de escala</p>
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
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Operação Mínima (Colaboradores)</label>
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
              {(['weekday', 'sunday', 'holiday', 'apprentice'] as const).map((cat) => (
                <div key={cat} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {cat === 'weekday' ? 'Dias de Semana' : cat === 'sunday' ? 'Domingos' : cat === 'holiday' ? 'Feriados' : 'Jovem Aprendiz'}
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
                    {localSettings.shiftHours[cat].map((hour, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input 
                          type="text"
                          value={hour}
                          onChange={(e) => updateShiftHour(cat, idx, e.target.value)}
                          disabled={isReadOnly}
                          className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                        />
                        {!isReadOnly && localSettings.shiftHours[cat].length > 1 && (
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
                    <label className="block text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-tighter">Feriados (Fixo)</label>
                    <input 
                      type="text"
                      value={localSettings.lunchRules.holiday}
                      onChange={(e) => updateLunchSlot('holiday', 0, e.target.value)}
                      disabled={isReadOnly}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-tighter">Aprendiz (Fixo)</label>
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
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Domingos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Abertura (Fixo)</label>
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
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Fechamento (Slots)</label>
                        {!isReadOnly && (
                          <button onClick={() => addLunchSlot('sundayClosing')} className="text-[9px] font-black text-indigo-600 uppercase">+ Add</button>
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
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dias de Semana</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Abertura (Slots)</label>
                        {!isReadOnly && (
                          <button onClick={() => addLunchSlot('weekdayOpening')} className="text-[9px] font-black text-indigo-600 uppercase">+ Add</button>
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
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Fechamento (Slots)</label>
                        {!isReadOnly && (
                          <button onClick={() => addLunchSlot('weekdayClosing')} className="text-[9px] font-black text-indigo-600 uppercase">+ Add</button>
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
