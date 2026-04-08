
import React, { useState } from 'react';
import { Icon } from './Icon';
import { ShiftTemplate } from '../types';

interface ShiftTemplateManagerProps {
  templates: ShiftTemplate[];
  onUpdate: (templates: ShiftTemplate[]) => void;
  onClose: () => void;
}

export const ShiftTemplateManager: React.FC<ShiftTemplateManagerProps> = ({ templates, onUpdate, onClose }) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleActive = (id: string) => {
    onUpdate(templates.map(t => ({
      ...t,
      isActive: t.id === id ? !t.isActive : (t.type === templates.find(temp => temp.id === id)?.type ? false : t.isActive)
    })));
  };

  const addTemplate = (type: 'weekday' | 'sunday' | 'holiday') => {
    const newT: ShiftTemplate = {
      id: `temp-${Date.now()}`,
      name: 'Novo Template',
      type,
      hours: type === 'holiday' ? ['12h às 18h', '13h às 19h', '14h às 20h', '15h às 21h'] : ['10h às 18h20', '12h às 20h20', '13h40 às 22h'],
      isActive: false
    };
    onUpdate([...templates, newT]);
  };

  const updateHours = (id: string, hoursStr: string) => {
    const hours = hoursStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    onUpdate(templates.map(t => t.id === id ? { ...t, hours } : t));
  };

  const updateName = (id: string, name: string) => {
    onUpdate(templates.map(t => t.id === id ? { ...t, name } : t));
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
       <div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden">
          <header className="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
                   <Icon name="schedule" className="text-2xl" />
                </div>
                <div>
                   <h2 className="text-2xl font-black text-slate-950 dark:text-white uppercase tracking-tighter">Editor de Horários</h2>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gerencie os turnos para épocas festivas</p>
                </div>
             </div>
             <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                <Icon name="close" className="text-2xl" />
             </button>
          </header>

          <main className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10">
             {(['weekday', 'sunday', 'holiday'] as const).map(type => (
                <section key={type} className="space-y-6">
                   <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                         <div className="w-1.5 h-4 bg-orange-500 rounded-full" /> 
                         {type === 'weekday' ? 'Dias de Semana' : type === 'sunday' ? 'Domingos' : 'Feriados'}
                      </h3>
                      <button 
                        onClick={() => addTemplate(type)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase hover:bg-orange-500 hover:text-white transition-all shadow-sm"
                      >
                         <Icon name="add" className="text-sm" /> Criar Variação
                      </button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {templates.filter(t => t.type === type).map(template => (
                         <div key={template.id} className={`group relative p-6 rounded-[2rem] border-2 transition-all ${template.isActive ? 'bg-indigo-50/50 border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 hover:border-slate-200'}`}>
                            <div className="flex items-center justify-between mb-4">
                               {editingId === template.id ? (
                                  <input 
                                     autoFocus
                                     className="bg-transparent text-lg font-black text-slate-900 dark:text-white border-b-2 border-indigo-500 outline-none w-full mr-4"
                                     value={template.name}
                                     onChange={(e) => updateName(template.id, e.target.value)}
                                     onBlur={() => setEditingId(null)}
                                  />
                               ) : (
                                  <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                                     {template.name}
                                     <button onClick={() => setEditingId(template.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-600 transition-all"><Icon name="edit" className="text-sm" /></button>
                                  </h4>
                               )}
                               
                               <button 
                                 onClick={() => toggleActive(template.id)}
                                 className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${template.isActive ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200'}`}
                               >
                                  {template.isActive ? ' Ativo ' : ' Ativar '}
                               </button>
                            </div>

                            <div className="space-y-3">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horários (separados por vírgula)</p>
                               <textarea 
                                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 ring-indigo-500/20"
                                  rows={2}
                                  value={template.hours.join(', ')}
                                  onChange={(e) => updateHours(template.id, e.target.value)}
                                  placeholder="Ex: 10h às 18h, 12h às 20h..."
                                />
                            </div>
                         </div>
                      ))}
                   </div>
                </section>
             ))}
          </main>

          <footer className="px-10 py-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-slate-400">
             <p className="text-[10px] font-bold uppercase tracking-widest">* Somente o template ATIVO será usado para gerar novas escalas e sugerir almoços.</p>
             <button onClick={onClose} className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:scale-[1.02] transition-all">Fechar e Salvar</button>
          </footer>
       </div>
    </div>
  );
};
