
import React, { useEffect, useMemo, useState } from 'react';
import { Employee, MonthYear, ShiftType } from '../types';
import { Icon } from './Icon';
import { getPrevMonthConsecutive } from '../hooks/useScheduleEngine';

interface InconsistencyPanelProps {
  employees:      Employee[];
  currentMY:      MonthYear;
  today:          Date;
  onSelectDay:    (idx: number) => void;
  onApplyFix:     (empId: string, dayIdx: number, shift: ShiftType) => void;
  onApplyBulkFixes: (updates: { empId: string, dayIdx: number, newShift: ShiftType }[]) => void;
}

interface Fix {
  label:    string;
  empId:    string;
  dayIdx:   number;
  newShift: ShiftType;
}

interface Inconsistency {
  id:       string;
  empId:    string;
  empName:  string;
  type:     'consecutive_work' | 'consecutive_sunday' | 'sunday_understaffed';
  detail:   string;
  dayIdx:   number;
  severity: 'error' | 'warning';
  fix:      Fix | null;
}

const isActivityShift = (s: ShiftType | undefined): boolean => s === 'T' || s === 'C';
const isStorePresence = (s: ShiftType | undefined): boolean => s === 'T';

function getEffectiveShift(emp: Employee, year: number, month: number, dayIdx: number): ShiftType {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    if (emp.vacationStart) {
        const start = emp.vacationStart;
        const d = new Date(start + 'T00:00:00');
        d.setDate(d.getDate() + 30);
        const end = emp.vacationEnd || d.toISOString().split('T')[0];
        if (dateStr >= start && dateStr <= end) return 'FE';
    }
    const shifts = (emp.shifts[monthKey] ?? []) as ShiftType[];
    return shifts[dayIdx] || 'F';
}

function detectInconsistencies(employees: Employee[], year: number, month: number, today: Date): Inconsistency[] {
  const results: Inconsistency[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
  const todayIdx = today.getDate() - 1;
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  if (isPastMonth) return [];

  const prevMonthConsecs = getPrevMonthConsecutive(employees.filter(e => e.status === 'active' && !e.isYoungApprentice), year, month);
  const sundaysThisMonth: number[] = [];
  for (let d = 0; d < daysInMonth; d++) {
    if (new Date(year, month, d + 1).getDay() === 0) sundaysThisMonth.push(d);
  }

  for (const emp of employees) {
    if (emp.status !== 'active' || emp.isYoungApprentice) continue;
    let workStreak = 0;
    let streakStart = 0;
    for (let d = 0; d < daysInMonth; d++) {
      const s = getEffectiveShift(emp, year, month, d);
      if (isActivityShift(s)) {
        if (workStreak === 0) streakStart = d;
        workStreak++;
        if (workStreak > 6) {
          results.push({ id: `${emp.id}-6x1-${streakStart}`, empId: emp.id, empName: emp.name, type: 'consecutive_work', severity: 'error', detail: `${workStreak}+ dias seguidos sem folga (${streakStart + 1} à ${d + 1})`, dayIdx: d, fix: { label: `Dar folga no dia ${d + 1}`, empId: emp.id, dayIdx: d, newShift: 'F' } });
          workStreak = 0;
        }
      } else {
        workStreak = 0;
      }
    }

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
        results.push({ id: `${emp.id}-sun-${sunIdx}`, empId: emp.id, empName: emp.name, type: 'consecutive_sunday', severity: 'error', detail: `${currentStreak} domingos seguidos trabalhados`, dayIdx: sunIdx, fix: { label: `Dar folga no domingo dia ${sunIdx + 1}`, empId: emp.id, dayIdx: sunIdx, newShift: 'F' } });
      }
    }
  }

  const MIN_WORKERS = 6;
  for (const sunIdx of sundaysThisMonth) {
    const workers = employees.filter(emp => {
      if (emp.isYoungApprentice || emp.status !== 'active') return false;
      const s = getEffectiveShift(emp, year, month, sunIdx);
      return isStorePresence(s);
    });
    if (workers.length < MIN_WORKERS) {
      results.push({ id: `team-sun-${sunIdx}`, empId: '', empName: 'Equipe', type: 'sunday_understaffed', severity: 'error', detail: `Domingo dia ${sunIdx + 1}: apenas ${workers.length} CLT's (mínimo: ${MIN_WORKERS})`, dayIdx: sunIdx, fix: null });
    }
  }

  return results.filter(issue => !isCurrentMonth || issue.dayIdx >= todayIdx);
}

export const InconsistencyPanel: React.FC<InconsistencyPanelProps> = ({ employees, currentMY, today, onSelectDay, onApplyFix, onApplyBulkFixes }) => {
  const [open, setOpen] = useState(false);
  const issues = useMemo(() => detectInconsistencies(employees, currentMY.year, currentMY.month, today), [employees, currentMY, today]);
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  useEffect(() => { if (issues.length === 0 && open) setOpen(false); }, [issues.length, open]);

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-black">
        <Icon name="verified" className="text-sm text-emerald-500" fill /> Sem inconsistências
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all border ${errors.length > 0 ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}
      >
        <Icon name="warning" className="text-sm" />
        {errors.length > 0 && <span className="bg-rose-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center">{errors.length}</span>}
        <span>Problemas</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-sm" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-2 z-50 w-[420px] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-fade-in transition-colors">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Icon name="policy" className="text-amber-500" />
                <h4 className="font-black text-sm text-slate-800">Inconsistências da Escala</h4>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"><Icon name="close" className="text-slate-400 text-sm" /></button>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto custom-scrollbar">
              {issues.map((issue) => (
                <div key={issue.id} className="px-5 py-4 bg-white hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${issue.severity === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                      <Icon name={issue.type === 'sunday_understaffed' ? 'group' : 'warning'} className="text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-black text-slate-900 uppercase">{issue.empName}</span>
                        <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                          {issue.type === 'consecutive_work' ? '6x1' : issue.type === 'consecutive_sunday' ? 'Domingo' : 'Equipe'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">{issue.detail}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => { onSelectDay(issue.dayIdx); setOpen(false); }} className="px-2.5 py-1.5 text-[10px] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all">Ver</button>
                      {issue.fix && <button onClick={() => onApplyFix(issue.fix!.empId, issue.fix!.dayIdx, issue.fix!.newShift)} className="px-2.5 py-1.5 text-[10px] font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-all font-black">Fix</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
