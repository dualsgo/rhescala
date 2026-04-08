
import React, { useState, useMemo } from 'react';
import { Holiday } from '../types';
import { getNationalHolidays } from '../constants';
import { Icon } from './Icon';

interface HolidayManagerProps {
  year: number;
  customHolidays: Holiday[];
  onAdd: (h: Omit<Holiday, 'id'>) => void;
  onRemove: (id: string) => void;
  onReset?: () => void;
  onClose: () => void;
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const HolidayManager: React.FC<HolidayManagerProps> = ({
  year, customHolidays, onAdd, onRemove, onReset, onClose,
}) => {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'state' | 'municipal'>('state');

  const nationals = useMemo(() => getNationalHolidays(year), [year]);

  const allHolidays = useMemo(() => {
    return [
      ...nationals.map(h => ({ ...h, isNational: true })),
      ...customHolidays.map(h => ({ ...h, isNational: false })),
    ].sort((a, b) => {
        const d1 = a.date.length === 5 ? `0000-${a.date}` : a.date;
        const d2 = b.date.length === 5 ? `0000-${b.date}` : b.date;
        return d1.localeCompare(d2);
    });
  }, [nationals, customHolidays]);

  const grouped = useMemo(() => {
    const list = MONTHS.map((monthName, mi) => {
      const monthPrefix = `${String(mi + 1).padStart(2, '0')}-`;
      
      const items = allHolidays.filter(h => {
        if (!h.date) return false;
        // Se for MM-DD, checa o prefixo do mês
        if (h.date.length === 5) return h.date.startsWith(monthPrefix);
        // Se for YYYY-MM-DD, checa o prefixo do mês na posição correta
        return h.date.includes(`-${monthPrefix}`);
      });

      return { monthName, items };
    }).filter(g => g.items.length > 0);

    // Adiciona feriados que não bateram em nenhum mês (formato inválido) ao final
    const orphans = allHolidays.filter(h => {
        if (!h.date) return true;
        const parts = h.date.split('-');
        return parts.length < 2;
    });

    if (orphans.length > 0) {
        list.push({ monthName: 'Outros/Inválidos', items: orphans as any });
    }

    return list;
  }, [allHolidays]);


  const handleAdd = () => {
    if (!newDate || !newName.trim()) return;
    onAdd({ date: newDate, name: newName.trim(), type: newType, recurring: false });
    setNewDate('');
    setNewName('');
  };

  const formatDate = (dateStr: string) => {
    if (dateStr.length === 5) return dateStr.split('-')[1]; // DD from MM-DD
    const parts = dateStr.split('-');
    return parts[2] || ''; // DD from YYYY-MM-DD
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center">
              <Icon name="event_busy" className="text-xl" fill />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Feriados {year}</h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Gestão de Datas Não-Ativas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onReset && (
              <button 
                onClick={() => { if(confirm('Remover todos os feriados personalizados e manter apenas os nacionais?')) onReset(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-[10px] font-black uppercase rounded-lg transition-all"
                title="Restaurar padrões nacionais"
              >
                <Icon name="restore" className="text-sm" /> Limpar
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400">
               <Icon name="close" />
            </button>
          </div>
        </div>

        {/* Add Form */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Novo Feriado Local</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Título do Feriado"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-rose-500/20 transition-all outline-none"
                    />
                </div>
                <div className="flex gap-2">
                    <input
                      type="date"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-rose-500/20 transition-all outline-none"
                    />
                    <button
                      onClick={handleAdd}
                      disabled={!newName || !newDate}
                      className="bg-rose-600 dark:bg-rose-700 text-white px-6 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 dark:hover:bg-rose-600 transition-all disabled:opacity-30 flex items-center gap-2 shadow-lg"
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
              <Icon name="event_available" className="text-5xl text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Nenhum feriado registrado</p>
            </div>
          ) : (
            grouped.map(({ monthName, items }) => (
              <div key={monthName} className="space-y-3">
                <h5 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{monthName}</h5>
                <div className="grid grid-cols-1 gap-2">
                  {items.map((h: any) => (
                    <div key={h.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      h.isNational 
                        ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30' 
                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`text-lg font-black ${h.isNational ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {formatDate(h.date)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-none mb-1">{h.name}</p>
                          <p className={`text-[8px] font-black uppercase tracking-widest ${h.isNational ? 'text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            {h.isNational ? '🇧🇷 Feriado Nacional' : '🏙 Feriado Local'}
                          </p>
                        </div>
                      </div>
                      {!h.isNational && (
                        <button
                          onClick={() => onRemove(h.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-500 transition-all"
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
