
import React, { useMemo } from 'react';
import { Employee, MonthYear, Holiday } from '../types';
import { Icon } from './Icon';
import { buildHolidaySet } from '../constants';

interface AnalysisPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onClose: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ employees, currentMY, customHolidays, onClose }) => {
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  
  const stats = useMemo(() => {
    const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
    const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();

    return employees.map(emp => {
      let worked = 0;
      let sundays = 0;
      let holidays = 0;
      let offs = 0;
      let maxConsecutive = 0;
      let currentConsecutive = 0;

      const shifts = emp.shifts[monthKey] || [];
      
      for (let i = 0; i < daysInMonth; i++) {
        const date = new Date(currentMY.year, currentMY.month, i + 1);
        const shift = shifts[i] || 'F';
        const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
        const isHoliday = holidaySet.has(dateStr);
        const isSunday = date.getDay() === 0;

        if (shift === 'T' || shift === 'C') {
          worked++;
          currentConsecutive++;
          if (isSunday) sundays++;
          if (isHoliday) holidays++;
        } else {
          offs++;
          currentConsecutive = 0;
        }

        if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
      }

      return {
        id: emp.id,
        name: emp.name,
        worked,
        sundays,
        holidays,
        offs,
        excess: maxConsecutive > 6,
        maxConsecutive
      };
    }).sort((a, b) => b.worked - a.worked);
  }, [employees, monthKey, currentMY, customHolidays]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3">
              <Icon name="analytics" className="text-orange-600" />
              Análise de Produtividade & Conformidade
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-1 uppercase tracking-wider">Mês Vigente: {(currentMY.month + 1).toString().padStart(2, '0')}/{currentMY.year}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors group"
          >
            <Icon name="close" className="text-slate-400 group-hover:text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto custom-scrollbar p-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <SummaryCard title="Média de Dias" value={(stats.reduce((acc, s) => acc + s.worked, 0) / stats.length).toFixed(1)} icon="timer" color="sky" />
            <SummaryCard title="Total Domingos" value={stats.reduce((acc, s) => acc + s.sundays, 0).toString()} icon="calendar_today" color="orange" />
            <SummaryCard title="Total Feriados" value={stats.reduce((acc, s) => acc + s.holidays, 0).toString()} icon="event_busy" color="rose" />
            <SummaryCard title="Alertas (6x1)" value={stats.filter(s => s.excess).length.toString()} icon="warning" color="red" />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                  <th className="p-4 pl-6">Colaborador</th>
                  <th className="p-4 text-center">Dias Trab.</th>
                  <th className="p-4 text-center">Domingos</th>
                  <th className="p-4 text-center">Feriados</th>
                  <th className="p-4 text-center">Folgas</th>
                  <th className="p-4 text-center">Status 6x1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-sm text-slate-700">{s.name}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">ID: {s.id}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center font-extrabold text-slate-600">{s.worked}</td>
                    <td className="p-4 text-center">
                       <span className={`px-2 py-1 rounded-md text-[10px] font-extrabold ${s.sundays > 2 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                          {s.sundays}
                       </span>
                    </td>
                    <td className="p-4 text-center font-extrabold text-rose-600">{s.holidays}</td>
                    <td className="p-4 text-center font-extrabold text-orange-500">{s.offs}</td>
                    <td className="p-4 text-center">
                      {s.excess ? (
                        <div className="flex items-center justify-center gap-1.5 text-red-600 font-extrabold text-[10px] uppercase bg-red-50 py-1 px-3 rounded-full mx-auto w-fit">
                          <Icon name="warning" className="text-sm" /> Excesso ({s.maxConsecutive}d)
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-extrabold text-[10px] uppercase bg-emerald-50 py-1 px-3 rounded-full mx-auto w-fit">
                          <Icon name="check_circle" className="text-sm" /> Regular
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
           <p className="text-[10px] text-slate-400 font-bold uppercase">Análise baseada nos registros salvos para o mês de referência informado.</p>
           <button 
             onClick={onClose}
             className="px-6 py-2 bg-slate-900 text-white text-xs font-extrabold rounded-xl hover:bg-slate-800 transition-all shadow-sm active:scale-95"
           >
             Fechar Painel
           </button>
        </div>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ title: string, value: string, icon: any, color: string }> = ({ title, value, icon, color }) => (
  <div className={`bg-white border border-slate-100 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow`}>
    <div className={`w-12 h-12 bg-${color}-50 rounded-xl flex items-center justify-center text-${color}-600`}>
      <Icon name={icon} className="text-xl" />
    </div>
    <div>
      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{title}</p>
      <h4 className="text-xl font-extrabold text-slate-900">{value}</h4>
    </div>
  </div>
);
