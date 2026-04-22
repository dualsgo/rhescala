
import React, { useState, useMemo } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, ShiftType, MonthYear, Holiday, ShiftTemplate } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, buildHolidaySet, getNationalHolidays } from '../constants';

interface ShiftGridProps {
  employees: Employee[];
  currentMY: MonthYear;
  selectedDayIdx: number;
  today: Date;
  customHolidays: Holiday[];
  onSelectDay: (idx: number) => void;
  onUpdateShifts: (updates: { empId: string, dayIdx: number, newShift: ShiftType }[]) => void;
  onUpdateEmployeeDailyHour: (empId: string, dayIdx: number, newHour: string) => void;
  onUpdateEmployee?: (empId: string, updates: Partial<Employee>) => void;
  onShareWhatsApp: (dayIdx: number) => void;
  onOpenDayDetail: (dayIdx: number) => void;
  onShowHolidayManager: () => void;
  onShowShiftManager: () => void;
  shiftTemplates: ShiftTemplate[];
  
  // States from App
  isEditable: boolean;
  setIsEditable: (v: boolean) => void;
  isGridLocked: boolean;
  setIsGridLocked: (v: boolean) => void;
  allowRetroactive: boolean;
  setAllowRetroactive: (v: boolean) => void;
  filter: 'all' | 'sunday' | 'holiday' | 'week' | 'today' | 'tomorrow' | 'day';
  selectedWeek: number;
  isZenMode?: boolean;
  onExitZen?: () => void;
}

export const ShiftGrid: React.FC<ShiftGridProps> = ({
  employees,
  currentMY,
  selectedDayIdx,
  today,
  customHolidays,
  onSelectDay,
  onUpdateShift,
  onUpdateShifts,
  onUpdateEmployeeDailyHour,
  onUpdateEmployee,
  onOpenDayDetail,
  onShowHolidayManager,
  onShowShiftManager,
  isEditable,
  isGridLocked,
  allowRetroactive,
  filter,
  selectedWeek,
  isZenMode,
  onExitZen,
  shiftTemplates
}) => {
  const { showDialog } = useDialog();

  const daysInMonth = useMemo(() => new Date(currentMY.year, currentMY.month + 1, 0).getDate(), [currentMY.year, currentMY.month]);

  const holidaySet = useMemo(() => {
    return buildHolidaySet(currentMY.year, customHolidays);
  }, [currentMY.year, customHolidays]);

  const holidayNames = useMemo(() => {
    const nationals = getNationalHolidays(currentMY.year);
    const map: Record<string, string> = {};
    
    nationals.forEach(h => { if(h?.date) map[h.date] = h.name; });
    customHolidays.forEach(h => {
        if (!h?.date) return;
        if (h.date.length === 5) {
            map[`${currentMY.year}-${h.date}`] = h.name;
        } else {
            const parts = h.date.split('-');
            if (parts.length === 3) {
                map[`${currentMY.year}-${parts[1]}-${parts[2]}`] = h.name;
            }
        }
    });
    return map;
  }, [currentMY.year, customHolidays]);

  const days = useMemo(() => {
    const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(currentMY.year, currentMY.month, i + 1);
      const isPast = (currentMY.year < today.getFullYear()) || (currentMY.year === today.getFullYear() && currentMY.month < today.getMonth()) || (currentMY.year === today.getFullYear() && currentMY.month === today.getMonth() && (i + 1) < today.getDate());
      const isToday = (currentMY.year === today.getFullYear() && currentMY.month === today.getMonth() && (i + 1) === today.getDate());
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      return { num: (i + 1).toString().padStart(2, '0'), weekday: weekdays[date.getDay()], isSunday: date.getDay() === 0, isSaturday: date.getDay() === 6, isHoliday: holidaySet.has(dateStr), holidayName: holidayNames[dateStr] || null, isPast, isToday, dateStr };
    });
  }, [currentMY, daysInMonth, today, holidaySet, holidayNames]);

  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

  const getDayShift = (emp: Employee, dayIdx: number) => {
    const day = days[dayIdx];
    if (!day) return 'F';
    if (emp.vacationStart && emp.vacationEnd && day.dateStr >= emp.vacationStart && day.dateStr <= emp.vacationEnd) return 'FE';
    const monthShifts = (emp.shifts || {})[monthKey] || [];
    return monthShifts[dayIdx] || 'F';
  };

  const getDayHour = (emp: Employee, dayIdx: number): string => {
    const mHours = (emp.dailyHours || {})[monthKey] || [];
    return mHours[dayIdx] || emp.workPeriod || '';
  };

  const displayedEmployees = useMemo(() => {
    if (!Array.isArray(employees)) return [];
    const list = employees.filter(e => e && !e.isHidden);
    
    const mKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
    
    // Sort base list: primarily by the hour of the selected day, then workPeriod, then name
    const sorted = [...list].sort((a, b) => {
        const hourA = getDayHour(a, selectedDayIdx);
        const hourB = getDayHour(b, selectedDayIdx);
        
        if (hourA !== hourB) {
            // Compare HH:mm part (handling common formats like 07h, 08h30, etc)
            return hourA.localeCompare(hourB, undefined, { numeric: true });
        }

        const wpA = a.workPeriod || '';
        const wpB = b.workPeriod || '';
        if (wpA !== wpB) return wpA.localeCompare(wpB);
        return a.name.localeCompare(b.name, 'pt-BR');
    });

    return sorted;
  }, [employees, currentMY, selectedDayIdx, filter, days, today]);

  const filteredDays = useMemo(() => {
    if (filter === 'day') return days.map((d, i) => ({ ...d, originalIdx: i })).filter((d, i) => i === selectedDayIdx);
    if (filter === 'sunday') return days.map((d, i) => ({ ...d, originalIdx: i })).filter(d => d.isSunday);
    if (filter === 'holiday') return days.map((d, i) => ({ ...d, originalIdx: i })).filter(d => d.isHoliday);
    if (filter === 'today') return days.map((d, i) => ({ ...d, originalIdx: i })).filter(d => d.isToday);
    if (filter === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      return days.map((d, i) => ({ ...d, originalIdx: i })).filter(d => d.dateStr === tomStr);
    }
    if (filter === 'week') {
      const start = (selectedWeek - 1) * 7;
      const end = Math.min(start + 7, daysInMonth);
      return days.slice(start, end).map((d, i) => ({ ...d, originalIdx: start + i }));
    }
    return days.map((d, i) => ({ ...d, originalIdx: i }));
  }, [days, filter, selectedWeek, daysInMonth, today, selectedDayIdx]);



  const isDayLocked = (dayIdx: number) => {
    if (isGridLocked) return true;
    const day = days[dayIdx];
    if (!day) return true;
    return (day.isPast || day.isToday) && !allowRetroactive;
  };

  const handleShiftChange = async (empId: string, dayIdx: number, newShift: ShiftType) => {
    onUpdateShift(empId, dayIdx, newShift);
    onSelectDay(dayIdx);
  };

  const [manualDayType, setManualDayType] = useState<'weekday' | 'sunday' | 'holiday' | null>(null);

  const getShiftTextColor = (hour: string | undefined) => {
    if (!hour) return 'text-slate-900';
    if (hour.includes('10h')) return 'text-orange-600'; 
    if (hour.includes('12h')) return 'text-sky-600'; 
    if (hour.includes('13h')) return 'text-emerald-600'; 
    if (hour.includes('14h')) return 'text-pink-600'; 
    if (hour.includes('15h')) return 'text-rose-600';
    if (hour.includes('13h40')) return 'text-indigo-600'; 
    return 'text-slate-900';
  };

  const autoDayType = days[selectedDayIdx]?.isHoliday ? 'holiday' : days[selectedDayIdx]?.isSunday ? 'sunday' : 'weekday';
  const currentDayType = manualDayType || autoDayType;

  const activeTemplate = shiftTemplates.find(t => t.isActive && t.type === currentDayType);
  const availableHours = activeTemplate ? activeTemplate.hours : (SHIFT_HOURS[currentDayType.toUpperCase() as keyof typeof SHIFT_HOURS] || []);

  return (
    <div className={`flex flex-col bg-white dark:bg-slate-900 shadow-xl overflow-hidden h-full transition-all duration-300 ${isZenMode ? 'rounded-none border-none' : 'rounded-[2rem] border border-slate-200 dark:border-slate-800 relative'}`}>
      
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-slate-50/20 dark:bg-slate-900/40">
        
        {isGridLocked && !isZenMode && (
          <div className="absolute inset-0 z-[70] bg-slate-900/5 backdrop-blur-[1px] flex items-center justify-center p-8 pointer-events-none select-none">
             <div className="bg-white/95 border border-slate-200 shadow-2xl rounded-3xl p-8 flex flex-col items-center gap-4 animate-scale-up border-b-4 border-b-rose-500">
                <Icon name="lock" className="text-3xl text-rose-500" fill />
                <div className="text-center">
                   <h4 className="text-xl font-black text-slate-900">Escala Protegida</h4>
                   <p className="text-xs font-bold text-slate-400 mt-1">Edições bloqueadas para evitar alterações acidentais.</p>
                </div>
             </div>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
           <div className="flex items-center gap-4">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Legenda de Turnos:</span>
              <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-sky-100 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-800" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Abertura</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Intermediário</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Fechamento</span>
                  </div>
              </div>
           </div>
        </div>

        <table className="w-full text-left border-separate border-spacing-0 min-w-[max-content] table-fixed">
          <thead className="sticky top-0 z-40 bg-white dark:bg-slate-900 transition-colors">
            <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
              <th className="sticky left-0 top-0 z-[61] bg-slate-100 dark:bg-slate-800 p-4 border-r border-b border-slate-300 dark:border-slate-700 w-[150px] shadow-md transition-colors">Colaborador</th>
              <th className="sticky left-[150px] top-0 z-[61] bg-slate-100 dark:bg-slate-800 p-2 border-r border-b border-slate-300 dark:border-slate-700 w-[120px] shadow-md transition-colors">
                 <div className="flex flex-col gap-1 items-center">
                    <span>Horário</span>
                    <select 
                      value={manualDayType || autoDayType} 
                      onChange={(e) => setManualDayType(e.target.value as any)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-[8px] font-black uppercase text-orange-600 outline-none focus:ring-1 ring-orange-500/20"
                    >
                       <option value="weekday">Útil</option>
                       <option value="sunday">Domingo</option>
                       <option value="holiday">Feriado</option>
                    </select>
                 </div>
              </th>
              <th className="sticky left-[270px] top-0 z-[61] bg-slate-100 dark:bg-slate-800 p-2 border-r border-b border-slate-300 dark:border-slate-700 w-[90px] shadow-md transition-colors text-center hidden md:table-cell">Posição</th>
              {filteredDays.map((day) => {
                const isSelected = selectedDayIdx === day.originalIdx;
                
                const dayWorkers = employees.filter(emp => {
                  if (emp.status !== 'active') return false;
                  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
                  const shift = (emp.shifts?.[monthKey] || [])[day.originalIdx] || 'F';
                  return shift === 'T' || shift === 'C';
                }).length;

                const isHoliday = day.isHoliday;
                const isSunday = day.isSunday;

                const heatmapClass = dayWorkers < 6 ? 'bg-rose-50 border-rose-200 text-rose-700' : 
                                     dayWorkers === 6 ? 'bg-amber-50 border-amber-200 text-amber-700' : 
                                     'bg-emerald-50 border-emerald-200 text-emerald-700';

                let baseClass = heatmapClass;
                if (isHoliday) baseClass = 'bg-rose-200 border-rose-300 text-rose-900 font-black';
                else if (isSunday) baseClass = 'bg-amber-200 border-amber-300 text-amber-900 font-black';

                const coverageMsg = dayWorkers < 6 ? 'Abaixo do ideal' : dayWorkers === 6 ? 'Ideal' : 'Alta cobertura';
                let tooltip = isHoliday ? day.holidayName : isSunday ? 'Domingo' : '';
                tooltip += tooltip ? ` | Cobertura: ${dayWorkers} (${coverageMsg})` : `Cobertura: ${dayWorkers} (${coverageMsg})`;

                return (
                  <th 
                    key={day.num} 
                    onClick={() => {
                      onSelectDay(day.originalIdx);
                      setManualDayType(null); // Reset manual choice when switching days
                    }} 
                    title={tooltip}
                    className={`p-2 text-center min-w-[64px] cursor-pointer transition-all border-r border-b relative ${
                      isSelected 
                        ? 'bg-orange-500 text-white shadow-lg z-10' 
                        : baseClass
                    } ${day.isPast ? 'opacity-50 grayscale-[0.5]' : ''}`}
                  >
                    <div className="text-sm font-black">{day.num}</div>
                    <div className="text-[8px] font-bold opacity-60 uppercase">{day.weekday}</div>
                    <div className="text-[7px] font-black mt-0.5 opacity-40">{dayWorkers}</div>
                    {isHoliday && <div className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-bl-lg shadow-sm" />}
                    {isSelected && <div className="absolute inset-x-0 -bottom-px h-1 bg-white" />}
                  </th>
                );
              })}

            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {displayedEmployees.map((emp) => {
              const hour = getDayHour(emp, selectedDayIdx);
              const startHour = parseInt(hour.substring(0, 2));
              const shiftCategory = !hour ? 'none' : (startHour <= 10 ? 'abertura' : startHour <= 13 ? 'intermediario' : 'fechamento');
              const shiftRowClass = shiftCategory === 'abertura' ? 'bg-sky-50/50 dark:bg-sky-950/20' : 
                                  shiftCategory === 'intermediario' ? 'bg-amber-50/50 dark:bg-amber-950/20' : 
                                  shiftCategory === 'fechamento' ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : '';

              return (
              <tr key={emp.id} className={`group hover:bg-slate-50 transition-colors ${shiftRowClass}`}>
                <td className={`sticky left-0 z-20 p-3 pl-4 border-r border-b border-slate-200 w-[150px] shadow-md transition-colors ${shiftRowClass || 'bg-white dark:bg-slate-900'}`}>
                  <div className="flex flex-col truncate">
                    <span className="font-black text-[10px] uppercase truncate">{emp.name.split(' ')[0]}</span>
                    <span className="text-[7px] font-bold text-slate-400 uppercase">{emp.cargo}</span>
                  </div>
                </td>
                <td className={`sticky left-[150px] z-20 p-2 border-r border-b border-slate-200 w-[120px] shadow-md text-center transition-colors ${shiftRowClass || 'bg-white dark:bg-slate-900'} ${selectedDayIdx >= 0 ? 'bg-orange-50/50 dark:bg-orange-950/30' : ''}`}>
                   <select 
                    value={getDayHour(emp, selectedDayIdx)}
                    onChange={(e) => onUpdateEmployeeDailyHour(emp.id, selectedDayIdx, e.target.value)}
                    className={`bg-transparent w-full text-[10px] font-black focus:ring-0 border-none p-0 cursor-pointer outline-none ${getShiftTextColor(getDayHour(emp, selectedDayIdx))}`}
                  >
                    {availableHours.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </td>
                <td className={`sticky left-[270px] z-20 p-2 border-r border-b border-slate-200 w-[90px] shadow-md text-center transition-colors hidden md:table-cell ${shiftRowClass || 'bg-white dark:bg-slate-900'}`}>
                   <select 
                    value={emp.preferredPositions?.[0] || emp.tacticalPosition || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const prefs = [...(emp.preferredPositions || [])];
                      if (val === '') {
                        prefs.splice(0, 1);
                      } else {
                        prefs[0] = val;
                      }
                      onUpdateEmployee?.(emp.id, { preferredPositions: prefs.filter(Boolean), tacticalPosition: val || undefined });
                    }}
                    className="bg-transparent w-full text-[10px] font-black focus:ring-0 border-none p-0 cursor-pointer outline-none text-slate-600"
                  >
                    <option value="">⚡ Auto</option>
                    <option value="P1">P1 🟦</option>
                    <option value="P2">P2 🟩</option>
                    <option value="P3">P3 🟧</option>
                    <option value="P4">P4 🟪</option>
                    <option value="P5+">P5+ ⬜</option>
                    <option value="Estoque">📦 Estoque</option>
                  </select>
                </td>
                {filteredDays.map((day) => {
                  const shift = getDayShift(emp, day.originalIdx);
                  const isLocked = isDayLocked(day.originalIdx);
                  const isSelectedColumn = selectedDayIdx === day.originalIdx;

                  return (
                    <td 
                      key={day.num} 
                      onClick={() => {
                        onSelectDay(day.originalIdx);
                        setManualDayType(null); // Reset when clicking column
                        if (isZenMode && !isEditable) onOpenDayDetail(day.originalIdx);
                      }} 
                      className={`p-3 text-center border-r border-b border-slate-50 relative transition-all duration-200 ${
                        isSelectedColumn ? 'bg-orange-50 dark:bg-orange-950/20 ring-1 ring-inset ring-orange-200/50 dark:ring-orange-800/30 z-10' : ''
                      } ${isZenMode ? 'cursor-pointer' : ''} ${day.isPast ? 'opacity-40 grayscale-[0.5]' : ''}`}
                    >
                        <div className={`mx-auto w-8 h-8 flex items-center justify-center rounded-lg text-white font-black shadow-sm transform transition-all ${isSelectedColumn ? 'scale-110 shadow-sm' : ''} ${shift === 'T' ? 'bg-emerald-600' : shift === 'F' ? 'bg-slate-900' : shift.startsWith('FF') ? 'bg-rose-600' : shift === 'C' ? 'bg-blue-600' : shift === 'FE' ? 'bg-slate-400 opacity-60' : 'bg-slate-100 text-slate-400'}`}>
                           <span className={shift.startsWith('FF') ? 'text-[8px] leading-tight' : 'text-[10px]'}>
                               {shift.startsWith('FF') ? shift.replace(' ', '').split('/')[0] : shift}
                           </span>
                        </div>
                        {isEditable && !isLocked && shift !== 'FE' && (
                           <select value={shift.startsWith('FF') ? 'FF' : (shift as string)} onChange={(e) => handleShiftChange(emp.id, day.originalIdx, e.target.value as ShiftType)} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full">
                              <option value="T">T</option>
                              <option value="F">F</option>
                              <option value="C">C</option>
                              <option value="FF">FF</option>
                              <option value="FE">FE</option>
                           </select>
                        )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
