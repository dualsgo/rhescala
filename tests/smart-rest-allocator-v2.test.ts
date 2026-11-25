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
    const firstEmpWeek1 = janStrictFalse.employees[0].shifts['2027-01'].slice(0, 7);
    const realRestsWeek1 = firstEmpWeek1.filter((s) => s === 'F' || s === 'FF').length;
    expect(firstEmpWeek1[0]).toBe('LF');
    expect(realRestsWeek1).toBe(2);

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
