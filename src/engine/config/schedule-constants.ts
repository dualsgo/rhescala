import { Employee, Holiday, JornadaSettings, ProtectedDayDetail } from '../../../types';

export const APPRENTICE_WORK_PERIOD = '10h às 16h15'; // Jornada fixa do Jovem Aprendiz (pausa 15 min)

export const SHIFT_HOURS = {
  WEEKDAY: ['10h às 18h20', '12h às 20h20', '13h40 às 22h'],
  SUNDAY:  ['12h às 20h', '13h às 21h'],
  HOLIDAY: ['12h às 18h', '13h às 19h', '14h às 20h', '15h às 21h'],
  APPRENTICE: ['10h às 16h15'],
  EXTENDED: ['09h às 17h20', '10h às 18h20', '12h às 20h20', '13h40 às 22h', '14h40 às 23h', '09h às 15h', '12h às 18h', '15h às 21h', '17h às 23h'],
};

export const DEFAULT_JORNADA_SETTINGS: JornadaSettings = {
  minSundayWorkers: 5,
  shiftHours: {
    weekday: SHIFT_HOURS.WEEKDAY,
    sunday: SHIFT_HOURS.SUNDAY,
    holiday: SHIFT_HOURS.HOLIDAY,
    apprentice: SHIFT_HOURS.APPRENTICE,
    extended: SHIFT_HOURS.EXTENDED,
  },
  lunchRules: {
    holiday: '15 min',
    sundayOpening: '13h',
    sundayClosing: ['14h', '15h', '16h', '17h'],
    weekdayOpening: ['13h', '13h45', '14h'],
    weekdayClosing: ['15h', '15h30', '16h', '16h30', '17h'],
    apprentice: '12h45',
  }
};

/**
 * Retorna os dias protegidos padrão por mês.
 * Por padrão, retorna vazio ({}) para que o gestor tenha total liberdade de escolha.
 */
export function getDefaultProtectedDays(_month?: number): Record<number, number> {
  return {};
}

/**
 * Retorna presets sazonais sugeridos para preenchimento rápido em 1 clique:
 * - Outubro (mês 9): Dias 8 a 12 (0 folgas, Dia das Crianças)
 * - Novembro (mês 10): Dias 26 a 29 (0 folgas, Black Friday)
 * - Dezembro (mês 11): Dias 20 a 24 (0 folgas, Natal)
 */
export function getSeasonalPresetProtectedDays(month: number): Record<number, number> {
  if (month === 9) return { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
  if (month === 10) return { 26: 0, 27: 0, 28: 0, 29: 0 };
  if (month === 11) return { 20: 0, 21: 0, 22: 0, 23: 0, 24: 0 };
  return {};
}

/**
 * Normaliza qualquer formato (número, objeto com maxFolgas/mandatoryEmployeeIds ou array legado)
 * para um mapa de detalhes completos: Record<number, ProtectedDayDetail>.
 */
export function normalizeProtectedDaysDetails(val: unknown): Record<number, ProtectedDayDetail> {
  if (!val) return {};
  const config: Record<number, ProtectedDayDetail> = {};

  if (Array.isArray(val)) {
    val.forEach(d => {
      if (typeof d === 'number' && d >= 1 && d <= 31) {
        config[d] = { dayNum: d, maxFolgas: 0 };
      }
    });
    return config;
  }

  if (typeof val === 'object' && val !== null) {
    Object.entries(val as Record<string, unknown>).forEach(([k, v]) => {
      const dayNum = parseInt(k, 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) return;

      if (typeof v === 'number') {
        config[dayNum] = { dayNum, maxFolgas: Math.max(0, v) };
      } else if (typeof v === 'object' && v !== null) {
        const detail = v as Record<string, unknown>;
        config[dayNum] = {
          dayNum,
          maxFolgas: typeof detail.maxFolgas === 'number' ? Math.max(0, detail.maxFolgas) : 0,
          mandatoryEmployeeIds: Array.isArray(detail.mandatoryEmployeeIds) ? (detail.mandatoryEmployeeIds as string[]) : undefined,
          note: typeof detail.note === 'string' ? detail.note : undefined,
        };
      }
    });
    return config;
  }

  return {};
}

/**
 * Normaliza qualquer formato legado ou objeto rico para Record<number, number> (dia -> maxFolgas).
 */
export function normalizeProtectedDaysConfig(val: unknown): Record<number, number> {
  if (!val) return {};
  const details = normalizeProtectedDaysDetails(val);
  const config: Record<number, number> = {};
  Object.entries(details).forEach(([k, v]) => {
    config[Number(k)] = v.maxFolgas;
  });
  return config;
}

/**
 * Mapeia o horário padrão do colaborador para o horário equivalente de domingo ou feriado.
 */
export function getDefaultHourForDay(emp: Employee, isHoliday: boolean, isSunday: boolean): string {
  if (!emp) return SHIFT_HOURS.WEEKDAY[0];
  if (emp.isYoungApprentice) return SHIFT_HOURS.APPRENTICE[0];
  
  const wp = emp.workPeriod || '';
  
  if (isHoliday) {
    if (wp.startsWith('10h')) return '12h às 18h';
    if (wp.startsWith('12h')) return '13h às 19h';
    if (wp.startsWith('13h')) return '15h às 21h';
    return SHIFT_HOURS.HOLIDAY[0];
  }
  
  if (isSunday) {
    if (wp.startsWith('10h') || wp.startsWith('12h')) return '12h às 20h';
    return '13h às 21h';
  }
  
  return wp || SHIFT_HOURS.WEEKDAY[0];
}

/**
 * Verifica se o colaborador está oculto globalmente ou especificamente no mês de referência.
 */
export function isEmployeeHiddenInMonth(emp: Employee | undefined | null, monthKey?: string): boolean {
  if (!emp) return true;
  if (emp.isHidden) return true;
  if (monthKey && emp.hiddenMonths?.[monthKey]) return true;
  return false;
}

/**
 * Verifica se o colaborador está contratualmente elegível para o mês (ativo, período de admissão/demissão válido e com turnos válidos).
 * Não considera o status de ocultação (para permitir listar em controles de reexibição).
 */
export function isEmployeeEligibleForMonth(emp: Employee | undefined | null, year: number, month: number): boolean {
  if (!emp || emp.status !== 'active') return false;

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const firstDayStr = `${monthKey}-01`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lastDayStr = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;

  // Não iniciou ainda (data de início é posterior ao último dia do mês)
  if (emp.hiredAt && emp.hiredAt > lastDayStr) {
    return false;
  }

  // Já foi desligado antes do início do mês
  if (emp.firedAt && emp.firedAt < firstDayStr) {
    return false;
  }

  // Se houver turnos cadastrados para o mês e TODOS forem 'N/A', o colaborador não iniciou
  const monthShifts = emp.shifts?.[monthKey];
  if (monthShifts && monthShifts.length > 0) {
    const hasRealShift = monthShifts.some(s => s && s !== 'N/A');
    if (!hasRealShift) return false;
  }

  return true;
}

/**
 * Verifica se o colaborador está ativo e já iniciou no mês de referência e não está oculto.
 * Oculta automaticamente colaboradores cuja data de início (hiredAt) seja posterior ao mês,
 * ou cuja data de desligamento (firedAt) seja anterior ao mês,
 * ou que tenham todos os turnos do mês como '-' / 'N/A',
 * ou que estejam ocultos globalmente ou especificamente neste mês.
 */
export function isEmployeeActiveInMonth(emp: Employee | undefined | null, year: number, month: number): boolean {
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  if (isEmployeeHiddenInMonth(emp, monthKey)) return false;
  return isEmployeeEligibleForMonth(emp, year, month);
}

/**
 * Verifica se o colaborador está ativo e já iniciou em um dia específico e não está oculto.
 */
export function isEmployeeActiveOnDay(emp: Employee | undefined | null, dateStr: string, monthKey?: string, dayIdx?: number): boolean {
  const effectiveMonthKey = monthKey || (dateStr ? dateStr.slice(0, 7) : undefined);
  if (!emp || isEmployeeHiddenInMonth(emp, effectiveMonthKey) || emp.status !== 'active') return false;
  if (emp.hiredAt && dateStr < emp.hiredAt) return false;
  if (emp.firedAt && dateStr > emp.firedAt) return false;
  if (effectiveMonthKey !== undefined && dayIdx !== undefined) {
    const shift = emp.shifts?.[effectiveMonthKey]?.[dayIdx];
    if (shift === 'N/A') return false;
  }
  return true;
}

/**
 * Returns all fixed Brazilian national holidays for a given year.
 */
export function getNationalHolidays(year: number): Holiday[] {
  // Easter Sunday calculation (Anonymous Gregorian algorithm)
  const easterDate = (y: number): Date => {
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month, day);
  };

  const addDays = (date: Date, days: number): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const fmt = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const easter = easterDate(year);
  const goodFriday = addDays(easter, -2);

  const fixed: Array<Omit<Holiday, 'id'>> = [
    { date: `${year}-01-01`, name: 'Confraternização Universal', type: 'national', recurring: false },
    { date: fmt(goodFriday), name: 'Paixão de Cristo',           type: 'national', recurring: false },
    { date: `${year}-04-21`, name: 'Tiradentes',                 type: 'national', recurring: false },
    { date: `${year}-05-01`, name: 'Dia do Trabalho',            type: 'national', recurring: false },
    { date: `${year}-09-07`, name: 'Independência',              type: 'national', recurring: false },
    { date: `${year}-10-12`, name: 'N. Sra. Aparecida',          type: 'national', recurring: false },
    { date: `${year}-11-02`, name: 'Finados',                    type: 'national', recurring: false },
    { date: `${year}-11-15`, name: 'Proclamação da República',   type: 'national', recurring: false },
    { date: `${year}-11-20`, name: 'Dia da Consciência Negra',   type: 'national', recurring: false },
    { date: `${year}-12-25`, name: 'Natal',                      type: 'national', recurring: false },
  ];

  return fixed.map((h, i) => ({ ...h, id: `national-${year}-${i}` }));
}

/**
 * Returns a Set of "YYYY-MM-DD" holiday date strings for fast lookup.
 */
export function buildHolidaySet(
  year: number,
  customHolidays: Holiday[] = [],
  deletedNationalHolidays: string[] = []
): Set<string> {
  const nationals = getNationalHolidays(year).filter(h => !deletedNationalHolidays.includes(h.id));
  const allHolidays = [...nationals, ...customHolidays];
  return new Set(allHolidays.map(h => h.date).filter(Boolean));
}
