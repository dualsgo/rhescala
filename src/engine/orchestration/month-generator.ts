import {
    Employee,
    EmployeeRole,
    ShiftType,
    Holiday,
    JornadaSettings,
    ProtectedDaysConfig,
    ProtectedDayDetail,
    DecisionReason
} from '../../../types';
import {
    buildHolidaySet,
    DEFAULT_JORNADA_SETTINGS,
    normalizeProtectedDaysDetails,
    normalizeProtectedDaysConfig,
    isEmployeeHiddenInMonth,
    getEffectiveJornadaOnDate,
    getStoreClosedDatesForYear,
} from '../config/schedule-constants';
import {
    WEEKDAY_NAMES,
    getTargetHours,
    getPrevMonthWorkStreak,
    generateMonthForEmployee,
    isEmployeePreferredDayOff
} from '../clt/clt-rules';
import {
    getPrevMonthConsecutive,
    buildSundayAssignments
} from '../clt/sunday-rotation';
import { getLegalOverrideForDay } from '../clt/legal-overrides';
import { optimizeProtectedDays } from '../peaks/protected-days';
import { getShiftClassification } from '../shifts/shift-predicates';
import { assignDailyRolesForMonth, isEmployeeCaixaEligible } from '../tactical/tactical-positions';

export interface PendingHolidayCreditInput {
    id: string;
    holidayDate: string;
    holidayName: string;
}

/**
 * Calcula créditos de feriado pendentes de meses anteriores do mesmo ano para um colaborador,
 * quando o chamador não fornece `pendingHolidayCredits` explicitamente.
 */
function inferPendingHolidayCreditsBeforeMonth(
    emp: Employee,
    year: number,
    targetMonth: number,
    customHolidays: Holiday[],
    deletedNationalHolidays: string[]
): PendingHolidayCreditInput[] {
    if (emp.isYoungApprentice || emp.status === 'inactive') return [];
    const nationals = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
    if (nationals.size === 0) return [];

    const worked: PendingHolidayCreditInput[] = [];
    const usedRefs = new Set<string>();
    let genericFFCount = 0;

    for (let m = 0; m < targetMonth; m++) {
        const mk = `${year}-${String(m + 1).padStart(2, '0')}`;
        const mShifts = emp.shifts?.[mk] || [];
        mShifts.forEach((rawShift, idx) => {
            const dStr = `${mk}-${String(idx + 1).padStart(2, '0')}`;
            let s = rawShift;
            if ((emp.hiredAt && dStr < emp.hiredAt) || (emp.firedAt && dStr > emp.firedAt)) s = 'N/A';
            else if (emp.vacationStart && emp.vacationEnd && dStr >= emp.vacationStart && dStr <= emp.vacationEnd) s = 'FE';
            else if (emp.atestadoStart && emp.atestadoEnd && dStr >= emp.atestadoStart && dStr <= emp.atestadoEnd) s = 'AT';

            if (nationals.has(dStr) && (s === 'T' || ['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ', 'CX', 'REP', 'VEND', 'FISC', 'AP'].includes(s))) {
                const hObj = customHolidays.find(h => h.date === dStr);
                worked.push({ id: dStr, holidayDate: dStr, holidayName: hObj?.name || 'Feriado' });
                if (dStr.endsWith('-05-01')) {
                    worked.push({ id: `${dStr}-extra`, holidayDate: dStr, holidayName: `${hObj?.name || 'Dia do Trabalho'} (Folga 2)` });
                }
            }
            if (typeof s === 'string' && s.startsWith('FF')) {
                const ref = s.split(' ')[1];
                if (ref) usedRefs.add(ref);
                else genericFFCount++;
            }
        });
    }

    const remaining = worked.filter(w => !usedRefs.has(w.id) && !usedRefs.has(w.holidayDate));
    return remaining.slice(genericFFCount);
}

/**
 * "Smart Update" para geração/atualização mensal completa de escala.
 * 
 * Modos de operação:
 * - 'suggested_retro': Motor inteligente com verificação retroativa CLT (domingos e 6x1/5x2 contínuos),
 *   garantia de >= 70% de cobertura (geral e por turno) e alocação automática de folgas de feriado (FF) pendentes.
 * - 'all_working': Modo base 100% trabalhado (preserva férias/afastamentos/aniversário/LF para ajuste manual).
 */
export function applyMonthUpdate(
    employees: Employee[],
    year: number,
    month: number,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
    protectedDays?: ProtectedDaysConfig | number[],
    mode: 'suggested_retro' | 'all_working' = 'suggested_retro',
    targetEmpId?: string,
    pendingHolidayCredits?: Record<string, PendingHolidayCreditInput[]>
): Record<string, { shifts: ShiftType[]; hours: string[]; decisionReasons?: Record<number, DecisionReason>; dailyAssignedRoles?: Record<number, EmployeeRole> }> {
    const result: Record<string, { shifts: ShiftType[]; hours: string[]; decisionReasons?: Record<number, DecisionReason>; dailyAssignedRoles?: Record<number, EmployeeRole> }> = {};

    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const activeRegular = employees.filter(e => e.status === 'active' && !isEmployeeHiddenInMonth(e, monthKey) && !e.isYoungApprentice);
    const activeApprentices = employees.filter(e => e.status === 'active' && !isEmployeeHiddenInMonth(e, monthKey) && e.isYoungApprentice);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
    const storeClosedDates = getStoreClosedDatesForYear(year, customHolidays, deletedNationalHolidays);

    // Helper para verificar status legal/especial
    const getLegalOverride = (emp: Employee, dayIdx: number): ShiftType | null =>
        getLegalOverrideForDay(emp, year, month, dayIdx);

    // ── 1. Jovens Aprendizes ────────────────────────────────────────────────────
    activeApprentices.forEach(app => {
        const shifts: ShiftType[] = Array(daysInMonth).fill('T');
        const decisionReasons: Record<number, DecisionReason> = {};
        const courseDayNorm = app.courseDay ? app.courseDay.replace('-feira', '').trim() : '';

        const hours: string[] = Array.from({ length: daysInMonth }, (_, i) => {
            const dow = new Date(year, month, i + 1).getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            return getTargetHours(app, dow, holidaySet.has(dateStr), settings);
        });

        for (let i = 0; i < daysInMonth; i++) {
            const date = new Date(year, month, i + 1);
            const dow = date.getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            const isHoliday = holidaySet.has(dateStr);

            const legal = getLegalOverride(app, i);
            if (legal) {
                shifts[i] = legal;
                decisionReasons[i] = 'LEGAL_IMMUTABLE';
                continue;
            }

            if (storeClosedDates.has(dateStr)) {
                shifts[i] = 'LF';
                decisionReasons[i] = 'LEGAL_IMMUTABLE';
                continue;
            }

            if (dow === 0 || dow === 6 || isHoliday) {
                shifts[i] = 'F';
                decisionReasons[i] = 'LEGAL_IMMUTABLE';
            } else if (courseDayNorm && WEEKDAY_NAMES[dow] === courseDayNorm) {
                shifts[i] = 'C';
                decisionReasons[i] = 'LEGAL_IMMUTABLE';
            } else {
                shifts[i] = 'T';
                decisionReasons[i] = 'REGULAR_WORK';
            }
        }

        result[app.id] = { shifts, hours, decisionReasons };
    });

    // ── 2. MODO: 100% Trabalhado (Sem folgas automáticas para ajuste manual) ──────
    if (mode === 'all_working') {
        activeRegular.forEach(emp => {
            const shifts: ShiftType[] = Array(daysInMonth).fill('T');
            const decisionReasons: Record<number, DecisionReason> = {};
            const hours: string[] = Array.from({ length: daysInMonth }, (_, i) => {
                const dow = new Date(year, month, i + 1).getDay();
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                return getTargetHours(emp, dow, holidaySet.has(dateStr), settings);
            });

            for (let i = 0; i < daysInMonth; i++) {
                const legal = getLegalOverride(emp, i);
                if (legal) {
                    shifts[i] = legal;
                    decisionReasons[i] = 'LEGAL_IMMUTABLE';
                } else {
                    shifts[i] = 'T';
                    decisionReasons[i] = 'REGULAR_WORK';
                }
            }

            result[emp.id] = { shifts, hours, decisionReasons };
        });
        return result;
    }

    // ── 3. MODO: Sugerida Inteligente com Verificação Retroativa Estrita CLT ─────
    // Localiza todos os domingos do mês
    const sundaysInMonth: number[] = [];
    for (let d = 0; d < daysInMonth; d++) {
        if (new Date(year, month, d + 1).getDay() === 0) sundaysInMonth.push(d);
    }

    // Retro-análise dos 2 últimos domingos do mês anterior
    const prevConsecutive = getPrevMonthConsecutive(activeRegular, year, month);
    const { assignments: sundayAssignments } = buildSundayAssignments(
        activeRegular, year, month, sundaysInMonth, prevConsecutive, settings, protectedDays, targetEmpId
    );

    // Retro-análise dos dias trabalhados no mês anterior até o dia 31
    const prevStreaks = getPrevMonthWorkStreak(activeRegular, year, month);

    const targetEmps = targetEmpId
        ? activeRegular.filter(e => e.id === targetEmpId)
        : activeRegular;

    targetEmps.forEach((emp, targetEmpIdx) => {
        const restSundays = sundayAssignments.get(emp.id) ?? new Set<number>();
        const shifts: ShiftType[] = Array(daysInMonth).fill('T');
        const decisionReasons: Record<number, DecisionReason> = {};

        const hours: string[] = Array.from({ length: daysInMonth }, (_, i) => {
            const dow = new Date(year, month, i + 1).getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            return getTargetHours(emp, dow, holidaySet.has(dateStr), settings);
        });

        // Caminhamento dia a dia conectando o streak do mês anterior com o novo mês
        let currentStreak = prevStreaks.get(emp.id) || 0;

        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const date = new Date(year, month, dayIdx + 1);
            const dow = date.getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
            const effectiveJornada = getEffectiveJornadaOnDate(emp, dateStr);
            const is5x2 = effectiveJornada === '5x2';
            const maxStreak = is5x2 ? 5 : 6;
            const legal = getLegalOverride(emp, dayIdx);

            // 3.1 Se houver condição legal (Férias, Atestado, Aniversário, Não-contratado) ou Loja Fechada (LF)
            if (legal) {
                shifts[dayIdx] = legal;
                decisionReasons[dayIdx] = 'LEGAL_IMMUTABLE';
                currentStreak = 0;
                continue;
            }
            if (storeClosedDates.has(dateStr)) {
                shifts[dayIdx] = 'LF';
                decisionReasons[dayIdx] = 'LEGAL_IMMUTABLE';
                currentStreak = 0;
                continue;
            }

            const isPreferredDay = isEmployeePreferredDayOff(emp, dow);
            const isEstoque = emp.cargo === 'Estoque' || (emp.cargo as string) === 'Estoquista' || emp.role === 'Estoque';

            // 3.2 Se for domingo de folga da rotação CLT OU folga fixa no domingo OU Estoque
            if (dow === 0) {
                const isSundayRest = restSundays.has(dayIdx) || isPreferredDay || isEstoque;
                if (isSundayRest) {
                    shifts[dayIdx] = 'F';
                    decisionReasons[dayIdx] = 'SUNDAY_ROTATION_OFF';
                    currentStreak = 0;
                    continue;
                } else if (currentStreak + 1 > maxStreak) {
                    shifts[dayIdx] = 'F';
                    decisionReasons[dayIdx] = 'CLT_MAX_STREAK_GUARD';
                    currentStreak = 0;
                    continue;
                } else {
                    shifts[dayIdx] = 'T';
                    decisionReasons[dayIdx] = 'REGULAR_WORK';
                    currentStreak++;
                    continue;
                }
            }

            // Para dias da semana (Segunda a Sábado):
            const nextSunday = sundaysInMonth.find(s => s >= dayIdx);
            const willWorkNextSunday = nextSunday !== undefined &&
                !restSundays.has(nextSunday) &&
                !isEmployeePreferredDayOff(emp, 0) &&
                !isEstoque;

            // Verifica se na janela da semana que antecede o próximo domingo já houve algum dia de descanso
            const weekStartIdx = nextSunday !== undefined ? Math.max(0, nextSunday - 6) : 0;
            const hasRestInWeek = nextSunday !== undefined && shifts.slice(weekStartIdx, dayIdx).some(s =>
                ['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')
            );

            // 3.3 Verificação de limite CLT 6x1 / 5x2 (se trabalhou 6 dias seguidos, o 7º dia é FOLGA OBRIGATÓRIA)
            if (currentStreak + 1 > maxStreak) {
                shifts[dayIdx] = 'F';
                decisionReasons[dayIdx] = 'CLT_MAX_STREAK_GUARD';
                currentStreak = 0;
                continue;
            }

            // 3.4 Pre-Sunday Guard: Repressão de 2ª folga para regime 6x1 escalado no domingo
            // Se já descansou na mesma semana (ex: streak guard no início da semana) e vai trabalhar no domingo,
            // reprime a folga fixa para evitar folga dupla acidental que derruba a cobertura da loja.
            if (isPreferredDay) {
                if (willWorkNextSunday && !is5x2 && hasRestInWeek) {
                    shifts[dayIdx] = 'T';
                    decisionReasons[dayIdx] = 'REGULAR_WORK';
                    currentStreak++;
                    continue;
                } else {
                    shifts[dayIdx] = 'F';
                    decisionReasons[dayIdx] = 'PREFERRED_DAY_OFF';
                    currentStreak = 0;
                    continue;
                }
            }

            // 3.5 Pre-Sunday Guard: Para colaboradores que trabalharão no próximo domingo e ainda não descansaram na semana
            if (willWorkNextSunday && !hasRestInWeek) {
                const midWeekOffDow = 3 + (activeRegular.indexOf(emp) % 2); // Quarta ou Quinta

                // Concede folga técnica no meio da semana se não houver folga fixa semanal
                if (
                    (!emp.preferredDayOff || emp.preferredDayOff === 'Nenhum') &&
                    dow === midWeekOffDow &&
                    nextSunday - dayIdx <= 6
                ) {
                    shifts[dayIdx] = 'F';
                    decisionReasons[dayIdx] = 'PRE_SUNDAY_GUARD';
                    currentStreak = 0;
                    continue;
                }

                // Fallback de proteção Pre-Sunday: se chegar ao sábado (D - 1) sem descanso na semana,
                // garante folga no sábado para que o colaborador inicie o domingo com streak zerado.
                if (dayIdx === nextSunday - 1) {
                    shifts[dayIdx] = 'F';
                    decisionReasons[dayIdx] = 'PRE_SUNDAY_GUARD';
                    currentStreak = 0;
                    continue;
                }
            }

            // 3.6 Para 5x2 já cadastrado sem dia preferido, folga aos sábados (na virada 16/12 a 2ª folga é distribuída no bloco 3.8)
            if (emp.jornada === '5x2' && dow === 6) {
                shifts[dayIdx] = 'F';
                decisionReasons[dayIdx] = 'PREFERRED_DAY_OFF';
                currentStreak = 0;
                continue;
            }

            // 3.7 Senão, dia regular de trabalho
            shifts[dayIdx] = 'T';
            decisionReasons[dayIdx] = 'REGULAR_WORK';
            currentStreak++;
        }

        // 3.8 Para semanas-calendário (Seg–Dom) em regime 5x2: assegura 2 folgas por semana
        // Agrupa os dias do mês por semana-calendário (Segunda = início da semana)
        const calendarWeeks: number[][] = [];
        let currentWeek: number[] = [];
        for (let d = 0; d < daysInMonth; d++) {
            const dow = new Date(year, month, d + 1).getDay();
            if (dow === 1 && currentWeek.length > 0) {
                calendarWeeks.push(currentWeek);
                currentWeek = [];
            }
            currentWeek.push(d);
        }
        if (currentWeek.length > 0) calendarWeeks.push(currentWeek);

        for (const weekIndices of calendarWeeks) {
            if (weekIndices.length < 5) continue; // Semana incompleta de borda de mês
            const has5x2InWeek = weekIndices.some(k => {
                const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`;
                return getEffectiveJornadaOnDate(emp, ds) === '5x2';
            });
            if (!has5x2InWeek) continue;

            const weekRests = weekIndices.filter(
                k => ['F', 'LF', 'FE', 'AT', 'DO', 'N/A'].includes(shifts[k]) || shifts[k]?.startsWith('FF')
            );

            // Completa até 2 folgas na semana distribuindo de forma escalonada entre dias úteis (Seg..Sáb)
            let neededRests = 2 - weekRests.length;
            if (neededRests > 0) {
                const candidateDows = [1, 2, 3, 4, 5, 6]; // Seg..Sáb
                const rotatedStart = targetEmpIdx % candidateDows.length;
                const orderedDows = [
                    ...candidateDows.slice(rotatedStart),
                    ...candidateDows.slice(0, rotatedStart),
                ];

                for (const targetDow of orderedDows) {
                    if (neededRests <= 0) break;
                    const candidateIdx = weekIndices.find(k => {
                        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`;
                        const dow = new Date(year, month, k + 1).getDay();
                        return (
                            dow === targetDow &&
                            getEffectiveJornadaOnDate(emp, ds) === '5x2' &&
                            shifts[k] === 'T' &&
                            !getLegalOverride(emp, k)
                        );
                    });
                    if (candidateIdx !== undefined) {
                        shifts[candidateIdx] = 'F';
                        decisionReasons[candidateIdx] = 'PREFERRED_DAY_OFF';
                        neededRests--;
                    }
                }
            }
        }

        result[emp.id] = { shifts, hours, decisionReasons };
    });

    // 3.9 Validador Coletivo de Cobertura Diária por Turno (Segunda a Sábado)
    // Se múltiplos colaboradores do mesmo turno tiverem a mesma preferredDayOff, deixando o turno
    // sem Caixa, desloca a folga de um deles para um dia vizinho válido da mesma semana (D-1 ou D+1),
    // desde que não viole o limite máximo de 6 dias trabalhados (currentStreak <= 6) nem o Pre-Sunday Guard.
    if (mode === 'suggested_retro' && !targetEmpId) {
        const turnos = ['Abertura', 'Fechamento'] as const;

        for (let d = 0; d < daysInMonth; d++) {
            const date = new Date(year, month, d + 1);
            const dow = date.getDay();
            if (dow === 0) continue; // Domingos já resolvidos pelo algoritmo dominical

            const nextSunday = sundaysInMonth.find(s => s >= d);

            for (const turno of turnos) {
                const empsInTurno = activeRegular.filter(e =>
                    getShiftClassification(e.workPeriod, false, settings) === turno
                );
                if (empsInTurno.length < 2) continue;

                const caixasTotal = empsInTurno.filter(isEmployeeCaixaEligible);
                if (caixasTotal.length < 2) continue;

                const caixasWorking = caixasTotal.filter(e => result[e.id]?.shifts[d] === 'T');
                if (caixasWorking.length > 0) continue; // Turno já tem caixa trabalhando

                // Zero caixas trabalhando no turno neste dia útil: procurar colaboradores de folga fixa
                const caixasOffByPref = caixasTotal.filter(e =>
                    result[e.id]?.shifts[d] === 'F' &&
                    result[e.id]?.decisionReasons?.[d] === 'PREFERRED_DAY_OFF'
                );

                if (caixasOffByPref.length >= 2) {
                    const candidate = caixasOffByPref[1];
                    const candData = result[candidate.id];
                    if (!candData) continue;

                    const maxStreak = candidate.jornada === '5x2' ? 5 : 6;
                    const neighborOffsets = [1, -1, 2, -2];

                    for (const offset of neighborOffsets) {
                        const altD = d + offset;
                        if (altD < 0 || altD >= daysInMonth) continue;
                        const altDate = new Date(year, month, altD + 1);
                        if (altDate.getDay() === 0) continue;

                        const dateStrAlt = `${year}-${String(month + 1).padStart(2, '0')}-${String(altD + 1).padStart(2, '0')}`;
                        if (holidaySet.has(dateStrAlt)) continue;

                        if (candData.shifts[altD] !== 'T' || getLegalOverride(candidate, altD)) continue;

                        const simulatedShifts = [...candData.shifts];
                        simulatedShifts[d] = 'T';
                        simulatedShifts[altD] = 'F';

                        let validStreak = true;
                        let runStreak = prevStreaks.get(candidate.id) || 0;
                        for (let k = 0; k < daysInMonth; k++) {
                            if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(simulatedShifts[k]) || simulatedShifts[k]?.startsWith('FF')) {
                                runStreak = 0;
                            } else {
                                runStreak++;
                                if (runStreak > maxStreak) {
                                    validStreak = false;
                                    break;
                                }
                            }
                        }

                        if (!validStreak) continue;

                        if (nextSunday !== undefined) {
                            const restSundays = sundayAssignments.get(candidate.id) ?? new Set<number>();
                            const willWorkSun = !restSundays.has(nextSunday) && !isEmployeePreferredDayOff(candidate, 0);
                            if (willWorkSun) {
                                const weekStart = Math.max(0, nextSunday - 6);
                                const hasRestInWeek = simulatedShifts.slice(weekStart, nextSunday).some(s =>
                                    ['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')
                                );
                                if (!hasRestInWeek) continue;
                            }
                        }

                        const caixasWorkingOnAlt = caixasTotal.filter(e =>
                            (e.id === candidate.id ? 'F' : result[e.id]?.shifts[altD]) === 'T'
                        );
                        if (caixasWorkingOnAlt.length === 0) continue;

                        candData.shifts[d] = 'T';
                        if (candData.decisionReasons) candData.decisionReasons[d] = 'REGULAR_WORK';
                        candData.shifts[altD] = 'F';
                        if (candData.decisionReasons) candData.decisionReasons[altD] = 'PREFERRED_DAY_OFF';
                        break;
                    }
                }
            }
        }

        // 3.9B Balanceador Coletivo de Cobertura >= 70% (Geral e por Turno) em dias úteis (Seg-Sáb)
        const isRestOrOff = (s: ShiftType | undefined) =>
            ['F', 'LF', 'FE', 'AT', 'DO', 'N/A'].includes(s as string) || Boolean(s?.startsWith('FF'));

        const isValidCandidateSchedule = (emp: Employee, simShifts: ShiftType[]): boolean => {
            let runStreak = prevStreaks.get(emp.id) || 0;
            for (let k = 0; k < daysInMonth; k++) {
                if (isRestOrOff(simShifts[k])) {
                    runStreak = 0;
                } else {
                    runStreak++;
                    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`;
                    const cap = getEffectiveJornadaOnDate(emp, ds) === '5x2' ? 6 : 6; // Teto absoluto CLT
                    if (runStreak > cap) return false;
                }
            }
            return true;
        };

        const getCoverageMetrics = (dayIndex: number, override?: { empId: string; shift: ShiftType }) => {
            let totalWorking = 0;
            const byTurno: Record<'Abertura' | 'Fechamento', { total: number; working: number }> = {
                Abertura: { total: 0, working: 0 },
                Fechamento: { total: 0, working: 0 },
            };

            for (const e of activeRegular) {
                const s = override && e.id === override.empId ? override.shift : result[e.id]?.shifts[dayIndex];
                const working = s === 'T';
                if (working) totalWorking++;

                const t = getShiftClassification(e.workPeriod, false, settings);
                const bucket = t === 'Fechamento' ? 'Fechamento' : 'Abertura';
                byTurno[bucket].total++;
                if (working) byTurno[bucket].working++;
            }

            const overallRatio = activeRegular.length > 0 ? totalWorking / activeRegular.length : 1;
            const aberturaRatio = byTurno.Abertura.total > 0 ? byTurno.Abertura.working / byTurno.Abertura.total : 1;
            const fechamentoRatio = byTurno.Fechamento.total > 0 ? byTurno.Fechamento.working / byTurno.Fechamento.total : 1;
            return { totalWorking, overallRatio, aberturaRatio, fechamentoRatio, byTurno };
        };

        for (let d = 0; d < daysInMonth; d++) {
            const dow = new Date(year, month, d + 1).getDay();
            const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
            if (dow === 0 || storeClosedDates.has(dStr) || holidaySet.has(dStr)) continue;

            const cov = getCoverageMetrics(d);
            const overallLow = activeRegular.length >= 4 && cov.overallRatio < 0.7;
            const aberturaLow = cov.byTurno.Abertura.total >= 4 && cov.aberturaRatio < 0.7;
            const fechamentoLow = cov.byTurno.Fechamento.total >= 4 && cov.fechamentoRatio < 0.7;

            if (!overallLow && !aberturaLow && !fechamentoLow) continue;

            // Busca colaboradores em folga 'F' que podem ter a folga movida para um dia mais folgado da mesma semana
            const restingInDay = activeRegular.filter(e => {
                if (result[e.id]?.shifts[d] !== 'F' || getLegalOverride(e, d)) return false;
                if (aberturaLow && !overallLow && !fechamentoLow) {
                    return getShiftClassification(e.workPeriod, false, settings) !== 'Fechamento';
                }
                if (fechamentoLow && !overallLow && !aberturaLow) {
                    return getShiftClassification(e.workPeriod, false, settings) === 'Fechamento';
                }
                return true;
            });

            for (const cand of restingInDay) {
                const cData = result[cand.id];
                if (!cData) continue;

                const candTurno = getShiftClassification(cand.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';
                const candidateOffsets = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
                let bestAltDay = -1;
                let bestAltScore = -1;

                for (const off of candidateOffsets) {
                    const altD = d + off;
                    if (altD < 0 || altD >= daysInMonth) continue;
                    const altDow = new Date(year, month, altD + 1).getDay();
                    const altDStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(altD + 1).padStart(2, '0')}`;
                    if (altDow === 0 || storeClosedDates.has(altDStr) || holidaySet.has(altDStr)) continue;
                    if (cData.shifts[altD] !== 'T' || getLegalOverride(cand, altD)) continue;

                    const sim = [...cData.shifts];
                    sim[d] = 'T';
                    sim[altD] = 'F';
                    if (!isValidCandidateSchedule(cand, sim)) continue;

                    const altCov = getCoverageMetrics(altD, { empId: cand.id, shift: 'F' });
                    if (activeRegular.length >= 4 && altCov.overallRatio < 0.7) continue;
                    const altTurnoRatio = candTurno === 'Fechamento' ? altCov.fechamentoRatio : altCov.aberturaRatio;
                    if (altCov.byTurno[candTurno].total >= 4 && altTurnoRatio < 0.7) continue;

                    const score = altTurnoRatio * 2 + altCov.overallRatio;
                    if (score > bestAltScore) {
                        bestAltScore = score;
                        bestAltDay = altD;
                    }
                }

                if (bestAltDay !== -1) {
                    cData.shifts[d] = 'T';
                    cData.shifts[bestAltDay] = 'F';
                    if (cData.decisionReasons) {
                        cData.decisionReasons[d] = 'REGULAR_WORK';
                        cData.decisionReasons[bestAltDay] = 'PREFERRED_DAY_OFF';
                    }
                    const updated = getCoverageMetrics(d);
                    if (
                        (activeRegular.length < 4 || updated.overallRatio >= 0.7) &&
                        (updated.byTurno.Abertura.total < 4 || updated.aberturaRatio >= 0.7) &&
                        (updated.byTurno.Fechamento.total < 4 || updated.fechamentoRatio >= 0.7)
                    ) {
                        break;
                    }
                }
            }
        }

        // 3.9C Alocação Inteligente de Folgas de Feriado Pendentes (FF)
        // Sugere o dia útil (Seg-Sex) em que o turno do colaborador estiver mais completo (mantendo >= 70%)
        const protectedSet = new Set(Object.keys(normalizeProtectedDaysDetails(protectedDays)).map(Number));
        for (const emp of targetEmps) {
            const empData = result[emp.id];
            if (!empData) continue;

            const credits = pendingHolidayCredits?.[emp.id]
                ?? inferPendingHolidayCreditsBeforeMonth(emp, year, month, customHolidays, deletedNationalHolidays);
            if (!credits || credits.length === 0) continue;

            const empTurno = getShiftClassification(emp.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura';

            for (const credit of credits) {
                let bestDay = -1;
                let bestScore = -1;

                for (let d = 0; d < daysInMonth; d++) {
                    const dayNum = d + 1;
                    const dow = new Date(year, month, dayNum).getDay();
                    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

                    // Apenas dias úteis (Seg-Sex), não feriado, não loja fechada, não dia protegido ou pico sazonal
                    const isPeakRetailDate = (month === 9 && dayNum >= 8 && dayNum <= 12) || (month === 11 && dayNum >= 20 && dayNum <= 24);
                    if (dow === 0 || dow === 6) continue;
                    if (holidaySet.has(dStr) || storeClosedDates.has(dStr) || protectedSet.has(dayNum) || isPeakRetailDate) continue;
                    if (empData.shifts[d] !== 'T' || getLegalOverride(emp, d)) continue;

                    const afterCov = getCoverageMetrics(d, { empId: emp.id, shift: 'FF' });
                    const turnoRatioAfter = empTurno === 'Fechamento' ? afterCov.fechamentoRatio : afterCov.aberturaRatio;

                    // Evita derrubar o turno ou a loja abaixo de 70% quando há equipe suficiente
                    if (activeRegular.length >= 4 && afterCov.overallRatio < 0.7) continue;
                    if (afterCov.byTurno[empTurno].total >= 4 && turnoRatioAfter < 0.7) continue;

                    // Não deixar o turno sem Caixa
                    if (isEmployeeCaixaEligible(emp)) {
                        const caixasInTurnoWorking = activeRegular.filter(e =>
                            e.id !== emp.id &&
                            isEmployeeCaixaEligible(e) &&
                            (getShiftClassification(e.workPeriod, false, settings) === 'Fechamento' ? 'Fechamento' : 'Abertura') === empTurno &&
                            empData.shifts && result[e.id]?.shifts[d] === 'T'
                        ).length;
                        if (caixasInTurnoWorking === 0) continue;
                    }

                    // Pontua pela completude do turno do colaborador + completude geral da loja
                    const score = turnoRatioAfter * 3 + afterCov.overallRatio;
                    if (score > bestScore) {
                        bestScore = score;
                        bestDay = d;
                    }
                }

                if (bestDay !== -1) {
                    const ffCode = `FF ${credit.id || credit.holidayDate}` as ShiftType;
                    empData.shifts[bestDay] = ffCode;
                    if (empData.decisionReasons) {
                        empData.decisionReasons[bestDay] = 'PREFERRED_DAY_OFF';
                    }
                }
            }
        }
    }

    // Se houver dias protegidos configurados, otimiza com Peak-Centric
    const configuredDays = Object.keys(normalizeProtectedDaysDetails(protectedDays)).map(Number);
    if (configuredDays.length > 0) {
        const peakResult = optimizeProtectedDays(employees, monthKey, protectedDays || {}, customHolidays, deletedNationalHolidays, settings);
        activeRegular.forEach(emp => {
            if (peakResult[emp.id] && result[emp.id]) {
                const oldShifts = result[emp.id].shifts;
                const newShifts = peakResult[emp.id].shifts;
                const reasons = result[emp.id].decisionReasons || {};

                for (let d = 0; d < daysInMonth; d++) {
                    if (oldShifts[d] !== newShifts[d]) {
                        reasons[d] = 'PEAK_DAY_SHIFTED';
                    }
                }

                result[emp.id].shifts = newShifts;
                result[emp.id].decisionReasons = reasons;
            }
        });
    }

    // 3.10 Computa as funções atribuídas diariamente por turno e dupla preferência
    const simulatedEmployees: Employee[] = employees
        .filter(emp => emp.status === 'active' && !isEmployeeHiddenInMonth(emp, monthKey))
        .map(emp => ({
            ...emp,
            shifts: {
                ...emp.shifts,
                [monthKey]: result[emp.id]?.shifts || emp.shifts[monthKey] || []
            },
            dailyHours: {
                ...emp.dailyHours,
                [monthKey]: result[emp.id]?.hours || emp.dailyHours[monthKey] || []
            }
        }));

    const dailyAssignedMatrix = assignDailyRolesForMonth(
        simulatedEmployees,
        year,
        month,
        (dStr) => holidaySet.has(dStr),
        settings,
        configuredDays.length > 0 ? normalizeProtectedDaysConfig(protectedDays) : undefined
    );

    for (const emp of employees) {
        if (result[emp.id]) {
            result[emp.id].dailyAssignedRoles = dailyAssignedMatrix[emp.id] || {};
        }
    }

    return result;
}

/**
 * Generates schedules for ALL remaining months of the year (fromMonth → December).
 * Returns: empId → { [monthKey]: { shifts, hours } }
 *
 * Sunday rotation is computed month-by-month, carrying consecutive counts forward
 * so the alternating pattern is consistent across month boundaries.
 */
export function generateYearSchedule(
    employees: Employee[],
    fromYear: number,
    fromMonth: number,       // 0-indexed, inclusive
    currentYear: number,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, Record<string, { shifts: ShiftType[]; hours: string[] }>> {
    const result: Record<string, Record<string, { shifts: ShiftType[]; hours: string[] }>> = {};

    const activeRegular = employees.filter(e => e.status === 'active' && !e.isYoungApprentice);
    const activeApprentices = employees.filter(e => e.status === 'active' && e.isYoungApprentice);

    // Track consecutive Sunday work counts across months for proper carry-over
    let rollingConsecutive: Map<string, number> | undefined = undefined;

    for (let year = fromYear; year <= currentYear; year++) {
        const startMonth = year === fromYear ? fromMonth : 0;
        for (let month = startMonth; month <= 11; month++) {
            const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            const monthRegular = activeRegular.filter(e => !isEmployeeHiddenInMonth(e, monthKey));
            const monthApprentices = activeApprentices.filter(e => !isEmployeeHiddenInMonth(e, monthKey));

            // Find all Sundays in this month
            const sundaysInMonth: number[] = [];
            for (let d = 0; d < daysInMonth; d++) {
                if (new Date(year, month, d + 1).getDay() === 0) sundaysInMonth.push(d);
            }

            // Build Sunday assignments — with cross-month carry
            const { assignments, nextConsecutive } = buildSundayAssignments(
                monthRegular, year, month, sundaysInMonth, rollingConsecutive, settings
            );
            rollingConsecutive = nextConsecutive;

            // Generate each regular employee
            monthRegular.forEach(emp => {
                if (!result[emp.id]) result[emp.id] = {};
                result[emp.id][monthKey] = generateMonthForEmployee(
                    emp, year, month,
                    assignments.get(emp.id) ?? new Set(),
                    customHolidays,
                    deletedNationalHolidays
                );
            });

            // Generate each apprentice
            monthApprentices.forEach(emp => {
                if (!result[emp.id]) result[emp.id] = {};
                result[emp.id][monthKey] = generateMonthForEmployee(
                    emp, year, month,
                    new Set(), // apprentices always off on Sundays via the isYoungApprentice rule
                    customHolidays,
                    deletedNationalHolidays
                );
            });
        }
    }

    return result;
}

/**
 * Aplica APENAS os horários padrão (diários, domingos e feriados)
 * MANTENDO 100% dos turnos e folgas atuais inalterados.
 * Pode ser aplicado para todos ou apenas para um colaborador (targetEmpId).
 */
export function applyHoursOnly(
    employees: Employee[],
    year: number,
    month: number,
    targetEmpId?: string,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
    const storeClosedDates = getStoreClosedDatesForYear(year, customHolidays, deletedNationalHolidays);
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const targetEmps = targetEmpId 
        ? employees.filter(e => e.id === targetEmpId)
        : employees.filter(e => e.status === 'active' && !isEmployeeHiddenInMonth(e, monthKey));

    targetEmps.forEach(emp => {
        const hours: string[] = [];
        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const date = new Date(year, month, dayIdx + 1);
            const dow = date.getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
            const isHoliday = holidaySet.has(dateStr);
            hours.push(getTargetHours(emp, dow, isHoliday, settings));
        }
        result[emp.id] = hours;
    });

    return result;
}

/**
 * Aplica APENAS a rotação de folgas e domingos,
 * MANTENDO os horários diários (dailyHours) atuais inalterados.
 */
export function applyFolgasOnly(
    employees: Employee[],
    year: number,
    month: number,
    targetEmpId?: string,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
    protectedDays?: Record<number, number | ProtectedDayDetail> | number[]
): Record<string, ShiftType[]> {
    const monthData = applyMonthUpdate(employees, year, month, customHolidays, deletedNationalHolidays, settings, protectedDays, 'suggested_retro', targetEmpId);
    const result: Record<string, ShiftType[]> = {};

    if (targetEmpId) {
        if (monthData[targetEmpId]) {
            result[targetEmpId] = monthData[targetEmpId].shifts;
        }
    } else {
        Object.keys(monthData).forEach(empId => {
            result[empId] = monthData[empId].shifts;
        });
    }

    return result;
}

/**
 * Gera uma nova escala completa, limpa e inteligente para um mês-alvo.
 * 
 * Regras e validações automáticas aplicadas:
 * 1. Retro-análise do mês anterior (consecutivos de domingos + dias seguidos de trabalho CLT).
 * 2. Férias vigentes (aplica 'FE' APENAS nas datas reais e limpa férias antigas).
 * 3. Atestados vigentes (aplica 'AT' apenas durante as datas do atestado).
 * 4. Aniversário (aplica folga 'DO' no dia exato).
 * 5. Jovens Aprendizes (folga fim de semana + curso teórico 'C').
 * 6. Estoquistas (folga fixa domingo).
 * 7. CLT 6x1 e 5x2 (folgas fixas e rotação equitativa de domingos com limite inegociável de 2 domingos).
 * 8. Horários Diários (dailyHours baseados na jornada e workPeriod).
 * 9. Posições Táticas automáticas (P1 a P4 e ESTQ para quem trabalha).
 * 10. Otimização Peak-Centric para dias protegidos/sazonais configurados.
 */
export function generateCleanMonthSchedule(
    employees: Employee[],
    targetYear: number,
    targetMonth: number,
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
    protectedDays?: Record<number, number | ProtectedDayDetail> | number[],
    mode: 'suggested_retro' | 'all_working' = 'suggested_retro'
): Employee[] {
    const targetKey = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    const prevDate = new Date(targetYear, targetMonth - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // Preserva a ocultação de colaboradores vindos do mês anterior no novo rascunho
    const preparedEmployees = employees.map(emp => {
        if (emp.hiddenMonths?.[prevKey] && emp.hiddenMonths?.[targetKey] === undefined) {
            return {
                ...emp,
                hiddenMonths: {
                    ...(emp.hiddenMonths || {}),
                    [targetKey]: true
                }
            };
        }
        return emp;
    });
    
    // 1. Gera folgas e horários validados (com suporte a modo retroativo ou 100% trabalhado)
    const monthData = applyMonthUpdate(preparedEmployees, targetYear, targetMonth, customHolidays, deletedNationalHolidays, settings, protectedDays, mode);
    
    // 2. Aplica nos colaboradores
    return preparedEmployees.map(emp => {
        const d = monthData[emp.id];
        if (d) {
            return {
                ...emp,
                shifts: { ...emp.shifts, [targetKey]: d.shifts },
                dailyHours: { ...emp.dailyHours, [targetKey]: d.hours },
                decisionReasons: {
                    ...(emp.decisionReasons || {}),
                    [targetKey]: d.decisionReasons || {}
                },
                dailyAssignedRoles: {
                    ...(emp.dailyAssignedRoles || {}),
                    [targetKey]: d.dailyAssignedRoles || {}
                }
            };
        }
        return emp;
    });
}

