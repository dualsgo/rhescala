import {
  AllocationRelaxationItem,
  AllocationReport,
  DecisionReason,
  DisplacedPreferenceItem,
  Employee,
  Holiday,
  JornadaSettings,
  MonthGuidelines,
  ProtectedDaysConfig,
  ShiftType,
} from '../../../types';
import {
  SMART_ALLOCATOR_WEIGHTS,
  buildHolidaySet,
  getEffectiveJornadaOnDate,
  getStoreClosedDatesForYear,
  normalizeProtectedDaysDetails,
} from '../config/schedule-constants';
import { isEmployeeAffectedByEstoqueRule, resolveRulesConfig } from '../config/guidelines';
import { getDailyAvailability, DailyAvailability } from '../availability/daily-availability';
import { getLegalOverrideForDay } from '../clt/legal-overrides';
import { isEmployeePreferredDayOff } from '../clt/clt-rules';
import { getShiftClassification } from '../shifts/shift-predicates';
import { isEmployeeCaixaEligible } from '../tactical/tactical-positions';
import { isSeasonalEmployee, sortByExperienceDesc } from '../clt/experience';
import { getPrevMonthConsecutive } from '../clt/sunday-rotation';

export interface SmartAllocatorInput {
  employees: Employee[];
  activeRegular: Employee[];
  year: number;
  month: number;
  shiftsByEmp: Record<string, ShiftType[]>;
  decisionReasonsByEmp: Record<string, Record<number, DecisionReason>>;
  customHolidays: Holiday[];
  deletedNationalHolidays: string[];
  settings: JornadaSettings;
  guidelines: MonthGuidelines;
  protectedDays?: ProtectedDaysConfig | number[];
  pendingHolidayCredits?: Record<string, Array<{ id: string; holidayDate: string; holidayName: string }>>;
  prevStreaks: Map<string, number>;
  sundaysInMonth: number[];
  restSundaysByEmp: Map<string, Set<number>>;
  cutoffDayIdx?: number; // Reajuste incremental: dias < cutoffDayIdx são preservados
  lockedDaysByEmp?: Record<string, Set<number>>; // Dias preservados (snapshot/edições fixas)
}

function isShiftRestForSchedule(
  s: ShiftType | undefined,
  lfCountsAsRest: boolean
): boolean {
  if (!s) return false;
  if (s === 'LF') return lfCountsAsRest;
  return ['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s.startsWith('FF');
}

function isShiftRestForStreak(s: ShiftType | undefined): boolean {
  if (!s) return false;
  // LF (loja fechada) interrompe o trabalho físico consecutivo (colaborador não trabalhou no dia)
  return ['F', 'LF', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s.startsWith('FF');
}

function buildCalendarWeeks(year: number, month: number, daysInMonth: number): number[][] {
  const weeks: number[][] = [];
  let cur: number[] = [];
  for (let d = 0; d < daysInMonth; d++) {
    const dow = new Date(year, month, d + 1).getDay();
    if (dow === 1 && cur.length > 0) {
      weeks.push(cur);
      cur = [];
    }
    cur.push(d);
  }
  if (cur.length > 0) weeks.push(cur);
  return weeks;
}

function countPrevMonthWeekCarryoverRests(
  emp: Employee,
  year: number,
  month: number,
  firstDayDow: number,
  lfCountsAsRest: boolean
): number {
  // Segunda = 1 (0 dias anteriores na semana), Terça = 2 (1 dia anterior), ..., Domingo = 0 (6 dias anteriores)
  const prevDaysInSameWeek = firstDayDow === 0 ? 6 : firstDayDow - 1;
  if (prevDaysInSameWeek <= 0) return 0;

  const prevDate = new Date(year, month - 1, 1);
  const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prevShifts = emp.shifts?.[prevKey];
  if (!prevShifts || prevShifts.length === 0) return 0;

  const slice = prevShifts.slice(Math.max(0, prevShifts.length - prevDaysInSameWeek));
  return slice.filter(s => isShiftRestForSchedule(s, lfCountsAsRest)).length;
}

function validateHardConstraints(
  emp: Employee,
  shifts: ShiftType[],
  year: number,
  month: number,
  prevStreak: number,
  guidelines: MonthGuidelines,
  protectedDetails: Record<number, { maxFolgas: number; mandatoryEmployeeIds?: string[] }>,
  calendarWeeks: number[][],
  firstDayDow: number
): boolean {
  const daysInMonth = shifts.length;
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  let run = prevStreak;

  for (let d = 0; d < daysInMonth; d++) {
    const s = shifts[d];
    if (isShiftRestForStreak(s)) {
      run = 0;
    } else {
      run++;
      if (run > 6) return false; // Regra dura absoluta: nunca 7º dia consecutivo trabalhado
    }

    // Respeita colaboradores nominalmente obrigatórios em dias protegidos
    const detail = protectedDetails[d + 1];
    if (detail && s === 'F' && detail.mandatoryEmployeeIds?.includes(emp.id)) {
      return false;
    }
  }

  // Valida cota semanal 5x2 nas semanas-calendário (Segunda a Domingo)
  for (const week of calendarWeeks) {
    const fiveByTwoDays = week.filter(k => {
      const ds = `${monthKey}-${String(k + 1).padStart(2, '0')}`;
      return getEffectiveJornadaOnDate(emp, ds) === '5x2';
    }).length;

    if (week.length === 7 && fiveByTwoDays >= 4) {
      const targetRests = guidelines.fiveByTwoRestMode === 'strict' ? 2 : 1;
      const rests = week.filter(k => isShiftRestForSchedule(shifts[k], guidelines.lfCountsAsRest)).length;
      if (rests < targetRests) return false;
    } else if (week[0] === 0 && week.length < 7 && fiveByTwoDays === week.length) {
      // Semana inicial parcial: soma folgas já cumpridas no final do mês anterior na mesma semana Seg..Dom
      const carryRests = countPrevMonthWeekCarryoverRests(emp, year, month, firstDayDow, guidelines.lfCountsAsRest);
      const targetRests = guidelines.fiveByTwoRestMode === 'strict' ? 2 : 1;
      const rests = carryRests + week.filter(k => isShiftRestForSchedule(shifts[k], guidelines.lfCountsAsRest)).length;
      if (rests < targetRests) return false;
    } else if (week[week.length - 1] === daysInMonth - 1 && week.length >= 5 && fiveByTwoDays >= 4) {
      // Semana final parcial (sem o Domingo, que cai no mês seguinte): exige ao menos 1 folga nos 5..6 dias úteis/sábado
      const rests = week.filter(k => isShiftRestForSchedule(shifts[k], guidelines.lfCountsAsRest)).length;
      if (rests < 1) return false;
    }
  }

  return true;
}

/**
 * Motor V2 determinístico de alocação de folgas:
 * - Todos os dias abertos (exceto Domingo) possuem PISO prioritário de 70% e META de nivelamento de 80%
 *   sobre o pool ativo do dia (inclusive vésperas de pico como 18 e 19/12, feriados e picos).
 * - Apenas os Domingos possuem meta própria menor, regida pelas regras específicas de domingo
 *   (minSundayWorkers e máximo de 2 domingos consecutivos trabalhados).
 * - Dias de pico maximizam presença (80%–100%) somente até o limite em que nenhum outro dia não-domingo
 *   caia abaixo do piso de 70%.
 */
export function allocateSmartRestsV2(input: SmartAllocatorInput): AllocationReport {
  const {
    activeRegular,
    year,
    month,
    shiftsByEmp,
    decisionReasonsByEmp,
    customHolidays,
    deletedNationalHolidays,
    settings,
    guidelines,
    protectedDays,
    pendingHolidayCredits,
    prevStreaks,
    sundaysInMonth,
    restSundaysByEmp,
    cutoffDayIdx = 0,
    lockedDaysByEmp = {},
  } = input;

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayDow = new Date(year, month, 1).getDay();
  const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
  const storeClosedDates = getStoreClosedDatesForYear(year, customHolidays, deletedNationalHolidays);
  const protectedDetails = normalizeProtectedDaysDetails(protectedDays);
  const rules = resolveRulesConfig(settings);
  const calendarWeeks = buildCalendarWeeks(year, month, daysInMonth);

  // Domingos nunca entram como pico de 100% — seguem exclusivamente as regras de domingo
  const peakSet = new Set<number>(
    guidelines.peakDays
      .filter(d => d >= 1 && d <= daysInMonth && new Date(year, month, d).getDay() !== 0)
      .map(d => d - 1)
  );

  const relaxations: AllocationRelaxationItem[] = [];
  const displacedPreferences: DisplacedPreferenceItem[] = [];
  const capacityWarnings: string[] = [];

  // Prioridade de experiência: CLT (admissão mais antiga primeiro) escolhe folgas fora do pico antes dos Sazonais
  const prioritizeSeasonal = guidelines.prioritizeSeasonalRestOnPeaks !== false;
  const orderedRegular = prioritizeSeasonal ? sortByExperienceDesc(activeRegular) : activeRegular;
  const hasSeasonalInTeam = activeRegular.some(e => isSeasonalEmployee(e));
  // Domingos de pico (ex: 20/12): seguem regras de domingo, mas Sazonais folgam primeiro no rodízio
  const peakSundaySet = new Set<number>(
    guidelines.peakDays
      .filter(d => d >= 1 && d <= daysInMonth && new Date(year, month, d).getDay() === 0)
      .map(d => d - 1)
  );

  // 1. Pré-computa Pool Ativo diário (exclui FE, AT, DO, N/A, LF)
  const availabilityByDay: DailyAvailability[] = [];
  let fiveByTwoDayCount = 0;
  for (let d = 0; d < daysInMonth; d++) {
    const dateStr = `${monthKey}-${String(d + 1).padStart(2, '0')}`;
    availabilityByDay.push(
      getDailyAvailability(activeRegular, dateStr, customHolidays, deletedNationalHolidays, settings)
    );
    if (activeRegular.length > 0 && getEffectiveJornadaOnDate(activeRegular[0], dateStr) === '5x2') {
      fiveByTwoDayCount++;
    }
  }

  const theoreticalMaxPresence = fiveByTwoDayCount >= daysInMonth / 2 ? 5 / 7 : 6 / 7;
  if (fiveByTwoDayCount >= daysInMonth / 2) {
    capacityWarnings.push(
      peakSet.size > 0
        ? `Regime 5x2 possui presença média máxima de ${(500 / 7).toFixed(1)}% (5/7). O motor preserva o piso de ${Math.round(guidelines.coverageMinFloor * 100)}% em todos os dias úteis/sábados antes de concentrar presença nos picos.`
        : `Regime 5x2 possui presença média máxima de ${(500 / 7).toFixed(1)}% (5/7), mantendo piso de ${Math.round(guidelines.coverageMinFloor * 100)}% nos dias não-domingo.`
    );
  }

  for (let d = 0; d < daysInMonth; d++) {
    const dow = new Date(year, month, d + 1).getDay();
    if (dow === 0 && !availabilityByDay[d].isClosedLF && availabilityByDay[d].totalAvailable < guidelines.minSundayWorkers) {
      const dStr = availabilityByDay[d].dateStr;
      capacityWarnings.push(
        `Domingo ${dStr}: pool ativo (${availabilityByDay[d].totalAvailable}) menor que o mínimo operacional (${guidelines.minSundayWorkers}).`
      );
      relaxations.push({
        dateStr: dStr,
        rule: `Mínimo operacional de domingo (${guidelines.minSundayWorkers})`,
        reason: `Pool ativo disponível no dia é ${availabilityByDay[d].totalAvailable} colaboradores.`,
        alternative: `Ajustado automaticamente para ${availabilityByDay[d].totalAvailable} presentes no domingo.`,
      });
    }
  }

  const isLocked = (empId: string, d: number): boolean => {
    if (d < cutoffDayIdx) return true;
    return Boolean(lockedDaysByEmp[empId]?.has(d));
  };

  const isImmutable = (emp: Employee, d: number): boolean => {
    const dateStr = `${monthKey}-${String(d + 1).padStart(2, '0')}`;
    if (storeClosedDates.has(dateStr)) return true;
    if (getLegalOverrideForDay(emp, year, month, d)) return true;
    return isLocked(emp.id, d);
  };

  const getDayCoverage = (dayIdx: number, override?: { empId: string; shift: ShiftType }) => {
    const avail = availabilityByDay[dayIdx];
    if (!avail || avail.totalAvailable === 0) {
      return {
        totalWorking: 0,
        abWorking: 0,
        feWorking: 0,
        overallRatio: 1,
        aberturaRatio: 1,
        fechamentoRatio: 1,
        hasPool: false,
      };
    }
    let totalWorking = 0;
    let abWorking = 0;
    let feWorking = 0;

    for (const e of avail.availablePool) {
      const s = override && e.id === override.empId ? override.shift : shiftsByEmp[e.id]?.[dayIdx];
      if (s !== 'T') continue;
      totalWorking++;
      const turno = getShiftClassification(e.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';
      if (turno === 'Fechamento') feWorking++;
      else abWorking++;
    }

    const abTotal = avail.byTurno.Abertura.length;
    const feTotal = avail.byTurno.Fechamento.length;
    return {
      totalWorking,
      abWorking,
      feWorking,
      overallRatio: totalWorking / avail.totalAvailable,
      aberturaRatio: abTotal > 0 ? abWorking / abTotal : 1,
      fechamentoRatio: feTotal > 0 ? feWorking / feTotal : 1,
      hasPool: true,
    };
  };

  const getPrefDow = (emp: Employee): number | null => {
    if (isEmployeeAffectedByEstoqueRule(emp, rules, guidelines)) {
      return guidelines.estoqueFixedOffWeekday;
    }
    for (let dow = 0; dow <= 6; dow++) {
      if (isEmployeePreferredDayOff(emp, dow, false)) return dow;
    }
    return null;
  };

  /**
   * Pontua a colocação de uma folga 'F' para `emp` em `dayIdx`:
   * - Domingos: regidos apenas por `minSundayWorkers` (sem piso de 70%).
   * - Segunda a Sábado (inclusive vésperas de pico, feriados e picos):
   *   piso inegociável de 70% (`FLOOR_BREACH_PENALTY` domina `PEAK_REST_PENALTY`) e nivelamento em 80%.
   */
  const scoreRestPlacement = (emp: Employee, dayIdx: number, isPreferredDay: boolean = false): number => {
    if (dayIdx < cutoffDayIdx || dayIdx >= daysInMonth) return -Infinity;
    if (isImmutable(emp, dayIdx) || shiftsByEmp[emp.id][dayIdx] !== 'T') return -Infinity;

    const detail = protectedDetails[dayIdx + 1];
    if (detail?.mandatoryEmployeeIds?.includes(emp.id)) return -Infinity;

    const avail = availabilityByDay[dayIdx];
    if (!avail || avail.isClosedLF || avail.totalAvailable === 0) return -Infinity;

    const dow = new Date(year, month, dayIdx + 1).getDay();
    const covAfter = getDayCoverage(dayIdx, { empId: emp.id, shift: 'F' });
    const empTurno = getShiftClassification(emp.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';
    const turnoPool = avail.byTurno[empTurno].length;
    const turnoWorkingAfter = empTurno === 'Fechamento' ? covAfter.feWorking : covAfter.abWorking;
    const turnoRatioAfter = empTurno === 'Fechamento' ? covAfter.fechamentoRatio : covAfter.aberturaRatio;

    // Regra específica de Domingo: meta reduzida (minSundayWorkers), isenta do piso de 70%
    if (dow === 0) {
      const effectiveMinSun = Math.min(guidelines.minSundayWorkers, avail.totalAvailable);
      if (covAfter.totalWorking < effectiveMinSun) return -Infinity;

      let sunScore = 180 + (covAfter.totalWorking - effectiveMinSun) * 45;
      if (turnoPool >= 2 && turnoWorkingAfter === 0) sunScore -= 5000;
      if (isEmployeeCaixaEligible(emp)) {
        const totalCaixasAfter =
          avail.caixaEligibleByTurno.Abertura.filter(c => c.id !== emp.id && shiftsByEmp[c.id]?.[dayIdx] === 'T').length +
          avail.caixaEligibleByTurno.Fechamento.filter(c => c.id !== emp.id && shiftsByEmp[c.id]?.[dayIdx] === 'T').length;
        if (totalCaixasAfter === 0) sunScore -= SMART_ALLOCATOR_WEIGHTS.CAIXA_MISSING_PENALTY;
      }
      return sunScore;
    }

    // Regra Segunda a Sábado: PISO de 70% e META de 80% em TODOS os dias abertos
    let score = 0;

    // 1. Piso geral de 70% (prioridade máxima acima de picos!)
    if (avail.totalAvailable >= 2 && covAfter.overallRatio < guidelines.coverageMinFloor - 1e-9) {
      const deficit = guidelines.coverageMinFloor - covAfter.overallRatio;
      score -= SMART_ALLOCATOR_WEIGHTS.FLOOR_BREACH_PENALTY + deficit * 60000;
    }

    // 2. Piso por turno (Abertura / Fechamento)
    if (turnoPool >= 4 && turnoRatioAfter < guidelines.coverageMinFloor - 1e-9) {
      const tDeficit = guidelines.coverageMinFloor - turnoRatioAfter;
      score -= 8000 + tDeficit * 25000;
    } else if (turnoPool >= 2 && turnoWorkingAfter === 0) {
      score -= 18000;
    }

    // 3. Penalidade de dia de pico (menor que FLOOR_BREACH_PENALTY: nunca derruba dia 19 abaixo de 70%!)
    // Com prioridade de experiência ativa, Sazonais absorvem folgas inevitáveis do pico antes da equipe CLT.
    if (peakSet.has(dayIdx)) {
      if (prioritizeSeasonal && hasSeasonalInTeam) {
        score -= isSeasonalEmployee(emp)
          ? SMART_ALLOCATOR_WEIGHTS.PEAK_REST_PENALTY * 0.2
          : SMART_ALLOCATOR_WEIGHTS.PEAK_REST_PENALTY * 1.6;
      } else {
        score -= SMART_ALLOCATOR_WEIGHTS.PEAK_REST_PENALTY;
      }
    } else if (detail && typeof detail.maxFolgas === 'number') {
      const currentFolgas = avail.availablePool.filter(e => e.id === emp.id || shiftsByEmp[e.id]?.[dayIdx] === 'F').length;
      if (currentFolgas > detail.maxFolgas) {
        score -= SMART_ALLOCATOR_WEIGHTS.PEAK_REST_PENALTY;
      }
    }

    // 4. Nivelamento em direção à faixa 70%–80% nos dias normais:
    // Quanto mais acima de 80% o dia estiver, maior o incentivo para absorver a folga necessária
    if (!peakSet.has(dayIdx) && covAfter.overallRatio >= guidelines.coverageTargetCap) {
      score += (covAfter.overallRatio - guidelines.coverageTargetCap) * SMART_ALLOCATOR_WEIGHTS.TARGET_GAP_PENALTY * 4;
    }
    score += covAfter.overallRatio * 180 + turnoRatioAfter * 140;

    // 5. Preservação de Caixa no turno
    if (isEmployeeCaixaEligible(emp)) {
      const otherCaixas = avail.caixaEligibleByTurno[empTurno].filter(
        c => c.id !== emp.id && shiftsByEmp[c.id]?.[dayIdx] === 'T'
      ).length;
      if (otherCaixas === 0) score -= SMART_ALLOCATOR_WEIGHTS.CAIXA_MISSING_PENALTY;
    }

    // 6. Equidade em sábados e feriados
    const dStr = `${monthKey}-${String(dayIdx + 1).padStart(2, '0')}`;
    if (dow === 6 || holidaySet.has(dStr)) {
      const empSatHolidayOffs = shiftsByEmp[emp.id].filter((s, idx) => {
        if (!isShiftRestForSchedule(s, guidelines.lfCountsAsRest)) return false;
        const dw = new Date(year, month, idx + 1).getDay();
        const ds = `${monthKey}-${String(idx + 1).padStart(2, '0')}`;
        return dw === 6 || holidaySet.has(ds);
      }).length;
      score -= empSatHolidayOffs * SMART_ALLOCATOR_WEIGHTS.EQUITY_PENALTY;
    }

    if (isPreferredDay) {
      score += SMART_ALLOCATOR_WEIGHTS.PREFERENCE_BONUS;
    }

    return score;
  };

  // 2. Inicialização limpa: respeita imutáveis e aplica apenas rotação dominical nos domingos
  for (const emp of activeRegular) {
    const shifts = shiftsByEmp[emp.id];
    const reasons = decisionReasonsByEmp[emp.id];
    const restSundays = restSundaysByEmp.get(emp.id) || new Set<number>();

    for (let d = 0; d < daysInMonth; d++) {
      if (isImmutable(emp, d)) continue;
      const dow = new Date(year, month, d + 1).getDay();
      if (dow === 0) {
        const isEstoqueFixedSunday =
          isEmployeeAffectedByEstoqueRule(emp, rules, guidelines) &&
          guidelines.estoqueFixedOffWeekday === 0;
        if (restSundays.has(d) || isEstoqueFixedSunday) {
          shifts[d] = 'F';
          reasons[d] = 'SUNDAY_ROTATION_OFF';
        } else {
          shifts[d] = 'T';
          reasons[d] = 'REGULAR_WORK';
        }
        continue;
      }
      shifts[d] = 'T';
      reasons[d] = 'REGULAR_WORK';
    }
  }

  // 2A. Folga Preferencial (consciente do piso diário de 70% e diretrizes de pico)
  for (const week of calendarWeeks) {
    for (const emp of orderedRegular) {
      const shifts = shiftsByEmp[emp.id];
      const reasons = decisionReasonsByEmp[emp.id];
      const prefDow = getPrefDow(emp);
      if (prefDow === null || prefDow === 0) continue;

      const prefDayIdx = week.find(k => new Date(year, month, k + 1).getDay() === prefDow);
      if (prefDayIdx === undefined || prefDayIdx < cutoffDayIdx || isImmutable(emp, prefDayIdx)) continue;

      const dateStr = `${monthKey}-${String(prefDayIdx + 1).padStart(2, '0')}`;
      const is5x2 = getEffectiveJornadaOnDate(emp, dateStr) === '5x2';

      // Em 6x1: se já descansou na semana e trabalha no domingo desta semana, evita folga dupla
      if (!is5x2) {
        const sunInWeek = week.find(k => new Date(year, month, k + 1).getDay() === 0);
        const willWorkSun = sunInWeek !== undefined && !(restSundaysByEmp.get(emp.id)?.has(sunInWeek));
        const hasRestBefore = week
          .filter(k => k < prefDayIdx)
          .some(k => isShiftRestForSchedule(shifts[k], guidelines.lfCountsAsRest));
        if (willWorkSun && hasRestBefore) continue;
      }

      const prefCovAfter = getDayCoverage(prefDayIdx, { empId: emp.id, shift: 'F' });
      const availPref = availabilityByDay[prefDayIdx];
      const empTurno = getShiftClassification(emp.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';
      const turnoRatioAfter = empTurno === 'Fechamento' ? prefCovAfter.fechamentoRatio : prefCovAfter.aberturaRatio;
      const keepsFloorOnPref =
        (availPref.totalAvailable < 2 || prefCovAfter.overallRatio >= guidelines.coverageMinFloor - 1e-9) &&
        (availPref.byTurno[empTurno].length < 4 || turnoRatioAfter >= guidelines.coverageMinFloor - 1e-9);

      if (!peakSet.has(prefDayIdx) && keepsFloorOnPref && shifts[prefDayIdx] === 'T') {
        shifts[prefDayIdx] = 'F';
        reasons[prefDayIdx] = 'PREFERRED_DAY_OFF';
      } else {
        // Desloca dentro da mesma semana para o melhor dia que preserve o piso de 70% (ou domingo até minSundayWorkers)
        let bestAlt = -1;
        let bestAltScore = -Infinity;
        for (const k of week) {
          if (k === prefDayIdx && peakSet.has(prefDayIdx)) continue;
          const sc = scoreRestPlacement(emp, k, false);
          if (sc > bestAltScore) {
            bestAltScore = sc;
            bestAlt = k;
          }
        }
        if (bestAlt !== -1 && bestAlt !== prefDayIdx) {
          const isPeakDisplacement = peakSet.has(prefDayIdx);
          shifts[bestAlt] = 'F';
          reasons[bestAlt] = isPeakDisplacement ? 'PEAK_PREFERENCE_DISPLACED' : 'GUIDELINE_COVERAGE_REBALANCED';
          displacedPreferences.push({
            empId: emp.id,
            empName: emp.name,
            originalDate: dateStr,
            newDate: `${monthKey}-${String(bestAlt + 1).padStart(2, '0')}`,
            reason: isPeakDisplacement
              ? 'Folga preferencial deslocada por diretriz de pico mantendo piso de 70%'
              : `Folga preferencial redistribuída para preservar piso diário de ${Math.round(guidelines.coverageMinFloor * 100)}%`,
          });
        } else if (bestAlt === prefDayIdx && shifts[prefDayIdx] === 'T') {
          shifts[prefDayIdx] = 'F';
          reasons[prefDayIdx] = 'PREFERRED_DAY_OFF';
        }
      }
    }
  }

  // 2B. Aloca folgas variáveis do regime 5x2 por semana-calendário (Segunda a Domingo)
  // sempre guiado pelo scoreRestPlacement (piso de 70% em todos os dias exceto domingo + meta 80%)
  for (const week of calendarWeeks) {
    const isLeadingPartial = week[0] === 0 && week.length < 7;
    const isTrailingPartial = week[week.length - 1] === daysInMonth - 1 && week.length < 7;

    for (const emp of orderedRegular) {
      const fiveByTwoDays = week.filter(k =>
        getEffectiveJornadaOnDate(emp, `${monthKey}-${String(k + 1).padStart(2, '0')}`) === '5x2'
      ).length;
      if (fiveByTwoDays === 0) continue;

      let targetRests = 0;
      let carryRests = 0;

      if (week.length === 7 && fiveByTwoDays >= 4) {
        targetRests = guidelines.fiveByTwoRestMode === 'strict' ? 2 : 1;
      } else if (isLeadingPartial && fiveByTwoDays === week.length) {
        carryRests = countPrevMonthWeekCarryoverRests(emp, year, month, firstDayDow, guidelines.lfCountsAsRest);
        targetRests = guidelines.fiveByTwoRestMode === 'strict' ? 2 : 1;
      } else if (isTrailingPartial && week.length >= 4 && fiveByTwoDays >= 3) {
        // Semana final sem Domingo (que cairá no mês seguinte): garante 1 folga nos dias úteis/sábado,
        // e só aloca a 2ª antecipada se houver folga de cobertura >= meta de 80%
        targetRests = 1;
      } else {
        continue;
      }

      const shifts = shiftsByEmp[emp.id];
      const reasons = decisionReasonsByEmp[emp.id];
      let rests = carryRests + week.filter(k => isShiftRestForSchedule(shifts[k], guidelines.lfCountsAsRest)).length;

      while (rests < targetRests) {
        let bestDay = -1;
        let bestScore = -Infinity;
        for (const k of week) {
          const sc = scoreRestPlacement(emp, k, false);
          if (sc > bestScore) {
            bestScore = sc;
            bestDay = k;
          }
        }
        if (bestDay === -1) break;
        shifts[bestDay] = 'F';
        reasons[bestDay] = 'FIVE_BY_TWO_VARIABLE_OFF';
        rests++;
      }

      // Se for semana final de 6 dias (Seg..Sáb) em modo estrito, só antecipa a 2ª folga se mantiver >= 80%
      if (isTrailingPartial && week.length === 6 && guidelines.fiveByTwoRestMode === 'strict' && rests === 1) {
        let bestDay = -1;
        let bestScore = -Infinity;
        for (const k of week) {
          const covAfter = getDayCoverage(k, { empId: emp.id, shift: 'F' });
          if (covAfter.overallRatio < guidelines.coverageTargetCap - 1e-9) continue;
          const sc = scoreRestPlacement(emp, k, false);
          if (sc > bestScore) {
            bestScore = sc;
            bestDay = k;
          }
        }
        if (bestDay !== -1) {
          shifts[bestDay] = 'F';
          reasons[bestDay] = 'FIVE_BY_TWO_VARIABLE_OFF';
        }
      }
    }
  }

  // 2C. Guarda absoluta CLT: nunca 7º dia consecutivo trabalhado (escolhe o melhor dia por cobertura, sem empilhar no dia 19!)
  for (const emp of orderedRegular) {
    const shifts = shiftsByEmp[emp.id];
    const reasons = decisionReasonsByEmp[emp.id];
    let run = prevStreaks.get(emp.id) || 0;
    for (let d = 0; d < daysInMonth; d++) {
      if (isShiftRestForStreak(shifts[d])) {
        run = 0;
      } else {
        run++;
        if (run > 6) {
          let chosen = -1;
          let bestScore = -Infinity;
          const windowStart = Math.max(cutoffDayIdx, d - 5);
          for (let b = windowStart; b <= d; b++) {
            const sc = scoreRestPlacement(emp, b, false);
            if (sc > bestScore) {
              bestScore = sc;
              chosen = b;
            }
          }
          if (chosen === -1 && !isImmutable(emp, d)) {
            chosen = d;
          }
          if (chosen !== -1) {
            shifts[chosen] = 'F';
            reasons[chosen] = 'CLT_MAX_STREAK_GUARD';
            run = prevStreaks.get(emp.id) || 0;
            for (let k = 0; k <= d; k++) {
              run = isShiftRestForStreak(shifts[k]) ? 0 : run + 1;
            }
          }
        }
      }
    }
  }

  // 3A. Busca Local Multi-Pass: repara QUALQUER dia aberto não-domingo (inclusive dia 19, feriados e picos) abaixo do piso de 70%
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let d = cutoffDayIdx; d < daysInMonth; d++) {
      const dow = new Date(year, month, d + 1).getDay();
      const dateStr = `${monthKey}-${String(d + 1).padStart(2, '0')}`;
      if (dow === 0 || storeClosedDates.has(dateStr)) continue;

      const avail = availabilityByDay[d];
      const cov = getDayCoverage(d);
      if (!cov.hasPool) continue;

      const needFix =
        (avail.totalAvailable >= 2 && cov.overallRatio < guidelines.coverageMinFloor - 1e-9) ||
        (avail.byTurno.Abertura.length >= 4 && cov.aberturaRatio < guidelines.coverageMinFloor - 1e-9) ||
        (avail.byTurno.Fechamento.length >= 4 && cov.fechamentoRatio < guidelines.coverageMinFloor - 1e-9);

      if (!needFix) continue;

      // Candidatos de folga no dia `d` (folgas variáveis primeiro, preferencial por último)
      const resting = avail.availablePool
        .filter(e => shiftsByEmp[e.id]?.[d] === 'F' && !isImmutable(e, d) && decisionReasonsByEmp[e.id]?.[d] !== 'SUNDAY_ROTATION_OFF')
        .sort((a, b) => {
          const ra = decisionReasonsByEmp[a.id]?.[d] === 'PREFERRED_DAY_OFF' ? 1 : 0;
          const rb = decisionReasonsByEmp[b.id]?.[d] === 'PREFERRED_DAY_OFF' ? 1 : 0;
          return ra - rb;
        });

      for (const cand of resting) {
        const origReason = decisionReasonsByEmp[cand.id]?.[d];
        const shifts = shiftsByEmp[cand.id];

        // Tentativa 1: se a folga em `d` for excedente (colaborador já cumpre CLT <= 6 e cota semanal 5x2 sem ela), converte direto para 'T'
        const simRemove = [...shifts];
        simRemove[d] = 'T';
        if (
          validateHardConstraints(
            cand,
            simRemove,
            year,
            month,
            prevStreaks.get(cand.id) || 0,
            guidelines,
            protectedDetails,
            calendarWeeks,
            firstDayDow
          )
        ) {
          shifts[d] = 'T';
          decisionReasonsByEmp[cand.id][d] = 'REGULAR_WORK';
          changed = true;
        } else {
          // Tentativa 2: move a folga para outro dia `alt` que preserve >= 70% (ou domingo >= minSundayWorkers)
          let bestAlt = -1;
          let bestAltScore = -Infinity;

          for (const off of [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6]) {
            const alt = d + off;
            if (alt < cutoffDayIdx || alt >= daysInMonth) continue;
            const altStr = `${monthKey}-${String(alt + 1).padStart(2, '0')}`;
            if (storeClosedDates.has(altStr)) continue;
            if (shifts[alt] !== 'T' || isImmutable(cand, alt)) continue;

            const altDow = new Date(year, month, alt + 1).getDay();
            const altAvail = availabilityByDay[alt];
            const altCovAfter = getDayCoverage(alt, { empId: cand.id, shift: 'F' });
            const candTurno = getShiftClassification(cand.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';
            const altTurnoRatio = candTurno === 'Fechamento' ? altCovAfter.fechamentoRatio : altCovAfter.aberturaRatio;

            if (altDow === 0) {
              const minSun = Math.min(guidelines.minSundayWorkers, altAvail.totalAvailable);
              if (altCovAfter.totalWorking < minSun) continue;
            } else {
              // O destino não-domingo DEVE manter o piso de 70% (ou ao menos melhorar um colapso severo sem violar o piso)
              if (altAvail.totalAvailable >= 2 && altCovAfter.overallRatio < guidelines.coverageMinFloor - 1e-9) continue;
              if (altAvail.byTurno[candTurno].length >= 4 && altTurnoRatio < guidelines.coverageMinFloor - 1e-9) continue;
            }

            const simSwap = [...shifts];
            simSwap[d] = 'T';
            simSwap[alt] = 'F';
            if (
              !validateHardConstraints(
                cand,
                simSwap,
                year,
                month,
                prevStreaks.get(cand.id) || 0,
                guidelines,
                protectedDetails,
                calendarWeeks,
                firstDayDow
              )
            ) {
              continue;
            }

            const sc = scoreRestPlacement(cand, alt, false);
            if (sc > bestAltScore) {
              bestAltScore = sc;
              bestAlt = alt;
            }
          }

          if (bestAlt !== -1) {
            shifts[d] = 'T';
            shifts[bestAlt] = 'F';
            decisionReasonsByEmp[cand.id][d] = 'REGULAR_WORK';
            decisionReasonsByEmp[cand.id][bestAlt] = 'GUIDELINE_COVERAGE_REBALANCED';
            if (origReason === 'PREFERRED_DAY_OFF') {
              displacedPreferences.push({
                empId: cand.id,
                empName: cand.name,
                originalDate: dateStr,
                newDate: `${monthKey}-${String(bestAlt + 1).padStart(2, '0')}`,
                reason: `Folga preferencial movida para garantir piso de ${Math.round(guidelines.coverageMinFloor * 100)}%`,
              });
            }
            changed = true;
          }
        }

        const after = getDayCoverage(d);
        if (
          (avail.totalAvailable < 2 || after.overallRatio >= guidelines.coverageMinFloor - 1e-9) &&
          (avail.byTurno.Abertura.length < 4 || after.aberturaRatio >= guidelines.coverageMinFloor - 1e-9) &&
          (avail.byTurno.Fechamento.length < 4 || after.fechamentoRatio >= guidelines.coverageMinFloor - 1e-9)
        ) {
          break;
        }
      }
    }
    if (!changed) break;
  }

  // 3B. Nivelamento suave na faixa 70%–80% em dias normais (move folgas variáveis de dias apertados ~70% para dias folgados >85%)
  for (const week of calendarWeeks) {
    const normalDays = week.filter(d => {
      if (d < cutoffDayIdx) return false;
      const dow = new Date(year, month, d + 1).getDay();
      const dStr = `${monthKey}-${String(d + 1).padStart(2, '0')}`;
      return dow !== 0 && !peakSet.has(d) && !storeClosedDates.has(dStr);
    });
    if (normalDays.length < 2) continue;

    for (const dLow of normalDays) {
      const lowCov = getDayCoverage(dLow);
      if (!lowCov.hasPool || lowCov.overallRatio >= guidelines.coverageTargetCap - 0.04) continue;

      const varResting = availabilityByDay[dLow].availablePool.filter(
        e =>
          shiftsByEmp[e.id]?.[dLow] === 'F' &&
          !isImmutable(e, dLow) &&
          decisionReasonsByEmp[e.id]?.[dLow] !== 'PREFERRED_DAY_OFF' &&
          decisionReasonsByEmp[e.id]?.[dLow] !== 'SUNDAY_ROTATION_OFF'
      );

      for (const cand of varResting) {
        const shifts = shiftsByEmp[cand.id];
        let bestHigh = -1;
        let bestHighRatio = -Infinity;

        for (const dHigh of normalDays) {
          if (dHigh === dLow || shifts[dHigh] !== 'T' || isImmutable(cand, dHigh)) continue;
          const highBefore = getDayCoverage(dHigh);
          if (highBefore.overallRatio <= guidelines.coverageTargetCap + 0.05) continue;

          const highAfter = getDayCoverage(dHigh, { empId: cand.id, shift: 'F' });
          const candTurno = getShiftClassification(cand.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';
          const highTurnoAfter = candTurno === 'Fechamento' ? highAfter.fechamentoRatio : highAfter.aberturaRatio;
          if (highAfter.overallRatio < guidelines.coverageMinFloor - 1e-9) continue;
          if (availabilityByDay[dHigh].byTurno[candTurno].length >= 4 && highTurnoAfter < guidelines.coverageMinFloor - 1e-9) continue;
          if (highAfter.overallRatio <= lowCov.overallRatio + 0.05) continue;

          const sim = [...shifts];
          sim[dLow] = 'T';
          sim[dHigh] = 'F';
          if (
            !validateHardConstraints(
              cand,
              sim,
              year,
              month,
              prevStreaks.get(cand.id) || 0,
              guidelines,
              protectedDetails,
              calendarWeeks,
              firstDayDow
            )
          ) {
            continue;
          }

          if (highAfter.overallRatio > bestHighRatio) {
            bestHighRatio = highAfter.overallRatio;
            bestHigh = dHigh;
          }
        }

        if (bestHigh !== -1) {
          shifts[dLow] = 'T';
          shifts[bestHigh] = 'F';
          decisionReasonsByEmp[cand.id][dLow] = 'REGULAR_WORK';
          decisionReasonsByEmp[cand.id][bestHigh] = 'GUIDELINE_COVERAGE_REBALANCED';
          break;
        }
      }
    }
  }

  // 3C. Prioridade de experiência em dias de pico (inclui domingos de pico):
  // troca em pares CLT ↔ Sazonal. O CLT trabalha no pico e assume a folga que o Sazonal tinha em um dia
  // fora do pico; o Sazonal folga no pico. O total de presentes em cada dia não muda (piso de 70% e
  // minSundayWorkers preservados) e ambos continuam válidos em CLT (≤ 6 dias), cota 5x2 e máx. de domingos seguidos.
  if (prioritizeSeasonal && hasSeasonalInTeam && (peakSet.size > 0 || peakSundaySet.size > 0)) {
    const prevSundayConsec = getPrevMonthConsecutive(activeRegular, year, month);
    const maxConsecSundays = typeof rules.maxConsecutiveSundays === 'number' ? rules.maxConsecutiveSundays : 2;
    const isAnyPeak = (k: number) => peakSet.has(k) || peakSundaySet.has(k);

    const sundayStreakOk = (empId: string, shifts: ShiftType[]): boolean => {
      let consec = prevSundayConsec.get(empId) || 0;
      for (const s of sundaysInMonth) {
        if (isShiftRestForStreak(shifts[s])) {
          consec = 0;
        } else {
          consec++;
          if (consec > maxConsecSundays) return false;
        }
      }
      return true;
    };

    const turnoFloorOk = (dayIdx: number): boolean => {
      const avail = availabilityByDay[dayIdx];
      if (new Date(year, month, dayIdx + 1).getDay() === 0) return true;
      const cov = getDayCoverage(dayIdx);
      if (avail.byTurno.Abertura.length >= 4 && cov.aberturaRatio < guidelines.coverageMinFloor - 1e-9) return false;
      if (avail.byTurno.Fechamento.length >= 4 && cov.fechamentoRatio < guidelines.coverageMinFloor - 1e-9) return false;
      return true;
    };

    const peakDaysOrdered = Array.from(new Set([...peakSet, ...peakSundaySet]))
      .filter(k => k >= cutoffDayIdx)
      .sort((a, b) => a - b);
    // Sazonais menos experientes (admissão mais recente) absorvem a folga de pico primeiro
    const seasonalLeastExperiencedFirst = orderedRegular.filter(e => isSeasonalEmployee(e)).reverse();
    const cltMostExperiencedFirst = orderedRegular.filter(e => !isSeasonalEmployee(e));

    for (const d of peakDaysOrdered) {
      const isSundayPeak = peakSundaySet.has(d);
      for (const clt of cltMostExperiencedFirst) {
        const cltShifts = shiftsByEmp[clt.id];
        if (cltShifts[d] !== 'F' || isImmutable(clt, d)) continue;

        let swapped = false;
        for (const saz of seasonalLeastExperiencedFirst) {
          const sazShifts = shiftsByEmp[saz.id];
          if (sazShifts[d] !== 'T' || isImmutable(saz, d)) continue;
          if (protectedDetails[d + 1]?.mandatoryEmployeeIds?.includes(saz.id)) continue;

          // Dia "e" fora do pico: Sazonal folga, CLT trabalha → trocam (mais próximo de d primeiro)
          const candidates: number[] = [];
          for (let e = cutoffDayIdx; e < daysInMonth; e++) {
            if (e === d || isAnyPeak(e)) continue;
            if (sazShifts[e] !== 'F' || isImmutable(saz, e)) continue;
            if (cltShifts[e] !== 'T' || isImmutable(clt, e)) continue;
            if (protectedDetails[e + 1]?.mandatoryEmployeeIds?.includes(clt.id)) continue;
            candidates.push(e);
          }
          candidates.sort((a, b) => Math.abs(a - d) - Math.abs(b - d) || a - b);

          for (const e of candidates) {
            const simClt = [...cltShifts];
            simClt[d] = 'T';
            simClt[e] = 'F';
            const simSaz = [...sazShifts];
            simSaz[d] = 'F';
            simSaz[e] = 'T';

            if (
              !validateHardConstraints(clt, simClt, year, month, prevStreaks.get(clt.id) || 0, guidelines, protectedDetails, calendarWeeks, firstDayDow) ||
              !validateHardConstraints(saz, simSaz, year, month, prevStreaks.get(saz.id) || 0, guidelines, protectedDetails, calendarWeeks, firstDayDow) ||
              !sundayStreakOk(clt.id, simClt) ||
              !sundayStreakOk(saz.id, simSaz)
            ) {
              continue;
            }

            // Aplica e confirma pisos por turno (Abertura/Fechamento) em d e e; reverte se violar
            shiftsByEmp[clt.id] = simClt;
            shiftsByEmp[saz.id] = simSaz;
            if (!turnoFloorOk(d) || !turnoFloorOk(e)) {
              shiftsByEmp[clt.id] = cltShifts;
              shiftsByEmp[saz.id] = sazShifts;
              continue;
            }

            // Mantém a mesma referência de array usada pelo chamador (month-generator / refresh)
            for (let k = 0; k < daysInMonth; k++) {
              cltShifts[k] = simClt[k];
              sazShifts[k] = simSaz[k];
            }
            shiftsByEmp[clt.id] = cltShifts;
            shiftsByEmp[saz.id] = sazShifts;

            const cltReasons = decisionReasonsByEmp[clt.id];
            const sazReasons = decisionReasonsByEmp[saz.id];
            const sazReasonAtE = sazReasons[e];
            cltReasons[d] = 'REGULAR_WORK';
            cltReasons[e] = sazReasonAtE === 'SUNDAY_ROTATION_OFF' ? 'SUNDAY_ROTATION_OFF' : 'PEAK_DAY_SHIFTED';
            sazReasons[d] = isSundayPeak ? 'SUNDAY_ROTATION_OFF' : 'PEAK_DAY_SHIFTED';
            sazReasons[e] = 'REGULAR_WORK';
            swapped = true;
            break;
          }
          if (swapped) break;
        }
      }
    }
  }

  // Registra eventuais relaxamentos residuais de cobertura em qualquer dia aberto não-domingo
  for (let d = cutoffDayIdx; d < daysInMonth; d++) {
    const dow = new Date(year, month, d + 1).getDay();
    const dateStr = `${monthKey}-${String(d + 1).padStart(2, '0')}`;
    if (dow === 0 || storeClosedDates.has(dateStr)) continue;

    const finalCov = getDayCoverage(d);
    if (availabilityByDay[d].totalAvailable >= 4 && finalCov.overallRatio < guidelines.coverageMinFloor - 1e-9) {
      relaxations.push({
        dateStr,
        rule: `Piso de cobertura (${Math.round(guidelines.coverageMinFloor * 100)}%)`,
        reason: `Atingiu ${Math.round(finalCov.overallRatio * 100)}% (${finalCov.totalWorking}/${availabilityByDay[d].totalAvailable} disponíveis) por arredondamento discreto do pool ou restrições CLT/5x2.`,
        alternative: 'Manter cobertura máxima sem violar descanso obrigatório ou ajustar diretriz para modo flexível.',
      });
    }
  }

  // 4. Créditos de Feriado Pendentes (FF) quando habilitado (respeitando piso de 70%)
  if (guidelines.allocatePendingHolidayCredits && pendingHolidayCredits) {
    for (const emp of activeRegular) {
      const credits = pendingHolidayCredits[emp.id];
      if (!credits || credits.length === 0) continue;
      const empTurno = getShiftClassification(emp.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';

      for (const credit of credits) {
        let bestDay = -1;
        let bestScore = -Infinity;
        for (let d = cutoffDayIdx; d < daysInMonth; d++) {
          const dow = new Date(year, month, d + 1).getDay();
          const dStr = `${monthKey}-${String(d + 1).padStart(2, '0')}`;
          if (dow === 0 || dow === 6) continue;
          if (peakSet.has(d) || holidaySet.has(dStr) || storeClosedDates.has(dStr) || isImmutable(emp, d)) continue;
          if (shiftsByEmp[emp.id][d] !== 'T') continue;

          const afterCov = getDayCoverage(d, { empId: emp.id, shift: 'FF' });
          const turnoRatioAfter = empTurno === 'Fechamento' ? afterCov.fechamentoRatio : afterCov.aberturaRatio;
          if (availabilityByDay[d].totalAvailable >= 2 && afterCov.overallRatio < guidelines.coverageMinFloor - 1e-9) continue;
          if (availabilityByDay[d].byTurno[empTurno].length >= 4 && turnoRatioAfter < guidelines.coverageMinFloor - 1e-9) continue;

          if (isEmployeeCaixaEligible(emp)) {
            const otherCaixas = availabilityByDay[d].caixaEligibleByTurno[empTurno].filter(
              c => c.id !== emp.id && shiftsByEmp[c.id]?.[d] === 'T'
            ).length;
            if (otherCaixas === 0) continue;
          }

          const sc = turnoRatioAfter * 3 + afterCov.overallRatio;
          if (sc > bestScore) {
            bestScore = sc;
            bestDay = d;
          }
        }

        if (bestDay !== -1) {
          shiftsByEmp[emp.id][bestDay] = `FF ${credit.id || credit.holidayDate}` as ShiftType;
          decisionReasonsByEmp[emp.id][bestDay] = 'PREFERRED_DAY_OFF';
        } else {
          relaxations.push({
            dateStr: monthKey,
            rule: `Alocação de FF (${emp.name})`,
            reason: `Crédito de ${credit.holidayName} (${credit.holidayDate}) adiado para preservar piso de ${Math.round(guidelines.coverageMinFloor * 100)}% e Caixa.`,
            alternative: 'Alocar manualmente em dia de menor demanda ou adiar para o próximo mês.',
          });
        }
      }
    }
  }

  // Resumo das folgas em dias de pico por tipo de contrato
  let peakRestSummary: { clt: number; sazonal: number } | undefined;
  if (peakSet.size > 0 || peakSundaySet.size > 0) {
    let cltRests = 0;
    let sazRests = 0;
    for (const k of Array.from(new Set([...peakSet, ...peakSundaySet]))) {
      if (k < cutoffDayIdx) continue;
      for (const emp of activeRegular) {
        if (shiftsByEmp[emp.id]?.[k] !== 'F') continue;
        if (isSeasonalEmployee(emp)) sazRests++;
        else cltRests++;
      }
    }
    peakRestSummary = { clt: cltRests, sazonal: sazRests };
    if (prioritizeSeasonal && cltRests > 0) {
      capacityWarnings.push(
        hasSeasonalInTeam
          ? `${cltRests} folga(s) de colaboradores CLT permaneceram em dias de pico: não havia Sazonal disponível para troca sem violar CLT (≤ 6 dias), 5x2, domingos seguidos ou piso de ${Math.round(guidelines.coverageMinFloor * 100)}%.`
          : `${cltRests} folga(s) em dias de pico recaíram sobre a equipe CLT porque não há colaboradores Sazonais ativos neste mês.`
      );
    }
  }

  return {
    monthKey,
    relaxations,
    displacedPreferences,
    capacityWarnings,
    theoreticalMaxPresence,
    peakRestSummary,
  };
}
