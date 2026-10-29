import React, { useState } from 'react';
import { Employee, MonthYear, ShiftType, JornadaSettings, normalizeEmployeeRole, ROLE_METADATA_MAP } from '../types';
import { Icon } from './Icon';
import { getShortName, isEmployeeActiveOnDay, getDefaultHourForDay, DEFAULT_JORNADA_SETTINGS } from '../constants';
import { getShiftClassification, isWorkingShift, resolveEffectiveShift } from '../src/engine/shifts/shift-predicates';

interface MobileDayScheduleViewProps {
  employees: Employee[];
  allEmployees?: Employee[];
  jornadaSettings?: JornadaSettings;
  currentMY: MonthYear;
  selectedDayIdx: number;
  monthKey: string;
  isHoliday: boolean;
  holidayName?: string;
  isSunday: boolean;
  resolvedPositions: Record<string, string>;
  tacticalDisplayMode: 'positions' | 'roles' | 'off';
  isReadOnly: boolean;
  highlightedEmpId?: string;
  onUpdateShift: (empId: string, dayIdx: number, shift: ShiftType) => void;
  onUpdateEmployeeDailyHour: (empId: string, dayIdx: number, hour: string) => void;
  onUpdateTacticalPosition: (empId: string, dayIdx: number, position: string) => void;
  onOpenEmployeeCard: (employee: Employee, tab?: 'mes' | 'atual' | 'pedidos' | 'atestado', initialDate?: string) => void;
  onOpenDayDetail: (dayIdx: number) => void;
  diffs?: any[];
}

export const MobileDayScheduleView: React.FC<MobileDayScheduleViewProps> = ({
  employees,
  allEmployees,
  jornadaSettings,
  currentMY,
  selectedDayIdx,
  monthKey,
  isHoliday,
  holidayName,
  isSunday,
  resolvedPositions,
  tacticalDisplayMode,
  isReadOnly,
  highlightedEmpId,
  onUpdateShift,
  onUpdateEmployeeDailyHour,
  onUpdateTacticalPosition,
  onOpenEmployeeCard,
  onOpenDayDetail,
  diffs = [],
}) => {
  const [showFolgas, setShowFolgas] = useState(false);
  const [quickEditEmp, setQuickEditEmp] = useState<Employee | null>(null);

  const dayNum = selectedDayIdx + 1;
  const dateStr = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  const weekDayName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(currentMY.year, currentMY.month, dayNum).getDay()];
  const settings = jornadaSettings || DEFAULT_JORNADA_SETTINGS;
  // Categorize displayed employees for the selected day
  const categorized = React.useMemo(() => {
    const abertura: Array<{ emp: Employee; shift: string; hour: string; pos: string }> = [];
    const intermediario: Array<{ emp: Employee; shift: string; hour: string; pos: string }> = [];
    const fechamento: Array<{ emp: Employee; shift: string; hour: string; pos: string }> = [];
    const outrosTrabalho: Array<{ emp: Employee; shift: string; hour: string; pos: string }> = [];
    const folgas: Array<{ emp: Employee; shift: string; hour: string; pos: string }> = [];

    employees.forEach(emp => {
      if (emp.status === 'inactive' || emp.isHidden) return;
      if (!isEmployeeActiveOnDay(emp, dateStr, monthKey, selectedDayIdx)) return;

      const rawShift = resolveEffectiveShift(emp, dateStr, monthKey, selectedDayIdx);
      const shift = isWorkingShift(rawShift) ? 'T' : rawShift.startsWith('FF') ? 'FF' : rawShift;
      const hour = emp.dailyHours?.[monthKey]?.[selectedDayIdx] || emp.workPeriod || getDefaultHourForDay(emp, isHoliday, isSunday);
      const pos = resolvedPositions[emp.id] || emp.tacticalPositions?.[monthKey]?.[selectedDayIdx] || '';

      const isOff = !isWorkingShift(shift);

      if (isOff) {
        folgas.push({ emp, shift, hour, pos });
      } else {
        const classification = getShiftClassification(hour, isSunday, settings);
        if (classification === 'Abertura') {
          abertura.push({ emp, shift, hour, pos });
        } else if (classification === 'Intermediário') {
          intermediario.push({ emp, shift, hour, pos });
        } else if (classification === 'Fechamento') {
          fechamento.push({ emp, shift, hour, pos });
        } else {
          outrosTrabalho.push({ emp, shift, hour, pos });
        }
      }
    });

    return { abertura, intermediario, fechamento, outrosTrabalho, folgas };
  }, [employees, monthKey, selectedDayIdx, dateStr, resolvedPositions, isHoliday, isSunday, settings]);

  const getShiftBadgeColor = (shift: string) => {
    switch (shift) {
      case 'F': return 'bg-rose-500 text-white';
      case 'FF': return 'bg-amber-500 text-white';
      case 'FE': return 'bg-emerald-600 text-white';
      case 'DO': return 'bg-fuchsia-600 text-white';
      case 'AT': return 'bg-rose-400 text-white';
      case 'C': return 'bg-slate-500 text-white';
      case 'A': return 'bg-blue-600 text-white';
      case 'I': return 'bg-amber-500 text-white';
      case 'FECH': return 'bg-purple-600 text-white';
      default: return 'bg-emerald-600 text-white';
    }
  };

  const getTacticalColor = (pos: string) => {
    switch (pos) {
      case 'P1':
      case 'CX': return 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'PC': return 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800';
      case 'P2':
      case 'FISC': return 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'P3':
      case 'ATEND': return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'P4':
      case 'APOIO': return 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'ESTQ': return 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-zinc-700';
      default: return 'bg-slate-50 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700';
    }
  };

  return (
    <div className="space-y-3 pb-6">

      {/* Seção 1: Abertura */}
      {categorized.abertura.length > 0 && (
        <div id="sec-abertura" className="space-y-2 scroll-mt-36">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <Icon name="wb_sunny" className="text-sm" />
              <span>Turno Abertura</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-black">
                {categorized.abertura.length}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {categorized.abertura.map(item => renderEmployeeCard(item))}
          </div>
        </div>
      )}

      {/* Seção 2: Intermediário */}
      {categorized.intermediario.length > 0 && (
        <div id="sec-intermediario" className="space-y-2 scroll-mt-36">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <Icon name="wb_twilight" className="text-sm" />
              <span>Turno Intermediário</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[11px] font-black">
                {categorized.intermediario.length}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {categorized.intermediario.map(item => renderEmployeeCard(item))}
          </div>
        </div>
      )}

      {/* Seção 3: Fechamento */}
      {categorized.fechamento.length > 0 && (
        <div id="sec-fechamento" className="space-y-2 scroll-mt-36">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
              <Icon name="nights_stay" className="text-sm" />
              <span>Turno Fechamento</span>
              <span className="px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[11px] font-black">
                {categorized.fechamento.length}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {categorized.fechamento.map(item => renderEmployeeCard(item))}
          </div>
        </div>
      )}

      {/* Seção 4: Outros Presentes */}
      {categorized.outrosTrabalho.length > 0 && (
        <div id="sec-outros" className="space-y-2 scroll-mt-36">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Icon name="work" className="text-sm" />
              <span>Trabalho / Outros</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-black">
                {categorized.outrosTrabalho.length}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {categorized.outrosTrabalho.map(item => renderEmployeeCard(item))}
          </div>
        </div>
      )}

      {/* Seção 5: Folgas & Ausências (Acordeão) */}
      {categorized.folgas.length > 0 && (
        <div id="sec-folgas" className="pt-2 scroll-mt-36">
          <button
            type="button"
            onClick={() => setShowFolgas(!showFolgas)}
            className="w-full p-3 rounded-2xl bg-slate-100/80 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 flex items-center justify-between font-bold text-xs"
          >
            <div className="flex items-center gap-2">
              <Icon name="beach_access" className="text-rose-500 text-base" />
              <span>Folgas, Férias & Ausências do Dia</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-[11px] font-black">
                {categorized.folgas.length}
              </span>
            </div>
            <Icon name={showFolgas ? 'expand_less' : 'expand_more'} className="text-lg" />
          </button>

          {showFolgas && (
            <div className="mt-2 space-y-2 animate-in fade-in duration-150">
              {categorized.folgas.map(item => renderEmployeeCard(item, true))}
            </div>
          )}
        </div>
      )}

      {/* Quick Edit Bottom Sheet */}
      {quickEditEmp && !isReadOnly && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in lg:hidden">
          <div 
            className="w-full max-h-[85vh] bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up border-t border-slate-200 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-full mx-auto mt-3 mb-1" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {quickEditEmp.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ajuste rápido para o Dia {dayNum} ({weekDayName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickEditEmp(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>

            {/* Options */}
            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
              {/* Turnos rápidos */}
              <div>
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider block mb-2">
                  Trocar Turno / Status
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { code: 'T', label: 'Trabalho', color: 'bg-emerald-600 text-white' },
                    { code: 'F', label: 'Folga (DSR)', color: 'bg-rose-500 text-white' },
                    { code: 'FF', label: 'Folga Feriado', color: 'bg-amber-500 text-white' },
                    { code: 'FE', label: 'Férias', color: 'bg-emerald-700 text-white' },
                    { code: 'DO', label: 'Aniversário', color: 'bg-fuchsia-600 text-white' },
                    { code: 'AT', label: 'Atestado', color: 'bg-rose-400 text-white' },
                    { code: 'C', label: 'Treinamento', color: 'bg-slate-500 text-white' },
                  ].map(s => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => {
                        onUpdateShift(quickEditEmp.id, selectedDayIdx, s.code as ShiftType);
                        setQuickEditEmp(null);
                      }}
                      className={`p-2 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 ${s.color}`}
                    >
                      <span className="text-sm font-black">{s.code}</span>
                      <span className="text-[11px] opacity-90 truncate w-full">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Botão Ver Cartão Completo */}
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    const emp = quickEditEmp;
                    setQuickEditEmp(null);
                    onOpenEmployeeCard(emp, 'mes', dateStr);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-100 font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Icon name="badge" className="text-base text-orange-500" />
                  <span>Abrir Ficha Completa do Colaborador</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderEmployeeCard(item: { emp: Employee; shift: string; hour: string; pos: string }, isFolga = false) {
    const isHighlighted = false;
    const shortName = getShortName(item.emp.name, allEmployees || employees);
    const hasDiff = diffs.some(d => d.empId === item.emp.id && d.dayIdx === selectedDayIdx);

    return (
      <div
        key={item.emp.id}
        onClick={() => {
          if (!isReadOnly) {
            setQuickEditEmp(item.emp);
          } else {
            onOpenEmployeeCard(item.emp, 'mes', dateStr);
          }
        }}
        className={`p-3 rounded-2xl bg-white dark:bg-zinc-900 border transition-all cursor-pointer shadow-sm active:scale-[0.99] flex items-center justify-between gap-3 ${
          isHighlighted 
            ? 'border-orange-500 ring-2 ring-orange-500/20 shadow-orange-500/10' 
            : 'border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
        }`}
      >
        {/* Lado Esquerdo: Identificação do Colaborador */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm relative">
            {item.emp.name.charAt(0).toUpperCase()}
            {hasDiff && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-900"></span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                {shortName}
              </span>
              {item.emp.contractType === 'Sazonal' && (
                <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[11px] font-black uppercase">
                  Sazonal
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate font-medium">
              {item.emp.cargo || 'Colaborador'}
            </p>
          </div>
        </div>

        {/* Lado Direito: Turno, Horário & Posição */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Horário ou Posição Tática */}
          {!isFolga && (
            <div className="text-right">
              {item.hour ? (
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  {item.hour}
                </span>
              ) : (
                <span className="text-[11px] font-bold text-slate-400 block">
                  Padrão
                </span>
              )}
              {(() => {
                const role = normalizeEmployeeRole(item.emp.cargo || item.emp.role);
                const meta = ROLE_METADATA_MAP[role];
                return (
                  <span className={`px-1.5 py-0.5 rounded-md border text-[11px] font-black uppercase tracking-wider inline-block mt-0.5 ${meta.badgeColor}`}>
                    {meta.label} ({meta.code})
                  </span>
                );
              })()}
            </div>
          )}

          {/* Badge do Turno */}
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shadow-sm ${getShiftBadgeColor(item.shift)}`}>
            {item.shift}
          </span>

          {/* Ícone de toque rápido */}
          {!isReadOnly && (
            <Icon name="chevron_right" className="text-slate-400 text-lg" />
          )}
        </div>
      </div>
    );
  }
};
