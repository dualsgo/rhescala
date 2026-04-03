
import React, { useState, useMemo } from 'react';
import { Holiday } from '../types';
import { getNationalHolidays } from '../constants';
import { Icon } from './Icon';

interface HolidayManagerProps {
  year: number;
  customHolidays: Holiday[];
  onAdd: (h: Omit<Holiday, 'id'>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const HolidayManager: React.FC<HolidayManagerProps> = ({
  year, customHolidays, onAdd, onRemove, onClose,
}) => {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'state' | 'municipal'>('state');

  const nationals = useMemo(() => getNationalHolidays(year), [year]);

  const allHolidays = useMemo(() => {
    return [
      ...nationals.map(h => ({ ...h, isNational: true })),
      ...customHolidays.map(h => ({ ...h, isNational: false })),
    ].sort((a, b) => a.date.localeCompare(b.date));
  }, [nationals, customHolidays]);

  const grouped = useMemo(() => {
    return MONTHS.map((monthName, mi) => {
      const prefix = `${year}-${String(mi + 1).padStart(2, '0')}`;
      return {
        monthName,
        items: allHolidays.filter(h => h.date && h.date.startsWith(prefix)),
      };
    }).filter(g => g.items.length > 0);
  }, [allHolidays, year]);

  const handleAdd = () => {
    if (!newDate || !newName.trim()) return;
    onAdd({ date: newDate, name: newName.trim(), type: newType, recurring: false });
    setNewDate('');
    setNewName('');
  };

  const formatDate = (dateStr: string) => {
    const [, , day] = dateStr.split('-');
    return day;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60  backdrop-blur-sm animate-fade-in">
      <div className="bg-white  rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200  flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 ">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-50  text-rose-600  rounded-xl flex items-center justify-center">
              <Icon name="event_busy" className="text-xl" fill />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900  uppercase tracking-tight">Feriados {year}</h3>
              <p className="text-[10px] font-bold text-slate-400  uppercase tracking-widest mt-0.5">Gestão de Datas Não-Ativas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100  rounded-full transition-all text-slate-400">
            <Icon name="close" />
          </button>
        </div>

        {/* Add Form */}
        <div className="p-6 bg-slate-50  border-b border-slate-100 ">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400  uppercase tracking-widest pl-1">Novo Feriado Local</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Título do Feriado"
                      className="w-full bg-white  border border-slate-200  rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700  focus:ring-2 focus:ring-rose-500/20 transition-all outline-none"
                    />
                </div>
                <div className="flex gap-2">
                    <input
                      type="date"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="flex-1 bg-white  border border-slate-200  rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700  focus:ring-2 focus:ring-rose-500/20 transition-all outline-none"
                    />
                    <button
                      onClick={handleAdd}
                      disabled={!newName || !newDate}
                      className="bg-rose-600  text-white px-6 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700  transition-all disabled:opacity-30 flex items-center gap-2 shadow-lg"
                    >
                      Salvar
                    </button>
                </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {grouped.length === 0 ? (
            <div className="text-center py-12 opacity-30 select-none">
              <Icon name="event_available" className="text-5xl text-slate-300  mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ">Nenhum feriado registrado</p>
            </div>
          ) : (
            grouped.map(({ monthName, items }) => (
              <div key={monthName} className="space-y-3">
                <h5 className="text-[10px] font-black text-slate-400  uppercase tracking-[0.2em]">{monthName}</h5>
                <div className="grid grid-cols-1 gap-2">
                  {items.map((h: any) => (
                    <div key={h.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      h.isNational 
                        ? 'bg-rose-50/50 border-rose-100'
                        : 'bg-white border-slate-100'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`text-lg font-black ${h.isNational ? 'text-rose-600' : 'text-slate-900'}`}>
                          {formatDate(h.date)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900  uppercase tracking-tight leading-none mb-1">{h.name}</p>
                          <p className={`text-[8px] font-black uppercase tracking-widest ${h.isNational ? 'text-rose-400' : 'text-slate-400'}`}>
                            {h.isNational ? '🇧🇷 Feriado Nacional' : '🏙 Feriado Local'}
                          </p>
                        </div>
                      </div>
                      {!h.isNational && (
                        <button
                          onClick={() => onRemove(h.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50  hover:text-rose-500 transition-all"
                        >
                          <Icon name="delete" className="text-sm" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
