
export type ShiftType = 'T' | 'P1' | 'P2' | 'P3' | 'P4' | 'ESTQ' | 'F' | 'FF' | 'FE' | 'C' | 'DO' | 'N/A' | string; // Trabalho (ou Posição), Folga, Feriado/Folga Especial, Férias, Curso, Day Off (Birthday), Not Available

export type EmployeeCargo = 'Estoquista' | 'Aprendiz' | 'Fiscal' | 'Atendente';

export interface Employee {
  id: string;
  name: string;
  isYoungApprentice: boolean;
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
  hiredAt?: string;       // YYYY-MM-DD — used to skip months before hiring
  firedAt?: string;       // YYYY-MM-DD — used to stop generating after termination
  birthday?: string;       // YYYY-MM-DD or MM-DD
  isHidden?: boolean;      // To hide collaborator from the grid
}

export interface Holiday {
  id: string;
  date: string;  // "MM-DD" for recurring, "YYYY-MM-DD" for one-off
  name: string;
  type: 'national' | 'state' | 'municipal';
  recurring: boolean; // true = happens every year on same MM-DD
}

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
}

export interface SyncStatus {
  state: SyncState;
  lastSync?: string;
  history: SyncHistoryItem[];
}
