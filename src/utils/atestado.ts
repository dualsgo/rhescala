import { AtestadoRecord, Employee, ShiftType } from '../../types';
import { addDaysToISODate } from './date';

type AtestadoLikeEmp = Pick<Employee, 'atestadoStart' | 'atestadoEnd' | 'atestados'>;

/**
 * Retorna a lista normalizada de atestados do colaborador (ordenada por data de início),
 * preservando compatibilidade com os campos legados `atestadoStart` / `atestadoEnd`.
 */
export function getEmployeeAtestados(emp: AtestadoLikeEmp | undefined | null): AtestadoRecord[] {
  if (!emp) return [];
  const list: AtestadoRecord[] = Array.isArray(emp.atestados)
    ? emp.atestados.filter(a => Boolean(a && a.start && a.end)).map(a => ({ ...a }))
    : [];

  if (emp.atestadoStart && emp.atestadoEnd) {
    const alreadyPresent = list.some(
      a => a.start === emp.atestadoStart && a.end === emp.atestadoEnd
    );
    if (!alreadyPresent) {
      list.push({
        id: `legacy-${emp.atestadoStart}-${emp.atestadoEnd}`,
        start: emp.atestadoStart,
        end: emp.atestadoEnd,
      });
    }
  }

  return list.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

/**
 * Retorna o registro de atestado que cobre a data informada (YYYY-MM-DD), ou `null`.
 */
export function getAtestadoOnDate(
  emp: AtestadoLikeEmp | undefined | null,
  dateStr: string
): AtestadoRecord | null {
  if (!emp || !dateStr) return null;
  const list = getEmployeeAtestados(emp);
  for (const a of list) {
    if (dateStr >= a.start && dateStr <= a.end) {
      return a;
    }
  }
  return null;
}

/**
 * Indica se o colaborador está em período de atestado médico na data informada (YYYY-MM-DD).
 */
export function isEmployeeOnAtestado(
  emp: AtestadoLikeEmp | undefined | null,
  dateStr: string
): boolean {
  return getAtestadoOnDate(emp, dateStr) !== null;
}

/**
 * Calcula a duração em dias corridos (inclusiva) de um atestado.
 */
export function getAtestadoDurationDays(record: Pick<AtestadoRecord, 'start' | 'end'>): number {
  const s = new Date(`${record.start}T00:00:00`).getTime();
  const e = new Date(`${record.end}T00:00:00`).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

/**
 * Adiciona um novo atestado ao colaborador MANTENDO todos os atestados já lançados anteriormente.
 * Atualiza os turnos `AT` apenas no período do novo atestado sem apagar os dias de atestados prévios.
 */
export function buildAddAtestadoUpdate(
  emp: Employee,
  startDate: string,
  durationDays: number
): Partial<Employee> {
  const endDate = addDaysToISODate(startDate, Math.max(1, durationDays) - 1);
  const existing = getEmployeeAtestados(emp);

  const duplicate = existing.find(a => a.start === startDate && a.end === endDate);
  const nextList: AtestadoRecord[] = duplicate
    ? existing
    : [
        ...existing,
        {
          id: `at-${startDate}-${endDate}-${Date.now().toString(36)}`,
          start: startDate,
          end: endDate,
        },
      ].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

  const newShifts: Record<string, ShiftType[]> = { ...(emp.shifts || {}) };
  const startObj = new Date(`${startDate}T00:00:00`);
  const endObj = new Date(`${endDate}T00:00:00`);
  const current = new Date(startObj.getFullYear(), startObj.getMonth(), 1);

  while (current <= endObj) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    const shifts = [...(newShifts[monthKey] || [])];
    if (shifts.length === 0) {
      for (let i = 0; i < daysInMonth; i++) shifts[i] = 'T';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${monthKey}-${String(d).padStart(2, '0')}`;
      if (dStr >= startDate && dStr <= endDate) {
        shifts[d - 1] = 'AT';
      }
    }
    newShifts[monthKey] = shifts;
    current.setMonth(current.getMonth() + 1);
  }

  const latest = nextList[nextList.length - 1];
  return {
    atestados: nextList,
    atestadoStart: latest?.start || '',
    atestadoEnd: latest?.end || '',
    shifts: newShifts,
  };
}

/**
 * Remove um atestado específico mantendo os demais intactos.
 * Só reverte `AT` -> `T` nos dias que não pertencem a nenhum outro atestado restante.
 */
export function buildRemoveAtestadoUpdate(emp: Employee, atestadoId: string): Partial<Employee> {
  const currentList = getEmployeeAtestados(emp);
  const removed = currentList.find(a => a.id === atestadoId);
  const nextList = currentList.filter(a => a.id !== atestadoId);

  const newShifts: Record<string, ShiftType[]> = { ...(emp.shifts || {}) };
  let shiftsChanged = false;

  if (removed) {
    const startObj = new Date(`${removed.start}T00:00:00`);
    const endObj = new Date(`${removed.end}T00:00:00`);
    const current = new Date(startObj.getFullYear(), startObj.getMonth(), 1);

    while (current <= endObj) {
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      const existingArr = newShifts[monthKey];
      if (Array.isArray(existingArr)) {
        const shifts = [...existingArr];
        const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          const dStr = `${monthKey}-${String(d).padStart(2, '0')}`;
          const stillCovered = nextList.some(a => dStr >= a.start && dStr <= a.end);
          if (dStr >= removed.start && dStr <= removed.end && !stillCovered && shifts[d - 1] === 'AT') {
            shifts[d - 1] = 'T';
            shiftsChanged = true;
          }
        }
        newShifts[monthKey] = shifts;
      }
      current.setMonth(current.getMonth() + 1);
    }
  }

  const latest = nextList[nextList.length - 1];
  const updates: Partial<Employee> = {
    atestados: nextList,
    atestadoStart: latest?.start || '',
    atestadoEnd: latest?.end || '',
  };
  if (shiftsChanged) updates.shifts = newShifts;
  return updates;
}

/**
 * Limpa todos os atestados do colaborador e reverte `AT` -> `T`.
 */
export function buildClearAllAtestadosUpdate(emp: Employee): Partial<Employee> {
  const newShifts: Record<string, ShiftType[]> = { ...(emp.shifts || {}) };
  let hasChanges = false;
  for (const [mKey, shiftArr] of Object.entries(newShifts)) {
    if (Array.isArray(shiftArr) && shiftArr.includes('AT')) {
      newShifts[mKey] = shiftArr.map(s => (s === 'AT' ? 'T' : s));
      hasChanges = true;
    }
  }
  const updates: Partial<Employee> = {
    atestados: [],
    atestadoStart: '',
    atestadoEnd: '',
  };
  if (hasChanges) updates.shifts = newShifts;
  return updates;
}
