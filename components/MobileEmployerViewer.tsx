import React, { useState, useMemo, useEffect } from 'react';
import { Employee, MonthYear, Holiday, JornadaSettings, ShiftType, TacticalDisplayMode, normalizeEmployeeRole } from '../types';
import { ROLE_VISUAL_MAP, getShiftCellStyle, EmployeeRole } from '../src/utils/design-system';
import { Icon } from './Icon';
import { HolidayCredit } from '../hooks/useHolidayCredits';
import { 
  isWorkingShift, 
  getShiftClassification, 
  calculateLunches 
} from '../hooks/useScheduleEngine';
import { buildHolidaySet, getShortName, isEmployeeActiveInMonth, isEmployeeActiveOnDay } from '../constants';
import { STORAGE_KEYS } from '../src/infrastructure/storage/storageKeys';

interface MobileEmployerViewerProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  deletedNationalHolidays?: string[];
  jornadaSettings: JornadaSettings;
  holidayCredits?: Record<string, HolidayCredit[]> | HolidayCredit[];
  selectedEmployeeId?: string;
  onSelectEmployee: (empId: string) => void;
  onOpenEmployeeCard: (emp: Employee, tab?: 'mes' | 'atual' | 'pedidos' | 'atestado', initialDate?: string) => void;
  onSwitchToFullGrid: () => void;
  onMonthChange: (my: MonthYear) => void;
  onUpdateEmployee?: (empId: string, data: Partial<Employee>) => void;
  tacticalDisplayMode?: TacticalDisplayMode;
  onToggleTacticalDisplayMode?: (mode?: TacticalDisplayMode) => void;
}

const WEEKDAY_NAMES_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAY_SHORT_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export const MobileEmployerViewer: React.FC<MobileEmployerViewerProps> = ({
  employees,
  currentMY,
  customHolidays,
  deletedNationalHolidays = [],
  jornadaSettings,
  holidayCredits,
  selectedEmployeeId,
  onSelectEmployee,
  onOpenEmployeeCard,
  onSwitchToFullGrid,
  onMonthChange,
}) => {
  const [activeTab, setActiveTab] = useState<'hoje' | 'semana' | 'equipe' | 'mes'>('hoje');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'Todos' | EmployeeRole>('Todos');
  const [showEmpSelector, setShowEmpSelector] = useState(false);
  const [selectedDayOffset, setSelectedDayOffset] = useState<number | null>(null);

  // Navegação entre meses
  const handlePrevMonth = () => {
    if (currentMY.month === 0) {
      onMonthChange({ month: 11, year: currentMY.year - 1 });
    } else {
      onMonthChange({ month: currentMY.month - 1, year: currentMY.year });
    }
  };

  const handleNextMonth = () => {
    if (currentMY.month === 11) {
      onMonthChange({ month: 0, year: currentMY.year + 1 });
    } else {
      onMonthChange({ month: currentMY.month + 1, year: currentMY.year });
    }
  };

  const activeEmployees = useMemo(() => {
    return employees.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));
  }, [employees, currentMY]);

  // Colaborador atual com persistência no localStorage
  const currentEmp = useMemo(() => {
    if (selectedEmployeeId) {
      const found = activeEmployees.find(e => e.id === selectedEmployeeId);
      if (found) return found;
    }
    try {
      const cachedId = window.localStorage.getItem(STORAGE_KEYS.viewerSelectedEmpId);
      if (cachedId) {
        const parsed = JSON.parse(cachedId);
        const found = activeEmployees.find(e => e.id === parsed);
        if (found) return found;
        if (activeEmployees.length > 0) return activeEmployees[0];
      }
    } catch {
      // Fallback
    }
    return null;
  }, [activeEmployees, selectedEmployeeId]);

  // Se houver colaborador ativo e a prop for vazia, aciona a seleção
  useEffect(() => {
    if (!selectedEmployeeId && currentEmp) {
      onSelectEmployee(currentEmp.id);
    }
  }, [currentEmp, selectedEmployeeId, onSelectEmployee]);

  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = useMemo(() => buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays), [currentMY.year, customHolidays, deletedNationalHolidays]);

  const today = new Date();
  const isCurrentMonth = currentMY.year === today.getFullYear() && currentMY.month === today.getMonth();
  const todayDayIdx = isCurrentMonth ? Math.min(today.getDate() - 1, daysInMonth - 1) : 0;
  const currentDayIdx = selectedDayOffset !== null ? selectedDayOffset : todayDayIdx;

  // Estatísticas mensais do colaborador
  const empMonthStats = useMemo(() => {
    if (!currentEmp) return { workDays: 0, offDays: 0, sundaysWorked: 0, holidaysWorked: 0 };
    const shifts = currentEmp.shifts[monthKey] || [];
    let workDays = 0;
    let offDays = 0;
    let sundaysWorked = 0;
    let holidaysWorked = 0;

    for (let i = 0; i < daysInMonth; i++) {
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const isOut = !isEmployeeActiveOnDay(currentEmp, dateStr, monthKey, i);
      const s = isOut ? 'N/A' : (shifts[i] || 'T');
      const date = new Date(currentMY.year, currentMY.month, i + 1);
      const isSunday = date.getDay() === 0;
      const isHoliday = holidaySet.has(dateStr);

      if (isWorkingShift(s)) {
        workDays++;
        if (isSunday) sundaysWorked++;
        if (isHoliday) holidaysWorked++;
      } else if (s !== 'N/A') {
        offDays++;
      }
    }

    return { workDays, offDays, sundaysWorked, holidaysWorked };
  }, [currentEmp, monthKey, daysInMonth, currentMY, holidaySet]);

  // Créditos de feriado pendentes
  const empCreditsList = useMemo(() => {
    if (!currentEmp || !holidayCredits) return [];
    if (Array.isArray(holidayCredits)) {
      return (holidayCredits as unknown as Array<{ employeeId?: string; status: string }>).filter(c => c.employeeId === currentEmp.id);
    }
    const record = holidayCredits as Record<string, HolidayCredit[]>;
    return record[currentEmp.id] || [];
  }, [currentEmp, holidayCredits]);

  const pendingCreditsCount = useMemo(() => {
    return empCreditsList.filter(c => c.status === 'pending').length;
  }, [empCreditsList]);

  // Detalhes do dia selecionado para o colaborador
  const todayDetails = useMemo(() => {
    if (!currentEmp) return null;
    const date = new Date(currentMY.year, currentMY.month, currentDayIdx + 1);
    const dow = date.getDay();
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(currentDayIdx + 1).padStart(2, '0')}`;
    const isHoliday = holidaySet.has(dateStr);
    const isSunday = dow === 0;

    const isOut = !isEmployeeActiveOnDay(currentEmp, dateStr, monthKey, currentDayIdx);
    const shift = isOut ? 'N/A' : ((currentEmp.shifts[monthKey] || [])[currentDayIdx] || 'T');
    const isWorking = isWorkingShift(shift);
    const hour = (currentEmp.dailyHours[monthKey] || [])[currentDayIdx] || currentEmp.workPeriod || '10h às 18h20';
    const classification = getShiftClassification(hour, isSunday, jornadaSettings);
    const role = normalizeEmployeeRole(currentEmp.cargo || currentEmp.role);

    // Cálculo escalonado de almoço
    const workingToday = activeEmployees.filter(e => isWorkingShift((e.shifts[monthKey] || [])[currentDayIdx]));
    const lunchTimes = calculateLunches(workingToday, isHoliday, isSunday, undefined, jornadaSettings, {
      monthKey,
      dayIdx: currentDayIdx,
    });
    const empIdxInWorking = workingToday.findIndex(e => e.id === currentEmp.id);
    const lunchInfo = empIdxInWorking !== -1 ? lunchTimes[empIdxInWorking] : null;

    return {
      dayNum: currentDayIdx + 1,
      weekday: WEEKDAY_NAMES_PT[dow],
      dateFormatted: `${String(currentDayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`,
      shift,
      isWorking,
      hour,
      classification,
      role,
      lunchInfo,
      isHoliday,
      isSunday,
      isToday: isCurrentMonth && currentDayIdx === todayDayIdx,
    };
  }, [currentEmp, currentMY, currentDayIdx, monthKey, holidaySet, activeEmployees, jornadaSettings, isCurrentMonth, todayDayIdx]);

  // Escalação da equipe de hoje agrupada por turno
  const todayTeamRoster = useMemo(() => {
    const groups: Record<string, { emp: Employee; hour: string; pos: string | null; shift: ShiftType }[]> = {
      'Abertura': [],
      'Intermediário': [],
      'Fechamento': [],
      'Estoque': [],
      'Folga': []
    };

    const date = new Date(currentMY.year, currentMY.month, currentDayIdx + 1);
    const dow = date.getDay();
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(currentDayIdx + 1).padStart(2, '0')}`;
    const isSunday = dow === 0;

    activeEmployees.forEach(emp => {
      const isOut = !isEmployeeActiveOnDay(emp, dateStr, monthKey, currentDayIdx);
      const shift = isOut ? 'N/A' : ((emp.shifts[monthKey] || [])[currentDayIdx] || 'T');
      if (isOut || shift === 'N/A') return;
      const hour = (emp.dailyHours[monthKey] || [])[currentDayIdx] || emp.workPeriod || '10h às 18h20';
      const isWorking = isWorkingShift(shift);
      const classification = getShiftClassification(hour, isSunday, jornadaSettings);
      const role = normalizeEmployeeRole(emp.cargo || emp.role);

      if (!isWorking) {
        groups['Folga'].push({ emp, hour, pos: role, shift });
      } else {
        if (role === 'Estoque') {
          groups['Estoque'].push({ emp, hour, pos: role, shift });
        } else if (groups[classification]) {
          groups[classification].push({ emp, hour, pos: role, shift });
        } else {
          groups['Fechamento'].push({ emp, hour, pos: role, shift });
        }
      }
    });

    return groups;
  }, [activeEmployees, currentMY, currentDayIdx, monthKey, jornadaSettings]);

  // Colegas no mesmo turno do colaborador
  const peersInSameShift = useMemo(() => {
    if (!todayDetails || !todayDetails.isWorking) return [];
    const groupKey = todayDetails.classification;
    const roster = todayTeamRoster[groupKey] || [];
    return roster.filter(item => item.emp.id !== currentEmp?.id);
  }, [todayDetails, todayTeamRoster, currentEmp]);

  // Linha do tempo dos próximos 7 dias
  const upcomingDays = useMemo(() => {
    if (!currentEmp) return [];
    const list = [];
    const start = isCurrentMonth ? todayDayIdx : 0;
    const end = Math.min(daysInMonth, start + 7);

    for (let i = start; i < end; i++) {
      const date = new Date(currentMY.year, currentMY.month, i + 1);
      const dow = date.getDay();
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const isHoliday = holidaySet.has(dateStr);
      const isSunday = dow === 0;
      const isOut = !isEmployeeActiveOnDay(currentEmp, dateStr, monthKey, i);
      const shift = isOut ? 'N/A' : ((currentEmp.shifts[monthKey] || [])[i] || 'T');
      const hour = (currentEmp.dailyHours[monthKey] || [])[i] || currentEmp.workPeriod || '10h às 18h20';
      const isWorking = isWorkingShift(shift);

      list.push({
        dayNum: i + 1,
        weekday: WEEKDAY_NAMES_PT[dow],
        weekdayShort: WEEKDAY_SHORT_PT[dow],
        dateFormatted: `${String(i + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`,
        shift,
        hour,
        isWorking,
        isSunday,
        isHoliday,
        isToday: isCurrentMonth && i === todayDayIdx,
      });
    }

    return list;
  }, [currentEmp, isCurrentMonth, todayDayIdx, daysInMonth, currentMY, holidaySet, monthKey]);

  // Próximos 2 dias para o Hero Card
  const nextTwoDays = useMemo(() => {
    return upcomingDays.filter(d => !d.isToday).slice(0, 2);
  }, [upcomingDays]);

  // Faixa semanal de 7 dias ao redor do dia atual
  const weekStripDays = useMemo(() => {
    if (!currentEmp) return [];
    const center = currentDayIdx;
    let start = Math.max(0, center - 3);
    let end = Math.min(daysInMonth, start + 7);
    if (end - start < 7 && start > 0) {
      start = Math.max(0, end - 7);
    }
    const days = [];
    for (let i = start; i < end; i++) {
      const date = new Date(currentMY.year, currentMY.month, i + 1);
      const dow = date.getDay();
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const isOut = !isEmployeeActiveOnDay(currentEmp, dateStr, monthKey, i);
      const shift = isOut ? 'N/A' : ((currentEmp.shifts[monthKey] || [])[i] || 'T');
      days.push({
        dayIdx: i,
        dayNum: i + 1,
        weekdayShort: WEEKDAY_SHORT_PT[dow],
        isSunday: dow === 0,
        isHoliday: holidaySet.has(dateStr),
        isToday: isCurrentMonth && i === todayDayIdx,
        isSelected: i === currentDayIdx,
        shift,
      });
    }
    return days;
  }, [currentEmp, currentDayIdx, daysInMonth, currentMY, holidaySet, isCurrentMonth, todayDayIdx, monthKey]);

  // Badges semânticos de turnos usando o Design System oficial
  const getShiftBadge = (shift: ShiftType) => {
    const style = getShiftCellStyle(shift);
    return (
      <span className={`px-2.5 py-1 rounded-xl font-bold text-[11px] uppercase border ${style.bg} ${style.text} ${style.border}`}>
        {style.label}
      </span>
    );
  };

  // Se não houver colaboradores ativos na loja
  if (activeEmployees.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 text-center">
        <div className="w-16 h-16 rounded-3xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4">
          <Icon name="person_search" className="text-3xl" />
        </div>
        <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
          Nenhum colaborador disponível
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mt-1 leading-relaxed">
          Não há colaboradores ativos cadastrados para este mês na loja.
        </p>
        <button
          type="button"
          onClick={onSwitchToFullGrid}
          className="mt-6 min-h-[44px] px-4 rounded-xl bg-orange-500 text-white font-bold text-xs shadow-md shadow-orange-500/20"
          title="Ver grade completa da loja"
        >
          Ver Grade da Loja
        </button>
      </div>
    );
  }

  // ── ONBOARDING / TELA INICIAL DE SELEÇÃO DE PERFIL ───────────────────────────────
  if (!currentEmp || showEmpSelector) {
    const filteredEmployees = activeEmployees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
      const role = normalizeEmployeeRole(emp.cargo || emp.role);
      const matchesRole = roleFilter === 'Todos' || role === roleFilter;
      return matchesSearch && matchesRole;
    });

    return (
      <div className="max-w-md mx-auto min-h-dvh flex flex-col p-5 bg-zinc-50 dark:bg-zinc-950 animate-fade-in">
        {/* Cabeçalho da Loja com Grade Link */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black shadow-md shadow-orange-500/20">
              <Icon name="storefront" className="text-xl" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider block">
                Rhescala • Ri Happy
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold capitalize tabular-nums">
                {new Date(currentMY.year, currentMY.month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSwitchToFullGrid}
            className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:border-orange-500 transition-colors flex items-center gap-1.5 shadow-sm"
            title="Ver grade completa da loja"
          >
            <Icon name="grid_view" className="text-sm text-orange-500" />
            <span>Grade da Loja</span>
          </button>
        </div>

        {/* Boas-Vindas & Instrução */}
        <div className="mt-2 mb-4">
          <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Bem-vindo ao Rhescala
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
            Selecione seu nome para acessar sua escala e horários
          </p>
        </div>

        {/* Barra de Busca Instantânea (iOS Safari Zoom Safe: text-base md:text-sm) */}
        <div className="relative mb-3">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por seu nome..."
            className="w-full h-12 pl-11 pr-4 rounded-xl text-base md:text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <Icon name="close" className="text-base" />
            </button>
          )}
        </div>

        {/* Chips de Filtro Rápido pelas 6 Funções Oficiais */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 custom-scrollbar mb-3">
          {(['Todos', 'Caixa', 'Vendas', 'Pacote', 'Apoio', 'Fiscal', 'Estoque'] as const).map(roleItem => {
            const isSelected = roleFilter === roleItem;
            return (
              <button
                key={roleItem}
                type="button"
                onClick={() => setRoleFilter(roleItem)}
                className={`min-h-[38px] px-3 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-orange-300'
                }`}
              >
                {roleItem}
              </button>
            );
          })}
        </div>

        {/* Lista de Colaboradores em Cards Clicáveis */}
        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-0.5">
          {filteredEmployees.map(emp => {
            const role = normalizeEmployeeRole(emp.cargo || emp.role);
            const meta = ROLE_VISUAL_MAP[role];
            return (
              <button
                type="button"
                key={emp.id}
                onClick={() => {
                  onSelectEmployee(emp.id);
                  try {
                    window.localStorage.setItem(STORAGE_KEYS.viewerSelectedEmpId, JSON.stringify(emp.id));
                  } catch {}
                  setShowEmpSelector(false);
                }}
                className="w-full text-left min-h-[60px] p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between hover:border-orange-500 transition cursor-pointer active:scale-[0.99] shadow-sm group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center font-bold text-xs uppercase shrink-0 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 group-hover:text-orange-600 transition-colors">
                    {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 block truncate group-hover:text-orange-500 transition-colors">
                      {emp.name}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium tabular-nums block">
                      {emp.workPeriod || '10h às 18h20'} • {emp.jornada || '6x1'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${meta.badgeClass}`}>
                    {meta.label}
                  </span>
                  <Icon name="chevron_right" className="text-zinc-400 text-lg group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}

          {filteredEmployees.length === 0 && (
            <div className="p-8 text-center text-zinc-400 text-xs">
              Nenhum colaborador encontrado com os filtros atuais.
            </div>
          )}
        </div>

        {/* Botão de Cancelar Seleção se já houver colaborador ativo */}
        {currentEmp && (
          <button
            type="button"
            onClick={() => setShowEmpSelector(false)}
            className="min-h-[44px] w-full mt-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shadow-sm"
          >
            Voltar para Meu Dia
          </button>
        )}
      </div>
    );
  }

  const role = normalizeEmployeeRole(currentEmp.cargo || currentEmp.role);
  const roleMeta = ROLE_VISUAL_MAP[role];

  return (
    <div className="h-full flex flex-col max-w-lg mx-auto pb-24 animate-fade-in overflow-y-auto custom-scrollbar px-2 sm:px-3 pt-2">
      
      {/* 1. Header Mobile Fixo com Touch Targets de 44px */}
      <header className="h-16 px-4 sticky top-0 z-30 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex items-center justify-between gap-2 mb-3">
        {/* Identificação: Avatar + Nome + Badge */}
        <div 
          onClick={() => setShowEmpSelector(true)}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-black text-xs uppercase shadow-sm shrink-0">
            {currentEmp.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
          </div>
          
          <div className="min-w-0 flex-1">
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase truncate block">
              {currentEmp.name}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[11px] font-bold px-2 py-0.2 rounded-md ${roleMeta.badgeClass}`}>
                {roleMeta.label}
              </span>
            </div>
          </div>
        </div>

        {/* Ações: Trocar Colaborador + Grade da Loja */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowEmpSelector(true)}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold transition-all flex items-center gap-1"
            title="Trocar colaborador"
          >
            <Icon name="sync" className="text-sm" />
            <span>Trocar</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToFullGrid}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold flex items-center justify-center gap-1 transition-all"
            title="Ver grade completa da loja"
          >
            <Icon name="grid_view" className="text-base text-orange-500" />
            <span className="hidden sm:inline">Grade</span>
          </button>
        </div>
      </header>

      {/* Quick Month Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 mb-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-black uppercase shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all"
            title="Mês anterior"
            aria-label="Mês anterior"
          >
            <Icon name="chevron_left" className="text-base" />
          </button>

          <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-200 px-1 font-bold tabular-nums">
            <Icon name="calendar_month" className="text-orange-500 text-sm" />
            <span className="capitalize">
              {new Date(currentMY.year, currentMY.month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all"
            title="Próximo mês"
            aria-label="Próximo mês"
          >
            <Icon name="chevron_right" className="text-base" />
          </button>
        </div>

        {pendingCreditsCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800 text-[11px] font-bold tabular-nums shrink-0">
            <Icon name="stars" className="text-xs text-amber-500" />
            <span>Saldo Folgas: {pendingCreditsCount}d</span>
          </div>
        )}
      </div>

      {/* 2. TAB 1: MEU DIA (HERO CARD + FAIXA SEMANAL) */}
      {activeTab === 'hoje' && todayDetails && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          
          {/* FAIXA SEMANAL (DATE STRIP) */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-2 shadow-sm">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Semana em Curso
              </span>
              {selectedDayOffset !== null && selectedDayOffset !== todayDayIdx && (
                <button
                  type="button"
                  onClick={() => setSelectedDayOffset(null)}
                  className="px-2.5 py-0.5 rounded-full bg-orange-500 text-white text-[11px] font-bold shadow-sm flex items-center gap-1"
                >
                  <Icon name="today" className="text-xs" />
                  <span>Ir para Hoje</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekStripDays.map(d => {
                return (
                  <button
                    key={d.dayIdx}
                    type="button"
                    onClick={() => setSelectedDayOffset(d.dayIdx)}
                    className={`min-h-[56px] py-1.5 px-1 rounded-xl flex flex-col items-center justify-between transition-all ${
                      d.isSelected
                        ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/25'
                        : d.isToday
                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-800'
                        : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100'
                    }`}
                  >
                    <span className={`text-[11px] uppercase tracking-tighter ${d.isSelected ? 'text-white/80' : 'text-zinc-400'}`}>
                      {d.weekdayShort}
                    </span>
                    <span className="text-sm font-black tabular-nums">
                      {d.dayNum}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      d.isSelected
                        ? 'bg-white'
                        : getShiftCellStyle(d.shift).dotColor
                    }`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* HERO CARD "MEU DIA" */}
          <div className="rounded-2xl p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col gap-4">
            
            {/* Topo com Status em Destaque */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                {todayDetails.weekday}, {todayDetails.dateFormatted}
              </span>

              <div className="flex items-center gap-1.5">
                {todayDetails.isWorking ? (
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase">
                    🟢 {todayDetails.classification}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-xs font-bold uppercase">
                    🎉 Descanso
                  </span>
                )}
              </div>
            </div>

            {/* Horário Principal em Destaque (tabular-nums font-black) */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                {todayDetails.isWorking ? 'Horário de Trabalho' : 'Situação do Dia'}
              </span>
              <div className="text-3xl font-black tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
                {todayDetails.isWorking ? todayDetails.hour : (
                  todayDetails.shift === 'FE' ? '🏖️ Férias' :
                  todayDetails.shift === 'DO' ? '🎂 Aniversário (DO)' :
                  todayDetails.shift === 'AT' ? '🩺 Atestado Médico' :
                  todayDetails.shift === 'C' ? '📚 Curso Teórico' : '🎉 Folga Semanal'
                )}
              </div>
            </div>

            {/* Box de Refeição Calculada */}
            {todayDetails.isWorking && (
              <div className="bg-zinc-100 dark:bg-zinc-800/70 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🍽️</span>
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                      Intervalo de Almoço
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Horário sugerido para escala
                    </span>
                  </div>
                </div>

                <span className="text-sm font-black tabular-nums text-orange-600 dark:text-orange-400 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  {todayDetails.lunchInfo || 'Conforme escala'}
                </span>
              </div>
            )}

            {/* Função Oficial */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase">Função Oficial</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${roleMeta.badgeClass}`}>
                {roleMeta.label} ({roleMeta.code})
              </span>
            </div>
          </div>

          {/* Colegas no Mesmo Turno */}
          {todayDetails.isWorking && peersInSameShift.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-2.5">
              <span className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-300 tracking-wider block">
                👥 Sua Equipe no Turno {todayDetails.classification} ({peersInSameShift.length + 1})
              </span>
              <div className="flex flex-wrap gap-2">
                {peersInSameShift.map(({ emp }) => (
                  <div 
                    key={emp.id}
                    className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                  >
                    <span>{getShortName(emp.name, employees)}</span>
                    <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                      • {normalizeEmployeeRole(emp.cargo || emp.role)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Próximos 2 Dias */}
          {nextTwoDays.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-300 tracking-wider block">
                📅 Próximos Dias
              </span>
              <div className="grid grid-cols-2 gap-2">
                {nextTwoDays.map(d => (
                  <div key={d.dayNum} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{d.weekdayShort} {d.dayNum}</span>
                      {getShiftBadge(d.shift)}
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate mt-1 tabular-nums">
                      {d.isWorking ? d.hour : 'Sem jornada'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botão de Solicitação de Troca de Turno ou Folga */}
          <button
            type="button"
            onClick={() => {
              if (currentEmp) onOpenEmployeeCard(currentEmp, 'pedidos');
            }}
            className="w-full min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl shadow-md shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Icon name="add_circle" className="text-lg" />
            <span>+ Solicitar Troca de Turno ou Folga</span>
          </button>

          {/* Cartão Pessoal & Solicitações */}
          <button
            type="button"
            onClick={() => {
              if (currentEmp) onOpenEmployeeCard(currentEmp, 'pedidos');
            }}
            className="w-full min-h-[48px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex items-center justify-between hover:border-orange-400 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center text-lg shrink-0">
                <Icon name="badge" />
              </div>
              <div>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight block">
                  Cartão Pessoal & Solicitações
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                  Total de {empMonthStats.workDays} dias de trabalho e {empMonthStats.offDays} folgas no mês
                </span>
              </div>
            </div>
            <Icon name="arrow_forward" className="text-zinc-400 text-lg shrink-0" />
          </button>

        </div>
      )}

      {/* 3. TAB 2: PRÓXIMOS 7 DIAS */}
      {activeTab === 'semana' && (
        <div className="space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
              Próximos 7 Dias
            </span>
            <span className="text-xs font-bold text-orange-500 uppercase">
              {currentEmp?.name}
            </span>
          </div>

          <div className="space-y-2">
            {upcomingDays.map((d) => (
              <div 
                key={d.dayNum}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 min-h-[56px] ${
                  d.isToday
                    ? 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800 ring-1 ring-orange-400/30'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 ${
                    d.isSunday 
                      ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-600' 
                      : d.isToday
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                  }`}>
                    <span className="text-sm leading-none tabular-nums font-black">{d.dayNum}</span>
                    <span className="text-[11px] uppercase tracking-tighter mt-0.5">{d.weekdayShort}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {d.isToday ? 'Hoje' : d.weekday}
                      </span>
                      {d.isHoliday && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 font-bold uppercase">Feriado</span>}
                    </div>
                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mt-0.5 tabular-nums">
                      {d.isWorking ? d.hour : 'Sem jornada'}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  {getShiftBadge(d.shift)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. TAB 3: QUEM TRABALHA HOJE NA LOJA */}
      {activeTab === 'equipe' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
              Escalação da Loja Hoje
            </span>
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 tabular-nums">
              {todayDetails?.dateFormatted} ({todayDetails?.weekday})
            </span>
          </div>

          {['Abertura', 'Intermediário', 'Fechamento', 'Estoque', 'Folga'].map(groupName => {
            const roster = todayTeamRoster[groupName];
            if (!roster || roster.length === 0) return null;

            return (
              <div key={groupName} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <span className="text-xs font-bold uppercase text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      groupName === 'Abertura' ? 'bg-amber-500' :
                      groupName === 'Intermediário' ? 'bg-blue-500' :
                      groupName === 'Fechamento' ? 'bg-indigo-600' :
                      groupName === 'Estoque' ? 'bg-emerald-600' : 'bg-rose-500'
                    }`} />
                    {groupName}
                  </span>
                  <span className="text-xs font-semibold text-zinc-400 uppercase tabular-nums">
                    {roster.length} {roster.length === 1 ? 'colaborador' : 'colaboradores'}
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {roster.map(({ emp, hour, shift }) => {
                    const isMe = emp.id === currentEmp?.id;
                    const empRole = normalizeEmployeeRole(emp.cargo || emp.role);
                    const meta = ROLE_VISUAL_MAP[empRole];
                    return (
                      <div 
                        key={emp.id}
                        className={`p-2.5 rounded-xl flex items-center justify-between gap-2.5 min-h-[48px] ${
                          isMe ? 'bg-orange-50 dark:bg-orange-950/30 ring-1 ring-orange-400' : 'bg-zinc-50/80 dark:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase shrink-0">
                            {emp.name.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase truncate block">
                              {emp.name} {isMe && '(Você)'}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium tabular-nums">
                              {isWorkingShift(shift) ? hour : 'Folga'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isWorkingShift(shift) && (
                            <span className={`px-2 py-0.5 rounded-lg font-bold text-[11px] uppercase ${meta.badgeClass}`}>
                              {meta.label}
                            </span>
                          )}
                          {!isWorkingShift(shift) && getShiftBadge(shift)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. TAB 4: MÊS TODO (HÍBRIDO MINI-GRID + LISTA DE AGENDA VERTICAL) */}
      {activeTab === 'mes' && currentEmp && (
        <div className="space-y-3 animate-in fade-in duration-200">
          
          {/* Barra de Mês com Navegação tabular-nums */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all"
                title="Mês anterior"
                aria-label="Mês anterior"
              >
                <Icon name="chevron_left" className="text-xl" />
              </button>

              <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 px-1 font-extrabold text-sm capitalize tabular-nums">
                <Icon name="calendar_month" className="text-orange-500 text-lg" />
                <span>
                  {new Date(currentMY.year, currentMY.month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all"
                title="Próximo mês"
                aria-label="Próximo mês"
              >
                <Icon name="chevron_right" className="text-xl" />
              </button>
            </div>

            {pendingCreditsCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 text-xs font-bold shrink-0">
                <Icon name="stars" className="text-sm text-amber-500" />
                <span>{pendingCreditsCount}d Folga</span>
              </div>
            )}
          </div>

          {/* MINI-GRID COMPACTO (7 COLUNAS: DOM..SÁB) */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm">
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEKDAY_SHORT_PT.map((w, idx) => (
                <span key={w} className={`text-[11px] font-bold ${idx === 0 ? 'text-rose-500' : 'text-zinc-400'}`}>
                  {w}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {/* Espaços vazios no início do mês */}
              {Array.from({ length: new Date(currentMY.year, currentMY.month, 1).getDay() }, (_, i) => (
                <div key={`empty-${i}`} className="min-h-[44px] rounded-xl" />
              ))}

              {/* Dias do mês */}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const date = new Date(currentMY.year, currentMY.month, i + 1);
                const isSunday = date.getDay() === 0;
                const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                const isOut = !isEmployeeActiveOnDay(currentEmp, dateStr, monthKey, i);
                const shift = isOut ? 'N/A' : ((currentEmp.shifts[monthKey] || [])[i] || 'T');
                const isToday = isCurrentMonth && i === todayDayIdx;
                const isSelected = i === currentDayIdx;
                const cellStyle = getShiftCellStyle(shift);

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDayOffset(i)}
                    className={`min-h-[44px] p-1 rounded-xl flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-orange-500 text-white font-bold shadow-md'
                        : isToday
                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-300'
                        : isSunday
                        ? 'bg-rose-500/5 text-rose-600'
                        : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="text-xs font-bold tabular-nums leading-none">{i + 1}</span>
                    <span className={`w-2 h-2 rounded-full mt-1 ${isSelected ? 'bg-white' : cellStyle.dotColor}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* TÍTULO EXIGIDO PELOS TESTES: Escala Completa do Mês */}
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
              Escala Completa do Mês
            </span>
            <span className="text-xs font-bold text-orange-500 uppercase">
              {currentEmp.name}
            </span>
          </div>

          {/* LISTA DE AGENDA VERTICAL COM CARDS HORIZONTAIS */}
          <div className="space-y-2">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = new Date(currentMY.year, currentMY.month, i + 1);
              const dow = date.getDay();
              const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
              const isHoliday = holidaySet.has(dateStr);
              const isSunday = dow === 0;
              const isOut = !isEmployeeActiveOnDay(currentEmp, dateStr, monthKey, i);
              const shift = isOut ? 'N/A' : ((currentEmp.shifts[monthKey] || [])[i] || 'T');
              const isWorking = isWorkingShift(shift);
              const isToday = isCurrentMonth && i === todayDayIdx;
              const hour = (currentEmp.dailyHours[monthKey] || [])[i] || currentEmp.workPeriod || '10h às 18h20';

              return (
                <div 
                  key={i}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 min-h-[60px] ${
                    isToday
                      ? 'ring-2 ring-orange-500 bg-orange-50/80 dark:bg-orange-950/25 border-orange-400'
                      : isOut || shift === 'N/A'
                      ? 'bg-zinc-50 dark:bg-zinc-900/50 border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 opacity-60'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 ${
                      isToday
                        ? 'bg-orange-500 text-white'
                        : isSunday
                        ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-600'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                    }`}>
                      <span className="text-sm font-black leading-none tabular-nums">{i + 1}</span>
                      <span className="text-[11px] uppercase tracking-tighter mt-0.5">{WEEKDAY_SHORT_PT[dow]}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {isToday ? 'Hoje' : WEEKDAY_NAMES_PT[dow]}
                        </span>
                        {isHoliday && <span className="text-[11px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold uppercase">Feriado</span>}
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block mt-0.5 tabular-nums">
                        {isOut || shift === 'N/A' ? 'Fora de vigência' : isWorking ? hour : 'Folga'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {getShiftBadge(shift)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. NAVEGAÇÃO INFERIOR CONSOLIDADA (TOUCH TARGETS 44x44px) */}
      <nav 
        aria-label="Navegação móvel"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 px-3 py-1 shadow-lg pb-[max(env(safe-area-inset-bottom),0.5rem)]"
      >
        <div className="grid grid-cols-4 max-w-md mx-auto items-center">
          {[
            { id: 'hoje', label: 'Hoje', sub: 'Meu Dia', icon: 'today' },
            { id: 'semana', label: '7 Dias', sub: 'Semana', icon: 'date_range' },
            { id: 'equipe', label: 'Quem Trabalha', sub: 'Equipe', icon: 'groups' },
            { id: 'mes', label: 'Mês Todo', sub: 'Agenda', icon: 'calendar_view_month' },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as 'hoje' | 'semana' | 'equipe' | 'mes')}
                className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center rounded-xl transition-all relative ${
                  isActive 
                    ? 'text-orange-600 dark:text-orange-400 font-black' 
                    : 'text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-orange-50 dark:bg-orange-950/50 scale-105' : ''}`}>
                  <Icon name={tab.icon} className="text-xl" />
                </div>
                <span className="text-[11px] tracking-tight truncate mt-0.5 font-bold">
                  {tab.label}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 absolute bottom-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
};

export default MobileEmployerViewer;
