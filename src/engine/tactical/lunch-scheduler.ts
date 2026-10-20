import { DEFAULT_JORNADA_SETTINGS } from '../config/schedule-constants';
import { JornadaSettings } from '../../../types';
import { getShiftClassification } from '../shifts/shift-predicates';

/**
 * Funções operacionais reconhecidas na loja.
 * O antigo 'Repositor' é mapeado para a função atual 'Apoio'.
 */
export type OperationalRole = 'Caixa' | 'Vendas' | 'Pacote' | 'Apoio' | 'Estoque' | 'Fiscal' | 'Outro';

/**
 * Normaliza e resolve a função operacional do colaborador a partir de seus dados.
 * Reconhece exclusivamente as funções atuais da operação:
 * - Caixa
 * - Vendas
 * - Pacote
 * - Apoio (com suporte a Repositor para compatibilidade histórica)
 */
export function resolveOperationalRole(m: any, options?: { roles?: Record<string, string> }): OperationalRole {
  if (!m) return 'Outro';

  const explicit = options?.roles?.[m.id];
  const candidateStr = explicit || m.funcao || m.role || m.operationalRole || m.cargo || '';
  const raw = String(candidateStr).trim().toLowerCase();

  if (raw.includes('caixa')) return 'Caixa';
  if (raw.includes('venda')) return 'Vendas';
  if (raw.includes('pacote')) return 'Pacote';
  if (raw.includes('apoio') || raw.includes('reposit') || raw.includes('reposi')) return 'Apoio';
  if (raw.includes('estoq')) return 'Estoque';
  if (raw.includes('fisc')) return 'Fiscal';

  if (m.cargo === 'Estoquista') return 'Estoque';

  return 'Outro';
}

/**
 * Representação interna de alocação de almoço com intervalo temporal real em minutos.
 */
export interface LunchAllocation {
  member: any;
  employeeId?: string;
  employeeName?: string;
  index: number;
  timeStr: string;
  lunchSlot?: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  classification: 'Abertura' | 'Intermediário' | 'Fechamento' | 'N/A';
  role: OperationalRole;
  isFixed?: boolean;
  coveredByEmployeeId?: string;
  coveredByEmployeeName?: string;
  coveringCashierTime?: string;
  isCoveringCashier?: boolean;
  coveringEmployeeId?: string;
}

export type DetailedLunchAssignment = LunchAllocation;

/**
 * Converte string de período de trabalho para minutos a partir da meia-noite [startMin, endMin].
 * Exemplos aceitos: "10h às 18h20", "13h40 às 22h", "12h às 20h", "10:00 - 18:20", "10h".
 */
export function parseWorkPeriodMinutes(
  periodStr: string,
  fallbackStartHour: number = 10,
  fallbackDurationHours: number = 8.33
): { startMin: number; endMin: number } {
  if (periodStr) {
    const rangeMatch = String(periodStr).match(/(\d{1,2})(?:[h:](\d{2}))?\s*(?:às|-)\s*(\d{1,2})(?:[h:](\d{2}))?/i);
    if (rangeMatch) {
      const sH = parseInt(rangeMatch[1], 10);
      const sM = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
      const eH = parseInt(rangeMatch[3], 10);
      const eM = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : 0;
      return {
        startMin: sH * 60 + sM,
        endMin: eH * 60 + eM,
      };
    }
    const singleMatch = String(periodStr).match(/^(\d{1,2})(?:[h:](\d{2}))?/i);
    if (singleMatch) {
      const sH = parseInt(singleMatch[1], 10);
      const sM = singleMatch[2] ? parseInt(singleMatch[2], 10) : 0;
      return {
        startMin: sH * 60 + sM,
        endMin: Math.round(sH * 60 + sM + fallbackDurationHours * 60),
      };
    }
  }
  return {
    startMin: fallbackStartHour * 60,
    endMin: Math.round((fallbackStartHour + fallbackDurationHours) * 60),
  };
}

/**
 * Formata minutos em string amigável de horário (ex: 810 -> "13h30", 870 + 15 min feriado -> "14h30 (15 min)").
 */
export function formatLunchMinutes(startMin: number, durationMin: number, isHoliday: boolean): string {
  const h = Math.floor(startMin / 60);
  const m = startMin % 60;
  const timeStr = `${h}h${m === 0 ? '' : (m < 10 ? '0' + m : m)}`;
  if (isHoliday && durationMin === 15) {
    return `${timeStr} (15 min)`;
  }
  return timeStr;
}

/**
 * Extrai a string de horário de um colaborador a partir de propriedades conhecidas.
 */
function extractHourString(m: any, options?: { monthKey?: string; dayIdx?: number }): string {
  if (!m) return '';
  if (m.hour) return String(m.hour);
  if (options?.monthKey && options?.dayIdx !== undefined && m.dailyHours?.[options.monthKey]?.[options.dayIdx]) {
    return String(m.dailyHours[options.monthKey][options.dayIdx]);
  }
  if (m.workPeriod) return String(m.workPeriod);
  return '';
}

/**
 * Motor central de cálculo detalhado de almoços da equipe do dia.
 * Considera a equipe completa, funções operacionais (Caixa, Vendas, Pacote, Apoio),
 * alternância dinâmica de Caixas, prioridade de intermediário sobre fechamento e horários fixos.
 */
export function calculateDetailedLunches(
  members: any[],
  isHoliday: boolean,
  isSunday: boolean,
  isOpeningHint?: boolean,
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
  options?: {
    roles?: Record<string, string>;
    monthKey?: string;
    dayIdx?: number;
  }
): LunchAllocation[] {
  if (!members || members.length === 0) return [];

  interface Candidate {
    member: any;
    index: number;
    id: string;
    name: string;
    cargo: string;
    role: OperationalRole;
    isCaixa: boolean;
    isApprentice: boolean;
    isEstoquista: boolean;
    hourStr: string;
    startMin: number;
    endMin: number;
    classification: 'Abertura' | 'Intermediário' | 'Fechamento' | 'N/A';
    durationMin: number;
    fixedTimeStr?: string;
    allocatedStartMin?: number;
    allocatedEndMin?: number;
    coveredByEmployeeId?: string;
    coveredByEmployeeName?: string;
    coveringCashierTime?: string;
    isCoveringCashier?: boolean;
    coveringEmployeeId?: string;
  }

  // 1. Normalização individual de cada colaborador a partir de sua jornada real
  const normalized: Candidate[] = members.map((m, idx) => {
    if (!m) {
      return {
        member: m,
        index: idx,
        id: String(idx),
        name: '',
        cargo: '',
        role: 'Outro',
        isCaixa: false,
        isApprentice: false,
        isEstoquista: false,
        hourStr: '',
        startMin: 600,
        endMin: 1100,
        classification: 'Abertura',
        durationMin: 60,
      };
    }

    const isApprentice = Boolean(m.isYoungApprentice || m.cargo === 'Aprendiz' || m.cargo === 'Jovem Aprendiz');
    const isEstoquista = m.cargo === 'Estoquista';
    const hourStr = extractHourString(m, options);

    // Classificação individual a partir do horário real
    let classification = getShiftClassification(hourStr, isSunday, settings);
    if (classification === 'N/A') {
      if (isApprentice) {
        classification = 'Abertura';
      } else if (isOpeningHint !== undefined) {
        classification = isOpeningHint ? 'Abertura' : 'Fechamento';
      } else {
        classification = 'Abertura';
      }
    }

    // Função operacional atual (Caixa, Vendas, Pacote, Apoio)
    const role = resolveOperationalRole(m, options);
    const isCaixa = role === 'Caixa';

    // Determina horários de entrada e saída reais
    let fallbackStartHour = 10;
    let fallbackDuration = 8.33;
    if (isHoliday) {
      fallbackStartHour = classification === 'Fechamento' ? 14 : 12;
      fallbackDuration = 6;
    } else if (isSunday) {
      fallbackStartHour = classification === 'Fechamento' ? 13 : 12;
      fallbackDuration = 8;
    } else {
      if (classification === 'Intermediário') {
        fallbackStartHour = 12;
      } else if (classification === 'Fechamento') {
        fallbackStartHour = 13.67; // ~13h40
      }
    }

    const { startMin, endMin } = parseWorkPeriodMinutes(hourStr, fallbackStartHour, fallbackDuration);

    // Duração do intervalo
    let durationMin = 60;
    if (isApprentice) {
      durationMin = 15;
    } else if (isHoliday) {
      durationMin = 15;
    } else if (endMin - startMin <= 360) {
      durationMin = 15;
    }

    let fixedTimeStr: string | undefined;
    if (isApprentice) {
      fixedTimeStr = settings?.lunchRules?.apprentice || '12h45';
    }

    return {
      member: m,
      index: idx,
      id: m.id || String(idx),
      name: m.name || m.firstName || '',
      cargo: m.cargo || '',
      role,
      isCaixa,
      isApprentice,
      isEstoquista,
      hourStr,
      startMin,
      endMin,
      classification,
      durationMin,
      fixedTimeStr,
    };
  });

  // Linha do tempo: rastreia colaboradores e caixas em almoço
  const activeLunches: { startMin: number; endMin: number; isCaixa: boolean; candidateId: string }[] = [];

  // Rastreia a capacidade considerando estritamente as pessoas efetivamente presentes naquele minuto t
  const getCapacityAt = (t: number) => {
    let present = 0; // Pessoas em jornada efetiva naquele minuto t (já entraram e ainda não saíram)
    let onLunch = 0; // Pessoas em intervalo naquele minuto t
    let caixasPresent = 0;
    let caixasOnLunch = 0;

    for (const c of normalized) {
      if (c.startMin <= t && c.endMin > t) {
        present++;
        if (c.isCaixa) caixasPresent++;
      }
    }

    for (const alloc of activeLunches) {
      if (alloc.startMin <= t && alloc.endMin > t) {
        onLunch++;
        if (alloc.isCaixa) caixasOnLunch++;
      }
    }

    const available = present - onLunch; // Pessoas trabalhando naquele momento
    const coverageRatio = present > 0 ? available / present : 1;

    return {
      present,
      working: present, // Compatibilidade com leituras de presença
      onLunch,
      available,
      coverageRatio,
      caixasPresent,
      caixasWorking: caixasPresent,
      caixasOnLunch,
      caixasAvailable: caixasPresent - caixasOnLunch,
    };
  };

  // Meta operacional de cobertura com trava rígida: no mínimo 70% ativo na loja
  const getMaxAllowedLunch = (present: number) => {
    if (present <= 5) return 1; // Equipe <= 5 presentes: estritamente máximo 1 em almoço simultâneo (serialização perfeita)
    if (present <= 8) return 2; // Equipe 6 a 8 pessoas: máximo 2 simultâneas
    return Math.floor(present * 0.30); // Equipe >= 9: no máximo 30% em almoço (garantindo no mínimo 70% ativa em loja)
  };

  const recordAllocation = (cand: Candidate, startMin: number) => {
    cand.allocatedStartMin = startMin;
    cand.allocatedEndMin = startMin + cand.durationMin;
    activeLunches.push({
      startMin,
      endMin: cand.allocatedEndMin,
      isCaixa: cand.isCaixa,
      candidateId: cand.id,
    });
  };

  // 2. REGRAS FIXAS: Aprendiz alocado primeiro em 12h45
  for (const cand of normalized) {
    if (cand.fixedTimeStr) {
      const match = cand.fixedTimeStr.match(/(\d{1,2})h(?:(\d{2}))?/i);
      const fixedStart = match ? parseInt(match[1], 10) * 60 + (match[2] ? parseInt(match[2], 10) : 0) : 765;
      recordAllocation(cand, fixedStart);
    }
  }

  // Identifica todos os Caixas da equipe no dia
  const caixas = normalized.filter(c => c.isCaixa);
  caixas.sort((a, b) => a.startMin - b.startMin);

  // 3. Janelas operacionais candidatas baseadas nas configurações do sistema
  const getCandidateSlots = (cand: Candidate): number[] => {
    const slots: number[] = [];
    const step = 15;

    let searchStart: number;
    let searchEnd: number;

    if (isHoliday) {
      // Feriado: intervalo de 15 minutos utilizando as janelas operacionais configuradas
      // - Abertura (entra 12h): janela preferencial 13h30 - 15h30
      // - Intermediário 1 (entra 13h): janela preferencial 14h30 - 16h30
      // - Intermediário 2 (entra 14h): janela preferencial 15h30 - 17h30
      // - Fechamento (entra 15h): janela preferencial 16h30 - 18h30
      if (cand.startMin <= 12 * 60) {
        searchStart = 13 * 60 + 30;
        searchEnd = 15 * 60 + 30;
      } else if (cand.startMin <= 13 * 60) {
        searchStart = 14 * 60 + 30;
        searchEnd = 16 * 60 + 30;
      } else if (cand.startMin <= 14 * 60) {
        searchStart = 15 * 60 + 30;
        searchEnd = 17 * 60 + 30;
      } else {
        searchStart = 16 * 60 + 30;
        searchEnd = 18 * 60 + 30;
      }
    } else if (isSunday) {
      // Domingo:
      // Abertura (entra às 12h): janela preferencial 14h00 - 15h30 (evita sair às 13h após apenas 1h de trabalho)
      // Fechamento (entra às 13h): janela preferencial 15h30 - 17h30
      if (cand.classification === 'Abertura') {
        searchStart = 14 * 60;
        searchEnd = 15 * 60 + 30;
      } else {
        searchStart = 15 * 60 + 30;
        searchEnd = 17 * 60 + 30;
      }
    } else {
      // Dias de Semana:
      if (cand.classification === 'Abertura') {
        searchStart = 13 * 60;
        searchEnd = 15 * 60; // Estende até 15h00 (término até 16h00) para permitir serialização em equipes pequenas e descompressão de picos
      } else if (cand.classification === 'Intermediário') {
        searchStart = 14 * 60 + 30;
        searchEnd = 15 * 60 + 45;
      } else {
        searchStart = 15 * 60;
        searchEnd = 17 * 60;
      }
    }

    // Estoquista possui flexibilidade dentro de sua jornada
    if (cand.isEstoquista) {
      searchStart = Math.max(searchStart - 30, cand.startMin + 60);
      searchEnd = Math.min(searchEnd + 30, cand.endMin - cand.durationMin);
    }

    // Garante que o slot respeita rigorosamente entrada e saída reais do colaborador
    searchStart = Math.max(searchStart, cand.startMin);
    searchEnd = Math.min(searchEnd, cand.endMin - cand.durationMin);

    for (let t = searchStart; t <= searchEnd; t += step) {
      slots.push(t);
    }

    if (slots.length === 0) {
      const mid = Math.round((cand.startMin + cand.endMin) / 2) - Math.round(cand.durationMin / 2);
      slots.push(Math.max(cand.startMin, mid));
    }

    return slots;
  };

  // Mapeamento de centros preferenciais para serialização de equipes pequenas de abertura
  const smallTeamPreferredCenters = new Map<string, number>();
  const smallAberturaGroup = normalized.filter(
    c => c.classification === 'Abertura' && c.durationMin >= 60 && !c.fixedTimeStr
  );
  if (smallAberturaGroup.length >= 2 && normalized.length <= 4 && !isSunday && !isHoliday) {
    const sortedCohort = [...smallAberturaGroup].sort((a, b) => {
      if (a.isCaixa && !b.isCaixa) return -1;
      if (!a.isCaixa && b.isCaixa) return 1;
      return a.id.localeCompare(b.id);
    });
    // Distribui em blocos de 60 min seriais (13h00, 14h00, 15h00...)
    sortedCohort.forEach((cand, idx) => {
      smallTeamPreferredCenters.set(cand.id, (13 + idx) * 60);
    });
  }

  // Mapa de janelas reservadas para cobridores de Caixa
  const cashierCoverageBlocks = new Map<string, { start: number; end: number; cashierId: string; cashierName: string }>();

  // Função de pontuação para seleção do melhor horário
  const scoreSlot = (cand: Candidate, startSlot: number): number => {
    let penalty = 0;
    const endSlot = startSlot + cand.durationMin;

    // Centro preferencial por turno
    let idealCenter: number;
    if (isHoliday) {
      if (cand.startMin <= 12 * 60) idealCenter = 14 * 60;
      else if (cand.startMin <= 13 * 60) idealCenter = 15 * 60;
      else if (cand.startMin <= 14 * 60) idealCenter = 16 * 60;
      else idealCenter = 17 * 60;
    } else if (isSunday) {
      idealCenter = cand.classification === 'Abertura' ? 14 * 60 + 30 : 16 * 60;
    } else {
      if (smallTeamPreferredCenters.has(cand.id)) {
        idealCenter = smallTeamPreferredCenters.get(cand.id)!;
      } else if (cand.classification === 'Abertura') {
        idealCenter = 13 * 60 + 30;
      } else if (cand.classification === 'Intermediário') {
        idealCenter = 15 * 60;
      } else {
        idealCenter = 16 * 60;
      }
    }

    // Bloqueio rígido para cobridor de Caixa eleito: não pode almoçar durante a janela de cobertura
    const coverageBlock = cashierCoverageBlocks.get(cand.id);
    if (coverageBlock) {
      if (!(endSlot <= coverageBlock.start || startSlot >= coverageBlock.end)) {
        penalty += 500000;
      }
    }

    penalty += Math.abs(startSlot - idealCenter) * 0.1;

    // Regra: Evitar deliberadamente intervalo imediatamente após a entrada quando houver alternativa válida
    if (startSlot < cand.startMin + 45 && cand.endMin - cand.durationMin >= cand.startMin + 60) {
      penalty += 1500;
    }

    // Regra de alternância dinâmica entre Caixas:
    if (cand.isCaixa && caixas.length >= 2) {
      const otherCaixa = caixas.find(c => c.id !== cand.id);
      if (otherCaixa) {
        if (cand.startMin < otherCaixa.startMin) {
          if (startSlot < otherCaixa.startMin) {
            penalty += 5000; // Aguarda a entrada real do segundo Caixa
          }
        } else if (cand.startMin > otherCaixa.startMin) {
          if (otherCaixa.allocatedEndMin !== undefined && startSlot < otherCaixa.allocatedEndMin) {
            penalty += 5000; // Aguarda o retorno do primeiro Caixa
          }
        }
      }
    }

    // Avaliação da cobertura minuto a minuto (amostras de 15 min)
    for (let t = startSlot; t < endSlot; t += 15) {
      const cap = getCapacityAt(t);
      const projectedOnLunch = cap.onLunch + 1;
      const projectedAvailable = cap.present - projectedOnLunch;
      const maxAllowed = getMaxAllowedLunch(cap.present);

      // Trava 1: NUNCA deixar zero pessoas trabalhando se houver alternativa válida
      if (cap.present > 0 && projectedAvailable <= 0) {
        penalty += 100000;
      }

      // Trava 2: Equipe pequena presente (<= 3 pessoas) — evitar fortemente qualquer sobreposição
      if (cap.present <= 3 && projectedOnLunch > 1) {
        penalty += 50000;
      }

      // Trava Rígida dos 70%: Máximo 30% em almoço simultâneo (Hard Constraint)
      if (projectedOnLunch > maxAllowed) {
        penalty += 100000 * (projectedOnLunch - maxAllowed);
      }

      // Trava de Turno: Dentro do mesmo turno, manter no mínimo 70% ativos quando N >= 4 ou max 1 quando N <= 3
      let turnoPresent = 0;
      let turnoOnLunch = 0;
      for (const n of normalized) {
        if (n.classification === cand.classification && n.startMin <= t && n.endMin > t) {
          turnoPresent++;
        }
      }
      for (const alloc of activeLunches) {
        const n = normalized.find(c => c.id === alloc.candidateId);
        if (n && n.classification === cand.classification && alloc.startMin <= t && alloc.endMin > t) {
          turnoOnLunch++;
        }
      }
      const maxTurnoAllowed = turnoPresent <= 3 ? 1 : Math.max(1, Math.floor(turnoPresent * 0.30));
      if (turnoOnLunch + 1 > maxTurnoAllowed) {
        penalty += 50000 * (turnoOnLunch + 1 - maxTurnoAllowed);
      }

      // Cobertura específica da função Caixa:
      // Se há mais de 1 Caixa presente trabalhando naquele instante, não permitir 0 Caixas disponíveis
      if (cand.isCaixa && cap.caixasPresent > 1 && (cap.caixasAvailable - 1) <= 0) {
        penalty += 5000;
      }
    }

    return penalty;
  };

  // 4. CASHIER RELIEF GUARD & ORDEM DE ALOCAÇÃO
  // 4.1 Alocar Caixas PRIMEIRO e designar cobridores para os momentos em que não houver 2º Caixa ativo
  for (const cashierCand of caixas) {
    if (cashierCand.allocatedStartMin !== undefined) continue;

    const candidateSlots = getCandidateSlots(cashierCand);
    let bestSlot = candidateSlots[0];
    let minScore = Infinity;

    for (const slot of candidateSlots) {
      const score = scoreSlot(cashierCand, slot);
      if (score < minScore) {
        minScore = score;
        bestSlot = slot;
      }
    }

    recordAllocation(cashierCand, bestSlot);

    // Avaliar se o Caixa titular necessita de cobertura durante seu almoço
    let hasActiveOtherCashier = false;
    for (let t = bestSlot; t < bestSlot + cashierCand.durationMin; t += 15) {
      const cap = getCapacityAt(t);
      if (cap.caixasAvailable > 0) {
        hasActiveOtherCashier = true;
        break;
      }
    }

    if (!hasActiveOtherCashier) {
      // Elegemos automaticamente 1 colaborador presente durante toda a janela para ser o cobridor de Caixa
      const eligibleRelievers = normalized.filter(c =>
        c.id !== cashierCand.id &&
        !c.isCaixa &&
        !c.isApprentice &&
        !c.isEstoquista &&
        c.role !== 'Fiscal' &&
        c.startMin <= bestSlot &&
        c.endMin >= bestSlot + cashierCand.durationMin &&
        !cashierCoverageBlocks.has(c.id)
      );

      eligibleRelievers.sort((a, b) => {
        const aCaixa = Boolean(a.member?.secondaryRole === 'Caixa' || a.member?.primaryRole === 'Caixa');
        const bCaixa = Boolean(b.member?.secondaryRole === 'Caixa' || b.member?.primaryRole === 'Caixa');
        if (aCaixa && !bCaixa) return -1;
        if (!aCaixa && bCaixa) return 1;

        const aSameTurno = a.classification === cashierCand.classification;
        const bSameTurno = b.classification === cashierCand.classification;
        if (aSameTurno && !bSameTurno) return -1;
        if (!aSameTurno && bSameTurno) return 1;

        return a.startMin - b.startMin;
      });

      const chosenReliever = eligibleRelievers[0];
      if (chosenReliever) {
        cashierCand.coveredByEmployeeId = chosenReliever.id;
        cashierCand.coveredByEmployeeName = chosenReliever.name;
        chosenReliever.isCoveringCashier = true;
        chosenReliever.coveringCashierTime = formatLunchMinutes(bestSlot, cashierCand.durationMin, isHoliday);
        chosenReliever.coveringEmployeeId = cashierCand.id;
        cashierCoverageBlocks.set(chosenReliever.id, {
          start: bestSlot,
          end: bestSlot + cashierCand.durationMin,
          cashierId: cashierCand.id,
          cashierName: cashierCand.name
        });
      }
    }
  }

  // 4.2 Alocação dos colaboradores restantes
  const remaining = normalized.filter(c => c.allocatedStartMin === undefined);

  remaining.sort((a, b) => {
    // Intermediário antes de Fechamento na janela disputada de 15h
    if (a.classification === 'Intermediário' && b.classification === 'Fechamento') return -1;
    if (b.classification === 'Intermediário' && a.classification === 'Fechamento') return 1;

    // Abertura antes de Fechamento
    if (a.classification === 'Abertura' && b.classification !== 'Abertura') return -1;
    if (b.classification === 'Abertura' && a.classification !== 'Abertura') return 1;

    // Salão antes do Estoquista
    if (!a.isEstoquista && b.isEstoquista) return -1;
    if (a.isEstoquista && !b.isEstoquista) return 1;

    return a.startMin - b.startMin;
  });

  for (const cand of remaining) {
    const candidateSlots = getCandidateSlots(cand);
    let bestSlot = candidateSlots[0];
    let minScore = Infinity;

    for (const slot of candidateSlots) {
      const score = scoreSlot(cand, slot);
      if (score < minScore) {
        minScore = score;
        bestSlot = slot;
      }
    }

    recordAllocation(cand, bestSlot);
  }

  // 5. Retorno estruturado indexado com metadados de cobertura
  return normalized.map(c => {
    const start = c.allocatedStartMin ?? 13 * 60;
    const end = c.allocatedEndMin ?? (start + c.durationMin);
    const timeStr = c.fixedTimeStr ? c.fixedTimeStr : formatLunchMinutes(start, c.durationMin, isHoliday);

    return {
      member: c.member,
      employeeId: c.member?.id || '',
      employeeName: c.member?.name || '',
      index: c.index,
      timeStr,
      lunchSlot: timeStr,
      startMinutes: start,
      endMinutes: end,
      durationMinutes: c.durationMin,
      classification: c.classification,
      role: c.role,
      isFixed: Boolean(c.fixedTimeStr),
      coveredByEmployeeId: c.coveredByEmployeeId,
      coveredByEmployeeName: c.coveredByEmployeeName,
      coveringCashierTime: c.coveringCashierTime,
      isCoveringCashier: c.isCoveringCashier,
      coveringEmployeeId: c.coveringEmployeeId,
    };
  });
}

/**
 * Assinatura principal de calculateLunches.
 * Retorna um array de strings com os horários de almoço formatados.
 */
export function calculateLunches(
  members: any[],
  isHoliday: boolean,
  isSunday: boolean,
  isOpening?: boolean,
  settings: JornadaSettings = DEFAULT_JORNADA_SETTINGS,
  options?: {
    roles?: Record<string, string>;
    monthKey?: string;
    dayIdx?: number;
  }
): string[] {
  if (!members || members.length === 0) return [];
  const detailed = calculateDetailedLunches(members, isHoliday, isSunday, isOpening, settings, options);
  return detailed.map(d => d.timeStr);
}
