import { EmployeeRole, ShiftType, Employee, normalizeEmployeeRole, normalizeShiftCode } from '../../types';
import { migrateLegacyEmployeeData } from '../services/scheduleMigrationService';

export { normalizeEmployeeRole, normalizeShiftCode, migrateLegacyEmployeeData };
export type { EmployeeRole };

export const EMPLOYEE_ROLES: EmployeeRole[] = [
  'Caixa',
  'Pacote',
  'Vendas',
  'Apoio',
  'Fiscal',
  'Estoque'
];

export interface RoleVisualMeta {
  role: EmployeeRole;
  code: string;
  label: string;
  badgeClass: string;
  pillClass: string;
  textClass: string;
  dotClass: string;
}

/**
 * Identidade Cromática Semântica das 6 Funções Oficiais (WCAG AA/AAA Contraste >= 4.5:1):
 * - Caixa (CX): Família Emerald (Verde Esmeralda)
 * - Vendas (VEND): Família Orange (Laranja)
 * - Pacote (PC): Família Cyan (Ciano)
 * - Apoio (AP): Família Indigo (Índigo)
 * - Fiscal (FISC): Família Purple (Roxo)
 * - Estoque (ESTQ): Família Amber (Âmbar)
 */
export const ROLE_VISUAL_MAP: Record<EmployeeRole, RoleVisualMeta> = {
  Caixa: {
    role: 'Caixa',
    code: 'CX',
    label: 'Caixa',
    badgeClass: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30',
    pillClass: 'bg-emerald-600 text-white',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  Vendas: {
    role: 'Vendas',
    code: 'VEND',
    label: 'Vendas',
    badgeClass: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-500/30',
    pillClass: 'bg-orange-600 text-white',
    textClass: 'text-orange-700 dark:text-orange-400',
    dotClass: 'bg-orange-500',
  },
  Pacote: {
    role: 'Pacote',
    code: 'PC',
    label: 'Pacote',
    badgeClass: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30',
    pillClass: 'bg-cyan-600 text-white',
    textClass: 'text-cyan-700 dark:text-cyan-400',
    dotClass: 'bg-cyan-500',
  },
  Apoio: {
    role: 'Apoio',
    code: 'AP',
    label: 'Apoio',
    badgeClass: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30',
    pillClass: 'bg-indigo-600 text-white',
    textClass: 'text-indigo-700 dark:text-indigo-400',
    dotClass: 'bg-indigo-500',
  },
  Fiscal: {
    role: 'Fiscal',
    code: 'FISC',
    label: 'Fiscal',
    badgeClass: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30',
    pillClass: 'bg-purple-600 text-white',
    textClass: 'text-purple-700 dark:text-purple-400',
    dotClass: 'bg-purple-500',
  },
  Estoque: {
    role: 'Estoque',
    code: 'ESTQ',
    label: 'Estoque',
    badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30',
    pillClass: 'bg-amber-600 text-white',
    textClass: 'text-amber-700 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
};

/**
 * Tokens de Superfícies & Elevação padronizados exclusivamente na família Zinc
 */
export const SURFACE_TOKENS = {
  canvas: 'bg-zinc-50 dark:bg-zinc-950',
  primary: 'bg-white dark:bg-zinc-900',
  secondary: 'bg-zinc-100 dark:bg-zinc-800/60',
  border: 'border-zinc-200 dark:border-zinc-800',
  brand: 'bg-orange-500 hover:bg-orange-600 text-white',
} as const;

/**
 * Tokens de Tipografia e Ergonomia
 */
export const TYPOGRAPHY_TOKENS = {
  floor: 'text-[11px]',
  body: 'text-sm',
  tabular: 'tabular-nums',
  touchMobile: 'min-h-[44px] min-w-[44px]',
  touchDesktop: 'min-h-[38px]',
} as const;

export interface ShiftCellStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
  dotColor: string;
}

export const SHIFT_CELL_STYLES: Record<string, ShiftCellStyle> = {
  T: {
    bg: 'bg-white dark:bg-zinc-900',
    text: 'text-zinc-800 dark:text-zinc-200',
    border: 'border-zinc-200 dark:border-zinc-800 hover:border-orange-400',
    label: 'Trabalho Regular',
    dotColor: 'bg-zinc-400',
  },
  F: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/25',
    label: 'Folga Semanal',
    dotColor: 'bg-emerald-500',
  },
  FF: {
    bg: 'bg-teal-500/10 dark:bg-teal-500/15',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-500/25',
    label: 'Folga Compensatória (Feriado)',
    dotColor: 'bg-teal-500',
  },
  FE: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/25',
    label: 'Férias',
    dotColor: 'bg-sky-500',
  },
  AT: {
    bg: 'bg-amber-500/15 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    label: 'Atestado Médico',
    dotColor: 'bg-amber-500',
  },
  DO: {
    bg: 'bg-pink-500/10 dark:bg-pink-500/15',
    text: 'text-pink-700 dark:text-pink-300',
    border: 'border-pink-500/25',
    label: 'Folga Aniversário (Day Off)',
    dotColor: 'bg-pink-500',
  },
  C: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-500/25',
    label: 'Curso Teórico (Aprendiz)',
    dotColor: 'bg-indigo-500',
  },
  'N/A': {
    bg: 'bg-zinc-100 dark:bg-zinc-800/50',
    text: 'text-zinc-400 dark:text-zinc-500',
    border: 'border-zinc-200 dark:border-zinc-700',
    label: 'Fora do Contrato',
    dotColor: 'bg-zinc-400',
  },
};

export function getShiftCellStyle(shift?: string | null): ShiftCellStyle {
  if (!shift) return SHIFT_CELL_STYLES['T'];
  if (shift.startsWith('FF')) return SHIFT_CELL_STYLES['FF'];
  return SHIFT_CELL_STYLES[shift] || SHIFT_CELL_STYLES['T'];
}

/**
 * Sanitiza e normaliza um colaborador individual, convertendo qualquer cargo,
 * sigla ou código tático legado para as 6 funções oficiais.
 */
export function sanitizeEmployeeData(emp: Employee): Employee {
  const canonicalRole = normalizeEmployeeRole(emp.cargo || emp.role);
  
  const sanitizedShifts: Record<string, ShiftType[]> = {};
  if (emp.shifts) {
    for (const [monthKey, monthShifts] of Object.entries(emp.shifts)) {
      if (Array.isArray(monthShifts)) {
        sanitizedShifts[monthKey] = monthShifts.map(s => normalizeShiftCode(s));
      }
    }
  }

  const canonicalPrimary = normalizeEmployeeRole(emp.primaryRole || emp.cargo || emp.role);
  let secondary: 'Caixa' | 'Pacote' | 'Vendas' | 'Apoio' | undefined = undefined;
  if (emp.secondaryRole) {
    const normSec = normalizeEmployeeRole(emp.secondaryRole);
    if (['Caixa', 'Pacote', 'Vendas', 'Apoio'].includes(normSec) && normSec !== canonicalPrimary) {
      secondary = normSec as 'Caixa' | 'Pacote' | 'Vendas' | 'Apoio';
    }
  }

  return {
    ...emp,
    primaryRole: canonicalPrimary,
    secondaryRole: secondary,
    cargo: canonicalPrimary,
    role: canonicalPrimary,
    shifts: sanitizedShifts,
    dailyAssignedRoles: emp.dailyAssignedRoles || {},
  };
}

/**
 * Sanitiza uma lista completa de colaboradores recuperada do localStorage ou da nuvem.
 */
export function sanitizeEmployeesList(employees: Employee[]): Employee[] {
  if (!Array.isArray(employees)) return [];
  return employees.map(sanitizeEmployeeData);
}
