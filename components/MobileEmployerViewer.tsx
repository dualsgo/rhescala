import React, { useState, useMemo, useEffect } from 'react';
import { Employee, MonthYear, Holiday, JornadaSettings, ShiftType } from '../types';
import { Icon } from './Icon';
import { HolidayCredit } from '../hooks/useHolidayCredits';
import { 
  isWorkingShift, 
  getShiftClassification, 
  calculateLunches, 
  resolveTacticalDay 
} from '../hooks/useScheduleEngine';
import { buildHolidaySet, getShortName, isEmployeeActiveInMonth } from '../constants';
import { useDialog } from '../contexts/DialogContext';

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
}

const WEEKDAY_NAMES_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

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
  onUpdateEmployee,
}) => {
  const [activeTab, setActiveTab] = useState<'hoje' | 'semana' | 'equipe' | 'mes' | 'pedidos'>('hoje');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmpSelector, setShowEmpSelector] = useState(false);
  const { showDialog } = useDialog();

  const activeEmployees = useMemo(() => {
    return employees.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));
  }, [employees, currentMY]);

  // Current selected employee
  const currentEmp = useMemo(() => {
    return activeEmployees.find(e => e.id === selectedEmployeeId) || activeEmployees[0] || null;
  }, [activeEmployees, selectedEmployeeId]);

  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = useMemo(() => buildHolidaySet(currentMY.year, customHolidays, deletedNationalHolidays), [currentMY.year, customHolidays, deletedNationalHolidays]);

  const today = new Date();
  const isCurrentMonth = currentMY.year === today.getFullYear() && currentMY.month === today.getMonth();
  const currentDayIdx = isCurrentMonth ? today.getDate() - 1 : 0;

  // Compute stats for current employee for the month
  const empMonthStats = useMemo(() => {
    if (!currentEmp) return { workDays: 0, offDays: 0, sundaysWorked: 0, holidaysWorked: 0 };
    const shifts = currentEmp.shifts[monthKey] || [];
    let workDays = 0;
    let offDays = 0;
    let sundaysWorked = 0;
    let holidaysWorked = 0;

    for (let i = 0; i < daysInMonth; i++) {
      const s = shifts[i] || 'T';
      const date = new Date(currentMY.year, currentMY.month, i + 1);
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const isSunday = date.getDay() === 0;
      const isHoliday = holidaySet.has(dateStr);

      if (isWorkingShift(s)) {
        workDays++;
        if (isSunday) sundaysWorked++;
        if (isHoliday) holidaysWorked++;
      } else {
        offDays++;
      }
    }

    return { workDays, offDays, sundaysWorked, holidaysWorked };
  }, [currentEmp, monthKey, daysInMonth, currentMY, holidaySet]);

  // Compute Holiday Credit list for current employee
  const empCreditsList = useMemo(() => {
    if (!currentEmp || !holidayCredits) return [];
    if (Array.isArray(holidayCredits)) {
      return (holidayCredits as any[]).filter(c => c.employeeId === currentEmp.id);
    }
    if (typeof holidayCredits === 'object') {
      return (holidayCredits as Record<string, HolidayCredit[]>)[currentEmp.id] || [];
    }
    return [];
  }, [currentEmp, holidayCredits]);

  const pendingCreditsCount = useMemo(() => {
    return empCreditsList.filter(c => c.status === 'pending').length;
  }, [empCreditsList]);

  // Compute today's tactical position and schedule for current employee
  const todayDetails = useMemo(() => {
    if (!currentEmp) return null;
    const date = new Date(currentMY.year, currentMY.month, currentDayIdx + 1);
    const dow = date.getDay();
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(currentDayIdx + 1).padStart(2, '0')}`;
    const isHoliday = holidaySet.has(dateStr);
    const isSunday = dow === 0;

    const shift = (currentEmp.shifts[monthKey] || [])[currentDayIdx] || 'T';
    const isWorking = isWorkingShift(shift);
    const hour = (currentEmp.dailyHours[monthKey] || [])[currentDayIdx] || currentEmp.workPeriod || '10h às 18h20';
    const classification = getShiftClassification(hour, isSunday, jornadaSettings);

    const resolved = resolveTacticalDay(activeEmployees, monthKey, currentDayIdx, isHoliday, isSunday, jornadaSettings);
    const tacticalPos = resolved[currentEmp.id] || null;

    // Calculate lunch
    const lunches = calculateLunches(activeEmployees, currentMY.year, currentMY.month, currentDayIdx, customHolidays, deletedNationalHolidays, jornadaSettings);
    const lunchInfo = lunches[currentEmp.id] || null;

    return {
      dayNum: currentDayIdx + 1,
      weekday: WEEKDAY_NAMES_PT[dow],
      dateFormatted: `${String(currentDayIdx + 1).padStart(2, '0')}/${String(currentMY.month + 1).padStart(2, '0')}`,
      shift,
      isWorking,
      hour,
      classification,
      tacticalPos,
      lunchInfo,
      isHoliday,
      isSunday
    };
  }, [currentEmp, currentMY, currentDayIdx, monthKey, holidaySet, activeEmployees, jornadaSettings, customHolidays, deletedNationalHolidays]);

  // Compute today's team roster (who works today grouped by shift)
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
    const resolved = resolveTacticalDay(activeEmployees, monthKey, currentDayIdx, isHoliday, isSunday, jornadaSettings);

    activeEmployees.forEach(emp => {
      const shift = (emp.shifts[monthKey] || [])[currentDayIdx] || 'T';
      const hour = (emp.dailyHours[monthKey] || [])[currentDayIdx] || emp.workPeriod || '10h às 18h20';
      const isWorking = isWorkingShift(shift);
      const classification = getShiftClassification(hour, isSunday, jornadaSettings);
      const pos = resolved[emp.id] || null;

      if (!isWorking) {
        groups['Folga'].push({ emp, hour, pos, shift });
      } else {
        if (emp.cargo === 'Estoquista' || pos === 'ESTQ') {
          groups['Estoque'].push({ emp, hour, pos, shift });
        } else if (groups[classification]) {
          groups[classification].push({ emp, hour, pos, shift });
        } else {
          groups['Fechamento'].push({ emp, hour, pos, shift });
        }
      }
    });

    return groups;
  }, [activeEmployees, currentMY, currentDayIdx, holidaySet, monthKey, jornadaSettings]);

  // Next 7 days timeline for current employee
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
      const shift = (currentEmp.shifts[monthKey] || [])[i] || 'T';
      const hour = (currentEmp.dailyHours[monthKey] || [])[i] || currentEmp.workPeriod || '10h às 18h20';
      const isWorking = isWorkingShift(shift);

      list.push({
        dayNum: i + 1,
        weekday: WEEKDAY_NAMES_PT[dow],
        weekdayShort: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][dow],
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

  // Position Badge Helper
  const getPositionBadge = (pos: string | null) => {
    if (!pos) return null;
    const colors: Record<string, string> = {
      'P1': 'bg-rose-500 text-white ring-2 ring-rose-300 shadow-sm',
      'P2': 'bg-amber-500 text-white ring-2 ring-amber-300 shadow-sm',
      'P3': 'bg-emerald-500 text-white ring-2 ring-emerald-300 shadow-sm',
      'P4': 'bg-sky-500 text-white ring-2 ring-sky-300 shadow-sm',
      'ESTQ': 'bg-slate-700 text-white ring-2 ring-slate-400 shadow-sm',
    };
    const labels: Record<string, string> = {
      'P1': 'P1 - Caixa Principal',
      'P2': 'P2 - Recepção / Porta',
      'P3': 'P3 - Salão de Vendas',
      'P4': 'P4 - Apoio Flexível',
      'ESTQ': 'Estoque',
    };
    return (
      <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${colors[pos] || 'bg-slate-800 text-white'}`}>
        {labels[pos] || pos}
      </span>
    );
  };

  const getShiftBadge = (shift: ShiftType) => {
    if (shift === 'FE') return <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-black text-xs uppercase">Férias</span>;
    if (shift.startsWith('FF')) return <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-black text-xs uppercase">Folga Feriado</span>;
    if (shift === 'F') return <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-black text-xs uppercase">Folga</span>;
    if (shift === 'DO') return <span className="px-2 py-0.5 rounded-lg bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 font-black text-xs uppercase">Aniversário</span>;
    if (shift === 'AT') return <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-black text-xs uppercase">Atestado</span>;
    if (shift === 'C') return <span className="px-2 py-0.5 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 font-black text-xs uppercase">Curso</span>;
    return <span className="px-2 py-0.5 rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 font-black text-xs uppercase">Trabalho</span>;
  };

  return (
    <div className="h-full flex flex-col gap-3 max-w-lg mx-auto pb-20 animate-fade-in overflow-y-auto custom-scrollbar pr-1">
      
      {/* Top Header Card for Collaborator */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3">
        
        {/* Collaborator Selector Header */}
        <div className="flex items-center justify-between gap-2">
          <div 
            onClick={() => setShowEmpSelector(true)}
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer p-1.5 -m-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center font-black text-sm uppercase shadow-md shadow-orange-500/20 shrink-0">
              {currentEmp ? currentEmp.name.split(' ').map(n => n[0]).join('').substring(0, 2) : 'RH'}
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-base font-black text-slate-900 dark:text-slate-100 uppercase truncate">
                  {currentEmp ? currentEmp.name : 'Selecionar Colaborador'}
                </span>
                <Icon name="unfold_more" className="text-sm text-slate-400 shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>{currentEmp?.cargo || 'Atendente'}</span>
                <span>•</span>
                <span>{currentEmp?.contractType || 'CLT'}</span>
                <span>•</span>
                <span>{currentEmp?.jornada || '6x1'}</span>
              </div>
            </div>
          </div>

          {/* Quick Switch to Full Grid */}
          <button
            onClick={onSwitchToFullGrid}
            className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-black uppercase flex items-center gap-1 shrink-0"
            title="Ver grade completa da loja"
          >
            <Icon name="grid_view" className="text-base" />
            <span className="hidden sm:inline">Grade</span>
          </button>
        </div>

        {/* Quick Month Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs font-black uppercase">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Icon name="calendar_month" className="text-orange-500 text-sm" />
            <span>{new Date(currentMY.year, currentMY.month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
          </div>

          {/* Holiday Credit Chip */}
          {pendingCreditsCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800 text-[10px] font-black">
              <Icon name="stars" className="text-xs text-amber-500" />
              <span>Saldo Folgas: {pendingCreditsCount}d</span>
            </div>
          )}
        </div>

      </div>

      {/* Navigation Pills (Mobile Segmented Tab Bar) */}
      <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200/60 dark:border-zinc-800 overflow-x-auto custom-scrollbar">
        {[
          { id: 'hoje', label: 'Hoje', icon: 'today' },
          { id: 'semana', label: '7 Dias', icon: 'date_range' },
          { id: 'equipe', label: 'Quem Trabalha', icon: 'groups' },
          { id: 'mes', label: 'Mês Todo', icon: 'calendar_view_month' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[70px] py-2 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Icon name={tab.icon} className="text-sm" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: MEU DIA HOJE (CARD PRINCIPAL) */}
      {activeTab === 'hoje' && todayDetails && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          
          {/* Main Shift Hero Card */}
          <div className={`rounded-3xl p-5 border text-white shadow-xl relative overflow-hidden flex flex-col gap-4 ${
            todayDetails.isWorking
              ? 'bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 border-orange-400 shadow-orange-500/20'
              : todayDetails.shift === 'FE'
              ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-500 shadow-emerald-600/20'
              : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-slate-900/30'
          }`}>
            
            {/* Top Row: Date & Shift Label */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-xl backdrop-blur-md">
                  {todayDetails.weekday}, {todayDetails.dateFormatted}
                </span>
                {todayDetails.isHoliday && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/80 px-2 py-0.5 rounded-lg">
                    Feriado
                  </span>
                )}
              </div>

              <div className="bg-white/20 px-3 py-1 rounded-xl text-xs font-black uppercase backdrop-blur-md">
                {todayDetails.isWorking ? todayDetails.classification : 'Descanso'}
              </div>
            </div>

            {/* Middle: Work Hours & Status */}
            <div>
              {todayDetails.isWorking ? (
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80 block">Horário de Trabalho</span>
                  <div className="text-3xl sm:text-4xl font-black tracking-tight mt-0.5">
                    {todayDetails.hour}
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80 block">Situação Hoje</span>
                  <div className="text-3xl font-black tracking-tight mt-0.5 flex items-center gap-2">
                    {todayDetails.shift === 'FE' ? '🏖️ Férias' : 
                     todayDetails.shift === 'DO' ? '🎂 Aniversário' :
                     todayDetails.shift === 'AT' ? '🩺 Atestado' :
                     todayDetails.shift === 'C' ? '📚 Curso Teórico' : '🎉 Folga Oficial'}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Row: Tactical Position & Lunch */}
            {todayDetails.isWorking && (
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/20">
                <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-sm">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/70 block mb-1">Posto Tático</span>
                  <div className="text-sm font-black text-white">
                    {todayDetails.tacticalPos ? todayDetails.tacticalPos : 'Padrão / Apoio'}
                  </div>
                </div>

                <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-sm">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/70 block mb-1">Pausa Almoço</span>
                  <div className="text-sm font-black text-white">
                    {todayDetails.lunchInfo ? todayDetails.lunchInfo : 'Conforme escala'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Action: Solicitations / Autoatendimento */}
          <button
            onClick={() => {
              if (currentEmp) onOpenEmployeeCard(currentEmp);
            }}
            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center justify-between hover:border-orange-400 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                <Icon name="badge" />
              </div>
              <div>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight block">
                  Cartão Pessoal & Solicitações
                </span>
                <span className="text-xs font-bold text-slate-400">
                  Pedir folga, troca de turno ou enviar atestado médico
                </span>
              </div>
            </div>
            <Icon name="arrow_forward" className="text-slate-400 text-lg group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Monthly Totals Summary Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm space-y-3">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Resumo do Mês ({currentEmp?.name.split(' ')[0]})</span>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-50 dark:bg-zinc-800 p-2.5 rounded-xl">
                <span className="text-lg font-black text-slate-800 dark:text-slate-100 block">{empMonthStats.workDays}</span>
                <span className="text-[9px] font-black uppercase text-slate-400">Trabalho</span>
              </div>
              <div className="bg-slate-50 dark:bg-zinc-800 p-2.5 rounded-xl">
                <span className="text-lg font-black text-rose-600 block">{empMonthStats.offDays}</span>
                <span className="text-[9px] font-black uppercase text-slate-400">Folgas</span>
              </div>
              <div className="bg-slate-50 dark:bg-zinc-800 p-2.5 rounded-xl">
                <span className="text-lg font-black text-amber-600 block">{empMonthStats.sundaysWorked}</span>
                <span className="text-[9px] font-black uppercase text-slate-400">Domingos</span>
              </div>
              <div className="bg-slate-50 dark:bg-zinc-800 p-2.5 rounded-xl">
                <span className="text-lg font-black text-emerald-600 block">{pendingCreditsCount}</span>
                <span className="text-[9px] font-black uppercase text-slate-400">Crédito</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: PRÓXIMOS 7 DIAS (LINHA DO TEMPO VERTICAL) */}
      {activeTab === 'semana' && (
        <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Próximos 7 Dias</span>
            <span className="text-[10px] font-bold text-orange-500 uppercase">{currentEmp?.name}</span>
          </div>

          <div className="space-y-2">
            {upcomingDays.map((d) => (
              <div 
                key={d.dayNum}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  d.isToday
                    ? 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800 ring-1 ring-orange-400/30'
                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
                }`}
              >
                {/* Date & Weekday */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-black shrink-0 ${
                    d.isSunday 
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-600' 
                      : d.isToday
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200'
                  }`}>
                    <span className="text-xs leading-none">{d.dayNum}</span>
                    <span className="text-[8px] uppercase tracking-tighter mt-0.5">{d.weekdayShort}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {d.isToday ? 'Hoje' : d.weekday}
                      </span>
                      {d.isHoliday && <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 font-bold uppercase">Feriado</span>}
                    </div>
                    <span className="text-xs font-bold text-slate-400 block mt-0.5">
                      {d.isWorking ? d.hour : 'Sem jornada'}
                    </span>
                  </div>
                </div>

                {/* Shift Tag */}
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
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Escalação da Loja Hoje</span>
            <span className="text-[10px] font-bold text-slate-500">
              {todayDetails?.dateFormatted} ({todayDetails?.weekday})
            </span>
          </div>

          {['Abertura', 'Intermediário', 'Fechamento', 'Estoque', 'Folga'].map(groupName => {
            const roster = todayTeamRoster[groupName];
            if (!roster || roster.length === 0) return null;

            return (
              <div key={groupName} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-3.5 shadow-sm space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      groupName === 'Abertura' ? 'bg-amber-500' :
                      groupName === 'Intermediário' ? 'bg-blue-500' :
                      groupName === 'Fechamento' ? 'bg-indigo-600' :
                      groupName === 'Estoque' ? 'bg-emerald-600' : 'bg-rose-500'
                    }`} />
                    {groupName}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {roster.length} {roster.length === 1 ? 'colaborador' : 'colaboradores'}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {roster.map(({ emp, hour, pos, shift }) => {
                    const isMe = emp.id === currentEmp?.id;
                    return (
                      <div 
                        key={emp.id}
                        className={`p-2 rounded-xl flex items-center justify-between gap-2 ${
                          isMe ? 'bg-orange-50 dark:bg-orange-950/30 ring-1 ring-orange-400' : 'bg-slate-50/70 dark:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase shrink-0">
                            {emp.name.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase truncate block">
                              {emp.name} {isMe && '(Você)'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 block">
                              {isWorkingShift(shift) ? hour : 'Folga'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {pos && (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-white font-black text-[9px] uppercase">
                              {pos}
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

      {/* TAB 4: MÊS TODO (CALENDÁRIO COMPACTO) */}
      {activeTab === 'mes' && currentEmp && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
            <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">
              Escala Completa do Mês
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {currentEmp.name}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((wd, i) => (
              <div key={i} className="text-[9px] font-black text-slate-400 uppercase py-1">
                {wd}
              </div>
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = new Date(currentMY.year, currentMY.month, i + 1);
              const dow = date.getDay();
              const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
              const isHoliday = holidaySet.has(dateStr);
              const shift = (currentEmp.shifts[monthKey] || [])[i] || 'T';
              const isWorking = isWorkingShift(shift);
              const isToday = isCurrentMonth && i === currentDayIdx;

              return (
                <div 
                  key={i}
                  className={`p-1.5 rounded-xl flex flex-col items-center justify-center border text-[10px] font-black transition-all ${
                    isToday
                      ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950/40 border-orange-400'
                      : isWorking
                      ? 'bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-slate-200'
                      : shift === 'FE'
                      ? 'bg-emerald-500 text-white border-emerald-600'
                      : shift.startsWith('FF')
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-rose-500 text-white border-rose-600'
                  }`}
                >
                  <span>{i + 1}</span>
                  <span className="text-[8px] uppercase font-bold mt-0.5">
                    {shift === 'FE' ? 'FE' : shift === 'F' ? 'F' : shift.startsWith('FF') ? 'FF' : 'T'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal / Sheet para Troca Rápida de Colaborador */}
      {showEmpSelector && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl p-5 border border-slate-200 dark:border-zinc-800 w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h4 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                Selecionar Colaborador
              </h4>
              <button onClick={() => setShowEmpSelector(false)} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <Icon name="close" />
              </button>
            </div>

            {/* Search Box */}
            <div className="relative my-3">
              <Icon name="search" className="absolute left-3 top-3 text-slate-400 text-sm" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome..."
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>

            {/* List */}
            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-1.5 pr-1">
              {activeEmployees
                .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || (e.cargo || '').toLowerCase().includes(searchTerm.toLowerCase()))
                .map(emp => {
                  const isSelected = emp.id === currentEmp?.id;
                  return (
                    <button
                      key={emp.id}
                      onClick={() => {
                        onSelectEmployee(emp.id);
                        setShowEmpSelector(false);
                      }}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between gap-3 text-left transition-all ${
                        isSelected 
                          ? 'bg-orange-500 text-white shadow-md' 
                          : 'bg-slate-50 dark:bg-zinc-800/60 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs uppercase ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          {emp.name.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-black uppercase block truncate">{emp.name}</span>
                          <span className={`text-[10px] font-bold block ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                            {emp.cargo || 'Atendente'} • {emp.workPeriod || '10h às 18h20'}
                          </span>
                        </div>
                      </div>

                      {isSelected && <Icon name="check" className="text-lg text-white shrink-0" />}
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
