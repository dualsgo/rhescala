import { describe, it, expect } from 'vitest';
import { 
  applyMonthUpdate, 
  applyFolgasOnly, 
  generateCleanMonthSchedule,
  findSundayViolations
} from '../hooks/useScheduleEngine';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';
import { createTestEmployee } from './fixtures';

describe('Criação do Novo Mês e Aplicação Avulsa (Regras CLT, Domingos e Folgas Fixas)', () => {
  const YEAR = 2028;
  const MONTH = 9; // Outubro de 2028: dias 1, 8, 15, 22, 29 são domingos (índices 0, 7, 14, 21, 28)

  describe('1. Revezamento de Domingos e Equipe Mínima', () => {
    it('garante a operação mínima (minSundayWorkers) em cada domingo do mês', () => {
      // 6 colaboradores ativos regulares
      const employees = Array.from({ length: 6 }, (_, i) => createTestEmployee({
        id: `emp-${i + 1}`,
        name: `Colaborador ${i + 1}`,
        jornada: '6x1',
        preferredDayOff: 'Nenhum'
      }));

      const settings = {
        ...DEFAULT_JORNADA_SETTINGS,
        minSundayWorkers: 3
      };

      const res = applyMonthUpdate(employees, YEAR, MONTH, [], [], settings);
      const sundays = [0, 7, 14, 21, 28];

      sundays.forEach(sunIdx => {
        let workers = 0;
        employees.forEach(emp => {
          const shift = res[emp.id].shifts[sunIdx];
          if (shift === 'T') workers++;
        });
        expect(workers).toBeGreaterThanOrEqual(settings.minSundayWorkers);
      });
    });

    it('impede que qualquer colaborador trabalhe 3 domingos consecutivos (limite CLT de 2)', () => {
      const employees = Array.from({ length: 5 }, (_, i) => createTestEmployee({
        id: `emp-${i + 1}`,
        name: `Colaborador ${i + 1}`,
        jornada: '6x1',
        preferredDayOff: 'Nenhum'
      }));

      const res = applyMonthUpdate(employees, YEAR, MONTH);
      const updatedEmployees = employees.map(e => ({
        ...e,
        shifts: { '2028-10': res[e.id].shifts }
      }));

      const violations = findSundayViolations(updatedEmployees, { year: YEAR, month: MONTH });
      expect(violations).toHaveLength(0);
    });

    it('obriga folga no primeiro domingo do mês quando o colaborador vem com 2 domingos trabalhados no mês anterior', () => {
      // Setembro 2028: domingos nos dias 3, 10, 17, 24 (índices 2, 9, 16, 23)
      const empTired = createTestEmployee({
        id: 'emp-tired',
        jornada: '6x1',
        preferredDayOff: 'Nenhum',
        shifts: {
          '2028-09': Array(30).fill('T').map((s, idx) => {
            if (idx === 16 || idx === 23) return 'T'; // trabalhou os 2 últimos domingos de setembro
            return 'F';
          })
        }
      });

      const empFresh = createTestEmployee({
        id: 'emp-fresh',
        jornada: '6x1',
        preferredDayOff: 'Nenhum'
      });

      const res = applyMonthUpdate([empTired, empFresh], YEAR, MONTH, [], [], { ...DEFAULT_JORNADA_SETTINGS, minSundayWorkers: 1 });
      // Dia 1 de Outubro é domingo (índice 0). empTired deve obrigatoriamente folgar
      expect(res['emp-tired'].shifts[0]).toBe('F');
    });

    it('garante que Estoquistas e quem tem folga fixa no domingo nunca trabalhem aos domingos', () => {
      const estoquista = createTestEmployee({
        id: 'emp-estq',
        cargo: 'Estoquista',
        jornada: '6x1',
        preferredDayOff: 'Domingo'
      });
      const regular = createTestEmployee({
        id: 'emp-reg',
        jornada: '6x1',
        preferredDayOff: 'Nenhum'
      });

      const res = applyMonthUpdate([estoquista, regular], YEAR, MONTH);
      const sundays = [0, 7, 14, 21, 28];

      sundays.forEach(sunIdx => {
        expect(res['emp-estq'].shifts[sunIdx]).toBe('F');
      });
    });
  });

  describe('2. Preferência de Folga Fixa da Semana e Limite de 6 Dias (CLT DSR)', () => {
    it('aplica a folga semanal fixa preferida (ex: Terça-feira) ao longo de todo o mês', () => {
      const emp = createTestEmployee({
        id: 'emp-tue',
        jornada: '6x1',
        preferredDayOff: 'Terça-feira'
      });

      const res = applyMonthUpdate([emp], YEAR, MONTH);
      const shifts = res['emp-tue'].shifts;

      // Terças-feiras de Outubro 2028: dias 3, 10, 17, 24, 31 (índices 2, 9, 16, 23, 30)
      const tuesdays = [2, 9, 16, 23, 30];
      tuesdays.forEach(tueIdx => {
        expect(shifts[tueIdx]).toBe('F');
      });
    });

    it('aceita variações de formato no preferredDayOff (ex: "Quarta" ou "Quarta-feira")', () => {
      const emp1 = createTestEmployee({ id: 'emp-wed1', preferredDayOff: 'Quarta' });
      const emp2 = createTestEmployee({ id: 'emp-wed2', preferredDayOff: 'Quarta-feira' });

      const res = applyMonthUpdate([emp1, emp2], YEAR, MONTH);
      // Quartas-feiras de Outubro 2028: dias 4, 11, 18, 25 (índices 3, 10, 17, 24)
      [3, 10, 17, 24].forEach(wedIdx => {
        expect(res['emp-wed1'].shifts[wedIdx]).toBe('F');
        expect(res['emp-wed2'].shifts[wedIdx]).toBe('F');
      });
    });

    it('garante que nenhum colaborador trabalhe mais de 6 dias consecutivos (folga mandatória no 7º dia)', () => {
      const emp = createTestEmployee({
        id: 'emp-dsr',
        jornada: '6x1',
        preferredDayOff: 'Sexta-feira' // Sexta é no dia 6, mas o mês começa no domingo
      });

      const res = applyMonthUpdate([emp], YEAR, MONTH);
      const shifts = res['emp-dsr'].shifts;

      let workStreak = 0;
      for (let i = 0; i < shifts.length; i++) {
        if (shifts[i] === 'T') {
          workStreak++;
          expect(workStreak).toBeLessThanOrEqual(6);
        } else {
          workStreak = 0;
        }
      }
    });

    it('força folga compensatória logo no início do mês se houver carryover de dias trabalhados do mês anterior', () => {
      // Colaborador trabalhou 5 dias seguidos no fim de Setembro
      const empCarry = createTestEmployee({
        id: 'emp-carry',
        jornada: '6x1',
        preferredDayOff: 'Quinta-feira', // Quinta é só no dia 5!
        shifts: {
          '2028-09': [
            'F', 'T', 'T', 'T', 'T', 'T', 'F',
            'T', 'T', 'T', 'T', 'T', 'T', 'F',
            'T', 'T', 'T', 'T', 'T', 'T', 'F',
            'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T' // termina com 5+ dias de trabalho contínuo
          ]
        }
      });

      const res = applyMonthUpdate([empCarry], YEAR, MONTH);
      const shifts = res['emp-carry'].shifts;

      // Não pode trabalhar até quinta sem folga: deve folgar no início para não passar de 6 dias
      const firstRest = shifts.slice(0, 3).indexOf('F');
      expect(firstRest).toBeGreaterThanOrEqual(0);
    });
  });

  describe('3. Aplicação Avulsa (targetEmpId e applyFolgasOnly)', () => {
    it('aplica folgas avulso para um colaborador específico respeitando sua folga fixa e streak', () => {
      const empTarget = createTestEmployee({
        id: 'emp-single',
        name: 'Carlos Alvo',
        jornada: '6x1',
        preferredDayOff: 'Segunda-feira'
      });
      const otherEmp = createTestEmployee({
        id: 'emp-other',
        name: 'Maria Equipe',
        jornada: '6x1',
        preferredDayOff: 'Quinta-feira'
      });

      const result = applyFolgasOnly([empTarget, otherEmp], YEAR, MONTH, 'emp-single');

      expect(result['emp-single']).toBeDefined();
      expect(result['emp-single']).toHaveLength(31);

      // Segundas-feiras de Outubro 2028: dias 2, 9, 16, 23, 30 (índices 1, 8, 15, 22, 29)
      const mondays = [1, 8, 15, 22, 29];
      mondays.forEach(mIdx => {
        expect(result['emp-single'][mIdx]).toBe('F');
      });
    });

    it('na aplicação avulsa, integra-se com a equipe já escalada nos domingos para respeitar o contingente', () => {
      // 3 outros colaboradores já estão com turnos trabalhados no primeiro domingo (índice 0)
      const emp1 = createTestEmployee({ id: 'e1', shifts: { '2028-10': ['T'] } });
      const emp2 = createTestEmployee({ id: 'e2', shifts: { '2028-10': ['T'] } });
      const emp3 = createTestEmployee({ id: 'e3', shifts: { '2028-10': ['T'] } });

      const empTarget = createTestEmployee({
        id: 'e-target',
        jornada: '6x1',
        preferredDayOff: 'Nenhum'
      });

      const settings = { ...DEFAULT_JORNADA_SETTINGS, minSundayWorkers: 3 };
      const res = applyMonthUpdate([emp1, emp2, emp3, empTarget], YEAR, MONTH, [], [], settings, undefined, 'suggested_retro', 'e-target');

      // Como já existem 3 colaboradores trabalhando no domingo 1, empTarget pode receber folga de revezamento
      expect(res['e-target'].shifts[0]).toBe('F');
    });
  });

  describe('4. Criação de Novo Mês Completa (generateCleanMonthSchedule)', () => {
    it('gera escala mensal inteligente e limpa aplicando regras para toda a equipe', () => {
      const team = [
        createTestEmployee({ id: 't1', cargo: 'Atendente', preferredDayOff: 'Terça-feira' }),
        createTestEmployee({ id: 't2', cargo: 'Atendente', preferredDayOff: 'Quarta-feira' }),
        createTestEmployee({ id: 't3', cargo: 'Estoquista', preferredDayOff: 'Domingo' }),
        createTestEmployee({ id: 't4', cargo: 'Aprendiz', isYoungApprentice: true, courseDay: 'Quarta-feira' })
      ];

      const updated = generateCleanMonthSchedule(team, YEAR, MONTH);

      expect(updated).toHaveLength(4);
      const t1 = updated.find(e => e.id === 't1')!;
      const t3 = updated.find(e => e.id === 't3')!;
      const t4 = updated.find(e => e.id === 't4')!;

      // t1 folga nas terças
      expect(t1.shifts['2028-10'][2]).toBe('F');
      // t3 (estoquista) folga nos domingos
      expect(t3.shifts['2028-10'][0]).toBe('F');
      // t4 (aprendiz) folga fim de semana e curso na quarta
      expect(t4.shifts['2028-10'][0]).toBe('F'); // Domingo
      expect(t4.shifts['2028-10'][3]).toBe('C'); // Quarta (curso)
    });
  });
});
