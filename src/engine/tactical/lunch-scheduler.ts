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
  index: number;
  timeStr: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  classification: 'Abertura' | 'Intermediário' | 'Fechamento' | 'N/A';
  role: OperationalRole;
  isFixed?: boolean;
}

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
        // Fallback apenas para membros sem horário definido
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

  // Linha do tempo: rastreia colaboradores e caixas em almoço por minuto
  const activeLunches: { startMin: number; endMin: number; isCaixa: boolean; candidateId: string }[] = [];

  const getCapacityAt = (t: number) => {
    let working = 0;
    let onLunch = 0;
    let caixasWorking = 0;
    let caixasOnLunch = 0;

    for (const c of normalized) {
      if (c.startMin <= t && c.endMin > t) {
        working++;
        if (c.isCaixa) caixasWorking++;
      }
    }

    for (const alloc of activeLunches) {
      if (alloc.startMin <= t && alloc.endMin > t) {
        onLunch++;
        if (alloc.isCaixa) caixasOnLunch++;
      }
    }

    return {
      working,
      onLunch,
      available: working - onLunch,
      caixasWorking,
      caixasOnLunch,
      caixasAvailable: caixasWorking - caixasOnLunch,
    };
  };

  // Meta operacional de cobertura (orientação ~70% trabalhando, priorizando cobertura em equipe pequena)
  const getMaxAllowedLunch = (working: number) => {
    if (working <= 3) return 1; // Equipe pequena: cobertura estrita, no máximo 1 em almoço
    if (working <= 5) return 1; // Equipe média-pequena: preferencialmente 1
    if (working <= 7) return 2; // Equipe média: até 2 pessoas
    return Math.max(1, Math.floor(working * 0.33)); // Equipe maior: meta ~30% em almoço
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

  // 3. Janelas operacionais candidatas
  const getCandidateSlots = (cand: Candidate): number[] => {
    const slots: number[] = [];
    const step = 15;

    let searchStart: number;
    let searchEnd: number;

    if (isHoliday) {
      // Feriado: pausa de 15 minutos.
      // Regras: nunca antes da entrada do colaborador e respeitando sua jornada real.
      searchStart = cand.startMin;
      searchEnd = cand.endMin - cand.durationMin;
    } else if (isSunday) {
      // Domingo:
      // Abertura (entra às 12h): janela preferencial 14h00 - 15h30 (não sai às 13h após apenas 1h de trabalho)
      // Fechamento (entra às 13h): janela 15h30 - 17h30
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
        searchEnd = 14 * 60 + 30;
      } else if (cand.classification === 'Intermediário') {
        searchStart = 14 * 60 + 30;
        searchEnd = 15 * 60 + 45;
      } else {
        searchStart = 15 * 60;
        searchEnd = 17 * 60;
      }
    }

    // Estoquista possui flexibilidade de preenchimento dentro de sua jornada
    if (cand.isEstoquista) {
      searchStart = Math.max(searchStart - 30, cand.startMin + 60);
      searchEnd = Math.min(searchEnd + 30, cand.endMin - cand.durationMin);
    }

    // Garante que o slot respeita entrada e saída reais do colaborador
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

  // Função de pontuação para seleção do melhor horário
  const scoreSlot = (cand: Candidate, startSlot: number): number => {
    let penalty = 0;
    const endSlot = startSlot + cand.durationMin;

    // Centro preferencial por turno
    let idealCenter: number;
    if (isHoliday) {
      idealCenter = Math.round((cand.startMin + cand.endMin) / 2);
    } else if (isSunday) {
      idealCenter = cand.classification === 'Abertura' ? 14 * 60 + 30 : 16 * 60;
    } else {
      if (cand.classification === 'Abertura') {
        idealCenter = 13 * 60 + 30;
      } else if (cand.classification === 'Intermediário') {
        idealCenter = 15 * 60;
      } else {
        idealCenter = 16 * 60;
      }
    }

    penalty += Math.abs(startSlot - idealCenter) * 0.1;

    // Regra de alternância dinâmica entre Caixas:
    // Se há múltiplos Caixas no dia:
    // - O Caixa com entrada mais cedo não deve sair antes da entrada real do segundo Caixa
    // - O segundo Caixa não deve sair enquanto o primeiro estiver em almoço
    if (cand.isCaixa && caixas.length >= 2) {
      const otherCaixa = caixas.find(c => c.id !== cand.id);
      if (otherCaixa) {
        // Se este colaborador é o primeiro Caixa e o segundo entra mais tarde:
        if (cand.startMin < otherCaixa.startMin) {
          if (startSlot < otherCaixa.startMin) {
            penalty += 5000; // Aguarda a entrada real do segundo Caixa
          }
        } else if (cand.startMin > otherCaixa.startMin) {
          // Se este colaborador é o segundo Caixa:
          if (otherCaixa.allocatedEndMin !== undefined && startSlot < otherCaixa.allocatedEndMin) {
            penalty += 5000; // Aguarda o retorno do primeiro Caixa
          }
        }
      }
    }

    // Avaliação minuto a minuto (amostras de 15 min)
    for (let t = startSlot; t < endSlot; t += 15) {
      const cap = getCapacityAt(t);
      const maxAllowed = getMaxAllowedLunch(cap.working);

      // Meta operacional de cobertura geral
      if (cap.onLunch >= maxAllowed) {
        penalty += 2000 * (cap.onLunch - maxAllowed + 1);
      }

      // Proteção de equipe pequena
      if (cap.working >= 3 && cap.available <= 1) {
        penalty += 3000;
      }

      // Cobertura da função Caixa:
      // Se há mais de 1 Caixa trabalhando naquele instante, não permitir 0 Caixas disponíveis
      if (cand.isCaixa && cap.caixasWorking > 1 && cap.caixasAvailable <= 0) {
        penalty += 5000;
      }

      penalty += cap.onLunch * 15;
    }

    return penalty;
  };

  // 4. ORDEM DE PRIORIDADE DE ALOCAÇÃO:
  // 1º Primeiro Caixa (para determinar o ponto de alternância)
  // 2º Intermediário (prioridade sobre Fechamento na janela de transição)
  // 3º Segundo Caixa (alterna após retorno do primeiro)
  // 4º Restante da Abertura
  // 5º Restante do Fechamento
  // 6º Estoquista (preenche vales de cobertura com horário concreto)
  const remaining = normalized.filter(c => c.allocatedStartMin === undefined);

  remaining.sort((a, b) => {
    // Primeiro Caixa entra com prioridade de agendamento para viabilizar a alternância
    if (a.isCaixa && caixas.length >= 2 && a.id === caixas[0]?.id) return -1;
    if (b.isCaixa && caixas.length >= 2 && b.id === caixas[0]?.id) return 1;

    // Intermediário antes de Fechamento na janela disputada de 15h
    if (a.classification === 'Intermediário' && b.classification === 'Fechamento') return -1;
    if (b.classification === 'Intermediário' && a.classification === 'Fechamento') return 1;

    // Caixa antes do fechamento geral
    if (a.isCaixa && !b.isCaixa) return -1;
    if (!a.isCaixa && b.isCaixa) return 1;

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

  // 5. Retorno estruturado indexado
  return normalized.map(c => {
    const start = c.allocatedStartMin ?? 13 * 60;
    const end = c.allocatedEndMin ?? (start + c.durationMin);
    const timeStr = c.fixedTimeStr ? c.fixedTimeStr : formatLunchMinutes(start, c.durationMin, isHoliday);

    return {
      member: c.member,
      index: c.index,
      timeStr,
      startMinutes: start,
      endMinutes: end,
      durationMinutes: c.durationMin,
      classification: c.classification,
      role: c.role,
      isFixed: Boolean(c.fixedTimeStr),
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
