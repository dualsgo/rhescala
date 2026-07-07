
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, ShiftType, MonthYear, Holiday, JornadaSettings } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, buildHolidaySet, getNationalHolidays, getDefaultHourForDay } from '../constants';
import { getShiftClassification, isWorkingShift } from '../hooks/useScheduleEngine';
import { OperationalGuideModal } from './OperationalGuideModal';

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
  onFilterChange: (f: 'all' | 'sunday' | 'holiday' | 'week') => void;
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
  onFilterChange,
  onOpenEmployeeCard,
}) => {
  const { showDialog } = useDialog();
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const [hasScrolled, setHasScrolled] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Auto-scroll to today on mount or when month changes to current month
  useEffect(() => {
    const todayDate = new Date();
    const isCurrentMonth = currentMY.year === todayDate.getFullYear() && currentMY.month === todayDate.getMonth();
    
    if (isCurrentMonth && scrollContainerRef.current) {
      const todayDay = todayDate.getDate();
      if (todayDay > 1) {
        // Approximate day column width (min-w-60 is 60px) + some padding
        const colWidth = 60;
        const scrollPos = (todayDay - 1) * colWidth;
        
        // Use a small timeout to ensure layout is ready
        const timeout = setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
              left: scrollPos,
              behavior: 'smooth'
            });
            setHasScrolled(true);
          }
        }, 500);
        return () => clearTimeout(timeout);
      }
    }
  }, [currentMY.month, currentMY.year]);

  const legendItems = [
    { code: 'F', label: 'Folga Comum', color: 'bg-rose-500' },
    { code: 'FF', label: 'Folga de Feriado', color: 'bg-amber-500' },
    { code: 'FE', label: 'Férias', color: 'bg-emerald-500' },
    { code: 'DO', label: 'Aniversário / Especial', color: 'bg-fuchsia-600' },
    { code: 'C', label: 'Curso / Treinamento', color: 'bg-slate-500' },
    { code: 'AT', label: 'Atestado Médico', color: 'bg-rose-400' },
  ];

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

  const filteredDays = useMemo(() => {
    if (filter === 'sunday') return days.filter(d => d.isSunday);
    if (filter === 'holiday') return days.filter(d => d.isHoliday);
    return days;
  }, [days, filter]);

  return (
    <div className="flex flex-col gap-4 relative h-full">
      {/* Top Controls: Exibir + Group Filters + Legend */}
      <div className="flex flex-col gap-2">
        {isReadOnly && (
          <button 
            onClick={() => setShowGuideModal(true)}
            className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-95 animate-in fade-in"
          >
            <Icon name="menu_book" className="text-xl animate-pulse" />
            <span className="font-black uppercase tracking-widest text-sm text-center">📖 Manual de Boas Práticas da Loja</span>
          </button>
        )}
        <div className="flex flex-wrap items-center gap-2">
            {/* Period Filters */}
            <div className="flex items-center bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 p-1 rounded-xl shadow-sm w-full md:w-auto">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 hidden sm:block whitespace-nowrap">Exibir:</span>
              <div className="flex items-center w-full md:w-auto">
                {[
                  { id: 'all', label: 'Mês' },
                  { id: 'sunday', label: 'Domingos' },
                  { id: 'holiday', label: 'Feriados' },
                  { id: 'week', label: 'Semana', mobileHidden: true }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => onFilterChange(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex-1 md:flex-none text-center ${f.mobileHidden ? 'hidden sm:block' : ''} ${filter === f.id ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Group Filters */}
            <div className="flex items-center bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 p-1 rounded-xl shadow-sm w-full md:w-auto">
               <div className="hidden sm:flex items-center">
                  <button 
                    onClick={() => setSelectedGroup(null)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${!selectedGroup ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                  >
                    Todos
                  </button>
                  {['Abertura', 'Intermediário', 'Fechamento', 'Folgas/Outros'].map(group => (
                    <button 
                      key={group}
                      onClick={() => setSelectedGroup(group)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedGroup === group ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      {group}
                    </button>
                  ))}
               </div>
               
               <div className="flex sm:hidden w-full items-center">
                 <div className="relative w-full">
                   <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none text-orange-500">
                     <Icon name="filter_list" className="text-sm" />
                   </div>
                   <select 
                     value={selectedGroup || ''} 
                     onChange={(e) => setSelectedGroup(e.target.value || null)}
                     className="w-full bg-transparent border-none py-1.5 pl-8 pr-4 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-0 appearance-none text-slate-700 dark:text-slate-300"
                   >
                     <option value="">Grupo: Todos</option>
                     <option value="Abertura">Abertura</option>
                     <option value="Intermediário">Intermediário</option>
                     <option value="Fechamento">Fechamento</option>
                     <option value="Folgas/Outros">Folgas / Outros</option>
                   </select>
                   <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-slate-400">
                     <Icon name="expand_more" className="text-sm" />
                   </div>
                 </div>
               </div>
            </div>
            
            {/* Legend Component */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-sm w-full xl:w-auto">
              <button 
                onClick={() => setShowLegend(!showLegend)} 
                className="flex items-center justify-between sm:justify-start w-full sm:w-auto sm:pr-3 sm:border-r border-slate-100 dark:border-zinc-800 py-0.5"
              >
                <div className="flex items-center gap-1.5">
                  <Icon name="info" className="text-orange-500 text-[14px]" />
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Legenda</span>
                </div>
                <Icon name={showLegend ? 'expand_less' : 'expand_more'} className="text-slate-400 sm:hidden text-[14px]" />
              </button>
              
              <div className={`${showLegend ? 'flex' : 'hidden'} sm:flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 sm:mt-0 pb-1 sm:pb-0 w-full sm:w-auto`}>
                {legendItems.map(item => (
                  <div key={item.code} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight whitespace-nowrap">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden xl:flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase bg-white dark:bg-black px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm ml-auto">
              <Icon name="mouse" className="text-orange-500 text-[12px]" /> Clique no nome p/ ver escala
            </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="bg-white dark:bg-black rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden flex-1 flex flex-col relative">
        {/* Scroll Indicator Hint */}
        {!hasScrolled && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 pointer-events-none animate-pulse-subtle bg-orange-500/90 text-white px-3 py-2 rounded-xl flex items-center gap-2 shadow-lg lg:hidden">
             <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Deslize para ver mais</span>
             <Icon name="arrow_forward" className="text-sm animate-bounce-x" />
          </div>
        )}
        
        <div 
          ref={scrollContainerRef}
          className="overflow-auto custom-scrollbar flex-1"
          onScroll={(e) => {
            if (!hasScrolled && e.currentTarget.scrollLeft > 10) setHasScrolled(true);
          }}
        >
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-40 bg-slate-50 dark:bg-zinc-900">
              <tr className="bg-slate-50 dark:bg-zinc-900/50">
                <th className="sticky left-0 z-[50] bg-slate-50 dark:bg-zinc-900 border-b border-r border-slate-200 dark:border-zinc-800 py-2 px-2 sm:px-4 text-left min-w-[120px] sm:min-w-[180px] w-[120px] sm:w-[180px] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-4px_rgba(0,0,0,0.5)]">
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</span>
                </th>
                {!isReadOnly && isEditable && (
                  <>
                    <th className="hidden sm:table-cell sticky left-[180px] z-[50] bg-slate-50 dark:bg-zinc-900 border-b border-r border-slate-200 dark:border-zinc-800 py-2 px-4 text-left min-w-[125px] w-[125px]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário</span>
                    </th>
                    <th className="hidden md:table-cell sticky left-[305px] z-[50] bg-slate-50 dark:bg-zinc-900 border-b border-r border-slate-200 dark:border-zinc-800 py-2 px-4 text-left min-w-[100px] w-[100px]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posição</span>
                    </th>
                  </>
                )}
                {filteredDays.map(d => {
                  const dayIdx = d.num - 1;
                  const stats = employees.reduce((acc, emp) => {
                    if (emp.isHidden || emp.status !== 'active') return acc;
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
                      className={`p-3 border-b border-slate-200 dark:border-zinc-800 min-w-[60px] cursor-pointer transition-all ${dimClass} ${isSelected ? 'bg-orange-500/10 ring-2 ring-inset ring-orange-500/30' : d.isSunday ? 'bg-rose-50 dark:bg-rose-950/40' : d.isHoliday ? 'bg-amber-50 dark:bg-amber-950/40' : ''}`}
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
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {(() => {
                const groups: Record<string, Employee[]> = {
                  'Abertura': [],
                  'Intermediário': [],
                  'Fechamento': [],
                  'Estoque': [],
                  'Folgas/Outros': []
                };

                employees.forEach(emp => {
                  if (emp.isHidden || emp.status !== 'active') return;
                  
                  const hour = (emp.dailyHours[monthKey] || [])[selectedDayIdx] || emp.workPeriod;
                  const isSun = days[selectedDayIdx]?.isSunday;
                  const shift = (emp.shifts[monthKey] || [])[selectedDayIdx] || 'T';
                  
                  const classification = getShiftClassification(hour, isSun, jornadaSettings);
                  const isOff = !isWorkingShift(shift);
                  
                  // Apply group filter (from top tags)
                  if (selectedGroup) {
                    if (selectedGroup === 'Folgas/Outros') {
                      if (!isOff) return;
                    } else {
                      if (isOff || classification !== selectedGroup) return;
                    }
                  }

                  if (isOff) {
                    groups['Folgas/Outros'].push(emp);
                  } else {
                    if (groups[classification]) groups[classification].push(emp);
                    else groups['Fechamento'].push(emp);
                  }
                });

                return ['Abertura', 'Intermediário', 'Fechamento', 'Folgas/Outros'].map(groupName => {
                  const emps = groups[groupName];
                  if (emps.length === 0) return null;

                  return (
                    <React.Fragment key={groupName}>
                      {/* Group Header Row */}
                      <tr className="bg-slate-100/90 dark:bg-zinc-900/90 backdrop-blur-md sticky z-20">
                        <td className="sticky left-0 py-1.5 px-2 font-black text-[9px] sm:text-[10px] uppercase text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-zinc-800 bg-inherit shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-4px_rgba(0,0,0,0.5)]">
                          {groupName}
                        </td>
                        {!isReadOnly && isEditable && (
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
                            <td className="sticky left-0 z-[10] bg-white dark:bg-black border-b border-r border-slate-200 dark:border-zinc-800 py-1 px-1.5 sm:py-1.5 sm:px-2 min-w-[120px] sm:min-w-[180px] w-[120px] sm:w-[180px] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-4px_rgba(0,0,0,0.5)]">
                              <button 
                                onClick={() => onOpenEmployeeCard(emp)}
                                className="flex items-center gap-1.5 sm:gap-2 w-full text-left hover:bg-orange-50 dark:hover:bg-orange-950/20 p-0.5 sm:p-1 rounded-lg sm:rounded-xl transition-all group/name"
                              >
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-zinc-800 group-hover/name:bg-orange-100 group-hover/name:text-orange-600 group-hover/name:border-orange-200 transition-colors">
                                  {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-slate-100 truncate group-hover/name:text-orange-600 transition-colors">{emp.name}</span>
                                    {(() => {
                                      if (isReadOnly) return null;
                                      const reqs = emp.requests || [];
                                      const hasAnswered = reqs.some(r => r.date?.startsWith(monthKey) && r.status !== 'pending');
                                      const hasPending = reqs.some(r => r.date?.startsWith(monthKey) && r.status === 'pending');
                                      
                                      if (hasAnswered) {
                                        return (
                                          <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-md animate-pulse-subtle" title="Pedido respondido!">
                                            <Icon name="notifications_active" className="text-[9px] text-white" />
                                          </div>
                                        );
                                      }
                                      if (hasPending) {
                                        return (
                                          <div className="w-3.5 h-3.5 bg-orange-500 rounded-full flex items-center justify-center animate-bounce-subtle" title="Tem pedidos pendentes">
                                            <Icon name="chat_bubble" className="text-[8px] text-white" />
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                    <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase truncate">{emp.cargo || 'Vendedor'}</span>
                                    {emp.contractType === 'Sazonal' && (
                                      <span className="text-[7px] px-1 rounded bg-amber-100 text-amber-600 font-bold uppercase tracking-widest">Sazonal</span>
                                    )}
                                    {emp.jornada === '5x2' && (
                                      <span className="text-[7px] px-1 rounded bg-purple-100 text-purple-600 font-bold uppercase tracking-widest">5x2</span>
                                    )}
                                  </div>
                                </div>
                                <Icon name="chevron_right" className="hidden sm:block text-slate-300 group-hover/name:text-orange-500 opacity-0 group-hover/name:opacity-100 transition-all text-sm ml-auto" />
                              </button>
                            </td>
                             {!isReadOnly && isEditable && (
                               <>
                                 {/* Hours Select */}
                                 <td className="hidden sm:table-cell sticky left-[180px] z-10 bg-white dark:bg-black border-b border-r border-slate-200 dark:border-zinc-800 py-1 px-2 min-w-[125px] w-[125px]">
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
                                           <option value="" className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100">AUTO 🤖</option>
                                           {finalOptions.map(h => (
                                             <option key={h} value={h} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100">{h}</option>
                                           ))}
                                           {currentVal && !finalOptions.includes(currentVal) && (
                                             <option value={currentVal} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100">{currentVal}</option>
                                           )}
                                         </>
                                       );
                                     })()}
                                   </select>
                                 </td>
                                 {/* Tactical Select */}
                                 <td className="hidden md:table-cell sticky left-[305px] z-10 bg-white dark:bg-black border-b border-r border-slate-200 dark:border-zinc-800 py-1 px-2 min-w-[100px] w-[100px]">
                                   <select
                                     value={emp.tacticalPositions?.[monthKey]?.[selectedDayIdx] || 'AUTO'}
                                     onChange={(e) => onUpdateTacticalPosition(emp.id, selectedDayIdx, e.target.value)}
                                     className="w-full bg-transparent border-none p-0 text-[11px] font-black text-slate-900 dark:text-slate-100 focus:ring-0 uppercase"
                                   >
                                     <option value="AUTO" className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100">AUTO 🤖</option>
                                     {(() => {
                                       const labels: Record<string, string> = { 'P1': 'P1 🟥', 'P2': 'P2 🟨', 'P3': 'P3 🟩', 'P4': 'P4 🟦', 'ESTQ': 'ESTQ 📦' };
                                       const finalPositions = ['P1', 'P2', 'P3', 'P4', 'ESTQ'];
   
                                       return finalPositions.map(p => (
                                         <option key={p} value={p} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100">{labels[p] || p}</option>
                                       ));
                                     })()}
                                   </select>
                                 </td>
                               </>
                             )}

                            {/* Shift Cells */}
                            {filteredDays.map(d => {
                              const rawShift = emp.shifts[monthKey]?.[d.num - 1] || 'T';
                              // Em visão de colaborador, oculta posições e mostra apenas 'T'
                              const shift = (isReadOnly && ['P1', 'P2', 'P3', 'P4', 'ESTQ'].includes(rawShift)) ? 'T' : rawShift;
                              
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
                              const dayRequest = !isReadOnly ? (emp.requests || []).find(r => r.date === fullDate) : undefined;

                              return (
                                <td key={d.num} className={`py-1 px-1 border-b border-slate-50 dark:border-slate-800 text-center transition-all relative ${dimClass} ${selectedDayIdx === d.num - 1 ? 'ring-2 ring-inset ring-orange-400/50' : ''} ${hasAlert ? 'ring-2 ring-inset ring-rose-500' : ''}`}>
                                  <div className="relative group flex flex-col items-center gap-1">
                                    {dayRequest && (
                                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full z-10 border-2 border-white dark:border-slate-900 cursor-help flex items-center justify-center group/balloon">
                                        <div className={`w-full h-full rounded-full ${
                                          dayRequest.status === 'granted' ? 'bg-emerald-500' : 
                                          dayRequest.status === 'refused' ? 'bg-red-500' :
                                          dayRequest.status === 'seen' ? 'bg-blue-500' : 
                                          'bg-orange-500 animate-pulse'
                                        }`} />
                                        
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 dark:bg-slate-800 text-white p-3 rounded-2xl shadow-xl opacity-0 invisible group-hover/balloon:opacity-100 group-hover/balloon:visible transition-all z-[100] pointer-events-none scale-95 group-hover/balloon:scale-100 origin-bottom">
                                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                                          <p className="text-[10px] font-black uppercase text-slate-400 mb-1 border-b border-slate-700 pb-1">Pedido do Colaborador</p>
                                          <p className="text-xs font-bold leading-snug">{dayRequest.text}</p>
                                          {dayRequest.feedback && (
                                            <div className="mt-2 pt-2 border-t border-slate-700">
                                              <p className="text-[9px] font-black uppercase text-orange-400 mb-0.5">Resposta do Gerente</p>
                                              <p className="text-[10px] font-bold text-slate-300 italic">{dayRequest.feedback}</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    <button
                                      onClick={() => onSelectDay(d.num - 1)}
                                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all shadow-sm relative ${
                                        dayRequest ? (
                                          dayRequest.status === 'granted' ? 'ring-2 ring-emerald-500 bg-emerald-50' :
                                          dayRequest.status === 'refused' ? 'ring-2 ring-red-500 bg-red-50' :
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
                                        (!dayRequest ? 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-zinc-800' : '')
                                      }`}
                                    >
                                      {shift === 'AT' ? (
                                        <div className="flex flex-col items-center justify-center text-rose-500 font-black leading-none">
                                          <Icon name="add" className="text-sm" />
                                          {(() => {
                                            if (emp.atestadoStart && emp.atestadoEnd && fullDate >= emp.atestadoStart && fullDate <= emp.atestadoEnd) {
                                              const s = new Date(emp.atestadoStart + 'T00:00:00').getTime();
                                              const e = new Date(emp.atestadoEnd + 'T00:00:00').getTime();
                                              const c = new Date(fullDate + 'T00:00:00').getTime();
                                              const total = Math.round((e - s) / 86400000) + 1;
                                              const cur = Math.round((c - s) / 86400000) + 1;
                                              return <span className="text-[6px] opacity-80 mt-0.5">{cur}/{total}</span>;
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      ) : shift === 'FE' ? (
                                        <div className="flex flex-col items-center justify-center leading-none">
                                          <span>FE</span>
                                          {(() => {
                                            if (emp.vacationStart && emp.vacationEnd && fullDate >= emp.vacationStart && fullDate <= emp.vacationEnd) {
                                              const s = new Date(emp.vacationStart + 'T00:00:00').getTime();
                                              const e = new Date(emp.vacationEnd + 'T00:00:00').getTime();
                                              const c = new Date(fullDate + 'T00:00:00').getTime();
                                              const total = Math.round((e - s) / 86400000) + 1;
                                              const cur = Math.round((c - s) / 86400000) + 1;
                                              return <span className="text-[6px] opacity-80 mt-0.5">{cur}/{total}</span>;
                                            }
                                            return null;
                                          })()}
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
                                              <option key={c.id || c.holidayDate} value={`FF ${c.id || c.holidayDate}`}>
                                                FF — {c.holidayName}
                                              </option>
                                            ))
                                          }
                                          
                                          {/* Current value if it's a specific FF already matched but not in pending anymore */}
                                          {shift?.startsWith('FF ') && !(holidayCredits[emp.id] || []).some(c => c.status === 'pending' && `FF ${c.id || c.holidayDate}` === shift) && (
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
        <div className="bg-white dark:bg-black p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm mt-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon name="campaign" className="text-orange-500" />
              <h3 className="text-[12px] font-black uppercase text-slate-800 dark:text-slate-100">Recados Importantes do Mês (Para Impressão)</h3>
            </div>
            <button 
              onClick={onCloseNotes}
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-900 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
            >
              <Icon name="close" />
            </button>
          </div>
          <textarea
            value={monthNotes}
            onChange={(e) => onUpdateMonthNotes(e.target.value)}
            placeholder="Digite aqui os recados que devem aparecer no rodapé do PDF... (aprox. 450 caracteres cabem no espaço)"
            maxLength={450}
            className="w-full h-24 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none outline-none text-slate-700 dark:text-slate-300"
          />
          <div className="text-right mt-1 text-[10px] font-bold text-slate-400">
            {monthNotes.length} / 450 caracteres
          </div>
        </div>
      )}

      {showGuideModal && (
        <OperationalGuideModal onClose={() => setShowGuideModal(false)} />
      )}
    </div>
  );
};
