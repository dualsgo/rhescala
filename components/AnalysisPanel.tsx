import React, { useMemo, useState } from 'react';
import { Employee, MonthYear, Holiday, ShiftType, JornadaSettings } from '../types';
import { getShiftClassification, isWorkingShift } from '../hooks/useScheduleEngine';
import { Icon } from './Icon';
import { buildHolidaySet, SHIFT_HOURS, DEFAULT_JORNADA_SETTINGS, getShortName, isEmployeeActiveInMonth } from '../constants';
import { toPng } from 'html-to-image';
import { WhatIfSalesSimulator } from './WhatIfSalesSimulator';

interface AnalysisPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onClose: () => void;
  onUpdateShift?: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateHour?: (empId: string, dayIdx: number, newHour: string) => void;
  jornadaSettings?: JornadaSettings;
}

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

const WEEKDAY_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  employees,
  currentMY,
  customHolidays,
  onClose,
  onUpdateShift,
  onUpdateHour,
  jornadaSettings = DEFAULT_JORNADA_SETTINGS
}) => {
  const [viewMode, setViewMode] = useState<'sustentacao' | 'what-if' | 'team-balance' | 'team-calendar'>('sustentacao');
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(
    employees.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month))[0]?.id || null
  );
  const [showIndividualModal, setShowIndividualModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  // Helper for date calculations
  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const getEffectiveShift = (emp: Employee, dayIdx: number): ShiftType => {
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;

    if (emp.hiredAt && dateStr < emp.hiredAt) return 'N/A';
    if (emp.firedAt && dateStr > emp.firedAt) return 'N/A';

    // Vacation check
    if (emp.vacationStart) {
      const start = emp.vacationStart;
      const end = emp.vacationEnd || addDays(start, 29);
      if (dateStr >= start && dateStr <= end) return 'FE';
    }

    // Medical leave check
    if (emp.atestadoStart && emp.atestadoEnd) {
      if (dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) return 'AT';
    }

    // Birthday check
    if (emp.birthday) {
      const empMD = emp.birthday.length > 5 ? emp.birthday.substring(5) : emp.birthday;
      const dateMD = dateStr.substring(5);
      if (empMD === dateMD) return 'DO';
    }

    const monthShifts = emp.shifts[monthKey] || [];
    return monthShifts[dayIdx] || 'F';
  };

  // ─── Daily PA Sustentação Engine ─────────────────────────────────────────────

  const dailyCoverage = useMemo(() => {
    const coverage = [];
    const activeEmps = employees.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));

    for (let d = 0; d < daysInMonth; d++) {
      const dayNumber = d + 1;
      const date = new Date(currentMY.year, currentMY.month, dayNumber);
      const weekday = date.getDay();
      const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      const isSunday = weekday === 0;
      const isSaturday = weekday === 6;
      const isHoliday = holidaySet.has(dateStr);

      const workingEmps: { emp: Employee; shift: ShiftType; hour: string; classification: 'Abertura' | 'Intermediário' | 'Fechamento' | 'N/A'; tacticalPos: string }[] = [];
      const offEmps: { emp: Employee; shift: ShiftType }[] = [];

      activeEmps.forEach(emp => {
        const shift = getEffectiveShift(emp, d);
        if (isWorkingShift(shift)) {
          const hour = (emp.dailyHours?.[monthKey] || [])[d] || emp.workPeriod || '10h às 18h20';
          const classification = getShiftClassification(hour, isSunday, jornadaSettings);
          const tacticalPos = emp.tacticalPositions?.[monthKey]?.[d] || (shift !== 'T' ? (shift as string) : '');
          workingEmps.push({ emp, shift, hour, classification, tacticalPos });
        } else {
          offEmps.push({ emp, shift });
        }
      });

      const cltWorking = workingEmps.filter(w => !w.emp.isYoungApprentice);
      const apprenticeWorking = workingEmps.filter(w => w.emp.isYoungApprentice);

      const abertura = workingEmps.filter(w => w.classification === 'Abertura');
      const intermediario = workingEmps.filter(w => w.classification === 'Intermediário');
      const fechamento = workingEmps.filter(w => w.classification === 'Fechamento');

      // Metas operacionais por tipo de dia
      let targetIdeal = 6;
      let minFloor = 5;

      if (isSaturday) {
        targetIdeal = 7;
        minFloor = 6;
      } else if (isSunday || isHoliday) {
        targetIdeal = 5;
        minFloor = 4;
      }

      // Status de Sustentação de PA:
      // - Critico: Abaixo do piso mínimo de segurança OU furo em turno mandatório (0 abertura ou 0 fechamento)
      // - Alerta: Atinge o piso mínimo mas abaixo do ideal OU sem intermediário em dia útil
      // - Pleno: Atinge a meta ideal com abertura e fechamento garantidos
      const hasAberturaHole = abertura.length === 0;
      const hasFechamentoHole = fechamento.length === 0;
      const isBelowFloor = cltWorking.length < minFloor;

      let status: 'pleno' | 'alerta' | 'critico' = 'pleno';
      const warnings: string[] = [];

      if (isBelowFloor || hasAberturaHole || hasFechamentoHole) {
        status = 'critico';
        if (hasAberturaHole) warnings.push('Furo na Abertura (0 colaboradores)');
        if (hasFechamentoHole) warnings.push('Furo no Fechamento (0 colaboradores)');
        if (isBelowFloor) warnings.push(`Piso de segurança quebrado (${cltWorking.length}/${minFloor} CLT)`);
      } else if (cltWorking.length < targetIdeal || (intermediario.length === 0 && !isSunday)) {
        status = 'alerta';
        if (cltWorking.length < targetIdeal) warnings.push(`Abaixo da meta ideal (${cltWorking.length}/${targetIdeal} CLT)`);
        if (intermediario.length === 0 && !isSunday) warnings.push('Sem intermediário para cobrir almoços');
      }

      // Posições táticas
      const positionsCount = {
        p1: workingEmps.filter(w => w.tacticalPos === 'P1' || w.shift === 'P1').length,
        p2: workingEmps.filter(w => w.tacticalPos === 'P2' || w.shift === 'P2').length,
        p3: workingEmps.filter(w => w.tacticalPos === 'P3' || w.shift === 'P3').length,
        p4: workingEmps.filter(w => w.tacticalPos === 'P4' || w.shift === 'P4').length,
        estq: workingEmps.filter(w => w.tacticalPos === 'ESTQ' || w.shift === 'ESTQ').length,
        pc: workingEmps.filter(w => w.tacticalPos === 'PC' || w.shift === 'PC').length,
      };

      coverage.push({
        day: dayNumber,
        dayIdx: d,
        weekday,
        weekdayName: WEEKDAY_NAMES[weekday],
        weekdayShort: WEEKDAY_SHORT[weekday],
        isSunday,
        isSaturday,
        isHoliday,
        totalPA: workingEmps.length,
        cltCount: cltWorking.length,
        apprenticeCount: apprenticeWorking.length,
        workingEmps,
        offEmps,
        abertura,
        intermediario,
        fechamento,
        targetIdeal,
        minFloor,
        status,
        warnings,
        positionsCount
      });
    }

    return coverage;
  }, [employees, monthKey, daysInMonth, currentMY, holidaySet, jornadaSettings]);

  // ─── Consolidated Sustentação Indicators ─────────────────────────────────────

  const sustentacaoStats = useMemo(() => {
    const totalDays = dailyCoverage.length;
    const diasPlenos = dailyCoverage.filter(d => d.status === 'pleno').length;
    const diasAlerta = dailyCoverage.filter(d => d.status === 'alerta').length;
    const diasCriticos = dailyCoverage.filter(d => d.status === 'critico').length;

    const taxaSustentacao = totalDays > 0 ? Math.round((diasPlenos / totalDays) * 100) : 0;
    const taxaConfiabilidade = totalDays > 0 ? Math.round(((diasPlenos + diasAlerta * 0.6) / totalDays) * 100) : 0;

    // Segmentação por tipo de dia
    const weekdays = dailyCoverage.filter(d => !d.isSaturday && !d.isSunday && !d.isHoliday);
    const saturdays = dailyCoverage.filter(d => d.isSaturday && !d.isHoliday);
    const sundaysAndHols = dailyCoverage.filter(d => d.isSunday || d.isHoliday);

    const avgPAWeekdays = weekdays.length > 0 ? (weekdays.reduce((acc, d) => acc + d.cltCount, 0) / weekdays.length).toFixed(1) : '0';
    const avgPASaturdays = saturdays.length > 0 ? (saturdays.reduce((acc, d) => acc + d.cltCount, 0) / saturdays.length).toFixed(1) : '0';
    const avgPASundays = sundaysAndHols.length > 0 ? (sundaysAndHols.reduce((acc, d) => acc + d.cltCount, 0) / sundaysAndHols.length).toFixed(1) : '0';

    // Médias por Turno
    const avgAbertura = totalDays > 0 ? (dailyCoverage.reduce((acc, d) => acc + d.abertura.length, 0) / totalDays).toFixed(1) : '0';
    const avgIntermediario = totalDays > 0 ? (dailyCoverage.reduce((acc, d) => acc + d.intermediario.length, 0) / totalDays).toFixed(1) : '0';
    const avgFechamento = totalDays > 0 ? (dailyCoverage.reduce((acc, d) => acc + d.fechamento.length, 0) / totalDays).toFixed(1) : '0';

    // Furos de turno
    const aberturaHoles = dailyCoverage.filter(d => d.abertura.length === 0).length;
    const fechamentoHoles = dailyCoverage.filter(d => d.fechamento.length === 0).length;

    // Menor presença registrada
    const worstDay = dailyCoverage.reduce((prev, curr) => (curr.cltCount < prev.cltCount ? curr : prev), dailyCoverage[0]);

    return {
      totalDays,
      diasPlenos,
      diasAlerta,
      diasCriticos,
      taxaSustentacao,
      taxaConfiabilidade,
      avgPAWeekdays,
      avgPASaturdays,
      avgPASundays,
      avgAbertura,
      avgIntermediario,
      avgFechamento,
      aberturaHoles,
      fechamentoHoles,
      worstDay,
      weekdaysCount: weekdays.length,
      saturdaysCount: saturdays.length,
      sundaysCount: sundaysAndHols.length
    };
  }, [dailyCoverage]);

  // ─── Individual Employee Effort & Balance ─────────────────────────────────────

  const employeeStats = useMemo(() => {
    const sundaysCount = dailyCoverage.filter(d => d.isSunday).length;
    const baseWorkableDays = daysInMonth - sundaysCount;

    return employees
      .filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month))
      .map(emp => {
        let worked = 0;
        let totalHours = 0;
        let maxStreak = 0;
        let currentStreak = 0;
        let sundaysWorked = 0;
        let saturdaysWorked = 0;
        let holidaysWorked = 0;
        let vacationDays = 0;
        let ffDays = 0;
        let courseDays = 0;
        let atestadoDays = 0;

        for (let d = 0; d < daysInMonth; d++) {
          const s = getEffectiveShift(emp, d);
          const dayType = new Date(currentMY.year, currentMY.month, d + 1).getDay();
          const isSun = dayType === 0;
          const isSat = dayType === 6;
          const isHol = holidaySet.has(`${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`);

          if (isWorkingShift(s)) {
            worked++;
            currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
            if (isSun) sundaysWorked++;
            if (isSat) saturdaysWorked++;
            if (isHol) holidaysWorked++;

            // Horas trabalhadas
            totalHours += emp.isYoungApprentice ? 6.0 : 7.33;
          } else {
            currentStreak = 0;
            if (s === 'FE') vacationDays++;
            else if (s?.startsWith('FF')) ffDays++;
            else if (s === 'C') courseDays++;
            else if (s === 'AT') atestadoDays++;
          }
        }

        const workableForEmp = Math.max(0, baseWorkableDays - vacationDays - ffDays - courseDays - atestadoDays);
        const adherence = workableForEmp > 0 ? (worked / workableForEmp) * 100 : 0;
        const nobleDaysWorked = saturdaysWorked + sundaysWorked + holidaysWorked;

        return {
          id: emp.id,
          name: emp.name,
          cargo: emp.cargo || 'Atendente',
          isApprentice: !!emp.isYoungApprentice,
          worked,
          totalHours: Math.round(totalHours),
          theoreticalMax: workableForEmp,
          adherence,
          maxStreak,
          sundaysWorked,
          saturdaysWorked,
          holidaysWorked,
          nobleDaysWorked,
          overlooked: maxStreak > 6,
          isHeavy: adherence > 105,
          emp
        };
      })
      .sort((a, b) => b.nobleDaysWorked - a.nobleDaysWorked || b.worked - a.worked);
  }, [employees, daysInMonth, monthKey, holidaySet, dailyCoverage, currentMY]);

  const selectedDayData = useMemo(() => {
    return dailyCoverage[selectedDayIdx] || dailyCoverage[0];
  }, [dailyCoverage, selectedDayIdx]);

  const selectedEmployee = useMemo(() => {
    return employeeStats.find(s => s.id === selectedEmpId) || employeeStats[0];
  }, [employeeStats, selectedEmpId]);

  const handleExportPng = async () => {
    const el = document.getElementById('sustentacao-dashboard-capture');
    if (!el) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(el, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: { padding: '24px', borderRadius: '32px' }
      });
      const link = document.createElement('a');
      link.download = `analise-sustentacao-pa-${monthKey}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Falha ao exportar relatório de sustentação:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in transition-colors bg-slate-50 dark:bg-slate-950 p-4 lg:p-6 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col flex-1">
        
        {/* ── Header ── */}
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 sticky top-0 z-10 no-print">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-2xl transition-all mr-1"
              title="Voltar"
            >
              <Icon name="arrow_back" className="text-xl" />
            </button>
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
              <Icon name="insights" className="text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Análise de Sustentação de PA
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  Postos & Cobertura
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                Saúde Operacional, Cobertura de Turnos e Alocação de Piso • {MONTH_NAMES[currentMY.month]} {currentMY.year}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl flex flex-wrap gap-1 border border-slate-200/60 dark:border-slate-700/50">
              <button
                onClick={() => setViewMode('sustentacao')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                  viewMode === 'sustentacao'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon name="verified" className="text-sm" /> Sustentação & Heatmap
              </button>
              <button
                onClick={() => setViewMode('what-if')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                  viewMode === 'what-if'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon name="tune" className="text-sm" /> Simulador What-If (P.A.)
              </button>
              <button
                onClick={() => setViewMode('team-balance')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                  viewMode === 'team-balance'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon name="balance" className="text-sm" /> Equilíbrio da Equipe
              </button>
              <button
                onClick={() => setViewMode('team-calendar')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                  viewMode === 'team-calendar'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon name="calendar_view_month" className="text-sm" /> Escala Geral
              </button>
            </div>

            {viewMode === 'sustentacao' && (
              <button
                onClick={handleExportPng}
                disabled={isExporting}
                className="px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 dark:shadow-none active:scale-95 disabled:opacity-50"
                title="Exportar Painel em Imagem"
              >
                <Icon name="download" className="text-sm" />
                <span className="hidden sm:inline">{isExporting ? 'Exportando...' : 'Exportar PNG'}</span>
              </button>
            )}

            {viewMode === 'team-calendar' && (
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md active:scale-95"
              >
                <Icon name="print" className="text-sm" /> Imprimir
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors ml-1"
            >
              <Icon name="close" className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-50/50 dark:bg-slate-950/40 custom-scrollbar transition-colors">
          
          {viewMode === 'sustentacao' && (
            <div id="sustentacao-dashboard-capture" className="space-y-8 animate-fade-in max-w-7xl mx-auto">
              
              {/* Top Key Sustentação Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                
                {/* Card 1: Taxa Global de Sustentação */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                      <Icon name="verified" className="text-2xl" />
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                      sustentacaoStats.taxaSustentacao >= 90
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : sustentacaoStats.taxaSustentacao >= 75
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      {sustentacaoStats.taxaSustentacao >= 90 ? 'Alta Sustentação' : sustentacaoStats.taxaSustentacao >= 75 ? 'Moderada' : 'Crítica'}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Taxa de Sustentação PA</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                        {sustentacaoStats.taxaSustentacao}%
                      </h3>
                      <span className="text-xs font-bold text-slate-400">
                        ({sustentacaoStats.diasPlenos}/{sustentacaoStats.totalDays} dias plenos)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          sustentacaoStats.taxaSustentacao >= 90
                            ? 'bg-emerald-500'
                            : sustentacaoStats.taxaSustentacao >= 75
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                        }`}
                        style={{ width: `${sustentacaoStats.taxaSustentacao}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card 2: Déficits Críticos de PA */}
                <div className={`bg-white dark:bg-slate-900 border rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all ${
                  sustentacaoStats.diasCriticos > 0
                    ? 'border-rose-300 dark:border-rose-900/60 ring-2 ring-rose-50 dark:ring-rose-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                      sustentacaoStats.diasCriticos > 0
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      <Icon name={sustentacaoStats.diasCriticos > 0 ? 'warning' : 'check_circle'} className="text-2xl" />
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                      Piso Mínimo
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Déficits Críticos</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h3 className={`text-3xl font-black leading-none ${
                        sustentacaoStats.diasCriticos > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                      }`}>
                        {sustentacaoStats.diasCriticos} {sustentacaoStats.diasCriticos === 1 ? 'dia' : 'dias'}
                      </h3>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
                      {sustentacaoStats.diasCriticos === 0
                        ? '✅ Nenhum dia com ruptura de segurança'
                        : `⚠️ Menor presença: Dia ${sustentacaoStats.worstDay.day} (${sustentacaoStats.worstDay.cltCount} CLT)`}
                    </p>
                  </div>
                </div>

                {/* Card 3: Sustentação em Dias Nobres (Sábados/Domingos/Feriados) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                      <Icon name="storefront" className="text-2xl" />
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-md">
                      Picos & Fins de Semana
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Média Sábados / Domingos</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                        {sustentacaoStats.avgPASaturdays} <span className="text-sm font-bold text-slate-400">Sáb</span> / {sustentacaoStats.avgPASundays} <span className="text-sm font-bold text-slate-400">Dom</span>
                      </h3>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
                      Média dias úteis: <strong className="text-indigo-600 dark:text-indigo-400">{sustentacaoStats.avgPAWeekdays} CLT/dia</strong>
                    </p>
                  </div>
                </div>

                {/* Card 4: Furos de Turno e Horas Ativas */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black">
                      <Icon name="schedule" className="text-2xl" />
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-md">
                      Turnos Vitais
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cobertura de Turnos</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                        {sustentacaoStats.avgAbertura} <span className="text-xs font-bold text-slate-400">Ab</span> • {sustentacaoStats.avgIntermediario} <span className="text-xs font-bold text-slate-400">Int</span> • {sustentacaoStats.avgFechamento} <span className="text-xs font-bold text-slate-400">Fech</span>
                      </h3>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
                      {sustentacaoStats.aberturaHoles === 0 && sustentacaoStats.fechamentoHoles === 0
                        ? '✨ 100% de cobertura nos turnos extremos'
                        : `⚠️ ${sustentacaoStats.aberturaHoles + sustentacaoStats.fechamentoHoles} dia(s) com furo de abertura/fechamento`}
                    </p>
                  </div>
                </div>

              </div>

              {/* Segmented Demand & Shift Breakdown Bar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 lg:p-8 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Diagnóstico de Sustentação por Curva de Demanda
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                      Comparativo de presença real vs. piso de atendimento nos diferentes momentos do varejo
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Pleno ({sustentacaoStats.diasPlenos}d)
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Alerta ({sustentacaoStats.diasAlerta}d)
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Déficit ({sustentacaoStats.diasCriticos}d)
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Segment 1: Dias Úteis */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Dias Úteis (Seg–Sex)
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded">
                        Meta: 6 PA
                      </span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                      {sustentacaoStats.avgPAWeekdays} <span className="text-xs font-bold text-slate-400">CLT/dia</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
                      {sustentacaoStats.weekdaysCount} dias no mês • Rotina padrão de atendimento e reposição
                    </p>
                  </div>

                  {/* Segment 2: Sábados */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Sábados (Happy Sábado)
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded">
                        Meta: 7 PA
                      </span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                      {sustentacaoStats.avgPASaturdays} <span className="text-xs font-bold text-slate-400">CLT/dia</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
                      {sustentacaoStats.saturdaysCount} sábados • Maior fluxo comercial, exige salão reforçado
                    </p>
                  </div>

                  {/* Segment 3: Domingos & Feriados */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Domingos & Feriados
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded">
                        Meta: 5 PA
                      </span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                      {sustentacaoStats.avgPASundays} <span className="text-xs font-bold text-slate-400">CLT/dia</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
                      {sustentacaoStats.sundaysCount} dias nobres • Jornada 12h-20h com rodízio CLT
                    </p>
                  </div>

                </div>
              </div>

              {/* Interactive Heatmap & Day Ray-X Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left: Interactive Month Heatmap Calendar */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 lg:p-8 shadow-sm flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                          Mapa de Calor Diário de Sustentação
                        </h3>
                        <p className="text-xs font-bold text-slate-400">
                          Clique em qualquer dia para inspecionar a equipe e postos
                        </p>
                      </div>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        {MONTH_NAMES[currentMY.month]} {currentMY.year}
                      </span>
                    </div>

                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                      {WEEKDAY_SHORT.map((wd, i) => (
                        <div key={wd} className={`text-[10px] font-black uppercase tracking-wider ${
                          i === 0 ? 'text-rose-500' : i === 6 ? 'text-amber-500' : 'text-slate-400'
                        }`}>
                          {wd}
                        </div>
                      ))}
                    </div>

                    {/* Day Cells */}
                    <div className="grid grid-cols-7 gap-2 flex-1">
                      {/* Empty cells for offset */}
                      {Array.from({ length: new Date(currentMY.year, currentMY.month, 1).getDay() }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="aspect-square rounded-2xl bg-transparent" />
                      ))}

                      {dailyCoverage.map(dayData => {
                        const isSelected = dayData.dayIdx === selectedDayIdx;
                        const isPleno = dayData.status === 'pleno';
                        const isAlerta = dayData.status === 'alerta';
                        const isCritico = dayData.status === 'critico';

                        let cellColor = isPleno
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
                          : isAlerta
                            ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                            : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 animate-pulse';

                        return (
                          <button
                            key={dayData.day}
                            onClick={() => setSelectedDayIdx(dayData.dayIdx)}
                            className={`aspect-square rounded-2xl border p-2 flex flex-col justify-between transition-all text-left relative ${cellColor} ${
                              isSelected
                                ? 'ring-4 ring-indigo-500 dark:ring-indigo-400 scale-[1.04] shadow-lg z-10'
                                : 'hover:scale-[1.02]'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[11px] font-black">{dayData.day}</span>
                              {dayData.isHoliday ? (
                                <span className="text-[7px] font-black bg-rose-500 text-white px-1 py-0.2 rounded">FER</span>
                              ) : dayData.isSunday ? (
                                <span className="text-[7px] font-black bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300 px-1 py-0.2 rounded">DOM</span>
                              ) : dayData.isSaturday ? (
                                <span className="text-[7px] font-black bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300 px-1 py-0.2 rounded">SÁB</span>
                              ) : null}
                            </div>

                            <div className="my-auto text-center">
                              <span className="text-sm font-black leading-none">{dayData.totalPA}</span>
                              <span className="text-[8px] font-bold block opacity-70">PA</span>
                            </div>

                            <div className="flex items-center justify-center gap-1 w-full text-[8px] font-bold">
                              <span title={`Abertura: ${dayData.abertura.length}`}>{dayData.abertura.length}A</span>
                              <span>•</span>
                              <span title={`Fechamento: ${dayData.fechamento.length}`}>{dayData.fechamento.length}F</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right: Selected Day Ray-X Inspection */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 lg:p-8 shadow-sm flex flex-col h-full">
                    
                    <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 uppercase">
                            {selectedDayData.weekdayName}
                          </span>
                          {selectedDayData.isHoliday && (
                            <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 uppercase">
                              Feriado
                            </span>
                          )}
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                          Dia {selectedDayData.day} de {MONTH_NAMES[currentMY.month]}
                        </h3>
                        <p className="text-xs font-bold text-slate-400">
                          {selectedDayData.cltCount} colaboradores CLT + {selectedDayData.apprenticeCount} Aprendiz
                        </p>
                      </div>

                      <div className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 ${
                        selectedDayData.status === 'pleno'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : selectedDayData.status === 'alerta'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        <Icon name={selectedDayData.status === 'pleno' ? 'check_circle' : 'warning'} className="text-sm" />
                        {selectedDayData.status === 'pleno' ? 'Sustentado' : selectedDayData.status === 'alerta' ? 'Atenção' : 'Déficit'}
                      </div>
                    </div>

                    {/* Warnings if any */}
                    {selectedDayData.warnings.length > 0 && (
                      <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider">Alertas Operacionais:</p>
                        {selectedDayData.warnings.map((w, i) => (
                          <p key={i} className="text-xs font-bold flex items-center gap-1.5">
                            <span>•</span> {w}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Shift Breakdowns */}
                    <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                      
                      {/* Abertura */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <Icon name="wb_twilight" className="text-sm" /> Abertura ({selectedDayData.abertura.length})
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">10h às 18h20</span>
                        </div>
                        {selectedDayData.abertura.length === 0 ? (
                          <p className="text-xs font-bold text-rose-500">⚠️ Ninguém escalado na abertura!</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedDayData.abertura.map(w => (
                              <span key={w.emp.id} className="text-[11px] font-black px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200/80 dark:border-slate-700">
                                {getShortName(w.emp.name, employees)}
                                {w.tacticalPos && <span className="ml-1 text-[9px] text-indigo-500 font-bold">({w.tacticalPos})</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Intermediário */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                            <Icon name="sunny" className="text-sm" /> Intermediário ({selectedDayData.intermediario.length})
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">12h às 20h20</span>
                        </div>
                        {selectedDayData.intermediario.length === 0 ? (
                          <p className="text-xs font-bold text-slate-400">Nenhum intermediário (pausas de almoço exigirão revezamento)</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedDayData.intermediario.map(w => (
                              <span key={w.emp.id} className="text-[11px] font-black px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200/80 dark:border-slate-700">
                                {getShortName(w.emp.name, employees)}
                                {w.tacticalPos && <span className="ml-1 text-[9px] text-sky-500 font-bold">({w.tacticalPos})</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Fechamento */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                            <Icon name="nightlight" className="text-sm" /> Fechamento ({selectedDayData.fechamento.length})
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">13h40 às 22h</span>
                        </div>
                        {selectedDayData.fechamento.length === 0 ? (
                          <p className="text-xs font-bold text-rose-500">⚠️ Ninguém escalado no fechamento!</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedDayData.fechamento.map(w => (
                              <span key={w.emp.id} className="text-[11px] font-black px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200/80 dark:border-slate-700">
                                {getShortName(w.emp.name, employees)}
                                {w.tacticalPos && <span className="ml-1 text-[9px] text-indigo-500 font-bold">({w.tacticalPos})</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Folgas / Férias / Ausências */}
                      <div className="pt-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                          Folgas & Ausências ({selectedDayData.offEmps.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedDayData.offEmps.map(o => (
                            <span key={o.emp.id} className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg">
                              {getShortName(o.emp.name, employees)} ({o.shift})
                            </span>
                          ))}
                        </div>
                      </div>

                    </div>

                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ── View Mode: What-If Sales & PA Outliers Simulator ── */}
          {viewMode === 'what-if' && (
            <WhatIfSalesSimulator
              employees={employees}
              currentMY={currentMY}
              customHolidays={customHolidays}
            />
          )}

          {/* ── View Mode: Team Effort & Balance (No naive median) ── */}
          {viewMode === 'team-balance' && (
            <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 lg:p-8 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Equilíbrio de Esforço & Justiça de Escala
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                      Auditoria de horas trabalhadas, presença em dias nobres (Sáb/Dom/Fer) e conformidade legal
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Total: {employeeStats.length} colaboradores ativos
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-3 px-4">Colaborador</th>
                        <th className="py-3 px-3 text-center">Cargo</th>
                        <th className="py-3 px-3 text-center">Dias Trab.</th>
                        <th className="py-3 px-3 text-center">Horas</th>
                        <th className="py-3 px-3 text-center">Aderência</th>
                        <th className="py-3 px-3 text-center">Sábados</th>
                        <th className="py-3 px-3 text-center">Domingos</th>
                        <th className="py-3 px-3 text-center">Feriados</th>
                        <th className="py-3 px-3 text-center">Total Nobres</th>
                        <th className="py-3 px-3 text-center">Seq. Máx</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-bold">
                      {employeeStats.map((s, idx) => (
                        <tr
                          key={s.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                            s.overlooked ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white uppercase flex items-center gap-2">
                            <span className="w-5 text-slate-400 font-mono text-[10px]">{idx + 1}</span>
                            {s.name}
                            {s.overlooked && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-500 text-white" title="Alerta: Mais de 6 dias seguidos de trabalho">
                                6x1
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center text-slate-500 dark:text-slate-400">
                            {s.cargo}
                          </td>
                          <td className="py-3.5 px-3 text-center text-slate-900 dark:text-white font-black">
                            {s.worked} / {s.theoreticalMax}d
                          </td>
                          <td className="py-3.5 px-3 text-center text-indigo-600 dark:text-indigo-400 font-black">
                            {s.totalHours}h
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                              s.adherence > 105
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : s.adherence < 85
                                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {s.adherence.toFixed(0)}%
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center text-amber-600 dark:text-amber-400 font-black">
                            {s.saturdaysWorked}
                          </td>
                          <td className="py-3.5 px-3 text-center text-rose-600 dark:text-rose-400 font-black">
                            {s.sundaysWorked}
                          </td>
                          <td className="py-3.5 px-3 text-center text-sky-600 dark:text-sky-400 font-black">
                            {s.holidaysWorked}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {s.nobleDaysWorked}d
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className={`text-xs font-black ${s.overlooked ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>
                              {s.maxStreak}d
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedEmpId(s.id);
                                setShowIndividualModal(true);
                              }}
                              className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-300 transition-all shadow-sm"
                            >
                              Ver / Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── View Mode: Team Monthly Calendar ── */}
          {viewMode === 'team-calendar' && (
            <div id="printable-team-calendar" className="h-full animate-fade-in bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-auto transition-colors print:p-0 print:border-none print:shadow-none">
              <TeamMonthlyCalendar
                employees={employees}
                currentMY={currentMY}
                customHolidays={customHolidays}
                getEffectiveShift={getEffectiveShift}
              />
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="px-8 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between sticky bottom-0 transition-colors no-print">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Sustentação de PA & Cobertura Operacional • Ri Happy Dashboard v2.0
          </p>
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-500 dark:hover:text-white transition-all shadow-lg active:scale-95"
          >
            Sair da Análise
          </button>
        </div>

      </div>

      {/* Individual Modal if opened */}
      {showIndividualModal && selectedEmployee && (
        <IndividualEditModal
          employee={selectedEmployee.emp}
          currentMY={currentMY}
          customHolidays={customHolidays}
          getEffectiveShift={getEffectiveShift}
          onUpdateShift={onUpdateShift}
          onUpdateHour={onUpdateHour}
          onClose={() => setShowIndividualModal(false)}
          jornadaSettings={jornadaSettings}
        />
      )}

    </div>
  );
};

// ─── Subcomponents ─────────────────────────────────────────────────────────────

const TeamMonthlyCalendar: React.FC<{
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  getEffectiveShift: (emp: Employee, dayIdx: number) => ShiftType;
}> = ({ employees, currentMY, customHolidays, getEffectiveShift }) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;

  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ type: 'empty' });
  
  const sortedEmployees = [...employees]
    .filter(e => !e.isHidden && e.status === 'active')
    .sort((a, b) => {
      const getStartHour = (wp: string) => {
        const match = wp.match(/(\d+)h/);
        return match ? parseInt(match[1]) : 99;
      };
      const hA = getStartHour(a.workPeriod || '');
      const hB = getStartHour(b.workPeriod || '');
      if (hA !== hB) return hA - hB;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

  for (let i = 1; i <= daysInMonth; i++) {
    const workingDayData = sortedEmployees.map(emp => {
      const shift = getEffectiveShift(emp, i - 1);
      const hours = (emp.dailyHours[monthKey] || [])[i - 1] || emp.workPeriod;
      const isOff = !isWorkingShift(shift) && shift !== 'C';

      return {
        name: getShortName(emp.name, employees),
        shift,
        hours,
        isOff,
        isCourse: shift === 'C',
        isVacation: shift === 'FE'
      };
    }).filter(d => !d.isOff || d.isCourse);

    cells.push({ type: 'day', date: i, dayData: workingDayData });
  }

  return (
    <div className="w-full print:px-2">
      <div className="grid grid-cols-7 gap-4 mb-4 print:gap-1 print:mb-2">
        {WEEKDAY_NAMES.map(wd => (
          <div key={wd} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{wd}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-4 print:gap-1">
        {cells.map((cell, idx) => (
          <div key={idx} className={`min-h-[160px] print:min-h-0 rounded-[2rem] print:rounded-lg border p-5 print:p-2 flex flex-col gap-1.5 print:gap-1 transition-all ${cell.type === 'empty' ? 'border-transparent' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
            {cell.type === 'day' && (
              <>
                <div className="flex justify-between items-start mb-3 print:mb-1">
                  <span className="text-xs font-black text-slate-400 print:text-[10px]">{cell.date}</span>
                  <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter">
                    {WEEKDAY_NAMES[new Date(currentMY.year, currentMY.month, cell.date).getDay()].split('-')[0]}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {cell.dayData.map((d, i) => (
                    <div key={i} className={`flex items-center justify-between gap-1 p-2 print:p-1 rounded-xl print:rounded-md border ${
                      d.isCourse
                        ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900 text-teal-700 dark:text-teal-300'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                    }`}>
                      <span className="text-[9px] print:text-[8px] font-black uppercase truncate">{d.name}</span>
                      <span className={`text-[8px] font-bold shrink-0 ${d.isCourse ? 'mt-[-2px]' : 'hidden'}`}>
                        {d.isCourse && <Icon name="school" className="text-[10px]" />}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Individual Edit Modal ───────────────────────────────────────────────────

const SHIFT_OPTIONS_MODAL = [
  { value: 'T', label: 'T — Trabalho' },
  { value: 'F', label: 'F — Folga' },
  { value: 'AT', label: 'AT — Atestado Médico' },
  { value: 'C', label: 'C — Curso' },
  { value: 'FE', label: 'FE — Férias' },
];

interface IndividualEditModalProps {
  employee: Employee;
  currentMY: MonthYear;
  customHolidays: Holiday[];
  getEffectiveShift: (emp: Employee, dayIdx: number) => ShiftType;
  onUpdateShift?: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateHour?: (empId: string, dayIdx: number, newHour: string) => void;
  onClose: () => void;
  jornadaSettings?: JornadaSettings;
}

const IndividualEditModal: React.FC<IndividualEditModalProps> = ({
  employee, currentMY, customHolidays, getEffectiveShift,
  onUpdateShift, onUpdateHour, onClose, jornadaSettings,
}) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
  const canEdit = !!onUpdateShift;

  const getHour = (dayIdx: number): string => {
    const mh = (employee.dailyHours || {})[monthKey] || [];
    return mh[dayIdx] || employee.workPeriod || '';
  };

  const getAvailHours = (dayIdx: number): string[] => {
    const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
    const ds = `${currentMY.year}-${String(currentMY.month+1).padStart(2,'0')}-${String(dayIdx+1).padStart(2,'0')}`;
    const settings = jornadaSettings || DEFAULT_JORNADA_SETTINGS;
    if (holidaySet.has(ds)) return settings.shiftHours.holiday;
    if (date.getDay() === 0) return settings.shiftHours.sunday;
    return settings.shiftHours.weekday;
  };

  type CellDay = { type: 'day'; day: number; dayIdx: number; shift: ShiftType; isHoliday: boolean; isSunday: boolean; isSaturday: boolean; hour: string };
  type Cell = { type: 'empty' } | CellDay;
  const cells: Cell[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ type: 'empty' });
  for (let i = 1; i <= daysInMonth; i++) {
    const dayIdx = i - 1;
    const ds = `${currentMY.year}-${String(currentMY.month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const date = new Date(currentMY.year, currentMY.month, i);
    cells.push({
      type: 'day',
      day: i,
      dayIdx,
      shift: getEffectiveShift(employee, dayIdx),
      isHoliday: holidaySet.has(ds),
      isSunday: date.getDay() === 0,
      isSaturday: date.getDay() === 6,
      hour: getHour(dayIdx)
    });
  }

  const shiftBg = (s: ShiftType) => {
    if (s === 'T') return 'bg-indigo-600';
    if (['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'].includes(s as string)) return 'bg-emerald-600';
    if (s === 'F') return 'bg-orange-500';
    if (s?.startsWith('FF')) return 'bg-red-500';
    if (s === 'C') return 'bg-teal-500';
    if (s === 'FE') return 'bg-indigo-800';
    if (s === 'DO') return 'bg-fuchsia-600';
    if (s === 'AT') return 'bg-rose-600';
    return 'bg-slate-300';
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-lg uppercase shadow-sm">
              {employee.name.substring(0,2)}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{employee.name}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Calendário Individual — {MONTH_NAMES[currentMY.month]} {currentMY.year}
                {canEdit && <span className="ml-2 text-indigo-500 dark:text-indigo-400">• Clique para editar</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const el = document.getElementById('modal-calendar-capture');
                if (el) {
                  const dataUrl = await toPng(el, { 
                    backgroundColor: '#ffffff', 
                    pixelRatio: 2,
                    style: { 
                      padding: '30px', 
                      borderRadius: '32px',
                      transform: 'scale(0.9)',
                      transformOrigin: 'center'
                    } 
                  });
                  const link = document.createElement('a');
                  link.download = `escala-${employee.name.toLowerCase().replace(/\s+/g, '-')}.png`;
                  link.href = dataUrl;
                  link.click();
                }
              }}
              className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full transition-colors"
              title="Baixar Calendário"
            >
              <Icon name="download" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <Icon name="close" className="text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40 dark:bg-slate-950/40 custom-scrollbar">
          <div id="modal-calendar-capture" className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
            <div className="mb-6 text-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Escala Individual</p>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{employee.name}</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase">{MONTH_NAMES[currentMY.month]} {currentMY.year}</p>
            </div>
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {WEEKDAY_SHORT.map(wd => (
                <div key={wd} className="text-center text-[9px] font-black text-slate-400 uppercase">{wd}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((cell, idx) => {
                if (cell.type === 'empty') return <div key={idx} style={{minHeight:'70px'}} />;
                const { day, dayIdx, shift, isHoliday, isSunday, isSaturday, hour } = cell;
                const availH = getAvailHours(dayIdx);
                return (
                  <div
                    key={idx}
                    style={{ minHeight: '70px' }}
                    className={`rounded-xl border flex flex-col items-center justify-start pt-1 gap-0.5 p-1 relative ${
                      isHoliday ? 'border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30' :
                      isSunday  ? 'border-orange-300 dark:border-orange-800 bg-orange-50/70 dark:bg-orange-950/30' :
                      isSaturday? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40' :
                      'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <span className={`text-[8px] font-black self-start pl-0.5 ${isHoliday ? 'text-rose-400' : isSunday ? 'text-orange-400' : 'text-slate-400'}`}>
                      {day}
                    </span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white shadow-sm ${shiftBg(shift)}`}>
                      {shift?.split(' ')[0]}
                    </div>
                    {canEdit && (
                      <select
                        value={shift}
                        onChange={e => onUpdateShift!(employee.id, dayIdx, e.target.value as ShiftType)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      >
                        {SHIFT_OPTIONS_MODAL.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        {shift?.startsWith('FF ') && <option value={shift}>{shift}</option>}
                      </select>
                    )}
                    {(shift === 'T' || shift === 'C') && (
                      <div className="w-full px-0.5 relative z-20" onClick={e => e.stopPropagation()}>
                        {canEdit && onUpdateHour ? (
                          <select
                            value={hour}
                            onChange={e => onUpdateHour!(employee.id, dayIdx, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-full text-[7px] font-bold text-slate-500 dark:text-slate-400 bg-transparent border-none outline-none text-center cursor-pointer"
                          >
                            {availH.map(h => <option key={h} value={h}>{h}</option>)}
                            {hour && !availH.includes(hour) && <option value={hour}>{hour}</option>}
                          </select>
                        ) : (
                          <span className="text-[7px] font-bold text-slate-400 block text-center truncate">{hour.split(' ')[0]}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {canEdit && (
            <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900 flex flex-wrap gap-3 items-center justify-center">
              <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest w-full text-center">
                Clique em qualquer dia para alterar o turno • Alterações refletem na tabela principal
              </p>
              {SHIFT_OPTIONS_MODAL.map(o => (
                <div key={o.value} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-black text-white ${shiftBg(o.value as ShiftType)}`}>
                    {o.value}
                  </div>
                  {o.label.split('—')[1]?.trim()}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-white dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-500 dark:hover:text-white transition-all shadow-lg active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
