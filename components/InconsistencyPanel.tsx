
import React, { useEffect, useMemo, useState } from 'react';
import { Employee, MonthYear, ShiftType } from '../types';
import { Icon } from './Icon';
import { getPrevMonthConsecutive, getPrevMonthWorkStreak, isWorkingShift } from '../hooks/useScheduleEngine';
import { getShortName, isEmployeeActiveInMonth } from '../constants';
import { addDaysToISODate } from '../src/utils/date';


interface InconsistencyPanelProps {
  employees:      Employee[];
  currentMY:      MonthYear;
  today:          Date;
  onSelectDay:    (idx: number) => void;
  onApplyFix:     (empId: string, dayIdx: number, shift: ShiftType) => void;
  onApplyBulkFixes: (updates: { empId: string, dayIdx: number, newShift: ShiftType }[]) => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Fix {
  label:    string;   // e.g. "Dar folga no dia 15"
  empId:    string;
  dayIdx:   number;
  newShift: ShiftType;
}

export interface Inconsistency {
  id:       string;
  empId:    string;    // '' for team-wide issues
  empName:  string;
  type:     'consecutive_work' | 'consecutive_sunday' | 'sunday_understaffed';
  detail:   string;
  dayIdx:   number;
  severity: 'error' | 'warning';
  fix:      Fix | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// 'T', Posições (P1-P4) e 'C' (Curso) contam como atividade que impede a folga (regra 6x1).
// Mas apenas 'T' e Posições contam como presença física na loja para cobertura.
const isActivityShift = (s: ShiftType | undefined): boolean => isWorkingShift(s) || s === 'C';
const isStorePresence = (s: ShiftType | undefined): boolean => isWorkingShift(s);


function getEffectiveShift(emp: Employee, year: number, month: number, dayIdx: number): ShiftType {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    
    if (emp.hiredAt && dateStr < emp.hiredAt) return 'N/A';
    if (emp.firedAt && dateStr > emp.firedAt) return 'N/A';

    if (emp.vacationStart) {
        const start = emp.vacationStart;
        // Sem vacationEnd: 30 dias corridos incluindo o dia inicial (start + 29)
        const end = emp.vacationEnd || addDaysToISODate(start, 29);
        if (dateStr >= start && dateStr <= end) return 'FE';
    }
    if (emp.atestadoStart && emp.atestadoEnd) {
        if (dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) return 'AT';
    }
    const shifts = (emp.shifts[monthKey] ?? []) as ShiftType[];
    return shifts[dayIdx] || 'F';
}

// ─── Detection ────────────────────────────────────────────────────────────────

export function detectInconsistencies(
  employees:  Employee[],
  year:       number,
  month:      number,    // 0-indexed
  _today?:     Date
): Inconsistency[] {
  const results:    Inconsistency[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Previous month work streaks & consecutive Sundays
  const prevWorkStreaks = getPrevMonthWorkStreak(employees, year, month);
  const prevMonthConsecs = getPrevMonthConsecutive(employees.filter(e => e.status === 'active' && !e.isYoungApprentice), year, month);

  // Build Sundays list for this month only
  const sundaysThisMonth: number[] = [];
  for (let d = 0; d < daysInMonth; d++) {
    if (new Date(year, month, d + 1).getDay() === 0) sundaysThisMonth.push(d);
  }

  for (const emp of employees) {
    if (!isEmployeeActiveInMonth(emp, year, month) || emp.isYoungApprentice) continue;

    // ── Rule 1: 6×1 — 7 or more consecutive working days (including cross-month) ──
    const prevStreak  = prevWorkStreaks.get(emp.id) || 0;
    let workStreak    = prevStreak;
    let streakStartFromPrev = prevStreak > 0;
    let streakStart   = 0;

    for (let d = 0; d < daysInMonth; d++) {
      const s = getEffectiveShift(emp, year, month, d);

      if (isActivityShift(s)) {
        if (workStreak === 0) { streakStart = d; streakStartFromPrev = false; }
        workStreak++;

        if (workStreak > 6) {
          const fixDay = d;
          const fixDayNum = fixDay + 1;
          const detailMsg = streakStartFromPrev && streakStart === 0
            ? `7º dia consecutivo de trabalho sem folga (${prevStreak} dia(s) no mês anterior + ${d + 1} neste mês). Folga obrigatória no dia ${fixDayNum}!`
            : `7º dia consecutivo de trabalho sem folga (dia ${streakStart + 1} → dia ${d + 1}). Folga obrigatória no dia ${fixDayNum}!`;

          results.push({
            id:       `${emp.id}-6x1-${streakStart}-${d}`,
            empId:    emp.id,
            empName:  emp.name,
            type:     'consecutive_work',
            severity: 'error',
            detail:   detailMsg,
            dayIdx:   d,
            fix: {
              label:    `Dar folga no 7º dia (dia ${fixDayNum})`,
              empId:    emp.id,
              dayIdx:   fixDay,
              newShift: 'F',
            },
          });
          // Assume the fix is applied so we can keep checking the rest of the month!
          workStreak = 0;
          streakStartFromPrev = false;
        }
      } else {
        workStreak    = 0;
        streakStartFromPrev = false;
      }
    }

    // ── Rule 2: 3+ consecutive Sundays (considering retro) ────────────────
    const initialStreak = prevMonthConsecs.get(emp.id) || 0;
    let currentStreak = initialStreak;
    let streakIndices: number[] = []; 

    for (const sunIdx of sundaysThisMonth) {
      const s = getEffectiveShift(emp, year, month, sunIdx);

      if (isActivityShift(s)) {
        currentStreak++;
        streakIndices.push(sunIdx);
      } else {
        currentStreak = 0;
        streakIndices = [];
      }

      if (currentStreak >= 3) {
        const domDays = streakIndices.map(d => d + 1).join(', ');
        const detailPrefix = initialStreak > 0 && streakIndices.length < currentStreak 
          ? `Iniciou no mês anterior (${initialStreak} dom. anterior${initialStreak > 1 ? 'es' : ''}), totalizando ${currentStreak} domingos seguidos: ` 
          : '';

        results.push({
          id:       `${emp.id}-sun-${sunIdx}`,
          empId:    emp.id,
          empName:  emp.name,
          type:     'consecutive_sunday',
          severity: 'error',
          detail:   `${detailPrefix}${currentStreak} domingos seguidos trabalhados (mês atual: ${domDays || 'nenhum'})`,
          dayIdx:   sunIdx,
          fix: {
            label:    `Dar folga no domingo dia ${sunIdx + 1}`,
            empId:    emp.id,
            dayIdx:   sunIdx,
            newShift: 'F',
          },
        });
      }
    }
  }

  // ── Rule 3: Sunday with fewer than 6 CLT workers ────────────────────────
  const MIN_WORKERS = 6;
  for (const sunIdx of sundaysThisMonth) {
    const workers = employees.filter(emp => {
      if (emp.isYoungApprentice || emp.status !== 'active') return false;
      const s = getEffectiveShift(emp, year, month, sunIdx);
      return isStorePresence(s);
    });

    if (workers.length < MIN_WORKERS) {
      results.push({
        id:       `team-sun-${sunIdx}`,
        empId:    '',
        empName:  'Equipe',
        type:     'sunday_understaffed',
        severity: 'error',
        detail:   `Domingo dia ${sunIdx + 1}: apenas ${workers.length} CLT${workers.length !== 1 ? 's' : ''} trabalhando (mínimo: ${MIN_WORKERS})`,
        dayIdx:   sunIdx,
        fix:      null,
      });
    }
  }

  // Retorna todas as inconsistências do mês (inclusive para escalas finalizadas)
  return results;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const InconsistencyPanel: React.FC<InconsistencyPanelProps> = ({
  employees,
  currentMY,
  today,
  onSelectDay,
  onApplyFix,
  onApplyBulkFixes,
}) => {
  const [open, setOpen] = useState(false);

  // issues re-computed EVERY TIME employees or month changes
  // — this is the ONLY source of truth; no local "applied" state needed
  const issues = useMemo(
    () => detectInconsistencies(employees, currentMY.year, currentMY.month, today),
    [employees, currentMY, today]
  );

  const errors   = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  // Auto-close panel when all issues are resolved
  useEffect(() => {
    if (issues.length === 0 && open) setOpen(false);
  }, [issues.length, open]);

  const handleApplyFix = (issue: Inconsistency) => {
    if (!issue.fix) return;
    onApplyFix(issue.fix.empId, issue.fix.dayIdx, issue.fix.newShift);
  };

  const handleApplyAll = () => {
    const MIN_WORKERS = 6;
    const fixesAppliedPerDay = new Map<number, number>();
    const bulkUpdates: { empId: string, dayIdx: number, newShift: ShiftType }[] = [];

    // Prioridade 1: Quebra 6x1 (Legalmente obrigatório)
    const workInconsistencies = issues.filter(i => i.type === 'consecutive_work');
    for (const issue of workInconsistencies) {
      if (issue.fix) {
        bulkUpdates.push({
          empId: issue.fix.empId,
          dayIdx: issue.fix.dayIdx,
          newShift: issue.fix.newShift
        });
        // Se for domingo, decrementa a cobertura (embora seja obrigatório)
        if (new Date(currentMY.year, currentMY.month, issue.fix.dayIdx + 1).getDay() === 0) {
          fixesAppliedPerDay.set(issue.fix.dayIdx, (fixesAppliedPerDay.get(issue.fix.dayIdx) || 0) + 1);
        }
      }
    }

    // Prioridade 2: Domingos Seguidos (Também importante, mas respeita cobertura se possível)
    const sundayInconsistencies = issues.filter(i => i.type === 'consecutive_sunday');
    const mKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

    for (const issue of sundayInconsistencies) {
      if (!issue.fix) continue;

      const dayIdx = issue.fix.dayIdx;
      // Count CLTs working TODAY (using the static employees prop as baseline)
      const currentWorkers = employees.filter(e => {
        if (e.isYoungApprentice || e.status !== 'active') return false;
        return isWorkingShift(e.shifts[mKey]?.[dayIdx]);
      }).length;


      const alreadyScheduledOff = fixesAppliedPerDay.get(dayIdx) ?? 0;
      
      // Só aplica se não quebrar o mínimo de 6 pessoas na loja
      if (currentWorkers - alreadyScheduledOff - 1 >= MIN_WORKERS) {
        bulkUpdates.push({
          empId: issue.fix.empId,
          dayIdx: issue.fix.dayIdx,
          newShift: issue.fix.newShift
        });
        fixesAppliedPerDay.set(dayIdx, alreadyScheduledOff + 1);
      }
    }

    if (bulkUpdates.length > 0) {
      onApplyBulkFixes(bulkUpdates);
    }
  };

  // ── "All good" state ────────────────────────────────────────────────────
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-extrabold">
        <Icon name="verified" className="text-sm text-emerald-500" fill />
        Sem inconsistências
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold transition-all border ${
          errors.length > 0
            ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
        }`}
      >
        <Icon name="warning" className="text-sm" />
        {errors.length > 0 && (
          <span className="bg-red-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center">
            {errors.length}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="bg-amber-400 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center">
            {warnings.length}
          </span>
        )}
        <span>Inconsistências</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-sm" />
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute top-full right-0 mt-2 z-50 w-[480px] bg-white  rounded-2xl border border-slate-200  shadow-2xl overflow-hidden animate-fade-in transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100  bg-slate-50 ">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-100  rounded-lg flex items-center justify-center text-amber-600 ">
                  <Icon name="policy" className="text-base" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 ">Inconsistências da Escala</h4>
                  <p className="text-[10px] text-slate-400  font-medium">
                    Apenas o mês atual · {issues.length} problema{issues.length > 1 ? 's' : ''} encontrado{issues.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {issues.some(i => i.fix) && (
                  <button
                    onClick={handleApplyAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-extrabold rounded-lg transition-all"
                  >
                    <Icon name="auto_fix_high" className="text-xs" />
                    Corrigir Todos
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-slate-200  rounded-lg transition-colors">
                  <Icon name="close" className="text-slate-400  text-sm" />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-2.5 bg-white  border-b border-slate-100 ">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 ">
                <span className="w-2 h-2 rounded-full bg-red-500  inline-block" />
                Erro (6×1)
              </span>
              <span className="text-[10px] font-bold text-red-600  flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500  inline-block" />
                Inconsistência Crítica
              </span>
              <span className="ml-auto text-[10px] text-slate-400  font-medium italic">
                Clique em "Aplicar"
              </span>
            </div>

            {/* Issues list */}
            {/* Issues list — purely driven by live issues array, no stale state */}
            <div className="divide-y divide-slate-100  max-h-80 overflow-y-auto custom-scrollbar">
              {issues.map((issue) => {
                const empObj = employees.find(e => e.id === issue.empId);
                const displayName = getShortName(empObj?.name ?? issue.empName, employees);
                return (
                  <div
                    key={issue.id}
                    className="px-5 py-4 bg-white  hover:bg-slate-50/60  transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Severity icon */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        issue.severity === 'error' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        <Icon
                          name={
                            issue.type === 'sunday_understaffed' ? 'group' :
                            issue.type === 'consecutive_sunday'  ? 'wb_sunny' : 'block'
                          }
                          className="text-base"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Employee + type badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-extrabold text-slate-900 ">
                            {displayName}
                          </span>
                          <span className={`text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-100 text-red-700`}>
                            {issue.type === 'consecutive_work' ? 'Quebra 6×1' :
                             issue.type === 'consecutive_sunday' ? '3+ Dom. Seguidos' :
                             'Dom. Insuficiente'}
                          </span>
                        </div>
                        {/* Detail */}
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">{issue.detail}</p>

                        {/* Fix suggestion */}
                        {issue.fix && (
                          <div className="mt-2 flex items-center gap-2 bg-blue-50  border border-blue-100  rounded-lg px-3 py-1.5 transition-colors">
                            <Icon name="auto_fix_high" className="text-blue-500  text-xs flex-shrink-0" />
                            <span className="text-[10px] font-bold text-blue-700  flex-1">{issue.fix.label}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => { onSelectDay(issue.dayIdx); setOpen(false); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-extrabold text-slate-600  bg-slate-100  hover:bg-slate-200  rounded-lg transition-all"
                        >
                          <Icon name="arrow_forward" className="text-[11px]" />
                          Ver
                        </button>
                        {issue.fix && (
                          <button
                            onClick={() => handleApplyFix(issue)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-extrabold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-all"
                          >
                            <Icon name="check" className="text-[11px]" />
                            Aplicar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100  bg-slate-50  transition-colors">
              <p className="text-[9px] text-slate-400  font-medium">
                * As correções aplicam folgas nos dias críticos. Revise manualmente se necessário.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
