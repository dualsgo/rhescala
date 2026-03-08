
import React, { useState, useMemo } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, ShiftType, MonthYear, Holiday } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, buildHolidaySet, getNationalHolidays } from '../constants';
import { InconsistencyPanel } from './InconsistencyPanel';
import { AnalysisPanel } from './AnalysisPanel';

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
  const [allowRetroactive, setAllowRetroactive] = useState(false);
  const [isGridLocked, setIsGridLocked] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [filter, setFilter] = useState<'all' | 'sunday' | 'holiday' | 'week'>('all');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const { showDialog } = useDialog();


  const displayedEmployees = useMemo(() => {
    const shiftPriority: Record<string, number> = {
      'Abertura': 1,
      'Intermediário': 2,
      'Fechamento': 3
    };

    return [...employees]
      .filter(e => !e.isHidden)
      .sort((a, b) => {
        const pA = shiftPriority[a.shiftName] || 99;
        const pB = shiftPriority[b.shiftName] || 99;
        if (pA !== pB) return pA - pB;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
  }, [employees]);

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const daysInMonth = useMemo(() => {
    return new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  }, [currentMY.year, currentMY.month]);

  const holidaySet = useMemo(() => {
    const yearHolidays = customHolidays.filter(h => h?.date?.startsWith(`${currentMY.year}`));
    return buildHolidaySet(currentMY.year, yearHolidays);
  }, [currentMY.year, customHolidays]);

  const holidayNames = useMemo(() => {
    const nationals = getNationalHolidays(currentMY.year);
    const yearCustom = customHolidays.filter(h => h?.date?.startsWith(`${currentMY.year}`));
    const map: Record<string, string> = {};
    [...nationals, ...yearCustom].forEach(h => { if(h?.date) map[h.date] = h.name; });
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
      const isToday = (currentMY.year === currentYear && currentMY.month === currentMonth && (i + 1) === currentDay);
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;

      return {
        num: (i + 1).toString().padStart(2, '0'),
        weekday: weekdays[date.getDay()],
        isSunday: date.getDay() === 0,
        isSaturday: date.getDay() === 6,
        isHoliday: holidaySet.has(dateStr),
        holidayName: holidayNames[dateStr] || null,
        isPast,
        isToday,
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

  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  console.log('ShiftGrid render:', { monthKey, isEditable });

  const getDayShift = (emp: Employee, dayIdx: number) => {
    const day = days[dayIdx];
    if (!day) return 'F';
    if (emp.vacationStart && emp.vacationEnd) {
      if (day.dateStr >= emp.vacationStart && day.dateStr <= emp.vacationEnd) return 'FE';
    }
    const monthShifts = (emp.shifts || {})[monthKey] || [];
    return monthShifts[dayIdx] || 'F';
  };

  const isPastMonth = useMemo(() => {
    const todayLocal = new Date();
    return currentMY.year < todayLocal.getFullYear() || (currentMY.year === todayLocal.getFullYear() && currentMY.month < todayLocal.getMonth());
  }, [currentMY]);

  const onHandlePrevMonth = () => {
    const todayLocal = new Date();
    const isMinMonth = (currentMY.year < todayLocal.getFullYear()) || (currentMY.year === todayLocal.getFullYear() && currentMY.month <= todayLocal.getMonth());
    if (isMinMonth) {
      showDialog({ type: 'alert', message: 'Visualização restrita ao mês vigente em diante.' });
      return;
    }
    onPrevMonth();
  };

  const getDayHour = (emp: Employee, dayIdx: number): string => {
    const mHours = (emp.dailyHours || {})[monthKey] || [];
    return mHours[dayIdx] || emp.workPeriod || '';
  };

  const isBirthday = (emp: Employee, dayIdx: number) => {
    if (!emp.birthday) return false;
    const bDate = new Date(emp.birthday + 'T00:00:00');
    return bDate.getDate() === (dayIdx + 1) && bDate.getMonth() === currentMY.month;
  };

  const isDayLocked = (dayIdx: number) => {
    if (isGridLocked) return true;
    const day = days[dayIdx];
    if (!day) return true;
    const isPastOrToday = day.isPast || day.isToday;
    if (isPastOrToday && !allowRetroactive) return true;
    return false;
  };

  const handleToggleEditMode = async () => {
    if (isGridLocked) return;
    
    if (isEditable) {
      const confirmed = await showDialog({
        type: 'confirm',
        message: 'Deseja confirmar o salvamento das alterações?'
      });
      if (confirmed) {
        setIsEditable(false);
      }
    } else {
      setIsEditable(true);
    }
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
    onSelectDay(dayIdx);
  };

  const handleShiftChange = (empId: string, dayIdx: number, newShift: ShiftType) => {
    console.log('Applying shift change:', { empId, dayIdx, newShift, monthKey });
    onUpdateShift(empId, dayIdx, newShift);
    onSelectDay(dayIdx);
  };

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


  const selectedDay = days[selectedDayIdx] || days[0];
  const currentDayType = selectedDay?.isHoliday ? 'HOLIDAY' : selectedDay?.isSunday ? 'SUNDAY' : 'WEEKDAY';
  const availableHours = SHIFT_HOURS[currentDayType] || [];

  const getAvailableHolidayCredits = (emp: Employee) => {
    const yearHolidays = [...getNationalHolidays(currentMY.year), ...customHolidays.filter(h => h?.date?.startsWith(`${currentMY.year}`))];
    const earned: string[] = [];
    const spent: Set<string> = new Set();

    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0); // Normalized today for comparison

    const cutoffYear = todayLocal.getFullYear();
    const cutoffMonth = todayLocal.getMonth() + 1;

    const safeShifts = emp.shifts || {};
    Object.keys(safeShifts).forEach(mk => {
      const [y, m] = mk.split('-').map(Number);
      if (y < cutoffYear || (y === cutoffYear && m < cutoffMonth)) return;
      
      safeShifts[mk].forEach((s, idx) => {
        if (s && s.startsWith('FF ') && s.length > 3) {
          spent.add(s.replace('FF ', ''));
        }
      });
    });

    const viewedMonthEnd = new Date(currentMY.year, currentMY.month + 1, 0);
    viewedMonthEnd.setHours(23, 59, 59, 999);

    for (const h of yearHolidays) {
      const hDate = new Date(h.date + 'T00:00:00');
      const hY = hDate.getFullYear();
      const hM = hDate.getMonth() + 1;
      
      // Regel 1: Só ganha crédito se o feriado já PASSOU em tempo real
      if (hDate > todayLocal) continue;

      // Regel 2: Só exibe o alerta se o feriado é no mês sendo visualizado (ou anterior)
      if (hDate > viewedMonthEnd) continue;
      
      if (hY < cutoffYear || (hY === cutoffYear && hM < cutoffMonth)) continue;

      const hMK = `${hY}-${String(hM).padStart(2, '0')}`;
      const hDayIdx = hDate.getDate() - 1;
      
      const empShifts = (emp.shifts || {})[hMK] || [];
      if (empShifts[hDayIdx] === 'T' || empShifts[hDayIdx] === 'C') {
        const creditLabel = `${String(hDate.getDate()).padStart(2, '0')}/${String(hDate.getMonth() + 1).padStart(2, '0')}`;
        if (!spent.has(creditLabel)) {
          earned.push(creditLabel);
        }
      }
    }
    return earned;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col w-full animate-fade-in">
      {/* Top Nav */}
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/30">
        <div className="flex items-center gap-6">
            <div className={`w-12 h-12 ${isPastMonth ? 'bg-slate-100 text-slate-400' : 'bg-orange-100 text-orange-600'} rounded-2xl flex items-center justify-center shadow-sm`}>
                <Icon name="calendar_month" className="text-2xl" fill />
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    {months[currentMY.month]}
                    <span className="text-orange-500">{currentMY.year}</span>
                    {isPastMonth && <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full uppercase ml-2 tracking-widest font-black">Histórico</span>}
                </h2>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Gestão de Escala Operacional {isPastMonth ? '· Visualização N/A' : ''}</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            {/* Month selector */}
            <div className="flex items-center bg-white border border-slate-200 shadow-sm rounded-xl p-1 gap-1">
                <button onClick={onHandlePrevMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-orange-500">
                    <Icon name="chevron_left" />
                </button>
                <div className="px-4 text-[11px] font-black text-slate-700 uppercase tracking-widest min-w-[130px] text-center">
                    {months[currentMY.month]}
                </div>
                <button onClick={onNextMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-orange-500">
                    <Icon name="chevron_right" />
                </button>
            </div>
            
            <button 
              onClick={() => setShowAnalysis(true)} 
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-extrabold hover:bg-slate-800 shadow-lg active:scale-95 transition-all"
            >
                <Icon name="analytics" className="text-sm" /> Painel de Análise
            </button>
            <InconsistencyPanel
              employees={employees}
              currentMY={currentMY}
              onSelectDay={onSelectDay}
              onApplyFix={(empId, dayIdx, nextShift) => {
                onUpdateShift(empId, dayIdx, nextShift);
                onSelectDay(dayIdx);
              }}
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

        {showAnalysis && (
          <AnalysisPanel 
            employees={employees} 
            currentMY={currentMY} 
            customHolidays={customHolidays}
            onClose={() => setShowAnalysis(false)} 
          />
        )}
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

        <div className="flex items-center gap-3">
          <button 
            onClick={handleToggleEditMode} 
            disabled={isGridLocked}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-extrabold transition-all border ${isGridLocked ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : isEditable ? 'bg-orange-500 text-white border-orange-500' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            <Icon name={isEditable ? 'check_circle' : 'edit_square'} className="text-sm" />
            {isEditable ? 'Salvar Alterações' : 'Ativar Edições'}
          </button>

          {isEditable && (
            <button
              onClick={() => setAllowRetroactive(!allowRetroactive)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-extrabold transition-all border ${allowRetroactive ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
              title="Permitir edição de dias passados e hoje"
            >
              <Icon name={allowRetroactive ? 'history_toggle_off' : 'history'} className="text-sm" />
              {allowRetroactive ? 'Bloquear Retroativo' : 'Liberar Retroativo'}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1400px]">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest border-b border-slate-200">
              <th className="sticky left-0 z-30 bg-slate-50 p-2 pl-4 border-r border-slate-100 min-w-[150px] w-[150px] max-w-[150px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Colaborador</th>
              <th className="sticky left-[150px] z-30 bg-slate-50 p-2 border-r border-slate-100 min-w-[130px] w-[130px] max-w-[130px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Horário (Dia {(days[selectedDayIdx] || days[0])?.num})</th>
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
            {displayedEmployees.map((emp) => (
              <tr key={emp.id} className={`group hover:bg-slate-50/50 transition-colors ${emp.isHidden ? 'hidden' : ''}`}>
                <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 p-2 pl-4 border-r border-slate-100 min-w-[150px] w-[150px] max-w-[150px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                  <div className="flex flex-col truncate">
                    <span className={`font-extrabold text-[11px] uppercase tracking-tight truncate ${getShiftTextColor(getDayHour(emp, selectedDayIdx))}`} title={emp.name}>
                      {emp.name}
                    </span>
                    {emp.isYoungApprentice && <span className="text-[8px] font-extrabold text-teal-600 uppercase tracking-widest mt-0.5 truncate uppercase">Jovem Aprendiz</span>}
                    {getAvailableHolidayCredits(emp).length > 0 && (
                      <span 
                        className="flex items-center gap-1 text-[7px] font-extrabold text-rose-500 uppercase tracking-wider mt-0.5 animate-pulse"
                        title={`Feriados pendentes de: ${getAvailableHolidayCredits(emp).join(', ')}`}
                      >
                        <Icon name="event_repeat" className="text-[10px]" /> 
                        {getAvailableHolidayCredits(emp).length} Pendente ({getAvailableHolidayCredits(emp).join(', ')})
                      </span>
                    )}
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
                    {getDayHour(emp, selectedDayIdx) && !availableHours.includes(getDayHour(emp, selectedDayIdx)) && <option value={getDayHour(emp, selectedDayIdx)}>{getDayHour(emp, selectedDayIdx)}</option>}
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

                      <div className="relative inline-block w-8 h-8">
                        <div 
                          className={`absolute inset-0 flex items-center justify-center rounded-lg text-white text-[10px] font-extrabold shadow-sm transition-all pointer-events-none z-10 ${
                            isLocked ? 'opacity-90 grayscale-[0.3]' : ''
                          } ${
                            shift === 'T' ? 'bg-sky-600' : 
                            shift === 'F' ? 'bg-orange-500' : 
                            shift.startsWith('FF') ? 'bg-red-500' : 
                            shift === 'C' ? 'bg-teal-500' : 
                            shift === 'N/A' ? 'bg-slate-300' : 'bg-indigo-600'
                          }`}
                        >
                          {isBirthday(emp, day.originalIdx) ? '🎂' : shift}
                        </div>
                      </div>

                        {isEditable && !isLocked && shift !== 'FE' && (
                          <select
                            value={shift}
                            onChange={(e) => {
                               handleShiftChange(emp.id, day.originalIdx, e.target.value as ShiftType);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                            title="Alterar status"
                          >
                          <option value="T">T - Trabalho</option>
                          <option value="F">F - Folga</option>
                          {emp.shifts && getAvailableHolidayCredits(emp).map(credit => (
                             <option key={credit} value={`FF ${credit}`}>FF {credit} - Folga Feriado</option>
                          ))}
                          {shift && shift.startsWith('FF ') && !getAvailableHolidayCredits(emp).includes(shift.replace('FF ', '')) && (
                             <option value={shift}>{shift} - Folga Feriado (Usado)</option>
                          )}
                          <option value="C">C - Curso</option>
                        </select>
                      )}
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
