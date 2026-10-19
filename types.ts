export type EmployeeRole = 'Caixa' | 'Pacote' | 'Vendas' | 'Apoio' | 'Fiscal' | 'Estoque';
export type EmployeeCargo = EmployeeRole;

export interface RoleMetadata {
  role: EmployeeRole;
  code: string;        // 'CX', 'PC', 'VEND', 'AP', 'FISC', 'ESTQ'
  label: string;       // 'Caixa', 'Pacote', 'Vendas', 'Apoio', 'Fiscal', 'Estoque'
  badgeColor: string;  // Classes Tailwind de badge
  textColor: string;
  bgColor: string;
}

export const EMPLOYEE_ROLES: EmployeeRole[] = [
  'Caixa',
  'Pacote',
  'Vendas',
  'Apoio',
  'Fiscal',
  'Estoque'
];

export const ROLE_METADATA_MAP: Record<EmployeeRole, RoleMetadata> = {
  Caixa: {
    role: 'Caixa',
    code: 'CX',
    label: 'Caixa',
    badgeColor: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    textColor: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500'
  },
  Pacote: {
    role: 'Pacote',
    code: 'PC',
    label: 'Pacote',
    badgeColor: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
    textColor: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500'
  },
  Vendas: {
    role: 'Vendas',
    code: 'VEND',
    label: 'Vendas',
    badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500'
  },
  Apoio: {
    role: 'Apoio',
    code: 'AP',
    label: 'Apoio',
    badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    textColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500'
  },
  Fiscal: {
    role: 'Fiscal',
    code: 'FISC',
    label: 'Fiscal',
    badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    textColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500'
  },
  Estoque: {
    role: 'Estoque',
    code: 'ESTQ',
    label: 'Estoque',
    badgeColor: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
    textColor: 'text-zinc-600 dark:text-zinc-400',
    bgColor: 'bg-zinc-600'
  }
};

/**
 * Normaliza qualquer cargo, sigla ou código tático legado para as 6 funções canônicas oficiais.
 */
export function normalizeEmployeeRole(rawRole?: string | null): EmployeeRole {
  if (!rawRole) return 'Vendas';
  const clean = rawRole.trim().toUpperCase();

  // Caixa
  if (clean === 'CAIXA' || clean === 'CX' || clean === 'P1' || clean.includes('CAIXA')) return 'Caixa';
  // Pacote
  if (clean === 'PACOTE' || clean === 'PC' || clean === 'EMBALAGEM') return 'Pacote';
  // Fiscal
  if (clean === 'FISCAL' || clean === 'FISC' || clean === 'P4' || clean.includes('PREVENÇÃO') || clean.includes('PREVENCAO')) return 'Fiscal';
  // Estoque
  if (clean === 'ESTOQUE' || clean === 'ESTQ' || clean === 'ESTOQUISTA') return 'Estoque';
  // Apoio (inclui Reposição / REP / P2 / Apoio)
  if (clean === 'APOIO' || clean === 'AP' || clean === 'P2' || clean.includes('REPOSI') || clean === 'REP') return 'Apoio';
  // Vendas (padrão para VEND, P3, Atendimento, Vendedor, etc.)
  if (clean === 'VENDAS' || clean === 'VEND' || clean === 'P3' || clean.includes('VEND') || clean.includes('ATEND')) return 'Vendas';
  // Aprendiz sem cargo específico assume Apoio operacional
  if (clean === 'APRENDIZ') return 'Apoio';

  return 'Vendas';
}

export type DecisionReason =
  | 'LEGAL_IMMUTABLE'
  | 'SUNDAY_ROTATION_OFF'
  | 'CLT_MAX_STREAK_GUARD'
  | 'PREFERRED_DAY_OFF'
  | 'PRE_SUNDAY_GUARD'
  | 'PEAK_DAY_SHIFTED'
  | 'REGULAR_WORK';

export const DECISION_REASON_LABELS: Record<DecisionReason, string> = {
  LEGAL_IMMUTABLE: 'Bloqueio legal (Férias, Atestado, Curso ou Aniversário)',
  SUNDAY_ROTATION_OFF: 'Folga de revezamento dominical (CLT)',
  CLT_MAX_STREAK_GUARD: 'Folga obrigatória por limite de dias seguidos (Art. 67 CLT)',
  PREFERRED_DAY_OFF: 'Folga fixa semanal preferencial',
  PRE_SUNDAY_GUARD: 'Folga técnica de escala dominical (Pre-Sunday Guard)',
  PEAK_DAY_SHIFTED: 'Folga remanejada por dia protegido de alta demanda',
  REGULAR_WORK: 'Trabalho regular escalado',
};

// TacticalShiftType mantido apenas como alias legado para retrocompatibilidade de tipos
export type TacticalShiftType = 'P1' | 'PC' | 'P2' | 'P3' | 'P4' | 'ESTQ';

export type StandardShiftType = 
  | 'T'    // Trabalho regular
  | 'F'    // Folga regular semanal
  | 'FF'   // Folga Feriado compensatória
  | 'FE'   // Férias
  | 'AT'   // Atestado médico
  | 'C'    // Curso (Jovem Aprendiz)
  | 'DO'   // Day Off (Aniversário)
  | 'N/A'; // Fora de vigência (antes da admissão ou após demissão)

export type HolidayCreditShiftType = `FF ${string}`;

export type ShiftType = StandardShiftType | HolidayCreditShiftType;

export function isShiftType(val: unknown): val is ShiftType {
  if (typeof val !== 'string') return false;
  const standard: string[] = ['T', 'F', 'FF', 'FE', 'AT', 'C', 'DO', 'N/A'];
  return standard.includes(val) || val.startsWith('FF');
}

export function normalizeShiftCode(raw: unknown): ShiftType {
  if (typeof raw !== 'string') return 'T';
  const trimmed = raw.trim();
  // Se vier qualquer código tático legado, migra imediatamente para Trabalho ('T')
  if (['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ', 'CX', 'REP', 'VEND', 'FISC'].includes(trimmed)) return 'T';
  if (isShiftType(trimmed)) return trimmed;
  if (trimmed.startsWith('FF')) return trimmed as HolidayCreditShiftType;
  return 'T';
}

export type TacticalDisplayMode = 'positions' | 'roles' | 'off';

export interface Employee {
  id: string;
  name: string;
  isYoungApprentice: boolean;
  contractType?: 'CLT' | 'Sazonal';
  jornada?: '6x1' | '5x2';
  cargo?: EmployeeRole;           // 6 funções canônicas oficiais
  role?: EmployeeRole;            // Alias moderno para cargo
  courseDay?: string; // e.g. 'Segunda-feira'
  status: 'active' | 'inactive';
  statusColor: string;
  shifts: Record<string, ShiftType[]>;     // Keyed by "YYYY-MM"
  dailyHours: Record<string, string[]>;    // Keyed by "YYYY-MM"
  tacticalPositions?: Record<string, (string | null)[]>; // Legado mantido opcional
  decisionReasons?: Record<string, Record<number, DecisionReason>>; // Keyed by "YYYY-MM", then 0-indexed day
  workPeriod: string;                      // Default work period
  preferredDayOff: string;                 // e.g. 'Segunda-feira'
  preferredPosition1?: string;             // Legado mantido opcional
  preferredPosition2?: string;             // Legado mantido opcional
  shiftName: string;
  vacationStart?: string; // YYYY-MM-DD
  vacationEnd?: string;   // YYYY-MM-DD
  atestadoStart?: string; // YYYY-MM-DD
  atestadoEnd?: string;   // YYYY-MM-DD
  hiredAt?: string;       // YYYY-MM-DD — used to skip months before hiring
  firedAt?: string;       // YYYY-MM-DD — used to stop generating after termination
  birthday?: string;       // YYYY-MM-DD or MM-DD
  isHidden?: boolean;      // To hide collaborator from the grid
  password?: string;       // Personal password for individual access
  requests?: EmployeeRequest[];
}

export interface EmployeeRequest {
    date: string; // YYYY-MM-DD
    text: string;
    status: 'pending' | 'seen' | 'granted' | 'refused';
    feedback?: string;
    createdAt: string;
    type?: 'folga_aviso' | 'troca_turno';
    targetEmployeeId?: string;
}

export interface Holiday {
  id: string;
  date: string;  // "MM-DD" for recurring, "YYYY-MM-DD" for one-off
  name: string;
  type: 'national' | 'state' | 'municipal';
  recurring: boolean; // true = happens every year on same MM-DD
}

export interface ProtectedDayDetail {
  dayNum: number;
  maxFolgas: number;
  mandatoryEmployeeIds?: string[]; // IDs de colaboradores específicos bloqueados (vazio/undefined = toda a equipe ativa)
  note?: string;
}

export type ProtectedDaysConfig = Record<number, number | ProtectedDayDetail>; // dayNum (1..31) -> maxFolgas ou ProtectedDayDetail
export type ProtectedDaysMap = Record<string, ProtectedDaysConfig>; // monthKey ("YYYY-MM") -> { [dayNum]: maxFolgas | ProtectedDayDetail }

export interface ComplianceAlert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
}

export interface CoverageStat {
  label: string;
  value: string;
  total: string;
  change?: string;
  status: 'optimal' | 'warning' | 'danger';
  icon: string;
}

export interface MonthYear {
  month: number; // 0-11
  year: number;
}

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncHistoryItem {
  timestamp: string;
  state: SyncState;
  key: string;
  message?: string;
  isSilent?: boolean;
}

export interface SyncStatus {
  state: SyncState;
  lastSync?: string;
  history: SyncHistoryItem[];
  isSilent?: boolean;
}
export interface JornadaSettings {
  minSundayWorkers: number;
  shiftHours: {
    weekday: string[];
    sunday: string[];
    holiday: string[];
    apprentice: string[];
    extended?: string[];
  };
  lunchRules: {
    holiday: string;
    sundayOpening: string;
    sundayClosing: string[];
    weekdayOpening: string[];
    weekdayClosing: string[];
    apprentice: string;
  };
}

export interface OfficialScheduleSnapshot {
  validatedAt: string; // ISO string
  monthKey: string;    // YYYY-MM
  shifts: Record<string, ShiftType[]>;
  dailyHours: Record<string, string[]>;
  tacticalPositions: Record<string, (string | null)[]>;
}

export interface ScheduleDiffItem {
  id: string;
  empId: string;
  empName: string;
  dayIdx: number;
  dateStr: string; // DD/MM/YYYY
  type: 'shift' | 'hour' | 'position';
  officialVal: string;
  currentVal: string;
}

export type AuditChangeType = 
  | 'FOLGA_TRABALHO' 
  | 'TRABALHO_FOLGA' 
  | 'ALTERACAO_HORARIO' 
  | 'ALTERACAO_TURNO' 
  | 'ALTERACAO_POSTO' 
  | 'OUTRA_ALTERACAO_RELEVANTE';

export interface AuditLogEntry {
  id: string;
  timestamp: string;          // ISO string
  authorRole: 'admin';
  authorName: string;         // 'Gestor'
  empId: string;
  empName: string;
  monthKey: string;           // YYYY-MM
  dayIdx: number;
  dateStr: string;            // DD/MM/YYYY
  changeType: AuditChangeType;
  beforeVal: string;
  afterVal: string;
  humanDescription: string;
  justification: string;
  isPostOfficialization: boolean;
}
