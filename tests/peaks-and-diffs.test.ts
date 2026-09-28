import { describe, it, expect } from 'vitest';
import { 
  optimizeOctoberPeak, 
  optimizeProtectedDays, 
  detectScheduleDiffs 
} from '../hooks/useScheduleEngine';
import { OfficialScheduleSnapshot } from '../types';
import { createTestEmployee } from './fixtures';

describe('Otimização de Picos Sazonais e Auditoria de Diferenças (Diffs)', () => {
  describe('Otimização de Pico de Outubro (optimizeOctoberPeak)', () => {
    const MONTH_KEY = '2028-10'; // 31 dias

    it('converte folgas comuns (F) em dias trabalhados (T) durante os dias de pico (8 a 12 de Outubro)', () => {
      // Cria colaborador que tinha folga no dia 10 (índice 9)
      const emp = createTestEmployee({
        id: 'emp-peak',
        shifts: {
          [MONTH_KEY]: Array(31).fill('T').map((s, idx) => idx === 9 ? 'F' : 'T')
        }
      });

      const res = optimizeOctoberPeak([emp], MONTH_KEY);
      const optimizedShifts = res['emp-peak'].shifts;

      // Dias 8 a 12 (índices 7 a 11) devem ser 'T'
      for (let i = 7; i <= 11; i++) {
        expect(optimizedShifts[i]).toBe('T');
      }
    });

    it('preserva status protegidos (FE, AT, DO, N/A) mesmo se coincidirem com o pico', () => {
      const empVacation = createTestEmployee({
        id: 'emp-vac',
        shifts: {
          [MONTH_KEY]: Array(31).fill('T').map((s, idx) => idx === 9 ? 'FE' : 'T')
        }
      });
      const empAtestado = createTestEmployee({
        id: 'emp-at',
        shifts: {
          [MONTH_KEY]: Array(31).fill('T').map((s, idx) => idx === 8 ? 'AT' : 'T')
        }
      });

      const resVac = optimizeOctoberPeak([empVacation], MONTH_KEY);
      expect(resVac['emp-vac'].shifts[9]).toBe('FE');

      const resAt = optimizeOctoberPeak([empAtestado], MONTH_KEY);
      expect(resAt['emp-at'].shifts[8]).toBe('AT');
    });
  });

  describe('Dias Protegidos Gerais (optimizeProtectedDays)', () => {
    const MONTH_KEY = '2028-10';

    it('restringe folgas em dias protegidos de acordo com maxFolgas', () => {
      const emps = Array.from({ length: 6 }, (_, i) => 
        createTestEmployee({
          id: `emp-${i + 1}`,
          shifts: { [MONTH_KEY]: Array(31).fill('F') } // todos com folga inicialmente
        })
      );

      // Dia 15 de Outubro protegido com maxFolgas = 1
      const protectedConfig = {
        15: { dayNum: 15, maxFolgas: 1 }
      };

      const res = optimizeProtectedDays(emps, MONTH_KEY, protectedConfig);

      let folgasDia15 = 0;
      emps.forEach(e => {
        if (res[e.id]?.shifts[14] === 'F') {
          folgasDia15++;
        }
      });

      expect(folgasDia15).toBeLessThanOrEqual(1);
    });
  });

  describe('Auditoria de Divergências (detectScheduleDiffs)', () => {
    const MY = { month: 9, year: 2028 }; // Outubro 2028
    const MONTH_KEY = '2028-10';

    it('retorna array vazio quando snapshot é undefined ou de outro mês', () => {
      expect(detectScheduleDiffs(undefined, [], MY)).toEqual([]);

      const snapshotWrongMonth: OfficialScheduleSnapshot = {
        monthKey: '2028-09',
        validatedAt: '2028-09-01T00:00:00Z',
        shifts: {},
        dailyHours: {},
        tacticalPositions: {}
      };
      expect(detectScheduleDiffs(snapshotWrongMonth, [], MY)).toEqual([]);
    });

    it('detecta mudança de turno entre trabalho e folga', () => {
      const snapshot: OfficialScheduleSnapshot = {
        monthKey: MONTH_KEY,
        validatedAt: '2028-10-01T00:00:00Z',
        shifts: {
          'emp-1': ['T', 'T', 'F', 'T']
        },
        dailyHours: {},
        tacticalPositions: {}
      };

      const emp = createTestEmployee({
        id: 'emp-1',
        name: 'Ana',
        shifts: {
          [MONTH_KEY]: ['T', 'F', 'F', 'T'] // Dia 2 (index 1) mudou de 'T' para 'F'
        }
      });

      const diffs = detectScheduleDiffs(snapshot, [emp], MY);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].type).toBe('shift');
      expect(diffs[0].officialVal).toBe('T');
      expect(diffs[0].currentVal).toBe('F');
      expect(diffs[0].dayIdx).toBe(1);
    });

    it('detecta mudança de horário de trabalho', () => {
      const snapshot: OfficialScheduleSnapshot = {
        monthKey: MONTH_KEY,
        validatedAt: '2028-10-01T00:00:00Z',
        shifts: {
          'emp-1': ['T', 'T', 'T']
        },
        dailyHours: {
          'emp-1': ['10h às 18h20', '10h às 18h20', '10h às 18h20']
        },
        tacticalPositions: {}
      };

      const emp = createTestEmployee({
        id: 'emp-1',
        name: 'Bruno',
        shifts: {
          [MONTH_KEY]: ['T', 'T', 'T']
        },
        dailyHours: {
          [MONTH_KEY]: ['10h às 18h20', '13h40 às 22h', '10h às 18h20'] // Dia 2 mudou horário
        }
      });

      const diffs = detectScheduleDiffs(snapshot, [emp], MY);
      const hourDiffs = diffs.filter(d => d.type === 'hour');
      expect(hourDiffs).toHaveLength(1);
      expect(hourDiffs[0].officialVal).toBe('10h às 18h20');
      expect(hourDiffs[0].currentVal).toBe('13h40 às 22h');
    });

    it('atualmente compara turnos e horários (posições táticas são extraídas mas não geram diff)', () => {
      const snapshot: OfficialScheduleSnapshot = {
        monthKey: MONTH_KEY,
        validatedAt: '2028-10-01T00:00:00Z',
        shifts: {
          'emp-1': ['T']
        },
        dailyHours: {
          'emp-1': ['10h às 18h20']
        },
        tacticalPositions: {
          'emp-1': ['P1']
        }
      };

      const emp = createTestEmployee({
        id: 'emp-1',
        name: 'Camila',
        shifts: {
          [MONTH_KEY]: ['T']
        },
        dailyHours: {
          [MONTH_KEY]: ['10h às 18h20']
        },
        tacticalPositions: {
          [MONTH_KEY]: ['P2']
        }
      });

      const diffs = detectScheduleDiffs(snapshot, [emp], MY);
      // Comportamento atual documentado: apenas shift e hour geram diffs
      expect(diffs).toHaveLength(0);
    });
  });
});
