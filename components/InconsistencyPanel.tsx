
import React, { useEffect, useMemo, useState } from 'react';
import { Employee, MonthYear, ShiftType } from '../types';
import { Icon } from './Icon';

interface InconsistencyPanelProps {
  employees:      Employee[];
  currentMY:      MonthYear;
  onSelectDay:    (idx: number) => void;
  onApplyFix:     (empId: string, dayIdx: number, shift: ShiftType) => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Fix {
  label:    string;   // e.g. "Dar folga no dia 15"
  empId:    string;
  dayIdx:   number;
  newShift: ShiftType;
}

interface Inconsistency {
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

// Only 'T' (Trabalho) counts as actually working.
// 'FF' = Feriado/Folga Especial = paid holiday OFF, not work.
// 'FE' = vacation, 'F' = regular day off, 'C' = course.
const isWorkShift = (s: ShiftType | undefined): boolean => s === 'T';

// ─── Detection ────────────────────────────────────────────────────────────────

function detectInconsistencies(
  employees:  Employee[],
  year:       number,
  month:      number    // 0-indexed
): Inconsistency[] {
  const results:    Inconsistency[] = [];
  const monthKey    = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build Sundays list for this month only
  const sundaysThisMonth: number[] = [];
  for (let d = 0; d < daysInMonth; d++) {
    if (new Date(year, month, d + 1).getDay() === 0) sundaysThisMonth.push(d);
  }

  for (const emp of employees) {
    if (emp.status !== 'active') continue;
    // Apprentices don't work Sundays by design — skip all per-employee rules
    if (emp.isYoungApprentice) continue;
    const shifts = (emp.shifts[monthKey] ?? []) as ShiftType[];

    // ── Rule 1: 6×1 — more than 6 consecutive working days ─────────────────
    let workStreak    = 0;
    let streakStart   = 0;
    let alreadyFlagged = false; // flag each separate streak once

    for (let d = 0; d < daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
      const onVacation = emp.vacationStart && emp.vacationEnd &&
        dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd;

      if (isWorkShift(shifts[d]) && !onVacation) {
        if (workStreak === 0) { streakStart = d; alreadyFlagged = false; }
        workStreak++;

        if (workStreak > 6 && !alreadyFlagged) {
          alreadyFlagged = true;
          // Fix: give a day off on the 7th day (6-index from streakStart)
          const fixDay = streakStart + 6;
          const fixDayNum = fixDay + 1;
          results.push({
            id:       `${emp.id}-6x1-${streakStart}`,
            empId:    emp.id,
            empName:  emp.name,
            type:     'consecutive_work',
            severity: 'error',
            detail:   `${workStreak}+ dias seguidos sem folga (${streakStart + 1} → ${d + 1})`,
            dayIdx:   d,
            fix: fixDay < daysInMonth ? {
              label:    `Dar folga no dia ${fixDayNum}`,
              empId:    emp.id,
              dayIdx:   fixDay,
              newShift: 'F',
            } : null,
          });
        }
      } else {
        workStreak    = 0;
        alreadyFlagged = false;
      }
    }

    // ── Rule 2: 3+ consecutive Sundays within this month only ────────────
    // Track consecutive Sundays worked IN THIS MONTH
    let sunStreak:  number[] = [];

    for (const sunIdx of sundaysThisMonth) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(sunIdx + 1).padStart(2, '0')}`;
      const onVacation = emp.vacationStart && emp.vacationEnd &&
        dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd;

      if (isWorkShift(shifts[sunIdx]) && !onVacation) {
        sunStreak.push(sunIdx);
      } else {
        sunStreak = [];
      }

      // Flag exactly when streak hits 3 (hard error)
      if (sunStreak.length === 3) {
        const offendingSunday = sunStreak[2];
        const domDays = sunStreak.map(d => d + 1).join(', ');
        results.push({
          id:       `${emp.id}-sun-${sunStreak[0]}`,
          empId:    emp.id,
          empName:  emp.name,
          type:     'consecutive_sunday',
          severity: 'error',    // ← hard rule, was 'warning'
          detail:   `3 domingos seguidos trabalhados (dias ${domDays}) — máximo é 2`,
          dayIdx:   offendingSunday,
          fix: {
            label:    `Dar folga no domingo dia ${offendingSunday + 1}`,
            empId:    emp.id,
            dayIdx:   offendingSunday,
            newShift: 'F',
          },
        });
      }
    }
  }

  // ── Rule 3: Sunday with fewer than 6 CLT workers ────────────────────────
  const MIN_WORKERS = 6;
  for (const sunIdx of sundaysThisMonth) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(sunIdx + 1).padStart(2, '0')}`;

    // Count CLTs actually working this Sunday (not on vacation, not resting)
    const workers = employees.filter(emp => {
      if (emp.isYoungApprentice || emp.status !== 'active') return false;
      const shifts = (emp.shifts[monthKey] ?? []) as ShiftType[];
      const s = shifts[sunIdx];
      return s === 'T' || s === 'FF';
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
        fix:      null,   // can’t auto-fix by removing someone’s rest
      });
    }
  }

  return results;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const InconsistencyPanel: React.FC<InconsistencyPanelProps> = ({
  employees,
  currentMY,
  onSelectDay,
  onApplyFix,
}) => {
  const [open, setOpen] = useState(false);

  // issues re-computed EVERY TIME employees or month changes
  // — this is the ONLY source of truth; no local "applied" state needed
  const issues = useMemo(
    () => detectInconsistencies(employees, currentMY.year, currentMY.month),
    [employees, currentMY]
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
    // Track how many rest-fixes have been scheduled per Sunday dayIdx
    // to avoid dropping below MIN_SUNDAY_WORKERS on any single Sunday.
    const MIN_WORKERS = 6;
    const fixesAppliedPerDay = new Map<number, number>();

    for (const issue of issues) {
      if (!issue.fix) continue;

      if (issue.type === 'consecutive_sunday') {
        const dayIdx = issue.fix.dayIdx;
        const mKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
        // Count CLTs currently working this Sunday in saved shifts
        const currentWorkers = employees.filter(e => {
          if (e.isYoungApprentice || e.status !== 'active') return false;
          return (e.shifts[mKey]?.[dayIdx]) === 'T';
        }).length;
        const alreadyScheduledOff = fixesAppliedPerDay.get(dayIdx) ?? 0;
        // Skip if applying this fix would drop below the minimum
        if (currentWorkers - alreadyScheduledOff - 1 < MIN_WORKERS) continue;
        fixesAppliedPerDay.set(dayIdx, alreadyScheduledOff + 1);
      }

      onApplyFix(issue.fix.empId, issue.fix.dayIdx, issue.fix.newShift);
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

          <div className="absolute top-full right-0 mt-2 z-50 w-[480px] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                  <Icon name="policy" className="text-base" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">Inconsistências da Escala</h4>
                  <p className="text-[10px] text-slate-400 font-medium">
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
                <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                  <Icon name="close" className="text-slate-400 text-sm" />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-2.5 bg-white border-b border-slate-100">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Erro (6×1)
              </span>
              <span className="text-[10px] font-bold text-red-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Todos os alertas são erros a corrigir
              </span>
              <span className="ml-auto text-[10px] text-slate-400 font-medium italic">
                Clique em "Aplicar" para corrigir automaticamente
              </span>
            </div>

            {/* Issues list */}
            {/* Issues list — purely driven by live issues array, no stale state */}
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {issues.map((issue) => {
                const empObj = employees.find(e => e.id === issue.empId);
                const displayName = (empObj?.name ?? issue.empName).split(' ').slice(0, 2).join(' ');
                return (
                  <div
                    key={issue.id}
                    className="px-5 py-4 bg-white hover:bg-slate-50/60 transition-colors"
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
                          <span className="text-[11px] font-extrabold text-slate-900">
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
                          <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                            <Icon name="auto_fix_high" className="text-blue-500 text-xs flex-shrink-0" />
                            <span className="text-[10px] font-bold text-blue-700 flex-1">{issue.fix.label}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => { onSelectDay(issue.dayIdx); setOpen(false); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
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
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-[9px] text-slate-400 font-medium">
                * As correções aplicam folgas nos dias críticos. Revise manualmente se necessário.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
