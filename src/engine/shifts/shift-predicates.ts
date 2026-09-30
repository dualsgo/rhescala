import { DEFAULT_JORNADA_SETTINGS } from '../config/schedule-constants';
import { JornadaSettings } from '../../../types';

export const WORKING_TACTICAL_CODES = ['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'] as const;

/**
 * Predicado puro e leve que determina se um código de escala representa um dia trabalhado.
 * Retorna true para 'T' e posições táticas operacionais ('P1'..'P4', 'PC', 'ESTQ').
 * Retorna false para folgas ('F', 'DO'), feriados folga ('FF'), afastamentos ('FE', 'AT', 'N/A') ou curso ('C').
 */
export function isWorkingShift(s: string | undefined | null): boolean {
  if (!s) return false;
  if (s === 'T') return true;
  return (WORKING_TACTICAL_CODES as readonly string[]).includes(s);
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
