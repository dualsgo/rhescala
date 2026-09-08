import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Employee, ShiftType, MonthYear, Holiday, JornadaSettings, ScheduleDiffItem, TacticalDisplayMode, ProtectedDaysConfig } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, buildHolidaySet, getNationalHolidays, getShortName, DEFAULT_JORNADA_SETTINGS, isEmployeeActiveInMonth, normalizeProtectedDaysConfig, getTacticalLabel, getTacticalCellCode, getTacticalEmoji } from '../constants';
import { getShiftClassification, isWorkingShift, getPrevMonthWorkStreak, getPrevMonthConsecutive } from '../hooks/useScheduleEngine';
import { OperationalGuideModal } from './OperationalGuideModal';

import { HolidayCredit } from '../hooks/useHolidayCredits';

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
  allowRetroactive?: boolean;
  showNotes?: boolean;
  onCloseNotes?: () => void;
  onFilterChange: (f: 'all' | 'sunday' | 'holiday' | 'week') => void;
  jornadaSettings?: JornadaSettings;
  resolvedPositions: Record<string, string>;
  onOpenEmployeeCard: (emp: Employee, tab?: 'mes' | 'atual' | 'pedidos' | 'atestado', initialDate?: string) => void;
  diffs?: ScheduleDiffItem[];
  onOpenPresetForEmployee?: (empId: string) => void;
  protectedDays?: ProtectedDaysConfig | number[];
  onOpenProtectedModal?: () => void;
  onToggleProtectDay?: (dayNum: number) => void;
  tacticalDisplayMode?: TacticalDisplayMode;
  onToggleTacticalDisplayMode?: (mode?: TacticalDisplayMode) => void;
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
  protectedDays = {},
  onOpenProtectedModal,
  onToggleProtectDay,
  monthNotes = '',
  onUpdateMonthNotes = () => {},
  isReadOnly = false,
  isEditable,
  allowRetroactive = false,
  showNotes = false,
  onCloseNotes = () => {},
  onFilterChange,
  jornadaSettings = DEFAULT_JORNADA_SETTINGS,
  resolvedPositions,
  onOpenEmployeeCard,
  onShareWhatsApp,
  diffs = [],
  onOpenPresetForEmployee,
  tacticalDisplayMode = 'positions',
  onToggleTacticalDisplayMode,
}) => {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const [hasScrolled, setHasScrolled] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [contractFilter, setContractFilter] = useState<'all' | 'clt' | 'sazonal'>('all');
  const [hidePastDays, setHidePastDays] = useState(false);
  const [onlyWorkingToday, setOnlyWorkingToday] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [focusSelectedDay, setFocusSelectedDay] = useState(false);

  const protectedConfig = useMemo(() => normalizeProtectedDaysConfig(protectedDays), [protectedDays]);

  const isCurrentMonth = currentMY.year === today.getFullYear() && currentMY.month === today.getMonth();
  const todayDayNum = today.getDate();

  // Auto-scroll to today on mount or when month changes to current month
  useEffect(() => {
    const todayDate = new Date();
    const isCurrent = currentMY.year === todayDate.getFullYear() && currentMY.month === todayDate.getMonth();
    
    if (isCurrent && scrollContainerRef.current && !hidePastDays) {
      const todayDay = todayDate.getDate();
      if (todayDay > 1) {
        const colWidth = isCompactMode ? 48 : 60;
        const scrollPos = (todayDay - 1) * colWidth;
        
        const timeout = setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
          }
        }, 300);
        return () => clearTimeout(timeout);
      }
    }
  }, [currentMY.month, currentMY.year, hidePastDays, isCompactMode]);

  const legendItems = useMemo(() => {
    const baseItems = [
      { code: 'F', label: 'Folga Comum', color: 'bg-rose-500' },
      { code: 'FF', label: 'Folga de Feriado', color: 'bg-amber-500' },
      { code: 'FE', label: 'Férias', color: 'bg-emerald-500' },
      { code: 'DO', label: 'Aniversário / Especial', color: 'bg-fuchsia-600' },
      { code: 'C', label: 'Curso / Treinamento', color: 'bg-slate-500' },
      { code: 'AT', label: 'Atestado Médico', color: 'bg-rose-400' },
      { code: '7º', label: '7º Dia (Limite 6x1)', color: 'bg-rose-600' },
      { code: '3D', label: '3º Domingo (Limite CLT)', color: 'bg-rose-600' },
      { code: '2D', label: '2º Domingo Trabalhado', color: 'bg-amber-500' },
    ];

    const tacticalItems = tacticalDisplayMode === 'roles' ? [
      { code: 'CX', label: 'Caixa', color: 'bg-red-600' },
      { code: 'PC', label: 'Pacote', color: 'bg-orange-500' },
      { code: 'FISC', label: 'Fiscal', color: 'bg-amber-500' },
      { code: 'ATEND', label: 'Atendimento', color: 'bg-emerald-600' },
      { code: 'APOIO', label: 'Apoio', color: 'bg-blue-600' },
      { code: 'ESTQ', label: 'Estoque', color: 'bg-slate-700' },
    ] : [
      { code: 'P1', label: 'P1 (Caixa)', color: 'bg-red-600' },
      { code: 'PC', label: 'PC (Pacote)', color: 'bg-orange-500' },
      { code: 'P2', label: 'P2 (Porta)', color: 'bg-amber-500' },
      { code: 'P3', label: 'P3 (Salão)', color: 'bg-emerald-600' },
      { code: 'P4', label: 'P4 (Apoio)', color: 'bg-blue-600' },
      { code: 'ESTQ', label: 'ESTQ (Estoque)', color: 'bg-slate-700' },
    ];

    return [...baseItems, ...tacticalItems];
  }, [tacticalDisplayMode]);

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

  const displayedEmployees = useMemo(() => {
    let list = [...employees].filter(e => !e.isHidden && e.status === 'active');
    if (contractFilter === 'clt') list = list.filter(e => e.contractType !== 'Sazonal');
    else if (contractFilter === 'sazonal') list = list.filter(e => e.contractType === 'Sazonal');

    if (onlyWorkingToday) {
      list = list.filter(emp => {
        const currentShift = emp.shifts[monthKey]?.[selectedDayIdx];
        return isWorkingShift(currentShift) || currentShift === 'C';
      });
    }

    return list.sort((a, b) => (a.workPeriod || '').localeCompare(b.workPeriod || '') || a.name.localeCompare(b.name));
  }, [employees, contractFilter, onlyWorkingToday, monthKey, selectedDayIdx]);

  return (
    <div className="flex flex-col gap-4 relative h-full">
      {/* Top Controls: 3 Clear Semantic Segmented Groups */}
      <div className="flex flex-col gap-2.5">
        {isReadOnly && (
          <button 
            onClick={() => setShowGuideModal(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-2.5 rounded-2xl shadow-md flex items-center justify-center gap-2.5 transition-transform hover:scale-[1.01] active:scale-95 animate-in fade-in"
          >
            <Icon name="menu_book" className="text-lg animate-pulse" />
            <span className="font-black uppercase tracking-widest text-xs">📖 Manual de Boas Práticas da Loja</span>
          </button>
        )}

        {/* Linha 1: Contexto Operacional do Dia & Ações Imediatas */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-zinc-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm w-full">
          {/* Lado Esquerdo: Dia Selecionado & Ações Diárias */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Âncora do Dia Selecionado */}
            <button
              type="button"
              onClick={() => onOpenDayDetail(selectedDayIdx)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                isCurrentMonth && (selectedDayIdx + 1) === todayDayNum
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                  : 'bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
              title="Clique para abrir o Resumo Operacional detalhado deste dia (escalas, almoços e postos)"
            >
              <span className={`w-2 h-2 rounded-full ${isCurrentMonth && (selectedDayIdx + 1) === todayDayNum ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>
                {isCurrentMonth && (selectedDayIdx + 1) === todayDayNum ? 'Hoje' : 'Dia'}: {String(selectedDayIdx + 1).padStart(2, '0')}/{String(currentMY.month + 1).padStart(2, '0')} {days[selectedDayIdx]?.weekday ? `(${days[selectedDayIdx].weekday})` : ''}
              </span>
              <Icon name="visibility" className="text-xs text-slate-400 dark:text-zinc-400" />
            </button>

            {/* Botão WhatsApp do Dia */}
            {onShareWhatsApp && (
              <button
                type="button"
                onClick={() => onShareWhatsApp(selectedDayIdx)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-sm shadow-emerald-600/20 active:scale-95 whitespace-nowrap"
                title="Copiar ou compartilhar escala do dia para o WhatsApp"
              >
                <Icon name="chat" className="text-xs" />
                <span>WhatsApp do Dia</span>
              </button>
            )}

            {/* Foco no Dia Selecionado */}
            <button
              type="button"
              onClick={() => setFocusSelectedDay(!focusSelectedDay)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                focusSelectedDay 
                  ? 'bg-amber-500 border-amber-500 text-white shadow-amber-500/20' 
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700'
              }`}
              title={focusSelectedDay ? 'Desativar efeito de foco' : 'Ofuscar os outros dias com blur e focar apenas neste dia'}
            >
              <Icon name={focusSelectedDay ? 'filter_center_focus' : 'center_focus_weak'} className="text-xs" />
              <span>{focusSelectedDay ? `Dia ${selectedDayIdx + 1}` : 'Foco'}</span>
            </button>

            {/* Restantes (se for mês corrente) */}
            {isCurrentMonth && (
              <button
                type="button"
                onClick={() => setHidePastDays(!hidePastDays)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                  hidePastDays 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-500/20' 
                    : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700'
                }`}
                title={hidePastDays ? 'Exibir o mês inteiro' : 'Ocultar dias passados para focar no restante do mês'}
              >
                <Icon name={hidePastDays ? 'fast_forward' : 'history_toggle_off'} className="text-xs" />
                <span>{hidePastDays ? `Restantes (${daysRemainingCount}d)` : 'Restantes'}</span>
              </button>
            )}

            {/* Dias Protegidos (Apenas Admin) */}
            {!isReadOnly && onOpenProtectedModal && (
              <button
                type="button"
                onClick={onOpenProtectedModal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-[10px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap"
                title="Configurar dias protegidos e limite de folgas"
              >
                <Icon name="shield" className="text-xs text-amber-500" />
                <span>Dias Protegidos</span>
                {Object.keys(protectedConfig).length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 text-[9px] font-black">
                    {Object.keys(protectedConfig).length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Lado Direito: Modos de Exibição & Controles */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Alternador de Modo: Posições vs Funções vs Padrão */}
            {onToggleTacticalDisplayMode && (
              <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-xl shadow-inner shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleTacticalDisplayMode('positions')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    tacticalDisplayMode === 'positions'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-zinc-700'
                  }`}
                  title="Modo Posições: Exibir códigos P1, P2, P3, P4 e ESTQ"
                >
                  <span>🏷️ Posições</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTacticalDisplayMode('roles')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    tacticalDisplayMode === 'roles'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-zinc-700'
                  }`}
                  title="Modo Funções: Exibir funções Caixa, Fiscal, Atendimento, Apoio e Estoque"
                >
                  <span>👔 Funções</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTacticalDisplayMode('off')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    tacticalDisplayMode === 'off'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-zinc-700'
                  }`}
                  title="Modo Padrão: Ocultar posições e exibir apenas T e Folgas"
                >
                  <span>🔘 T</span>
                </button>
              </div>
            )}

            {/* Modo Denso */}
            <button
              type="button"
              onClick={() => setIsCompactMode(!isCompactMode)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                isCompactMode 
                  ? 'bg-purple-600 border-purple-600 text-white shadow-purple-500/20' 
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700'
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
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                showLegend 
                  ? 'bg-orange-500 border-orange-500 text-white shadow-orange-500/20' 
                  : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700'
              }`}
              title="Exibir ou ocultar legenda de turnos e posições"
            >
              <Icon name="info" className="text-xs" />
              <span>Legenda</span>
              <Icon name={showLegend ? 'expand_less' : 'expand_more'} className="text-xs" />
            </button>
          </div>
        </div>

        {/* Linha 2: Barra de Filtros & Segmentação da Equipe */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/90 dark:bg-zinc-900/80 p-1.5 sm:p-2 rounded-2xl border border-slate-200/70 dark:border-zinc-800 w-full">
          {/* Lado Esquerdo: Filtros de Equipe e Presença */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro: Presença Diária */}
            <button
              type="button"
              onClick={() => setOnlyWorkingToday(!onlyWorkingToday)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all shadow-sm whitespace-nowrap ${
                onlyWorkingToday 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-500/20' 
                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50'
              }`}
              title="Filtrar apenas colaboradores escalados para trabalhar no dia selecionado"
            >
              <Icon name={onlyWorkingToday ? 'check_circle' : 'person_pin_circle'} className="text-xs" />
              <span>{onlyWorkingToday ? 'Apenas Escalados Hoje' : 'Quem Trabalha Hoje'}</span>
            </button>

            {/* Filtro: Turno do Colaborador */}
            <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-0.5 rounded-xl shadow-sm shrink-0 overflow-x-auto custom-scrollbar">
              <button 
                type="button"
                onClick={() => setSelectedGroup(null)}
                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  !selectedGroup ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Todos os Turnos
              </button>
              {['Abertura', 'Intermediário', 'Fechamento', 'Folgas/Outros'].map(group => (
                <button 
                  type="button"
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    selectedGroup === group ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {group.split('/')[0]}
                </button>
              ))}
            </div>

            {/* Filtro: Tipo de Contrato */}
            <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-0.5 rounded-xl shadow-sm shrink-0">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'clt', label: 'CLT' },
                { id: 'sazonal', label: 'Sazonais' }
              ].map(f => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setContractFilter(f.id as any)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    contractFilter === f.id 
                      ? 'bg-orange-500 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lado Direito: Filtro de Período da Grade */}
          <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-0.5 rounded-xl shadow-sm shrink-0">
            {[
              { id: 'all', label: 'Mês Completo', short: 'Mês' },
              { id: 'sunday', label: 'Domingos', short: 'Dom' },
              { id: 'holiday', label: 'Feriados', short: 'Fer' }
            ].map(f => (
              <button
                type="button"
                key={f.id}
                onClick={() => onFilterChange(f.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  filter === f.id 
                    ? 'bg-orange-500 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
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
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-3.5 py-2 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-1 duration-150 w-full">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {legendItems.map(item => (
                <div key={item.code} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 tracking-tight whitespace-nowrap">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-zinc-500 ml-auto select-none">
              <Icon name="touch_app" className="text-orange-400 text-xs" />
              <span>Toque no nome do colaborador para ver detalhes</span>
            </div>
          </div>
        )}
      </div>

      {/* Grid Container */}
      <div className="bg-white dark:bg-black rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden flex-1 flex flex-col relative">
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
                <th className="sticky left-0 z-[50] bg-slate-50 dark:bg-zinc-900 border-b border-r border-slate-200 dark:border-zinc-800 py-2 px-2 sm:px-3 text-left min-w-[110px] sm:min-w-[135px] w-[110px] sm:w-[135px] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-4px_rgba(0,0,0,0.5)]">
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</span>
                </th>
                {!isReadOnly && isEditable && (
                  <>
                    <th className="hidden sm:table-cell sticky left-[110px] sm:left-[135px] z-[50] bg-slate-50 dark:bg-zinc-900 border-b border-r border-slate-200 dark:border-zinc-800 py-2 px-3 text-left min-w-[115px] w-[115px]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário</span>
                    </th>
                    <th className="hidden md:table-cell sticky left-[225px] sm:left-[250px] z-[50] bg-slate-50 dark:bg-zinc-900 border-b border-r border-slate-200 dark:border-zinc-800 py-2 px-3 text-left min-w-[90px] w-[90px]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {tacticalDisplayMode === 'roles' ? 'Função' : 'Posição'}
                      </span>
                    </th>
                  </>
                )}
                {filteredDays.map(d => {
                  const dayIdx = d.num - 1;
                  const stats = employees.reduce((acc, emp) => {
                    if (!isEmployeeActiveInMonth(emp, currentMY.year, currentMY.month)) return acc;
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
                  const isBlurred = focusSelectedDay && !isSelected;
                  const blurClass = isBlurred ? 'opacity-25 blur-[0.6px] grayscale-[30%] hover:opacity-80 hover:blur-none transition-all duration-200' : '';
                  const focusHighlight = isSelected && focusSelectedDay ? 'bg-orange-500/20 ring-2 ring-orange-500 shadow-md scale-[1.02] z-20' : isSelected ? 'bg-orange-500/10 ring-2 ring-inset ring-orange-500/30' : '';

                  const isDayProtected = protectedConfig[d.num] !== undefined;
                  const maxFolgas = isDayProtected ? protectedConfig[d.num] : 0;

                  return (
                    <th 
                      key={d.num} 
                      onClick={() => isSelected ? onOpenDayDetail(dayIdx) : onSelectDay(dayIdx)}
                      className={`p-3 border-b border-slate-200 dark:border-zinc-800 min-w-[60px] cursor-pointer transition-all ${dimClass} ${blurClass} ${focusHighlight ? focusHighlight : d.isSunday ? 'bg-rose-50 dark:bg-rose-950/40' : d.isHoliday ? 'bg-amber-50 dark:bg-amber-950/40' : isDayProtected ? 'bg-amber-50/50 dark:bg-amber-950/30' : ''}`}
                    >
                      <div className="flex flex-col items-center gap-1 relative">
                        <span className="text-[9px] font-black text-slate-400 uppercase">{d.weekday}</span>
                        <div className="flex items-center gap-1">
                          <span className={`text-sm font-black ${d.isSunday ? 'text-rose-600' : isDayProtected ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>{d.num}</span>
                          {isDayProtected && (
                            <span 
                              onClick={(e) => {
                                if (onOpenProtectedModal) {
                                  e.stopPropagation();
                                  onOpenProtectedModal();
                                }
                              }}
                              title={`Dia Protegido: ${maxFolgas === 0 ? '100% da Equipe (0 Folgas)' : `Máximo de ${maxFolgas} folgas`}`} 
                              className="text-amber-500 hover:text-amber-600 flex items-center gap-0.5"
                            >
                              <Icon name="shield" className="text-xs" />
                              {maxFolgas > 0 && <span className="text-[7px] font-black">{maxFolgas}F</span>}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[8px] font-bold text-slate-400 flex items-center gap-1">
                           <span>T:{stats.total}</span>
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
                  if (!isEmployeeActiveInMonth(emp, currentMY.year, currentMY.month)) return;
                  
                  if (contractFilter === 'clt' && emp.contractType === 'Sazonal') return;
                  if (contractFilter === 'sazonal' && emp.contractType !== 'Sazonal') return;

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
                             <td className="sticky left-0 z-[10] bg-white dark:bg-black border-b border-r border-slate-200 dark:border-zinc-800 py-1 px-1.5 sm:py-1.5 sm:px-2 min-w-[110px] sm:min-w-[135px] w-[110px] sm:w-[135px] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-4px_rgba(0,0,0,0.5)]">
                               <button 
                                 onClick={() => onOpenEmployeeCard(emp)}
                                 title={`${emp.name.toUpperCase()} • Clique para ver escala completa, solicitações ou lançar atestado médico por período`}
                                 className="flex items-center gap-1.5 sm:gap-2 w-full text-left hover:bg-orange-50 dark:hover:bg-orange-950/20 p-0.5 sm:p-1 rounded-lg sm:rounded-xl transition-all group/name"
                               >
                                 <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-zinc-800 group-hover/name:bg-orange-100 group-hover/name:text-orange-600 group-hover/name:border-orange-200 transition-colors shrink-0">
                                   {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                 </div>
                                 <div className="flex flex-col min-w-0 flex-1">
                                   <div className="flex items-center gap-1">
                                     <span className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase truncate group-hover/name:text-orange-600 transition-colors" title={emp.name.toUpperCase()}>{getShortName(emp.name, employees)}</span>
                                     {(() => {
                                       if (isReadOnly) return null;
                                       const reqs = emp.requests || [];
                                       const hasAnswered = reqs.some(r => r.date?.startsWith(monthKey) && r.status !== 'pending');
                                       const hasPending = reqs.some(r => r.date?.startsWith(monthKey) && r.status === 'pending');
                                       
                                       if (hasAnswered) {
                                         return (
                                           <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-md animate-pulse-subtle shrink-0" title="Pedido respondido!">
                                             <Icon name="notifications_active" className="text-[9px] text-white" />
                                           </div>
                                         );
                                       }
                                       if (hasPending) {
                                         return (
                                           <div className="w-3.5 h-3.5 bg-orange-500 rounded-full flex items-center justify-center animate-bounce-subtle shrink-0" title="Tem pedidos pendentes">
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
                                 <Icon name="chevron_right" className="hidden sm:block text-slate-300 group-hover/name:text-orange-500 opacity-0 group-hover/name:opacity-100 transition-all text-sm ml-auto shrink-0" />
                               </button>
                             </td>
                              {!isReadOnly && isEditable && (
                                <>
                                  {/* Hours Select */}
                                  <td className="hidden sm:table-cell sticky left-[110px] sm:left-[135px] z-10 bg-white dark:bg-black border-b border-r border-slate-200 dark:border-zinc-800 py-1 px-2 min-w-[115px] w-[115px]">
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
                                        if (isHol) options = [...jornadaSettings.shiftHours.holiday, ...(jornadaSettings.shiftHours.extended || [])];
                                        else if (isSun) options = jornadaSettings.shiftHours.sunday;
                                        else options = [...jornadaSettings.shiftHours.weekday, ...(jornadaSettings.shiftHours.extended || [])];
                                        
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
                                  <td className="hidden md:table-cell sticky left-[225px] sm:left-[250px] z-10 bg-white dark:bg-black border-b border-r border-slate-200 dark:border-zinc-800 py-1 px-2 min-w-[90px] w-[90px]">
                                    <select
                                      value={emp.tacticalPositions?.[monthKey]?.[selectedDayIdx] || 'AUTO'}
                                      onChange={(e) => onUpdateTacticalPosition(emp.id, selectedDayIdx, e.target.value)}
                                      className="w-full bg-transparent border-none p-0 text-[11px] font-black text-slate-900 dark:text-slate-100 focus:ring-0 uppercase"
                                    >
                                      <option value="AUTO" className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100">AUTO 🤖</option>
                                      {(() => {
                                        const finalPositions = ['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'];
                                        return finalPositions.map(p => (
                                          <option key={p} value={p} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100">
                                            {getTacticalLabel(p, tacticalDisplayMode)} {getTacticalEmoji(p)}
                                          </option>
                                        ));
                                      })()}
                                    </select>
                                  </td>
                                </>
                              )}

                            {/* Shift Cells */}
                            {filteredDays.map(d => {
                              const fullDate = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d.num).padStart(2, '0')}`;
                              let rawShift = emp.shifts[monthKey]?.[d.num - 1] || 'T';
                              if (emp.hiredAt && fullDate < emp.hiredAt) {
                                rawShift = 'N/A';
                              } else if (emp.firedAt && fullDate > emp.firedAt) {
                                rawShift = 'N/A';
                              } else if (emp.atestadoStart && emp.atestadoEnd && fullDate >= emp.atestadoStart && fullDate <= emp.atestadoEnd) {
                                rawShift = 'AT';
                              } else if (emp.vacationStart && emp.vacationEnd && fullDate >= emp.vacationStart && fullDate <= emp.vacationEnd) {
                                rawShift = 'FE';
                              }
                              const shift = (isReadOnly && ['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'].includes(rawShift)) ? 'T' : rawShift;
                              
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

                              if (isSunday && !emp.isYoungApprentice) {
                                const initialSundayStreak = prevMonthConsecs.get(emp.id) || 0;
                                let currentSunCount = initialSundayStreak;
                                
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

                              const is7thDay = streak === 7;
                              const hasAlert = streak >= 7 && (isWorkingShift(shift) || shift === 'C');
                              const hasCellViolation = hasAlert || isSundayViolation;
                              const hasTopRightBadge = !isReadOnly && isSunday && (isSundayViolation || isSundayWarning);

                              const todayStr = new Date().toISOString().split('T')[0];
                              const isPast = d.dateStr < todayStr;
                              const dimClass = isPast && (!isEditable || !allowRetroactive) ? 'opacity-30 grayscale' : '';
                              const dayRequest = !isReadOnly ? (emp.requests || []).find(r => r.date === fullDate) : undefined;
                              const cellDiff = diffs?.find(diff => diff.empId === emp.id && diff.dayIdx === d.num - 1);
                              const isSelectedCol = selectedDayIdx === d.num - 1;
                              const isBlurredCol = focusSelectedDay && !isSelectedCol;
                              const blurClass = isBlurredCol ? 'opacity-20 blur-[0.7px] grayscale-[40%] hover:opacity-90 hover:blur-none transition-all duration-200' : '';
                              const focusHighlight = isSelectedCol && focusSelectedDay ? 'ring-2 ring-inset ring-orange-500 bg-orange-50/80 dark:bg-orange-950/40' : isSelectedCol ? 'ring-2 ring-inset ring-orange-400/50' : '';

                              return (
                                <td key={d.num} className={`py-1 px-1 border-b border-slate-50 dark:border-slate-800 text-center transition-all relative ${dimClass} ${blurClass} ${focusHighlight} ${(!isReadOnly && hasCellViolation) ? 'ring-2 ring-inset ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30' : (!isReadOnly && isSundayWarning) ? 'ring-2 ring-inset ring-amber-500/50 bg-amber-50/20' : ''}`}>
                                  <div className="relative group flex flex-col items-center gap-1">
                                    {!isReadOnly && cellDiff && (
                                        <span 
                                          className="absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 shadow-md z-30 cursor-help"
                                          title={`Alteração pós-oficialização (${cellDiff.type}): Oficial [${cellDiff.officialVal}] ➔ Atual [${cellDiff.currentVal}]`}
                                        />
                                    )}
                                    {/* Badge 1: 7º Dia Consecutivo de Trabalho (Canto Superior Esquerdo) - Apenas em alerta de violação CLT */}
                                    {!isReadOnly && hasAlert && (
                                      <span
                                        className="absolute -top-1.5 -left-1.5 px-1 py-0.2 text-[8px] font-black rounded-full shadow-md z-30 transition-all bg-rose-600 text-white ring-2 ring-white dark:ring-slate-900 animate-pulse"
                                        title={`7º Dia Consecutivo: Trabalho sem folga! (${streak} dias seguidos)`}
                                      >
                                        7º
                                      </span>
                                    )}

                                    {/* Badge 2: Domingos Consecutivos (Canto Superior Direito) - Apenas em violação (3D) ou aviso prévio (2D) */}
                                    {!isReadOnly && isSunday && (isSundayViolation || isSundayWarning) && (
                                      <span
                                        className={`absolute -top-1.5 -right-1.5 px-1 py-0.2 text-[8px] font-black rounded-full shadow-md z-30 transition-all ${
                                          isSundayViolation
                                            ? 'bg-rose-600 text-white ring-2 ring-white dark:ring-slate-900 animate-pulse'
                                            : 'bg-amber-500 text-white ring-1 ring-white dark:ring-slate-900'
                                        }`}
                                        title={
                                          isSundayViolation
                                            ? `${finalSundayStreak}º Domingo Consecutivo Trabalhado: Violação CLT (máximo 2 domingos consecutivos)!`
                                            : `2º Domingo Consecutivo Trabalhado: Atenção ao limite CLT (o próximo domingo deve ser folga)!`
                                        }
                                      >
                                        {isSundayViolation ? `${finalSundayStreak}D` : '2D'}
                                      </span>
                                    )}

                                    {/* Badge 3: Pedido de Colaborador */}
                                    {dayRequest && (
                                      <div className={`absolute ${hasTopRightBadge ? '-bottom-1 -right-1' : '-top-1 -right-1'} w-2.5 h-2.5 rounded-full z-10 border-2 border-white dark:border-slate-900 cursor-help flex items-center justify-center group/balloon`}>
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
                                      title={
                                        shift === 'N/A' 
                                          ? (emp.hiredAt && fullDate < emp.hiredAt 
                                              ? `Não admitido nesta data (Início: ${emp.hiredAt.split('-').reverse().join('/')})` 
                                              : emp.firedAt && fullDate > emp.firedAt 
                                              ? `Contrato encerrado nesta data (Término: ${emp.firedAt.split('-').reverse().join('/')})`
                                              : 'Desconsiderado (N/A)') 
                                          : shift?.startsWith('FF')
                                          ? (() => {
                                              const explicit = shift.split(' ')[1];
                                              const matched = (holidayCredits[emp.id] || []).find(c => c.id === explicit || c.holidayDate === explicit);
                                              return matched ? `Folga Feriado: ${matched.holidayName}` : 'Folga Feriado (FF)';
                                            })()
                                          : undefined
                                      }
                                      className={`${isCompactMode ? 'w-8 h-8 rounded-lg text-[9px]' : 'w-10 h-10 rounded-xl text-[10px]'} flex items-center justify-center font-black transition-all shadow-sm relative ${
                                        dayRequest ? (
                                          dayRequest.status === 'granted' ? 'ring-2 ring-emerald-500 bg-emerald-50' :
                                          dayRequest.status === 'refused' ? 'ring-2 ring-red-500 bg-red-50' :
                                          dayRequest.status === 'seen' ? 'ring-2 ring-blue-500 bg-blue-50' :
                                          'ring-4 ring-orange-500 bg-orange-50 animate-pulse z-20'
                                        ) : ''
                                      } ${
                                        shift === 'N/A' ? 'bg-slate-100/70 dark:bg-zinc-800/40 text-slate-400 dark:text-zinc-600 border border-dashed border-slate-200 dark:border-zinc-800 opacity-60' :
                                        shift === 'AT' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50' :
                                        shift === 'F' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' :
                                        shift.startsWith('FF') ? 'bg-amber-100 text-amber-600' :
                                        shift === 'C' ? 'bg-indigo-100 text-indigo-600' :
                                        shift === 'FE' ? 'bg-emerald-100 text-emerald-600' :
                                        shift === 'DO' ? 'bg-fuchsia-600 text-white shadow-md' :
                                        (tacticalDisplayMode !== 'off' && shift === 'P1') ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400' :
                                        (tacticalDisplayMode !== 'off' && shift === 'PC') ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-400' :
                                        (tacticalDisplayMode !== 'off' && shift === 'P2') ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300' :
                                        (tacticalDisplayMode !== 'off' && shift === 'P3') ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400' :
                                        (tacticalDisplayMode !== 'off' && shift === 'P4') ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400' :
                                        (tacticalDisplayMode !== 'off' && shift === 'ESTQ') ? 'bg-slate-700 text-white shadow-md ring-2 ring-slate-500' :
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
                                            return <span className="text-[7px] font-black uppercase mt-0.5">AT</span>;
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
                                      ) : shift === 'C' ? <span className="text-[7px]">CURSO</span> : shift === 'N/A' ? <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono">-</span> : (shift === 'T' ? (d.isSunday ? 'DOM' : 'T') : (shift.startsWith('FF') ? 'FF' : (['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'].includes(shift) ? getTacticalCellCode(shift, tacticalDisplayMode) : shift)))}
                                    </button>

                                    
                                    {isEditable && !isReadOnly && (() => {
                                      const pendingCount = (holidayCredits[emp.id] || []).filter(c => c.status === 'pending').length;
                                      return (
                                        <select
                                          value={shift}
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
                                          <option disabled>──────</option>
                                          <option value="P1">{getTacticalLabel('P1', tacticalDisplayMode)} 🟥</option>
                                          <option value="PC">{getTacticalLabel('PC', tacticalDisplayMode)} 🟧</option>
                                          <option value="P2">{getTacticalLabel('P2', tacticalDisplayMode)} 🟨</option>
                                          <option value="P3">{getTacticalLabel('P3', tacticalDisplayMode)} 🟩</option>
                                          <option value="P4">{getTacticalLabel('P4', tacticalDisplayMode)} 🟦</option>
                                          <option value="ESTQ">{getTacticalLabel('ESTQ', tacticalDisplayMode)} 📦</option>
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
