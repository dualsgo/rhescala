import { Employee, Holiday, JornadaSettings } from '../../../types';
import {
  DEFAULT_JORNADA_SETTINGS,
  getStoreClosedDatesForYear,
  isEmployeeHiddenInMonth,
} from '../config/schedule-constants';
import { getLegalOverride } from '../clt/legal-overrides';
import { getShiftClassification } from '../shifts/shift-predicates';
import { isEmployeeCaixaEligible } from '../tactical/tactical-positions';

export interface DailyAvailability {
  dateStr: string;
  isClosedLF: boolean;
  availablePool: Employee[];
  totalAvailable: number;
  byTurno: {
    Abertura: Employee[];
    Fechamento: Employee[];
  };
  caixaEligibleByTurno: {
    Abertura: Employee[];
    Fechamento: Employee[];
  };
}

/**
 * Calcula o POOL ATIVO real de colaboradores disponíveis em uma data YYYY-MM-DD.
 * Exclui colaboradores inativos, ocultos no mês, Jovens Aprendizes e aqueles sob
 * bloqueio legal imutável na data (FE = Férias, AT = Atestado, N/A = fora de vigência, LF = Loja Fechada).
 * Nota: Aniversário (DO) é considerado descanso obrigatório, portanto também sai do pool disponível para trabalho.
 */
export function getDailyAvailability(
  employees: Employee[],
  dateISO: string,
  customHolidays: Holiday[] = [],
  deletedNationalHolidays: string[] = [],
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): DailyAvailability {
  const year = parseInt(dateISO.slice(0, 4), 10);
  const monthKey = dateISO.slice(0, 7);
  const storeClosedDates = getStoreClosedDatesForYear(year, customHolidays, deletedNationalHolidays);
  const isClosedLF = storeClosedDates.has(dateISO);

  if (isClosedLF) {
    return {
      dateStr: dateISO,
      isClosedLF: true,
      availablePool: [],
      totalAvailable: 0,
      byTurno: { Abertura: [], Fechamento: [] },
      caixaEligibleByTurno: { Abertura: [], Fechamento: [] },
    };
  }

  const availablePool: Employee[] = [];
  const abertura: Employee[] = [];
  const fechamento: Employee[] = [];
  const caixaAbertura: Employee[] = [];
  const caixaFechamento: Employee[] = [];

  for (const emp of employees) {
    if (emp.status !== 'active' || emp.isYoungApprentice || isEmployeeHiddenInMonth(emp, monthKey)) {
      continue;
    }
    const legal = getLegalOverride(emp, dateISO);
    if (legal === 'FE' || legal === 'AT' || legal === 'N/A' || legal === 'DO') {
      continue;
    }

    availablePool.push(emp);
    const turno = getShiftClassification(emp.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';
    if (turno === 'Fechamento') {
      fechamento.push(emp);
      if (isEmployeeCaixaEligible(emp)) caixaFechamento.push(emp);
    } else {
      abertura.push(emp);
      if (isEmployeeCaixaEligible(emp)) caixaAbertura.push(emp);
    }
  }

  return {
    dateStr: dateISO,
    isClosedLF: false,
    availablePool,
    totalAvailable: availablePool.length,
    byTurno: { Abertura: abertura, Fechamento: fechamento },
    caixaEligibleByTurno: { Abertura: caixaAbertura, Fechamento: caixaFechamento },
  };
}
