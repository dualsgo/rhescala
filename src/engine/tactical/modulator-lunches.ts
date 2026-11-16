import { JornadaSettings } from '../../../types';
import { DEFAULT_JORNADA_SETTINGS } from '../config/schedule-constants';
import { getShiftClassification } from '../shifts/shift-predicates';

export interface ModulatorLunchInput {
  id: string;
  name?: string;
  firstName?: string;
  hour?: string;
  shiftName?: string;
  pos?: string;
  cargo?: string;
  role?: string;
  isYoungApprentice?: boolean;
}

export interface ModulatorLunchSummary {
  aberturaSalonCount: number;
  aberturaAt12: number;
  aberturaAt13: number;
  aberturaAt14: number;
  fechamentoAt15: number;
  fechamentoAt16: number;
  fechamentoAt17: number;
  apprenticeCount: number;
  estoquistaCount: number;
}

export interface ModulatorLunchResult {
  lunchesById: Record<string, string>;
  summary: ModulatorLunchSummary;
}

function isApprenticeMember(m: ModulatorLunchInput): boolean {
  const cargo = (m.cargo || m.role || '').toLowerCase();
  return Boolean(m.isYoungApprentice || cargo.includes('aprendiz'));
}

function isEstoquistaMember(m: ModulatorLunchInput): boolean {
  const pos = (m.pos || '').toLowerCase();
  const cargo = (m.cargo || m.role || '').toLowerCase();
  return pos === 'estoque' || cargo.includes('estoq');
}

function isCaixaMember(m: ModulatorLunchInput): boolean {
  const pos = (m.pos || '').toLowerCase();
  const cargo = (m.cargo || m.role || '').toLowerCase();
  return pos === 'caixa' || cargo === 'caixa';
}

/**
 * Motor determinístico de escalonamento de almoços do Modulador da Escala Diária:
 *
 * 1. Jovem Aprendiz: horário fixo 12h45 (ou settings.lunchRules.apprentice).
 * 2. Estoquista: flexível (não entra na trava de 3 pessoas do salão até 14h).
 * 3. Abertura (salão, tirando Aprendiz e Estoquista):
 *    - Troca de turno às 14h; garante 3 pessoas no salão até as 14h.
 *    - N <= 3: todos vão às 14h.
 *    - N = 4: 1 às 13h, 3 às 14h.
 *    - N = 5: 1 às 12h, 1 às 13h, 3 às 14h.
 *    - N >= 6: 3 às 14h e os demais alternados entre 12h e 13h.
 * 4. Fechamento (+ Intermediário na janela da tarde):
 *    - Máximo 2 colaboradores por hora em 15h, 16h, 17h.
 *    - Quando há <= 4 no fechamento, distribui inteligentemente combinando
 *      com o retorno da Abertura (que volta às 15h quando saiu às 14h).
 */
export function modulateDailyLunches(
  members: ModulatorLunchInput[],
  options?: {
    isHoliday?: boolean;
    isSunday?: boolean;
    jornadaSettings?: JornadaSettings;
  }
): ModulatorLunchResult {
  const isHoliday = Boolean(options?.isHoliday);
  const isSunday = Boolean(options?.isSunday);
  const settings = options?.jornadaSettings || DEFAULT_JORNADA_SETTINGS;
  const apprenticeSlot = settings?.lunchRules?.apprentice || '12h45';

  const lunchesById: Record<string, string> = {};
  const summary: ModulatorLunchSummary = {
    aberturaSalonCount: 0,
    aberturaAt12: 0,
    aberturaAt13: 0,
    aberturaAt14: 0,
    fechamentoAt15: 0,
    fechamentoAt16: 0,
    fechamentoAt17: 0,
    apprenticeCount: 0,
    estoquistaCount: 0,
  };

  if (!members || members.length === 0) {
    return { lunchesById, summary };
  }

  const classify = (m: ModulatorLunchInput): 'Abertura' | 'Intermediário' | 'Fechamento' => {
    if (m.shiftName === 'Abertura' || m.shiftName === 'Intermediário' || m.shiftName === 'Fechamento') {
      return m.shiftName;
    }
    const cls = getShiftClassification(m.hour || '', isSunday, settings);
    if (cls === 'Intermediário' || cls === 'Fechamento') return cls;
    return 'Abertura';
  };

  // Feriado (jornada reduzida de 6h com pausa de 15 min)
  if (isHoliday) {
    const holidaySlots = ['14h30', '14h45', '15h', '15h15', '15h30', '15h45', '16h', '16h15', '16h30', '16h45', '17h'];
    let slotIdx = 0;
    members.forEach(m => {
      if (isApprenticeMember(m)) {
        lunchesById[m.id] = apprenticeSlot;
        summary.apprenticeCount++;
      } else {
        if (isEstoquistaMember(m)) summary.estoquistaCount++;
        lunchesById[m.id] = holidaySlots[slotIdx % holidaySlots.length];
        slotIdx++;
      }
    });
    return { lunchesById, summary };
  }

  const aberturaSalon: ModulatorLunchInput[] = [];
  const intermediarioSalon: ModulatorLunchInput[] = [];
  const fechamentoSalon: ModulatorLunchInput[] = [];
  const estoquistas: ModulatorLunchInput[] = [];

  for (const m of members) {
    if (isApprenticeMember(m)) {
      lunchesById[m.id] = apprenticeSlot;
      summary.apprenticeCount++;
      continue;
    }

    if (isEstoquistaMember(m)) {
      estoquistas.push(m);
      summary.estoquistaCount++;
      continue;
    }

    const shiftCls = classify(m);
    if (shiftCls === 'Abertura') aberturaSalon.push(m);
    else if (shiftCls === 'Intermediário') intermediarioSalon.push(m);
    else fechamentoSalon.push(m);
  }

  // 1. Estoquistas (Flexível): aloca em horário livre compatível com seu turno
  estoquistas.forEach((est, idx) => {
    const cls = classify(est);
    if (cls === 'Fechamento') {
      lunchesById[est.id] = idx % 2 === 0 ? '15h' : '16h';
    } else if (isSunday) {
      lunchesById[est.id] = idx % 2 === 0 ? '13h' : '14h';
    } else {
      lunchesById[est.id] = idx % 2 === 0 ? '12h' : '13h';
    }
  });

  // 2. Abertura (Salão): garantir 3 pessoas até a troca de turno (14h)
  // Ordena para alternar Caixas (se houver 2+ Caixas, um sai antes e outro às 14h)
  const sortedAbertura = [...aberturaSalon].sort((a, b) => {
    const cA = isCaixaMember(a) ? 0 : 1;
    const cB = isCaixaMember(b) ? 0 : 1;
    if (cA !== cB) return cA - cB;
    return (a.name || a.firstName || '').localeCompare(b.name || b.firstName || '');
  });

  const nAb = sortedAbertura.length;
  summary.aberturaSalonCount = nAb;

  // Quantos ficam para a troca de turno das 14h (máximo 3, ou todos se N <= 3)
  const countAt14 = Math.min(3, nAb);
  const earlyCount = Math.max(0, nAb - 3);

  // Quantos vão às 13h vs 12h antes das 14h
  // Regra:
  // - N=4 (early=1) -> 1 às 13h, 3 às 14h
  // - N=5 (early=2) -> 1 às 12h, 1 às 13h, 3 às 14h
  // - N>=6 (early>=3) -> distribui alternando 13h e 12h (ou 13h em domingo se abriu 12h)
  let countAt12 = 0;
  let countAt13 = 0;

  if (earlyCount === 1) {
    countAt13 = 1;
  } else if (earlyCount >= 2) {
    if (isSunday) {
      // No domingo a loja abre 12h, então ninguém sai 12h; todos os adiantados vão 13h/13h30
      countAt13 = earlyCount;
    } else {
      countAt12 = Math.floor(earlyCount / 2);
      countAt13 = earlyCount - countAt12;
    }
  }

  // Se houver 2 Caixas na abertura e earlyCount >= 1:
  // Coloca o 2º Caixa em 13h/12h e mantém o 1º Caixa às 14h (para nunca saírem os dois juntos!)
  const abSlots: string[] = [];
  for (let i = 0; i < countAt12; i++) abSlots.push('12h');
  for (let i = 0; i < countAt13; i++) abSlots.push('13h');
  for (let i = 0; i < countAt14; i++) abSlots.push('14h');

  // Reordena os membros da abertura de modo que o 1º Caixa fique no bloco das 14h
  // e o 2º Caixa (se houver) vá no bloco mais cedo (12h ou 13h)
  const reorderedAbertura: ModulatorLunchInput[] = [];
  const abCaixas = sortedAbertura.filter(isCaixaMember);
  const abOthers = sortedAbertura.filter(m => !isCaixaMember(m));

  if (abCaixas.length >= 2 && earlyCount >= 1) {
    // 2º Caixa vai cedo, 1º Caixa fica para 14h
    const earlyPool = [abCaixas[1], ...abOthers, ...abCaixas.slice(2)];
    const latePool = [abCaixas[0]];
    for (let i = 0; i < earlyCount; i++) {
      const m = earlyPool.shift();
      if (m) reorderedAbertura.push(m);
    }
    reorderedAbertura.push(...latePool, ...earlyPool);
  } else {
    // Coloca não-caixas primeiro nos horários cedo, preservando Caixa para 14h
    reorderedAbertura.push(...abOthers, ...abCaixas);
  }

  reorderedAbertura.forEach((m, idx) => {
    const slot = abSlots[idx] || '14h';
    lunchesById[m.id] = slot;
    if (slot === '12h') summary.aberturaAt12++;
    else if (slot === '13h') summary.aberturaAt13++;
    else summary.aberturaAt14++;
  });

  // 3. Bloco da Tarde: Intermediário + Fechamento (máximo 2 por hora em 15h, 16h, 17h)
  // Quem da Abertura saiu às 14h retorna exatamente às 15h!
  const afternoonCounts: Record<string, number> = {
    '15h': 0,
    '16h': 0,
    '17h': 0,
    '15h30': 0,
    '16h30': 0,
    '17h30': 0,
  };

  // Intermediário ajuda a cobrir a troca das 14h e sai preferencialmente às 15h (máx 2)
  intermediarioSalon.forEach(m => {
    if (afternoonCounts['15h'] < 2) {
      lunchesById[m.id] = '15h';
      afternoonCounts['15h']++;
    } else if (afternoonCounts['16h'] < 2) {
      lunchesById[m.id] = '16h';
      afternoonCounts['16h']++;
    } else {
      lunchesById[m.id] = '17h';
      afternoonCounts['17h']++;
    }
  });

  // Fechamento: máximo 2 por hora (15h, 16h, 17h), distribuindo de forma inteligente
  // combinando com a abertura (Abertura que saiu às 14h volta às 15h!).
  const sortedFechamento = [...fechamentoSalon].sort((a, b) => {
    const cA = isCaixaMember(a) ? 0 : 1;
    const cB = isCaixaMember(b) ? 0 : 1;
    if (cA !== cB) return cA - cB;
    return (a.name || a.firstName || '').localeCompare(b.name || b.firstName || '');
  });

  const mFech = sortedFechamento.length;
  const targetSlotsFechamento: string[] = [];

  if (mFech > 0) {
    // Monta sequência inteligente de slots respeitando máx 2 por hora:
    // - Se <= 3 no fechamento: 1 por hora (15h, 16h, 17h) para máxima distribuição
    // - Se == 4 no fechamento:
    //     Se Abertura tem >= 2 voltando às 15h (aberturaAt14 >= 2), coloca 2 às 15h, 1 às 16h, 1 às 17h;
    //     Senão (abertura enxuta), 1 às 15h, 2 às 16h, 1 às 17h.
    // - Se == 5: 2 às 15h, 2 às 16h, 1 às 17h
    // - Se == 6: 2 às 15h, 2 às 16h, 2 às 17h
    // - Se > 6: preenche 2/2/2 e excedentes em 15h30/16h30/17h30
    const primaryHours = ['15h', '16h', '17h'];

    if (mFech <= 3) {
      for (let i = 0; i < mFech; i++) {
        // Se 15h já foi preenchido pelo intermediário com 2, pula para 16h/17h
        const preferred = primaryHours.find(h => afternoonCounts[h] === 0)
          || primaryHours.find(h => afternoonCounts[h] < 2)
          || '17h30';
        targetSlotsFechamento.push(preferred);
        afternoonCounts[preferred]++;
      }
    } else if (mFech === 4) {
      const order = summary.aberturaAt14 >= 2
        ? ['15h', '16h', '17h', '15h']
        : ['15h', '16h', '17h', '16h'];
      for (const h of order) {
        if (afternoonCounts[h] < 2) {
          targetSlotsFechamento.push(h);
          afternoonCounts[h]++;
        } else {
          const fallback = primaryHours.find(p => afternoonCounts[p] < 2) || '15h30';
          targetSlotsFechamento.push(fallback);
          afternoonCounts[fallback]++;
        }
      }
    } else {
      // mFech >= 5: prioriza 1 pessoa por hora primeiro (15h, 16h, 17h) para alternar Caixas,
      // depois preenche a 2ª vaga de cada hora (máx 2/h) e excedentes em 15h30/16h30/17h30
      const baseHours = ['15h', '16h', '17h'];
      const extraHours = ['15h30', '16h30', '17h30'];
      for (let i = 0; i < mFech; i++) {
        const chosen =
          baseHours.find(s => afternoonCounts[s] === 0) ||
          baseHours.find(s => afternoonCounts[s] < 2) ||
          extraHours.find(s => (afternoonCounts[s] || 0) < 2) ||
          '17h30';
        targetSlotsFechamento.push(chosen);
        afternoonCounts[chosen] = (afternoonCounts[chosen] || 0) + 1;
      }
    }
  }

  // Como os primeiros 3 slots em targetSlotsFechamento estão em horários distintos (15h, 16h, 17h),
  // colocar os Caixas no início de sortedFechamento garante que Caixas nunca almocem juntos!
  sortedFechamento.forEach((m, idx) => {
    const slot = targetSlotsFechamento[idx] || '16h';
    lunchesById[m.id] = slot;
  });

  summary.fechamentoAt15 = afternoonCounts['15h'];
  summary.fechamentoAt16 = afternoonCounts['16h'];
  summary.fechamentoAt17 = afternoonCounts['17h'];

  return { lunchesById, summary };
}
