import { describe, it, expect } from 'vitest';
import { 
  getPrevMonthConsecutive, 
  buildSundayAssignments, 
  findSundayViolations 
} from '../hooks/useScheduleEngine';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';
import { createTestEmployee } from './fixtures';

describe('Rotação e Regras de Domingos CLT', () => {
  const YEAR = 2028;
  const MONTH = 9; // Outubro 2028: domingos nos dias 1, 8, 15, 22, 29 (índices 0, 7, 14, 21, 28)
  const SUNDAYS_IN_OCT = [0, 7, 14, 21, 28];

  describe('Carryover de Domingos do Mês Anterior (getPrevMonthConsecutive)', () => {
    it('retorna 0 se o colaborador não trabalhou nenhum domingo recente', () => {
      // Setembro 2028 tem domingos em 3, 10, 17, 24 (índices 2, 9, 16, 23)
      const emp = createTestEmployee({
        id: 'emp-1',
        shifts: {
          '2028-09': Array(30).fill('T').map((s, idx) => [2, 9, 16, 23].includes(idx) ? 'F' : 'T')
        }
      });

      const map = getPrevMonthConsecutive([emp], YEAR, MONTH);
      expect(map.get('emp-1')).toBe(0);
    });

    it('retorna 1 se trabalhou apenas o último domingo do mês anterior', () => {
      const emp = createTestEmployee({
        id: 'emp-1',
        shifts: {
          '2028-09': Array(30).fill('T').map((s, idx) => {
            if (idx === 16) return 'F'; // penúltimo domingo folga
            if (idx === 23) return 'T'; // último domingo trabalha
            return 'T';
          })
        }
      });

      const map = getPrevMonthConsecutive([emp], YEAR, MONTH);
      expect(map.get('emp-1')).toBe(1);
    });

    it('retorna 2 se trabalhou os dois últimos domingos consecutivos do mês anterior', () => {
      const emp = createTestEmployee({
        id: 'emp-1',
        shifts: {
          '2028-09': Array(30).fill('T').map((s, idx) => {
            if (idx === 16) return 'T'; // penúltimo domingo trabalha
            if (idx === 23) return 'T'; // último domingo trabalha
            return 'F';
          })
        }
      });

      const map = getPrevMonthConsecutive([emp], YEAR, MONTH);
      expect(map.get('emp-1')).toBe(2);
    });
  });

  describe('Distribuição de Domingos (buildSundayAssignments)', () => {
    it('obriga folga (mustRest) no primeiro domingo para quem já acumulou 2 domingos consecutivos', () => {
      const empTired = createTestEmployee({ id: 'emp-tired', name: 'Trabalhou 2 seguidos' });
      const empFresh = createTestEmployee({ id: 'emp-fresh', name: 'Descansado' });
      const activeEmps = [
        empTired,
        empFresh,
        createTestEmployee({ id: 'emp-3' }),
        createTestEmployee({ id: 'emp-4' }),
        createTestEmployee({ id: 'emp-5' }),
        createTestEmployee({ id: 'emp-6' }),
        createTestEmployee({ id: 'emp-7' })
      ];

      const initialStreak = new Map<string, number>([
        ['emp-tired', 2],
        ['emp-fresh', 0]
      ]);

      const { assignments } = buildSundayAssignments(
        activeEmps,
        YEAR,
        MONTH,
        SUNDAYS_IN_OCT,
        initialStreak,
        { ...DEFAULT_JORNADA_SETTINGS, minSundayWorkers: 3 }
      );

      // empTired deve ter folga (estar no Set) no 1º domingo (índice 0)
      const tiredRests = assignments.get('emp-tired');
      expect(tiredRests?.has(0)).toBe(true);
    });

    it('exclui colaboradores indisponíveis da rotação (férias, atestado ou folga fixa no domingo)', () => {
      const empOnVacation = createTestEmployee({
        id: 'emp-vacation',
        vacationStart: '2028-10-01',
        vacationEnd: '2028-10-15'
      });
      const empSunOff = createTestEmployee({
        id: 'emp-sun-off',
        preferredDayOff: 'Domingo'
      });
      const regularEmps = [
        createTestEmployee({ id: 'e1' }),
        createTestEmployee({ id: 'e2' }),
        createTestEmployee({ id: 'e3' }),
        createTestEmployee({ id: 'e4' }),
        createTestEmployee({ id: 'e5' })
      ];

      const all = [empOnVacation, empSunOff, ...regularEmps];

      const { assignments } = buildSundayAssignments(
        all,
        YEAR,
        MONTH,
        SUNDAYS_IN_OCT,
        undefined,
        DEFAULT_JORNADA_SETTINGS
      );

      // Durante o período de férias (domingos nos índices 0, 7 e 14), o colaborador não recebe folga de rotação
      const vacationRests = assignments.get('emp-vacation');
      expect(vacationRests?.has(0)).toBe(false);
      expect(vacationRests?.has(7)).toBe(false);
      expect(vacationRests?.has(14)).toBe(false);

      // Colaborador com folga fixa aos domingos não participa da rotação em nenhum domingo
      expect(assignments.get('emp-sun-off')?.size).toBe(0);
    });

    it('respeita maxFolgas em domingos protegidos', () => {
      const emps = Array.from({ length: 8 }, (_, i) => createTestEmployee({ id: `emp-${i + 1}` }));
      
      // Dia 1 de Outubro (domingo, dayNum 1) protegido com maxFolgas: 1
      const protectedConfig = {
        1: { dayNum: 1, maxFolgas: 1 }
      };

      const { assignments } = buildSundayAssignments(
        emps,
        YEAR,
        MONTH,
        SUNDAYS_IN_OCT,
        undefined,
        { ...DEFAULT_JORNADA_SETTINGS, minSundayWorkers: 4 },
        protectedConfig
      );

      // Conta quantas folgas foram atribuídas no domingo 1 (índice 0)
      let folgasNoDia1 = 0;
      emps.forEach(e => {
        if (assignments.get(e.id)?.has(0)) folgasNoDia1++;
      });

      expect(folgasNoDia1).toBeLessThanOrEqual(1);
    });
  });

  describe('Detecção de Violações de Domingo CLT (findSundayViolations)', () => {
    it('detecta quando um colaborador trabalha 3 ou mais domingos seguidos', () => {
      // 3 domingos seguidos trabalhados nos dias 1, 8 e 15 de Outubro (índices 0, 7, 14)
      const empViolator = createTestEmployee({
        id: 'emp-violator',
        name: 'Carlos Silva',
        shifts: {
          '2028-10': Array(31).fill('F').map((s, idx) => [0, 7, 14].includes(idx) ? 'T' : 'F')
        }
      });

      const violations = findSundayViolations([empViolator], { year: 2028, month: 9 });
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0].empName).toBe('Carlos Silva');
      expect(violations[0].date).toBe('2028-10-15');
    });

    it('não acusa violação quando o colaborador folga no máximo a cada 2 domingos trabalhados', () => {
      const empCompliant = createTestEmployee({
        id: 'emp-ok',
        name: 'Maria Santos',
        shifts: {
          '2028-10': Array(31).fill('T').map((s, idx) => {
            // Dias de domingo: 0, 7, 14, 21, 28
            // Trabalha dia 1 (0) e dia 8 (7), folga dia 15 (14)
            if (idx === 14) return 'F';
            return 'T';
          })
        }
      });

      const violations = findSundayViolations([empCompliant], { year: 2028, month: 9 });
      // Não deve violar nos primeiros 3 domingos
      const earlyViolations = violations.filter(v => v.date <= '2028-10-15');
      expect(earlyViolations).toHaveLength(0);
    });
  });
});
