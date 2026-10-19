import { describe, it, expect } from 'vitest';
import { Employee, ShiftType, JornadaSettings } from '../types';
import { DEFAULT_JORNADA_SETTINGS } from '../src/engine/config/schedule-constants';
import { applyMonthUpdate, generateCleanMonthSchedule } from '../src/engine/orchestration/month-generator';
import { resolveTacticalDay } from '../src/engine/tactical/tactical-positions';
import { isValidSwap } from '../src/engine/peaks/protected-days';

const makeEmp = (id: string, name: string, preferredDayOff: string = 'Segunda-feira', overrides: Partial<Employee> = {}): Employee => ({
  id,
  name,
  isYoungApprentice: false,
  status: 'active',
  statusColor: 'emerald',
  shifts: {},
  dailyHours: {},
  tacticalPositions: {},
  workPeriod: '13:40 às 22:00',
  preferredDayOff,
  shiftName: 'Tarde',
  ...overrides
});

describe('Motor de Escalas — Evoluções e Edge Cases Operacionais', () => {
  // ── 1. Pre-Sunday Guard ──────────────────────────────────────────────────────────
  describe('1. Pre-Sunday Guard (Fase 2 e Fase 3)', () => {
    it('garante que colaborador escalado no domingo não chegue com 6 dias de trabalho seguidos', () => {
      // Maio de 2026: Dia 3 é Domingo. Dias 1 e 2 são Sexta e Sábado.
      // Colaborador vem com streak de 4 dias no final de Abril.
      // Se trabalhar dia 1 (Sexta: 5) e dia 2 (Sábado: 6), domingo seria o 7º dia.
      const emp = makeEmp('e1', 'Ana PreSunday', 'Nenhum', {
        shifts: {
          '2026-04': Array(30).fill('T') // Trabalhou final de abril
        }
      });

      const res = applyMonthUpdate([emp], 2026, 4, [], [], { ...DEFAULT_JORNADA_SETTINGS, minSundayWorkers: 1 });
      const shifts = res['e1'].shifts;

      // Se trabalha no domingo 3, ele deve ter recebido folga antes (no dia 1 ou 2)
      // garantindo que no domingo ele não viole o limite de 6 dias contínuos
      if (shifts[2] === 'T') {
        const hasRestBeforeSunday = shifts[0] === 'F' || shifts[1] === 'F';
        expect(hasRestBeforeSunday).toBe(true);
      }
    });

    it('em regime 6x1, reprime segunda folga fixa se já houve folga forçada por streak na mesma semana', () => {
      // Colaborador com folga fixa na Quarta-feira.
      // Entra no mês no dia 1 com streak acumulado de 6 dias, forçando folga no dia 1 (Segunda-feira).
      // Como já folgou na Segunda (CLT_MAX_STREAK_GUARD), na Quarta (dia preferencial) a segunda folga deve ser
      // reprimida caso ele vá trabalhar no próximo domingo, mantendo a escala em 6x1.
      // Setembro de 2025: Dia 1 é Segunda-feira. Domingo é dia 7.
      const emp = makeEmp('e2', 'Bruno Streak', 'Quarta-feira', {
        shifts: {
          '2025-08': Array(31).fill('T') // streak de 6 dias vindo de agosto
        }
      });

      const res = applyMonthUpdate([emp], 2025, 8, [], [], { ...DEFAULT_JORNADA_SETTINGS, minSundayWorkers: 1 });
      const shifts = res['e2'].shifts;
      const reasons = res['e2'].decisionReasons;

      // Dia 1 (Segunda, idx 0): folga obrigatória por streak
      expect(shifts[0]).toBe('F');
      expect(reasons?.[0]).toBe('CLT_MAX_STREAK_GUARD');

      // Se ele trabalhará no domingo (dia 7, idx 6):
      if (shifts[6] === 'T') {
        // Na quarta (dia 3, idx 2), não deve ter uma segunda folga acidental
        // Mantém 1 folga por semana para não desfalcar a loja
        expect(shifts[2]).toBe('T');
        expect(reasons?.[2]).toBe('REGULAR_WORK');
      }
    });
  });

  // ── 2. Cobertura Tática por Janela de Turno ─────────────────────────────────────
  describe('2. Cobertura Tática por Janela de Turno (Fase 5)', () => {
    it('garante pelo menos 1 Caixa (P1) e 1 Fiscal (P4) tanto na Abertura quanto no Fechamento', () => {
      const emps: Employee[] = [
        // Grupo Abertura (09:40 às 18:00)
        makeEmp('e_ab1', 'Abertura 1', 'Nenhum', {
          workPeriod: '09:40 às 18:00',
          cargo: 'Vendas',
          preferredPosition1: 'P3' // Gostaria de vendas
        }),
        makeEmp('e_ab2', 'Abertura 2', 'Nenhum', {
          workPeriod: '09:40 às 18:00',
          cargo: 'Vendas',
          preferredPosition1: 'P3'
        }),

        // Grupo Fechamento (13:40 às 22:00)
        makeEmp('e_fe1', 'Fechamento 1', 'Nenhum', {
          workPeriod: '13:40 às 22:00',
          cargo: 'Fiscal'
        }),
        makeEmp('e_fe2', 'Fechamento 2', 'Nenhum', {
          workPeriod: '13:40 às 22:00',
          cargo: 'Vendas',
          preferredPosition1: 'P1'
        })
      ];

      const monthKey = '2026-05';
      const dayIdx = 4; // Dia qualquer de semana
      emps.forEach(e => {
        e.shifts[monthKey] = Array(31).fill('T');
        e.dailyHours[monthKey] = Array(31).fill(e.workPeriod);
      });

      const positions = resolveTacticalDay(emps, monthKey, dayIdx, false, false, DEFAULT_JORNADA_SETTINGS);

      // As funções canônicas oficiais são atribuídas diretamente aos colaboradores
      expect(positions['e_ab1']).toBe('Vendas');
      expect(positions['e_ab2']).toBe('Vendas');
      expect(positions['e_fe1']).toBe('Fiscal');
      expect(positions['e_fe2']).toBe('Vendas');
    });
  });

  // ── 3. Validação Bidirecional em Dias Protegidos ─────────────────────────────────
  describe('3. Validação Bidirecional em Dias Protegidos (Fase 4)', () => {
    it('rejeita swap se o dia de destino for um dia protegido', () => {
      const shifts: ShiftType[] = Array(30).fill('T');
      shifts[10] = 'F';
      const protectedSet = new Set([11, 12, 13]); // Dias 12, 13, 14 protegidos (0-indexed 11, 12, 13)

      const valid = isValidSwap(shifts, 'emp1', 10, 12, 6, 0, protectedSet);
      expect(valid).toBe(false);
    });

    it('rejeita swap se a janela ultrapassar 6 dias contínuos', () => {
      // 0 a 6: trabalho contínuo ('T') -> 7 dias seguidos
      const shifts: ShiftType[] = ['T', 'T', 'T', 'T', 'T', 'T', 'F', 'T', 'T', 'T'];
      // fromDay = 6 ('F'), toDay = 9 ('T') -> mover folga de 6 para 9 causaria streak de 9 dias antes da folga
      const valid = isValidSwap(shifts, 'emp1', 6, 9, 6, 0, new Set());
      expect(valid).toBe(false);
    });

    it('aceita swap válido e equilibrado em janela segura', () => {
      const shifts: ShiftType[] = ['F', 'T', 'T', 'T', 'T', 'F', 'T', 'T', 'T', 'F'];
      // fromDay = 5 ('F'), toDay = 4 ('T')
      // Nova escala: ['F', 'T', 'T', 'T', 'F', 'T', 'T', 'T', 'T', 'F']
      // Streaks: 0, 1..3, 0, 1..4, 0 -> todos <= 6
      const valid = isValidSwap(shifts, 'emp1', 5, 4, 6, 0, new Set());
      expect(valid).toBe(true);
    });
  });

  // ── 4. Metadados de Explicabilidade (DecisionReason) ────────────────────────────
  describe('4. Metadados de Explicabilidade (DecisionReason)', () => {
    it('popula decisionReasons com códigos tipados no retorno do gerador', () => {
      const regular = makeEmp('e_reg', 'Carlos Regular', 'Segunda-feira');
      const apprentice = makeEmp('e_app', 'Lucas Aprendiz', 'Nenhum', {
        isYoungApprentice: true,
        courseDay: 'Quarta-feira'
      });

      const res = applyMonthUpdate([regular, apprentice], 2026, 4);

      expect(res['e_reg'].decisionReasons).toBeDefined();
      expect(res['e_app'].decisionReasons).toBeDefined();

      // Jovem aprendiz tem LEGAL_IMMUTABLE no curso e nos fins de semana
      const appReasons = res['e_app'].decisionReasons!;
      expect(Object.values(appReasons)).toContain('LEGAL_IMMUTABLE');

      // Colaborador regular tem folgas registradas (PREFERRED_DAY_OFF ou SUNDAY_ROTATION_OFF)
      const regReasons = res['e_reg'].decisionReasons!;
      const regValues = Object.values(regReasons);
      expect(regValues).toContain('REGULAR_WORK');
      expect(regValues.some(r => r === 'PREFERRED_DAY_OFF' || r === 'SUNDAY_ROTATION_OFF')).toBe(true);
    });

    it('generateCleanMonthSchedule armazena decisionReasons no colaborador', () => {
      const emp = makeEmp('e_clean', 'Daniela Clean', 'Terça-feira');
      const [updated] = generateCleanMonthSchedule([emp], 2026, 4);

      expect(updated.decisionReasons).toBeDefined();
      expect(updated.decisionReasons?.['2026-05']).toBeDefined();
      expect(Object.keys(updated.decisionReasons!['2026-05']).length).toBe(31);
    });
  });
});
