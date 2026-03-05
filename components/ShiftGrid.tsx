
import React, { useState, useMemo } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, ShiftType, MonthYear, Holiday } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, buildHolidaySet, getNationalHolidays } from '../constants';
import { InconsistencyPanel } from './InconsistencyPanel';

interface ShiftGridProps {
  employees: Employee[];
  currentMY: MonthYear;
  selectedDayIdx: number;
  today: Date;
  customHolidays: Holiday[];
  onSelectDay: (idx: number) => void;
  onUpdateShift: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateEmployeeDailyHour: (empId: string, dayIdx: number, newHour: string) => void;
  onShareWhatsApp: (dayIdx: number) => void;

  onResetMonth: () => void;
  onShowHolidayManager: () => void;
  onNextMonth: () => void;
  onPrevMonth: () => void;
}

export const ShiftGrid: React.FC<ShiftGridProps> = ({
  employees,
  currentMY,
  selectedDayIdx,
  today,
  customHolidays,
  onSelectDay,
  onUpdateShift,
  onUpdateEmployeeDailyHour,
  onShareWhatsApp,
  onResetMonth,
  onShowHolidayManager,
  onNextMonth,
  onPrevMonth,
}) => {
  const [isEditable, setIsEditable] = useState(false);
  const [isGridLocked, setIsGridLocked] = useState(false);
  const [filter, setFilter] = useState<'all' | 'sunday' | 'holiday' | 'week'>('all');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const { showDialog } = useDialog();

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const daysInMonth = useMemo(() => {
    const date = new Date(currentMY.year, currentMY.month + 1, 0);
    return date.getDate();
  }, [currentMY]);

  const holidaySet = useMemo(() => {
    const yearHolidays = customHolidays.filter(h => h.date.startsWith(`${currentMY.year}`));
    return buildHolidaySet(currentMY.year, yearHolidays);
  }, [currentMY.year, customHolidays]);

  const holidayNames = useMemo(() => {
    const nationals = getNationalHolidays(currentMY.year);
    const yearCustom = customHolidays.filter(h => h.date.startsWith(`${currentMY.year}`));
    const map: Record<string, string> = {};
    [...nationals, ...yearCustom].forEach(h => { map[h.date] = h.name; });
    return map;
  }, [currentMY.year, customHolidays]);

  const days = useMemo(() => {
    const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(currentMY.year, currentMY.month, i + 1);
      const isPast = (currentMY.year < currentYear) ||
                     (currentMY.year === currentYear && currentMY.month < currentMonth) ||
                     (currentMY.year === currentYear && currentMY.month === currentMonth && (i + 1) < currentDay);
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;

      return {
        num: (i + 1).toString().padStart(2, '0'),
        weekday: weekdays[date.getDay()],
        isSunday: date.getDay() === 0,
        isSaturday: date.getDay() === 6,
        isHoliday: holidaySet.has(dateStr),
        holidayName: holidayNames[dateStr] || null,
        isPast,
        dateStr,
      };
    });
  }, [currentMY, daysInMonth, today, holidaySet, holidayNames]);

  const weeksInMonth = useMemo(() => {
    return Math.ceil(daysInMonth / 7);
  }, [daysInMonth]);

  const filteredDays = useMemo(() => {
    if (filter === 'sunday') return days.map((d, i) => ({ ...d, originalIdx: i })).filter(d => d.isSunday);
    if (filter === 'holiday') return days.map((d, i) => ({ ...d, originalIdx: i })).filter(d => d.isHoliday);
    if (filter === 'week') {
      const start = (selectedWeek - 1) * 7;
      const end = Math.min(start + 7, daysInMonth);
      return days.slice(start, end).map((d, i) => ({ ...d, originalIdx: start + i }));
    }
    return days.map((d, i) => ({ ...d, originalIdx: i }));
  }, [days, filter, selectedWeek, daysInMonth]);

  const monthKey = `${currentMY.year}-${currentMY.month.toString().padStart(2, '0')}`;

  const getDayShift = (emp: Employee, dayIdx: number) => {
    const day = days[dayIdx];
    if (emp.vacationStart && emp.vacationEnd) {
      if (day.dateStr >= emp.vacationStart && day.dateStr <= emp.vacationEnd) return 'FE';
    }
    const monthShifts = emp.shifts[monthKey] || [];
    return monthShifts[dayIdx] || 'F';
  };

  const getDayHour = (emp: Employee, dayIdx: number) => {
    const monthDailyHours = emp.dailyHours[monthKey] || [];
    return monthDailyHours[dayIdx] || emp.workPeriod;
  };

  const isDayLocked = (dayIdx: number) => {
    return isGridLocked;
  };

  const handleToggleLock = async () => {
    if (isGridLocked) {
      const confirmation = await showDialog({
        type: 'prompt',
        message: 'Para desbloquear as edições, digite "CONFIRMO":',
      });
      if (confirmation === 'CONFIRMO') {
        setIsGridLocked(false);
      } else if (confirmation !== null) {
        await showDialog({
          type: 'alert',
          message: 'Código incorreto. A escala permanece bloqueada.'
        });
      }
    } else {
      const confirmed = await showDialog({
        type: 'confirm',
        message: 'Deseja bloquear as edições desta escala?'
      });
      if (confirmed) {
        setIsGridLocked(true);
        setIsEditable(false);
      }
    }
  };

  const isEarlyDayOff = (emp: Employee, dayIdx: number) => {
    // If the person is off today, check if they *could* have worked instead
    // (i.e. did they have another day off in the 6 preceding days?)
    if (getDayShift(emp, dayIdx) !== 'F') return false;
    
    // Look back up to 6 days
    for (let i = 1; i <= 6; i++) {
      const prevIdx = dayIdx - i;
      if (prevIdx < 0) break;
      if (getDayShift(emp, prevIdx) === 'F' || getDayShift(emp, prevIdx) === 'FF') {
        return true; // Had another day off recently, so this one is technically early/removable
      }
    }
    return false;
  };

  const isSuggestedWorkDay = (emp: Employee, dayIdx: number) => {
    // If the person is working today, check if they've worked 6 consecutive days
    // In that case, this day is "suggested" as a rest day (6x1 rule)
    const shift = getDayShift(emp, dayIdx);
    if (shift === 'F' || shift === 'FF' || shift === 'FE') return false;

    let consecutiveWork = 0;
    for (let i = 1; i <= 6; i++) {
      const prevIdx = dayIdx - i;
      if (prevIdx < 0) break;
      const prevShift = getDayShift(emp, prevIdx);
      if (prevShift === 'T' || prevShift === 'C' || prevShift === 'FF') {
        consecutiveWork++;
      } else {
        break;
      }
    }
    return consecutiveWork >= 6;
  };

  const handleCellClick = (empId: string, dayIdx: number) => {
    if (isDayLocked(dayIdx)) {
        return;
    }
    
    if (!isEditable) {
        onSelectDay(dayIdx);
        return;
    }

    const emp = employees.find(e => e.id === empId);
    if (!emp || getDayShift(emp, dayIdx) === 'FE') return;

    const current = getDayShift(emp, dayIdx);
    const cycle: Record<ShiftType, ShiftType> = { 'T': 'F', 'F': 'FF', 'FF': 'C', 'C': 'T', 'FE': 'FE' };
    const nextShift = cycle[current as ShiftType] || 'T';

    onUpdateShift(empId, dayIdx, nextShift);
    onSelectDay(dayIdx);
  };

  const getShiftTextColor = (hour: string) => {
    if (hour.includes('10h')) return 'text-orange-600'; 
    if (hour.includes('12h')) return 'text-sky-600'; 
    if (hour.includes('13h40')) return 'text-indigo-600'; 
    return 'text-slate-900';
  };

  const selectedDay = days[selectedDayIdx];
  const currentDayType = selectedDay.isHoliday ? 'HOLIDAY' : selectedDay.isSunday ? 'SUNDAY' : 'WEEKDAY';
  const availableHours = SHIFT_HOURS[currentDayType];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col w-full animate-fade-in">
      {/* Top Nav */}
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 relative">
        <div className="flex items-center gap-3">
          <button onClick={onPrevMonth} className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all text-slate-600"><Icon name="chevron_left" /></button>
          <div className="bg-white px-6 py-2 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight">{months[currentMY.month]} {currentMY.year}</h3>
          </div>
          <button onClick={onNextMonth} className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all text-slate-600"><Icon name="chevron_right" /></button>
        </div>
        
        <div className="flex items-center gap-2">
            <InconsistencyPanel
              employees={employees}
              currentMY={currentMY}
              onSelectDay={onSelectDay}
              onApplyFix={(empId, dayIdx, shift) => onUpdateShift(empId, dayIdx, shift)}
            />
            <button 
              onClick={handleToggleLock} 
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all border ${isGridLocked ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
                <Icon name={isGridLocked ? 'lock' : 'lock_open'} className="text-sm" /> 
                {isGridLocked ? 'Escala Bloqueada' : 'Bloquear Escala'}
            </button>
            <button onClick={onShowHolidayManager} className="flex items-center gap-2 px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-lg text-xs font-extrabold hover:bg-rose-50 transition-all">
                <Icon name="event_busy" className="text-sm" /> Feriados
            </button>
            <button onClick={onResetMonth} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-extrabold hover:bg-orange-600 shadow-sm transition-all">
                <Icon name="sync" className="text-sm" /> Atualizar Mês
            </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between bg-white sticky top-0 z-30 gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-md text-[11px] font-extrabold transition-all ${filter === 'all' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>Mês Inteiro</button>
            <button onClick={() => setFilter('sunday')} className={`px-4 py-1.5 rounded-md text-[11px] font-extrabold transition-all ${filter === 'sunday' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>Somente Domingos</button>
            <button onClick={() => setFilter('holiday')} className={`px-4 py-1.5 rounded-md text-[11px] font-extrabold transition-all ${filter === 'holiday' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>Visão Feriados</button>
            <button
              onClick={() => { setFilter('week'); setSelectedWeek(1); }}
              className={`px-4 py-1.5 rounded-md text-[11px] font-extrabold transition-all ${filter === 'week' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
            >Por Semana</button>
          </div>

          {filter === 'week' && (
            <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 p-1 rounded-lg animate-fade-in">
              <span className="text-[10px] font-extrabold text-orange-400 uppercase tracking-widest px-2">Sem.</span>
              {Array.from({ length: weeksInMonth }, (_, i) => {
                const weekNum = i + 1;
                const startDay = (weekNum - 1) * 7 + 1;
                const endDay = Math.min(weekNum * 7, daysInMonth);
                return (
                  <button
                    key={weekNum}
                    onClick={() => setSelectedWeek(weekNum)}
                    title={`Dias ${startDay}–${endDay}`}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-extrabold transition-all ${
                      selectedWeek === weekNum
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-orange-600 hover:bg-orange-100'
                    }`}
                  >
                    {startDay}–{endDay}
                  </button>
                );
              })}
            </div>
          )}
          
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 p-1 rounded-lg">
             <select 
               value={selectedDayIdx} 
               onChange={(e) => onSelectDay(parseInt(e.target.value))}
               className="bg-transparent text-[11px] font-extrabold text-green-700 focus:ring-0 border-none py-1 pl-2 outline-none"
             >
               {days.map((d, i) => <option key={i} value={i}>Dia {d.num} ({d.weekday})</option>)}
             </select>
             <button onClick={() => onShareWhatsApp(selectedDayIdx)} className="px-4 py-1.5 bg-green-600 text-white rounded-md text-[11px] font-extrabold hover:bg-green-700 transition-all flex items-center gap-2">
               <Icon name="send" className="text-[14px]" /> Enviar WhatsApp
             </button>
          </div>
        </div>

        <button 
          onClick={() => !isGridLocked && setIsEditable(!isEditable)} 
          disabled={isGridLocked}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-extrabold transition-all border ${isGridLocked ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : isEditable ? 'bg-orange-500 text-white border-orange-500' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
        >
          <Icon name={isEditable ? 'check_circle' : 'edit_square'} className="text-sm" />
          {isEditable ? 'Salvar Alterações' : 'Modo de Edição'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1400px]">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest border-b border-slate-200">
              <th className="sticky left-0 z-30 bg-slate-50 p-2 pl-4 border-r border-slate-100 min-w-[150px] w-[150px] max-w-[150px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Colaborador</th>
              <th className="sticky left-[150px] z-30 bg-slate-50 p-2 border-r border-slate-100 min-w-[130px] w-[130px] max-w-[130px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Horário (Dia {days[selectedDayIdx].num})</th>
              {filteredDays.map((day) => (
                <th
                  key={day.num}
                  onClick={() => onSelectDay(day.originalIdx)}
                  title={day.holidayName || undefined}
                  className={`p-3 text-center min-w-[62px] cursor-pointer transition-colors relative border-r border-slate-100/50 ${
                    selectedDayIdx === day.originalIdx ? 'bg-orange-100/50 ring-2 ring-inset ring-orange-400' : ''
                  } ${
                    day.isHoliday ? 'bg-rose-50/60' : day.isSunday ? 'bg-orange-50/40' : day.isSaturday ? 'bg-slate-50/80' : ''
                  }`}
                >
                  {(day.isSunday || day.isHoliday) && <div className={`absolute inset-0 border-2 pointer-events-none opacity-40 ${day.isHoliday ? 'border-rose-400' : 'border-orange-400'}`}></div>}
                  {day.isHoliday && <div className="absolute top-0 right-0 w-0 h-0 border-t-[8px] border-r-[8px] border-t-rose-500 border-r-transparent" title={day.holidayName || ''}></div>}
                  <div className={`text-sm font-extrabold ${
                    day.isHoliday ? 'text-rose-600' : day.isSunday ? 'text-orange-600' : day.isSaturday ? 'text-slate-500' : 'text-slate-900'
                  }`}>{day.num}</div>
                  <div className="text-[9px] font-bold opacity-60">{day.weekday}</div>
                  {day.isHoliday && day.holidayName && (
                    <div className="text-[7px] font-extrabold text-rose-500 leading-tight mt-0.5 truncate max-w-[56px] mx-auto" title={day.holidayName}>
                      {day.holidayName.split(' ').slice(0, 2).join(' ')}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((emp) => (
              <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 p-2 pl-4 border-r border-slate-100 min-w-[150px] w-[150px] max-w-[150px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                  <div className="flex flex-col truncate">
                    <span className={`font-extrabold text-[11px] uppercase tracking-tight truncate ${getShiftTextColor(getDayHour(emp, selectedDayIdx))}`} title={emp.name}>
                      {emp.name}
                    </span>
                    {emp.isYoungApprentice && <span className="text-[8px] font-extrabold text-teal-600 uppercase tracking-widest mt-0.5 truncate">Jovem Aprendiz</span>}
                  </div>
                </td>
                <td className="sticky left-[150px] z-20 bg-slate-50 group-hover:bg-slate-100 p-2 border-r border-slate-100 min-w-[130px] w-[130px] max-w-[130px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                  <select 
                    value={getDayHour(emp, selectedDayIdx)}
                    disabled={isDayLocked(selectedDayIdx)}
                    onChange={(e) => onUpdateEmployeeDailyHour(emp.id, selectedDayIdx, e.target.value)}
                    className={`bg-transparent w-full text-[11px] font-extrabold focus:ring-0 border-none p-0 cursor-pointer outline-none transition-colors ${getShiftTextColor(getDayHour(emp, selectedDayIdx))} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {availableHours.map(h => <option key={h} value={h}>{h}</option>)}
                    {!availableHours.includes(getDayHour(emp, selectedDayIdx)) && <option value={getDayHour(emp, selectedDayIdx)}>{getDayHour(emp, selectedDayIdx)}</option>}
                  </select>
                </td>
                {filteredDays.map((day) => {
                  const shift = getDayShift(emp, day.originalIdx);
                  const isLocked = isDayLocked(day.originalIdx);
                  const isWarningOff = isEarlyDayOff(emp, day.originalIdx); // Had another Folga within 6 days
                  const isSuggestedWork = isSuggestedWorkDay(emp, day.originalIdx);
                  
                  return (
                    <td 
                      key={day.num} 
                      onClick={() => handleCellClick(emp.id, day.originalIdx)}
                      className={`p-2 text-center relative border-r border-slate-100/50 transition-all ${
                        isEditable && !isLocked && shift !== 'FE' ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default'
                      } ${selectedDayIdx === day.originalIdx ? 'bg-orange-50/50' : ''} ${day.isHoliday ? 'bg-rose-50/20' : day.isSunday ? 'bg-orange-50/10' : ''}`}
                    >
                      {(day.isSunday || day.isHoliday) && <div className={`absolute inset-y-0 left-0 right-0 border-x-2 pointer-events-none opacity-10 ${day.isHoliday ? 'border-rose-400' : 'border-orange-400'}`}></div>}
                      
                      {/* Suggestion / Warning Markers */}
                      {isWarningOff && (
                        <div className="absolute inset-0 border-2 border-dashed border-red-400/60 rounded-lg pointer-events-none m-0.5 animate-pulse" title="Folga potencialmente removível (escala 6x1 ainda não completa)"></div>
                      )}
                      {isSuggestedWork && shift !== 'F' && shift !== 'FF' && shift !== 'FE' && (
                        <div className="absolute inset-0 border-2 border-dashed border-teal-400/30 rounded-lg pointer-events-none m-1"></div>
                      )}

                      <div 
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-white text-[10px] font-extrabold shadow-sm transition-all pointer-events-none relative z-10 ${
                          isLocked ? 'opacity-90 grayscale-[0.3]' : ''
                        } ${
                          shift === 'T' ? 'bg-sky-600' : 
                          shift === 'F' ? 'bg-orange-500' : 
                          shift === 'FF' ? 'bg-red-500' : 
                          shift === 'C' ? 'bg-teal-500' : 'bg-indigo-600'
                        }`}
                      >
                        {shift}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Footer Info */}
      <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex flex-wrap gap-6 items-center">
         <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-sky-600"></div> <span className="text-[10px] font-extrabold text-slate-500 uppercase">Trabalho</span></div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-orange-500"></div> <span className="text-[10px] font-extrabold text-slate-500 uppercase">Folga</span></div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500"></div> <span className="text-[10px] font-extrabold text-slate-500 uppercase">Feriado</span></div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-teal-500"></div> <span className="text-[10px] font-extrabold text-slate-500 uppercase">Curso</span></div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-indigo-600"></div> <span className="text-[10px] font-extrabold text-slate-500 uppercase">Férias</span></div>
         <div className="ml-4 flex items-center gap-2"><div className="w-3 h-3 rounded border-2 border-dashed border-teal-400"></div> <span className="text-[10px] font-extrabold text-slate-500 uppercase">Sugerido p/ Folga (6x1)</span></div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 rounded border-2 border-dashed border-red-500 animate-pulse"></div> <span className="text-[10px] font-extrabold text-rose-600 uppercase">Alerta: Excesso de Folga</span></div>
         <div className="ml-auto flex items-center gap-2 opacity-60">
            <Icon name={isGridLocked ? 'lock' : 'lock_open'} className="text-xs" />
            <span className="text-[10px] font-bold text-slate-400">
              {isGridLocked ? 'Escala bloqueada para edições' : 'Edições liberadas (use o Modo de Edição)'}
            </span>
         </div>
      </div>
    </div>
  );
};
