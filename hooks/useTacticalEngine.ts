import { Employee } from '../types';
import { calculateLunchSchedule } from './useLunchEngine';

export type TacticalPosition = 'P1' | 'P2' | 'P3' | 'P4' | 'P5+' | 'Estoque' | 'Pausa/Almoço';

export interface TacticalAllocation {
  id: string;
  name: string;
  cargo?: string;
  position: TacticalPosition;
  isApprentice: boolean;
  status: 'working' | 'lunch';
  preferredPositions?: string[];
}

// Metadata about each tactical position for UI display
export const TACTICAL_POSITION_META: Record<string, {
  label: string;
  emoji: string;
  location: string;
  mission: string;
  mobility: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  P1: {
    label: 'P1 · Âncora',
    emoji: '🟦',
    location: 'Caixa (Fundo)',
    mission: 'Finalização e Ponto de Referência',
    mobility: 'Fixa — Nunca abandona o posto',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  P2: {
    label: 'P2 · Filtro',
    emoji: '🟩',
    location: 'Entrada da Loja',
    mission: 'Recepcionar, Encantar e Direcionar',
    mobility: 'Semi-Fixa — Só sai para apoio ao caixa',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  P3: {
    label: 'P3 · Anfitrião',
    emoji: '🟧',
    location: 'Salão (Meio/Fundo)',
    mission: 'Atendimento consultivo e múltiplo',
    mobility: 'Restrita — Não deixa o salão',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-50 dark:bg-orange-950/40',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  P4: {
    label: 'P4 · Estrategista',
    emoji: '🟪',
    location: 'Salão (Dinâmico)',
    mission: 'Apoio flexível, Digital (WhatsApp) e Organização',
    mobility: 'Alta — Primeiro a se deslocar para apoio',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-50 dark:bg-purple-950/40',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  'P5+': {
    label: 'P5+ · Reforço',
    emoji: '⬜',
    location: 'Categoria de Alto Risco',
    mission: 'Reforço em ponto crítico ou necessidade do dia',
    mobility: 'Definida pelo gestor',
    color: 'text-slate-600 dark:text-slate-300',
    bgColor: 'bg-slate-50 dark:bg-slate-900/40',
    borderColor: 'border-slate-200 dark:border-slate-700',
  },
  Estoque: {
    label: 'Estoque',
    emoji: '📦',
    location: 'Bastidores',
    mission: 'Guardião dos bastidores — reposição e organização',
    mobility: 'Interna — Assume P1 só se for o único na loja',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
};

/** Ordered sequence of floor positions to fill when in auto mode */
const POSITION_FILL_ORDER: TacticalPosition[] = ['P1', 'P2', 'P3', 'P4', 'P5+'];

function parseTimeToMinutes(tStr: string): number {
  if (!tStr || tStr === 'Flexível') return 0;
  const clean = tStr.replace(/h/g, ':');
  const parts = clean.split(':');
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  return h * 60 + m;
}

function parseShiftRange(shiftStr: string): { start: number, end: number } | null {
  if (!shiftStr) return null;
  const parts = shiftStr.toLowerCase().split(/ às | as | - /);
  if (parts.length !== 2) {
    const start = parseTimeToMinutes(parts[0]);
    if (start) return { start, end: start + 8 * 60 };
    return null;
  }
  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  return { start, end };
}

/**
 * Smart auto-assignment:
 *  1. Positions are filled cumulatively in order P1 → P2 → P3 → P4 → P5+
 *  2. Each employee's preferredPositions (ordered) is used to match them to the
 *     highest-priority available slot that matches one of their preferences.
 *  3. Employees with no preferences or no matching slot are assigned sequentially
 *     to the next unfilled slot.
 *  4. tacticalPosition (legacy) is still honoured as a hard override.
 */
function autoAssign(pool: Employee[], total: number): { emp: Employee; pos: TacticalPosition }[] {
  const result: { emp: Employee; pos: TacticalPosition }[] = [];

  // Determine which positions must be filled based on team size
  const slotsNeeded = Math.min(total, POSITION_FILL_ORDER.length);
  const slots: (TacticalPosition | null)[] = POSITION_FILL_ORDER.slice(0, Math.max(slotsNeeded, total)).map(p => p);
  // If total > 5, append P5+ for extras
  while (slots.length < total) slots.push('P5+');

  const filled = new Array<boolean>(slots.length).fill(false);
  const assigned = new Set<string>();

  // Pass 1 — honour hard tacticalPosition overrides (legacy field)
  pool.forEach(emp => {
    if (emp.tacticalPosition && emp.tacticalPosition !== '') {
      const pos = emp.tacticalPosition as TacticalPosition;
      const slotIdx = slots.findIndex((s, i) => s === pos && !filled[i]);
      if (slotIdx !== -1) {
        filled[slotIdx] = true;
        assigned.add(emp.id);
        result.push({ emp, pos });
      }
    }
  });

  // Pass 2 — match preferred positions in preference order
  // Sort unassigned employees by arrival time then name (deterministic)
  const unassigned = pool
    .filter(e => !assigned.has(e.id))
    .sort((a, b) => {
      const sA = parseShiftRange((a.dailyHours as any)?.__query || a.workPeriod || '')?.start || 0;
      const sB = parseShiftRange((b.dailyHours as any)?.__query || b.workPeriod || '')?.start || 0;
      if (sA !== sB) return sA - sB;
      return a.name.localeCompare(b.name);
    });

  // Try to place each employee in their highest-priority preferred slot
  const tryPreferred = (emp: Employee): boolean => {
    const prefs = emp.preferredPositions || [];
    for (const pref of prefs) {
      const slotIdx = slots.findIndex((s, i) => s === pref && !filled[i]);
      if (slotIdx !== -1) {
        filled[slotIdx] = true;
        assigned.add(emp.id);
        result.push({ emp, pos: pref as TacticalPosition });
        return true;
      }
    }
    return false;
  };

  // First pass on preferred
  const remaining: Employee[] = [];
  unassigned.forEach(emp => {
    if (!tryPreferred(emp)) remaining.push(emp);
  });

  // Pass 3 — assign remaining employees to next available slot in fill order
  remaining.forEach(emp => {
    const slotIdx = filled.findIndex(f => !f);
    if (slotIdx !== -1) {
      filled[slotIdx] = true;
      result.push({ emp, pos: slots[slotIdx] as TacticalPosition });
    } else {
      result.push({ emp, pos: 'P5+' });
    }
  });

  return result;
}

export function calculateTacticalPositions(
  employees: Employee[],
  dayIdx: number,
  monthKey: string,
  queryHourStr: string,
  isSunday: boolean,
  isHoliday: boolean
): TacticalAllocation[] {
  const lunchSlots = calculateLunchSchedule(employees, dayIdx, isSunday, isHoliday, monthKey);

  const workingEmps = employees.filter(emp => {
    if (emp.status !== 'active' || emp.isHidden) return false;
    const shift = (emp.shifts[monthKey] || [])[dayIdx] || 'F';
    return shift === 'T';
  });

  if (workingEmps.length === 0) return [];

  const queryTime = parseTimeToMinutes(queryHourStr);
  const allocations: TacticalAllocation[] = [];
  const availableForPositions: Employee[] = [];

  const getEmpHourStr = (e: Employee) => (e.dailyHours[monthKey] || [])[dayIdx] || e.workPeriod || '';

  workingEmps.forEach(emp => {
    const shiftStr = getEmpHourStr(emp);
    const shiftRange = parseShiftRange(shiftStr);

    if (!shiftRange || queryTime < shiftRange.start || queryTime >= shiftRange.end) return;

    let onLunch = false;
    for (const slot of lunchSlots) {
      if (slot.employees.some(e => e.id === emp.id)) {
        let slotStart = parseTimeToMinutes(slot.time);
        if (slot.time === 'Flexível') {
          slotStart = shiftRange.start + Math.floor((shiftRange.end - shiftRange.start) / 2) - 30;
        }
        const slotEnd = slotStart + slot.duration;
        if (queryTime >= slotStart && queryTime < slotEnd) {
          onLunch = true;
          allocations.push({
            id: emp.id,
            name: emp.name.split(' ')[0],
            cargo: emp.cargo,
            position: 'Pausa/Almoço',
            isApprentice: emp.isYoungApprentice,
            status: 'lunch',
            preferredPositions: emp.preferredPositions,
          });
          break;
        }
      }
    }

    if (!onLunch) {
      if (emp.cargo === 'Estoquista') {
        allocations.push({
          id: emp.id,
          name: emp.name.split(' ')[0],
          cargo: emp.cargo,
          position: 'Estoque',
          isApprentice: emp.isYoungApprentice,
          status: 'working',
          preferredPositions: emp.preferredPositions,
        });
      } else {
        availableForPositions.push(emp);
      }
    }
  });

  // Sort pool deterministically
  availableForPositions.sort((a, b) => {
    const startA = parseShiftRange(getEmpHourStr(a))?.start || 0;
    const startB = parseShiftRange(getEmpHourStr(b))?.start || 0;
    if (startA !== startB) return startA - startB;
    return a.name.localeCompare(b.name);
  });

  // Run smart auto-assignment
  const assignments = autoAssign(availableForPositions, availableForPositions.length);
  assignments.forEach(({ emp, pos }) => {
    allocations.push({
      id: emp.id,
      name: emp.name.split(' ')[0],
      cargo: emp.cargo,
      position: pos,
      isApprentice: emp.isYoungApprentice,
      status: 'working',
      preferredPositions: emp.preferredPositions,
    });
  });

  // Regra de crise: único colaborador na loja → Estoquista assume P1
  const workingNow = allocations.filter(a => a.status === 'working');
  if (workingNow.length === 1 && workingNow[0].position === 'Estoque') {
    workingNow[0].position = 'P1';
  }

  return allocations;
}
