import {
    Employee,
    ShiftType,
    Holiday,
    JornadaSettings,
    ProtectedDayDetail
} from '../../../types';
import {
    DEFAULT_JORNADA_SETTINGS,
    buildHolidaySet,
    normalizeProtectedDaysDetails
} from '../../../constants';
import {
    WEEKDAY_NAMES,
    isBirthday,
    getPrevMonthWorkStreak
} from '../clt/clt-rules';
import {
    getPrevMonthConsecutive,
    buildSundayAssignments
} from '../clt/sunday-rotation';

/**
 * Otimiza a escala para QUALQUER conjunto customizado de Dias Protegidos / Períodos Sazonais.
 * 
 * Algoritmo Peak-Centric (Âncora no Pico -> Propagação para Trás e para Frente):
 * 1. Identifica os blocos de pico e quais colaboradores são de presença mandatória (todos ou específicos).
 * 2. Fixa presença (100% de trabalho) nos dias de pico para os colaboradores selecionados.
 * 3. Propagação para Trás (Lookback / Pré-Pico):
 *    - Escala folgas pré-pico nos dias D_start - 1, D_start - 2, D_start - 3 em grupos balanceados.
 *    - A partir dessa folga pré-pico, varre regressivamente até o Dia 1 garantindo conformidade 6x1 / 5x2.
 * 4. Propagação para Frente (Lookahead / Pós-Pico):
 *    - Imediatamente após D_end, agenda folgas obrigatórias nos dias D_end + 1, D_end + 2 em grupos.
 *    - A partir dessa folga pós-pico, varre progressivamente até o final do mês mantendo conformidade 6x1 / 5x2.
 */
export function optimizeProtectedDays(
    employees: Employee[],
    monthKey: string,
    protectedDays: Record<number, number | ProtectedDayDetail> | number[],
    customHolidays: Holiday[] = [],
    deletedNationalHolidays: string[] = [],
    settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, { shifts: ShiftType[] }> {
    const details = normalizeProtectedDaysDetails(protectedDays);
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const holidaySet = buildHolidaySet(year, customHolidays, deletedNationalHolidays);

    const protectedDaysList = Object.keys(details)
        .map(Number)
        .filter(d => d >= 1 && d <= daysInMonth)
        .sort((a, b) => a - b);

    const result: Record<string, { shifts: ShiftType[] }> = {};
    const activeRegular = employees.filter(e => e.status === 'active' && !e.isHidden && !e.isYoungApprentice);
    const activeApprentices = employees.filter(e => e.status === 'active' && !e.isHidden && e.isYoungApprentice);
    const prevStreaks = getPrevMonthWorkStreak(activeRegular, year, month);

    // Identifica todos os domingos do mês
    const sundaysInMonth: number[] = [];
    for (let d = 0; d < daysInMonth; d++) {
        if (new Date(year, month, d + 1).getDay() === 0) sundaysInMonth.push(d);
    }

    // Calcula rotação de domingos com histórico do mês anterior e respeito a domingos protegidos
    const prevConsecutive = getPrevMonthConsecutive(activeRegular, year, month);
    const { assignments: sundayAssignments } = buildSundayAssignments(
        activeRegular, year, month, sundaysInMonth, prevConsecutive, settings, details
    );

    // Identifica todos os índices protegidos no mês (0-indexed)
    const protectedIndicesSet = new Set(protectedDaysList.map(d => d - 1));

    // Agrupa dias protegidos em blocos contíguos (clusters)
    const clusters: { start: number; end: number; indices: number[] }[] = [];
    let currentCluster: number[] = [];

    for (let i = 0; i < protectedDaysList.length; i++) {
        const day = protectedDaysList[i];
        if (currentCluster.length === 0 || day === currentCluster[currentCluster.length - 1] + 1) {
            currentCluster.push(day);
        } else {
            clusters.push({
                start: currentCluster[0],
                end: currentCluster[currentCluster.length - 1],
                indices: currentCluster.map(d => d - 1)
            });
            currentCluster = [day];
        }
    }
    if (currentCluster.length > 0) {
        clusters.push({
            start: currentCluster[0],
            end: currentCluster[currentCluster.length - 1],
            indices: currentCluster.map(d => d - 1)
        });
    }

    // Helper para verificar status legal/especial
    const getLegalOverride = (emp: Employee, dayIdx: number): ShiftType | null => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
        if (emp.vacationStart && emp.vacationEnd && dateStr >= emp.vacationStart && dateStr <= emp.vacationEnd) return 'FE';
        if (emp.atestadoStart && emp.atestadoEnd && dateStr >= emp.atestadoStart && dateStr <= emp.atestadoEnd) return 'AT';
        if (isBirthday(emp, dateStr)) return 'DO';
        if ((emp.hiredAt && dateStr < emp.hiredAt) || (emp.firedAt && dateStr > emp.firedAt)) return 'N/A';
        return null;
    };

    // 1. Processa Jovens Aprendizes conforme legislação estrita
    activeApprentices.forEach(app => {
        const shifts: ShiftType[] = Array(daysInMonth).fill('T');
        const courseDayNormalized = app.courseDay ? app.courseDay.replace('-feira', '').trim() : '';

        for (let i = 0; i < daysInMonth; i++) {
            const date = new Date(year, month, i + 1);
            const dow = date.getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            const isHoliday = holidaySet.has(dateStr);

            const legal = getLegalOverride(app, i);
            if (legal) {
                shifts[i] = legal;
                continue;
            }

            // Proibido fins de semana e feriados
            if (dow === 0 || dow === 6 || isHoliday) {
                shifts[i] = 'F';
            } else if (courseDayNormalized && WEEKDAY_NAMES[dow] === courseDayNormalized) {
                shifts[i] = 'C';
            } else {
                shifts[i] = 'T';
            }
        }
        result[app.id] = { shifts };
    });

    // 2. Processa Colaboradores Regulares com Arquitetura de Cenário Ideal (4 Grupos Balanceados)
    activeRegular.forEach((emp, empIdx) => {
        const shifts: ShiftType[] = Array(daysInMonth).fill('T');
        const is5x2 = emp.jornada === '5x2';
        const maxStreak = is5x2 ? 5 : 6;
        const restSundays = sundayAssignments.get(emp.id) ?? new Set<number>();

        // Grupo balanceado para distribuição ideal de folgas (0: Seg, 1: Ter, 2: Qua, 3: Qui)
        const idealGroupSlot = empIdx % 4; // 0=Seg(dow 1), 1=Ter(dow 2), 2=Qua(dow 3), 3=Qui(dow 4)

        // Pass 1: Estrutura Base de Cenário Ideal (Dias de Semana, Sábados 100% e Domingos)
        for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
            const date = new Date(year, month, dayIdx + 1);
            const dow = date.getDay();

            const legal = getLegalOverride(emp, dayIdx);
            if (legal) {
                shifts[dayIdx] = legal;
                continue;
            }

            if (dow === 0) {
                // Domingo: segue rotação legal e domingos protegidos
                if (restSundays.has(dayIdx)) {
                    shifts[dayIdx] = 'F';
                } else {
                    shifts[dayIdx] = 'T';
                }
            } else if (dow === 6) {
                // Sábado: Cenário Ideal é 100% de Presença na loja
                shifts[dayIdx] = 'T';
            } else if (dow === 5) {
                // Sexta-feira: Alta Demanda (100% de trabalho na base)
                shifts[dayIdx] = 'T';
            } else {
                // Segunda a Quinta: Distribuição Harmônica de Folgas (~25% por dia)
                const groupTargetDow = idealGroupSlot + 1; // 1=Seg, 2=Ter, 3=Qua, 4=Qui
                if (dow === groupTargetDow) {
                    shifts[dayIdx] = 'F';
                } else {
                    shifts[dayIdx] = 'T';
                }
            }
        }

        // Pass 2: Aplicação do Motor Peak-Centric para Blocos de Dias Protegidos / Sazonais
        const relevantClusters = clusters.filter(cluster => {
            return cluster.indices.some(idx => {
                const dayNum = idx + 1;
                const dDetail = details[dayNum];
                if (!dDetail) return false;
                if (dDetail.mandatoryEmployeeIds && dDetail.mandatoryEmployeeIds.length > 0) {
                    return dDetail.mandatoryEmployeeIds.includes(emp.id);
                }
                return true;
            });
        });

        if (relevantClusters.length > 0) {
            // 2.1 Fixa Trabalho Contínuo no Pico (Peak Anchoring)
            relevantClusters.forEach(cluster => {
                cluster.indices.forEach(idx => {
                    const dayNum = idx + 1;
                    const dDetail = details[dayNum];
                    const isMandatory = !dDetail?.mandatoryEmployeeIds || dDetail.mandatoryEmployeeIds.length === 0 || dDetail.mandatoryEmployeeIds.includes(emp.id);
                    if (isMandatory && !getLegalOverride(emp, idx)) {
                        shifts[idx] = 'T';
                    }
                });
            });

            // 2.2 Lookback e Lookahead em 4 Grupos de Revezamento Simétricos
            relevantClusters.forEach((cluster, clusterIdx) => {
                const startIdx = cluster.indices[0];
                const endIdx = cluster.indices[cluster.indices.length - 1];
                const clusterLength = cluster.indices.length;

                // Lookback Pré-Pico: escalona folgas em D - 4, D - 3, D - 2, D - 1
                const lookbackSlots = Math.min(4, Math.max(2, maxStreak - clusterLength + 1));
                const groupSlot = (empIdx + clusterIdx) % lookbackSlots;
                const preRestOffset = groupSlot + 1;
                const preRestIdx = startIdx - preRestOffset;

                if (preRestIdx >= 0 && !getLegalOverride(emp, preRestIdx) && !protectedIndicesSet.has(preRestIdx)) {
                    shifts[preRestIdx] = 'F';

                    // Garante trabalho contínuo da folga pré-pico até o início do pico
                    for (let k = preRestIdx + 1; k < startIdx; k++) {
                        if (!getLegalOverride(emp, k)) {
                            shifts[k] = 'T';
                        }
                    }

                    // Propaga regressivamente para trás até o Dia 1
                    let backStreak = 0;
                    for (let b = preRestIdx - 1; b >= 0; b--) {
                        const s = shifts[b];
                        if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) {
                            backStreak = 0;
                        } else {
                            backStreak++;
                            if (backStreak >= maxStreak) {
                                if (!getLegalOverride(emp, b) && !protectedIndicesSet.has(b)) {
                                    shifts[b] = 'F';
                                    backStreak = 0;
                                }
                            }
                        }
                    }
                }

                // Lookahead Pós-Pico: escalona folgas pós-pico imediatas
                let workStreakAtPeakEnd = clusterLength;
                for (let k = startIdx - 1; k >= 0; k--) {
                    const s = shifts[k];
                    if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) break;
                    workStreakAtPeakEnd++;
                }

                const postRestOffset = (workStreakAtPeakEnd >= maxStreak) ? 1 : ((empIdx % 2 === 0) ? 1 : 2);
                const postRestIdx = endIdx + postRestOffset;

                if (postRestIdx < daysInMonth && !getLegalOverride(emp, postRestIdx) && !protectedIndicesSet.has(postRestIdx)) {
                    shifts[postRestIdx] = 'F';

                    if (postRestOffset === 2 && endIdx + 1 < daysInMonth && !getLegalOverride(emp, endIdx + 1)) {
                        shifts[endIdx + 1] = 'T';
                    }

                    // Propaga progressivamente para frente até o final do mês
                    let fwdStreak = 0;
                    for (let f = postRestIdx + 1; f < daysInMonth; f++) {
                        const s = shifts[f];
                        if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) {
                            fwdStreak = 0;
                        } else {
                            fwdStreak++;
                            if (fwdStreak >= maxStreak) {
                                if (!getLegalOverride(emp, f) && !protectedIndicesSet.has(f)) {
                                    shifts[f] = 'F';
                                    fwdStreak = 0;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Pass 3: Varredura de Integridade CLT 6x1 / 5x2 com Carryover do Mês Anterior
        const prevStreak = prevStreaks.get(emp.id) || 0;
        let streak = prevStreak;

        for (let i = 0; i < daysInMonth; i++) {
            const s = shifts[i];
            if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) {
                streak = 0;
            } else {
                streak++;
                if (streak > maxStreak) {
                    if (!protectedIndicesSet.has(i) && !getLegalOverride(emp, i)) {
                        shifts[i] = 'F';
                        streak = 0;
                    } else {
                        // Se o dia i for protegido, recua para encontrar o dia anterior não-protegido para folga
                        for (let b = i - 1; b >= 0; b--) {
                            if (!protectedIndicesSet.has(b) && !getLegalOverride(emp, b) && shifts[b] === 'T') {
                                shifts[b] = 'F';
                                streak = i - b;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Pass 4: Suporte e Equilíbrio Semanal para Jornadas 5x2 (Garante 2 folgas por semana)
        if (is5x2) {
            for (let w = 0; w < daysInMonth; w += 7) {
                const weekIndices = [];
                for (let k = 0; k < 7 && w + k < daysInMonth; k++) weekIndices.push(w + k);
                const weekRests = weekIndices.filter(k => ['F', 'FE', 'AT', 'DO', 'N/A'].includes(shifts[k]) || shifts[k]?.startsWith('FF'));
                if (weekRests.length < 2) {
                    const candidate = weekIndices.find(k => {
                        const d = new Date(year, month, k + 1).getDay();
                        return !protectedIndicesSet.has(k) && !getLegalOverride(emp, k) && shifts[k] === 'T' && d !== 6;
                    });
                    if (candidate !== undefined) {
                        shifts[candidate] = 'F';
                    }
                }
            }
        }

        result[emp.id] = { shifts };
    });

    return result;
}
