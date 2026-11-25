import { describe, it, expect } from 'vitest';
import { createTestEmployee } from './fixtures';
import { Employee, JornadaSettings, OfficialScheduleSnapshot } from '../types';
import {
  DEFAULT_JORNADA_SETTINGS,
  DEFAULT_SCHEDULE_RULES,
} from '../src/engine/config/schedule-constants';
import {
  resolveMonthGuidelines,
  validateGuidelineConflicts,
} from '../src/engine/config/guidelines';
import { getDailyAvailability } from '../src/engine/availability/daily-availability';
import {
  applyMonthUpdate,
  generateCleanMonthScheduleWithReport,
} from '../src/engine/orchestration/month-generator';
import { reoptimizeMonthFromCutoff } from '../src/engine/orchestration/refresh-month';
import { isWorkingShift } from '../src/engine/shifts/shift-predicates';
import { sortByExperienceDesc } from '../src/engine/clt/experience';

function makeV2Settings(overrides: Partial<JornadaSettings> = {}): JornadaSettings {
  return {
    ...DEFAULT_JORNADA_SETTINGS,
    ...overrides,
    rulesConfig: {
      ...DEFAULT_SCHEDULE_RULES,
      useSmartRestAllocatorV2: true,
      ...(overrides.rulesConfig || {}),
    },
  };
}

function makeTeam(count = 10): Employee[] {
  const daysOfWeek = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  return Array.from({ length: count }, (_, idx) => {
    const role = idx < 2 ? 'Caixa' : idx === 2 ? 'Estoque' : 'Vendas';
    return createTestEmployee({
      id: `emp-${idx + 1}`,
      name: `Colaborador ${idx + 1}`,
      cargo: role,
      primaryRole: role,
      jornada: '6x1',
      workPeriod: idx % 2 === 0 ? '10:00 às 18:20' : '13:40 às 22:00',
      shiftName: idx % 2 === 0 ? 'Abertura' : 'Fechamento',
      preferredDayOff: daysOfWeek[idx % daysOfWeek.length],
    });
  });
}

function maxConsecutiveWorkDays(shifts: string[]): number {
  let streak = 0;
  let maxStreak = 0;
  for (const s of shifts) {
    if (isWorkingShift(s as any) || s === 'C') {
      streak++;
      if (streak > maxStreak) maxStreak = streak;
    } else {
      streak = 0;
    }
  }
  return maxStreak;
}

describe('Motor V2 de Alocação Inteligente de Folgas', () => {
  it('1. gera mês 6x1 puro (novembro/2026), mês 5x2 puro (janeiro/2027) e mês híbrido (dezembro/2026 com LF 25/12) sem quebrar teto de 6 dias seguidos', () => {
    const team = makeTeam(10);
    const settings = makeV2Settings();

    // 6x1 puro (Novembro/2026)
    const novRes = generateCleanMonthScheduleWithReport(
      team,
      2026,
      10,
      [],
      [],
      settings,
      undefined,
      'suggested_retro'
    );
    expect(novRes.report).not.toBeNull();
    for (const emp of novRes.employees) {
      expect(maxConsecutiveWorkDays(emp.shifts['2026-11'])).toBeLessThanOrEqual(6);
    }

    // Híbrido 6x1 -> 5x2 (Dezembro/2026, LF em 25/12)
    const decRes = generateCleanMonthScheduleWithReport(
      novRes.employees,
      2026,
      11,
      [],
      [],
      settings,
      undefined,
      'suggested_retro'
    );
    expect(decRes.report).not.toBeNull();
    for (const emp of decRes.employees) {
      const decShifts = emp.shifts['2026-12'];
      expect(decShifts).toHaveLength(31);
      expect(decShifts[24]).toBe('LF'); // 25/12 é Loja Fechada
      expect(maxConsecutiveWorkDays(decShifts)).toBeLessThanOrEqual(6);
    }

    // 5x2 puro (Janeiro/2027, LF em 01/01)
    const janRes = generateCleanMonthScheduleWithReport(
      decRes.employees,
      2027,
      0,
      [],
      [],
      settings,
      undefined,
      'suggested_retro'
    );
    expect(janRes.report).not.toBeNull();
    expect(janRes.report!.theoreticalMaxPresence).toBeCloseTo(5 / 7, 2);
    for (const emp of janRes.employees) {
      const janShifts = emp.shifts['2027-01'];
      expect(janShifts).toHaveLength(31);
      expect(janShifts[0]).toBe('LF'); // 01/01 é Loja Fechada
      expect(maxConsecutiveWorkDays(janShifts)).toBeLessThanOrEqual(6);
    }
  });

  it('2. desloca folga fixa que cai dentro do pico (20-24/12) com motivo PEAK_PREFERENCE_DISPLACED e maximiza presença no pico mantendo CLT', () => {
    // 20/12/2026 é Domingo, 21/12 Segunda, 22/12 Terça, 23/12 Quarta, 24/12 Quinta
    const team = makeTeam(10).map((e, i) => ({
      ...e,
      preferredDayOff: i % 2 === 0 ? 'Segunda-feira' : 'Terça-feira',
    }));
    const settings = makeV2Settings();
    const guidelines = resolveMonthGuidelines(11, settings, undefined, {
      peakDays: [20, 21, 22, 23, 24],
    });

    const v2Res = generateCleanMonthScheduleWithReport(
      team,
      2026,
      11,
      [],
      [],
      settings,
      undefined,
      'suggested_retro',
      guidelines
    );

    expect(v2Res.report).not.toBeNull();
    expect(v2Res.report!.displacedPreferences.length).toBeGreaterThan(0);

    const hasDisplacedReason = v2Res.employees.some((emp) => {
      const reasons = emp.decisionReasons?.['2026-12'] || {};
      return Object.values(reasons).includes('PEAK_PREFERENCE_DISPLACED');
    });
    expect(hasDisplacedReason).toBe(true);

    for (const emp of v2Res.employees) {
      expect(maxConsecutiveWorkDays(emp.shifts['2026-12'])).toBeLessThanOrEqual(6);
    }
  });

  it('8. garante piso de >= 70% em TODOS os dias não-domingo (incluindo dia 18 e dia 19 pré-pico) e aplica meta reduzida apenas nos domingos', () => {
    // Cenário crítico: 10 colaboradores, pico 20..24/12, 5x2 estrito, lfCountsAsRest=false e protectedDays legados {20:0..24:0}
    const team = makeTeam(10).map((e, i) => ({
      ...e,
      preferredDayOff: ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira'][i % 4],
    }));
    const settings = makeV2Settings({ minSundayWorkers: 5 });
    const guidelines = resolveMonthGuidelines(11, settings, undefined, {
      peakDays: [20, 21, 22, 23, 24],
      lfCountsAsRest: false,
      fiveByTwoRestMode: 'strict',
      coverageMinFloor: 0.70,
      coverageTargetCap: 0.80,
      minSundayWorkers: 5,
    });
    const legacyProtected = { 20: 0, 21: 0, 22: 0, 23: 0, 24: 0 };

    const res = generateCleanMonthScheduleWithReport(
      team,
      2026,
      11,
      [],
      [],
      settings,
      legacyProtected,
      'suggested_retro',
      guidelines
    );

    // Verifica todos os 31 dias de Dezembro/2026
    for (let d = 0; d < 31; d++) {
      if (d === 24) {
        // 25/12 = LF (Loja Fechada)
        for (const emp of res.employees) {
          expect(emp.shifts['2026-12'][d]).toBe('LF');
        }
        continue;
      }

      const dow = new Date(2026, 11, d + 1).getDay();
      const workingCount = res.employees.filter((e) =>
        isWorkingShift(e.shifts['2026-12'][d])
      ).length;
      const ratio = workingCount / res.employees.length;

      if (dow === 0) {
        // Domingos: seguem regra específica de domingo (minSundayWorkers = 5, podendo ficar abaixo de 70%)
        expect(workingCount).toBeGreaterThanOrEqual(5);
      } else {
        // Todos os demais dias (inclusive dia 18 idx=17, dia 19 idx=18 e picos 21..24): piso estrito >= 70%
        expect(ratio).toBeGreaterThanOrEqual(0.70);
      }
    }

    // Especificamente no dia 19/12 (idx 18): nunca pode concentrar 90% de folgas (>= 70% trabalhando)
    const workingDay19 = res.employees.filter((e) =>
      isWorkingShift(e.shifts['2026-12'][18])
    ).length;
    expect(workingDay19).toBeGreaterThanOrEqual(7);

    // Zero violações de 7º dia consecutivo
    for (const emp of res.employees) {
      expect(maxConsecutiveWorkDays(emp.shifts['2026-12'])).toBeLessThanOrEqual(6);
    }
  });

  it('9. prioriza Sazonais nas folgas inevitáveis de pico (CLT mais experiente ativo) sem quebrar piso, CLT e domingos', () => {
    // 10 colaboradores: 6 CLT (admissões antigas) + 4 Sazonais (admitidos em nov/2026)
    const team = makeTeam(10).map((e, i) => ({
      ...e,
      contractType: (i >= 6 ? 'Sazonal' : 'CLT') as 'CLT' | 'Sazonal',
      hiredAt: i >= 6 ? `2026-11-0${i - 5}` : `202${i}-01-10`,
      preferredDayOff: ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira'][i % 4],
    }));
    const settings = makeV2Settings({ minSundayWorkers: 5 });
    const baseGuidelines = {
      peakDays: [20, 21, 22, 23, 24],
      lfCountsAsRest: false,
      fiveByTwoRestMode: 'strict' as const,
      minSundayWorkers: 5,
    };
    const peakIdx = [19, 20, 21, 22, 23];
    const countPeakRests = (emps: Employee[], seasonal: boolean) =>
      emps
        .filter((e) => (e.contractType === 'Sazonal') === seasonal)
        .reduce((acc, e) => acc + peakIdx.filter((k) => e.shifts['2026-12'][k] === 'F').length, 0);

    const withPriority = generateCleanMonthScheduleWithReport(
      team, 2026, 11, [], [], settings, undefined, 'suggested_retro',
      resolveMonthGuidelines(11, settings, undefined, { ...baseGuidelines, prioritizeSeasonalRestOnPeaks: true })
    );
    const withoutPriority = generateCleanMonthScheduleWithReport(
      team, 2026, 11, [], [], settings, undefined, 'suggested_retro',
      resolveMonthGuidelines(11, settings, undefined, { ...baseGuidelines, prioritizeSeasonalRestOnPeaks: false })
    );

    const cltWith = countPeakRests(withPriority.employees, false);
    const cltWithout = countPeakRests(withoutPriority.employees, false);
    const sazWith = countPeakRests(withPriority.employees, true);

    // Com prioridade, CLT nunca folga mais no pico do que sem prioridade, e os Sazonais absorvem as folgas
    expect(cltWith).toBeLessThanOrEqual(cltWithout);
    expect(cltWith).toBeLessThanOrEqual(sazWith);
    expect(withPriority.report!.peakRestSummary).toBeDefined();
    expect(withPriority.report!.peakRestSummary!.clt).toBeLessThanOrEqual(withPriority.report!.peakRestSummary!.sazonal);

    // Regras duras preservadas: piso >= 70% fora de domingo, domingo >= 5, nunca 7º dia
    for (let d = 0; d < 31; d++) {
      if (d === 24) continue; // 25/12 LF
      const dow = new Date(2026, 11, d + 1).getDay();
      const working = withPriority.employees.filter((e) => isWorkingShift(e.shifts['2026-12'][d])).length;
      if (dow === 0) expect(working).toBeGreaterThanOrEqual(5);
      else expect(working / withPriority.employees.length).toBeGreaterThanOrEqual(0.7);
    }
    for (const emp of withPriority.employees) {
      expect(maxConsecutiveWorkDays(emp.shifts['2026-12'])).toBeLessThanOrEqual(6);
    }
  });

  it('10. sortByExperienceDesc ordena CLT antes de Sazonal e, entre iguais, admissão mais antiga primeiro', () => {
    const emps = [
      createTestEmployee({ id: 's-new', contractType: 'Sazonal', hiredAt: '2026-11-20' }),
      createTestEmployee({ id: 'c-new', contractType: 'CLT', hiredAt: '2025-06-01' }),
      createTestEmployee({ id: 's-old', contractType: 'Sazonal', hiredAt: '2026-11-01' }),
      createTestEmployee({ id: 'c-old', contractType: 'CLT', hiredAt: '2019-03-01' }),
      createTestEmployee({ id: 'c-nodate', contractType: 'CLT' }),
    ];
    expect(sortByExperienceDesc(emps).map((e) => e.id)).toEqual(['c-nodate', 'c-old', 'c-new', 's-old', 's-new']);
  });

  it('3. getDailyAvailability exclui colaboradores com atestado (múltiplos atestados) e férias apenas nos dias afetados', () => {
    const team = [
      createTestEmployee({
        id: 'e1',
        name: 'Atestado Duplo',
        cargo: 'Caixa',
        atestados: [
          { id: 'at-1', start: '2026-11-10', end: '2026-11-11' },
          { id: 'at-2', start: '2026-11-12', end: '2026-11-14' },
        ],
      }),
      createTestEmployee({
        id: 'e2',
        name: 'Férias',
        cargo: 'Vendas',
        vacationStart: '2026-11-10',
        vacationEnd: '2026-11-20',
      }),
      createTestEmployee({
        id: 'e3',
        name: 'Ativo',
        cargo: 'Vendas',
      }),
    ];

    const day09 = getDailyAvailability(team, '2026-11-09', [], [], DEFAULT_JORNADA_SETTINGS);
    expect(day09.totalAvailable).toBe(3);

    const day13 = getDailyAvailability(team, '2026-11-13', [], [], DEFAULT_JORNADA_SETTINGS);
    expect(day13.totalAvailable).toBe(1);
    expect(day13.availablePool.map((e) => e.id)).toEqual(['e3']);

    const day21 = getDailyAvailability(team, '2026-11-21', [], [], DEFAULT_JORNADA_SETTINGS);
    expect(day21.totalAvailable).toBe(3);
  });

  it('4. reotimização incremental (reoptimizeMonthFromCutoff) após novo atestado preserva dias passados, snapshot oficial e FF existente', () => {
    const settings = makeV2Settings();
    const team = makeTeam(8);
    const initial = generateCleanMonthScheduleWithReport(
      team,
      2026,
      10,
      [],
      [],
      settings,
      undefined,
      'suggested_retro'
    ).employees;

    // Marca dia 19 (idx 18) como FF para emp-1 e lança atestado para emp-2 em 16..20
    const withManualAndAtestado = initial.map((emp, idx) => {
      const nov = [...emp.shifts['2026-11']];
      if (idx === 0) {
        nov[18] = 'FF';
      }
      return {
        ...emp,
        shifts: { ...emp.shifts, '2026-11': nov },
        ...(idx === 1
          ? {
              atestados: [{ id: 'at-mid', start: '2026-11-16', end: '2026-11-20' }],
            }
          : {}),
      };
    });

    const snapshot: OfficialScheduleSnapshot = {
      validatedAt: '2026-11-01T10:00:00Z',
      monthKey: '2026-11',
      shifts: Object.fromEntries(
        withManualAndAtestado.map((e) => [e.id, [...e.shifts['2026-11']]])
      ),
      dailyHours: {},
      tacticalPositions: {},
    };

    // Cutoff no dia 15 (idx 14)
    const reopt = reoptimizeMonthFromCutoff(withManualAndAtestado, 2026, 10, {
      cutoffDayIdx: 14,
      customHolidays: [],
      deletedNationalHolidays: [],
      settings,
      officialSnapshot: snapshot,
    });

    // Dias < 14 preservados exatamente iguais
    for (let i = 0; i < reopt.employees.length; i++) {
      expect(reopt.employees[i].shifts['2026-11'].slice(0, 14)).toEqual(
        withManualAndAtestado[i].shifts['2026-11'].slice(0, 14)
      );
    }
    // FF no dia 18 preservada
    expect(reopt.employees[0].shifts['2026-11'][18]).toBe('FF');
    // Atestado aplicado nos dias 16..20 (idx 15..19)
    expect(reopt.employees[1].shifts['2026-11'].slice(15, 20)).toEqual([
      'AT',
      'AT',
      'AT',
      'AT',
      'AT',
    ]);
  });

  it('5. registra relaxamento e aviso de capacidade quando o pool ativo de domingo ou piso de cobertura é inviável', () => {
    const settings = makeV2Settings({ minSundayWorkers: 5 });
    // Equipe pequena (4 pessoas) + 5x2 em janeiro/2027
    const smallTeam = makeTeam(4);
    const res = generateCleanMonthScheduleWithReport(
      smallTeam,
      2027,
      0,
      [],
      [],
      settings,
      undefined,
      'suggested_retro'
    );

    expect(res.report).not.toBeNull();
    expect(res.report!.capacityWarnings.length).toBeGreaterThan(0);
    expect(res.report!.relaxations.length).toBeGreaterThan(0);
  });

  it('6. respeita flags configuráveis: estoqueFixedSundayOff (default false), lfCountsAsRest (default false vs true), fiveByTwoRestMode e validateGuidelineConflicts', () => {
    const team = makeTeam(8);
    // Padrão: estoquista NÃO tem folga fixa obrigatória no domingo
    const defaultSettings = makeV2Settings();
    const defaultGuidelines = resolveMonthGuidelines(10, defaultSettings);
    expect(defaultGuidelines.estoqueFixedOffEnabled).toBe(false);
    expect(defaultGuidelines.lfCountsAsRest).toBe(false);

    // Override pela diretriz do mês para ativar folga fixa do estoquista no domingo
    const withEstoqueSunday = resolveMonthGuidelines(10, defaultSettings, undefined, {
      estoqueFixedOffEnabled: true,
      estoqueFixedOffWeekday: 0,
    });
    const resEstoque = generateCleanMonthScheduleWithReport(
      team,
      2026,
      10,
      [],
      [],
      defaultSettings,
      undefined,
      'suggested_retro',
      withEstoqueSunday
    );
    const estoquista = resEstoque.employees.find((e) => e.cargo === 'Estoque')!;
    // Todos os domingos de nov/2026 (01, 08, 15, 22, 29 -> idx 0, 7, 14, 21, 28) devem ser folga
    for (const sunIdx of [0, 7, 14, 21, 28]) {
      expect(estoquista.shifts['2026-11'][sunIdx]).toBe('F');
    }

    // lfCountsAsRest = false em Jan/2027 (01/01 = LF):
    // Na semana 1 (dias 0..6), além do LF no dia 0, o colaborador em 5x2 recebe 2 folgas reais
    const janStrictFalse = generateCleanMonthScheduleWithReport(
      team,
      2027,
      0,
      [],
      [],
      makeV2Settings(),
      undefined,
      'suggested_retro',
      resolveMonthGuidelines(0, defaultSettings, undefined, {
        lfCountsAsRest: false,
        fiveByTwoRestMode: 'strict',
      })
    );
    // 01/01/2027 é sexta-feira (LF). Semanas-calendário completas (Seg..Dom): idx 3..9, 10..16, 17..23, 24..30
    for (const emp of janStrictFalse.employees) {
      const jan = emp.shifts['2027-01'];
      expect(jan[0]).toBe('LF');
      for (const start of [3, 10, 17, 24]) {
        const realRests = jan
          .slice(start, start + 7)
          .filter((s) => s === 'F' || String(s).startsWith('FF')).length;
        expect(realRests).toBeGreaterThanOrEqual(2);
      }
    }

    // Semana do Natal (Seg 21 .. Dom 27/12/2026, idx 20..26) contém LF em 25/12:
    // com lfCountsAsRest=false o LF NÃO conta — cada colaborador precisa de 2 folgas reais além do LF
    const decLfFalse = generateCleanMonthScheduleWithReport(
      team,
      2026,
      11,
      [],
      [],
      makeV2Settings(),
      undefined,
      'suggested_retro',
      resolveMonthGuidelines(11, defaultSettings, undefined, {
        lfCountsAsRest: false,
        fiveByTwoRestMode: 'strict',
      })
    );
    for (const emp of decLfFalse.employees) {
      const week = emp.shifts['2026-12'].slice(20, 27);
      expect(week[4]).toBe('LF');
      const realRests = week.filter((s) => s === 'F' || String(s).startsWith('FF')).length;
      expect(realRests).toBeGreaterThanOrEqual(2);
    }

    // validateGuidelineConflicts detecta conflito quando piso > teto ou minSundayWorkers > pool
    const conflicts = validateGuidelineConflicts(
      team.slice(0, 3),
      2027,
      0,
      {
        ...defaultGuidelines,
        coverageMinFloor: 0.9,
        coverageTargetCap: 0.7,
        minSundayWorkers: 5,
      },
      [],
      [],
      defaultSettings
    );
    expect(conflicts.length).toBeGreaterThanOrEqual(2);
  });

  it('7. regressão e determinismo: com useSmartRestAllocatorV2=false mantém assinatura/comportamento legado; com V2 é 100% determinístico', () => {
    const team = makeTeam(8);
    const legacySettings: JornadaSettings = {
      ...DEFAULT_JORNADA_SETTINGS,
      rulesConfig: {
        ...DEFAULT_SCHEDULE_RULES,
        useSmartRestAllocatorV2: false,
      },
    };
    const legacyOut = applyMonthUpdate(
      team,
      2026,
      10,
      [],
      [],
      legacySettings,
      undefined,
      'suggested_retro'
    );
    expect(Object.keys(legacyOut)).toHaveLength(8);
    expect(legacyOut['emp-1'].shifts).toHaveLength(30);

    // Determinismo no V2: duas execuções idênticas produzem saída idêntica
    const v2Settings = makeV2Settings();
    const run1 = generateCleanMonthScheduleWithReport(
      team,
      2026,
      11,
      [],
      [],
      v2Settings,
      undefined,
      'suggested_retro'
    );
    const run2 = generateCleanMonthScheduleWithReport(
      team,
      2026,
      11,
      [],
      [],
      v2Settings,
      undefined,
      'suggested_retro'
    );
    expect(run1.employees.map((e) => e.shifts['2026-12'])).toEqual(
      run2.employees.map((e) => e.shifts['2026-12'])
    );
    expect(run1.report).toEqual(run2.report);
  });
});
