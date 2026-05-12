
import React, { useState, useMemo } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, ShiftType, MonthYear, Holiday, JornadaSettings } from '../types';
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
  onCloseNotes: () => void;
  resolvedPositions: Record<string, string>;
  jornadaSettings: JornadaSettings;
  onOpenEmployeeCard: (emp: Employee) => void;
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
  onCloseNotes,
  resolvedPositions,
  jornadaSettings,
  onOpenEmployeeCard,
}) => {
  const { showDialog } = useDialog();
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

  const allHolidays = useMemo(() => {
    return [...getNationalHolidays(currentMY.year), ...customHolidays]
      .filter(h => h.date.startsWith(String(currentMY.year)))
      .filter((h, i, self) => i === self.findIndex(t => t.date === h.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [currentMY.year, customHolidays]);

  const [searchTerm, setSearchTerm] = useState('');

  const displayedEmployees = useMemo(() => {
    return [...employees]
      .filter(e => !e.isHidden && e.status === 'active')
      .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => (a.workPeriod || '').localeCompare(b.workPeriod || '') || a.name.localeCompare(b.name));
  }, [employees, searchTerm]);

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
    <div className="flex flex-col gap-4 relative h-full">
      {/* Search and Filters for Mobile/Quick Access */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72 group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
            <Icon name="search" className="text-xl" />
          </div>
          <input 
            type="text" 
            placeholder="Buscar colaborador..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all shadow-sm"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600"
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
           <Icon name="info" className="text-orange-500" /> Clique no nome para ver sua escala individual
        </div>
      </div>

      {/* Grid Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto custom-scrollbar flex-1">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-800">
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="sticky left-0 z-[50] bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 py-2 px-2 sm:px-4 text-left min-w-[120px] sm:min-w-[180px] w-[120px] sm:w-[180px]">
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</span>
                </th>
                {!isReadOnly && (
                  <>
                    <th className="hidden sm:table-cell sticky left-[180px] z-[50] bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 py-2 px-4 text-left min-w-[125px] w-[125px]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário</span>
                    </th>
                    <th className="hidden md:table-cell sticky left-[305px] z-[50] bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 py-2 px-4 text-left min-w-[100px] w-[100px]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posição</span>
                    </th>
                  </>
                )}
                {filteredDays.map(d => {
                  const dayIdx = d.num - 1;
                  const stats = employees.reduce((acc, emp) => {
                    if (emp.isHidden || emp.status !== 'active') return acc;
                    if (searchTerm && !emp.name.toLowerCase().includes(searchTerm.toLowerCase())) return acc;
                    const shift = (emp.shifts[monthKey] || [])[dayIdx] || 'T';
                    const hour = (emp.dailyHours[monthKey] || [])[dayIdx] || emp.workPeriod;
                    const shiftClass = getShiftClassification(hour, d.isSunday, jornadaSettings);
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
                  if (searchTerm && !emp.name.toLowerCase().includes(searchTerm.toLowerCase())) return;

                  const shift = (emp.shifts[monthKey] || [])[selectedDayIdx] || 'T';
                  const isOff = !isWorkingShift(shift);
                  
                  if (isOff) {
                    groups['Folgas/Outros'].push(emp);
                    return;
                  }


                  const hour = (emp.dailyHours[monthKey] || [])[selectedDayIdx] || emp.workPeriod;
                  const isSun = days[selectedDayIdx]?.isSunday;
                  const classification = getShiftClassification(hour, isSun, jornadaSettings);
                  
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
                        <td className="sticky left-0 py-1.5 px-2 font-black text-[9px] sm:text-[10px] uppercase text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 bg-inherit shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)]">
                          {groupName}
                        </td>
                        {!isReadOnly && (
                          <>
                            <td className="hidden sm:table-cell sticky left-[180px] border-r border-slate-200 dark:border-slate-700 bg-inherit shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)]" />
                            <td className="hidden md:table-cell sticky left-[305px] border-r border-slate-200 dark:border-slate-700 bg-inherit shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)]" />
                          </>
                        )}
                        <td colSpan={filteredDays.length} className="bg-inherit h-7" />
                      </tr>

                      {/* Employee Rows */}
                      {emps.map(emp => {
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group/row">
                            {/* Name & Position */}
                            <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 py-1 px-1.5 sm:py-1.5 sm:px-2 min-w-[120px] sm:min-w-[180px] w-[120px] sm:w-[180px]">
                              <button 
                                onClick={() => onOpenEmployeeCard(emp)}
                                className="flex items-center gap-1.5 sm:gap-2 w-full text-left hover:bg-orange-50 dark:hover:bg-orange-900/10 p-0.5 sm:p-1 rounded-lg sm:rounded-xl transition-all group/name"
                              >
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 group-hover/name:bg-orange-100 group-hover/name:text-orange-600 group-hover/name:border-orange-200 transition-colors">
                                  {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-slate-100 truncate group-hover/name:text-orange-600 transition-colors">{emp.name}</span>
                                    {(emp.requests || []).some(r => r.date && r.date.startsWith(monthKey)) && (
                                      <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-orange-500 rounded-full flex items-center justify-center animate-bounce-subtle" title="Tem pedidos para este mês">
                                        <Icon name="chat_bubble" className="text-[7px] sm:text-[8px] text-white" />
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase truncate">{emp.cargo || 'Vendedor'}</span>
                                </div>
                                <Icon name="chevron_right" className="hidden sm:block text-slate-300 group-hover/name:text-orange-500 opacity-0 group-hover/name:opacity-100 transition-all text-sm ml-auto" />
                              </button>
                            </td>
                             {!isReadOnly && (
                               <>
                                 {/* Hours Select */}
                                 <td className="hidden sm:table-cell sticky left-[180px] z-10 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 py-1 px-2 min-w-[125px] w-[125px]">
                                   <select
                                     value={emp.dailyHours[monthKey]?.[selectedDayIdx] || ''}
                                     onChange={(e) => onUpdateEmployeeDailyHour(emp.id, selectedDayIdx, e.target.value)}
                                     className="w-full bg-transparent border-none p-0 text-[11px] font-black text-orange-600 focus:ring-0 uppercase"
                                   >
                                     {(() => {
                                       const date = new Date(currentMY.year, currentMY.month, selectedDayIdx + 1);
                                       const isHol = holidaySet.has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(selectedDayIdx + 1).padStart(2, '0')}`);
                                       const isSun = date.getDay() === 0;
   
                                       let options = jornadaSettings.shiftHours.weekday;
                                       if (isHol) options = jornadaSettings.shiftHours.holiday;
                                       else if (isSun) options = jornadaSettings.shiftHours.sunday;
                                       if (emp.isYoungApprentice) options = jornadaSettings.shiftHours.apprentice;
   
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
                                 <td className="hidden md:table-cell sticky left-[305px] z-10 bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 py-1 px-2 min-w-[100px] w-[100px]">
                                   <select
                                     value={emp.tacticalPositions?.[monthKey]?.[selectedDayIdx] || 'AUTO'}
                                     onChange={(e) => onUpdateTacticalPosition(emp.id, selectedDayIdx, e.target.value)}
                                     className="w-full bg-transparent border-none p-0 text-[11px] font-black text-slate-900 dark:text-slate-100 focus:ring-0 uppercase"
                                   >
                                     <option value="AUTO">AUTO 🤖</option>
                                     {(() => {
                                       const empHour = emp.dailyHours[monthKey]?.[selectedDayIdx] || emp.workPeriod;
                                       const isSun = days[selectedDayIdx]?.isSunday;
                                       const group = getShiftClassification(empHour, isSun, jornadaSettings);
   
                                       // Find all positions assigned to this group
                                       const groupPositions = employees
                                         .filter(e => !e.isHidden && e.status === 'active')
                                         .filter(e => {
                                           const eHour = e.dailyHours[monthKey]?.[selectedDayIdx] || e.workPeriod;
                                           return getShiftClassification(eHour, isSun, jornadaSettings) === group;
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
                               </>
                             )}

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
                              
                              const fullDate = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d.num).padStart(2, '0')}`;
                              const dayRequest = (emp.requests || []).find(r => r.date === fullDate);

                              return (
                                <td key={d.num} className={`py-1 px-1 border-b border-slate-50 dark:border-slate-800 text-center transition-all relative ${dimClass} ${selectedDayIdx === d.num - 1 ? 'ring-2 ring-inset ring-orange-400/50' : ''} ${hasAlert ? 'ring-2 ring-inset ring-rose-500' : ''}`}>
                                  <div className="relative group flex flex-col items-center gap-1">
                                    {dayRequest && (
                                      <div 
                                        className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full z-10 border-2 border-white dark:border-slate-900 ${
                                          dayRequest.status === 'granted' ? 'bg-emerald-500' : 
                                          dayRequest.status === 'seen' ? 'bg-blue-500' : 
                                          'bg-orange-500 animate-pulse'
                                        }`}
                                        title={`Pedido: ${dayRequest.text}`}
                                      />
                                    )}
                                    <button
                                      onClick={() => onSelectDay(d.num - 1)}
                                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all shadow-sm relative ${
                                        dayRequest ? (
                                          dayRequest.status === 'granted' ? 'ring-2 ring-emerald-500 bg-emerald-50' :
                                          dayRequest.status === 'seen' ? 'ring-2 ring-blue-500 bg-blue-50' :
                                          'ring-4 ring-orange-500 bg-orange-50 animate-pulse z-20'
                                        ) : ''
                                      } ${
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
                                        (!dayRequest ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700' : '')
                                      }`}
                                    >
                                      {shift === 'AT' ? (
                                        <div className="flex items-center justify-center text-rose-500 font-black">
                                          <Icon name="add" className="text-sm" />
                                        </div>
                                      ) : shift === 'C' ? <span className="text-[7px]">CURSO</span> : (shift === 'T' ? (d.isSunday ? 'DOM' : 'T') : (shift.startsWith('FF') ? 'FF' : shift))}
                                    </button>

                                    
                                    {isEditable && !isReadOnly && (() => {
                                      const pendingCount = (holidayCredits[emp.id] || []).filter(c => c.status === 'pending').length;
                                      return (
                                        <select
                                          value={shift}
                                          onChange={(e) => onUpdateShift(emp.id, d.num - 1, e.target.value as ShiftType)}
                                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-50"
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
                                          <option disabled>──────</option>
                                          <option value="P1">Posição P1 🟥</option>
                                          <option value="P2">Posição P2 🟨</option>
                                          <option value="P3">Posição P3 🟩</option>
                                          <option value="P4">Posição P4 🟦</option>
                                          <option value="ESTQ">Posição ESTQ 📦</option>
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon name="campaign" className="text-orange-500" />
              <h3 className="text-[12px] font-black uppercase text-slate-800 dark:text-slate-100">Recados Importantes do Mês (Para Impressão)</h3>
            </div>
            <button 
              onClick={onCloseNotes}
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
            >
              <Icon name="close" />
            </button>
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
