
import { Employee } from '../types';

export interface LunchSlot {
  time: string;
  employees: { id: string; name: string; isApprentice: boolean; isStockist: boolean; cargo?: string }[];
  duration: number; // in minutes
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEmpHour(e: Employee, dayIdx: number, monthKey: string): string {
  return (e.dailyHours[monthKey] || [])[dayIdx] || e.workPeriod || '';
}

function getStartHour(e: Employee, dayIdx: number, monthKey: string): number {
  const h = getEmpHour(e, dayIdx, monthKey);
  const match = h.match(/^(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function addSlot(
  slots: LunchSlot[],
  time: string,
  duration: number,
  emps: Employee[]
): void {
  if (emps.length === 0) return;
  slots.push({
    time,
    duration,
    employees: emps.map(e => ({
      id: e.id,
      name: e.name.split(' ')[0],
      isApprentice: e.isYoungApprentice,
      isStockist: e.cargo === 'Estoquista',
      cargo: e.cargo,
    })),
  });
}

// ─── Main Logic ──────────────────────────────────────────────────────────────

/**
 * Regras de almoço (dias úteis):
 *
 * APRENDIZ: sempre 12h45 (15 min) — independente de qualquer outra regra.
 * ESTOQUISTA: Flexível — sem horário definido.
 *
 * ABERTURA (turno com início ≤ 10h → normalmente 10h às 18h20):
 *   n=1 → 13h
 *   n=2 → 14h, 14h  (ambos juntos no slot 14h)
 *   n=3 → 13h  |  14h, 14h
 *   n=4 → 13h  |  13h30  |  14h, 14h
 *   n=5 → 13h  |  13h30  |  14h, 14h  |  15h
 *   n=6 → 13h  |  13h30  |  14h, 14h  |  15h, 15h
 *   ...extras: 15h (máx 2) → 15h30, 16h
 *
 * INTERMEDIÁRIO (turno com início entre 11h e 12h):
 *   Tratado como "tarde" — come junto com fechamento (pool unificado abaixo).
 *
 * FECHAMENTO/TARDE (turno com início ≥ 13h, ex: 13h40 às 22h):
 *   O pool "tarde" combina intermediário (12h) + fechamento (13h40+).
 *   n=1 → 15h
 *   n=2 → 15h, 16h
 *   n=3 → 15h, 16h, 17h
 *   n=4 → 15h(2), 16h, 17h
 *   n=5 → 15h(2), 16h, 16h30, 17h
 *   n=6 → 15h(2), 16h, 16h30, 17h, 17h30
 *   ...
 *
 * Princípio geral: no máximo 2 pessoas em almoço no mesmo slot de 1h,
 * exceção permitida no slot 13h30 (que pode ter 1 pessoa) para não
 * ultrapassar 3 no intervalo global.
 */
export function calculateLunchSchedule(
  employees: Employee[],
  dayIdx: number,
  isSunday: boolean,
  isHoliday: boolean,
  monthKey: string
): LunchSlot[] {
  const working = employees.filter(emp => {
    if (emp.status !== 'active') return false;
    const shift = (emp.shifts[monthKey] || [])[dayIdx] || 'F';
    return shift === 'T';
  });

  if (working.length === 0) return [];

  const slots: LunchSlot[] = [];

  // Separate fixed-rule groups
  const apprentices = working.filter(e => e.isYoungApprentice);
  const stockists   = working.filter(e => !e.isYoungApprentice && e.cargo === 'Estoquista');
  const others      = working.filter(e => !e.isYoungApprentice && e.cargo !== 'Estoquista');

  // 1. Aprendizes: always 12h45
  addSlot(slots, '12h45', 15, apprentices);

  // 2. Estoquistas: flexible
  addSlot(slots, 'Flexível', 60, stockists);

  // ── DOMINGO ──────────────────────────────────────────────────────────────
  if (isSunday) {
    const openers    = others.filter(e => getStartHour(e, dayIdx, monthKey) <= 12);
    const closers    = others.filter(e => getStartHour(e, dayIdx, monthKey) > 12);

    // Abertura do domingo (12h): slots 13h, 14h, 15h, 16h, 17h
    const sundayOpenSlots = ['13h', '14h', '15h', '16h', '17h'];
    let pool = [...openers];
    let slotIdx = 0;
    while (pool.length > 0 && slotIdx < sundayOpenSlots.length) {
      const take = Math.min(2, pool.length);
      addSlot(slots, sundayOpenSlots[slotIdx], 60, pool.splice(0, take));
      slotIdx++;
    }
    // Fechamento domingo
    const sundayCloseSlots = ['15h', '16h', '17h'];
    closers.forEach((emp, i) => {
      const time = i < sundayCloseSlots.length ? sundayCloseSlots[i] : '17h30';
      addSlot(slots, time, 60, [emp]);
    });

    return slots;
  }

  // ── FERIADO ───────────────────────────────────────────────────────────────
  if (isHoliday) {
    let startMinutes = 13 * 60;
    others.forEach(e => {
      const h = Math.floor(startMinutes / 60);
      const m = startMinutes % 60;
      const timeStr = m === 0 ? `${h}h` : `${h}h${m}`;
      addSlot(slots, timeStr, 15, [e]);
      startMinutes += 15;
    });
    return slots;
  }

  // ── DIA ÚTIL ─────────────────────────────────────────────────────────────

  // 1. Sort alphabetically to ensure deterministic results regardless of list order
  const sortedOthers = [...others].sort((a, b) => a.name.localeCompare(b.name));

  // 2. Classify by shift start time more strictly
  const abertura      = sortedOthers.filter(e => getStartHour(e, dayIdx, monthKey) <= 10);
  const intermediario = sortedOthers.filter(e => {
    const h = getStartHour(e, dayIdx, monthKey);
    return h > 10 && h < 13;
  });
  const fechamento    = sortedOthers.filter(e => getStartHour(e, dayIdx, monthKey) >= 13);

  // ── ABERTURA LUNCH SLOTS (13h – 15h) ─────────────────────────────────────
  const n = abertura.length;
  if (n === 1) {
    addSlot(slots, '13h', 60, [abertura[0]]);
  } else if (n === 2) {
    addSlot(slots, '14h', 60, abertura.slice(0, 2));
  } else if (n === 3) {
    addSlot(slots, '13h', 60, [abertura[0]]);
    addSlot(slots, '14h', 60, abertura.slice(1, 3));
  } else if (n === 4) {
    addSlot(slots, '13h',   60, [abertura[0]]);
    addSlot(slots, '13h30', 60, [abertura[1]]);
    addSlot(slots, '14h',   60, abertura.slice(2, 4));
  } else if (n >= 5) {
    addSlot(slots, '13h',   60, [abertura[0]]);
    addSlot(slots, '13h30', 60, [abertura[1]]);
    addSlot(slots, '14h',   60, abertura.slice(2, 4));
    const overflowSlots = ['15h', '15h', '15h30', '15h30', '16h', '16h'];
    const extra = abertura.slice(4);
    let oi = 0;
    while (extra.length > 0) {
      const take = Math.min(2, extra.length);
      const time = oi < overflowSlots.length ? overflowSlots[oi] : '16h30';
      addSlot(slots, time, 60, extra.splice(0, take));
      oi += 2;
    }
  }

  // ── INTERMEDIÁRIO LUNCH SLOTS (15h – 16h30) ──────────────────────────────
  intermediario.forEach((emp, i) => {
    const interSlots = ['15h', '15h30', '16h'];
    const time = i < interSlots.length ? interSlots[i] : '16h30';
    addSlot(slots, time, 60, [emp]);
  });

  // ── FECHAMENTO LUNCH SLOTS (16h30 – 18h+) ───────────────────────────────
  fechamento.forEach((emp, i) => {
    // Escalonamento para fechamento começa mais tarde
    const closeSlots = ['16h30', '17h', '17h30', '18h'];
    const time = i < closeSlots.length ? closeSlots[i] : '18h30';
    addSlot(slots, time, 60, [emp]);
  });

  return slots;
}
