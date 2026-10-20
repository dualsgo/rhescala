import { AuditChangeType } from '../../types';
import { isWorkingShift } from '../../hooks/useScheduleEngine';

export const SHIFT_NAMES: Record<string, string> = {
  F: 'Folga (F)',
  FF: 'Folga Feriado (FF)',
  FE: 'Férias (FE)',
  AT: 'Atestado (AT)',
  DO: 'Aniversário (DO)',
  C: 'Curso',
  T: 'Trabalho (T)',
  P1: 'Caixa (CX)',
  PC: 'Pacote (PC)',
  P2: 'Apoio (AP)',
  P3: 'Vendas (VEND)',
  P4: 'Fiscal (FISC)',
  ESTQ: 'Estoque (ESTQ)',
};

export function getFriendlyShiftName(shift: string, hour?: string): string {
  if (isWorkingShift(shift) || shift === 'T') {
    return hour ? `Trabalho (${hour})` : 'Trabalho';
  }
  return SHIFT_NAMES[shift] || shift;
}

export function classifyShiftChange(
  empName: string,
  dateStr: string,
  oldShift: string,
  newShift: string,
  currentHour?: string
): {
  changeType: AuditChangeType;
  beforeVal: string;
  afterVal: string;
  humanDescription: string;
} {
  const oldIsWork = isWorkingShift(oldShift);
  const newIsWork = isWorkingShift(newShift);

  const beforeVal = getFriendlyShiftName(oldShift, currentHour);
  const afterVal = getFriendlyShiftName(newShift, currentHour);

  if (!oldIsWork && newIsWork) {
    return {
      changeType: 'FOLGA_TRABALHO',
      beforeVal,
      afterVal,
      humanDescription: `${empName} passou de folga para trabalho.`,
    };
  }

  if (oldIsWork && !newIsWork) {
    return {
      changeType: 'TRABALHO_FOLGA',
      beforeVal,
      afterVal,
      humanDescription: `${empName} deixou de trabalhar e passou a folgar.`,
    };
  }

  return {
    changeType: 'OUTRA_ALTERACAO_RELEVANTE',
    beforeVal,
    afterVal,
    humanDescription: `Status da escala alterado de ${beforeVal} para ${afterVal}.`,
  };
}

export function classifyHourChange(
  empName: string,
  dateStr: string,
  oldHour: string,
  newHour: string
): {
  changeType: AuditChangeType;
  beforeVal: string;
  afterVal: string;
  humanDescription: string;
} {
  const beforeVal = oldHour || 'Horário padrão';
  const afterVal = newHour || 'Horário padrão';

  return {
    changeType: 'ALTERACAO_HORARIO',
    beforeVal,
    afterVal,
    humanDescription: `Horário de trabalho alterado: ${beforeVal} ➔ ${afterVal}.`,
  };
}

export function classifyTacticalChange(
  empName: string,
  dateStr: string,
  oldPos: string | null,
  newPos: string | null
): {
  changeType: AuditChangeType;
  beforeVal: string;
  afterVal: string;
  humanDescription: string;
} {
  const beforeVal = oldPos ? (SHIFT_NAMES[oldPos] || oldPos) : 'Posição Automática';
  const afterVal = newPos ? (SHIFT_NAMES[newPos] || newPos) : 'Posição Automática';

  return {
    changeType: 'ALTERACAO_POSTO',
    beforeVal,
    afterVal,
    humanDescription: `Posição tática alterada: ${beforeVal} ➔ ${afterVal}.`,
  };
}
