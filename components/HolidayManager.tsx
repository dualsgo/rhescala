
import React, { useState } from 'react';
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

  const nationals = getNationalHolidays(year);

  // Group all holidays by month
  const allHolidays: (Holiday & { isNational: boolean })[] = [
    ...nationals.map(h => ({ ...h, isNational: true })),
    ...customHolidays.map(h => ({ ...h, isNational: false })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const grouped = MONTHS.map((monthName, mi) => {
    const prefix = `${year}-${String(mi + 1).padStart(2, '0')}`;
    return {
      monthName,
      items: allHolidays.filter(h => h.date && h.date.startsWith(prefix)),
    };
  }).filter(g => g.items.length > 0);

  const handleAdd = () => {
    if (!newDate || !newName.trim()) return;
    onAdd({ date: newDate, name: newName.trim(), type: newType, recurring: false });
    setNewDate('');
    setNewName('');
  };

  const formatDate = (dateStr: string) => {
    const [, , day] = dateStr.split('-');
    return `${day}`;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Icon name="event_busy" className="text-rose-500" /> Feriados {year}
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              Nacionais calculados automaticamente · Adicione estaduais/municipais
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
            <Icon name="close" />
          </button>
        </div>

        {/* Add form */}
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">
            Adicionar Feriado Estadual / Municipal
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400">Data</span>
              <input
                type="date"
                value={newDate}
                min={`${year}-01-01`}
                max={`${year}-12-31`}
                onChange={e => setNewDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className="text-[10px] font-bold text-slate-400">Nome</span>
              <input
                type="text"
                placeholder="Ex: Aniversário da Cidade"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400">Tipo</span>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as 'state' | 'municipal')}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none"
              >
                <option value="state">Estadual</option>
                <option value="municipal">Municipal</option>
              </select>
            </div>
            <button
              onClick={handleAdd}
              disabled={!newDate || !newName.trim()}
              className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-extrabold hover:bg-orange-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Icon name="add" className="text-sm" /> Adicionar
            </button>
          </div>
        </div>

        {/* Holiday list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4 custom-scrollbar">
          {grouped.map(({ monthName, items }) => (
            <div key={monthName}>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 px-1">
                {monthName}
              </p>
              <div className="space-y-1.5">
                {items.map(h => (
                  <div
                    key={h.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                      h.isNational
                        ? 'bg-rose-50 border-rose-100'
                        : h.type === 'state'
                        ? 'bg-violet-50 border-violet-100'
                        : 'bg-amber-50 border-amber-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 text-center font-extrabold text-base ${
                        h.isNational ? 'text-rose-600' : h.type === 'state' ? 'text-violet-600' : 'text-amber-600'
                      }`}>
                        {h.date ? formatDate(h.date) : 'Data Inválida'}
                      </span>
                      <div>
                        <p className="font-extrabold text-slate-800 text-[13px]">{h.name}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${
                          h.isNational ? 'text-rose-400' : h.type === 'state' ? 'text-violet-400' : 'text-amber-500'
                        }`}>
                          {h.isNational ? '🇧🇷 Nacional' : h.type === 'state' ? '🏛 Estadual' : '🏙 Municipal'}
                        </p>
                      </div>
                    </div>
                    {!h.isNational && (
                      <button
                        onClick={() => onRemove(h.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-100 hover:text-red-500 transition-all"
                        title="Remover"
                      >
                        <Icon name="delete" className="text-sm" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="text-center py-10 text-slate-400 font-bold text-sm">
              Nenhum feriado cadastrado para {year}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
