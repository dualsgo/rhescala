import { DEFAULT_JORNADA_SETTINGS } from '../config/schedule-constants';
import { Employee, JornadaSettings } from '../../../types';

export const WORKING_TACTICAL_CODES = [
  'P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ',
  'CX', 'REP', 'VEND', 'FISC', 'AP'
] as const;

/**
 * Predicado puro e leve que determina se um código de escala representa um dia trabalhado em loja.
 * Retorna true para 'T' e posições/funções correlatas ('P1'..'P4', 'PC', 'ESTQ', 'CX', 'REP', 'VEND', 'FISC', 'AP').
 * Retorna false para folgas ('F', 'DO'), feriados folga ('FF'), afastamentos ('FE', 'AT', 'N/A') ou curso ('C').
 */
export function isWorkingShift(s: string | undefined | null): boolean {
  if (!s) return false;
  if (s === 'T') return true;
  return (WORKING_TACTICAL_CODES as readonly string[]).includes(s);
}

/**
 * Resolve o código de turno efetivo do colaborador em uma data específica,
 * aplicando a mesma precedência visual da grade mensal:
 * 1. Fora da vigência contratual (hiredAt / firedAt) -> 'N/A'
 * 2. Período de atestado médico (atestadoStart..atestadoEnd) -> 'AT'
 * 3. Período de férias (vacationStart..vacationEnd) -> 'FE'
 * 4. Turno gravado na matriz mensal (com fallback para 'T' se vazio)
 */
export function resolveEffectiveShift(
  emp: Pick<Employee, 'shifts' | 'hiredAt' | 'firedAt' | 'atestadoStart' | 'atestadoEnd' | 'vacationStart' | 'vacationEnd'>,
  dateStr: string,
  monthKey: string,
  dayIdx: number
): string {
  let rawShift: string = emp.shifts?.[monthKey]?.[dayIdx] || 'T';
  if (emp.hiredAt && dateStr < emp.hiredAt) {
    rawShift = 'N/A';
  } else if (emp.firedAt && dateStr > emp.firedAt) {
    rawShift = 'N/A';
  } else if (emp.atestadoStart && emp.atestadoEnd && dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) {
    rawShift = 'AT';
  } else if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) {
    rawShift = 'FE';
  }
  return rawShift;
}

/**
 * Classifica a faixa horária informada no turno correspondente de loja:
 * - 'Abertura': entrada pela manhã (ex: 10h às 18h20, ou entrada <= 12h aos domingos)
 * - 'Intermediário': entrada no meio do dia (ex: 12h às 20h20)
 * - 'Fechamento': entrada para encerramento (ex: 13h40 às 22h, ou entrada > 12h aos domingos)
 * - 'N/A': folga ou ausência de horário
 */
export function getShiftClassification(
  hourRange: string,
  isSunday?: boolean,
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): 'Abertura' | 'Intermediário' | 'Fechamento' | 'N/A' {
  if (!hourRange || hourRange === 'OFF' || hourRange === 'FOLGA') return 'N/A';

  // Aprendiz é sempre considerado 'Abertura' para posicionamento tático
  if (settings.shiftHours.apprentice.includes(hourRange)) return 'Abertura';

  const match = hourRange.match(/^(\d{1,2})[h:]/);
  if (!match) return 'Intermediário';
  const startHour = parseInt(match[1], 10);

  if (isSunday) {
    if (startHour <= 12) return 'Abertura';
    return 'Fechamento';
  }

  if (startHour <= 10) return 'Abertura';
  if (startHour >= 13) return 'Fechamento';
  return 'Intermediário';
}
