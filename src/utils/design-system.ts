import { EmployeeRole, ShiftType } from '../../types';

export { normalizeEmployeeRole } from '../../types';
export type { EmployeeRole };

export interface RoleVisualMeta {
  role: EmployeeRole;
  code: string;
  label: string;
  badgeClass: string;
  pillClass: string;
  textClass: string;
  dotClass: string;
}

export const ROLE_VISUAL_MAP: Record<EmployeeRole, RoleVisualMeta> = {
  Caixa: {
    role: 'Caixa',
    code: 'CX',
    label: 'Caixa',
    badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30',
    pillClass: 'bg-red-500 text-white',
    textClass: 'text-red-600 dark:text-red-400',
    dotClass: 'bg-red-500',
  },
  Pacote: {
    role: 'Pacote',
    code: 'PC',
    label: 'Pacote',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30',
    pillClass: 'bg-orange-500 text-white',
    textClass: 'text-orange-600 dark:text-orange-400',
    dotClass: 'bg-orange-500',
  },
  Vendas: {
    role: 'Vendas',
    code: 'VEND',
    label: 'Vendas',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
    pillClass: 'bg-emerald-500 text-white',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  Apoio: {
    role: 'Apoio',
    code: 'AP',
    label: 'Apoio',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30',
    pillClass: 'bg-blue-500 text-white',
    textClass: 'text-blue-600 dark:text-blue-400',
    dotClass: 'bg-blue-500',
  },
  Fiscal: {
    role: 'Fiscal',
    code: 'FISC',
    label: 'Fiscal',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30',
    pillClass: 'bg-amber-500 text-white',
    textClass: 'text-amber-600 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  Estoque: {
    role: 'Estoque',
    code: 'ESTQ',
    label: 'Estoque',
    badgeClass: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border border-zinc-500/30',
    pillClass: 'bg-zinc-600 text-white',
    textClass: 'text-zinc-600 dark:text-zinc-300',
    dotClass: 'bg-zinc-500',
  },
};

export interface ShiftCellStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
  dotColor: string;
}

export const SHIFT_CELL_STYLES: Record<string, ShiftCellStyle> = {
  T: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    label: 'Trabalho Regular',
    dotColor: 'bg-emerald-500',
  },
  F: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/30',
    label: 'Folga Semanal',
    dotColor: 'bg-rose-500',
  },
  FF: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    label: 'Folga Compensatória (Feriado)',
    dotColor: 'bg-amber-500',
  },
  FE: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/30',
    label: 'Férias',
    dotColor: 'bg-sky-500',
  },
  AT: {
    bg: 'bg-red-500/15 dark:bg-red-500/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-500/30',
    label: 'Atestado Médico',
    dotColor: 'bg-red-500',
  },
  DO: {
    bg: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/15',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    border: 'border-fuchsia-500/30',
    label: 'Folga Aniversário (Day Off)',
    dotColor: 'bg-fuchsia-500',
  },
  C: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-500/30',
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
