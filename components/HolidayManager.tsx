import React, { useState, useMemo } from 'react';
import { Holiday } from '../types';
import { getNationalHolidays } from '../constants';
import { Icon } from './Icon';

interface HolidayManagerProps {
  year: number;
  customHolidays: Holiday[];
  deletedNationalHolidays?: string[];
  isReadOnly?: boolean;
  onAdd: (h: Omit<Holiday, 'id'>) => void;
  onRemove: (id: string) => void;
  onEdit?: (id: string, h: Omit<Holiday, 'id'>) => void;
  trackingStartDate?: string;
  onUpdateTrackingStartDate?: (date: string) => void;
  onClose: () => void;
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const HolidayManager: React.FC<HolidayManagerProps> = ({
  year, customHolidays, deletedNationalHolidays, isReadOnly, onAdd, onRemove, onEdit, trackingStartDate, onUpdateTrackingStartDate, onClose,
}) => {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'state' | 'municipal' | 'national'>('state');
  const [editingId, setEditingId] = useState<string | null>(null);

  const nationals = useMemo(() => {
    return getNationalHolidays(year).filter(h => !(deletedNationalHolidays || []).includes(h.id));
  }, [year, deletedNationalHolidays]);

  const allHolidays = useMemo(() => {
    return [
      ...nationals,
      ...customHolidays,
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

  const handleSave = () => {
    if (!newDate || !newName.trim()) return;
    
    if (editingId && onEdit) {
      onEdit(editingId, { date: newDate, name: newName.trim(), type: newType, recurring: false });
      setEditingId(null);
    } else {
      onAdd({ date: newDate, name: newName.trim(), type: newType, recurring: false });
    }
    
    setNewDate('');
    setNewName('');
    setNewType('state');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewDate('');
    setNewName('');
    setNewType('state');
  };

  const handleEditClick = (h: Holiday) => {
    setEditingId(h.id);
    setNewDate(h.date);
    setNewName(h.name);
    setNewType(h.type);
  };

  const formatDate = (dateStr: string) => {
    const [, , day] = dateStr.split('-');
    return day;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center">
              <Icon name="event_busy" className="text-xl" fill />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Feriados {year}</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Gestão de Datas Não-Ativas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-all text-slate-400">
            <Icon name="close" />
          </button>
        </div>

        {/* Add/Edit Form */}
        {!isReadOnly && (
          <div className={`p-6 border-b border-slate-100 dark:border-zinc-800 ${editingId ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-50 dark:bg-zinc-800/50'}`}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1 flex items-center justify-between">
                      <label className={`text-[11px] font-black uppercase tracking-widest pl-1 ${editingId ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                        {editingId ? 'Editando Feriado' : 'Novo Feriado Local'}
                      </label>
                      {editingId && (
                        <button onClick={handleCancelEdit} className="text-[11px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest">
                          Cancelar
                        </button>
                      )}
                  </div>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Título do Feriado"
                    className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-rose-500/20 transition-all outline-none"
                  />
                  <div className="flex gap-2">
                      <input
                        type="date"
                        value={newDate}
                        onChange={e => setNewDate(e.target.value)}
                        className="flex-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-rose-500/20 transition-all outline-none"
                      />
                      <button
                        onClick={handleSave}
                        disabled={!newName || !newDate}
                        className={`text-white px-6 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-30 flex items-center gap-2 shadow-lg ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-600 hover:bg-rose-700'}`}
                      >
                        {editingId ? 'Atualizar' : 'Salvar'}
                      </button>
                  </div>
              </div>
            </div>
          </div>
        )}

        {/* Tracking Start Date Config */}
        <div className="px-6 py-4 bg-amber-50/50 dark:bg-amber-950/30 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <Icon name="history" className="text-amber-600 dark:text-amber-400 text-sm" />
              <span className="text-[11px] font-bold uppercase text-amber-900 dark:text-amber-300 tracking-tight">Considerar Feriados a partir de:</span>
           </div>
           <input 
              type="date" 
              value={trackingStartDate || ''} 
              onChange={(e) => onUpdateTrackingStartDate?.(e.target.value)}
              disabled={isReadOnly}
              className="bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200 outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
           />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {grouped.length === 0 ? (
            <div className="text-center py-12 opacity-30 select-none">
              <Icon name="event_available" className="text-5xl text-slate-300 mb-2" />
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Nenhum feriado registrado</p>
            </div>
          ) : (
            grouped.map(({ monthName, items }) => (
              <div key={monthName} className="space-y-3">
                <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{monthName}</h5>
                <div className="grid grid-cols-1 gap-2">
                  {items.map((h: Holiday) => (
                    <div key={h.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      h.type === 'national' ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/40' : 'bg-white dark:bg-zinc-800/80 border-slate-100 dark:border-zinc-700'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`text-lg font-black ${h.type === 'national' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {formatDate(h.date)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-none mb-1">{h.name}</p>
                          <p className={`text-[11px] font-bold uppercase tracking-widest ${h.type === 'national' ? 'text-rose-400' : 'text-slate-400'}`}>
                          {h.type === 'national' ? '🇧🇷 Feriado Nacional' : h.type === 'state' ? '🏛 Feriado Estadual' : h.type === 'municipal' ? '🏙 Feriado Municipal' : '🏙 Feriado Local'}
                          </p>
                        </div>
                      </div>
                      {!isReadOnly && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditClick(h)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-500 transition-all"
                            title="Editar"
                          >
                            <Icon name="edit" className="text-sm" />
                          </button>
                          <button
                            onClick={() => onRemove(h.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-500 transition-all"
                            title="Remover"
                          >
                            <Icon name="delete" className="text-sm" />
                          </button>
                        </div>
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
