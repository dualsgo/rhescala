
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
  isReadOnly?: boolean;
  isEditable: boolean;
  allowRetroactive: boolean;
  showNotes: boolean;
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
  isReadOnly = false,
  isEditable,
  allowRetroactive,
  showNotes,
}) => {
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
    <div className="flex flex-col gap-4 relative">

      {/* Grid Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar max-h-[calc(100vh-250px)]">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-800">
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="sticky left-0 z-[50] bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 p-4 text-left min-w-[180px] w-[180px]">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</span>
                </th>
                <th className="sticky left-[180px] z-[50] bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 p-4 text-left min-w-[125px] w-[125px]">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário</span>
                </th>
                <th className="sticky left-[305px] z-[50] bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 p-4 text-left min-w-[100px] w-[100px]">
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

                    return (
                      <td 
                        key={d.num} 
                        className={`p-1.5 border-b border-slate-50 dark:border-slate-800 text-center transition-all ${dimClass} ${selectedDayIdx === d.num - 1 ? 'bg-orange-50/40 dark:bg-orange-900/10' : ''} ${hasAlert ? 'ring-2 ring-inset ring-rose-500' : ''}`}
                      >
                        <div className="relative group flex flex-col items-center gap-1">
                          <button
                            onClick={() => onSelectDay(d.num - 1)}
                            onDoubleClick={() => onOpenDayDetail(d.num - 1)}
                            title={(() => {
                              if (shift === 'FF') {
                                const dateStr = `${monthKey}-${String(d.num).padStart(2, '0')}`;
                                const credit = (holidayCredits[emp.id] || []).find(c => c.offDate === dateStr);
                                if (credit) return `Folga Feriado: Ref. ${credit.holidayName} (${credit.holidayDate.split('-').reverse().join('/')})`;
                                return 'Folga Feriado';
                              }
                              return undefined;
                            })()}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all shadow-sm ${
                              shift === 'F' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' :
                              shift === 'FF' ? 'bg-amber-100 text-amber-600' :
                              shift === 'FE' ? 'bg-blue-100 text-blue-600' :
                              shift === 'C' ? 'bg-indigo-100 text-indigo-600' :
                              'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                            } ${isEditable && !isReadOnly ? 'hover:scale-105 cursor-pointer' : 'cursor-pointer hover:bg-slate-100'}`}
                          >
                            {shift === 'FF' ? (() => {
                              const pending = (holidayCredits[emp.id] || []).filter(c => c.status === 'pending').length;
                              const used = (holidayCredits[emp.id] || []).filter(c => c.offDate && c.offDate <= `${monthKey}-${String(d.num).padStart(2, '0')}`).length;
                              return `FF(${pending})`;
                            })() : shift}
                          </button>

                          {isEditable && !isReadOnly && (() => {
                            const pendingCount = (holidayCredits[emp.id] || []).filter(c => c.status === 'pending').length;
                            return (
                              <select
                                value={shift}
                                onChange={(e) => onUpdateShift(emp.id, d.num - 1, e.target.value as ShiftType)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              >
                                <option value="T">Trabalha (T)</option>
                                <option value="F">Folga (F)</option>
                                <option value="FF" disabled={pendingCount === 0 && shift !== 'FF'}>Folga Feriado (FF) {pendingCount > 0 ? `(${pendingCount})` : ''}</option>
                                <option value="FE">Férias (FE)</option>
                                <option value="C">Curso (C)</option>
                              </select>
                            );
                          })()}
                        </div>
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
      {showNotes && (
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
      )}
    </div>
  );
};
