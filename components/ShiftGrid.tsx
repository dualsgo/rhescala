
import React, { useState, useMemo } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, ShiftType, MonthYear, Holiday } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, buildHolidaySet, getNationalHolidays, getDefaultHourForDay } from '../constants';
import { getShiftClassification } from '../hooks/useScheduleEngine';
import { HolidayCredit } from '../hooks/useHolidayCredits';

interface ShiftGridProps {
  employees: Employee[];
  currentMY: MonthYear;
  selectedDayIdx: number;
  today: Date;
  customHolidays: Holiday[];
  holidayCredits: Record<string, HolidayCredit[]>;
  filter: 'all' | 'sunday' | 'holiday' | 'week';
  onSelectDay: (idx: number) => void;
  onUpdateShift: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateShifts: (updates: { empId: string, dayIdx: number, newShift: ShiftType }[]) => void;
  onUpdateEmployeeDailyHour: (empId: string, dayIdx: number, newHour: string) => void;
  onUpdateTacticalPosition: (empId: string, dayIdx: number, newPos: string | null) => void;
  onShareWhatsApp: (dayIdx: number) => void;
  onOpenDayDetail: (dayIdx: number) => void;
  onResetMonth: () => void;
  onApplyFolgas: () => void;
  onSortearDomingo: () => void;
  onOpenAnalysis: () => void;
  onShowHolidayManager: () => void;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  monthNotes: string;
  onUpdateMonthNotes: (text: string) => void;
}

export const ShiftGrid: React.FC<ShiftGridProps> = ({
  employees,
  currentMY,
  selectedDayIdx,
  today,
  customHolidays,
  holidayCredits,
  filter,
  onSelectDay,
  onUpdateShift,
  onUpdateShifts,
  onUpdateEmployeeDailyHour,
  onUpdateTacticalPosition,
  onShareWhatsApp,
  onOpenDayDetail,
  onResetMonth,
  onApplyFolgas,
  onSortearDomingo,
  onOpenAnalysis,
  onShowHolidayManager,
  onNextMonth,
  onPrevMonth,
  monthNotes,
  onUpdateMonthNotes,
}) => {
  const [isEditable, setIsEditable] = useState(false);
  const [allowRetroactive, setAllowRetroactive] = useState(false);
  const { showDialog } = useDialog();
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

  const allHolidays = useMemo(() => {
    return [...getNationalHolidays(currentMY.year), ...customHolidays]
      .filter(h => h.date.startsWith(String(currentMY.year)))
      .filter((h, i, self) => i === self.findIndex(t => t.date === h.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [currentMY.year, customHolidays]);

  const displayedEmployees = useMemo(() => {
    return [...employees]
      .filter(e => !e.isHidden && e.status === 'active')
      .sort((a, b) => (a.workPeriod || '').localeCompare(b.workPeriod || '') || a.name.localeCompare(b.name));
  }, [employees]);

  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(currentMY.year, currentMY.month, i + 1);
      const dow = date.getDay();
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const isHoliday = holidaySet.has(dateStr);
      return { num: i + 1, weekday: ['DOM','SEG','TER','QUA','QUI','SEX','SAB'][dow], isSunday: dow === 0, isHoliday, dateStr };
    });
  }, [currentMY, daysInMonth, holidaySet]);

  // Filtering logic
  const filteredDays = useMemo(() => {
    if (filter === 'sunday') return days.filter(d => d.isSunday);
    if (filter === 'holiday') return days.filter(d => d.isHoliday);
    return days;
  }, [days, filter]);

  return (
    <div className="flex flex-col gap-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditable(!isEditable)}
            className={`px-6 py-2 rounded-xl text-[11px] font-black uppercase transition-all flex items-center gap-2 ${isEditable ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}
          >
            <Icon name={isEditable ? 'save' : 'edit'} className="text-sm" />
            {isEditable ? 'Salvar' : 'Editar Escala'}
          </button>
          
          {isEditable && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Retroativo</span>
              <button
                onClick={() => setAllowRetroactive(!allowRetroactive)}
                className={`w-8 h-4 rounded-full relative transition-colors ${allowRetroactive ? 'bg-indigo-500' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${allowRetroactive ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditable && (
            <>
              <button onClick={onApplyFolgas} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase hover:bg-orange-500 hover:text-white transition-all">
                Aplicar Folgas
              </button>
              <button onClick={onSortearDomingo} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase hover:bg-orange-500 hover:text-white transition-all">
                Sortear Domingos
              </button>
            </>
          )}
          <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Icon name="print" className="text-sm" /> PDF
          </button>
          <button onClick={onResetMonth} className="px-6 py-2 bg-orange-500 text-white rounded-xl text-[11px] font-black uppercase shadow-md hover:bg-orange-600 transition-all flex items-center gap-2">
            <Icon name="add" className="text-sm" /> Criar Mês
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 p-4 text-left min-w-[180px] w-[180px]">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</span>
                </th>
                <th className="sticky left-[180px] z-20 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 p-4 text-left min-w-[125px] w-[125px]">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário</span>
                </th>
                <th className="sticky left-[305px] z-20 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 p-4 text-left min-w-[100px] w-[100px]">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posição</span>
                </th>
                {filteredDays.map(d => {
                  const dayIdx = d.num - 1;
                  const stats = employees.reduce((acc, emp) => {
                    if (emp.isHidden || emp.status !== 'active') return acc;
                    const shift = (emp.shifts[monthKey] || [])[dayIdx] || 'T';
                    const hour = (emp.dailyHours[monthKey] || [])[dayIdx] || emp.workPeriod;
                    if (shift === 'T' || shift.startsWith('FF')) {
                      acc.total++;
                      const startH = parseInt(hour.split('h')[0]);
                      if (!isNaN(startH)) {
                        if (startH < 11) acc.opening++;
                        else if (startH >= 13) acc.closing++;
                      }
                    }
                    return acc;
                  }, { total: 0, opening: 0, closing: 0 });

                  const isSelected = selectedDayIdx === dayIdx;
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isPast = d.dateStr < todayStr;
                  const dimClass = isPast && (!isEditable || !allowRetroactive) ? 'opacity-30 grayscale pointer-events-none select-none' : '';

                  return (
                    <th 
                      key={d.num} 
                      onClick={() => isSelected ? onOpenDayDetail(dayIdx) : onSelectDay(dayIdx)}
                      className={`p-3 border-b border-slate-200 dark:border-slate-700 min-w-[60px] cursor-pointer transition-all ${dimClass} ${isSelected ? 'bg-orange-500/10 ring-2 ring-inset ring-orange-500/30' : d.isSunday ? 'bg-rose-50 dark:bg-rose-900/20' : d.isHoliday ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase">{d.weekday}</span>
                        <span className={`text-sm font-black ${d.isSunday ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}`}>{d.num}</span>
                        <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-200 dark:border-slate-700 pt-1 w-full">
                           <span className={`text-[8px] font-bold ${stats.opening < 4 && !d.isSunday ? 'text-rose-600' : 'text-slate-400'}`}>A:{stats.opening}</span>
                           <span className={`text-[8px] font-bold ${stats.closing <= 3 && !d.isSunday ? 'text-rose-600' : 'text-slate-400'}`}>F:{stats.closing}</span>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayedEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-4 min-w-[180px] w-[180px]">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase truncate">{emp.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{emp.cargo || 'Auxiliar'}</span>
                    </div>
                  </td>
                  <td className="sticky left-[180px] z-10 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-2 min-w-[125px] w-[125px]">
                    <select
                      value={emp.dailyHours[monthKey]?.[selectedDayIdx] || getDefaultHourForDay(emp, holidaySet.has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(selectedDayIdx + 1).padStart(2, '0')}`), new Date(currentMY.year, currentMY.month, selectedDayIdx + 1).getDay() === 0)}
                      onChange={(e) => onUpdateEmployeeDailyHour(emp.id, selectedDayIdx, e.target.value)}
                      className="w-full bg-transparent border-none p-0 text-[11px] font-black text-orange-600 focus:ring-0 uppercase"
                    >
                      {(() => {
                        const date = new Date(currentMY.year, currentMY.month, selectedDayIdx + 1);
                        const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(selectedDayIdx + 1).padStart(2, '0')}`;
                        const isHol = holidaySet.has(dateStr);
                        const isSun = date.getDay() === 0;
                        const defaultHour = getDefaultHourForDay(emp, isHol, isSun);

                        let options = SHIFT_HOURS.WEEKDAY;
                        if (isHol) options = SHIFT_HOURS.HOLIDAY;
                        else if (isSun) options = SHIFT_HOURS.SUNDAY;
                        
                        if (emp.isYoungApprentice) options = SHIFT_HOURS.APPRENTICE;

                        // Add current explicit override if present, else ensure defaultHour is in list
                        const currentVal = emp.dailyHours[monthKey]?.[selectedDayIdx];
                        const finalOptions = [...new Set([...options, currentVal || defaultHour])].filter(Boolean);

                        return (
                          <>
                            {finalOptions.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </>
                        );
                      })()}
                    </select>
                  </td>
                  <td className="sticky left-[305px] z-10 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-2 min-w-[100px] w-[100px]">
                    <select
                      value={emp.tacticalPositions?.[monthKey]?.[selectedDayIdx] || ''}
                      onChange={(e) => onUpdateTacticalPosition(emp.id, selectedDayIdx, e.target.value || null)}
                      className="w-full bg-transparent border-none p-0 text-[11px] font-black text-slate-900 dark:text-slate-100 focus:ring-0 uppercase"
                    >
                      <option value="">-</option>
                      <option value="AUTO">AUTO 🤖</option>
                      {['P1 🟥', 'P2 🟨', 'P3 🟩', 'P4 🟦', 'ESTOQUE 📦'].map(p => (
                        <option key={p} value={p.split(' ')[0]}>{p}</option>
                      ))}
                    </select>
                  </td>
                  {filteredDays.map(d => {
                    const shift = emp.shifts[monthKey]?.[d.num - 1] || 'T';
                    const isSunday = d.isSunday;
                    // Detect 7-day streak
                    let streak = 0;
                    for(let i=d.num-1; i>=0; i--) {
                       if(emp.shifts[monthKey]?.[i] === 'T') streak++;
                       else break;
                    }
                    const hasAlert = streak >= 7;
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isPast = d.dateStr < todayStr;
                    const dimClass = isPast && (!isEditable || !allowRetroactive) ? 'opacity-30 grayscale' : '';

                    const handleShiftClick = () => {
                      if (!isEditable) return;
                      if (isPast && !allowRetroactive) return;
                      const sequence: ShiftType[] = ['T', 'F', 'FF', 'FE', 'C'];
                      const currentIdx = sequence.indexOf(shift as ShiftType);
                      const nextShift = sequence[(currentIdx + 1) % sequence.length];
                      onUpdateShift(emp.id, d.num - 1, nextShift);
                    };

                    return (
                      <td 
                        key={d.num} 
                        onClick={() => selectedDayIdx === d.num - 1 ? onOpenDayDetail(d.num - 1) : onSelectDay(d.num - 1)}
                        className={`p-1.5 border-b border-slate-50 dark:border-slate-800 text-center transition-all cursor-pointer ${dimClass} ${selectedDayIdx === d.num - 1 ? 'bg-orange-50/40 dark:bg-orange-900/10' : ''} ${hasAlert ? 'ring-2 ring-inset ring-rose-500' : ''}`}
                      >
                        <button
                          onClick={handleShiftClick}
                          disabled={!isEditable}
                          title={(() => {
                            if (shift === 'FF') {
                              const dateStr = `${monthKey}-${String(d.num).padStart(2, '0')}`;
                              const credit = (holidayCredits[emp.id] || []).find(c => c.offDate === dateStr);
                              if (credit) return `Folga Feriado: Ref. ${credit.holidayName} (${credit.holidayDate.split('-').reverse().join('/')})`;
                              return 'Folga Feriado';
                            }
                            return undefined;
                          })()}
                          className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-xs font-black transition-all shadow-sm ${
                            shift === 'F' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' :
                            shift === 'FF' ? 'bg-amber-100 text-amber-600' :
                            shift === 'FE' ? 'bg-blue-100 text-blue-600' :
                            shift === 'C' ? 'bg-indigo-100 text-indigo-600' :
                            'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                          } ${isEditable ? 'hover:scale-110 hover:shadow-md cursor-pointer' : 'cursor-default'}`}
                        >
                          {shift}
                        </button>
                        
                        {isEditable && (
                           <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenDayDetail(d.num - 1);
                                }}
                                className="w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-500"
                              >
                                <Icon name="settings" className="text-[10px]" />
                              </button>
                           </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recados Box in UI */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mt-2">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="campaign" className="text-orange-500" />
          <h3 className="text-[12px] font-black uppercase text-slate-800 dark:text-slate-100">Recados Importantes do Mês (Para Impressão)</h3>
        </div>
        <textarea
          value={monthNotes}
          onChange={(e) => onUpdateMonthNotes(e.target.value)}
          placeholder="Digite aqui os recados que devem aparecer no rodapé do PDF... (aprox. 450 caracteres cabem no espaço)"
          maxLength={450}
          className="w-full h-24 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none outline-none text-slate-700 dark:text-slate-300"
        />
        <div className="text-right mt-1 text-[10px] font-bold text-slate-400">
          {monthNotes.length} / 450 caracteres
        </div>
      </div>
    </div>
  );
};
