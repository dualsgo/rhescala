
import React, { useState } from 'react';
import { Holiday } from '../types';
import { Icon } from './Icon';

interface HolidayManagerProps {
  year: number;
  customHolidays: Holiday[];
  onAdd: (h: Omit<Holiday, 'id'>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

export const HolidayManager: React.FC<HolidayManagerProps> = ({ year, customHolidays, onAdd, onRemove, onClose }) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && date) {
      onAdd({ name: name.toUpperCase(), date });
      setName('');
      setDate('');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-200">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Gestão de Feriados</h4>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Ano de {year}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome do Feriado</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-orange-500 outline-none uppercase text-xs" placeholder="Ex: ANIVERSÁRIO DA CIDADE" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-orange-500 outline-none text-xs" />
            </div>
          </div>
          <button type="submit" disabled={!name || !date} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-emerald-700 transition-all uppercase tracking-widest text-[10px] disabled:opacity-50 active:scale-95">Adicionar Feriado</button>
        </form>

        <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b pb-2">Lista de Personalizados</h5>
          {customHolidays.length === 0 ? (
            <p className="text-[10px] text-slate-400 font-bold text-center py-4">Nenhum feriado personalizado cadastrado.</p>
          ) : (
            customHolidays.map(h => (
              <div key={h.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-orange-200 transition-all">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-black text-[10px]"><Icon name="event_busy" className="text-xs" /></div>
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-900 uppercase leading-none">{h.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 mt-1">{h.date?.split('-').reverse().join('/')}</span>
                   </div>
                </div>
                <button onClick={() => onRemove(h.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                  <Icon name="delete" className="text-sm" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
