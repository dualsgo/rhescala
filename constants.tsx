
import { Employee, Holiday, JornadaSettings } from './types';

/** ID sentinel do colaborador placeholder (nunca deve ser exibido como real) */
export const PLACEHOLDER_EMPLOYEE_ID = '__placeholder__';

/** Colaborador genérico fixo usado quando não há nenhum cadastrado.  
 *  Ao cadastrar o primeiro colaborador real, este é substituído. */
export const PLACEHOLDER_EMPLOYEE: Employee = {
  id: PLACEHOLDER_EMPLOYEE_ID,
  name: 'Colaborador',
  isYoungApprentice: false,
  status: 'active',
  statusColor: '#94a3b8',
  shifts: {},
  dailyHours: {},
  workPeriod: '10h às 18h20',
  preferredDayOff: 'Segunda-feira',
  shiftName: 'Abertura',
  hiredAt: new Date().toISOString().split('T')[0],
};

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
 * Mapeia o horário padrão do colaborador para o horário equivalente de domingo ou feriado.
 */
export function getDefaultHourForDay(emp: Employee, isHoliday: boolean, isSunday: boolean): string {
  if (emp.isYoungApprentice) return SHIFT_HOURS.APPRENTICE[0];
  
  if (isHoliday) {
    if (emp.workPeriod.startsWith('10h')) return '12h às 18h';
    if (emp.workPeriod.startsWith('12h')) return '13h às 19h';
    if (emp.workPeriod.startsWith('13h')) return '15h às 21h';
    return SHIFT_HOURS.HOLIDAY[0];
  }
  
  if (isSunday) {
    if (emp.workPeriod.startsWith('10h') || emp.workPeriod.startsWith('12h')) return '12h às 20h';
    return '13h às 21h';
  }
  
  return emp.workPeriod || SHIFT_HOURS.WEEKDAY[0];
}

/**
 * Extrai o nome de exibição/curto de um colaborador para textos de escala, cartões e relatórios.
 * Preserva abreviações e iniciais explícitas (ex: "Luiz C.", "Luiz H.") e realiza
 * desambiguação automática adicionando a inicial do sobrenome se houver duplicidade do 1º nome.
 */
export function getShortName(fullName: string | undefined | null, allEmployees?: { name: string }[]): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];

  const firstName = parts[0];
  const secondPart = parts[1];

  // Caso o usuário tenha colocado uma inicial explícita (ex: "Luiz C.", "Luiz H.", "Luiz C")
  // ou o 2º termo seja curto (<= 2 caracteres) ou termine com ponto "."
  const isShortOrInitial = secondPart.length <= 2 || secondPart.endsWith('.');

  if (isShortOrInitial) {
    return `${firstName} ${secondPart}`;
  }

  // Tratamento para preposições brasileiras ("de", "da", "do", "dos", "das")
  const prepositions = new Set(['de', 'da', 'do', 'dos', 'das']);
  let surnamePart = secondPart;
  if (prepositions.has(secondPart.toLowerCase()) && parts.length > 2) {
    surnamePart = parts[2];
  }

  // Se houver lista de colaboradores fornecida, verifica se há outro colaborador ativo/cadastrado com o mesmo 1º nome
  if (allEmployees && allEmployees.length > 0) {
    const hasDuplicateFirstName = allEmployees.some(emp => {
      if (!emp.name || emp.name.trim() === trimmed) return false;
      const otherFirst = emp.name.trim().split(/\s+/)[0];
      return otherFirst.toLowerCase() === firstName.toLowerCase();
    });

    if (hasDuplicateFirstName) {
      // Se houver duplicidade (ex: Luiz Carlos e Luiz Henrique), usa a inicial ("Luiz C.", "Luiz H.")
      const initial = surnamePart.charAt(0).toUpperCase();
      return `${firstName} ${initial}.`;
    }
  }

  // Padrão: retorna apenas o primeiro nome
  return firstName;
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

// ─── Mock employees ───────────────────────────────────────────────────────────

const names = [
  'Jheferson Lima', 'Lidi Santos', 'Renata Silva', 'Thais Souza', 'Marcos Oliveira',
  'Camila Peixoto', 'Cátia Souza', 'Erika Melo', 'Luiz Fernando', 'Carol Dias',
  'Aline Rocha', 'Bianca Vaz', 'Lidiane Costa', 'Luiza Paes', 'Rafael Silva',
];

const daysOff = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

export const MOCK_EMPLOYEES: Employee[] = names.map((name, i) => {
  const isYA = i > 12;
  const defaultHour = isYA ? APPRENTICE_WORK_PERIOD : (i < 7 ? '10h às 18h20' : (i < 10 ? '12h às 20h20' : '13h40 às 22h'));
  return {
    id: (i + 1).toString(),
    name,
    isYoungApprentice: isYA,
    courseDay: isYA ? 'Quarta-feira' : undefined,
    status: 'active',
    statusColor: i % 2 === 0 ? '#ff8400' : '#3b82f6',
    shifts: {},
    dailyHours: {},
    workPeriod: defaultHour,
    preferredDayOff: daysOff[i % daysOff.length],
    shiftName: i < 7 ? 'Abertura' : (i < 10 ? 'Intermediário' : 'Fechamento'),
  };
});
