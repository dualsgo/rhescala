import {
  Employee,
  EmployeeRole,
  ShiftType,
  Holiday,
  JornadaSettings,
  MonthYear,
  normalizeEmployeeRole
} from '../../../types';
import { DEFAULT_JORNADA_SETTINGS } from '../config/schedule-constants';
import { getShiftClassification, isWorkingShift } from '../shifts/shift-predicates';
export { getShiftClassification };

interface CumulativeRoleCounts {
  caixa: Record<string, number>;
  pacote: Record<string, number>;
}

/**
 * Verifica se o colaborador possui aptidão primária, secundária ou legada para Caixa.
 */
export function isEmployeeCaixaEligible(emp: Employee): boolean {
  if (emp.primaryRole === 'Caixa' || emp.cargo === 'Caixa' || emp.role === 'Caixa') return true;
  if (emp.secondaryRole === 'Caixa') return true;
  if (emp.preferredPosition1 === 'P1' || emp.preferredPosition1 === 'CX' || emp.preferredPosition2 === 'P1' || emp.preferredPosition2 === 'CX') return true;
  return false;
}

/**
 * Verifica se o colaborador possui aptidão primária, secundária ou legada para Pacote.
 */
export function isEmployeePacoteEligible(emp: Employee): boolean {
  if (emp.primaryRole === 'Pacote' || emp.cargo === 'Pacote' || emp.role === 'Pacote') return true;
  if (emp.secondaryRole === 'Pacote') return true;
  if (emp.preferredPosition1 === 'PC' || emp.preferredPosition2 === 'PC') return true;
  return false;
}

/**
 * Verifica se o colaborador possui aptidão primária ou secundária para Vendas.
 */
export function isEmployeeVendasEligible(emp: Employee): boolean {
  if (emp.primaryRole === 'Vendas' || emp.cargo === 'Vendas' || emp.role === 'Vendas') return true;
  if (emp.secondaryRole === 'Vendas') return true;
  if (emp.preferredPosition1 === 'P3' || emp.preferredPosition1 === 'VEND' || emp.preferredPosition2 === 'P3' || emp.preferredPosition2 === 'VEND') return true;
  return false;
}

/**
 * Resolve e aloca de forma balanceada as funções da equipe presente em um determinado dia,
 * separando por coortes de turno (Abertura vs. Fechamento) e executando a cascata operacional:
 * 1. Especialistas Fixos (Estoque e Fiscal)
 * 2. Aprendizes em Apoio
 * 3. 1 Caixa obrigatório por turno com rodízio proporcional
 * 4. Pelo menos 2 Vendedores por turno
 * 5. Ativação de Pacote por excedente (N >= 4)
 * 6. Escalonamento de alta equipe (Vendas adicionais, Apoio ou 2º Caixa)
 */
export function resolveTacticalDay(
  activeEmps: Employee[],
  monthKey?: string,
  dayIdx?: number,
  _isHoliday?: boolean,
  isSunday?: boolean,
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
  cumulativeCounts?: CumulativeRoleCounts,
  isProtectedPeak?: boolean
): Record<string, EmployeeRole> {
  const result: Record<string, EmployeeRole> = {};
  if (!activeEmps || activeEmps.length === 0) return result;

  const counts: CumulativeRoleCounts = cumulativeCounts || {
    caixa: {},
    pacote: {}
  };

  // 1. Filtrar presentes em trabalho
  const workingEmps: Employee[] = [];
  for (const emp of activeEmps) {
    if (monthKey !== undefined && dayIdx !== undefined) {
      const shift = emp.shifts?.[monthKey]?.[dayIdx];
      if (!shift || !isWorkingShift(shift)) continue;
    }
    workingEmps.push(emp);
  }

  // 2. Segregação de Especialistas Fixos e Posições Manuais
  const poolEmps: Employee[] = [];
  for (const emp of workingEmps) {
    if (monthKey !== undefined && dayIdx !== undefined && emp.tacticalPositions?.[monthKey]?.[dayIdx]) {
      result[emp.id] = normalizeEmployeeRole(emp.tacticalPositions[monthKey][dayIdx]);
      continue;
    }

    const canonical = normalizeEmployeeRole(emp.primaryRole || emp.cargo || emp.role);

    if (canonical === 'Estoque') {
      result[emp.id] = 'Estoque';
      continue;
    }
    if (canonical === 'Fiscal') {
      result[emp.id] = 'Fiscal';
      continue;
    }
    if (emp.isYoungApprentice) {
      result[emp.id] = 'Apoio';
      continue;
    }

    poolEmps.push(emp);
  }

  if (poolEmps.length === 0) return result;

  // 3. Agrupamento por Turno
  const abertura: Employee[] = [];
  const fechamento: Employee[] = [];
  const intermediario: Employee[] = [];

  for (const emp of poolEmps) {
    let hourStr = emp.workPeriod || '';
    if (monthKey !== undefined && dayIdx !== undefined && emp.dailyHours?.[monthKey]?.[dayIdx]) {
      hourStr = emp.dailyHours[monthKey][dayIdx];
    }
    const classification = getShiftClassification(hourStr, isSunday, settings);
    if (classification === 'Abertura') {
      abertura.push(emp);
    } else if (classification === 'Fechamento') {
      fechamento.push(emp);
    } else {
      intermediario.push(emp);
    }
  }

  // Agrega intermediários ao turno com menor contingente de presentes
  for (const emp of intermediario) {
    if (abertura.length <= fechamento.length) {
      abertura.push(emp);
    } else {
      fechamento.push(emp);
    }
  }

  // 4. Execução da Cascata por Turno
  const allocateTurnoCohort = (cohort: Employee[]) => {
    if (cohort.length === 0) return;
    const N = cohort.length;
    const remaining = [...cohort];

    // Helper de eleição de candidato com pontuação
    const pickBest = (
      predicatePrimary: (e: Employee) => boolean,
      predicateSecondary: (e: Employee) => boolean,
      metricKey?: 'caixa' | 'pacote'
    ): Employee => {
      // 1ª prioridade: primária
      const primaryMatches = remaining.filter(predicatePrimary);
      // 2ª prioridade: secundária
      const secondaryMatches = remaining.filter(predicateSecondary);

      const poolToUse = primaryMatches.length > 0 ? primaryMatches : (secondaryMatches.length > 0 ? secondaryMatches : remaining);

      // Desempate por menor acúmulo na função no mês
      if (metricKey) {
        poolToUse.sort((a, b) => {
          const countA = counts[metricKey][a.id] || 0;
          const countB = counts[metricKey][b.id] || 0;
          if (countA !== countB) return countA - countB;
          return a.name.localeCompare(b.name);
        });
      }

      const chosen = poolToUse[0] || remaining[0];
      const idx = remaining.indexOf(chosen);
      if (idx !== -1) remaining.splice(idx, 1);
      return chosen;
    };

    // Passo A — Garantir 1 Caixa no Turno (N >= 1)
    const cashier = pickBest(
      e => (e.primaryRole || e.cargo || e.role) === 'Caixa',
      e => isEmployeeCaixaEligible(e),
      'caixa'
    );
    result[cashier.id] = 'Caixa';
    counts.caixa[cashier.id] = (counts.caixa[cashier.id] || 0) + 1;

    // Passo B — Garantir até 2 Vendedores no Turno (se N >= 2)
    const neededVendas = Math.min(2, remaining.length);
    for (let i = 0; i < neededVendas; i++) {
      const seller = pickBest(
        e => (e.primaryRole || e.cargo || e.role) === 'Vendas',
        e => isEmployeeVendasEligible(e)
      );
      result[seller.id] = 'Vendas';
    }

    if (remaining.length === 0) return;

    // Passo C — Ativar Pacote por Excedente (4ª vaga do turno: N >= 4)
    // Se ainda restar colaboradores e o turno total era >= 4, a 4ª vaga assume Pacote
    if (N >= 4 && remaining.length > 0) {
      const packer = pickBest(
        e => (e.primaryRole || e.cargo || e.role) === 'Pacote',
        e => isEmployeePacoteEligible(e),
        'pacote'
      );
      result[packer.id] = 'Pacote';
      counts.pacote[packer.id] = (counts.pacote[packer.id] || 0) + 1;
    }

    // Passo D — Escalonamento de Alta Equipe (vagas restantes)
    while (remaining.length > 0) {
      // Se for dia de pico protegido e houver candidato apto a 2º Caixa
      if (isProtectedPeak && remaining.some(isEmployeeCaixaEligible)) {
        const secondCashier = pickBest(
          e => (e.primaryRole || e.cargo || e.role) === 'Caixa',
          e => isEmployeeCaixaEligible(e),
          'caixa'
        );
        result[secondCashier.id] = 'Caixa';
        counts.caixa[secondCashier.id] = (counts.caixa[secondCashier.id] || 0) + 1;
        continue;
      }

      // Vendedor adicional ou Apoio
      const nextEmp = remaining.shift()!;
      const primary = normalizeEmployeeRole(nextEmp.primaryRole || nextEmp.cargo || nextEmp.role);
      const secondary = nextEmp.secondaryRole ? normalizeEmployeeRole(nextEmp.secondaryRole) : undefined;

      if (primary === 'Apoio' || secondary === 'Apoio') {
        result[nextEmp.id] = 'Apoio';
      } else {
        result[nextEmp.id] = 'Vendas';
      }
    }
  };

  allocateTurnoCohort(abertura);
  allocateTurnoCohort(fechamento);

  return result;
}

/**
 * Computa a matriz mensal completa de funções alocadas para todos os colaboradores.
 * Retorna: Record<empId, Record<dayIdx, EmployeeRole>>
 */
export function assignDailyRolesForMonth(
  employees: Employee[],
  year: number,
  month: number,
  isHolidayFn?: (dateStr: string) => boolean,
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
  protectedDays?: Record<number, number>
): Record<string, Record<number, EmployeeRole>> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const assignedRolesByEmp: Record<string, Record<number, EmployeeRole>> = {};

  for (const emp of employees) {
    assignedRolesByEmp[emp.id] = {};
  }

  const cumulativeCounts: CumulativeRoleCounts = {
    caixa: {},
    pacote: {}
  };

  for (let d = 0; d < daysInMonth; d++) {
    const dayNum = d + 1;
    const date = new Date(year, month, dayNum);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const isSunday = date.getDay() === 0;
    const isHoliday = isHolidayFn ? isHolidayFn(dateStr) : false;
    const isProtected = Boolean(protectedDays && protectedDays[dayNum] !== undefined);

    const dayRoles = resolveTacticalDay(
      employees,
      monthKey,
      d,
      isHoliday,
      isSunday,
      settings,
      cumulativeCounts,
      isProtected
    );

    for (const [empId, role] of Object.entries(dayRoles)) {
      if (assignedRolesByEmp[empId]) {
        assignedRolesByEmp[empId][d] = role;
      }
    }
  }

  return assignedRolesByEmp;
}

/**
 * DistributeTacticalPositions reativa e atualiza os colaboradores com a matriz diária de funções.
 */
export function distributeTacticalPositions(
  employees: Employee[],
  currentMY: MonthYear,
  customHolidays: Holiday[] = [],
  _deletedNationalHolidays: string[] = [],
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, { shifts: ShiftType[]; dailyAssignedRoles?: Record<number, EmployeeRole> }> {
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentMY.year, currentMY.month + 1, 0).getDate();
  const holidayDates = new Set(customHolidays.map(h => h.date));
  const isHolidayFn = (dStr: string) => holidayDates.has(dStr);

  const dailyRolesMatrix = assignDailyRolesForMonth(
    employees,
    currentMY.year,
    currentMY.month,
    isHolidayFn,
    settings
  );

  const result: Record<string, { shifts: ShiftType[]; dailyAssignedRoles?: Record<number, EmployeeRole> }> = {};
  employees.forEach(emp => {
    result[emp.id] = {
      shifts: emp.shifts[monthKey] ? [...emp.shifts[monthKey]] : Array(daysInMonth).fill('T'),
      dailyAssignedRoles: dailyRolesMatrix[emp.id] || {}
    };
  });
  return result;
}

/**
 * Retorna as posições atribuídas para exibição.
 */
export function applyTacticalOnly(
  employees: Employee[],
  year: number,
  month: number,
  customHolidays: Holiday[] = [],
  _deletedNationalHolidays: string[] = [],
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, (string | null)[]> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidayDates = new Set(customHolidays.map(h => h.date));
  const isHolidayFn = (dStr: string) => holidayDates.has(dStr);

  const matrix = assignDailyRolesForMonth(employees, year, month, isHolidayFn, settings);
  const result: Record<string, (string | null)[]> = {};

  employees.forEach(emp => {
    const roles: (string | null)[] = [];
    for (let d = 0; d < daysInMonth; d++) {
      roles.push(matrix[emp.id]?.[d] || normalizeEmployeeRole(emp.primaryRole || emp.cargo || emp.role));
    }
    result[emp.id] = roles;
  });
  return result;
}
