
import React, { useMemo } from 'react';
import { Icon } from './Icon';
import { Employee, MonthYear, Holiday, ShiftType } from '../types';
import { buildHolidaySet } from '../constants';
import { calculateLunchSchedule } from '../hooks/useLunchEngine';

interface DaySummaryCardProps {
  employees: Employee[];
  selectedDayIdx: number;
  currentMY: MonthYear;
  customHolidays: Holiday[];
  isEditable?: boolean;
  isGridLocked?: boolean;
  onUpdateShift?: (empId: string, dayIdx: number, newShift: ShiftType) => void;
}
export const DaySummaryCard: React.FC<DaySummaryCardProps> = ({ 
  employees, selectedDayIdx, currentMY, customHolidays,
  isEditable = false, isGridLocked = true, onUpdateShift
}) => {
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(selectedDayIdx + 1).padStart(2, '0')}`;
  const date = new Date(currentMY.year, currentMY.month, selectedDayIdx + 1);
  const isSunday = date.getDay() === 0;
  const isHoliday = buildHolidaySet(currentMY.year, customHolidays).has(dateStr);

  const data = useMemo(() => {
    const counts = { total: 0, folga: 0, ferias: 0, curso: 0 };
    const absences: { name: string, reason: string }[] = [];
    const working: Employee[] = [];

    employees.filter(e => !e.isHidden && e.status === 'active').forEach(e => {
      let shift = (e.shifts[monthKey] || [])[selectedDayIdx] || 'F';
      if (e.vacationStart && e.vacationEnd && dateStr >= e.vacationStart && dateStr <= e.vacationEnd) shift = 'FE';

      if (shift === 'T' || shift === 'C') {
        counts.total++;
        working.push(e);
        if (shift === 'C') counts.curso++;
      } else if (shift === 'FE') {
        counts.ferias++;
      } else {
        counts.folga++;
        if (shift === 'F' || shift === 'FF') {
           absences.push({ name: e.name.split(' ')[0], reason: shift === 'FF' ? 'Folga Feriado' : 'Folga' });
        }
      }
    });

    return { counts, working, absences };
  }, [employees, monthKey, selectedDayIdx, dateStr]);

  const { counts, working, absences } = data;
  const lunchSlots = useMemo(() => 
    calculateLunchSchedule(employees, selectedDayIdx, isSunday, isHoliday, monthKey),
    [employees, selectedDayIdx, isSunday, isHoliday, monthKey]
  );
  return (
    <div className="bg-white dark:bg-slate-950 rounded-[2.5rem] p-6 lg:p-8 flex flex-col h-full overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl transition-all">
      
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-6xl font-black text-slate-950 dark:text-white tracking-tighter leading-none">{selectedDayIdx + 1}</span>
            <div className="flex flex-col">
              <span className="text-sm font-black text-orange-500 uppercase tracking-[0.2em]">{date.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">{months[currentMY.month]} {currentMY.year}</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {isHoliday && (
            <div className="shrink-0 animate-pulse flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-4 py-2 rounded-xl text-[9px] font-black uppercase ring-1 ring-rose-200 border border-rose-100">
               <Icon name="event_busy" className="text-sm" /> FERIADO
            </div>
          )}
          {counts.curso > 0 && (
            <div className="shrink-0 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl text-[9px] font-black uppercase ring-1 ring-blue-200 border border-blue-100">
               <Icon name="school" className="text-sm" /> {counts.curso} EM CURSO
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-4 transition-all hover:scale-[1.02]">
           <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30"><Icon name="groups" className="text-lg" /></div>
           <div><p className="text-xl font-black text-emerald-950 dark:text-emerald-100 leading-none">{counts.total}</p><p className="text-[8px] font-black text-emerald-600/60 uppercase tracking-widest mt-1">Trabalhando</p></div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800 flex items-center gap-4 transition-all hover:scale-[1.02]">
           <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg"><Icon name="person_off" className="text-lg" /></div>
           <div><p className="text-xl font-black text-slate-950 dark:text-white leading-none">{counts.folga + counts.ferias}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Ausentes</p></div>
        </div>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto custom-scrollbar pr-2 mb-4">
          <section>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2rem] mb-4 flex items-center gap-2">
                <div className="w-1 h-3 bg-slate-400 rounded-full" /> EQUIPE ESCALADA
            </h4>
            
            <div className="space-y-6">
                {/* Agrupamento por Turno para melhor visualização */}
                {['Abertura', 'Intermediário', 'Fechamento'].map(shiftTitle => {
                    const filteredEmps = working.filter(emp => {
                        const h = (emp.dailyHours[monthKey] || [])[selectedDayIdx] || emp.workPeriod;
                        if (shiftTitle === 'Abertura') return h.includes('10h');
                        if (shiftTitle === 'Intermediário') return h.includes('12h');
                        return !h.includes('10h') && !h.includes('12h');
                    });

                    if (filteredEmps.length === 0) return null;

                    return (
                        <div key={shiftTitle} className="space-y-3">
                            <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">{shiftTitle}</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredEmps.map(emp => {
                                    const shift = (emp.shifts[monthKey] || [])[selectedDayIdx] || 'F';
                                    const hour = (emp.dailyHours[monthKey] || [])[selectedDayIdx] || emp.workPeriod;
                                    return (
                                        <div key={emp.id} className={`relative p-3 rounded-2xl border transition-all flex items-center justify-between ${
                                            shift === 'C' ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                                        }`}>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate">{emp.name.split(' ')[0]} {emp.name.split(' ')[1] || ''}</p>
                                                    {shift === 'C' && <Icon name="school" className="text-[10px] text-blue-500" />}
                                                </div>
                                                <p className="text-[8px] font-bold text-slate-400 mt-0.5">{hour}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg ${
                                                    shift === 'C' ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300' : 
                                                    shift === 'T' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' :
                                                    'bg-orange-100 dark:bg-orange-900 text-orange-600'
                                                }`}>
                                                    {shift}
                                                </span>
                                                {isEditable && !isGridLocked && (
                                                    <select 
                                                        value={shift === 'T' || shift === 'C' ? shift : 'F'}
                                                        onChange={(e) => onUpdateShift?.(emp.id, selectedDayIdx, e.target.value as any)}
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                    >
                                                        <option value="T">Trabalho (T)</option>
                                                        <option value="C">Curso (C)</option>
                                                        <option value="F">Folga (F)</option>
                                                        <option value="FF">Feriado/Folga (FF)</option>
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
          </section>

          {absences.length > 0 && (
             <section className="animate-fade-in">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2rem] mb-2 flex items-center gap-2">
                    <div className="w-1 h-3 bg-rose-400 rounded-full" /> Ausências e folgas
                </h4>
                <div className="bg-rose-50/30 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/20 rounded-2xl p-4">
                   <p className="text-[10px] font-black text-rose-800 dark:text-rose-400 uppercase tracking-tight">
                      {absences.map((a, i) => (
                        <span key={a.name}>
                          {a.name} <span className="opacity-50 text-[8px]">({a.reason})</span>
                          {i < absences.length - 1 ? ' • ' : ''}
                        </span>
                      ))}
                   </p>
                </div>
             </section>
          )}

          {lunchSlots.length > 0 && (
            <section className="bg-slate-50 dark:bg-slate-900/60 rounded-[2rem] p-6 lg:p-8 border border-slate-200 dark:border-slate-800 shadow-inner">
               <div className="flex items-center justify-between mb-6">
                    <h4 className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Icon name="restaurant" className="text-base text-orange-500" /> ESCALA DE ALMOÇO
                    </h4>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">Sugestão Automática</span>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {lunchSlots.map((slot, i) => (
                    <div key={i} className="flex items-start gap-4 group/slot border-l-2 border-slate-200 dark:border-slate-800 pl-4 py-1 hover:border-orange-500 transition-colors">
                       <div className="shrink-0 w-16 text-left">
                          <span className="text-[14px] font-black text-slate-900 dark:text-slate-100">{slot.time}</span>
                          <p className="text-[8px] font-black text-orange-500 uppercase mt-0.5">{slot.duration} min</p>
                       </div>
                       <div className="flex-1 flex flex-wrap gap-2">
                          {slot.employees.map(e => (
                            <div key={e.id} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center gap-2 border shadow-sm ${
                                e.isApprentice ? 'bg-amber-100 border-amber-200 text-amber-700' : 
                                e.isStockist ? 'bg-sky-100 border-sky-200 text-sky-700' : 
                                'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                            }`}>
                               {e.name}
                               {e.isApprentice && <Icon name="school" className="text-[10px]" />}
                               {e.isStockist && <Icon name="inventory" className="text-[10px]" />}
                            </div>
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
               
               <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2rem]">
                      Ajuste conforme o fluxo da loja
                  </p>
                  <div className="flex items-center gap-3">
                     <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-[8px] font-black text-slate-400 uppercase">Aprendiz</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-sky-400" />
                        <span className="text-[8px] font-black text-slate-400 uppercase">Estoque</span>
                     </div>
                  </div>
               </div>
            </section>
          )}
      </div>

    </div>
  );
};

const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];




const ShiftBox: React.FC<{ label: string, range: string, count: number, names: string[], color: string, icon: any }> = ({ label, range, count, names, color, icon }) => (
  <div className={`bg-${color}-50/40 p-2.5 rounded-xl border border-${color}-100/60 flex flex-col justify-center min-h-[60px] transition-all hover:bg-${color}-50/80`}>
    <div className={`flex items-center gap-1.5 mb-0.5 text-${color}-600`}>
      <Icon name={icon} className="text-[10px]" />
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
      <span className={`text-[7px] text-${color}-400 ml-auto font-bold`}>{range}</span>
    </div>
    <p className="text-lg font-black text-slate-900 leading-none">{count} <span className="text-[8px] text-slate-300 font-black uppercase ml-0.5">Colab.</span></p>
    {names.length > 0 && <p className={`text-[8px] font-bold text-${color}-500/80 mt-1 truncate max-w-full italic`}>{names.join(', ')}</p>}
  </div>
);

const StatCircle: React.FC<{ label: string, count: number, color: string }> = ({ label, count, color }) => (
  <div className="text-center">
    <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest leading-none">{label}</p>
    <div className={`w-8 h-8 rounded-lg bg-${color}-50 flex items-center justify-center mx-auto text-${color}-600 font-black text-xs border border-${color}-100 shadow-sm`}>{count}</div>
  </div>
);

const LunchSection: React.FC<{ label: string, slots: string[], lunchData: any[], count: number, color: string, icon: any }> = ({ label, slots, lunchData, count, color, icon }) => (
  <div className={`bg-${color}-50/80 rounded-xl border border-${color}-100 p-4`}>
    <div className="flex items-center gap-2 mb-1">
      <Icon name={icon} className={`text-${color}-500 text-sm`} />
      <span className={`text-[10px] font-extrabold text-${color}-600 uppercase tracking-wide`}>{label}</span>
      <span className={`text-[9px] text-${color}-400 ml-auto`}>{count} colab{count > 1 ? 's' : ''}</span>
    </div>
    <div className="flex flex-wrap gap-1 mb-3">
      {slots.map(s => (
        <span key={s} className={`text-[8px] font-bold text-${color}-300 border border-${color}-200 rounded px-1 py-0.5`}>{s}</span>
      ))}
    </div>
    <div className="space-y-1">
      {lunchData.map((slot, i) => (
        <div key={i} className={`flex items-start gap-1.5 ${slot.isDouble ? 'opacity-90' : ''}`}>
          <span className={`text-[9px] font-black rounded px-1.5 py-0.5 text-center shrink-0 min-w-[38px] ${slot.isDouble ? 'bg-amber-100 text-amber-700 border border-amber-200' : `bg-${color}-100 text-${color}-600`}`}>
            {slot.time}
          </span>
          <span className="text-[9px] font-bold text-slate-600 leading-tight truncate">
            {slot.names.join(', ')}
            {slot.isDouble && <span className="ml-1 text-[7px] text-amber-500 font-black">(2×)</span>}
          </span>
        </div>
      ))}
    </div>
  </div>
);
