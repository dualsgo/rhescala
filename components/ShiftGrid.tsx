import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Employee, ShiftType, MonthYear, Holiday, JornadaSettings, ScheduleDiffItem, TacticalDisplayMode, ProtectedDaysConfig, DECISION_REASON_LABELS, EmployeeRole, EMPLOYEE_ROLES, ROLE_METADATA_MAP, normalizeEmployeeRole } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, buildHolidaySet, getNationalHolidays, getShortName, getDefaultHourForDay, DEFAULT_JORNADA_SETTINGS, isEmployeeActiveInMonth, isEmployeeHiddenInMonth, isEmployeeEligibleForMonth, PLACEHOLDER_EMPLOYEE_ID, normalizeProtectedDaysConfig, getTacticalLabel, getTacticalCellCode, getTacticalEmoji } from '../constants';
import { getShiftClassification, isWorkingShift, resolveEffectiveShift, getPrevMonthWorkStreak, getPrevMonthConsecutive, calculateLunches, calculateDetailedLunches, DetailedLunchAssignment } from '../hooks/useScheduleEngine';
import { OperationalGuideModal } from './OperationalGuideModal';
import { MobileDayScheduleView } from './MobileDayScheduleView';
import { MobileFilterDrawer } from './MobileFilterDrawer';

import { HolidayCredit } from '../hooks/useHolidayCredits';
import { toLocalISODate } from '../src/utils/date';
import { ROLE_VISUAL_MAP, SHIFT_CELL_STYLES, getShiftCellStyle } from '../src/utils/design-system';

interface ShiftGridProps {
  employees: Employee[];
  currentMY: MonthYear;
  selectedDayIdx: number;
  today?: Date;
  customHolidays: Holiday[];
  holidayCredits?: Record<string, HolidayCredit[]>;
  filter: 'all' | 'sunday' | 'holiday' | 'week';
  onSelectDay?: (idx: number) => void;
  onUpdateShift?: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateShifts?: (updates: { empId: string, dayIdx: number, newShift: ShiftType }[]) => void;
  onUpdateEmployeeDailyHour: (empId: string, dayIdx: number, newHour: string) => void;
  onUpdateTacticalPosition: (empId: string, dayIdx: number, newPos: string | null) => void;
  onShareWhatsApp?: (dayIdx: number) => void;
  onOpenDayDetail?: (dayIdx: number) => void;
  onResetMonth?: () => void;
  onApplyFolgas?: () => void;
  onSortearDomingo?: () => void;
  onOpenAnalysis?: () => void;
  onShowHolidayManager?: () => void;
  onNextMonth?: () => void;
  onPrevMonth?: () => void;
  monthNotes?: string;
  onUpdateMonthNotes?: (text: string) => void;
  isReadOnly?: boolean;
  isEditable: boolean;
  onToggleEdit?: () => void;
  allowRetroactive?: boolean;
  onToggleRetroactive?: () => void;
  showNotes?: boolean;
  onCloseNotes?: () => void;
  onFilterChange: (f: 'all' | 'sunday' | 'holiday' | 'week') => void;
  jornadaSettings?: JornadaSettings;
  resolvedPositions: Record<string, string>;
  onOpenEmployeeCard: (emp: Employee, tab?: 'mes' | 'atual' | 'pedidos' | 'atestado', initialDate?: string) => void;
  diffs?: ScheduleDiffItem[];
  onOpenPresetForEmployee?: (empId: string) => void;
  tacticalDisplayMode?: TacticalDisplayMode;
  onToggleTacticalDisplayMode?: (mode?: TacticalDisplayMode) => void;
  highlightedEmpId?: string;
  onHighlightEmp?: (empId: string) => void;
  onExportCsv?: () => void;
  contractFilter?: 'all' | 'clt' | 'sazonal';
  onContractFilterChange?: (c: 'all' | 'clt' | 'sazonal') => void;
  onlyWorkingToday?: boolean;
  onToggleOnlyWorkingToday?: () => void;
  selectedGroup?: string | null;
  onSelectedGroupChange?: (g: string | null) => void;
  densityMode?: 'clean' | 'audit';
  onToggleDensityMode?: () => void;
  protectedDaysConfig?: ProtectedDaysConfig;
  onEditEmployee?: (empId: string) => void;
  onToggleHideEmployee?: (empId: string) => void;
}

export const ShiftGrid: React.FC<ShiftGridProps> = ({

  employees,
  currentMY,
  selectedDayIdx,
  today = new Date(),
  customHolidays,
  holidayCredits = {},
  filter,
  onSelectDay = () => {},
  onUpdateShift = () => {},
  onUpdateShifts = () => {},
  onUpdateEmployeeDailyHour,
  onUpdateTacticalPosition,
  onOpenDayDetail = () => {},
  monthNotes = '',
  onUpdateMonthNotes = () => {},
  isReadOnly = false,
  isEditable,
  onToggleEdit,
  allowRetroactive = false,
  onToggleRetroactive,
  showNotes = false,
  onCloseNotes = () => {},
  onFilterChange,
  jornadaSettings = DEFAULT_JORNADA_SETTINGS,
  resolvedPositions,
  onOpenEmployeeCard,
  onShareWhatsApp,
  diffs = [],
  onOpenPresetForEmployee,
  tacticalDisplayMode = 'off',
  onToggleTacticalDisplayMode,
  highlightedEmpId,
  onHighlightEmp,
  onExportCsv,
  contractFilter: propContractFilter,
  onContractFilterChange,
  onlyWorkingToday: propOnlyWorkingToday,
  onToggleOnlyWorkingToday,
  selectedGroup: propSelectedGroup,
  onSelectedGroupChange,
  densityMode: propDensityMode,
  onToggleDensityMode,
  protectedDaysConfig,
  onEditEmployee,
  onToggleHideEmployee,
}) => {
  const [isSectorCoverageExpanded, setIsSectorCoverageExpanded] = useState(true);
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);

  const eligibleEmployeesInMonth = useMemo(() => {
    return employees.filter(e => e.id !== PLACEHOLDER_EMPLOYEE_ID && isEmployeeEligibleForMonth(e, currentMY.year, currentMY.month));
  }, [employees, currentMY.year, currentMY.month]);

  const hiddenEmployeesInMonth = useMemo(() => {
    return eligibleEmployeesInMonth.filter(e => isEmployeeHiddenInMonth(e, monthKey));
  }, [eligibleEmployeesInMonth, monthKey]);

  const [hasScrolled, setHasScrolled] = useState(false);
  const [internalSelectedGroup, setInternalSelectedGroup] = useState<string | null>(null);
  const selectedGroup = propSelectedGroup !== undefined ? propSelectedGroup : internalSelectedGroup;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const [internalContractFilter, setInternalContractFilter] = useState<'all' | 'clt' | 'sazonal'>('all');
  const contractFilter = propContractFilter !== undefined ? propContractFilter : internalContractFilter;
  const setContractFilter = onContractFilterChange || setInternalContractFilter;

  const [hidePastDays, setHidePastDays] = useState(false);

  const [internalOnlyWorkingToday, setInternalOnlyWorkingToday] = useState(false);
  const onlyWorkingToday = propOnlyWorkingToday !== undefined ? propOnlyWorkingToday : internalOnlyWorkingToday;

  const setSelectedGroup = (group: string | null) => {
    if (onSelectedGroupChange) {
      onSelectedGroupChange(group);
    } else {
      setInternalSelectedGroup(group);
    }
    if (group === 'Folgas/Outros' && onlyWorkingToday) {
      if (onToggleOnlyWorkingToday) onToggleOnlyWorkingToday();
      else setInternalOnlyWorkingToday(false);
    }
  };

  const setOnlyWorkingToday = (val: boolean) => {
    if (val && selectedGroup === 'Folgas/Outros') {
      if (onSelectedGroupChange) onSelectedGroupChange(null);
      else setInternalSelectedGroup(null);
    }
    if (onToggleOnlyWorkingToday) {
      if (val !== onlyWorkingToday) onToggleOnlyWorkingToday();
    } else {
      setInternalOnlyWorkingToday(val);
    }
  };

  const [isCompactMode, setIsCompactMode] = useState(false);
  const [focusSelectedDay, setFocusSelectedDay] = useState(false);
  const [groupBy, setGroupBy] = useState<'role' | 'shift'>('role');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = useCallback((groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  }, []);

  const currentGroupOrder = useMemo(() => {
    return groupBy === 'role'
      ? ['Caixa', 'Pacote', 'Vendas', 'Apoio', 'Fiscal', 'Estoque']
      : ['Abertura', 'Intermediário', 'Fechamento', 'Folgas/Outros'];
  }, [groupBy]);

  const areAllGroupsCollapsed = useMemo(() => {
    return currentGroupOrder.length > 0 && currentGroupOrder.every(g => Boolean(collapsedGroups[g]));
  }, [currentGroupOrder, collapsedGroups]);

  const toggleCollapseAllGroups = useCallback(() => {
    if (areAllGroupsCollapsed) {
      setCollapsedGroups({});
    } else {
      const next: Record<string, boolean> = {};
      currentGroupOrder.forEach(g => { next[g] = true; });
      setCollapsedGroups(next);
    }
  }, [areAllGroupsCollapsed, currentGroupOrder]);

  // Modo de Densidade Visual (clean = Visão Limpa [Padrão], audit = Visão de Auditoria Completa)
  const [internalDensityMode, setInternalDensityMode] = useState<'clean' | 'audit'>(() => {
    try {
      const saved = localStorage.getItem('rhescala_cycle_badges_mode');
      if (saved === 'audit' || saved === 'all') return 'audit';
    } catch {}
    return 'clean';
  });

  const densityMode = propDensityMode !== undefined ? propDensityMode : internalDensityMode;
  const handleToggleDensityMode = onToggleDensityMode || (() => {
    setInternalDensityMode(prev => {
      const next = prev === 'clean' ? 'audit' : 'clean';
      try {
        localStorage.setItem('rhescala_cycle_badges_mode', next);
      } catch {}
      return next;
    });
  });

  const legacyCycleMode: 'all' | 'alerts' | 'off' = densityMode === 'audit' ? 'all' : 'alerts';
  const setLegacyCycleMode = () => {
    handleToggleDensityMode();
  };

  // Mobile Redesign States
  const [mobileViewMode, setMobileViewMode] = useState<'daily' | 'table'>('daily');
  const [showMobileFilterDrawer, setShowMobileFilterDrawer] = useState(false);
  const mobileCarouselRef = useRef<HTMLDivElement>(null);

  const isCurrentMonth = currentMY.year === today.getFullYear() && currentMY.month === today.getMonth();
  const todayDayNum = today.getDate();

  // Auto-scroll mobile carousel to selectedDayIdx
  useEffect(() => {
    if (mobileCarouselRef.current) {
      const activeEl = mobileCarouselRef.current.children[selectedDayIdx] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDayIdx]);

  // Count active filters for mobile badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (onlyWorkingToday) count++;
    if (selectedGroup) count++;
    if (contractFilter !== 'all') count++;
    if (hidePastDays) count++;
    return count;
  }, [onlyWorkingToday, selectedGroup, contractFilter, hidePastDays]);

  // Auto-scroll logic to today's day on initial render
  useEffect(() => {
    if (!hasScrolled && isCurrentMonth && !hidePastDays) {
      const todayDay = new Date().getDate();
      if (todayDay > 1) {
        setHasScrolled(true);
        const colWidth = isCompactMode ? 38 : 52;
        const scrollPos = (todayDay - 1) * colWidth;
        
        const timeout = setTimeout(() => {
          if (scrollContainerRef.current) {
            if (typeof scrollContainerRef.current.scrollTo === 'function') {
              scrollContainerRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
            } else {
              scrollContainerRef.current.scrollLeft = scrollPos;
            }
          }
        }, 300);
        return () => clearTimeout(timeout);
      }
    }
  }, [currentMY.month, currentMY.year, hidePastDays, isCompactMode]);

  const legendItems = useMemo(() => {
    const baseItems = [
      { code: 'T', label: 'Trabalho Regular (T)', color: 'bg-emerald-500' },
      { code: 'F', label: 'Folga Semanal (F)', color: 'bg-rose-500' },
      { code: 'FF', label: 'Folga Feriado (FF)', color: 'bg-fuchsia-500' },
      { code: 'FE', label: 'Férias (FE)', color: 'bg-sky-500' },
      { code: 'DO', label: 'Aniversário / Day Off', color: 'bg-purple-500' },
      { code: 'C', label: 'Curso Aprendiz (C)', color: 'bg-indigo-500' },
      { code: 'AT', label: 'Atestado Médico (AT)', color: 'bg-amber-500' },
      { code: '1/6..6/6', label: 'Dias Seguidos 6x1', color: 'bg-zinc-600' },
      { code: '7º', label: '7º Dia: Violação 6x1', color: 'bg-rose-600' },
      { code: '1D / 2D', label: 'Domingos Trabalhados', color: 'bg-amber-500' },
      { code: '3D', label: '3º Domingo: Violação CLT', color: 'bg-rose-600' },
      { code: '3D✓', label: '3º Dom: Folga Cumprida!', color: 'bg-emerald-600' },
    ];

    const roleItems = EMPLOYEE_ROLES.map(role => {
      const meta = ROLE_METADATA_MAP[role];
      return { code: meta.code, label: meta.label, color: meta.bgColor };
    });

    return [...baseItems, ...roleItems];
  }, []);

  const prevWorkStreaks = useMemo(() => {
    return getPrevMonthWorkStreak(employees, currentMY.year, currentMY.month);
  }, [employees, currentMY.year, currentMY.month]);

  const prevMonthConsecs = useMemo(() => {
    return getPrevMonthConsecutive(employees.filter(e => e.status === 'active' && !e.isYoungApprentice), currentMY.year, currentMY.month);
  }, [employees, currentMY.year, currentMY.month]);

  const allHolidays = useMemo(() => {
    return [...getNationalHolidays(currentMY.year), ...customHolidays]
      .filter(h => h.date.startsWith(String(currentMY.year)))
      .filter((h, i, self) => i === self.findIndex(t => t.date === h.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [currentMY.year, customHolidays]);

  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const safeSelectedDayIdx = Math.min(Math.max(0, selectedDayIdx), Math.max(0, daysInMonth - 1));
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(currentMY.year, currentMY.month, i + 1);
      const dow = date.getDay();
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const isHoliday = holidaySet.has(dateStr);
      const holidayObj = allHolidays.find(h => h.date === dateStr);
      return { num: i + 1, weekday: ['DOM','SEG','TER','QUA','QUI','SEX','SAB'][dow], isSunday: dow === 0, isHoliday, holidayName: holidayObj?.name, dateStr };
    });
  }, [currentMY, daysInMonth, holidaySet]);

  const protectedConfig = useMemo(() => normalizeProtectedDaysConfig(protectedDaysConfig), [protectedDaysConfig]);

  const dailyDetailedLunchesMap = useMemo(() => {
    const map = new Map<string, DetailedLunchAssignment>();
    days.forEach(d => {
      const dayIdx = d.num - 1;
      const isSun = d.isSunday;
      const isHol = d.isHoliday;
      const workingInDay = employees.filter(emp => {
        if (!isEmployeeActiveInMonth(emp, currentMY.year, currentMY.month)) return false;
        const s = (emp.shifts[monthKey] || [])[dayIdx] || 'T';
        return isWorkingShift(s) || s === 'C';
      });
      const detailedLunches = calculateDetailedLunches(workingInDay, isHol, isSun, undefined, jornadaSettings, {
        monthKey,
        dayIdx,
      });
      detailedLunches.forEach((dl) => {
        map.set(`${dl.employeeId || dl.member?.id}_${dayIdx}`, dl);
      });
    });
    return map;
  }, [days, employees, currentMY.year, currentMY.month, monthKey, jornadaSettings]);

  const dailyLunchesMap = useMemo(() => {
    const map = new Map<string, string>();
    dailyDetailedLunchesMap.forEach((dl, key) => {
      if (dl.lunchSlot) map.set(key, dl.lunchSlot);
    });
    return map;
  }, [dailyDetailedLunchesMap]);

  const daysRemainingCount = isCurrentMonth ? Math.max(0, daysInMonth - todayDayNum + 1) : 0;

  const filteredDays = useMemo(() => {
    let result = days;
    if (filter === 'sunday') result = result.filter(d => d.isSunday);
    else if (filter === 'holiday') result = result.filter(d => d.isHoliday);

    if (hidePastDays && isCurrentMonth) {
      const remaining = result.filter(d => d.num >= todayDayNum);
      if (remaining.length > 0) return remaining;
    }
    return result;
  }, [days, filter, hidePastDays, isCurrentMonth, todayDayNum]);

  const selectedDayDateStr = days[safeSelectedDayIdx]?.dateStr
    || `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(safeSelectedDayIdx + 1).padStart(2, '0')}`;

  const displayedEmployees = useMemo(() => {
    let list = employees.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));
    if (contractFilter === 'clt') list = list.filter(e => e.contractType !== 'Sazonal');
    else if (contractFilter === 'sazonal') list = list.filter(e => e.contractType === 'Sazonal');

    if (onlyWorkingToday) {
      list = list.filter(emp => {
        const effectiveShift = resolveEffectiveShift(emp, selectedDayDateStr, monthKey, safeSelectedDayIdx);
        return isWorkingShift(effectiveShift);
      });
    }

    if (selectedGroup) {
      list = list.filter(emp => {
        const isSun = Boolean(days[safeSelectedDayIdx]?.isSunday);
        const isHol = Boolean(days[safeSelectedDayIdx]?.isHoliday);
        const effectiveShift = resolveEffectiveShift(emp, selectedDayDateStr, monthKey, safeSelectedDayIdx);
        const isOff = !isWorkingShift(effectiveShift);
        const hour = (emp.dailyHours[monthKey] || [])[safeSelectedDayIdx] || emp.workPeriod || getDefaultHourForDay(emp, isHol, isSun);
        const classification = getShiftClassification(hour, isSun, jornadaSettings);

        if (selectedGroup === 'Folgas/Outros') return isOff;
        if (isOff) return false;
        return classification === selectedGroup;
      });
    }

    return list.sort((a, b) => (a.workPeriod || '').localeCompare(b.workPeriod || '') || a.name.localeCompare(b.name));
  }, [employees, currentMY.year, currentMY.month, contractFilter, onlyWorkingToday, selectedGroup, monthKey, safeSelectedDayIdx, selectedDayDateStr, days, jornadaSettings]);

  return (
    <div className="flex flex-col gap-3 sm:gap-4 relative h-full">
      {/* ============================================================ */}
      {/* MOBILE CONTROLS & HEADER (< lg)                              */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-2 lg:hidden">
        {/* Row 1: Alternador Diário/Tabela + Botão Filtros + WhatsApp */}
        <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          {/* Alternador Diário vs Tabela */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setMobileViewMode('daily')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                mobileViewMode === 'daily'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Icon name="view_agenda" className="text-sm" />
              <span>Diário</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileViewMode('table')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                mobileViewMode === 'table'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Icon name="grid_on" className="text-sm" />
              <span>Tabela</span>
            </button>
          </div>

          {/* Ações Rápidas: WhatsApp do Dia, Salvar CSV e Filtros */}
          <div className="flex items-center gap-1.5">
            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="p-2 rounded-xl bg-zinc-800 text-white dark:bg-zinc-800 shadow-sm active:scale-95 transition-all"
                title="Salvar Escala Completa em CSV (.csv)"
              >
                <Icon name="table_view" className="text-base text-emerald-400" />
              </button>
            )}

            {!isReadOnly && onShareWhatsApp && (
              <button
                type="button"
                onClick={() => onShareWhatsApp(safeSelectedDayIdx)}
                className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm active:scale-95 transition-all"
                title="Compartilhar Escala do Dia no WhatsApp"
              >
                <Icon name="chat" className="text-base" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowMobileFilterDrawer(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                activeFiltersCount > 0
                  ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-600 dark:text-orange-400 font-black shadow-sm'
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Icon name="tune" className="text-sm text-orange-500" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[11px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Carrossel Horizontal de Dias (1 a 31) */}
        <div 
          ref={mobileCarouselRef}
          className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 custom-scrollbar no-scrollbar scroll-smooth"
        >
          {days.map((d, idx) => {
            const isSelected = safeSelectedDayIdx === idx;
            const isToday = isCurrentMonth && (idx + 1) === todayDayNum;
            const isSun = d.isSunday;
            const isHol = d.isHoliday;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectDay?.(idx)}
                className={`shrink-0 w-11 py-2 rounded-2xl flex flex-col items-center justify-center transition-all relative select-none ${
                  isSelected
                    ? 'bg-gradient-to-b from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/25 scale-105 font-black z-10'
                    : isToday
                    ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-black'
                    : isSun
                    ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 font-bold'
                    : isHol
                    ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 font-bold'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold'
                }`}
              >
                <span className={`text-[11px] uppercase tracking-tighter ${isSelected ? 'text-white/90' : 'text-zinc-400 dark:text-zinc-500'}`}>
                  {d.weekday}
                </span>
                <span className="text-sm font-black leading-tight">
                  {idx + 1}
                </span>
                <div className="flex items-center gap-0.5 mt-0.5 h-1.5">
                  {isToday && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-amber-500'}`} />
                  )}
                  {isHol && (
                    <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Controls: Barra Contextual do Dia Selecionado (Desktop >= lg) */}
      {isReadOnly ? (
        <div className="hidden lg:flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm w-full">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
              <span className={`w-2 h-2 rounded-full ${isCurrentMonth && (safeSelectedDayIdx + 1) === todayDayNum ? 'bg-amber-500 animate-pulse' : 'bg-zinc-400'}`} />
              <span>
                {isCurrentMonth && (safeSelectedDayIdx + 1) === todayDayNum ? 'Hoje' : 'Dia'}: {String(safeSelectedDayIdx + 1).padStart(2, '0')}/{String(currentMY.month + 1).padStart(2, '0')} {days[safeSelectedDayIdx]?.weekday ? `(${days[safeSelectedDayIdx].weekday})` : ''}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setFocusSelectedDay(!focusSelectedDay)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                focusSelectedDay
                  ? 'bg-amber-500 border-amber-500 text-white shadow-amber-500/20'
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
              title={focusSelectedDay ? 'Desativar modo foco' : 'Destacar coluna do dia selecionado e suavizar as demais'}
            >
              <Icon name={focusSelectedDay ? 'filter_center_focus' : 'center_focus_weak'} className="text-xs" />
              <span>{focusSelectedDay ? `Dia ${safeSelectedDayIdx + 1}` : 'Foco'}</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlyWorkingToday(!onlyWorkingToday)}
              aria-pressed={onlyWorkingToday}
              aria-label="Filtrar somente quem está trabalhando no dia selecionado"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                onlyWorkingToday
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
              title={
                onlyWorkingToday
                  ? `Exibindo somente quem trabalha no dia ${String(safeSelectedDayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}. Clique para mostrar toda a equipe.`
                  : `Ocultar quem está de folga ou ausente no dia ${String(safeSelectedDayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`
              }
            >
              <Icon name={onlyWorkingToday ? 'check_circle' : 'group'} className="text-xs" />
              <span>{onlyWorkingToday ? `Trabalhando (${displayedEmployees.length})` : 'Ocultar Folgas'}</span>
            </button>
          </div>
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 pr-1">
            Clique no número do dia na tabela para filtrar quem trabalha
          </span>
        </div>
      ) : (
        <div className="hidden lg:flex flex-col gap-2.5">
        {/* Linha 1: Contexto Operacional do Dia & Ações Imediatas */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-zinc-900 p-2 sm:p-2.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm w-full">
          {/* Lado Esquerdo: Dia Selecionado & Ações Diárias */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Âncora do Dia Selecionado */}
            <button
              type="button"
              onClick={() => onOpenDayDetail(safeSelectedDayIdx)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                isCurrentMonth && (safeSelectedDayIdx + 1) === todayDayNum
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                  : 'bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="Clique para abrir o Resumo Operacional detalhado deste dia (escalas, almoços e postos)"
            >
              <span className={`w-2 h-2 rounded-full ${isCurrentMonth && (safeSelectedDayIdx + 1) === todayDayNum ? 'bg-amber-500 animate-pulse' : 'bg-zinc-400'}`} />
              <span>
                {isCurrentMonth && (safeSelectedDayIdx + 1) === todayDayNum ? 'Hoje' : 'Dia'}: {String(safeSelectedDayIdx + 1).padStart(2, '0')}/{String(currentMY.month + 1).padStart(2, '0')} {days[safeSelectedDayIdx]?.weekday ? `(${days[safeSelectedDayIdx].weekday})` : ''}
              </span>
              <Icon name="visibility" className="text-xs text-zinc-400 dark:text-zinc-400" />
            </button>

            {/* Modo de Edição Direta da Grade (Apenas Gestão) */}
            {!isReadOnly && onToggleEdit && (
              <button
                type="button"
                onClick={onToggleEdit}
                aria-pressed={isEditable}
                aria-label={isEditable ? 'Modo de Edição Ativo. Clique para bloquear.' : 'Habilitar Modo de Edição da Grade.'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 whitespace-nowrap ${
                  isEditable
                    ? 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-white shadow-amber-500/20 ring-2 ring-amber-500/30'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
                title={
                  isEditable
                    ? 'Modo Edição ATIVO: Clique para travar a escala e evitar alterações acidentais'
                    : 'Modo Edição TRAVADO: Clique para habilitar alteração de turnos, folgas e horários na grade'
                }
              >
                <Icon name={isEditable ? 'edit' : 'edit_off'} className="text-xs" />
                <span>{isEditable ? 'Edição Ativa' : 'Editar'}</span>
                {isEditable && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </button>
            )}

            {/* Edição Retroativa (dias passados) - visível quando Edição está ativa */}
            {!isReadOnly && isEditable && onToggleRetroactive && (
              <button
                type="button"
                onClick={onToggleRetroactive}
                aria-pressed={allowRetroactive}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 whitespace-nowrap ${
                  allowRetroactive
                    ? 'bg-rose-500 hover:bg-rose-600 border-rose-600 text-white shadow-rose-500/20'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
                title={
                  allowRetroactive
                    ? 'Edição Retroativa ATIVA: Permite alterar dias anteriores a hoje'
                    : 'Edição Retroativa DESATIVADA: Clique para destravar alteração em dias passados'
                }
              >
                <Icon name={allowRetroactive ? 'history' : 'history_toggle_off'} className="text-xs" />
                <span>{allowRetroactive ? 'Retroativo' : 'Passado'}</span>
              </button>
            )}

            {/* Divulgação Operacional / WhatsApp do Dia (Apenas Gestão) */}
            {!isReadOnly && onShareWhatsApp && (
              <button
                type="button"
                onClick={() => onShareWhatsApp(safeSelectedDayIdx)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider transition-all shadow-sm shadow-emerald-600/20 active:scale-95 whitespace-nowrap"
                title="Preparar e compartilhar a divulgação operacional do dia"
              >
                <Icon name="campaign" className="text-xs" />
                <span>Divulgação (WhatsApp)</span>
              </button>
            )}

            {/* Salvar Escala em CSV (Apenas Gestão) */}
            {!isReadOnly && onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-700 dark:border-zinc-700 text-[11px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 whitespace-nowrap group"
                title="Salvar escala mensal em planilha CSV para Excel e Google Sheets"
              >
                <Icon name="table_view" className="text-xs text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Salvar CSV</span>
              </button>
            )}

            {/* Foco no Dia Selecionado */}
            <button
              type="button"
              onClick={() => setFocusSelectedDay(!focusSelectedDay)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                focusSelectedDay 
                  ? 'bg-amber-500 border-amber-500 text-white shadow-amber-500/20' 
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
              title={focusSelectedDay ? 'Desativar modo foco' : 'Destacar coluna do dia selecionado e suavizar as demais'}
            >
              <Icon name={focusSelectedDay ? 'filter_center_focus' : 'center_focus_weak'} className="text-xs" />
              <span>{focusSelectedDay ? `Dia ${safeSelectedDayIdx + 1}` : 'Foco'}</span>
            </button>

            {/* Filtro Rápido: Exibir somente quem trabalha no dia selecionado */}
            <button
              type="button"
              onClick={() => setOnlyWorkingToday(!onlyWorkingToday)}
              aria-pressed={onlyWorkingToday}
              aria-label="Filtrar somente quem está trabalhando no dia selecionado"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                onlyWorkingToday
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
              title={
                onlyWorkingToday
                  ? `Exibindo somente quem trabalha no dia ${String(safeSelectedDayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}. Clique para mostrar toda a equipe.`
                  : `Ocultar quem está de folga ou ausente no dia ${String(safeSelectedDayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`
              }
            >
              <Icon name={onlyWorkingToday ? 'check_circle' : 'group'} className="text-xs" />
              <span>{onlyWorkingToday ? `Trabalhando (${displayedEmployees.length})` : 'Ocultar Folgas'}</span>
            </button>

            {/* Restantes (se for mês corrente) */}
            {isCurrentMonth && (
              <button
                type="button"
                onClick={() => setHidePastDays(!hidePastDays)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                  hidePastDays 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-500/20' 
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
                title={hidePastDays ? 'Exibir o mês inteiro' : 'Ocultar dias passados para focar no restante do mês'}
              >
                <Icon name={hidePastDays ? 'fast_forward' : 'history_toggle_off'} className="text-xs" />
                <span>{hidePastDays ? `Restantes (${daysRemainingCount}d)` : 'Restantes'}</span>
              </button>
            )}

            
          </div>

          {/* Lado Direito: Modos de Exibição & Controles */}
          <div className="flex flex-wrap items-center gap-2">

            {/* Alternar Modo: Visão Limpa vs Auditoria */}
            <button
              type="button"
              onClick={handleToggleDensityMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                densityMode === 'audit'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-blue-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              title={
                densityMode === 'audit'
                  ? 'Modo Auditoria: Exibindo todos os indicadores e ciclos completos. Clique para voltar à Visão Limpa.'
                  : 'Visão Limpa: Exibindo apenas alertas críticos de violação (6/6, 7º, 2D✓, 3D, diffs). Clique para ver Auditoria completa.'
              }
            >
              <Icon name={densityMode === 'audit' ? 'troubleshoot' : 'visibility'} className="text-xs" />
              <span>{densityMode === 'audit' ? 'Auditoria' : 'Visão Limpa'}</span>
            </button>

            {/* Modo Denso */}
            <button
              type="button"
              onClick={() => setIsCompactMode(!isCompactMode)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                isCompactMode 
                  ? 'bg-purple-600 border-purple-600 text-white shadow-purple-500/20' 
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
              title="Alternar entre espaçamento normal e denso para exibir mais colaboradores"
            >
              <Icon name={isCompactMode ? 'view_agenda' : 'view_headline'} className="text-xs" />
              <span>{isCompactMode ? 'Denso' : 'Normal'}</span>
            </button>

            {/* Legenda Toggle */}
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                showLegend 
                  ? 'bg-orange-500 border-orange-500 text-white shadow-orange-500/20' 
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
              title="Exibir ou ocultar legenda de turnos e funções correlatas"
            >
              <Icon name="info" className="text-xs" />
              <span>Legenda</span>
              <Icon name={showLegend ? 'expand_less' : 'expand_more'} className="text-xs" />
            </button>

            {/* Equipe / Visibilidade */}
            {!isReadOnly && onToggleHideEmployee && (
              <button
                type="button"
                onClick={() => setShowVisibilityModal(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                  hiddenEmployeesInMonth.length > 0
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
                title="Gerenciar visibilidade de colaboradores na grade deste mês (ocultar/reexibir)"
              >
                <Icon name={hiddenEmployeesInMonth.length > 0 ? "visibility_off" : "group"} className="text-xs" />
                <span>Equipe</span>
                {hiddenEmployeesInMonth.length > 0 && (
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-500 text-white">
                    {hiddenEmployeesInMonth.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Linha 2: Barra de Filtros (Oculta no Desktop - agora unificada no menu superior) */}
        <div className="hidden">
          {/* Lado Esquerdo: Filtros de Equipe e Presença */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro: Presença Diária */}
            <button
              type="button"
              onClick={() => setOnlyWorkingToday(!onlyWorkingToday)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                onlyWorkingToday 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-500/20' 
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50'
              }`}
              title="Filtrar apenas colaboradores escalados para trabalhar no dia selecionado"
            >
              <Icon name={onlyWorkingToday ? 'check_circle' : 'person_pin_circle'} className="text-xs" />
              <span>{onlyWorkingToday ? 'Apenas Escalados Hoje' : 'Quem Trabalha Hoje'}</span>
            </button>

            {/* Filtro: Turno do Colaborador */}
            <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-0.5 rounded-xl shadow-sm shrink-0 overflow-x-auto custom-scrollbar">
              <button 
                type="button"
                onClick={() => setSelectedGroup(null)}
                className={`px-2 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  !selectedGroup ? 'bg-orange-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Todos os Turnos
              </button>
              {['Abertura', 'Intermediário', 'Fechamento', 'Folgas/Outros'].map(group => (
                <button 
                  type="button"
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    selectedGroup === group ? 'bg-orange-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  {group.split('/')[0]}
                </button>
              ))}
            </div>

            {/* Filtro: Tipo de Contrato */}
            <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-0.5 rounded-xl shadow-sm shrink-0">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'clt', label: 'CLT' },
                { id: 'sazonal', label: 'Sazonais' }
              ].map(f => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setContractFilter(f.id as any)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    contractFilter === f.id 
                      ? 'bg-orange-500 text-white shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lado Direito: Filtro de Período da Grade */}
          <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-0.5 rounded-xl shadow-sm shrink-0">
            {[
              { id: 'all', label: 'Mês Completo', short: 'Mês' },
              { id: 'sunday', label: 'Domingos', short: 'Dom' },
              { id: 'holiday', label: 'Feriados', short: 'Fer' }
            ].map(f => (
              <button
                type="button"
                key={f.id}
                onClick={() => onFilterChange(f.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  filter === f.id 
                    ? 'bg-orange-500 text-white shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="hidden sm:inline">{f.label}</span>
                <span className="inline sm:hidden">{f.short}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Linha 3: Legenda Retrátil com Animação Suave */}
        {showLegend && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3.5 py-2 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-1 duration-150 w-full">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {legendItems.map(item => (
                <div key={item.code} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 tracking-tight whitespace-nowrap">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 ml-auto select-none">
              <Icon name="touch_app" className="text-orange-400 text-xs" />
              <span>Toque no nome do colaborador para ver detalhes</span>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Mobile Day Schedule View (< lg) */}
      <div className="lg:hidden">
        {mobileViewMode === 'daily' && (
          <MobileDayScheduleView
            employees={displayedEmployees}
            allEmployees={employees}
            jornadaSettings={jornadaSettings}
            currentMY={currentMY}
            selectedDayIdx={safeSelectedDayIdx}
            monthKey={monthKey}
            isHoliday={days[safeSelectedDayIdx]?.isHoliday || false}
            holidayName={days[safeSelectedDayIdx]?.holidayName}
            isSunday={days[safeSelectedDayIdx]?.isSunday || false}
            resolvedPositions={resolvedPositions}
            tacticalDisplayMode={tacticalDisplayMode}
            isReadOnly={Boolean(isReadOnly)}
            highlightedEmpId={highlightedEmpId}
            onUpdateShift={onUpdateShift || (() => {})}
            onUpdateEmployeeDailyHour={onUpdateEmployeeDailyHour}
            onUpdateTacticalPosition={(empId, dayIdx, pos) => onUpdateTacticalPosition(empId, dayIdx, pos)}
            onOpenEmployeeCard={onOpenEmployeeCard}
            onOpenDayDetail={onOpenDayDetail || (() => {})}
            onToggleHideEmployee={onToggleHideEmployee}
            diffs={diffs}
          />
        )}
      </div>

      {/* Grid Container */}
      <div className={`bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden flex-1 flex-col relative ${
        mobileViewMode === 'daily' ? 'hidden lg:flex' : 'flex'
      }`}>
        <div 
          ref={scrollContainerRef}
          className="overflow-auto custom-scrollbar flex-1"
          onScroll={(e) => {
            if (!hasScrolled && e.currentTarget.scrollLeft > 10) setHasScrolled(true);
          }}
        >
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-40 bg-zinc-50 dark:bg-zinc-900 shadow-xs">
              <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                <th className="sticky top-0 left-0 z-[60] bg-zinc-50 dark:bg-zinc-900 border-b border-r border-zinc-200 dark:border-zinc-800 py-1.5 px-3 text-left w-[240px] min-w-[240px] max-w-[240px] shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.4)]">
                  <div className="flex flex-col justify-center gap-1 min-h-[44px]">
                    {/* Linha 1: Título e Visibilidade de Ocultos */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider truncate">Colaborador</span>
                        {!isReadOnly && onToggleHideEmployee && hiddenEmployeesInMonth.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowVisibilityModal(true)}
                            className="p-0.5 px-1 rounded-md transition-colors flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                            title={`${hiddenEmployeesInMonth.length} colaborador(es) oculto(s) neste mês. Clique para gerenciar visibilidade.`}
                            aria-label="Gerenciar visibilidade de colaboradores na grade"
                          >
                            <Icon name="visibility_off" className="text-[11px]" />
                            <span className="text-[10px] font-black">
                              {hiddenEmployeesInMonth.length}
                            </span>
                          </button>
                        )}
                      </div>

                      {!isReadOnly && onToggleHideEmployee && hiddenEmployeesInMonth.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setShowVisibilityModal(true)}
                          className="p-1 rounded-md transition-colors text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          title="Gerenciar visibilidade de colaboradores neste mês"
                          aria-label="Gerenciar visibilidade de colaboradores na grade"
                        >
                          <Icon name="visibility" className="text-xs" />
                        </button>
                      )}
                    </div>

                    {/* Linha 2: Controles da Grade (Recolher + Agrupamento) */}
                    <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-zinc-200/60 dark:border-zinc-800/60">
                      <button
                        type="button"
                        onClick={toggleCollapseAllGroups}
                        className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer transition-colors"
                        title={areAllGroupsCollapsed ? "Expandir todos os grupos" : "Recolher todos os grupos"}
                        aria-label={areAllGroupsCollapsed ? "Expandir todos os grupos" : "Recolher todos os grupos"}
                      >
                        <Icon name={areAllGroupsCollapsed ? "unfold_more" : "unfold_less"} className="text-xs shrink-0" />
                        <span>{areAllGroupsCollapsed ? "Expandir" : "Recolher"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setGroupBy(prev => prev === 'role' ? 'shift' : 'role')}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition-colors cursor-pointer shrink-0"
                        title="Alternar agrupamento entre Função e Turno"
                      >
                        {groupBy === 'role' ? 'Por Função' : 'Por Turno'}
                      </button>
                    </div>
                  </div>
                </th>
                {filteredDays.map(d => {
                  const dayIdx = d.num - 1;
                  const stats = employees.reduce((acc, emp) => {
                    if (!isEmployeeActiveInMonth(emp, currentMY.year, currentMY.month)) return acc;
                    const effShift = resolveEffectiveShift(emp, d.dateStr, monthKey, dayIdx);
                    if (isWorkingShift(effShift)) {
                      acc.total++;
                    }
                    return acc;
                  }, { total: 0 });

                  const isSelected = safeSelectedDayIdx === dayIdx;
                  const todayStr = toLocalISODate();
                  const isToday = d.dateStr === todayStr;
                  const isWeekend = d.isSunday || d.weekday === 'SÁB' || d.weekday === 'DOM';
                  const isProtected = Boolean(protectedConfig && protectedConfig[d.num]);
                  const isPast = d.dateStr < todayStr;
                  const pastDimClass = isPast && !isSelected && (!isEditable || !allowRetroactive) ? 'opacity-30 grayscale select-none' : '';
                  const focusDimClass = focusSelectedDay && !isSelected ? 'opacity-40 hover:opacity-100 transition-opacity duration-150' : '';
                  const focusHighlight = isSelected && focusSelectedDay ? 'bg-orange-500/15 ring-2 ring-orange-500 shadow-sm z-20' : isSelected ? 'bg-orange-500/10 ring-2 ring-inset ring-orange-500/30' : '';

                  return (
                    <th 
                      key={d.num} 
                      onClick={() => isSelected && !isReadOnly ? onOpenDayDetail(dayIdx) : onSelectDay(dayIdx)}
                      className={`sticky top-0 z-30 p-2 border-b border-zinc-200 dark:border-zinc-800 min-w-[46px] w-[48px] cursor-pointer transition-all ${
                        isToday ? 'border-t-4 border-t-orange-500 bg-orange-500/10 dark:bg-orange-950/20' : ''
                      } ${pastDimClass} ${focusDimClass} ${
                        focusHighlight 
                          ? focusHighlight 
                          : isWeekend 
                          ? 'bg-zinc-100 dark:bg-zinc-900' 
                          : d.isHoliday 
                          ? 'bg-amber-50 dark:bg-amber-950/60' 
                          : 'bg-zinc-50 dark:bg-zinc-900'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5 relative">
                        <div className="flex items-center gap-0.5">
                          <span className={`text-[11px] font-bold uppercase ${d.isSunday ? 'text-rose-500' : 'text-zinc-400'}`}>{d.weekday}</span>
                          {d.isHoliday && (
                            <span className="text-[11px] font-black px-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" title={`Feriado: ${d.holidayName || 'Feriado'}`}>
                              FER
                            </span>
                          )}
                          {isProtected && !d.isHoliday && (
                            <span className="text-[11px] font-black px-1 rounded bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" title="Dia Protegido (Pico Sazonal)">
                              🛡️
                            </span>
                          )}
                        </div>
                        <span className={`text-sm font-bold tabular-nums ${d.isSunday ? 'text-rose-600' : isToday ? 'text-orange-600 dark:text-orange-400 font-black' : 'text-zinc-900 dark:text-zinc-100'}`}>
                          {d.num}
                        </span>
                        <span className="text-[11px] font-bold text-zinc-400 tabular-nums">
                          T:{stats.total}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(() => {
                if (displayedEmployees.length === 0) {
                  return (
                    <tr>
                      <td
                        colSpan={filteredDays.length + 1}
                        className="py-10 px-4 text-center text-zinc-500 dark:text-zinc-400"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Icon name="event_busy" className="text-2xl text-zinc-400" />
                          <p className="text-xs font-bold">
                            Nenhum colaborador encontrado para o dia {String(safeSelectedDayIdx + 1).padStart(2, '0')}/{String(currentMY.month + 1).padStart(2, '0')} com os filtros ativos.
                          </p>
                          {(onlyWorkingToday || selectedGroup || contractFilter !== 'all') && (
                            <button
                              type="button"
                              onClick={() => {
                                setOnlyWorkingToday(false);
                                setSelectedGroup(null);
                                setContractFilter('all');
                              }}
                              className="mt-1 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-black uppercase tracking-wider transition-all"
                            >
                              Mostrar Toda a Equipe
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }

                const groups: Record<string, Employee[]> = groupBy === 'role'
                  ? {
                      'Caixa': [],
                      'Pacote': [],
                      'Vendas': [],
                      'Apoio': [],
                      'Fiscal': [],
                      'Estoque': []
                    }
                  : {
                      'Abertura': [],
                      'Intermediário': [],
                      'Fechamento': [],
                      'Folgas/Outros': []
                    };

                const isSunSelected = Boolean(days[safeSelectedDayIdx]?.isSunday);
                const isHolSelected = Boolean(days[safeSelectedDayIdx]?.isHoliday);

                displayedEmployees.forEach(emp => {
                  const hour = (emp.dailyHours[monthKey] || [])[safeSelectedDayIdx] || emp.workPeriod || getDefaultHourForDay(emp, isHolSelected, isSunSelected);
                  const effectiveShift = resolveEffectiveShift(emp, selectedDayDateStr, monthKey, safeSelectedDayIdx);
                  const classification = getShiftClassification(hour, isSunSelected, jornadaSettings);
                  const isOff = !isWorkingShift(effectiveShift);

                  if (groupBy === 'role') {
                    const empRole = normalizeEmployeeRole(emp.cargo || emp.role);
                    if (groups[empRole]) groups[empRole].push(emp);
                    else groups['Apoio'].push(emp);
                  } else {
                    if (isOff) {
                      groups['Folgas/Outros'].push(emp);
                    } else {
                      if (groups[classification]) groups[classification].push(emp);
                      else groups['Fechamento'].push(emp);
                    }
                  }
                });

                return currentGroupOrder.map(groupName => {
                  const emps = groups[groupName] || [];
                  if (emps.length === 0) return null;
                  const isCollapsed = Boolean(collapsedGroups[groupName]);

                  return (
                    <React.Fragment key={groupName}>
                      {/* Group Header Row */}
                      <tr 
                        onClick={() => toggleGroupCollapse(groupName)}
                        tabIndex={0}
                        role="button"
                        aria-expanded={!isCollapsed}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleGroupCollapse(groupName);
                          }
                        }}
                        className="bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-850 border-y border-zinc-200 dark:border-zinc-800 cursor-pointer select-none transition-colors group/groupheader"
                        title={isCollapsed ? `Clique para expandir ${groupName}` : `Clique para minimizar ${groupName}`}
                      >
                        <td className="sticky left-0 z-20 py-1.5 px-3 font-bold text-[11px] uppercase text-zinc-700 dark:text-zinc-200 border-r border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)] w-[240px] min-w-[240px] max-w-[240px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Icon 
                                name={isCollapsed ? "chevron_right" : "expand_more"} 
                                className="text-sm text-zinc-400 group-hover/groupheader:text-zinc-700 dark:group-hover/groupheader:text-zinc-200 shrink-0 transition-transform" 
                              />
                              <span className="truncate">{groupName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isCollapsed && (
                                <span className="text-[10px] text-zinc-400 font-normal lowercase">recolhido</span>
                              )}
                              <span className="text-[11px] font-black px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                {emps.length}
                              </span>
                            </div>
                          </div>
                        </td>
                        {filteredDays.map(d => {
                          const dayIdx = d.num - 1;
                          const countWorking = emps.filter(emp => {
                            const s = resolveEffectiveShift(emp, d.dateStr, monthKey, dayIdx);
                            return isWorkingShift(s);
                          }).length;
                          const isWeekend = d.isSunday || d.weekday === 'SÁB' || d.weekday === 'DOM';
                          const isSelected = safeSelectedDayIdx === dayIdx;
                          return (
                            <td 
                              key={d.num} 
                              className={`h-7 border-b border-zinc-200/80 dark:border-zinc-800 min-w-[46px] w-[48px] text-center font-bold text-[11px] tabular-nums transition-colors ${
                                isSelected 
                                  ? 'bg-orange-500/10 dark:bg-orange-950/20' 
                                  : isWeekend 
                                  ? 'bg-zinc-200/50 dark:bg-zinc-850' 
                                  : 'bg-zinc-100/50 dark:bg-zinc-900'
                              }`} 
                            >
                              {countWorking > 0 ? (
                                <span className="font-black text-zinc-800 dark:text-zinc-200">{countWorking}</span>
                              ) : (
                                <span className="text-zinc-300 dark:text-zinc-600 font-normal">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Employee Rows */}
                      {!isCollapsed && emps.map(emp => {
                        return (
                          <tr 
                            key={emp.id} 
                            className="transition-colors group/row hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50"
                          >
                             <td className="sticky left-0 z-[10] border-b border-r border-zinc-200 dark:border-zinc-800 py-1.5 px-2.5 w-[240px] min-w-[240px] max-w-[240px] shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.4)] transition-all bg-white dark:bg-zinc-950">
                               <button 
                                 type="button"
                                 onClick={() => onOpenEmployeeCard(emp)}
                                 title={isReadOnly ? `${emp.name.toUpperCase()} • Clique para acessar cartão individual (requer senha pessoal)` : `${emp.name.toUpperCase()} • Clique para ver escala completa, solicitações ou lançar atestado médico por período`}
                                 className="flex flex-col w-full text-left p-1 rounded-xl transition-all group/name hover:bg-orange-50 dark:hover:bg-orange-950/20"
                               >
                                 <div className="flex items-center justify-between gap-1.5 w-full">
                                   <div className="flex items-center gap-1.5 min-w-0">
                                     <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border shrink-0 transition-colors bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 group-hover/name:bg-orange-100 group-hover/name:text-orange-600 group-hover/name:border-orange-200">
                                       {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                     </div>
                                     <span className="text-sm font-semibold truncate transition-colors text-zinc-900 dark:text-zinc-100 group-hover/name:text-orange-600" title={emp.name.toUpperCase()}>
                                       {getShortName(emp.name, employees)}
                                     </span>
                                   </div>
                                   {(() => {
                                     const role = normalizeEmployeeRole(emp.cargo || emp.role);
                                     const meta = ROLE_VISUAL_MAP[role];
                                     return (
                                       <div className="flex items-center gap-1 shrink-0">
                                         <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${meta.badgeClass}`} title={meta.label}>
                                           {meta.code}
                                         </span>
                                          {!isReadOnly && onOpenPresetForEmployee && (
                                            <span
                                              role="button"
                                              tabIndex={0}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenPresetForEmployee(emp.id);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                  e.stopPropagation();
                                                  onOpenPresetForEmployee(emp.id);
                                                }
                                              }}
                                              title={`Atualizar pré-definições de ${emp.name} (horários, folgas ou completo)`}
                                              aria-label={`Atualizar pré-definições de ${emp.name}`}
                                              className="w-5 h-5 rounded-md flex items-center justify-center text-zinc-400 opacity-0 group-hover/row:opacity-100 focus:opacity-100 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-all cursor-pointer"
                                            >
                                              <Icon name="tune" className="text-xs" />
                                            </span>
                                          )}
                                          {!isReadOnly && onToggleHideEmployee && (
                                            <span
                                              role="button"
                                              tabIndex={0}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleHideEmployee(emp.id);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                  e.stopPropagation();
                                                  onToggleHideEmployee(emp.id);
                                                }
                                              }}
                                              title={`Ocultar ${emp.name} da grade neste mês`}
                                              aria-label={`Ocultar ${emp.name} da grade neste mês`}
                                              className="w-5 h-5 rounded-md flex items-center justify-center text-zinc-400 opacity-0 group-hover/row:opacity-100 focus:opacity-100 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                                            >
                                              <Icon name="visibility_off" className="text-xs" />
                                            </span>
                                          )}
                                          {!isReadOnly && onEditEmployee && (
                                           <span
                                             role="button"
                                             tabIndex={0}
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               onEditEmployee(emp.id);
                                             }}
                                             onKeyDown={(e) => {
                                               if (e.key === 'Enter' || e.key === ' ') {
                                                 e.stopPropagation();
                                                 onEditEmployee(emp.id);
                                               }
                                             }}
                                             title={`Editar cadastro de ${emp.name}`}
                                             aria-label={`Editar cadastro de ${emp.name}`}
                                             className="w-5 h-5 rounded-md flex items-center justify-center text-zinc-400 hover:text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors"
                                           >
                                             <Icon name="edit_square" className="text-xs" />
                                           </span>
                                         )}
                                       </div>
                                     );
                                   })()}
                                 </div>

                                 <div className="flex items-center justify-between gap-1 mt-1 pl-7">
                                   <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400 font-medium truncate">
                                     {emp.workPeriod || '10h às 18h20'}
                                   </span>
                                   <div className="flex items-center gap-1 shrink-0">
                                     {emp.contractType === 'Sazonal' && (
                                       <span className="text-[11px] px-1 rounded bg-amber-100 text-amber-600 font-bold uppercase tracking-wider">Sazonal</span>
                                     )}
                                     {emp.jornada === '5x2' && (
                                       <span className="text-[11px] px-1 rounded bg-purple-100 text-purple-600 font-bold uppercase tracking-wider">5x2</span>
                                     )}
                                   </div>
                                 </div>
                               </button>
                             </td>

                            {/* Shift Cells */}
                            {filteredDays.map(d => {
                              const fullDate = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d.num).padStart(2, '0')}`;
                              const rawShift = resolveEffectiveShift(emp, fullDate, monthKey, d.num - 1);
                              const shift = isWorkingShift(rawShift) ? 'T' : rawShift;
                              
                              const prevStreak = prevWorkStreaks.get(emp.id) || 0;
                              let streak = 0;
                              let hitRest = false;

                              for (let i = d.num - 1; i >= 0; i--) {
                                const checkDate = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                                let s = emp.shifts[monthKey]?.[i];
                                if (emp.hiredAt && checkDate < emp.hiredAt) {
                                  s = 'N/A';
                                } else if (emp.firedAt && checkDate > emp.firedAt) {
                                  s = 'N/A';
                                } else if (emp.atestadoStart && emp.atestadoEnd && checkDate >= emp.atestadoStart && checkDate <= emp.atestadoEnd) {
                                  s = 'AT';
                                } else if (emp.vacationStart && emp.vacationEnd && checkDate >= emp.vacationStart && checkDate <= emp.vacationEnd) {
                                  s = 'FE';
                                }

                                if (isWorkingShift(s) || s === 'C') {
                                  streak++;
                                } else {
                                  hitRest = true;
                                  break;
                                }
                              }

                              if (!hitRest) {
                                streak += prevStreak;
                              }

                              // Cálculo de domingos consecutivos
                              const isSunday = d.isSunday;
                              let isSundayViolation = false;
                              let isSundayWarning = false;
                              let isSundayRestAfterStreak = false;
                              let finalSundayStreak = 0;
                              let currentSunCount = 0;

                              if (isSunday && !emp.isYoungApprentice) {
                                const initialSundayStreak = prevMonthConsecs.get(emp.id) || 0;
                                currentSunCount = initialSundayStreak;
                                
                                for (let i = 0; i < d.num - 1; i++) {
                                  const dDate = new Date(currentMY.year, currentMY.month, i + 1);
                                  if (dDate.getDay() === 0) {
                                    const fullDateI = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                                    let sI = emp.shifts[monthKey]?.[i] || 'T';
                                    if (emp.hiredAt && fullDateI < emp.hiredAt) sI = 'N/A';
                                    else if (emp.firedAt && fullDateI > emp.firedAt) sI = 'N/A';
                                    else if (emp.atestadoStart && emp.atestadoEnd && fullDateI >= emp.atestadoStart && fullDateI <= emp.atestadoEnd) sI = 'AT';
                                    else if (emp.vacationStart && emp.vacationEnd && fullDateI >= emp.vacationStart && fullDateI <= emp.vacationEnd) sI = 'FE';

                                    if (isWorkingShift(sI) || sI === 'C') {
                                      currentSunCount++;
                                    } else {
                                      currentSunCount = 0;
                                    }
                                  }
                                }

                                const isCurrentSundayWorking = isWorkingShift(shift) || shift === 'C';
                                if (isCurrentSundayWorking) {
                                  finalSundayStreak = currentSunCount + 1;
                                  if (finalSundayStreak >= 3) {
                                    isSundayViolation = true;
                                  } else if (finalSundayStreak === 2) {
                                    isSundayWarning = true;
                                  }
                                } else {
                                  if (currentSunCount >= 2) {
                                    isSundayRestAfterStreak = true;
                                  }
                                }
                              }

                              // 6x1 / 5x2 Cycle Badge (Canto Superior Esquerdo)
                              const isWorkingDay = isWorkingShift(shift) || shift === 'C';
                              const maxStreak = emp.jornada === '5x2' ? 5 : 6;
                              let sixByOneBadge: { text: string; className: string; title: string; isHoverOnly?: boolean } | null = null;

                              if (!isReadOnly && shift !== 'N/A' && isWorkingDay) {
                                if (streak > maxStreak) {
                                  sixByOneBadge = {
                                    text: `${streak}º`,
                                    className: 'bg-rose-600 text-white shadow-md ring-2 ring-white dark:ring-zinc-900 animate-pulse',
                                    title: `VIOLAÇÃO CLT: ${streak}º dia consecutivo sem folga! Limite legal da escala é de ${maxStreak} dias seguidos.`
                                  };
                                } else if (streak === maxStreak) {
                                  sixByOneBadge = {
                                    text: `${streak}/${maxStreak}`,
                                    className: 'bg-amber-500 text-white shadow-xs ring-1 ring-white dark:ring-zinc-900',
                                    title: `${streak}º dia consecutivo de trabalho: LIMITE DO CICLO ${maxStreak}x1! O próximo dia DEVE ser folga!`,
                                    isHoverOnly: densityMode === 'clean'
                                  };
                                } else if (streak === maxStreak - 1) {
                                  sixByOneBadge = {
                                    text: `${streak}/${maxStreak}`,
                                    className: 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shadow-2xs',
                                    title: `${streak}º dia consecutivo de trabalho (${streak}/${maxStreak}): Penúltimo dia antes do descanso semanal obrigatório.`,
                                    isHoverOnly: densityMode === 'clean'
                                  };
                                } else if (streak >= 1) {
                                  sixByOneBadge = {
                                    text: `${streak}/${maxStreak}`,
                                    className: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shadow-2xs',
                                    title: `${streak}º dia consecutivo de trabalho no ciclo ${maxStreak}x1.`,
                                    isHoverOnly: densityMode === 'clean'
                                  };
                                }
                              }

                              // Sunday Streak & Compliance Badge (Canto Superior Direito)
                              let sundayBadge: { text: string; className: string; title: string; isHoverOnly?: boolean } | null = null;

                              if (!isReadOnly && isSunday && shift !== 'N/A') {
                                if (emp.isYoungApprentice) {
                                  const isApprenticeWorking = isWorkingShift(shift) || shift === 'C';
                                  if (isApprenticeWorking) {
                                    sundayBadge = {
                                      text: 'D!',
                                      className: 'bg-rose-600 text-white shadow-md ring-2 ring-white dark:ring-zinc-900 animate-pulse',
                                      title: 'VIOLAÇÃO LEGAL: Jovem Aprendiz não pode trabalhar aos domingos!'
                                    };
                                  } else {
                                    sundayBadge = {
                                      text: 'D✓',
                                      className: 'bg-zinc-500/80 text-white shadow-xs ring-1 ring-white dark:ring-zinc-900',
                                      title: 'Jovem Aprendiz: Folga legal de domingo garantida por lei.',
                                      isHoverOnly: densityMode === 'clean'
                                    };
                                  }
                                } else {
                                  const isCurrentSundayWorking = isWorkingShift(shift) || shift === 'C';
                                  
                                  if (isCurrentSundayWorking) {
                                    if (finalSundayStreak >= 3) {
                                      sundayBadge = {
                                        text: `${finalSundayStreak}D`,
                                        className: 'bg-rose-600 text-white shadow-md ring-2 ring-white dark:ring-zinc-900 animate-pulse',
                                        title: `${finalSundayStreak}º Domingo Consecutivo Trabalhado: VIOLAÇÃO CLT! Proibido trabalhar 3 domingos consecutivos.`
                                      };
                                    } else if (finalSundayStreak === 2) {
                                      sundayBadge = {
                                        text: '2D',
                                        className: 'bg-amber-500 text-white shadow-xs ring-1 ring-white dark:ring-zinc-900',
                                        title: '2º Domingo Consecutivo Trabalhado: Atenção ao limite CLT (o próximo domingo deve ser folga obrigatória)!',
                                        isHoverOnly: densityMode === 'clean'
                                      };
                                    } else if (finalSundayStreak === 1) {
                                      sundayBadge = {
                                        text: '1D',
                                        className: 'bg-zinc-700 dark:bg-zinc-700 text-white shadow-xs ring-1 ring-white dark:ring-zinc-900',
                                        title: '1º Domingo Consecutivo Trabalhado: Pode trabalhar mais 1 domingo antes da folga obrigatória.',
                                        isHoverOnly: densityMode === 'clean'
                                      };
                                    }
                                  } else {
                                    // Colaborador de folga no domingo (F, FF, DO, FE, AT, etc.)
                                    if (currentSunCount >= 2) {
                                      sundayBadge = {
                                        text: '3D✓',
                                        className: 'bg-emerald-600 text-white shadow-xs ring-1 ring-white dark:ring-zinc-900 font-black',
                                        title: '3º Domingo: Folga Obrigatória Cumprida! (Respeitou o ciclo CLT após 2 domingos trabalhados — NÃO alterar para trabalho).'
                                      };
                                    } else if (currentSunCount === 1) {
                                      sundayBadge = {
                                        text: '2D✓',
                                        className: 'bg-emerald-500 text-white shadow-xs ring-1 ring-white dark:ring-zinc-900 font-black',
                                        title: 'Folga no 2º Domingo: Trabalhou o domingo anterior e folgou este (Oportunidade para troca/cobertura se a loja precisar de reforço).'
                                      };
                                    } else {
                                      sundayBadge = {
                                        text: '1D✓',
                                        className: 'bg-teal-600 text-white shadow-xs ring-1 ring-white dark:ring-zinc-900 font-black',
                                        title: 'Folga no Domingo: Sem domingos anteriores trabalhados (Totalmente livre/disponível para troca/cobertura).',
                                        isHoverOnly: densityMode === 'clean'
                                      };
                                    }
                                  }
                                }
                              }

                              const is7thDay = streak === 7;
                              const hasAlert = streak > maxStreak && isWorkingDay;
                              const hasCellViolation = hasAlert || isSundayViolation;
                              const todayStr = toLocalISODate();
                               const isPast = d.dateStr < todayStr;
                               const isSelectedCol = safeSelectedDayIdx === d.num - 1;
                               const pastDimClass = isPast && !isSelectedCol && (!isEditable || !allowRetroactive) ? 'opacity-30 grayscale' : '';
                               const dayRequest = !isReadOnly ? (emp.requests || []).find(r => r.date === fullDate) : undefined;
                               const cellDiff = diffs?.find(diff => diff.empId === emp.id && diff.dayIdx === d.num - 1);
                               const focusDimColClass = focusSelectedDay && !isSelectedCol ? 'opacity-40 hover:opacity-100 transition-opacity duration-150' : '';
                               const focusHighlight = isSelectedCol && focusSelectedDay ? 'ring-2 ring-inset ring-orange-500 bg-orange-500/10 dark:bg-orange-950/30' : isSelectedCol ? 'ring-2 ring-inset ring-orange-400/40' : '';


                                const isWeekend = d.isSunday || d.weekday === 'SÁB' || d.weekday === 'DOM';
                                const cellStyle = getShiftCellStyle(shift);
                                return (
                                  <td key={d.num} className={`py-1 px-1 border-b border-zinc-100 dark:border-zinc-800 text-center transition-all relative min-w-[46px] h-[48px] ${isWeekend ? 'bg-zinc-100/60 dark:bg-zinc-900/60' : ''} ${pastDimClass} ${focusDimColClass} ${focusHighlight} ${(!isReadOnly && hasCellViolation) ? 'ring-2 ring-inset ring-red-500 bg-red-500/10' : (!isReadOnly && isSundayWarning) ? 'ring-2 ring-inset ring-amber-500/50 bg-amber-50/20' : ''}`}>
                                   <div className="relative group flex flex-col items-center justify-center">
                                     {/* Indicador 4: Diferença pós-oficialização (Canto Inferior Esquerdo) */}
                                     {!isReadOnly && cellDiff && (
                                       <span 
                                         className="absolute -bottom-0.5 -left-0.5 w-2 h-2 rounded-full bg-amber-500 ring-1.5 ring-white dark:ring-zinc-900 shadow-sm z-30 cursor-help"
                                         title={`Alteração pós-oficialização (${cellDiff.type}): Oficial [${cellDiff.officialVal}] ➔ Atual [${cellDiff.currentVal}]`}
                                         aria-label={`Alteração pós-oficialização (${cellDiff.type}): Oficial [${cellDiff.officialVal}] para Atual [${cellDiff.currentVal}]`}
                                         role="status"
                                       />
                                     )}

                                     {/* Indicador 3: Ciclo 6x1 / 5x2 (Canto Superior Esquerdo) */}
                                     {sixByOneBadge && (
                                       <span
                                         onClick={(e) => { e.stopPropagation(); onSelectDay(d.num - 1); }}
                                         className={`absolute -top-1 -left-1 px-1 py-0 text-[11px] leading-none font-black rounded-full z-30 transition-all cursor-help tracking-tighter ring-1 ring-white dark:ring-zinc-900 ${sixByOneBadge.className} ${sixByOneBadge.isHoverOnly ? 'opacity-0 group-hover:opacity-100' : ''}`}
                                         title={sixByOneBadge.title}
                                         aria-label={sixByOneBadge.title}
                                         role="status"
                                       >
                                         {sixByOneBadge.text}
                                       </span>
                                     )}

                                     {/* Indicador 3: Domingos Consecutivos (Canto Superior Direito) */}
                                     {sundayBadge && (
                                       <span
                                         onClick={(e) => { e.stopPropagation(); onSelectDay(d.num - 1); }}
                                         className={`absolute -top-1 -right-1 px-1 py-0 text-[11px] leading-none font-black rounded-full z-30 transition-all cursor-help tracking-tighter ring-1 ring-white dark:ring-zinc-900 ${sundayBadge.className} ${sundayBadge.isHoverOnly ? 'opacity-0 group-hover:opacity-100' : ''}`}
                                         title={sundayBadge.title}
                                         aria-label={sundayBadge.title}
                                         role="status"
                                       >
                                         {sundayBadge.text}
                                       </span>
                                     )}

                                     {/* Indicador 4: Pedido de Colaborador (Canto Inferior Direito) */}
                                     {dayRequest && (
                                       <div 
                                         className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full z-30 ring-1.5 ring-white dark:ring-zinc-900 cursor-help flex items-center justify-center group/balloon"
                                         role="status"
                                         aria-label={`Pedido do colaborador: ${dayRequest.text} (${dayRequest.status})`}
                                       >
                                         <div className={`w-full h-full rounded-full ${
                                           dayRequest.status === 'granted' ? 'bg-emerald-500' : 
                                           dayRequest.status === 'refused' ? 'bg-red-500' :
                                           dayRequest.status === 'seen' ? 'bg-blue-500' : 
                                           'bg-orange-500 animate-pulse'
                                         }`} />
                                         
                                         <div className="absolute bottom-full right-0 mb-2 w-48 bg-zinc-900 dark:bg-zinc-800 text-white p-3 rounded-2xl shadow-xl opacity-0 invisible group-hover/balloon:opacity-100 group-hover/balloon:visible transition-all z-[100] pointer-events-none scale-95 group-hover/balloon:scale-100 origin-bottom-right">
                                           <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-800" />
                                           <p className="text-[11px] font-black uppercase text-zinc-400 mb-1 border-b border-zinc-700 pb-1">Pedido do Colaborador</p>
                                           <p className="text-xs font-bold leading-snug">{dayRequest.text}</p>
                                           {dayRequest.feedback && (
                                             <div className="mt-2 pt-2 border-t border-zinc-700">
                                               <p className="text-[11px] font-black uppercase text-orange-400 mb-0.5">Resposta do Gerente</p>
                                               <p className="text-[11px] font-bold text-zinc-300 italic">{dayRequest.feedback}</p>
                                             </div>
                                           )}
                                         </div>
                                       </div>
                                     )}

                                     {/* Botão Principal de Turno com Explicabilidade Algorítmica */}
                                     <button
                                       type="button"
                                       onClick={() => onSelectDay(d.num - 1)}
                                       aria-label={`${emp.name}: Dia ${d.num}, ${d.weekday}. Turno: ${shift === 'N/A' ? 'Fora de vigência' : shift}${emp.decisionReasons?.[monthKey]?.[d.num - 1] ? ' • Motivo: ' + DECISION_REASON_LABELS[emp.decisionReasons[monthKey][d.num - 1]] : ''}`}
                                       title={
                                         (() => {
                                           const decisionReason = emp.decisionReasons?.[monthKey]?.[d.num - 1];
                                           const reasonLabel = decisionReason ? DECISION_REASON_LABELS[decisionReason] : undefined;
                                           let baseTitle: string | undefined = undefined;

                                           if (shift === 'N/A') {
                                             baseTitle = emp.hiredAt && fullDate < emp.hiredAt 
                                               ? `Não admitido nesta data (Início: ${emp.hiredAt.split('-').reverse().join('/')})` 
                                               : emp.firedAt && fullDate > emp.firedAt 
                                               ? `Contrato encerrado nesta data (Término: ${emp.firedAt.split('-').reverse().join('/')})`
                                               : 'Desconsiderado (N/A)';
                                           } else if (shift?.startsWith('FF')) {
                                             const explicit = shift.split(' ')[1];
                                             const matched = (holidayCredits[emp.id] || []).find(c => c.id === explicit || c.holidayDate === explicit);
                                             baseTitle = matched ? `Folga Feriado: ${matched.holidayName}` : 'Folga Feriado (FF)';
                                           } else if (shift === 'FE') {
                                             baseTitle = 'Férias (FE)';
                                           } else if (shift === 'AT') {
                                             baseTitle = 'Atestado Médico (AT)';
                                           } else if (shift === 'DO') {
                                             baseTitle = 'Day Off / Aniversário (DO)';
                                           } else if (shift === 'C') {
                                             baseTitle = 'Curso Jovem Aprendiz (C)';
                                           } else if (shift === 'F') {
                                             baseTitle = d.isSunday ? 'Folga de Domingo (F)' : 'Folga Semanal (F)';
                                           } else if (isWorkingShift(shift)) {
                                             const hour = (emp.dailyHours[monthKey] || [])[d.num - 1] || emp.workPeriod;
                                             baseTitle = `Trabalho (${shift}): ${hour}`;
                                           }

                                           if (reasonLabel) {
                                             return baseTitle ? `${baseTitle} • Motivo: ${reasonLabel}` : `Motivo: ${reasonLabel}`;
                                           }
                                           return baseTitle;
                                         })()
                                       }
                                        className={`${isCompactMode ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'} flex items-center justify-center font-bold transition-all shadow-xs relative border ${cellStyle.bg} ${cellStyle.text} ${cellStyle.border} ${
                                          dayRequest ? (
                                            dayRequest.status === 'granted' ? 'ring-1.5 ring-emerald-500/80' :
                                            dayRequest.status === 'refused' ? 'ring-1.5 ring-red-500/80' :
                                            dayRequest.status === 'seen' ? 'ring-1.5 ring-blue-500/80' :
                                            'ring-2 ring-orange-500 animate-pulse'
                                          ) : ''
                                        }`}>
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
                                              return <span className="text-[11px] opacity-80 mt-0.5">{cur}/{total}</span>;
                                            }
                                            return <span className="text-[11px] font-black uppercase mt-0.5">AT</span>;
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
                                              return <span className="text-[11px] opacity-80 mt-0.5">{cur}/{total}</span>;
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      ) : shift === 'C' ? (
                                        <span className="text-[13px] font-bold">C</span>
                                      ) : shift === 'N/A' ? (
                                         <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">-</span>
                                        ) : isWorkingShift(shift) ? (
                                          <span className="text-[13px] font-bold">
                                            {tacticalDisplayMode === 'roles' ? (
                                              (() => {
                                                const assignedRole = emp.dailyAssignedRoles?.[monthKey]?.[d.num - 1] || normalizeEmployeeRole(emp.primaryRole || emp.cargo || emp.role);
                                                const codeMap: Record<string, string> = {
                                                  'Caixa': 'CX',
                                                  'Pacote': 'PC',
                                                  'Vendas': 'VEND',
                                                  'Apoio': 'AP',
                                                  'Fiscal': 'FISC',
                                                  'Estoque': 'ESTQ'
                                                };
                                                return codeMap[assignedRole] || 'T';
                                              })()
                                            ) : tacticalDisplayMode === 'positions' ? (
                                              getTacticalCellCode(emp.tacticalPositions?.[monthKey]?.[d.num - 1] || resolvedPositions[emp.id]) || 'T'
                                            ) : (
                                              'T'
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-[13px] font-bold">{shift.startsWith('FF') ? 'FF' : shift}</span>
                                        )}
                                    </button>

                                    
                                    {isEditable && !isReadOnly && (() => {
                                      const pendingCount = (holidayCredits[emp.id] || []).filter(c => c.status === 'pending').length;
                                      return (
                                        <select
                                          value={isWorkingShift(shift) ? 'T' : shift}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'AT_PERIOD') {
                                              onOpenEmployeeCard(emp, 'atestado', fullDate);
                                              return;
                                            }
                                            onUpdateShift(emp.id, d.num - 1, val as ShiftType);
                                          }}
                                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-50"
                                        >
                                          {shift === 'N/A' && <option value="N/A">Fora do Contrato (N/A)</option>}
                                          <option value="T">Trabalha (T)</option>
                                          <option value="F">Folga (F)</option>
                                          <option value="AT">Atestado Médico (Apenas este dia) 🩺</option>
                                          <option value="AT_PERIOD">🩺 Lançar Atestado por Período / Intervalo...</option>
                                          
                                          {/* Specific Pending Holidays */}
                                          {(holidayCredits[emp.id] || [])
                                            .filter(c => c.status === 'pending')
                                            .map(c => (
                                              <option key={c.id || c.holidayDate} value={`FF ${c.id || c.holidayDate}`}>
                                                FF — {c.holidayName}
                                              </option>
                                            ))
                                          }
                                          
                                          {/* Fallback generic option if no specific pending ones */}
                                          {pendingCount === 0 && !shift?.startsWith('FF') && (
                                            <option value="FF">Folga Feriado (FF)</option>
                                          )}

                                          {/* Current value if it's already an FF */}
                                          {shift?.startsWith('FF') && !(holidayCredits[emp.id] || []).some(c => c.status === 'pending' && `FF ${c.id || c.holidayDate}` === shift) && (
                                            <option value={shift}>
                                              {(() => {
                                                if (shift === 'FF') return 'FF — Folga Feriado';
                                                const explicitKey = shift.split(' ')[1];
                                                const matched = (holidayCredits[emp.id] || []).find(c => c.id === explicitKey || c.holidayDate === explicitKey);
                                                return matched ? `FF — ${matched.holidayName}` : shift.replace('FF ', 'FF — ');
                                              })()}
                                            </option>
                                          )}
                                          <option value="FE">Férias (FE)</option>
                                          <option value="C">Curso (C)</option>
                                          <option value="DO">Aniversário / Day Off (DO)</option>
                                        </select>
                                      );
                                    })()}

                                    {/* Tooltip Rico de Detalhes ao Hover */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none scale-95 group-hover:scale-100 origin-bottom border border-zinc-700/60 text-left">
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900/95 dark:border-t-zinc-800/95" />
                                      <div className="flex items-center justify-between border-b border-zinc-700/80 pb-1.5 mb-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs font-black text-orange-400 tabular-nums">
                                            {String(d.num).padStart(2, '0')}/{String(currentMY.month + 1).padStart(2, '0')}
                                          </span>
                                          <span className="text-[11px] font-bold uppercase text-zinc-300">({d.weekday})</span>
                                        </div>
                                        <span className={`text-[11px] font-black uppercase px-1.5 py-0.5 rounded ${
                                          isWorkingDay ? 'bg-orange-500/20 text-orange-300' : 'bg-emerald-500/20 text-emerald-300'
                                        }`}>
                                          {shift === 'T' ? 'Trabalho (T)' : shift === 'F' ? 'Folga (F)' : shift}
                                        </span>
                                      </div>

                                      <div className="space-y-1.5 text-[11px]">
                                        {isWorkingDay && (() => {
                                          const assignedRole = emp.dailyAssignedRoles?.[monthKey]?.[d.num - 1] || normalizeEmployeeRole(emp.primaryRole || emp.cargo || emp.role);
                                          const primaryRoleNorm = normalizeEmployeeRole(emp.primaryRole || emp.cargo || emp.role);
                                          const isDiff = assignedRole !== primaryRoleNorm;
                                          const dl = dailyDetailedLunchesMap.get(`${emp.id}_${d.num - 1}`);

                                          return (
                                            <>
                                              <div className="flex items-start justify-between gap-2">
                                                <span className="text-zinc-400 font-medium">Função Alocada:</span>
                                                <span className={`font-semibold text-right ${isDiff ? 'text-amber-300 font-bold' : 'text-zinc-100'}`}>
                                                  {assignedRole} {isDiff ? `(1ª: ${primaryRoleNorm})` : ''}
                                                </span>
                                              </div>
                                              {dl?.isCoveringCashier && (
                                                <div className="p-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                                                  <span>🔄 Cobrirá Caixa no almoço ({dl.coveringCashierTime})</span>
                                                </div>
                                              )}
                                              {dl?.coveredByEmployeeName && (
                                                <div className="p-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                                                  <span>🛡️ Coberto por {dl.coveredByEmployeeName} no almoço</span>
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()}

                                        {isWorkingDay && (
                                          <div className="flex items-start justify-between gap-2">
                                            <span className="text-zinc-400 font-medium">Jornada:</span>
                                            <span className="font-semibold text-zinc-100 tabular-nums text-right">
                                              {(emp.dailyHours[monthKey] || [])[d.num - 1] || emp.workPeriod || 'Padrão'}
                                            </span>
                                          </div>
                                        )}

                                        {isWorkingDay && dailyLunchesMap.get(`${emp.id}_${d.num - 1}`) && (
                                          <div className="flex items-start justify-between gap-2">
                                            <span className="text-zinc-400 font-medium">Intervalo Almoço:</span>
                                            <span className="font-semibold text-amber-300 tabular-nums text-right">
                                              {dailyLunchesMap.get(`${emp.id}_${d.num - 1}`)}
                                            </span>
                                          </div>
                                        )}

                                        {isWorkingDay && (
                                          <div className="flex items-start justify-between gap-2">
                                            <span className="text-zinc-400 font-medium">Ciclo {maxStreak}x1:</span>
                                            <span className={`font-semibold tabular-nums text-right ${streak > maxStreak ? 'text-rose-400 font-black' : 'text-zinc-200'}`}>
                                              {streak > maxStreak ? `⚠️ ${streak}º dia (Violação CLT)` : `${streak} de ${maxStreak} dias`}
                                            </span>
                                          </div>
                                        )}

                                        {isSunday && (
                                          <div className="flex items-start justify-between gap-2">
                                            <span className="text-zinc-400 font-medium">Domingo:</span>
                                            <span className={`font-semibold text-right ${finalSundayStreak >= 3 ? 'text-rose-400 font-black' : 'text-zinc-200'}`}>
                                              {isWorkingDay ? `${finalSundayStreak}º domingo consecutivo` : 'Folga de domingo'}
                                            </span>
                                          </div>
                                        )}

                                        {emp.decisionReasons?.[monthKey]?.[d.num - 1] && (
                                          <div className="pt-1.5 border-t border-zinc-700/60 mt-1">
                                            <span className="text-[11px] uppercase font-bold text-zinc-400 block mb-0.5">Motivo da Alocação:</span>
                                            <span className="text-zinc-200 font-medium leading-tight block">
                                              {DECISION_REASON_LABELS[emp.decisionReasons[monthKey][d.num - 1]]}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
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
            {/* Rodapé Fixo de Cobertura por Função */}
            <tfoot className="sticky bottom-0 z-20 bg-white dark:bg-zinc-900 border-t-2 border-zinc-200 dark:border-zinc-800 shadow-xl">
              {/* Linha Principal: Total em Turno (T) */}
              <tr className="bg-zinc-50 dark:bg-zinc-900 font-bold border-b border-zinc-200 dark:border-zinc-800">
                <td className="sticky bottom-0 left-0 z-30 bg-zinc-50 dark:bg-zinc-900 py-2 px-3 text-xs font-black uppercase text-zinc-700 dark:text-zinc-200 border-r border-zinc-200 dark:border-zinc-800 w-[240px] min-w-[240px] max-w-[240px] shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon name="groups" className="text-orange-500 text-sm" />
                      <span className="truncate">Total em Turno (T)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSectorCoverageExpanded(!isSectorCoverageExpanded)}
                      className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-0.5 text-[11px] font-semibold"
                      title={isSectorCoverageExpanded ? "Recolher detalhamento por funções" : "Expandir detalhamento por funções"}
                      aria-label={isSectorCoverageExpanded ? "Recolher detalhamento por funções" : "Expandir detalhamento por funções"}
                    >
                      <span className="hidden sm:inline text-[11px] uppercase font-bold text-zinc-400">{isSectorCoverageExpanded ? 'Ocultar' : 'Funções'}</span>
                      <Icon name={isSectorCoverageExpanded ? "expand_less" : "expand_more"} className="text-sm" />
                    </button>
                  </div>
                </td>
                {filteredDays.map(d => {
                  const dayIdx = d.num - 1;
                  const count = displayedEmployees.filter(emp => {
                    const s = resolveEffectiveShift(emp, d.dateStr, monthKey, dayIdx);
                    return isWorkingShift(s);
                  }).length;
                  const isWeekend = d.isSunday || d.weekday === 'SÁB' || d.weekday === 'DOM';
                  return (
                    <td key={d.num} className={`sticky bottom-0 z-20 py-1.5 px-1 text-center font-bold text-xs tabular-nums border-b border-zinc-200 dark:border-zinc-800 ${
                      isWeekend ? 'bg-zinc-100 dark:bg-zinc-900' : 'bg-zinc-50 dark:bg-zinc-900'
                    }`}>
                      <span className="text-zinc-900 dark:text-zinc-100 font-extrabold">{count}</span>
                    </td>
                  );
                })}
              </tr>

              {/* Linhas das 6 Funções (Expansível) */}
              {isSectorCoverageExpanded && (['Caixa', 'Vendas', 'Pacote', 'Apoio', 'Fiscal', 'Estoque'] as const).map(role => {
                const meta = ROLE_VISUAL_MAP[role];
                return (
                  <tr key={role} className="border-b border-zinc-100 dark:border-zinc-800/60 text-xs">
                    <td className="sticky left-0 z-30 bg-white dark:bg-zinc-900 py-1.5 px-3 border-r border-zinc-200 dark:border-zinc-800 w-[240px] min-w-[240px] max-w-[240px] shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)]">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">{meta.label}</span>
                      </div>
                    </td>
                    {filteredDays.map(d => {
                      const dayIdx = d.num - 1;
                      const count = displayedEmployees.filter(emp => {
                        const assignedRole = emp.dailyAssignedRoles?.[monthKey]?.[dayIdx] || normalizeEmployeeRole(emp.primaryRole || emp.cargo || emp.role);
                        if (assignedRole !== role) return false;
                        const s = resolveEffectiveShift(emp, d.dateStr, monthKey, dayIdx);
                        return isWorkingShift(s);
                      }).length;

                      const isCriticalMissing = (role === 'Caixa' || role === 'Fiscal') && count === 0;
                      const isWeekend = d.isSunday || d.weekday === 'SÁB' || d.weekday === 'DOM';

                      return (
                        <td 
                          key={d.num} 
                          className={`py-1 px-1 text-center text-[11px] tabular-nums border-b border-zinc-100 dark:border-zinc-800/60 ${
                            isCriticalMissing 
                              ? 'bg-red-500/20 text-red-700 dark:text-red-300 font-black ring-1 ring-inset ring-red-500/50' 
                              : count > 0 
                              ? 'text-zinc-700 dark:text-zinc-200 font-semibold' 
                              : 'text-zinc-400 dark:text-zinc-600'
                          } ${isWeekend && !isCriticalMissing ? 'bg-zinc-100/70 dark:bg-zinc-900/70' : ''}`}
                          title={`${count} colaborador(es) em ${meta.label} no dia ${d.num}${isCriticalMissing ? ' ⚠️ ALERTA: Cobertura zero!' : ''}`}
                        >
                          {count}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Linha de Auditoria de Meta 1 CX + 2 VEND por Turno */}
              {isSectorCoverageExpanded && (
                <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-[10px]">
                  <td className="sticky left-0 z-30 bg-zinc-50/90 dark:bg-zinc-900/90 py-1.5 px-3 border-r border-zinc-200 dark:border-zinc-800 w-[240px] min-w-[240px] max-w-[240px] shadow-[4px_0_12px_-2px_rgba(0,0,0,0.08)]">
                    <div className="flex items-center gap-1.5">
                      <Icon name="verified_user" className="text-emerald-500 text-xs" />
                      <span className="font-black uppercase text-zinc-700 dark:text-zinc-200">Meta (1 CX + 2 VEND)</span>
                    </div>
                  </td>
                  {filteredDays.map(d => {
                    const dayIdx = d.num - 1;
                    const isSun = d.isSunday;

                    const activeEmps = displayedEmployees.filter(emp => {
                      const s = resolveEffectiveShift(emp, d.dateStr, monthKey, dayIdx);
                      return isWorkingShift(s);
                    });

                    let abCx = 0, abVend = 0, fcCx = 0, fcVend = 0;
                    activeEmps.forEach(emp => {
                      const h = emp.dailyHours[monthKey]?.[dayIdx] || emp.workPeriod || '';
                      const group = getShiftClassification(h, isSun, jornadaSettings);
                      const role = emp.dailyAssignedRoles?.[monthKey]?.[dayIdx] || normalizeEmployeeRole(emp.primaryRole || emp.cargo || emp.role);
                      if (group === 'Abertura') {
                        if (role === 'Caixa') abCx++;
                        if (role === 'Vendas') abVend++;
                      } else if (group === 'Fechamento') {
                        if (role === 'Caixa') fcCx++;
                        if (role === 'Vendas') fcVend++;
                      }
                    });

                    const abOk = abCx >= 1 && abVend >= 2;
                    const fcOk = fcCx >= 1 && fcVend >= 2;
                    const fullOk = abOk && fcOk;
                    const partialOk = (abCx >= 1 && fcCx >= 1) || (abVend >= 2 || fcVend >= 2);

                    return (
                      <td key={d.num} className="py-1 px-1 text-center font-black">
                        <span className={`inline-block px-1 py-0.5 rounded text-[9px] font-bold ${
                          fullOk 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' 
                            : partialOk 
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' 
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                        title={`Abertura: ${abCx} CX / ${abVend} VEND (${abOk ? 'OK' : 'Falta'}). Fechamento: ${fcCx} CX / ${fcVend} VEND (${fcOk ? 'OK' : 'Falta'})`}
                        >
                          {fullOk ? '100%' : `${abCx + fcCx}C|${abVend + fcVend}V`}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Recados Box in UI */}
      {showNotes && (
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm mt-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon name="campaign" className="text-orange-500" />
              <h3 className="text-[12px] font-black uppercase text-zinc-800 dark:text-zinc-100">Recados Importantes do Mês (Para Impressão)</h3>
            </div>
            <button 
              onClick={onCloseNotes}
              className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-all"
            >
              <Icon name="close" />
            </button>
          </div>
          <textarea
            value={monthNotes}
            onChange={(e) => onUpdateMonthNotes(e.target.value)}
            placeholder="Digite aqui os recados que devem aparecer no rodapé do PDF... (aprox. 450 caracteres cabem no espaço)"
            maxLength={450}
            className="w-full h-24 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none outline-none text-zinc-700 dark:text-zinc-300"
          />
          <div className="text-right mt-1 text-[11px] font-bold text-zinc-400">
            {monthNotes.length} / 450 caracteres
          </div>
        </div>
      )}

      {showGuideModal && (
        <OperationalGuideModal onClose={() => setShowGuideModal(false)} />
      )}

      {/* Modal / Painel Discreto de Visibilidade da Equipe */}
      {showVisibilityModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] max-w-lg w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                  <Icon name="visibility" className="text-xl" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-zinc-900 dark:text-zinc-100">Visibilidade da Equipe</h3>
                  <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    Oculte colaboradores para planejar rascunhos de escala com discrição ou reexiba quando desejar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVisibilityModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Fechar"
              >
                <Icon name="close" className="text-base" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
              {/* Seção 1: Ocultos neste mês */}
              {hiddenEmployeesInMonth.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Icon name="visibility_off" className="text-sm" />
                      <span>Ocultos na Grade deste Mês ({hiddenEmployeesInMonth.length})</span>
                    </span>
                    {onToggleHideEmployee && hiddenEmployeesInMonth.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          hiddenEmployeesInMonth.forEach(emp => onToggleHideEmployee(emp.id));
                        }}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Exibir Todos
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-amber-200 dark:border-amber-900/40 rounded-2xl bg-amber-50/30 dark:bg-amber-950/20 overflow-hidden">
                    {hiddenEmployeesInMonth.map(emp => (
                      <div key={emp.id} className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-black text-xs flex items-center justify-center shrink-0">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate block">
                              {emp.name}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-medium">
                              {emp.cargo || 'Colaborador'}
                            </span>
                          </div>
                        </div>
                        {onToggleHideEmployee && (
                          <button
                            type="button"
                            onClick={() => onToggleHideEmployee(emp.id)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all active:scale-95 shrink-0"
                          >
                            <Icon name="visibility" className="text-xs" />
                            <span>Exibir</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seção 2: Visíveis na grade */}
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Icon name="group" className="text-sm" />
                  <span>Visíveis na Grade ({eligibleEmployeesInMonth.filter(e => !isEmployeeHiddenInMonth(e, monthKey)).length})</span>
                </span>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden">
                  {eligibleEmployeesInMonth
                    .filter(e => !isEmployeeHiddenInMonth(e, monthKey))
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                    .map(emp => (
                      <div key={emp.id} className="p-3 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate block">
                              {emp.name}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-medium">
                              {emp.cargo || 'Colaborador'}
                            </span>
                          </div>
                        </div>
                        {onToggleHideEmployee && (
                          <button
                            type="button"
                            onClick={() => onToggleHideEmployee(emp.id)}
                            className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 shrink-0"
                            title={`Ocultar ${emp.name} da grade neste mês`}
                          >
                            <Icon name="visibility_off" className="text-xs" />
                            <span>Ocultar</span>
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex justify-end">
              <button
                type="button"
                onClick={() => setShowVisibilityModal(false)}
                className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-black text-xs uppercase tracking-wider transition-all"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filter Bottom Sheet Drawer */}
      <MobileFilterDrawer
        isOpen={showMobileFilterDrawer}
        onClose={() => setShowMobileFilterDrawer(false)}
        onlyWorkingToday={onlyWorkingToday}
        setOnlyWorkingToday={setOnlyWorkingToday}
        selectedGroup={selectedGroup}
        setSelectedGroup={setSelectedGroup}
        contractFilter={contractFilter}
        setContractFilter={setContractFilter}
        tacticalDisplayMode={tacticalDisplayMode}
        onToggleTacticalDisplayMode={onToggleTacticalDisplayMode}
        isCompactMode={isCompactMode}
        setIsCompactMode={setIsCompactMode}
        hidePastDays={hidePastDays}
        setHidePastDays={setHidePastDays}
        isCurrentMonth={isCurrentMonth}
        cycleBadgesMode={legacyCycleMode}
        setCycleBadgesMode={setLegacyCycleMode}
        onResetFilters={() => {
          setOnlyWorkingToday(false);
          setSelectedGroup(null);
          setContractFilter('all');
          setHidePastDays(false);
        }}
      />
    </div>
  );
};
