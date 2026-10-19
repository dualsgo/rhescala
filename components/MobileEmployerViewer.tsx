import React, { useState, useMemo, useEffect } from 'react';
import { Employee, MonthYear, Holiday, JornadaSettings, ShiftType, TacticalDisplayMode, normalizeEmployeeRole, ROLE_METADATA_MAP } from '../types';
import { Icon } from './Icon';
import { HolidayCredit } from '../hooks/useHolidayCredits';
import { 
  isWorkingShift, 
  getShiftClassification, 
  calculateLunches 
} from '../hooks/useScheduleEngine';
import { buildHolidaySet, getShortName, isEmployeeActiveInMonth, isEmployeeActiveOnDay, getTacticalLabel } from '../constants';
import { STORAGE_KEYS } from '../src/infrastructure/storage/storageKeys';
import { toLocalISODate } from '../src/utils/date';

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
  tacticalDisplayMode = 'off',
}) => {
  const [activeTab, setActiveTab] = useState<'hoje' | 'semana' | 'equipe' | 'mes'>('hoje');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmpSelector, setShowEmpSelector] = useState(false);

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
    if (!selectedEmployeeId) {
      // Tenta recuperar do localStorage caso a prop venha vazia
      try {
        const cachedId = window.localStorage.getItem(STORAGE_KEYS.viewerSelectedEmpId);
        if (cachedId) {
          const parsed = JSON.parse(cachedId);
          const found = activeEmployees.find(e => e.id === parsed);
          if (found) return found;
        }
      } catch {
        // Fallback silencioso
      }
    }
    return activeEmployees.find(e => e.id === selectedEmployeeId) || activeEmployees[0] || null;
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
  const currentDayIdx = isCurrentMonth ? today.getDate() - 1 : 0;

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
    if (typeof holidayCredits === 'object') {
      return (holidayCredits as Record<string, HolidayCredit[]>)[currentEmp.id] || [];
    }
    return [];
  }, [currentEmp, holidayCredits]);

  const pendingCreditsCount = useMemo(() => {
    return empCreditsList.filter(c => c.status === 'pending').length;
  }, [empCreditsList]);

  // Detalhes do dia de hoje para o colaborador
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
      isSunday
    };
  }, [currentEmp, currentMY, currentDayIdx, monthKey, holidaySet, activeEmployees, jornadaSettings]);

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
    const isHoliday = holidaySet.has(dateStr);
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
  }, [activeEmployees, currentMY, currentDayIdx, holidaySet, monthKey, jornadaSettings]);

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
    const start = isCurrentMonth ? currentDayIdx : 0;
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
        isToday: isCurrentMonth && i === currentDayIdx
      });
    }

    return list;
  }, [currentEmp, isCurrentMonth, currentDayIdx, daysInMonth, currentMY, holidaySet, monthKey]);

  // Próximos 2 dias para o Hero Card
  const nextTwoDays = useMemo(() => {
    return upcomingDays.filter(d => !d.isToday).slice(0, 2);
  }, [upcomingDays]);

  // Badges semânticos de turnos
  const getShiftBadge = (shift: ShiftType) => {
    if (shift === 'N/A') return <span className="px-2.5 py-1 rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 font-bold text-[11px] uppercase">Fora do Contrato</span>;
    if (shift === 'FE') return <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-black text-[11px] uppercase">Férias</span>;
    if (shift.startsWith('FF')) return <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-black text-[11px] uppercase">Folga Feriado</span>;
    if (shift === 'F') return <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 font-black text-[11px] uppercase">Folga</span>;
    if (shift === 'DO') return <span className="px-2.5 py-1 rounded-xl bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/70 dark:text-fuchsia-300 font-black text-[11px] uppercase">Aniversário</span>;
    if (shift === 'AT') return <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 font-black text-[11px] uppercase">Atestado</span>;
    if (shift === 'C') return <span className="px-2.5 py-1 rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 font-black text-[11px] uppercase">Curso</span>;
    return <span className="px-2.5 py-1 rounded-xl bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 font-black text-[11px] uppercase">Trabalho</span>;
  };

  return (
    <div className="h-full flex flex-col gap-3.5 max-w-lg mx-auto pb-24 animate-fade-in overflow-y-auto custom-scrollbar px-1">
      
      {/* 1. Header Card do Colaborador com Touch Targets Conformes (44px) */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3">
        
        {/* Linha Superior: Perfil + Botão de Trocar + Grade */}
        <div className="flex items-center justify-between gap-2">
          {currentEmp ? (
            <div 
              onClick={() => setShowEmpSelector(true)}
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer p-1.5 -m-1.5 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-black text-base uppercase shadow-md shadow-orange-500/25 shrink-0">
                {currentEmp.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase truncate">
                    {currentEmp.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  <span>{normalizeEmployeeRole(currentEmp.cargo || currentEmp.role)}</span>
                  <span>•</span>
                  <span>{currentEmp.jornada || '6x1'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setShowEmpSelector(true)}
              className="flex items-center gap-3 flex-1 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center">
                <Icon name="person" className="text-2xl" />
              </div>
              <div>
                <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 block">Quem é você na loja?</span>
                <span className="text-xs text-orange-500 font-bold">Toque para selecionar seu nome</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {currentEmp && (
              <button
                type="button"
                onClick={() => setShowEmpSelector(true)}
                className="min-h-[44px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold transition-all"
                title="Trocar colaborador"
              >
                Trocar
              </button>
            )}

            {/* Alternador para Grade Completa */}
            <button
              type="button"
              onClick={onSwitchToFullGrid}
              className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all"
              title="Ver grade completa da loja"
            >
              <Icon name="grid_view" className="text-lg" />
              <span className="hidden sm:inline">Grade</span>
            </button>
          </div>
        </div>

        {/* Barra de Mês com Botões de 44x44px */}
        <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-xs font-black uppercase">
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

            <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 px-1 font-extrabold text-sm capitalize">
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

          {/* Saldo de Folgas Feriado */}
          {pendingCreditsCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 text-xs font-extrabold shrink-0">
              <Icon name="stars" className="text-sm text-amber-500" />
              <span>{pendingCreditsCount}d Folga</span>
            </div>
          )}
        </div>

      </div>

      {/* Estado Vazio: Nenhum Colaborador Selecionado ou Cadastrado */}
      {!currentEmp && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800 text-center flex flex-col items-center justify-center gap-3 shadow-sm animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <Icon name="person_search" className="text-3xl" />
          </div>
          <span className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase">
            Nenhum colaborador disponível
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs">
            Não há colaboradores ativos cadastrados para este mês na loja.
          </span>
        </div>
      )}

      {/* TAB 1: MEU DIA (DASHBOARD FOCO EM 1 SEGUNDO) */}
      {activeTab === 'hoje' && todayDetails && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          
          {/* BLOCO 1: Card Hero do Turno Atual */}
          <div className={`rounded-3xl p-6 border text-white shadow-xl relative overflow-hidden flex flex-col gap-4 ${
            todayDetails.isWorking
              ? 'bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 border-orange-400/50 shadow-orange-500/20'
              : todayDetails.shift === 'FE'
              ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-500/50 shadow-emerald-600/20'
              : 'bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 border-zinc-700 shadow-zinc-950/40'
          }`}>
            
            {/* Status Semântico no Topo */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider bg-white/20 dark:bg-black/30 px-3 py-1.5 rounded-xl backdrop-blur-md">
                {todayDetails.weekday}, {todayDetails.dateFormatted}
              </span>

              <div className="bg-white/20 dark:bg-black/30 px-3 py-1.5 rounded-xl text-xs font-black uppercase backdrop-blur-md">
                {todayDetails.isWorking ? `🟢 ${todayDetails.classification}` : '🏖️ Descanso'}
              </div>
            </div>

            {/* Horário Principal em Destaque */}
            <div>
              {todayDetails.isWorking ? (
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-white/80 block">Horário de Trabalho</span>
                  <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
                    {todayDetails.hour}
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-white/80 block">Situação Hoje</span>
                  <div className="text-3xl font-black tracking-tight mt-1 flex items-center gap-2">
                    {todayDetails.shift === 'FE' ? '🏖️ FÉRIAS' : 
                     todayDetails.shift === 'DO' ? '🎂 ANIVERSÁRIO (DO)' :
                     todayDetails.shift === 'AT' ? '🩺 ATESTADO MÉDICO' :
                     todayDetails.shift === 'C' ? '📚 CURSO TEÓRICO' : '🎉 FOLGA SEMANAL'}
                  </div>
                </div>
              )}
            </div>

            {/* Função e Almoço Calculado */}
            {todayDetails.isWorking && (
              <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-white/20">
                <div className="bg-white/15 dark:bg-black/25 rounded-2xl p-3 backdrop-blur-md">
                  <span className="text-[11px] font-black uppercase tracking-wider text-white/75 block mb-1">Função na Loja</span>
                  <div className="text-sm font-black text-white">
                    {todayDetails.role}
                  </div>
                </div>

                <div className="bg-white/15 dark:bg-black/25 rounded-2xl p-3 backdrop-blur-md">
                  <span className="text-[11px] font-black uppercase tracking-wider text-white/75 block mb-1">🍽️ Almoço Calculado</span>
                  <div className="text-sm font-black text-white">
                    {todayDetails.lunchInfo ? todayDetails.lunchInfo : 'Conforme operação'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BLOCO 2: Colegas no Mesmo Turno */}
          {todayDetails.isWorking && peersInSameShift.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-zinc-600 dark:text-zinc-300 tracking-wider">
                  👥 Sua Equipe no Turno {todayDetails.classification} ({peersInSameShift.length + 1})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {peersInSameShift.map(({ emp, pos }) => (
                  <div 
                    key={emp.id}
                    className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                  >
                    <span>{getShortName(emp.name, employees)}</span>
                    <span className="text-[11px] font-black text-orange-600 dark:text-orange-400">
                      • {normalizeEmployeeRole(emp.cargo || emp.role)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BLOCO 3: Próximos 2 Dias */}
          {nextTwoDays.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-2.5">
              <span className="text-xs font-black uppercase text-zinc-600 dark:text-zinc-300 tracking-wider block">
                📅 Próximos Dias
              </span>
              <div className="grid grid-cols-2 gap-2">
                {nextTwoDays.map(d => (
                  <div key={d.dayNum} className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700 flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">{d.weekdayShort} {d.dayNum}</span>
                      {getShiftBadge(d.shift)}
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate mt-1">
                      {d.isWorking ? d.hour : 'Sem jornada'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BLOCO 4: CTA Primário Amplo (48px) para Solicitações */}
          <button
            type="button"
            onClick={() => {
              if (currentEmp) onOpenEmployeeCard(currentEmp, 'pedidos');
            }}
            className="w-full min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Icon name="add_circle" className="text-lg" />
            <span>+ Solicitar Troca de Turno ou Folga</span>
          </button>

          {/* Cartão de Resumo Mensal */}
          <button
            type="button"
            onClick={() => {
              if (currentEmp) onOpenEmployeeCard(currentEmp, 'pedidos');
            }}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center justify-between hover:border-orange-400 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center text-lg">
                <Icon name="badge" />
              </div>
              <div>
                <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight block">
                  Cartão Pessoal & Solicitações
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Total de {empMonthStats.workDays} dias de trabalho e {empMonthStats.offDays} folgas no mês
                </span>
              </div>
            </div>
            <Icon name="arrow_forward" className="text-zinc-400 text-lg" />
          </button>

        </div>
      )}

      {/* TAB 2: PRÓXIMOS 7 DIAS (LINHA DO TEMPO) */}
      {activeTab === 'semana' && (
        <div className="space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Próximos 7 Dias</span>
            <span className="text-xs font-bold text-orange-500 uppercase">{currentEmp?.name}</span>
          </div>

          <div className="space-y-2">
            {upcomingDays.map((d) => (
              <div 
                key={d.dayNum}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 min-h-[56px] ${
                  d.isToday
                    ? 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800 ring-1 ring-orange-400/30'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-black shrink-0 ${
                    d.isSunday 
                      ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-600' 
                      : d.isToday
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                  }`}>
                    <span className="text-sm leading-none">{d.dayNum}</span>
                    <span className="text-[11px] uppercase tracking-tighter mt-0.5">{d.weekdayShort}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                        {d.isToday ? 'Hoje' : d.weekday}
                      </span>
                      {d.isHoliday && <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 font-bold uppercase">Feriado</span>}
                    </div>
                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mt-0.5">
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

      {/* TAB 3: QUEM TRABALHA HOJE NA LOJA */}
      {activeTab === 'equipe' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Escalação da Loja Hoje</span>
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
              {todayDetails?.dateFormatted} ({todayDetails?.weekday})
            </span>
          </div>

          {['Abertura', 'Intermediário', 'Fechamento', 'Estoque', 'Folga'].map(groupName => {
            const roster = todayTeamRoster[groupName];
            if (!roster || roster.length === 0) return null;

            return (
              <div key={groupName} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <span className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      groupName === 'Abertura' ? 'bg-amber-500' :
                      groupName === 'Intermediário' ? 'bg-blue-500' :
                      groupName === 'Fechamento' ? 'bg-indigo-600' :
                      groupName === 'Estoque' ? 'bg-emerald-600' : 'bg-rose-500'
                    }`} />
                    {groupName}
                  </span>
                  <span className="text-xs font-semibold text-zinc-400 uppercase">
                    {roster.length} {roster.length === 1 ? 'colaborador' : 'colaboradores'}
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {roster.map(({ emp, hour, pos, shift }) => {
                    const isMe = emp.id === currentEmp?.id;
                    return (
                      <div 
                        key={emp.id}
                        className={`p-2.5 rounded-2xl flex items-center justify-between gap-2.5 min-h-[48px] ${
                          isMe ? 'bg-orange-50 dark:bg-orange-950/30 ring-1 ring-orange-400' : 'bg-zinc-50/80 dark:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-black text-zinc-700 dark:text-zinc-200 uppercase shrink-0">
                            {emp.name.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase truncate block">
                              {emp.name} {isMe && '(Você)'}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium">
                              {isWorkingShift(shift) ? hour : 'Folga'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isWorkingShift(shift) && (() => {
                            const role = normalizeEmployeeRole(emp.cargo || emp.role);
                            const meta = ROLE_METADATA_MAP[role];
                            return (
                              <span className={`px-2.5 py-1 rounded-xl font-black text-[11px] uppercase border ${meta.badgeColor}`}>
                                {meta.label}
                              </span>
                            );
                          })()}
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

      {/* TAB 4: MÊS TODO (AGENDA VERTICAL ESTILO GOOGLE CALENDAR) */}
      {activeTab === 'mes' && currentEmp && (
        <div className="space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
              Escala Completa do Mês
            </span>
            <span className="text-xs font-bold text-orange-500 uppercase">
              {currentEmp.name}
            </span>
          </div>

          {/* Lista de Agenda Vertical com Cards Horizontais (min-h-[56px]) */}
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
              const isToday = isCurrentMonth && i === currentDayIdx;
              const hour = (currentEmp.dailyHours[monthKey] || [])[i] || currentEmp.workPeriod || '10h às 18h20';

              return (
                <div 
                  key={i}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 min-h-[56px] ${
                    isToday
                      ? 'ring-2 ring-orange-500 bg-orange-50/80 dark:bg-orange-950/25 border-orange-400'
                      : isOut || shift === 'N/A'
                      ? 'bg-zinc-50 dark:bg-zinc-900/50 border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 opacity-60'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-black shrink-0 ${
                      isToday
                        ? 'bg-orange-500 text-white'
                        : isSunday
                        ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-600'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                    }`}>
                      <span className="text-sm leading-none">{i + 1}</span>
                      <span className="text-[11px] uppercase tracking-tighter mt-0.5">{WEEKDAY_SHORT_PT[dow]}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                          {isToday ? 'Hoje' : WEEKDAY_NAMES_PT[dow]}
                        </span>
                        {isHoliday && <span className="text-[11px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold uppercase">Feriado</span>}
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block mt-0.5">
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

      {/* NAVEGAÇÃO INFERIOR CONSOLIDADA (Touch Targets de 44x44px) */}
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
                className={`min-h-[44px] flex flex-col items-center justify-center rounded-2xl transition-all relative ${
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
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 absolute bottom-0.5"></span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modal / Sheet para Troca Rápida de Colaborador */}
      {showEmpSelector && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h4 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                Quem é você na loja?
              </h4>
              <button 
                type="button"
                onClick={() => setShowEmpSelector(false)} 
                className="w-11 h-11 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>

            {/* Caixa de Busca com 44px de Altura */}
            <div className="relative my-3">
              <Icon name="search" className="absolute left-3.5 top-3.5 text-zinc-400 text-lg" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por seu nome..."
                className="w-full min-h-[44px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-11 pr-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Lista de Colaboradores com Touch Target de 48px */}
            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 pr-1">
              {activeEmployees
                .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || (e.cargo || '').toLowerCase().includes(searchTerm.toLowerCase()))
                .map(emp => {
                  const isSelected = emp.id === currentEmp?.id;
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        onSelectEmployee(emp.id);
                        try {
                          window.localStorage.setItem(STORAGE_KEYS.viewerSelectedEmpId, JSON.stringify(emp.id));
                        } catch {}
                        setShowEmpSelector(false);
                      }}
                      className={`w-full min-h-[48px] p-3 rounded-2xl flex items-center justify-between gap-3 text-left transition-all ${
                        isSelected 
                          ? 'bg-orange-500 text-white shadow-md' 
                          : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs uppercase ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                        }`}>
                          {emp.name.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-black uppercase block truncate">{emp.name}</span>
                          <span className={`text-[11px] font-semibold block ${isSelected ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            {emp.cargo || 'Atendente'} • {emp.workPeriod || '10h às 18h20'}
                          </span>
                        </div>
                      </div>

                      {isSelected && <Icon name="check" className="text-xl text-white shrink-0" />}
                    </button>
                  );
                })}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default MobileEmployerViewer;
