import { Employee } from './types';
import type { TacticalDisplayMode } from './types';

export type { TacticalDisplayMode };

export const TACTICAL_ROLE_MAP: Record<string, {
  positionCode: string;
  roleCode: string;
  positionLabel: string;
  roleLabel: string;
  shortRoleLabel: string;
  colorBg: string;
  colorText: string;
  colorRing: string;
  emoji: string;
}> = {
  P1: {
    positionCode: 'P1',
    roleCode: 'CX',
    positionLabel: 'Caixa (P1)',
    roleLabel: 'Caixa',
    shortRoleLabel: 'Caixa',
    colorBg: 'bg-red-600',
    colorText: 'text-white',
    colorRing: 'ring-red-400',
    emoji: '🟥'
  },
  PC: {
    positionCode: 'PC',
    roleCode: 'PC',
    positionLabel: 'Pacote (P1)',
    roleLabel: 'Pacote',
    shortRoleLabel: 'Pacote',
    colorBg: 'bg-orange-500',
    colorText: 'text-white',
    colorRing: 'ring-orange-400',
    emoji: '🟧'
  },
  P2: {
    positionCode: 'P2',
    roleCode: 'REP',
    positionLabel: 'Reposição / Organização (P2)',
    roleLabel: 'Reposição / Organização',
    shortRoleLabel: 'Reposição',
    colorBg: 'bg-amber-500',
    colorText: 'text-white',
    colorRing: 'ring-amber-300',
    emoji: '🟨'
  },
  P3: {
    positionCode: 'P3',
    roleCode: 'VEND',
    positionLabel: 'Vendas / Atendimento (P3)',
    roleLabel: 'Vendas / Atendimento',
    shortRoleLabel: 'Vendas',
    colorBg: 'bg-emerald-600',
    colorText: 'text-white',
    colorRing: 'ring-emerald-400',
    emoji: '🟩'
  },
  P4: {
    positionCode: 'P4',
    roleCode: 'FISC',
    positionLabel: 'Fiscal',
    roleLabel: 'Fiscal',
    shortRoleLabel: 'Fiscal',
    colorBg: 'bg-blue-600',
    colorText: 'text-white',
    colorRing: 'ring-blue-400',
    emoji: '🟦'
  },
  FISC: {
    positionCode: 'FISC',
    roleCode: 'FISC',
    positionLabel: 'Fiscal',
    roleLabel: 'Fiscal',
    shortRoleLabel: 'Fiscal',
    colorBg: 'bg-blue-600',
    colorText: 'text-white',
    colorRing: 'ring-blue-400',
    emoji: '🟦'
  },
  CX: {
    positionCode: 'CX',
    roleCode: 'CX',
    positionLabel: 'Caixa',
    roleLabel: 'Caixa',
    shortRoleLabel: 'Caixa',
    colorBg: 'bg-red-600',
    colorText: 'text-white',
    colorRing: 'ring-red-400',
    emoji: '🟥'
  },
  REP: {
    positionCode: 'REP',
    roleCode: 'REP',
    positionLabel: 'Reposição / Organização',
    roleLabel: 'Reposição / Organização',
    shortRoleLabel: 'Reposição',
    colorBg: 'bg-amber-500',
    colorText: 'text-white',
    colorRing: 'ring-amber-300',
    emoji: '🟨'
  },
  VEND: {
    positionCode: 'VEND',
    roleCode: 'VEND',
    positionLabel: 'Vendas / Atendimento',
    roleLabel: 'Vendas / Atendimento',
    shortRoleLabel: 'Vendas',
    colorBg: 'bg-emerald-600',
    colorText: 'text-white',
    colorRing: 'ring-emerald-400',
    emoji: '🟩'
  },
  ATEND: {
    positionCode: 'ATEND',
    roleCode: 'VEND',
    positionLabel: 'Vendas / Atendimento',
    roleLabel: 'Vendas / Atendimento',
    shortRoleLabel: 'Vendas',
    colorBg: 'bg-emerald-600',
    colorText: 'text-white',
    colorRing: 'ring-emerald-400',
    emoji: '🟩'
  },
  ESTQ: {
    positionCode: 'ESTQ',
    roleCode: 'ESTQ',
    positionLabel: 'Estoque',
    roleLabel: 'Estoque',
    shortRoleLabel: 'Estoque',
    colorBg: 'bg-slate-700',
    colorText: 'text-white',
    colorRing: 'ring-slate-500',
    emoji: '📦'
  }
};

export const TACTICAL_POSITIONS_LIST = ['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'];

/**
 * Retorna o rótulo descritivo da posição/função baseado no modo de exibição.
 */
export function getTacticalLabel(posCode: string, mode: TacticalDisplayMode = 'positions'): string {
  if (mode === 'off') return 'Trabalho (T)';
  const item = TACTICAL_ROLE_MAP[posCode];
  if (!item) return posCode;
  return mode === 'roles' ? item.roleLabel : item.positionLabel;
}

/**
 * Retorna a sigla exibida na célula da grade baseada no modo de exibição.
 */
export function getTacticalCellCode(posCode: string, mode: TacticalDisplayMode = 'positions'): string {
  if (mode === 'off') return 'T';
  const item = TACTICAL_ROLE_MAP[posCode];
  if (!item) return posCode;
  return mode === 'roles' ? item.roleCode : item.positionCode;
}

/**
 * Retorna o emoji associado à posição/função.
 */
export function getTacticalEmoji(posCode: string): string {
  return TACTICAL_ROLE_MAP[posCode]?.emoji || '🔹';
}

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
  tacticalPositions: {},
  workPeriod: '10h às 18h20',
  preferredDayOff: 'Segunda-feira',
  shiftName: 'Abertura',
  hiredAt: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(),
};

import {
  APPRENTICE_WORK_PERIOD,
  SHIFT_HOURS,
  DEFAULT_JORNADA_SETTINGS,
  getDefaultProtectedDays,
  getSeasonalPresetProtectedDays,
  normalizeProtectedDaysDetails,
  normalizeProtectedDaysConfig,
  getDefaultHourForDay,
  isEmployeeActiveInMonth,
  isEmployeeActiveOnDay,
  getNationalHolidays,
  buildHolidaySet,
} from './src/engine/config/schedule-constants';

export {
  APPRENTICE_WORK_PERIOD,
  SHIFT_HOURS,
  DEFAULT_JORNADA_SETTINGS,
  getDefaultProtectedDays,
  getSeasonalPresetProtectedDays,
  normalizeProtectedDaysDetails,
  normalizeProtectedDaysConfig,
  getDefaultHourForDay,
  isEmployeeActiveInMonth,
  isEmployeeActiveOnDay,
  getNationalHolidays,
  buildHolidaySet,
};


/**
 * Extrai o nome de exibição/curto de um colaborador em CAIXA ALTA para textos de escala, cartões e relatórios.
 * Preserva abreviações e iniciais explícitas (ex: "LUIZ C.", "LUIZ H.") e realiza
 * desambiguação automática adicionando a inicial do sobrenome se houver duplicidade do 1º nome.
 */
export function getShortName(fullName: string | undefined | null, allEmployees?: { name: string }[]): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase();

  const firstName = parts[0];
  const secondPart = parts[1];

  // Caso o usuário tenha colocado uma inicial explícita (ex: "Luiz C.", "Luiz H.", "Luiz C")
  // ou o 2º termo seja curto (<= 2 caracteres) ou termine com ponto "."
  const isShortOrInitial = secondPart.length <= 2 || secondPart.endsWith('.');

  if (isShortOrInitial) {
    return `${firstName} ${secondPart}`.toUpperCase();
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
      // Se houver duplicidade (ex: Luiz Carlos e Luiz Henrique), usa a inicial ("LUIZ C.", "LUIZ H.")
      const initial = surnamePart.charAt(0).toUpperCase();
      return `${firstName} ${initial}.`.toUpperCase();
    }
  }

  // Padrão: retorna apenas o primeiro nome em caixa alta
  return firstName.toUpperCase();
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
    tacticalPositions: {},
    workPeriod: defaultHour,
    preferredDayOff: daysOff[i % daysOff.length],
    shiftName: i < 7 ? 'Abertura' : (i < 10 ? 'Intermediário' : 'Fechamento'),
  };
});
