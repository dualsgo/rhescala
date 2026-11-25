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
  DEFAULT_JORNADA_SETTINGS,
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

function validateHardConstraints(
  emp: Employee,
  shifts: ShiftType[],
  year: number,
  month: number,
  prevStreak: number,
  guidelines: MonthGuidelines,
  protectedDetails: Record<number, { maxFolgas: number; mandatoryEmployeeIds?: string[] }>,
  allShiftsByEmp: Record<string, ShiftType[]>
): boolean {
  const daysInMonth = shifts.length;
  let run = prevStreak;

  for (let d = 0; d < daysInMonth; d++) {
    const s = shifts[d];
    if (isShiftRestForStreak(s)) {
      run = 0;
    } else {
      run++;
      if (run > 6) return false; // Regra dura absoluta: nunca 7º dia consecutivo trabalhado
    }

    // Verifica protectedDays
    const detail = protectedDetails[d + 1];
    if (detail) {
      if (s === 'F' && detail.mandatoryEmployeeIds?.includes(emp.id)) return false;
      if (s === 'F' && typeof detail.maxFolgas === 'number') {
        let countF = 0;
        for (const id of Object.keys(allShiftsByEmp)) {
          const code = id === emp.id ? s : allShiftsByEmp[id]?.[d];
          if (code === 'F') countF++;
        }
        if (countF > detail.maxFolgas) return false;
      }
    }
  }

  // Modo estrito 5x2: toda janela móvel de 7 dias em regime 5x2 exige >= 2 folgas
  if (guidelines.fiveByTwoRestMode === 'strict') {
    for (let start = 0; start <= daysInMonth - 7; start++) {
      const win = [start, start + 1, start + 2, start + 3, start + 4, start + 5, start + 6];
      const fiveByTwoDays = win.filter(k => {
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`;
        return getEffectiveJornadaOnDate(emp, ds) === '5x2';
      }).length;
      if (fiveByTwoDays < 7) continue;

      const restCount = win.filter(k => isShiftRestForSchedule(shifts[k], guidelines.lfCountsAsRest)).length;
      if (restCount < 2) return false;
    }
  }

  return true;
}

function getContinuousPeakBlocks(peakDays: number[], daysInMonth: number): Array<{ start: number; end: number }> {
  const valid = Array.from(new Set(peakDays.filter(d => d >= 1 && d <= daysInMonth))).sort((a, b) => a - b);
  const blocks: Array<{ start: number; end: number }> = [];
  for (const d of valid) {
    const idx = d - 1;
    if (blocks.length === 0 || idx > blocks[blocks.length - 1].end + 1) {
      blocks.push({ start: idx, end: idx });
    } else {
      blocks[blocks.length - 1].end = idx;
    }
  }
  return blocks;
}

/**
 * Motor V2 determinístico de alocação de folgas com disponibilidade diária real,
 * priorização de picos, folga preferencial, cobertura 70%–80%, FF e relatório de inviabilidade.
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
  const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
  const storeClosedDates = getStoreClosedDatesForYear(year, customHolidays, deletedNationalHolidays);
  const protectedDetails = normalizeProtectedDaysDetails(protectedDays);
  const rules = resolveRulesConfig(settings);

  const peakSet = new Set<number>(
    guidelines.peakDays.filter(d => d >= 1 && d <= daysInMonth).map(d => d - 1)
  );
  const peakBlocks = getContinuousPeakBlocks(guidelines.peakDays, daysInMonth);

  const relaxations: AllocationRelaxationItem[] = [];
  const displacedPreferences: DisplacedPreferenceItem[] = [];
  const capacityWarnings: string[] = [];

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
      peakBlocks.length > 0
        ? `Regime 5x2 possui presença média máxima de ${(500 / 7).toFixed(1)}% (5/7). Concentrar equipe nos dias de pico reduz a margem nos dias vizinhos.`
        : `Regime 5x2 possui presença média máxima de ${(500 / 7).toFixed(1)}% (5/7), com margem estreita para o piso de ${Math.round(guidelines.coverageMinFloor * 100)}%.`
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
      return { totalWorking: 0, overallRatio: 1, aberturaRatio: 1, fechamentoRatio: 1, hasPool: false };
    }
    let totalWorking = 0;
    let abWorking = 0;
    let feWorking = 0;

    for (const e of avail.availablePool) {
      const s = override && e.id === override.empId ? override.shift : shiftsByEmp[e.id]?.[dayIdx];
      const working = s === 'T';
      if (!working) continue;
      totalWorking++;
      const turno = getShiftClassification(e.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';
      if (turno === 'Fechamento') feWorking++;
      else abWorking++;
    }

    const abTotal = avail.byTurno.Abertura.length;
    const feTotal = avail.byTurno.Fechamento.length;
    return {
      totalWorking,
      overallRatio: totalWorking / avail.totalAvailable,
      aberturaRatio: abTotal > 0 ? abWorking / abTotal : 1,
      fechamentoRatio: feTotal > 0 ? feWorking / feTotal : 1,
      hasPool: true,
    };
  };

  // Helper para checar se colaborador tem folga preferencial naquele dow
  const getPrefDow = (emp: Employee): number | null => {
    if (isEmployeeAffectedByEstoqueRule(emp, rules, guidelines)) {
      return guidelines.estoqueFixedOffWeekday;
    }
    for (let dow = 0; dow <= 6; dow++) {
      if (isEmployeePreferredDayOff(emp, dow, false)) return dow;
    }
    return null;
  };

  // 2. Construção inicial respeitando Hierarquia: Duras + Picos -> Preferencial -> Variáveis
  // Primeiro reseta dias editáveis (>= cutoffDayIdx e não imutáveis e não domingos da rotação) para 'T'
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

  // 2A. Ancoragem de Picos: garante presença máxima nos blocos de pico e escalona folgas pré/pós-pico
  for (const block of peakBlocks) {
    activeRegular.forEach((emp, empIdx) => {
      const shifts = shiftsByEmp[emp.id];
      const reasons = decisionReasonsByEmp[emp.id];
      const preCandidate = empIdx % 2 === 0 ? block.start - 1 : block.start - 2;
      const postCandidate = empIdx % 2 === 0 ? block.end + 1 : block.end + 2;

      for (let p = block.start; p <= block.end; p++) {
        if (!isImmutable(emp, p) && shifts[p] === 'F' && reasons[p] !== 'SUNDAY_ROTATION_OFF') {
          shifts[p] = 'T';
          reasons[p] = 'REGULAR_WORK';
        }
      }

      if (preCandidate >= cutoffDayIdx && !isImmutable(emp, preCandidate) && !peakSet.has(preCandidate)) {
        const dow = new Date(year, month, preCandidate + 1).getDay();
        if (dow !== 0) {
          shifts[preCandidate] = 'F';
          reasons[preCandidate] = 'PEAK_DAY_SHIFTED';
        }
      }
      if (postCandidate < daysInMonth && postCandidate >= cutoffDayIdx && !isImmutable(emp, postCandidate) && !peakSet.has(postCandidate)) {
        const dow = new Date(year, month, postCandidate + 1).getDay();
        if (dow !== 0) {
          shifts[postCandidate] = 'F';
          reasons[postCandidate] = 'PEAK_DAY_SHIFTED';
        }
      }
    });
  }

  // 2B. Folga Preferencial fora dos picos (respeitando jornada e registrando deslocamento quando cair em pico)
  for (const emp of activeRegular) {
    const shifts = shiftsByEmp[emp.id];
    const reasons = decisionReasonsByEmp[emp.id];
    const prefDow = getPrefDow(emp);
    if (prefDow === null || prefDow === 0) continue; // Domingo já tratado na rotação dominical

    for (let d = cutoffDayIdx; d < daysInMonth; d++) {
      if (isImmutable(emp, d)) continue;
      const dow = new Date(year, month, d + 1).getDay();
      if (dow !== prefDow) continue;

      const dateStr = `${monthKey}-${String(d + 1).padStart(2, '0')}`;
      if (peakSet.has(d)) {
        // Desloca para dia fora do pico na mesma semana
        const alt = [-1, 1, -2, 2, -3, 3, -4, 4].map(off => d + off).find(k =>
          k >= cutoffDayIdx &&
          k < daysInMonth &&
          !peakSet.has(k) &&
          !isImmutable(emp, k) &&
          new Date(year, month, k + 1).getDay() !== 0 &&
          shifts[k] === 'T'
        );
        if (alt !== undefined) {
          shifts[alt] = 'F';
          reasons[alt] = 'PEAK_PREFERENCE_DISPLACED';
          displacedPreferences.push({
            empId: emp.id,
            empName: emp.name,
            originalDate: dateStr,
            newDate: `${monthKey}-${String(alt + 1).padStart(2, '0')}`,
            reason: 'Folga preferencial deslocada por diretriz de pico',
          });
        }
        continue;
      }

      // Em 6x1: se já descansou na semana (ex: pré-pico) e trabalha próximo domingo, evita 2ª folga na mesma semana
      const is5x2 = getEffectiveJornadaOnDate(emp, dateStr) === '5x2';
      if (!is5x2) {
        const nextSun = sundaysInMonth.find(s => s >= d);
        const willWorkNextSun = nextSun !== undefined && !(restSundaysByEmp.get(emp.id)?.has(nextSun));
        const weekStart = Math.max(0, d - ((dow + 6) % 7));
        const hasRestInWeek = shifts.slice(weekStart, d).some(s => isShiftRestForSchedule(s, guidelines.lfCountsAsRest));
        if (willWorkNextSun && hasRestInWeek) continue;
      }

      shifts[d] = 'F';
      reasons[d] = 'PREFERRED_DAY_OFF';
    }
  }

  // 2C. Preenche folgas variáveis restantes (5x2 em janela de 7 dias + guarda absoluta 7º dia CLT)
  const scoreVariableRestDay = (emp: Employee, dayIdx: number): number => {
    if (isImmutable(emp, dayIdx) || shiftsByEmp[emp.id][dayIdx] !== 'T') return -Infinity;
    const cov = getDayCoverage(dayIdx, { empId: emp.id, shift: 'F' });
    const empTurno = getShiftClassification(emp.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';
    const turnoRatio = empTurno === 'Fechamento' ? cov.fechamentoRatio : cov.aberturaRatio;

    let score = 0;
    if (peakSet.has(dayIdx)) score -= SMART_ALLOCATOR_WEIGHTS.PEAK_REST_PENALTY;
    if (cov.overallRatio < guidelines.coverageMinFloor || turnoRatio < guidelines.coverageMinFloor) {
      score -= SMART_ALLOCATOR_WEIGHTS.FLOOR_BREACH_PENALTY;
    }
    // Nivelamento em direção a 80%
    if (cov.overallRatio > guidelines.coverageTargetCap) {
      score += (cov.overallRatio - guidelines.coverageTargetCap) * SMART_ALLOCATOR_WEIGHTS.TARGET_GAP_PENALTY;
    }
    score += turnoRatio * 30 + cov.overallRatio * 10;

    // Presença de Caixa
    if (isEmployeeCaixaEligible(emp)) {
      const avail = availabilityByDay[dayIdx];
      const otherCaixas = avail.caixaEligibleByTurno[empTurno].filter(
        c => c.id !== emp.id && shiftsByEmp[c.id]?.[dayIdx] === 'T'
      ).length;
      if (otherCaixas === 0) score -= SMART_ALLOCATOR_WEIGHTS.CAIXA_MISSING_PENALTY;
    }

    // Equidade em sábado/feriado
    const dow = new Date(year, month, dayIdx + 1).getDay();
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

    return score;
  };

  // Garante 5x2 (modo estrito ou flexível)
  const calendarWeeks: number[][] = [];
  let curWeek: number[] = [];
  for (let d = 0; d < daysInMonth; d++) {
    const dow = new Date(year, month, d + 1).getDay();
    if (dow === 1 && curWeek.length > 0) {
      calendarWeeks.push(curWeek);
      curWeek = [];
    }
    curWeek.push(d);
  }
  if (curWeek.length > 0) calendarWeeks.push(curWeek);

  // Semanas-calendário com 5x2
  for (const week of calendarWeeks) {
    if (week.length < 5) continue;
    for (const emp of activeRegular) {
      const has5x2 = week.some(k => getEffectiveJornadaOnDate(emp, `${monthKey}-${String(k + 1).padStart(2, '0')}`) === '5x2');
      if (!has5x2) continue;

      const shifts = shiftsByEmp[emp.id];
      const reasons = decisionReasonsByEmp[emp.id];
      let rests = week.filter(k => isShiftRestForSchedule(shifts[k], guidelines.lfCountsAsRest)).length;
      const targetRests = guidelines.fiveByTwoRestMode === 'strict' ? 2 : 1;

      while (rests < targetRests) {
        let bestDay = -1;
        let bestScore = -Infinity;
        for (const k of week) {
          if (k < cutoffDayIdx) continue;
          const ds = `${monthKey}-${String(k + 1).padStart(2, '0')}`;
          if (getEffectiveJornadaOnDate(emp, ds) !== '5x2') continue;
          const sc = scoreVariableRestDay(emp, k);
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
    }
  }

  // Janelas móveis de 7 dias 100% 5x2 (modo estrito)
  if (guidelines.fiveByTwoRestMode === 'strict') {
    for (let start = 0; start <= daysInMonth - 7; start++) {
      const win = [start, start + 1, start + 2, start + 3, start + 4, start + 5, start + 6];
      for (const emp of activeRegular) {
        const all5x2 = win.every(k => getEffectiveJornadaOnDate(emp, `${monthKey}-${String(k + 1).padStart(2, '0')}`) === '5x2');
        if (!all5x2) continue;
        const shifts = shiftsByEmp[emp.id];
        const reasons = decisionReasonsByEmp[emp.id];
        let rests = win.filter(k => isShiftRestForSchedule(shifts[k], guidelines.lfCountsAsRest)).length;
        while (rests < 2) {
          let bestDay = -1;
          let bestScore = -Infinity;
          for (const k of win) {
            if (k < cutoffDayIdx) continue;
            const sc = scoreVariableRestDay(emp, k);
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
      }
    }
  }

  // Guarda absoluta CLT: nunca 7º dia consecutivo trabalhado
  for (const emp of activeRegular) {
    const shifts = shiftsByEmp[emp.id];
    const reasons = decisionReasonsByEmp[emp.id];
    let run = prevStreaks.get(emp.id) || 0;
    for (let d = 0; d < daysInMonth; d++) {
      if (isShiftRestForStreak(shifts[d])) {
        run = 0;
      } else {
        run++;
        if (run > 6) {
          // Tenta colocar folga no próprio dia d ou no melhor dia anterior dentro da sequência
          let chosen = !isImmutable(emp, d) && !peakSet.has(d) ? d : -1;
          if (chosen === -1) {
            for (let b = d; b >= Math.max(cutoffDayIdx, d - 5); b--) {
              if (!isImmutable(emp, b) && !peakSet.has(b) && shifts[b] === 'T') {
                chosen = b;
                break;
              }
            }
          }
          if (chosen === -1 && !isImmutable(emp, d)) chosen = d;
          if (chosen !== -1) {
            shifts[chosen] = 'F';
            reasons[chosen] = 'CLT_MAX_STREAK_GUARD';
            // Recalcula run a partir do início
            run = prevStreaks.get(emp.id) || 0;
            for (let k = 0; k <= d; k++) {
              run = isShiftRestForStreak(shifts[k]) ? 0 : run + 1;
            }
          }
        }
      }
    }
  }

  // 3. Busca Local: repara dias normais abaixo do piso de 70% movendo folgas VARIÁVEIS primeiro, e preferencial por último
  for (let d = cutoffDayIdx; d < daysInMonth; d++) {
    const dow = new Date(year, month, d + 1).getDay();
    const dateStr = `${monthKey}-${String(d + 1).padStart(2, '0')}`;
    if (dow === 0 || peakSet.has(d) || storeClosedDates.has(dateStr) || holidaySet.has(dateStr)) continue;

    const cov = getDayCoverage(d);
    if (!cov.hasPool) continue;
    const needFix =
      (availabilityByDay[d].totalAvailable >= 4 && cov.overallRatio < guidelines.coverageMinFloor) ||
      (availabilityByDay[d].byTurno.Abertura.length >= 4 && cov.aberturaRatio < guidelines.coverageMinFloor) ||
      (availabilityByDay[d].byTurno.Fechamento.length >= 4 && cov.fechamentoRatio < guidelines.coverageMinFloor);

    if (!needFix) continue;

    // Ordena candidatos: variáveis primeiro (FIVE_BY_TWO_VARIABLE_OFF / PRE_SUNDAY_GUARD / PEAK_DAY_SHIFTED), preferencial por último
    const resting = availabilityByDay[d].availablePool
      .filter(e => shiftsByEmp[e.id]?.[d] === 'F' && !isImmutable(e, d))
      .sort((a, b) => {
        const ra = decisionReasonsByEmp[a.id]?.[d] === 'PREFERRED_DAY_OFF' ? 1 : 0;
        const rb = decisionReasonsByEmp[b.id]?.[d] === 'PREFERRED_DAY_OFF' ? 1 : 0;
        return ra - rb;
      });

    for (const cand of resting) {
      const origReason = decisionReasonsByEmp[cand.id]?.[d];
      const shifts = shiftsByEmp[cand.id];
      let bestAlt = -1;
      let bestAltScore = -Infinity;

      for (const off of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
        const alt = d + off;
        if (alt < cutoffDayIdx || alt >= daysInMonth) continue;
        const altDow = new Date(year, month, alt + 1).getDay();
        const altStr = `${monthKey}-${String(alt + 1).padStart(2, '0')}`;
        if (altDow === 0 || peakSet.has(alt) || storeClosedDates.has(altStr) || holidaySet.has(altStr)) continue;
        if (shifts[alt] !== 'T' || isImmutable(cand, alt)) continue;

        const sim = [...shifts];
        sim[d] = 'T';
        sim[alt] = 'F';
        if (!validateHardConstraints(cand, sim, year, month, prevStreaks.get(cand.id) || 0, guidelines, protectedDetails, shiftsByEmp)) {
          continue;
        }

        const altCov = getDayCoverage(alt, { empId: cand.id, shift: 'F' });
        const candTurno = getShiftClassification(cand.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';
        const altTurnoRatio = candTurno === 'Fechamento' ? altCov.fechamentoRatio : altCov.aberturaRatio;
        if (availabilityByDay[alt].totalAvailable >= 4 && altCov.overallRatio < guidelines.coverageMinFloor) continue;
        if (availabilityByDay[alt].byTurno[candTurno].length >= 4 && altTurnoRatio < guidelines.coverageMinFloor) continue;

        const sc = altTurnoRatio * 2 + altCov.overallRatio;
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

        const after = getDayCoverage(d);
        if (
          (availabilityByDay[d].totalAvailable < 4 || after.overallRatio >= guidelines.coverageMinFloor) &&
          (availabilityByDay[d].byTurno.Abertura.length < 4 || after.aberturaRatio >= guidelines.coverageMinFloor) &&
          (availabilityByDay[d].byTurno.Fechamento.length < 4 || after.fechamentoRatio >= guidelines.coverageMinFloor)
        ) {
          break;
        }
      }
    }

    const finalCov = getDayCoverage(d);
    if (availabilityByDay[d].totalAvailable >= 4 && finalCov.overallRatio < guidelines.coverageMinFloor) {
      relaxations.push({
        dateStr,
        rule: `Piso de cobertura (${Math.round(guidelines.coverageMinFloor * 100)}%)`,
        reason: `Atingiu ${Math.round(finalCov.overallRatio * 100)}% (${finalCov.totalWorking}/${availabilityByDay[d].totalAvailable} disponíveis) devido às restrições CLT/5x2 ou picos vizinhos.`,
        alternative: 'Manter cobertura máxima sem violar descanso obrigatório ou ajustar diretriz para modo flexível.',
      });
    }
  }

  // 4. Créditos de Feriado Pendentes (FF) quando habilitado
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
          if (availabilityByDay[d].totalAvailable >= 4 && afterCov.overallRatio < guidelines.coverageMinFloor) continue;
          if (availabilityByDay[d].byTurno[empTurno].length >= 4 && turnoRatioAfter < guidelines.coverageMinFloor) continue;

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

  return {
    monthKey,
    relaxations,
    displacedPreferences,
    capacityWarnings,
    theoreticalMaxPresence,
  };
}
