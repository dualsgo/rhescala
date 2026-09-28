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

export type ShiftType = StandardShiftType | TacticalShiftType | HolidayCreditShiftType;

export function isShiftType(val: unknown): val is ShiftType {
  if (typeof val !== 'string') return false;
  const standard: string[] = ['T', 'F', 'FF', 'FE', 'AT', 'C', 'DO', 'N/A', 'P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'];
  return standard.includes(val) || val.startsWith('FF');
}

export function normalizeShiftCode(raw: unknown): ShiftType {
  if (typeof raw !== 'string') return 'T';
  const trimmed = raw.trim();
  if (isShiftType(trimmed)) return trimmed;
  if (trimmed.startsWith('FF')) return trimmed as HolidayCreditShiftType;
  return 'T';
}

export type TacticalDisplayMode = 'positions' | 'roles' | 'off';

export type EmployeeCargo = 'Estoquista' | 'Aprendiz' | 'Fiscal' | 'Atendente';

export interface Employee {
  id: string;
  name: string;
  isYoungApprentice: boolean;
  contractType?: 'CLT' | 'Sazonal';
  jornada?: '6x1' | '5x2';
  cargo?: EmployeeCargo;           // 'Atendente' (padrão) | 'Estoquista' | 'Aprendiz' | 'Fiscal'
  courseDay?: string; // e.g. 'Segunda-feira'
  status: 'active' | 'inactive';
  statusColor: string;
  shifts: Record<string, ShiftType[]>;     // Keyed by "YYYY-MM"
  dailyHours: Record<string, string[]>;    // Keyed by "YYYY-MM"
  tacticalPositions: Record<string, (string | null)[]>; // Keyed by "YYYY-MM", e.g. 'P1', 'P2'
  workPeriod: string;                      // Default work period
  preferredDayOff: string;                 // e.g. 'Segunda-feira'
  preferredPosition1?: string;             // e.g. 'P1', 'ESTQ'
  preferredPosition2?: string;             // e.g. 'P2'
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
