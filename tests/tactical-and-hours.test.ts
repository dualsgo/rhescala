import { describe, it, expect } from 'vitest';
import { 
  getShiftClassification, 
  calculateLunches, 
  resolveTacticalDay,
  getCleaningSchedule 
} from '../hooks/useScheduleEngine';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';
import { createTestEmployee } from './fixtures';

describe('Horários, Almoços e Posições Táticas', () => {
  describe('Classificação de Turnos (getShiftClassification)', () => {
    it('retorna N/A para turnos vazios, OFF ou FOLGA', () => {
      expect(getShiftClassification('')).toBe('N/A');
      expect(getShiftClassification('OFF')).toBe('N/A');
      expect(getShiftClassification('FOLGA')).toBe('N/A');
    });

    it('classifica aprendiz sempre como Abertura', () => {
      expect(getShiftClassification('10h às 16h15')).toBe('Abertura');
    });

    describe('Em dias de semana', () => {
      it('classifica <= 10h como Abertura', () => {
        expect(getShiftClassification('10h às 18h20')).toBe('Abertura');
        expect(getShiftClassification('09h às 17h20')).toBe('Abertura');
      });

      it('classifica 11h e 12h como Intermediário', () => {
        expect(getShiftClassification('12h às 20h20')).toBe('Intermediário');
      });

      it('classifica >= 13h como Fechamento', () => {
        expect(getShiftClassification('13h40 às 22h')).toBe('Fechamento');
        expect(getShiftClassification('14h às 22h20')).toBe('Fechamento');
      });
    });

    describe('Em domingos', () => {
      it('classifica <= 12h como Abertura e > 12h como Fechamento', () => {
        expect(getShiftClassification('12h às 20h', true)).toBe('Abertura');
        expect(getShiftClassification('13h às 21h', true)).toBe('Fechamento');
      });
    });
  });

  describe('Cálculo de Horários de Almoço (calculateLunches)', () => {
    it('retorna array vazio para equipe vazia', () => {
      expect(calculateLunches([], false, false, true)).toEqual([]);
    });

    it('em feriados: aprendiz recebe 12h45, estoquista recebe horário concreto e atendentes recebem pausas de 15 min escalonadas', () => {
      const team = [
        createTestEmployee({ id: '1', isYoungApprentice: true }),
        createTestEmployee({ id: '2', cargo: 'Estoque' }),
        createTestEmployee({ id: '3', cargo: 'Vendas' }),
        createTestEmployee({ id: '4', cargo: 'Vendas' })
      ];

      const lunches = calculateLunches(team, true, false, true, DEFAULT_JORNADA_SETTINGS);

      expect(lunches[0]).toBe('12h45');
      expect(lunches[1]).toContain('15 min');
      expect(lunches[1]).not.toBe('Flexível');
      expect(lunches[2]).toContain('15 min');
      expect(lunches[3]).toContain('15 min');
    });

    it('em domingos de abertura: aloca almoço na janela 14h00-15h30 (não às 13h)', () => {
      const team = [
        createTestEmployee({ id: '1', workPeriod: '12h às 20h' }),
        createTestEmployee({ id: '2', workPeriod: '12h às 20h' }),
        createTestEmployee({ id: '3', workPeriod: '12h às 20h' })
      ];

      const lunches = calculateLunches(team, false, true, true, DEFAULT_JORNADA_SETTINGS);

      // Nenhum colaborador que entra às 12h deve receber almoço artificialmente às 13h
      expect(lunches[0]).not.toBe('13h');
      expect(['14h', '14h30', '15h', '15h30']).toContain(lunches[0]);
      expect(['14h', '14h30', '15h', '15h30']).toContain(lunches[1]);
      expect(['14h', '14h30', '15h', '15h30']).toContain(lunches[2]);
    });

    it('em domingos de fechamento: aloca almoço na janela de fechamento após retorno da abertura', () => {
      const team = [
        createTestEmployee({ id: '1', workPeriod: '13h às 21h' }),
        createTestEmployee({ id: '2', workPeriod: '13h às 21h' }),
        createTestEmployee({ id: '3', workPeriod: '13h às 21h' })
      ];

      const lunches = calculateLunches(team, false, true, false, DEFAULT_JORNADA_SETTINGS);

      // Fechamento no domingo aloca na janela 15h30 - 17h30
      expect(['15h30', '16h', '16h30', '17h']).toContain(lunches[0]);
      expect(['15h30', '16h', '16h30', '17h']).toContain(lunches[1]);
      expect(['15h30', '16h', '16h30', '17h']).toContain(lunches[2]);
    });
  });

  describe('Distribuição de Posições Táticas (resolveTacticalDay)', () => {
    const MONTH_KEY = '2028-10';
    const DAY_IDX = 0; // 1º dia do mês

    it('atribui ESTQ automaticamente para Estoquistas', () => {
      const estoque = createTestEmployee({
        id: 'emp-estq',
        cargo: 'Estoque',
        shifts: { [MONTH_KEY]: ['T'] },
        dailyHours: { [MONTH_KEY]: ['10h às 18h20'] }
      });

      const res = resolveTacticalDay([estoque], MONTH_KEY, DAY_IDX, false, false);
      expect(res['emp-estq']).toBe('Estoque');
    });

    it('preserva posições manuais definidas na grade', () => {
      const emp = createTestEmployee({
        id: 'emp-manual',
        cargo: 'Vendas',
        shifts: { [MONTH_KEY]: ['T'] },
        dailyHours: { [MONTH_KEY]: ['10h às 18h20'] },
        tacticalPositions: { [MONTH_KEY]: ['P3'] }
      });

      const res = resolveTacticalDay([emp], MONTH_KEY, DAY_IDX, false, false);
      expect(res['emp-manual']).toBe('Vendas');
    });

    it('preenche P1 obrigatoriamente priorizando colaborador com preferência P1', () => {
      const empP1Fan = createTestEmployee({
        id: 'emp-fan',
        cargo: 'Vendas',
        preferredPosition1: 'P1',
        shifts: { [MONTH_KEY]: ['T'] },
        dailyHours: { [MONTH_KEY]: ['10h às 18h20'] }
      });
      const empOther = createTestEmployee({
        id: 'emp-other',
        cargo: 'Vendas',
        shifts: { [MONTH_KEY]: ['T'] },
        dailyHours: { [MONTH_KEY]: ['10h às 18h20'] }
      });

      const res = resolveTacticalDay([empOther, empP1Fan], MONTH_KEY, DAY_IDX, false, false);
      expect(res['emp-fan']).toBe('Caixa');
      expect(res['emp-other']).toBe('Vendas');
    });

    it('ignora colaboradores de folga ou afastamento', () => {
      const empOff = createTestEmployee({
        id: 'emp-off',
        shifts: { [MONTH_KEY]: ['F'] },
        dailyHours: { [MONTH_KEY]: ['10h às 18h20'] }
      });

      const res = resolveTacticalDay([empOff], MONTH_KEY, DAY_IDX, false, false);
      expect(res['emp-off']).toBeUndefined();
    });
  });

  describe('Escala de Limpeza da Copa (getCleaningSchedule)', () => {
    it('distribui a limpeza equilibrada excluindo Aprendizes e Estoquistas', () => {
      const atendente1 = createTestEmployee({ id: 'a1', name: 'Atendente Um', cargo: 'Vendas', shifts: { '2028-10': Array(31).fill('T') } });
      const atendente2 = createTestEmployee({ id: 'a2', name: 'Atendente Dois', cargo: 'Vendas', shifts: { '2028-10': Array(31).fill('T') } });
      const estoquista = createTestEmployee({ id: 'e1', name: 'Estoquista João', cargo: 'Estoque', shifts: { '2028-10': Array(31).fill('T') } });
      const aprendiz = createTestEmployee({ id: 'ap1', name: 'Aprendiz Ana', isYoungApprentice: true, cargo: 'Apoio', shifts: { '2028-10': Array(31).fill('T') } });

      const schedule = getCleaningSchedule([atendente1, atendente2, estoquista, aprendiz], { year: 2028, month: 9 });

      expect(schedule).toHaveLength(31);
      // Nenhuma limpeza pode ser atribuída ao estoquista ou ao aprendiz
      schedule.forEach(entry => {
        expect(entry.empId).not.toBe('e1');
        expect(entry.empId).not.toBe('ap1');
      });

      // Apenas a1 e a2 se revezam
      const countA1 = schedule.filter(s => s.empId === 'a1').length;
      const countA2 = schedule.filter(s => s.empId === 'a2').length;
      expect(countA1 + countA2).toBe(31);
      // Equilíbrio: a diferença entre os dois deve ser no máximo 1
      expect(Math.abs(countA1 - countA2)).toBeLessThanOrEqual(1);
    });
  });
});
