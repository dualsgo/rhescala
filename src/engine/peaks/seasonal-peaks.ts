import { DEFAULT_JORNADA_SETTINGS, isEmployeeHiddenInMonth, getEffectiveJornadaOnDate } from '../config/schedule-constants';
import { getPrevMonthWorkStreak } from '../clt/clt-rules';
import { isProtectedShift } from '../clt/legal-overrides';
import { Employee, Holiday, JornadaSettings, ShiftType } from '../../../types';

/**
 * Otimiza a semana de pico do Dia das Crianças (8 a 12 de Outubro) para concentrar
 * 100% da equipe disponível trabalhando nos dias 8, 9, 10, 11 e 12.
 * 
 * Regras e Engenharia CLT 6x1 / 5x2:
 * 1. Dias Críticos (8 a 12 de Outubro): Nenhum colaborador CLT regular folga nestes 5 dias.
 *    (Férias 'FE', Atestado 'AT', Aniversário 'DO' e 'N/A' são rigorosamente preservados).
 * 2. Janela Pré-Pico (Dias 6 e 7): Escalonamento estratégico das folgas:
 *    - Grupo A (empIdx % 2 === 0): Folga no Dia 6 (Oct 6), trabalha 7..12 (6 dias consecutivos).
 *    - Grupo B (empIdx % 2 === 1): Folga no Dia 7 (Oct 7), trabalha 8..13 (6 dias consecutivos).
 * 3. Janela Pós-Pico (Dias 13 e 14): Escalonamento cruzado obrigatório:
 *    - Grupo A: Folga no Dia 13 (Oct 13), zerando o streak após 6 dias trabalhados.
 *    - Grupo B: Folga no Dia 14 (Oct 14), zerando o streak após 6 dias trabalhados.
 * 4. Validação Geral 6x1 e 5x2 no Mês (1..31):
 *    - Dias 1 a 5: Garante que ninguém entre na janela de pico acumulando mais de 6 dias trabalhados (6x1)
 *      ou 5 dias (5x2).
 * 5. Jovem Aprendiz:
 *    - Folga obrigatória aos sábados, domingos e no feriado de 12/10, além do dia de curso teórico.
 */
export function optimizeOctoberPeak(
    employees: Employee[],
    monthKey: string,
    _customHolidays: Holiday[] = [],
    _deletedNationalHolidays: string[] = [],
    _settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, { shifts: ShiftType[] }> {
    const result: Record<string, { shifts: ShiftType[] }> = {};
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // 31

    const activeRegular = employees.filter(e => e.status === 'active' && !isEmployeeHiddenInMonth(e, monthKey) && !e.isYoungApprentice);
    const prevStreaks = getPrevMonthWorkStreak(activeRegular, year, month);

    // Dias Críticos de Pico do Dia das Crianças: 8, 9, 10, 11, 12
    const criticalDays = [8, 9, 10, 11, 12];
    const criticalIndices = criticalDays.map(d => d - 1); // 7, 8, 9, 10, 11 (0-indexed)

    activeRegular.forEach((emp, empIdx) => {
        const shifts = [...(emp.shifts[monthKey] || Array(daysInMonth).fill('T'))];
        const is5x2 = emp.jornada === '5x2';
        const maxStreak = is5x2 ? 5 : 6;

        // Status protegidos que nunca são sobrescritos (Férias, Atestado, Aniversário, Não-admitido)
        const isProtected = (idx: number) => isProtectedShift(shifts[idx]);

        // 1. Limpa folgas comuns 'F' nos 5 dias de pico (8 a 12) -> presença 100%!
        criticalIndices.forEach(idx => {
            if (shifts[idx] === 'F') {
                shifts[idx] = 'T';
            }
        });

        // 2. Escalonamento cirúrgico de folgas Pré-Pico (dias 6 e 7) e Pós-Pico (dias 13 e 14)
        const isGroupA = empIdx % 2 === 0;

        if (isGroupA) {
            // Grupo A: Folga dia 6, trabalha 7..12 (6 dias), folga dia 13
            if (!isProtected(5)) shifts[5] = 'F';  // Dia 6
            if (!isProtected(6)) shifts[6] = 'T';  // Dia 7
            if (!isProtected(12)) shifts[12] = 'F'; // Dia 13
            if (!isProtected(13)) shifts[13] = 'T'; // Dia 14
        } else {
            // Grupo B: Folga dia 7, trabalha 8..13 (6 dias), folga dia 14
            if (!isProtected(5)) shifts[5] = 'T';  // Dia 6
            if (!isProtected(6)) shifts[6] = 'F';  // Dia 7
            if (!isProtected(12)) shifts[12] = 'T'; // Dia 13
            if (!isProtected(13)) shifts[13] = 'F'; // Dia 14
        }

        // 3. Validação do Início do Mês (Dias 1 a 5) para prevenir estouro de 6x1 antes do Dia 6/7
        const prevStreak = prevStreaks.get(emp.id) || 0;
        let streak = prevStreak;
        for (let i = 0; i < 5; i++) {
            if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(shifts[i]) || shifts[i]?.startsWith('FF')) {
                streak = 0;
            } else {
                streak++;
                if (streak > maxStreak) {
                    if (!isProtected(i)) {
                        shifts[i] = 'F';
                        streak = 0;
                    }
                }
            }
        }

        // 4. Suporte a jornada 5x2 (2 folgas semanais)
        if (is5x2) {
            const w1Rests = [0, 1, 2, 3, 4, 5, 6].filter(i => ['F', 'FE', 'AT', 'DO'].includes(shifts[i]));
            if (w1Rests.length < 2) {
                const addIdx = isGroupA ? 1 : 2;
                if (!isProtected(addIdx) && shifts[addIdx] === 'T') {
                    shifts[addIdx] = 'F';
                }
            }
        }

        // 5. Varredura completa do mês (dias 1 a 31) garantindo 0 violações 6x1 / 5x2
        streak = prevStreak;
        for (let i = 0; i < daysInMonth; i++) {
            const s = shifts[i];
            if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) {
                streak = 0;
            } else {
                streak++;
                if (streak > maxStreak) {
                    if (!criticalIndices.includes(i)) {
                        if (!isProtected(i)) {
                            shifts[i] = 'F';
                            streak = 0;
                        }
                    } else {
                        // Se atingir limite no pico, insere folga imediatamente antes nos dias permitidos
                        for (let b = i - 1; b >= 0; b--) {
                            if (!criticalIndices.includes(b) && !isProtected(b)) {
                                shifts[b] = 'F';
                                streak = i - b;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // 6. Otimização de cobertura fora do pico (remove folgas 'F' duplicadas consecutivas desnecessárias)
        for (let i = 1; i < daysInMonth; i++) {
            if (!is5x2 && shifts[i] === 'F' && shifts[i - 1] === 'F' && i !== 5 && i !== 6 && i !== 12 && i !== 13) {
                const nextRest = shifts.slice(i + 1).findIndex(x => ['F', 'FE', 'AT', 'DO', 'N/A'].includes(x));
                if (nextRest !== -1 && nextRest <= 5) {
                    shifts[i] = 'T';
                }
            }
        }

        result[emp.id] = { shifts };
    });

    return result;
}

/**
 * Otimiza a semana de pico do Natal (20 a 24 de Dezembro) para concentrar
 * 100% da equipe disponível trabalhando nos dias 20, 21, 22, 23 e 24.
 * 
 * Regras e Engenharia CLT 6x1 / 5x2:
 * 1. Dias Críticos (20 a 24 de Dezembro): Nenhum colaborador CLT regular folga nestes 5 dias.
 *    (Férias 'FE', Atestado 'AT', Aniversário 'DO' e 'N/A' são rigorosamente preservados).
 * 2. Janela Pré-Pico (Dias 18 e 19): Escalonamento estratégico das folgas:
 *    - Grupo A (empIdx % 2 === 0): Folga no Dia 18 (Dec 18), trabalha 19..24 (6 dias consecutivos).
 *    - Grupo B (empIdx % 2 === 1): Folga no Dia 19 (Dec 19), trabalha 20..24 (5 dias consecutivos).
 * 3. Janela Pós-Pico (Dia 25 - Feriado de Natal):
 *    - Dia 25 de Dezembro é feriado nacional de Natal. As lojas em geral operam com escala mínima ou fechadas.
 *    - Folga no Dia 25 zera o streak de 6x1 do Grupo A (trabalhou 19..24 = 6 dias) e do Grupo B (trabalhou 20..24 = 5 dias).
 * 4. Validação Geral 6x1 e 5x2 no Mês (1..31):
 *    - Semanas 1 e 2 (Dias 1 a 17): Mantém folgas semanais alinhadas às preferências e rotação de domingos.
 *    - Dias 26 a 31: Retoma a rotação regular de folgas com 0 violações 6x1/5x2.
 * 5. Jovem Aprendiz:
 *    - Folga obrigatória aos sábados, domingos e no feriado de Natal (25/12), além do dia de curso teórico.
 */
export function optimizeDecemberPeak(
    employees: Employee[],
    monthKey: string,
    _customHolidays: Holiday[] = [],
    _deletedNationalHolidays: string[] = [],
    _settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS
): Record<string, { shifts: ShiftType[] }> {
    const result: Record<string, { shifts: ShiftType[] }> = {};
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // 31

    const activeRegular = employees.filter(e => e.status === 'active' && !isEmployeeHiddenInMonth(e, monthKey) && !e.isYoungApprentice);
    const prevStreaks = getPrevMonthWorkStreak(activeRegular, year, month);

    // Dias Críticos de Pico do Natal: 20, 21, 22, 23, 24
    const criticalDays = [20, 21, 22, 23, 24];
    const criticalIndices = criticalDays.map(d => d - 1); // 19, 20, 21, 22, 23 (0-indexed)

    activeRegular.forEach((emp, empIdx) => {
        const shifts = [...(emp.shifts[monthKey] || Array(daysInMonth).fill('T'))];
        const prevStreak = prevStreaks.get(emp.id) || 0;

        const isProtected = (idx: number) => isProtectedShift(shifts[idx]);
        const isRestCode = (s: ShiftType | undefined) =>
            ['F', 'LF', 'FE', 'AT', 'DO', 'N/A'].includes(s as string) || Boolean(s?.startsWith('FF'));

        // 1. Limpa folgas comuns 'F' nos 5 dias de pico do Natal (20 a 24)
        criticalIndices.forEach(idx => {
            if (shifts[idx] === 'F') {
                shifts[idx] = 'T';
            }
        });

        // 2. Escalonamento cirúrgico de folgas Pré-Pico (dias 18 e 19) e Pós-Pico (25 = LF Loja Fechada + 26/27 no 5x2)
        const isGroupA = empIdx % 2 === 0;

        if (isGroupA) {
            // Grupo A: Folga dia 18, trabalha 19..24 (6 dias — legal CLT), dia 25 Loja Fechada (LF) e 27 (2ª folga 5x2)
            if (!isProtected(17)) shifts[17] = 'F';  // Dia 18
            if (!isProtected(18)) shifts[18] = 'T';  // Dia 19
            if (!isProtected(24)) shifts[24] = 'LF'; // Dia 25 (Natal — Loja Fechada)
            if (!isProtected(25)) shifts[25] = 'T';  // Dia 26
            if (!isProtected(26)) shifts[26] = 'F';  // Dia 27 (2ª folga da semana 5x2)
        } else {
            // Grupo B: Folga dia 19, trabalha 20..24 (5 dias), dia 25 Loja Fechada (LF) e 26 (2ª folga 5x2)
            if (!isProtected(17)) shifts[17] = 'T';  // Dia 18
            if (!isProtected(18)) shifts[18] = 'F';  // Dia 19
            if (!isProtected(24)) shifts[24] = 'LF'; // Dia 25 (Natal — Loja Fechada)
            if (!isProtected(25)) shifts[25] = 'F';  // Dia 26 (2ª folga da semana 5x2)
            if (!isProtected(26)) shifts[26] = 'T';  // Dia 27
        }

        // 3. Validação do Período Anterior (Dias 1 a 17) garantindo teto CLT (6x1) antes do Dia 18/19
        let streak = prevStreak;
        for (let i = 0; i < 17; i++) {
            if (isRestCode(shifts[i])) {
                streak = 0;
            } else {
                streak++;
                if (streak > 6) {
                    if (!isProtected(i)) {
                        shifts[i] = 'F';
                        streak = 0;
                    }
                }
            }
        }

        // 4. Semana de transição 14/12 a 20/12 (indices 13..19): garante 2 folgas na semana (5x2 a partir de 16/12)
        // sem tirar presença dos dias de pico (20/12 = idx 19)
        const transitionWeek = [13, 14, 15, 16, 17, 18, 19]; // 14..20/12
        const transitionRests = transitionWeek.filter(i => isRestCode(shifts[i]));
        if (transitionRests.length < 2) {
            const firstHalfCandidate = isGroupA ? 14 : 15; // 15/12 ou 16/12
            if (!isProtected(firstHalfCandidate) && shifts[firstHalfCandidate] === 'T') {
                shifts[firstHalfCandidate] = 'F';
            }
        }

        // 5. Varredura completa do mês garantindo 0 violações CLT (nunca passa de 6 dias seguidos / trava 7º dia)
        streak = prevStreak;
        for (let i = 0; i < daysInMonth; i++) {
            const s = shifts[i];
            if (isRestCode(s)) {
                streak = 0;
            } else {
                streak++;
                const dateStr = `${yearStr}-${monthStr}-${String(i + 1).padStart(2, '0')}`;
                const hardCap = 6; // Art. 67 CLT / OJ 410 (inclusive na transição 5x2)
                const is5x2Date = getEffectiveJornadaOnDate(emp, dateStr) === '5x2';
                const targetCap = is5x2Date && i >= 25 ? 5 : hardCap;

                if (streak > targetCap) {
                    if (!criticalIndices.includes(i)) {
                        if (!isProtected(i)) {
                            shifts[i] = 'F';
                            streak = 0;
                        }
                    } else {
                        // Se atingir limite no pico, insere folga imediatamente antes (dias 18/19)
                        for (let b = i - 1; b >= 0; b--) {
                            if (!criticalIndices.includes(b) && !isProtected(b)) {
                                shifts[b] = 'F';
                                streak = i - b;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // 6. Otimização de cobertura fora do pico (remove folgas 'F' duplicadas consecutivas em 6x1 até dia 15/12)
        for (let i = 1; i < 15; i++) {
            if (emp.jornada !== '5x2' && shifts[i] === 'F' && shifts[i - 1] === 'F') {
                const nextRest = shifts.slice(i + 1).findIndex(x => isRestCode(x));
                if (nextRest !== -1 && nextRest <= 5) {
                    shifts[i] = 'T';
                }
            }
        }

        result[emp.id] = { shifts };
    });

    return result;
}

/**
 * Otimiza a semana de pico (ex: Natal 18 a 24 de Dezembro) para concentrar 100% da equipe
 * nos dias críticos (22, 23 e 24), alocando as folgas obrigatórias da semana de forma
 * escalonada entre os dias 18 e 21 sem violar a regra CLT 6x1.
 */
export function optimizePeakWeek(
    employees: Employee[],
    monthKey: string,
    startDay: number = 18,
    endDay: number = 24,
    criticalDays: number[] = [22, 23, 24]
): Record<string, { shifts: ShiftType[] }> {
    const result: Record<string, { shifts: ShiftType[] }> = {};
    const activeEmps = employees.filter(e => e.status === 'active' && !isEmployeeHiddenInMonth(e, monthKey) && !e.isYoungApprentice);

    // Janela pré-pico para distribuição de folgas (ex: 18, 19, 20, 21)
    const prePeakDays: number[] = [];
    for (let d = startDay; d <= endDay; d++) {
        if (!criticalDays.includes(d)) {
            prePeakDays.push(d);
        }
    }

    const [y, m] = monthKey.split('-').map(Number);
    const daysInMonth = (y && m) ? new Date(y, m, 0).getDate() : 31;

    activeEmps.forEach((emp, empIdx) => {
        const shifts = [...(emp.shifts[monthKey] || Array(daysInMonth).fill('T'))];
        
        // 1. Remover folgas simples nos dias críticos de pico (ex: 22, 23, 24)
        criticalDays.forEach(day => {
            const dayIdx = day - 1;
            if (shifts[dayIdx] === 'F') {
                shifts[dayIdx] = 'T';
            }
        });

        // 2. Definir a folga semanal escalonada na janela pré-pico (18-21)
        if (prePeakDays.length > 0) {
            const assignedDay = prePeakDays[empIdx % prePeakDays.length];
            const assignedIdx = assignedDay - 1;

            // Limpa folgas comuns dos outros dias da semana de pico
            for (let d = startDay; d <= endDay; d++) {
                const idx = d - 1;
                if (shifts[idx] === 'F' && idx !== assignedIdx) {
                    shifts[idx] = 'T';
                }
            }

            // Atribui folga no dia escalonado (se não for Férias/Atestado/DayOff)
            if (!['FE', 'AT', 'DO'].includes(shifts[assignedIdx])) {
                shifts[assignedIdx] = 'F';
            }
        }

        // 3. Validação final de 6x1 (garante no máximo 6 dias seguidos de trabalho)
        let streak = 0;
        for (let i = 0; i < shifts.length; i++) {
            const s = shifts[i];
            if (['F', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s?.startsWith('FF')) {
                streak = 0;
            } else {
                streak++;
                if (streak > 6) {
                    // Se estourar 6x1, insere folga antes do limite nos dias permitidos
                    if (i < shifts.length - 1 && !criticalDays.includes(i + 1)) {
                        shifts[i] = 'F';
                        streak = 0;
                    }
                }
            }
        }

        result[emp.id] = { shifts };
    });

    return result;
}
