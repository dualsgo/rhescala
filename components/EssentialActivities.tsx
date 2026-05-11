
import React from 'react';
import { MonthYear, Holiday } from '../types';
import { buildHolidaySet } from '../constants';
import { Icon } from './Icon';
import { toPng } from 'html-to-image';

interface EssentialActivitiesProps {
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onClose: () => void;
}

const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const DAILY_ACTIVITIES: Record<number, string[]> = {
  0: ['Alteração preços mesa de ofertas'],
  1: ['Repor mesa de ofertas', 'Checklist Agenda Líder', 'Checklist Jornada do Brincar'],
  2: ['Super tático', 'Checklist Agenda Líder', 'Checklist Jornada do Brincar'],
  3: ['Preparar ofertas', 'Checklist Agenda Líder', 'Checklist Jornada do Brincar'],
  4: ['Conferir mesa de ofertas', 'Divulgar ofertas', 'Preparar evento de sexta', 'Checklist Bate Meta', 'Checklist Jornada do Brincar'],
  5: ['Live e eventos', 'Preparar evento de sábado', 'Checklist Jornada do Brincar'],
  6: ['Happy Sábado']
};

export const EssentialActivities: React.FC<EssentialActivitiesProps> = ({ currentMY, customHolidays, onClose }) => {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const handleDownload = async () => {
    const el = document.getElementById('activities-table-capture');
    if (el) {
      const dataUrl = await toPng(el, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: 1200,
        style: { 
          padding: '40px',
          width: '1200px',
          margin: '0',
          display: 'block'
        }
      });
      const link = document.createElement('a');
      link.download = `atividades-semanais-${monthKey}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  // Reorder days to start with Monday as requested for a business week view
  const weeklyOrder = [1, 2, 3, 4, 5, 6, 0]; 

  return (
    <div className="flex flex-col h-full animate-fade-in bg-slate-50 dark:bg-slate-950 p-6 overflow-hidden">
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
              <Icon name="assignment_turned_in" className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Atividades Essenciais Semanais</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cronograma Fixo de Segunda a Domingo</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
            >
              <Icon name="download" /> Baixar Tabela
            </button>
            <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <Icon name="close" className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl p-6 lg:p-10">
          <div id="activities-table-capture" className="bg-white dark:bg-slate-900 p-4 max-w-[1100px] mx-auto">
            
            <div className="text-center mb-10">
               <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Cronograma de Atividades Essenciais</h1>
               <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Guia de Rotina Semanal</p>
            </div>

            <div className="grid grid-cols-7 gap-4">
              {weeklyOrder.map(dayIdx => {
                const activities = DAILY_ACTIVITIES[dayIdx] || [];
                const isSunday = dayIdx === 0;
                const isSaturday = dayIdx === 6;

                return (
                  <div 
                    key={dayIdx} 
                    className={`min-h-[400px] rounded-[2.5rem] border-2 p-6 flex flex-col gap-4 transition-all ${
                      isSunday 
                      ? 'bg-rose-50/30 border-rose-100 dark:bg-rose-900/5 dark:border-rose-900/20' 
                      : isSaturday
                        ? 'bg-amber-50/30 border-amber-100 dark:bg-amber-900/5 dark:border-amber-900/20'
                        : 'bg-white dark:bg-slate-800 border-slate-50 dark:border-slate-700/50 hover:shadow-md'
                    }`}
                  >
                    <div className="pb-4 border-b border-slate-100 dark:border-slate-700/50">
                      <p className={`text-xs font-black uppercase tracking-widest ${isSunday ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>{WEEKDAY_NAMES[dayIdx]}</p>
                    </div>

                    <div className="flex-1 flex flex-col gap-3">
                      {activities.map((act, i) => (
                        <div key={i} className="flex items-start gap-2.5 group">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isSunday ? 'bg-rose-400' : 'bg-indigo-400'}`} />
                          <p className="text-[10px] font-black uppercase leading-tight text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">
                            {act}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 p-8 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900/30 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-2xl shadow-sm">🚀</div>
                    <div>
                        <p className="text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest">Ritmo Operacional</p>
                        <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400">Este cronograma define as tarefas críticas para o sucesso da loja durante a semana.</p>
                    </div>
                </div>
                <p className="text-[10px] font-black text-indigo-300 dark:text-indigo-500 uppercase tracking-widest">Ri Happy • Excelência em Operação</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
