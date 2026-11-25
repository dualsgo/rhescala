import { Employee } from '../../../types';

/**
 * Indica se o colaborador possui contrato Sazonal (temporário de alta temporada).
 */
export function isSeasonalEmployee(emp: Pick<Employee, 'contractType'> | null | undefined): boolean {
  return emp?.contractType === 'Sazonal';
}

/**
 * Ordena colaboradores do MAIS experiente para o MENOS experiente, de forma pura e determinística:
 * 1. CLT antes de Sazonal.
 * 2. Entre iguais, admissão (hiredAt) mais antiga primeiro (sem hiredAt = cadastro antigo, considerado mais experiente).
 * 3. Empate final: ordem original do cadastro.
 */
export function sortByExperienceDesc<T extends Pick<Employee, 'contractType' | 'hiredAt'>>(employees: T[]): T[] {
  return employees
    .map((emp, idx) => ({ emp, idx }))
    .sort((a, b) => {
      const sa = isSeasonalEmployee(a.emp) ? 1 : 0;
      const sb = isSeasonalEmployee(b.emp) ? 1 : 0;
      if (sa !== sb) return sa - sb;

      const ha = a.emp.hiredAt || '';
      const hb = b.emp.hiredAt || '';
      if (ha !== hb) {
        if (!ha) return -1;
        if (!hb) return 1;
        return ha < hb ? -1 : 1;
      }
      return a.idx - b.idx;
    })
    .map(item => item.emp);
}
