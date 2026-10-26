import React, { useMemo, useState } from 'react';
import { Employee, MonthYear, Holiday, ShiftType, JornadaSettings } from '../types';
import { isWorkingShift } from '../hooks/useScheduleEngine';
import { HolidayCredit } from '../hooks/useHolidayCredits';
import { Icon } from './Icon';
import { 
  buildHolidaySet, 
  DEFAULT_JORNADA_SETTINGS, 
  getNationalHolidays,
  getShortName, 
  isEmployeeActiveInMonth 
} from '../constants';
import { toPng } from 'html-to-image';
import { addDaysToISODate } from '../src/utils/date';
import { getShiftCellStyle, ROLE_VISUAL_MAP, normalizeEmployeeRole } from '../src/utils/design-system';

interface AnalysisPanelProps {
  employees: Employee[];
  currentMY: MonthYear;
  customHolidays: Holiday[];
  onClose: () => void;
  onUpdateShift?: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateHour?: (empId: string, dayIdx: number, newHour: string) => void;
  jornadaSettings?: JornadaSettings;
  holidayCredits?: Record<string, HolidayCredit[]>;
  onOpenWorkedHolidays?: () => void;
}

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const BASE_SHIFT_OPTIONS: { value: ShiftType; label: string; desc: string }[] = [
  { value: 'T', label: 'T', desc: 'Trabalho Regular' },
  { value: 'F', label: 'F', desc: 'Folga Semanal' },
  { value: 'FE', label: 'FE', desc: 'Férias' },
  { value: 'AT', label: 'AT', desc: 'Atestado Médico' },
  { value: 'DO', label: 'DO', desc: 'Folga Aniversário (Day Off)' },
  { value: 'C', label: 'C', desc: 'Curso Teórico' },
];

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ 
  employees, 
  currentMY, 
  customHolidays, 
  onClose, 
  onUpdateShift, 
  onUpdateHour, 
  jornadaSettings = DEFAULT_JORNADA_SETTINGS,
  holidayCredits = {},
  onOpenWorkedHolidays,
}) => {
  const [viewMode, setViewMode] = useState<'individual' | 'team'>('individual');
  const [calendarMode, setCalendarMode] = useState<'edit' | 'preview'>(onUpdateShift ? 'edit' : 'preview');
  const [searchTerm, setSearchTerm] = useState('');
  
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  // Active employees for this month
  const activeEmployees = useMemo(() => {
    return employees.filter(e => isEmployeeActiveInMonth(e, currentMY.year, currentMY.month));
  }, [employees, currentMY.year, currentMY.month]);

  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(
    activeEmployees[0]?.id || null
  );

  const getEffectiveShift = (emp: Employee, dayIdx: number): ShiftType => {
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    
    // Check vacation
    if (emp.vacationStart) {
      const start = emp.vacationStart;
      const end = emp.vacationEnd || addDaysToISODate(start, 29);
      if (dateStr >= start && dateStr <= end) return 'FE';
    }

    // Check birthday
    if (emp.birthday) {
      const empMD = emp.birthday.length > 5 ? emp.birthday.substring(5) : emp.birthday;
      const dateMD = dateStr.substring(5);
      if (empMD === dateMD) return 'DO';
    }

    const monthShifts = emp.shifts[monthKey] || [];
    return monthShifts[dayIdx] || 'F';
  };

  // Operational statistics per employee
  const employeeSummaries = useMemo(() => {
    return activeEmployees.map(emp => {
      let worked = 0;
      let folgas = 0;
      let sundaysWorked = 0;
      let sundaysOff = 0;
      let holidaysWorked = 0;
      let currentStreak = 0;
      let maxStreak = 0;
      let totalHours = 0;

      for (let d = 0; d < daysInMonth; d++) {
        const s = getEffectiveShift(emp, d);
        const date = new Date(currentMY.year, currentMY.month, d + 1);
        const isSun = date.getDay() === 0;
        const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
        const isHol = holidaySet.has(dateStr);

        if (isWorkingShift(s)) {
          worked++;
          currentStreak++;
          if (currentStreak > maxStreak) maxStreak = currentStreak;
          if (isSun) sundaysWorked++;
          if (isHol) holidaysWorked++;

          // Daily hours
          const dailyH = (emp.dailyHours?.[monthKey] || [])[d] || emp.workPeriod || '';
          const match = dailyH.match(/(\d+):?(\d*)?\s*-\s*(\d+):?(\d*)?/);
          if (match) {
            const h1 = parseInt(match[1]);
            const h2 = parseInt(match[3]);
            const duration = (h2 >= h1 ? h2 - h1 : (24 - h1 + h2)) - 1; // approx lunch discount
            totalHours += Math.max(4, Math.min(8.8, duration));
          } else {
            totalHours += 7.33;
          }
        } else {
          currentStreak = 0;
          folgas++;
          if (isSun) sundaysOff++;
        }
      }

      return {
        emp,
        worked,
        folgas,
        sundaysWorked,
        sundaysOff,
        holidaysWorked,
        maxStreak,
        totalHours: Math.round(totalHours),
        hasCltAlert: maxStreak > 6,
      };
    });
  }, [activeEmployees, daysInMonth, monthKey, holidaySet, currentMY]);

  const selectedSummary = useMemo(() => {
    return employeeSummaries.find(s => s.emp.id === selectedEmpId) || employeeSummaries[0] || null;
  }, [employeeSummaries, selectedEmpId]);

  // Filtered employees for sidebar
  const filteredSummaries = useMemo(() => {
    if (!searchTerm.trim()) return employeeSummaries;
    const q = searchTerm.toLowerCase();
    return employeeSummaries.filter(s => 
      s.emp.name.toLowerCase().includes(q) ||
      (s.emp.cargo || '').toLowerCase().includes(q) ||
      (s.emp.shiftName || '').toLowerCase().includes(q)
    );
  }, [employeeSummaries, searchTerm]);

  const handleDownloadPng = async () => {
    const el = document.getElementById('individual-calendar-capture');
    if (!el || !selectedSummary) return;

    try {
      const dataUrl = await toPng(el, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement && node.dataset?.exportHide === 'true') {
            return false;
          }
          return true;
        },
        style: {
          padding: '24px',
          borderRadius: '20px',
        }
      });
      const link = document.createElement('a');
      link.download = `calendario-semanal-${selectedSummary.emp.name.toLowerCase().replace(/\s+/g, '-')}-${monthKey}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Falha ao exportar imagem do calendário:', err);
    }
  };

  return (
    <div className="flex flex-col h-full print:h-auto print:overflow-visible animate-fade-in bg-zinc-50 dark:bg-zinc-950 print:bg-white text-zinc-900 dark:text-zinc-100 print:text-black overflow-hidden">
      
      {/* ── Top Bar ── */}
      <header className="px-4 sm:px-6 py-3.5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0 no-print">
        
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors shrink-0"
            title="Voltar para a Escala"
            aria-label="Voltar para a Escala"
          >
            <Icon name="arrow_back" className="text-xl" />
          </button>
          
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Icon name="calendar_month" className="text-xl" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                Calendário Semanal (Dom-Sáb)
              </h2>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                {MONTH_NAMES[currentMY.month]} {currentMY.year}
              </span>
            </div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
              {viewMode === 'individual' 
                ? (selectedSummary ? `Visualizando escala de ${selectedSummary.emp.name}` : 'Selecione um colaborador')
                : 'Visão de equipe completa em semanas (Dom-Sáb)'}
            </p>
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Edit / Preview Mode Switcher (Individual mode) */}
          {viewMode === 'individual' && onUpdateShift && (
            <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex gap-1 border border-zinc-200/70 dark:border-zinc-700/70">
              <button
                type="button"
                onClick={() => setCalendarMode('edit')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  calendarMode === 'edit'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
                title="Modo Edição: alterar folgas, feriados pendentes e horários de turno"
              >
                <Icon name="edit_calendar" className="text-sm" />
                <span className="hidden lg:inline">Modo Edição</span>
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode('preview')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  calendarMode === 'preview'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
                title="Modo Visualizar: versão limpa (sem horários) pronta para baixar ou imprimir para o colaborador"
              >
                <Icon name="visibility" className="text-sm" />
                <span className="hidden lg:inline">Modo Visualizar</span>
              </button>
            </div>
          )}

          {/* Mode Switcher (Colaborador vs Equipe) */}
          <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setViewMode('individual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'individual'
                  ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Icon name="person" className="text-sm" />
              <span className="hidden sm:inline">Colaborador</span>
            </button>
            <button
              onClick={() => setViewMode('team')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'team'
                  ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Icon name="groups" className="text-sm" />
              <span className="hidden sm:inline">Equipe Completa</span>
            </button>
          </div>

          {/* Download PNG (individual mode only) */}
          {viewMode === 'individual' && selectedSummary && (
            <button
              onClick={handleDownloadPng}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
              title="Baixar imagem do calendário"
            >
              <Icon name="download" className="text-sm" />
              <span className="hidden md:inline">Baixar PNG</span>
            </button>
          )}

          {/* Print */}
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            title="Imprimir visualização"
          >
            <Icon name="print" className="text-sm" />
            <span className="hidden md:inline">Imprimir</span>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors ml-1"
            title="Fechar"
            aria-label="Fechar painel"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {viewMode === 'individual' ? (
          <>
            {/* ── Left Sidebar: Employee Selector ── */}
            <aside className="w-full md:w-80 lg:w-96 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 no-print">
              
              {/* Search & Header */}
              <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800">
                <div className="relative">
                  <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar colaborador ou função..."
                    className="w-full pl-8 pr-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-xs rounded-xl border border-transparent focus:border-orange-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <Icon name="close" className="text-xs" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 mt-2 px-1">
                  <span>{filteredSummaries.length} colaboradores</span>
                  <span>Mês: {MONTH_NAMES[currentMY.month]}</span>
                </div>
              </div>

              {/* Employee Scrollable List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {filteredSummaries.map(s => {
                  const isSelected = selectedSummary?.emp.id === s.emp.id;
                  const roleKey = normalizeEmployeeRole(s.emp.cargo || s.emp.role || 'Vendas');
                  const roleConfig = ROLE_VISUAL_MAP[roleKey];

                  return (
                    <button
                      key={s.emp.id}
                      onClick={() => setSelectedEmpId(s.emp.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-400 dark:border-orange-500/50 shadow-xs ring-1 ring-orange-400/40'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className={`text-xs font-black truncate uppercase ${
                            isSelected ? 'text-orange-950 dark:text-orange-100' : 'text-zinc-900 dark:text-zinc-100'
                          }`}>
                            {s.emp.name}
                          </p>
                          {s.hasCltAlert && (
                            <span 
                              className="px-1 py-0.2 rounded text-[10px] font-black bg-rose-500 text-white shrink-0 animate-pulse"
                              title={`Sequência de ${s.maxStreak} dias sem folga (alerta CLT)`}
                            >
                              7º
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${roleConfig.badgeClass}`}>
                            {roleConfig.code}
                          </span>
                          <span className="text-zinc-400 truncate">
                            {s.emp.shiftName || 'Turno Padrão'}
                          </span>
                          {(holidayCredits[s.emp.id] || []).some(c => c.status === 'pending') && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase bg-fuchsia-100 dark:bg-fuchsia-950/60 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800"
                              title="Possui folga(s) de feriado pendente(s)"
                            >
                              {(holidayCredits[s.emp.id] || []).filter(c => c.status === 'pending').length} FF Pend.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick counts */}
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-black tabular-nums block ${
                          isSelected ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-800 dark:text-zinc-200'
                        }`}>
                          {s.worked}d trab
                        </span>
                        <span className="text-[11px] font-bold text-zinc-400 tabular-nums">
                          {s.folgas} folgas
                        </span>
                      </div>
                    </button>
                  );
                })}

                {filteredSummaries.length === 0 && (
                  <div className="p-8 text-center text-zinc-400 text-xs">
                    Nenhum colaborador encontrado com "{searchTerm}".
                  </div>
                )}
              </div>
            </aside>

            {/* ── Main Hero Area: Dom-Sáb Calendar ── */}
            <main className="flex-1 overflow-y-auto print:overflow-visible p-4 sm:p-6 lg:p-8 print:p-0 bg-zinc-100/60 dark:bg-zinc-950 print:bg-white custom-scrollbar">
              {selectedSummary ? (
                <div 
                  id="individual-calendar-capture" 
                  className="max-w-5xl mx-auto bg-white dark:bg-zinc-900 print:bg-white rounded-2xl border border-zinc-200 dark:border-zinc-800 print:border-zinc-300 p-4 sm:p-7 print:p-4 shadow-xs print:shadow-none space-y-5"
                >
                  
                  {/* Employee Hero Card & Metrics */}
                  <div className="flex flex-col gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black text-lg uppercase shadow-sm shrink-0">
                          {selectedSummary.emp.name.substring(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight uppercase truncate">
                              {selectedSummary.emp.name}
                            </h3>
                            {(() => {
                              const role = normalizeEmployeeRole(selectedSummary.emp.cargo || selectedSummary.emp.role || 'Vendas');
                              const meta = ROLE_VISUAL_MAP[role];
                              return (
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase shrink-0 ${meta.badgeClass}`}>
                                  {meta.label}
                                </span>
                              );
                            })()}
                          </div>
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Escala Mensal • {MONTH_NAMES[currentMY.month]} de {currentMY.year}
                            {calendarMode === 'edit' && (
                              <span
                                data-export-hide="true"
                                className="ml-2 text-zinc-600 dark:text-zinc-300 font-bold no-print print:hidden"
                              >
                                • Horário Base: {selectedSummary.emp.workPeriod || '09:40 - 18:00'}
                              </span>
                            )}
                            {selectedSummary.emp.preferredDayOff && (
                              <span className="ml-2 text-rose-600 dark:text-rose-400 font-bold">
                                • Folga Preferencial: {selectedSummary.emp.preferredDayOff}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Inline Mode Selector Banner (Hidden on PNG Download & Print) */}
                      {onUpdateShift && (
                        <div
                          data-export-hide="true"
                          className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 self-start sm:self-center shrink-0 no-print print:hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setCalendarMode('edit')}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                              calendarMode === 'edit'
                                ? 'bg-orange-500 text-white shadow-xs'
                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                          >
                            <Icon name="edit_calendar" className="text-xs" />
                            <span>Modo Edição</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalendarMode('preview')}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                              calendarMode === 'preview'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                          >
                            <Icon name="visibility" className="text-xs" />
                            <span>Visualizar (Colaborador)</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Pending Holiday Credits Connection Bar (Modo Edição only, hidden on export/print) */}
                    {calendarMode === 'edit' && onUpdateShift && (() => {
                      const empCredits = holidayCredits[selectedSummary.emp.id] || [];
                      const pending = empCredits.filter(c => c.status === 'pending');
                      const scheduled = empCredits.filter(c => c.status === 'scheduled' || c.status === 'granted');
                      return (
                        <div
                          data-export-hide="true"
                          className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-xs no-print print:hidden ${
                            pending.length > 0
                              ? 'bg-fuchsia-50/80 dark:bg-fuchsia-950/30 border-fuchsia-200 dark:border-fuchsia-800/70 text-fuchsia-900 dark:text-fuchsia-200'
                              : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-700/70 text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <Icon
                              name={pending.length > 0 ? 'event_available' : 'info'}
                              className={`text-sm shrink-0 ${pending.length > 0 ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-zinc-400'}`}
                            />
                            {pending.length > 0 ? (
                              <span className="font-bold">
                                <strong className="font-black uppercase">{pending.length} folga(s) de feriado disponível(is) para agendar:</strong>{' '}
                                {pending.map(c => `${formatHolidayDDMM(c.holidayDate)} (${c.holidayName})`).join(' • ')}
                              </span>
                            ) : (
                              <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                                Nenhuma folga de feriado pendente no momento
                                {scheduled.length > 0 ? ` (${scheduled.length} já agendada(s)/concedida(s))` : ' — a opção FF só é liberada quando o colaborador trabalha em feriado.'}
                              </span>
                            )}
                          </div>
                          {onOpenWorkedHolidays && (
                            <button
                              type="button"
                              onClick={onOpenWorkedHolidays}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors shrink-0"
                              title="Abrir menu de Controle de Créditos e Folgas de Feriados Pendentes"
                            >
                              <Icon name="list_alt" className="text-xs" />
                              <span>Folgas de Feriado Pendentes</span>
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Operational Summary Containers (Responsive 2 cols on mobile, 4 equal cols on sm+/print) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-2.5 sm:gap-3 w-full">
                      <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl px-3 py-2.5 flex flex-col items-center justify-center text-center min-w-0">
                        <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate w-full">
                          Trabalhados
                        </span>
                        <span className="block font-black text-emerald-600 dark:text-emerald-400 text-sm sm:text-base tabular-nums whitespace-nowrap mt-0.5">
                          {selectedSummary.worked} dias
                        </span>
                      </div>
                      <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60 rounded-xl px-3 py-2.5 flex flex-col items-center justify-center text-center min-w-0">
                        <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate w-full">
                          Folgas
                        </span>
                        <span className="block font-black text-rose-600 dark:text-rose-400 text-sm sm:text-base tabular-nums whitespace-nowrap mt-0.5">
                          {selectedSummary.folgas} ({selectedSummary.sundaysOff}D)
                        </span>
                      </div>
                      <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-xl px-3 py-2.5 flex flex-col items-center justify-center text-center min-w-0">
                        <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate w-full">
                          Domingos Trab.
                        </span>
                        <span className="block font-black text-amber-600 dark:text-amber-400 text-sm sm:text-base tabular-nums whitespace-nowrap mt-0.5">
                          {selectedSummary.sundaysWorked}D
                        </span>
                      </div>
                      <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl px-3 py-2.5 flex flex-col items-center justify-center text-center min-w-0">
                        <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate w-full">
                          Horas CLT
                        </span>
                        <span className="block font-black text-indigo-600 dark:text-indigo-400 text-sm sm:text-base tabular-nums whitespace-nowrap mt-0.5">
                          {selectedSummary.totalHours}h
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Calendário Semanal (Dom-Sáb) ── */}
                  <IndividualWeeklyCalendarView
                    employee={selectedSummary.emp}
                    currentMY={currentMY}
                    customHolidays={customHolidays}
                    getEffectiveShift={getEffectiveShift}
                    calendarMode={calendarMode}
                    onUpdateShift={onUpdateShift}
                    onUpdateHour={onUpdateHour}
                    jornadaSettings={jornadaSettings}
                    employeeHolidayCredits={holidayCredits[selectedSummary.emp.id] || []}
                  />

                  {/* Legend Bar */}
                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold text-zinc-500">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Legenda:</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span> 
                        <strong className="text-zinc-700 dark:text-zinc-300">T</strong> Trabalho
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-rose-500"></span> 
                        <strong className="text-zinc-700 dark:text-zinc-300">F</strong> Folga
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-fuchsia-500"></span> 
                        <strong className="text-zinc-700 dark:text-zinc-300">Ref. DD/MM</strong> Folga Compensatória (Feriado)
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-sky-500"></span> 
                        <strong className="text-zinc-700 dark:text-zinc-300">FE</strong> Férias
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-amber-500"></span> 
                        <strong className="text-zinc-700 dark:text-zinc-300">AT</strong> Atestado
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-purple-500"></span> 
                        <strong className="text-zinc-700 dark:text-zinc-300">DO</strong> Day Off
                      </span>
                    </div>

                    {onUpdateShift && (
                      <span
                        data-export-hide="true"
                        className="text-zinc-400 flex items-center gap-1 no-print print:hidden"
                      >
                        <Icon name={calendarMode === 'edit' ? 'touch_app' : 'visibility'} className="text-xs text-orange-500" />
                        {calendarMode === 'edit'
                          ? 'Clique no dia para alterar turno/folga ou no horário inferior para mudar o turno'
                          : 'Modo Visualizar ativo — horários ocultos para download/impressão do colaborador'}
                      </span>
                    )}
                  </div>

                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-zinc-400 text-sm font-semibold">
                  Selecione um colaborador na lista ao lado para ver seu calendário.
                </div>
              )}
            </main>
          </>
        ) : (
          /* ── Team Calendar (Dom-Sáb) ── */
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-zinc-100/60 dark:bg-zinc-950 custom-scrollbar">
            <div id="printable-team-calendar" className="max-w-7xl mx-auto bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 sm:p-8 shadow-xs">
              <div className="mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">
                    Escala Geral de Equipe — {MONTH_NAMES[currentMY.month]} {currentMY.year}
                  </h3>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Exibição de todos os colaboradores presentes por semana (Domingo a Sábado)
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-xs"
                >
                  <Icon name="print" className="text-sm" /> Imprimir Escala
                </button>
              </div>

              <TeamMonthlyCalendar
                employees={employees}
                currentMY={currentMY}
                customHolidays={customHolidays}
                getEffectiveShift={getEffectiveShift}
              />
            </div>
          </main>
        )}

      </div>
    </div>
  );
};

// ─── Individual Weekly Calendar Grid ───────────────────────────────────────────

interface IndividualWeeklyCalendarViewProps {
  employee: Employee;
  currentMY: MonthYear;
  customHolidays: Holiday[];
  getEffectiveShift: (emp: Employee, dayIdx: number) => ShiftType;
  calendarMode: 'edit' | 'preview';
  onUpdateShift?: (empId: string, dayIdx: number, newShift: ShiftType) => void;
  onUpdateHour?: (empId: string, dayIdx: number, newHour: string) => void;
  jornadaSettings?: JornadaSettings;
  employeeHolidayCredits?: HolidayCredit[];
}

const formatHolidayDDMM = (dateOrRef: string): string => {
  const clean = dateOrRef.replace('-extra', '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [, m, d] = clean.split('-');
    return `${d}/${m}`;
  }
  if (/^\d{2}\/\d{2}$/.test(clean)) {
    return clean;
  }
  if (/^\d{2}-\d{2}$/.test(clean)) {
    const [m, d] = clean.split('-');
    return `${d}/${m}`;
  }
  return clean;
};

const IndividualWeeklyCalendarView: React.FC<IndividualWeeklyCalendarViewProps> = ({
  employee,
  currentMY,
  customHolidays,
  getEffectiveShift,
  calendarMode,
  onUpdateShift,
  onUpdateHour,
  jornadaSettings = DEFAULT_JORNADA_SETTINGS,
  employeeHolidayCredits = [],
}) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay(); // 0 is Sunday
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);
  const canEdit = calendarMode === 'edit' && !!onUpdateShift;

  const getAvailHours = (dayIdx: number): string[] => {
    const date = new Date(currentMY.year, currentMY.month, dayIdx + 1);
    const ds = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    if (holidaySet.has(ds)) return jornadaSettings.shiftHours.holiday;
    if (date.getDay() === 0) return jornadaSettings.shiftHours.sunday;
    return jornadaSettings.shiftHours.weekday;
  };

  const yearHolidays = useMemo(() => {
    const all = [...getNationalHolidays(currentMY.year), ...customHolidays]
      .filter(h => h.date.startsWith(String(currentMY.year)));
    const unique = all.filter((h, i, self) => i === self.findIndex(t => t.date === h.date));
    return unique.sort((a, b) => a.date.localeCompare(b.date));
  }, [currentMY.year, customHolidays]);

  // Mapeia cada dia de folga compensatória (FF) para a data do feriado a que se refere
  // e calcula quais créditos de feriado o colaborador tem direito a agendar
  const { holidayCompMap, eligiblePendingCredits } = useMemo(() => {
    const map: Record<string, { dateLabel: string; holidayName?: string }> = {};

    // Primeiro preenche com os créditos já casados pelo useHolidayCredits
    for (const credit of employeeHolidayCredits) {
      if (credit.offDate) {
        map[credit.offDate] = {
          dateLabel: formatHolidayDDMM(credit.holidayDate),
          holidayName: credit.holidayName,
        };
      }
    }

    const workedHolidays: { id: string; date: string; name: string }[] = [];
    const ffOffDays: { offDate: string; explicitRef?: string }[] = [];

    const sortedMonthKeys = Object.keys(employee.shifts || {})
      .filter(mk => mk.startsWith(String(currentMY.year)))
      .sort();

    for (const mk of sortedMonthKeys) {
      const mShifts = employee.shifts[mk] || [];
      mShifts.forEach((rawShift, idx) => {
        const dStr = `${mk}-${String(idx + 1).padStart(2, '0')}`;
        let effShift = rawShift;
        if (employee.vacationStart && employee.vacationEnd && dStr >= employee.vacationStart && dStr <= employee.vacationEnd) {
          effShift = 'FE';
        } else if (employee.atestadoStart && employee.atestadoEnd && dStr >= employee.atestadoStart && dStr <= employee.atestadoEnd) {
          effShift = 'AT';
        }

        const hol = yearHolidays.find(h => h.date === dStr);
        if (!employee.isYoungApprentice && hol && isWorkingShift(effShift)) {
          if (dStr.endsWith('-05-01')) {
            workedHolidays.push({ id: dStr, date: dStr, name: `${hol.name} (Folga 1)` });
            workedHolidays.push({ id: `${dStr}-extra`, date: dStr, name: `${hol.name} (Folga 2)` });
          } else {
            workedHolidays.push({ id: dStr, date: dStr, name: hol.name });
          }
        }

        if (typeof effShift === 'string' && effShift.startsWith('FF')) {
          const explicit = effShift.length > 2 ? effShift.slice(2).trim() : undefined;
          ffOffDays.push({ offDate: dStr, explicitRef: explicit || undefined });
        }
      });
    }

    const usedWorkedIndices = new Set<number>();
    const resolvedOffDates = new Set<string>();

    // 1. Casamento explícito (ex.: "FF 2026-04-21" ou "FF 21/04")
    for (const off of ffOffDays) {
      const explicitRef = off.explicitRef;
      if (!explicitRef) continue;
      const cleanRef = explicitRef.replace('-extra', '').replace('/', '-');
      const whIdx = workedHolidays.findIndex((wh, idx) => {
        if (usedWorkedIndices.has(idx)) return false;
        return wh.id === explicitRef || wh.date === explicitRef || wh.date.endsWith(cleanRef);
      });

      if (whIdx !== -1) {
        usedWorkedIndices.add(whIdx);
        resolvedOffDates.add(off.offDate);
        map[off.offDate] = {
          dateLabel: formatHolidayDDMM(workedHolidays[whIdx].date),
          holidayName: workedHolidays[whIdx].name,
        };
      } else {
        const directHoliday = yearHolidays.find(h => h.date === explicitRef.replace('-extra', '') || h.date.endsWith(cleanRef));
        resolvedOffDates.add(off.offDate);
        map[off.offDate] = {
          dateLabel: formatHolidayDDMM(directHoliday ? directHoliday.date : explicitRef),
          holidayName: directHoliday?.name,
        };
      }
    }

    // 2. Casamento FIFO para "FF" genérico com feriados trabalhados no ano/mês
    const monthHolidays = yearHolidays.filter(h => h.date.startsWith(monthKey));
    for (const off of ffOffDays) {
      if (resolvedOffDates.has(off.offDate)) continue;
      const whIdx = workedHolidays.findIndex((_, idx) => !usedWorkedIndices.has(idx));
      if (whIdx !== -1) {
        usedWorkedIndices.add(whIdx);
        resolvedOffDates.add(off.offDate);
        map[off.offDate] = {
          dateLabel: formatHolidayDDMM(workedHolidays[whIdx].date),
          holidayName: workedHolidays[whIdx].name,
        };
      } else if (monthHolidays.length > 0) {
        const fallbackHol = monthHolidays[0];
        resolvedOffDates.add(off.offDate);
        map[off.offDate] = {
          dateLabel: formatHolidayDDMM(fallbackHol.date),
          holidayName: fallbackHol.name,
        };
      } else {
        const priorHol = [...yearHolidays].reverse().find(h => h.date <= off.offDate) || yearHolidays[0];
        if (priorHol) {
          resolvedOffDates.add(off.offDate);
          map[off.offDate] = {
            dateLabel: formatHolidayDDMM(priorHol.date),
            holidayName: priorHol.name,
          };
        }
      }
    }

    // 3. Créditos pendentes aos quais o colaborador tem direito (do menu de créditos pendentes + feriados trabalhados ainda não compensados)
    const pendingList: { id: string; holidayDate: string; holidayName: string }[] = [];
    const seenIds = new Set<string>();

    for (const c of employeeHolidayCredits) {
      if (c.status === 'pending') {
        const cid = c.id || c.holidayDate;
        seenIds.add(cid);
        pendingList.push({
          id: cid,
          holidayDate: c.holidayDate,
          holidayName: c.holidayName,
        });
      }
    }

    // Também inclui feriados trabalhados no mês em construção que ainda não foram compensados
    workedHolidays.forEach((wh, idx) => {
      if (!usedWorkedIndices.has(idx) && !seenIds.has(wh.id)) {
        seenIds.add(wh.id);
        pendingList.push({
          id: wh.id,
          holidayDate: wh.date,
          holidayName: wh.name,
        });
      }
    });

    return { holidayCompMap: map, eligiblePendingCredits: pendingList };
  }, [employee, currentMY.year, monthKey, yearHolidays, employeeHolidayCredits]);

  // Build calendar matrix (leading empty cells for first week)
  const calendarCells: ({ type: 'empty' } | {
    type: 'day';
    day: number;
    dayIdx: number;
    dateStr: string;
    shift: ShiftType;
    isSunday: boolean;
    isSaturday: boolean;
    isHoliday: boolean;
    hours: string;
  })[] = [];

  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarCells.push({ type: 'empty' });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dayIdx = i - 1;
    const shift = getEffectiveShift(employee, dayIdx);
    const date = new Date(currentMY.year, currentMY.month, i);
    const ds = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const hours = (employee.dailyHours?.[monthKey] || [])[dayIdx] || employee.workPeriod || '';

    calendarCells.push({
      type: 'day',
      day: i,
      dayIdx,
      dateStr: ds,
      shift,
      isSunday: date.getDay() === 0,
      isSaturday: date.getDay() === 6,
      isHoliday: holidaySet.has(ds),
      hours,
    });
  }

  return (
    <div className="w-full">
      {/* Weekday Column Headers (Dom - Sáb) */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-2.5">
        {WEEKDAY_NAMES.map((wd, idx) => {
          const isSun = idx === 0;
          return (
            <div 
              key={wd} 
              className={`text-center py-2 px-1 rounded-xl font-black text-xs uppercase tracking-wider ${
                isSun
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              <span className="hidden sm:inline">{wd.split('-')[0]}</span>
              <span className="sm:hidden">{WEEKDAY_SHORT[idx]}</span>
            </div>
          );
        })}
      </div>

      {/* Grid of Days */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {calendarCells.map((cell, idx) => {
          if (cell.type === 'empty') {
            return (
              <div 
                key={`empty-${idx}`} 
                className="aspect-square sm:aspect-[4/3] rounded-2xl border border-dashed border-zinc-200/60 dark:border-zinc-800/40 bg-zinc-50/30 dark:bg-zinc-900/20"
              />
            );
          }

          const { day, dayIdx, dateStr, shift, isSunday, isHoliday, hours } = cell;
          const isWorking = isWorkingShift(shift);
          const isFF = typeof shift === 'string' && shift.startsWith('FF');
          const ffInfo = isFF ? holidayCompMap[dateStr] : undefined;
          const cellStyle = getShiftCellStyle(shift);
          const availHours = getAvailHours(dayIdx);

          const mainBadgeLabel = isFF
            ? (ffInfo?.dateLabel ? `Ref. ${ffInfo.dateLabel}` : 'Folga Fer.')
            : shift;

          const subLabel = isWorking
            ? 'Trabalho'
            : shift === 'F'
              ? 'Folga'
              : isFF
                ? (ffInfo?.holidayName ? `Feriado • ${ffInfo.holidayName}` : 'Folga Feriado')
                : shift === 'FE'
                  ? 'Férias'
                  : shift === 'AT'
                    ? 'Atestado'
                    : shift === 'DO'
                      ? 'Day Off'
                      : shift === 'C'
                        ? 'Curso'
                        : 'Folga';

          return (
            <div
              key={`day-${day}`}
              className={`group relative aspect-square sm:aspect-[4/3] rounded-2xl border transition-all p-2 sm:p-2.5 flex flex-col justify-between ${cellStyle.bg} ${cellStyle.border} ${
                canEdit ? 'hover:shadow-md cursor-pointer' : ''
              }`}
            >
              {/* Day Header (Number & Flags) */}
              <div className="flex items-center justify-between w-full">
                <span className={`text-xs sm:text-sm font-black tabular-nums ${
                  isSunday ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-700 dark:text-zinc-200'
                }`}>
                  {day}
                </span>

                {isHoliday && (
                  <span 
                    className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-fuchsia-500 text-white shadow-xs" 
                    title="Feriado"
                  >
                    FER
                  </span>
                )}
                {isSunday && !isHoliday && (
                  <span className="text-[10px] font-black text-rose-500 dark:text-rose-400 uppercase">
                    Dom
                  </span>
                )}
              </div>

              {/* Central Badge: Shift Status (Exibe data de referência para FF) */}
              <div className="flex flex-col items-center justify-center my-auto px-0.5 text-center">
                <span className={`${isFF ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'} font-black tracking-tight leading-tight ${cellStyle.text}`}>
                  {mainBadgeLabel}
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight line-clamp-1 text-center mt-0.5">
                  {subLabel}
                </span>
              </div>

              {/* Bottom: Turno/Horário editável apenas no Modo Edição (oculto no Modo Visualizar e na exportação/impressão) */}
              {calendarMode === 'edit' ? (
                <div
                  data-export-hide="true"
                  className="w-full text-center relative z-20 no-print print:hidden"
                >
                  {isWorking && onUpdateHour ? (
                    <select
                      value={hours}
                      onChange={(e) => onUpdateHour(employee.id, dayIdx, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-[10px] font-bold text-zinc-700 dark:text-zinc-200 bg-white/85 dark:bg-zinc-800/85 hover:bg-white dark:hover:bg-zinc-800 rounded-md border border-zinc-300/70 dark:border-zinc-700 py-0.5 px-1 text-center cursor-pointer outline-none truncate shadow-2xs"
                      title="Clique para alterar o turno / horário deste dia"
                    >
                      {availHours.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                      {hours && !availHours.includes(hours) && (
                        <option value={hours}>{hours}</option>
                      )}
                    </select>
                  ) : (
                    <span className="text-[9.5px] font-medium text-zinc-400 dark:text-zinc-500 truncate block">
                      {isFF && ffInfo?.dateLabel ? `Ref. ${ffInfo.dateLabel}` : '—'}
                    </span>
                  )}
                </div>
              ) : (
                <div className="h-1" />
              )}

              {/* Direct Shift Selector overlay if in Edit Mode */}
              {canEdit && (
                <select
                  value={shift}
                  onChange={(e) => onUpdateShift(employee.id, dayIdx, e.target.value as ShiftType)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 no-print print:hidden"
                  title={`Clique para alterar o status do dia ${day}`}
                >
                  {BASE_SHIFT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.desc}
                    </option>
                  ))}

                  {/* Mantém a opção atual selecionada caso o dia já esteja com FF */}
                  {isFF && !eligiblePendingCredits.some(c => `FF ${c.id}` === shift) && (
                    <option value={shift}>
                      {ffInfo?.dateLabel
                        ? `Ref. ${ffInfo.dateLabel} — Folga Feriado${ffInfo.holidayName ? ` (${ffInfo.holidayName})` : ''}`
                        : `FF — Folga Compensatória`}
                    </option>
                  )}

                  {/* Sugere apenas as folgas de feriado às quais o colaborador tem direito pendente */}
                  {eligiblePendingCredits.length > 0 ? (
                    <optgroup label="Folgas de Feriado Pendentes (Direito Adquirido)">
                      {eligiblePendingCredits.map(c => (
                        <option key={c.id} value={`FF ${c.id}`}>
                          Ref. {formatHolidayDDMM(c.holidayDate)} — Folga Feriado ({c.holidayName})
                        </option>
                      ))}
                    </optgroup>
                  ) : !isFF ? (
                    <option value="" disabled>
                      ── Sem folga de feriado pendente para este colaborador ──
                    </option>
                  ) : null}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Team Monthly Calendar View (Dom-Sáb) ─────────────────────────────────────

const TeamMonthlyCalendar: React.FC<{ 
  employees: Employee[]; 
  currentMY: MonthYear; 
  customHolidays: Holiday[];
  getEffectiveShift: (emp: Employee, dayIdx: number) => ShiftType;
}> = ({ employees, currentMY, customHolidays, getEffectiveShift }) => {
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMY.year, currentMY.month, 1).getDay();
  const monthKey = `${currentMY.year}-${(currentMY.month + 1).toString().padStart(2, '0')}`;
  const holidaySet = buildHolidaySet(currentMY.year, customHolidays);

  const activeEmployees = useMemo(() => {
    return employees
      .filter(e => !e.isHidden && isEmployeeActiveInMonth(e, currentMY.year, currentMY.month))
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
  }, [employees, currentMY.year, currentMY.month]);

  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({ type: 'empty' as const });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const date = new Date(currentMY.year, currentMY.month, i);
    const isHoliday = holidaySet.has(dateStr);
    const isSunday = date.getDay() === 0;

    const workingEmps = activeEmployees.map(emp => {
      const shift = getEffectiveShift(emp, i - 1);
      const hours = (emp.dailyHours?.[monthKey] || [])[i - 1] || emp.workPeriod || '';
      const isWorking = isWorkingShift(shift);
      const isCourse = shift === 'C';

      return {
        emp,
        name: getShortName(emp.name, employees),
        shift,
        hours,
        isWorking,
        isCourse,
      };
    }).filter(d => d.isWorking || d.isCourse);

    cells.push({
      type: 'day' as const,
      day: i,
      isHoliday,
      isSunday,
      workingEmps,
    });
  }

  return (
    <div className="w-full">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-2.5 mb-3 print:gap-1">
        {WEEKDAY_NAMES.map((wd, idx) => (
          <div 
            key={wd} 
            className={`text-center py-2 px-1 rounded-xl font-black text-xs uppercase tracking-wider ${
              idx === 0 
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' 
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
            }`}
          >
            {wd.split('-')[0]}
          </div>
        ))}
      </div>

      {/* Grid of Weeks */}
      <div className="grid grid-cols-7 gap-2.5 print:gap-1">
        {cells.map((cell, idx) => {
          if (cell.type === 'empty') {
            return (
              <div 
                key={`empty-${idx}`} 
                className="min-h-[140px] rounded-2xl border border-dashed border-zinc-200/50 dark:border-zinc-800/40 bg-zinc-50/20"
              />
            );
          }

          return (
            <div
              key={`day-${cell.day}`}
              className={`min-h-[140px] rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                cell.isSunday
                  ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-black tabular-nums ${
                  cell.isSunday ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-700 dark:text-zinc-300'
                }`}>
                  {cell.day}
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                  {cell.workingEmps.length} CLT
                </span>
              </div>

              {/* Working Employees List */}
              <div className="space-y-1 flex-1 overflow-y-auto max-h-[130px] custom-scrollbar pr-0.5">
                {cell.workingEmps.map((w, wIdx) => (
                  <div
                    key={wIdx}
                    className={`flex items-center justify-between text-[11px] font-bold px-1.5 py-0.5 rounded-md border ${
                      w.isCourse 
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200' 
                        : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 border-zinc-200/60 dark:border-zinc-700/60'
                    }`}
                  >
                    <span className="truncate">{w.name}</span>
                    <span className="text-[10px] text-zinc-400 shrink-0 ml-1">
                      {w.hours ? w.hours.split('-')[0].trim() : ''}
                    </span>
                  </div>
                ))}
                {cell.workingEmps.length === 0 && (
                  <div className="text-[11px] text-zinc-400 italic text-center py-4">
                    Nenhum colaborador
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
