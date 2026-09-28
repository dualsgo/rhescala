import { Employee, ShiftType } from '../../../types';
import { isBirthday } from './clt-rules';

/**
 * Retorna o status de turno legal/obrigatório de um colaborador para uma data específica,
 * com prioridade inegociável:
 * 1. Férias vigentes ('FE')
 * 2. Atestado médico vigente ('AT')
 * 3. Day Off / Folga de Aniversário ('DO')
 * 4. Período fora do contrato de admissão/demissão ('N/A')
 * 
 * Retorna `null` caso o dia não possua nenhuma restrição legal mandatória.
 */
export function getLegalOverride(emp: Employee, dateStr: string): ShiftType | null {
    if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) return 'FE';
    if (emp.atestadoStart && emp.atestadoEnd && dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) return 'AT';
    if (isBirthday(emp, dateStr)) return 'DO';
    if ((emp.hiredAt && dateStr < emp.hiredAt) || (emp.firedAt && dateStr > emp.firedAt)) return 'N/A';
    return null;
}

/**
 * Sobrecarga conveniente para indexação baseada em (ano, mês 0-indexed, dia 0-indexed).
 */
export function getLegalOverrideForDay(emp: Employee, year: number, month: number, dayIdx: number): ShiftType | null {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
    return getLegalOverride(emp, dateStr);
}

/**
 * Determina se um código de turno representa um status legal ou protegido que não deve ser sobrescrito
 * por algoritmos de rotação de trabalho ou folga.
 */
export function isProtectedShift(shift: string | undefined): boolean {
    if (!shift) return false;
    return ['FE', 'AT', 'DO', 'N/A'].includes(shift);
}
