import {
    Employee,
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
    normalizeProtectedDaysDetails
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

/**
 * "Smart Update" para geração/atualização mensal completa de escala.
 * 
 * Modos de operação:
 * - 'suggested_retro': Motor inteligente com verificação retroativa CLT (domingos e 6x1 contínuos).
 * - 'all_working': Modo base 100% trabalhado (preserva férias/afastamentos/aniversário para ajuste manual).
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
    targetEmpId?: string
): Record<string, { shifts: ShiftType[]; hours: string[]; decisionReasons?: Record<number, DecisionReason> }> {
    const result: Record<string, { shifts: ShiftType[]; hours: string[]; decisionReasons?: Record<number, DecisionReason> }> = {};

    const activeRegular = employees.filter(e => e.status === 'active' && !e.isYoungApprentice);
    const activeApprentices = employees.filter(e => e.status === 'active' && e.isYoungApprentice);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

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

    targetEmps.forEach(emp => {
        const restSundays = sundayAssignments.get(emp.id) ?? new Set<number>();
        const is5x2 = emp.jornada === '5x2';
        const maxStreak = is5x2 ? 5 : 6;
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
            const legal = getLegalOverride(emp, dayIdx);

            // 3.1 Se houver condição legal (Férias, Atestado, Aniversário, Não-contratado)
            if (legal) {
                shifts[dayIdx] = legal;
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

            // 3.6 Para 5x2 sem dia preferido, folga aos sábados
            if (is5x2 && dow === 6) {
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

        // 3.8 Para jornada 5x2: assegura 2 folgas por semana
        if (is5x2) {
            for (let w = 0; w < daysInMonth; w += 7) {
                const weekIndices: number[] = [];
                for (let k = 0; k < 7 && w + k < daysInMonth; k++) weekIndices.push(w + k);
                const weekRests = weekIndices.filter(k => ['F', 'FE', 'AT', 'DO', 'N/A'].includes(shifts[k]) || shifts[k]?.startsWith('FF'));
                if (weekRests.length < 2) {
                    const candidate = weekIndices.find(k => {
                        const d = new Date(year, month, k + 1).getDay();
                        return shifts[k] === 'T' && d !== 6 && !getLegalOverride(emp, k);
                    });
                    if (candidate !== undefined) {
                        shifts[candidate] = 'F';
                        decisionReasons[candidate] = 'PREFERRED_DAY_OFF';
                    }
                }
            }
        }

        result[emp.id] = { shifts, hours, decisionReasons };
    });

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

            // Find all Sundays in this month
            const sundaysInMonth: number[] = [];
            for (let d = 0; d < daysInMonth; d++) {
                if (new Date(year, month, d + 1).getDay() === 0) sundaysInMonth.push(d);
            }

            // Build Sunday assignments — with cross-month carry
            const { assignments, nextConsecutive } = buildSundayAssignments(
                activeRegular, year, month, sundaysInMonth, rollingConsecutive, settings
            );
            rollingConsecutive = nextConsecutive;

            // Generate each regular employee
            activeRegular.forEach(emp => {
                if (!result[emp.id]) result[emp.id] = {};
                result[emp.id][monthKey] = generateMonthForEmployee(
                    emp, year, month,
                    assignments.get(emp.id) ?? new Set(),
                    customHolidays,
                    deletedNationalHolidays
                );
            });

            // Generate each apprentice
            activeApprentices.forEach(emp => {
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
    const targetEmps = targetEmpId 
        ? employees.filter(e => e.id === targetEmpId)
        : employees.filter(e => e.status === 'active' && !e.isHidden);

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
    
    // 1. Gera folgas e horários validados (com suporte a modo retroativo ou 100% trabalhado)
    const monthData = applyMonthUpdate(employees, targetYear, targetMonth, customHolidays, deletedNationalHolidays, settings, protectedDays, mode);
    
    // 2. Aplica nos colaboradores
    return employees.map(emp => {
        const d = monthData[emp.id];
        if (d) {
            return {
                ...emp,
                shifts: { ...emp.shifts, [targetKey]: d.shifts },
                dailyHours: { ...emp.dailyHours, [targetKey]: d.hours },
                decisionReasons: {
                    ...(emp.decisionReasons || {}),
                    [targetKey]: d.decisionReasons || {}
                }
            };
        }
        return emp;
    });
}

