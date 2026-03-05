
export type ShiftType = 'T' | 'F' | 'FF' | 'FE' | 'C' | 'N/A' | string; // Trabalho, Folga, Feriado/Folga Especial, Férias, Curso, Not Available, or dynamic Holiday Offs like 'FF 01/05'
export type EmployeeCargo = 'Auxiliar de Loja' | 'Estoquista';

export interface Employee {
  id: string;
  name: string;
  isYoungApprentice: boolean;
  cargo?: EmployeeCargo;           // 'Auxiliar de Loja' (padrão) | 'Estoquista'
  courseDay?: string; // e.g. 'Segunda-feira'
  status: 'active' | 'inactive';
  statusColor: string;
  shifts: Record<string, ShiftType[]>;     // Keyed by "YYYY-MM"
  dailyHours: Record<string, string[]>;    // Keyed by "YYYY-MM"
  workPeriod: string;                      // Default work period
  preferredDayOff: string;                 // e.g. 'Segunda-feira'
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
