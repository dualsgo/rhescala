
import React, { useState, useMemo } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, ShiftType, MonthYear, Holiday } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, buildHolidaySet, getNationalHolidays, getDefaultHourForDay } from '../constants';
import { getShiftClassification, isWorkingShift } from '../hooks/useScheduleEngine';

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
  resolvedPositions: Record<string, string>;
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
  resolvedPositions,
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
                    const shiftClass = getShiftClassification(hour, d.isSunday);
                    if (isWorkingShift(shift) || shift.startsWith('FF')) {
                      acc.total++;
                      if (shiftClass === 'Abertura') acc.opening++;
                      else if (shiftClass === 'Fechamento') acc.closing++;
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
                        <div className="mt-1 text-[8px] font-bold text-slate-400">
                           T:{stats.total}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(() => {
                const groups: Record<string, Employee[]> = {
                  'Abertura': [],
                  'Intermediário': [],
                  'Fechamento': [],
                  'Folgas/Outros': []
                };

                employees.forEach(emp => {
                  if (emp.isHidden || emp.status !== 'active') return;
                  const shift = (emp.shifts[monthKey] || [])[selectedDayIdx] || 'T';
                  const isOff = !isWorkingShift(shift) && shift !== 'C' && !shift.startsWith('FF');
                  
                  if (isOff) {
                    groups['Folgas/Outros'].push(emp);
                    return;
                  }


                  const hour = (emp.dailyHours[monthKey] || [])[selectedDayIdx] || emp.workPeriod;
                  const isSun = filteredDays[selectedDayIdx]?.isSunday;
                  const classification = getShiftClassification(hour, isSun);
                  
                  if (groups[classification]) groups[classification].push(emp);
                  else groups['Folgas/Outros'].push(emp);
                });

                return ['Abertura', 'Intermediário', 'Fechamento', 'Folgas/Outros'].map(groupName => {
                  const emps = groups[groupName];
                  if (emps.length === 0) return null;

                  return (
                    <React.Fragment key={groupName}>
                      {/* Group Header Row */}
                      <tr className="bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md sticky z-20">
                        <td className="sticky left-0 p-2 font-black text-[11px] uppercase text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 bg-inherit shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)]">
                          {groupName}
                        </td>
                        <td className="sticky left-[180px] border-r border-slate-200 dark:border-slate-700 bg-inherit shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)]" />
                        <td className="sticky left-[305px] border-r border-slate-200 dark:border-slate-700 bg-inherit shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)]" />
                        <td colSpan={filteredDays.length} className="bg-inherit h-9" />
                      </tr>

                      {/* Employee Rows */}
                      {emps.map(emp => {
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group/row">
                            {/* Name & Position */}
                            <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-2 min-w-[180px] w-[180px]">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 truncate w-32">{emp.name}</span>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">{emp.cargo || 'Vendedor'}</span>
                                </div>
                              </div>
                            </td>
                            {/* Hours Select */}
                            <td className="sticky left-[180px] z-10 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-2 min-w-[125px] w-[125px]">
                              <select
                                value={emp.dailyHours[monthKey]?.[selectedDayIdx] || ''}
                                onChange={(e) => onUpdateEmployeeDailyHour(emp.id, selectedDayIdx, e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-[11px] font-black text-orange-600 focus:ring-0 uppercase"
                              >
                                {(() => {
                                  const date = new Date(currentMY.year, currentMY.month, selectedDayIdx + 1);
                                  const isHol = holidaySet.has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(selectedDayIdx + 1).padStart(2, '0')}`);
                                  const isSun = date.getDay() === 0;

                                  let options = SHIFT_HOURS.WEEKDAY;
                                  if (isHol) options = SHIFT_HOURS.HOLIDAY;
                                  else if (isSun) options = SHIFT_HOURS.SUNDAY;
                                  if (emp.isYoungApprentice) options = SHIFT_HOURS.APPRENTICE;

                                  const currentVal = emp.dailyHours[monthKey]?.[selectedDayIdx];
                                  const finalOptions = [...new Set([...options])].filter(Boolean);

                                  return (
                                    <>
                                      <option value="">AUTO 🤖</option>
                                      {finalOptions.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                      ))}
                                      {currentVal && !finalOptions.includes(currentVal) && (
                                        <option value={currentVal}>{currentVal}</option>
                                      )}
                                    </>
                                  );
                                })()}
                              </select>
                            </td>
                            {/* Tactical Select */}
                            <td className="sticky left-[305px] z-10 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-2 min-w-[100px] w-[100px]">
                              <select
                                value={emp.tacticalPositions?.[monthKey]?.[selectedDayIdx] || 'AUTO'}
                                onChange={(e) => onUpdateTacticalPosition(emp.id, selectedDayIdx, e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-[11px] font-black text-slate-900 dark:text-slate-100 focus:ring-0 uppercase"
                              >
                                <option value="AUTO">AUTO 🤖</option>
                                {(() => {
                                  const empHour = emp.dailyHours[monthKey]?.[selectedDayIdx] || emp.workPeriod;
                                  const isSun = days[selectedDayIdx]?.isSunday;
                                  const group = getShiftClassification(empHour, isSun);

                                  // Find all positions assigned to this group
                                  const groupPositions = employees
                                    .filter(e => !e.isHidden && e.status === 'active')
                                    .filter(e => {
                                      const eHour = e.dailyHours[monthKey]?.[selectedDayIdx] || e.workPeriod;
                                      return getShiftClassification(eHour, isSun) === group;
                                    })
                                    .map(e => e.tacticalPositions?.[monthKey]?.[selectedDayIdx] || resolvedPositions[e.id])
                                    .filter(Boolean);

                                  const uniquePositions = [...new Set(groupPositions)].sort();
                                  const labels: Record<string, string> = { 'P1': 'P1 🟥', 'P2': 'P2 🟨', 'P3': 'P3 🟩', 'P4': 'P4 🟦', 'ESTQ': 'ESTQ 📦' };
                                  
                                  // Fallback: if no positions resolved yet or just AUTO, show all
                                  const finalPositions = uniquePositions.length > 0 ? uniquePositions : ['P1', 'P2', 'P3', 'P4', 'ESTQ'];

                                  return finalPositions.map(p => (
                                    <option key={p} value={p}>{labels[p] || p}</option>
                                  ));
                                })()}
                              </select>
                            </td>

                            {/* Shift Cells */}
                            {filteredDays.map(d => {
                              const shift = emp.shifts[monthKey]?.[d.num - 1] || 'T';
                              let streak = 0;
                              for (let i = d.num - 1; i >= 0; i--) {
                                if (isWorkingShift(emp.shifts[monthKey]?.[i])) streak++;
                                else break;
                              }

                              const hasAlert = streak >= 7;
                              const todayStr = new Date().toISOString().split('T')[0];
                              const isPast = d.dateStr < todayStr;
                              const dimClass = isPast && (!isEditable || !allowRetroactive) ? 'opacity-30 grayscale' : '';

                              return (
                                <td key={d.num} className={`p-1.5 border-b border-slate-50 dark:border-slate-800 text-center transition-all ${dimClass} ${selectedDayIdx === d.num - 1 ? 'ring-2 ring-inset ring-orange-400/50' : ''} ${hasAlert ? 'ring-2 ring-inset ring-rose-500' : ''}`}>
                                  <div className="relative group flex flex-col items-center gap-1">
                                    <button
                                      onClick={() => onSelectDay(d.num - 1)}
                                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all shadow-sm ${
                                        shift === 'F' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' :
                                        shift.startsWith('FF') ? 'bg-amber-100 text-amber-600' :
                                        shift === 'C' ? 'bg-indigo-100 text-indigo-600' :
                                        shift === 'FE' ? 'bg-emerald-100 text-emerald-600' :
                                        shift === 'DO' ? 'bg-fuchsia-600 text-white shadow-md' :
                                        shift === 'P1' ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400' :
                                        shift === 'P2' ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300' :
                                        shift === 'P3' ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400' :
                                        shift === 'P4' ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400' :
                                        shift === 'ESTQ' ? 'bg-slate-700 text-white shadow-md ring-2 ring-slate-500' :
                                        'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700'
                                      }`}
                                    >
                                      {shift === 'T' ? (d.isSunday ? 'DOM' : 'T') : (shift.startsWith('FF') ? 'FF' : shift)}
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
                                          
                                          {/* Specific Pending Holidays */}
                                          {(holidayCredits[emp.id] || [])
                                            .filter(c => c.status === 'pending')
                                            .map(c => (
                                              <option key={c.holidayDate} value={`FF ${c.holidayDate}`}>
                                                FF — {c.holidayName}
                                              </option>
                                            ))
                                          }
                                          
                                          {/* Current value if it's a specific FF already matched but not in pending anymore */}
                                          {shift?.startsWith('FF ') && !(holidayCredits[emp.id] || []).some(c => c.status === 'pending' && `FF ${c.holidayDate}` === shift) && (
                                            <option value={shift}>{shift.replace('FF ', 'FF — ')}</option>
                                          )}
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
                        );
                      })}
                    </React.Fragment>
                  );
                });
              })()}
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
