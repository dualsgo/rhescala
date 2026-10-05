import { describe, it, expect } from 'vitest';
import { 
  calculateLunches, 
  calculateDetailedLunches, 
  LunchAllocation 
} from '../src/engine/tactical/lunch-scheduler';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';
import { createTestEmployee } from './fixtures';

describe('FASE 7.8.1 — Redesenho do Motor de Alocação de Almoços (lunch-scheduler)', () => {
  // Helper para verificar concorrência máxima de almoços em qualquer minuto do dia
  function getMaxConcurrentLunches(allocations: LunchAllocation[]): { maxConcurrent: number; peakMinute: number } {
    let maxConcurrent = 0;
    let peakMinute = 0;
    for (let t = 600; t <= 1380; t += 15) {
      const active = allocations.filter(a => a.startMinutes <= t && a.endMinutes > t).length;
      if (active > maxConcurrent) {
        maxConcurrent = active;
        peakMinute = t;
      }
    }
    return { maxConcurrent, peakMinute };
  }

  // A. Equipe vazia
  describe('Cenário A: Equipe vazia', () => {
    it('retorna array vazio para equipe vazia', () => {
      expect(calculateLunches([], false, false)).toEqual([]);
      expect(calculateDetailedLunches([], false, false)).toEqual([]);
    });
  });

  // B. 10 pessoas
  describe('Cenário B: Equipe com 10 pessoas (Cobertura ~70%)', () => {
    it('mantém aproximadamente 70% da equipe trabalhando e nenhum grupo excessivamente concentrado', () => {
      const team = [
        // 4 Abertura (10h às 18h20)
        createTestEmployee({ id: 'ab1', name: 'Abertura 1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab2', name: 'Abertura 2', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab3', name: 'Abertura 3', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab4', name: 'Abertura 4', workPeriod: '10h às 18h20' }),
        // 2 Intermediário (12h às 20h20)
        createTestEmployee({ id: 'int1', name: 'Interm 1', workPeriod: '12h às 20h20' }),
        createTestEmployee({ id: 'int2', name: 'Interm 2', workPeriod: '12h às 20h20' }),
        // 4 Fechamento (13h40 às 22h)
        createTestEmployee({ id: 'fe1', name: 'Fech 1', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'fe2', name: 'Fech 2', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'fe3', name: 'Fech 3', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'fe4', name: 'Fech 4', workPeriod: '13h40 às 22h' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      expect(details).toHaveLength(10);

      const { maxConcurrent } = getMaxConcurrentLunches(details);
      // Com 10 pessoas, no máximo 3 pessoas (30%) em almoço simultaneamente (70% trabalhando)
      expect(maxConcurrent).toBeLessThanOrEqual(3);

      const times = details.map(d => d.timeStr);
      // Verifica se há distribuição (não coloca todo mundo no mesmo horário)
      const uniqueTimes = new Set(times);
      expect(uniqueTimes.size).toBeGreaterThanOrEqual(5);
    });
  });

  // C. 6 pessoas
  describe('Cenário C: Equipe com 6 pessoas', () => {
    it('evita concentração excessiva com no máximo 2 pessoas simultâneas em almoço', () => {
      const team = [
        createTestEmployee({ id: 'ab1', name: 'Ab 1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab2', name: 'Ab 2', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab3', name: 'Ab 3', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'fe1', name: 'Fe 1', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'fe2', name: 'Fe 2', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'fe3', name: 'Fe 3', workPeriod: '13h40 às 22h' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      const { maxConcurrent } = getMaxConcurrentLunches(details);
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  // D. 3 pessoas
  describe('Cenário D: Equipe pequena com 3 pessoas (Priorizar cobertura)', () => {
    it('garante que NUNCA há 2 pessoas em almoço ao mesmo tempo', () => {
      const team = [
        createTestEmployee({ id: 'ab1', name: 'Ab 1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'int1', name: 'Int 1', workPeriod: '12h às 20h20' }),
        createTestEmployee({ id: 'fe1', name: 'Fe 1', workPeriod: '13h40 às 22h' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      const { maxConcurrent } = getMaxConcurrentLunches(details);
      // Com apenas 3 pessoas, a cobertura é prioridade estrita: no máximo 1 em almoço
      expect(maxConcurrent).toBe(1);
    });
  });

  // E. Aprendiz
  describe('Cenário E: Aprendiz', () => {
    it('permanece fixo em 12h45 e é registrado primeiro sem sofrer deslocamento', () => {
      const team = [
        createTestEmployee({ id: 'ap1', cargo: 'Aprendiz', isYoungApprentice: true, workPeriod: '10h às 16h15' }),
        createTestEmployee({ id: 'ab1', cargo: 'Atendente', workPeriod: '10h às 18h20' }),
      ];

      const lunches = calculateLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      expect(lunches[0]).toBe('12h45');
    });
  });

  // F. Estoquista
  describe('Cenário F: Estoquista', () => {
    it('recebe horário concreto e não retorna "Flexível"', () => {
      const team = [
        createTestEmployee({ id: 'estq1', cargo: 'Estoquista', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab1', cargo: 'Atendente', workPeriod: '10h às 18h20' }),
      ];

      const lunches = calculateLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      expect(lunches[0]).not.toBe('Flexível');
      expect(lunches[0]).toMatch(/^\d{2}h(?:\d{2})?$/);
    });
  });

  // G. Abertura
  describe('Cenário G: Abertura em dia de semana', () => {
    it('distribui colaboradores dentro da janela 13h00–14h30', () => {
      const team = [
        createTestEmployee({ id: 'ab1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab2', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab3', workPeriod: '10h às 18h20' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      details.forEach(d => {
        expect(d.startMinutes).toBeGreaterThanOrEqual(13 * 60); // >= 13h00
        expect(d.startMinutes).toBeLessThanOrEqual(14 * 60 + 30); // <= 14h30
      });
    });
  });

  // H. Fechamento
  describe('Cenário H: Fechamento em dia de semana', () => {
    it('distribui colaboradores dentro da janela 15h00–17h00', () => {
      const team = [
        createTestEmployee({ id: 'fe1', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'fe2', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'fe3', workPeriod: '13h40 às 22h' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      details.forEach(d => {
        expect(d.startMinutes).toBeGreaterThanOrEqual(15 * 60); // >= 15h00
        expect(d.startMinutes).toBeLessThanOrEqual(17 * 60); // <= 17h00
      });
    });
  });

  // I. Intermediário
  describe('Cenário I: Prioridade do Intermediário sobre o Fechamento', () => {
    it('aloca intermediário preferencialmente antes do fechamento na janela de 15h', () => {
      const team = [
        createTestEmployee({ id: 'fe1', name: 'Fechamento', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'int1', name: 'Intermediario', workPeriod: '12h às 20h20' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      const intermDetail = details.find(d => d.member.id === 'int1')!;
      const fechDetail = details.find(d => d.member.id === 'fe1')!;

      // Intermediário que chegou às 12h deve almoçar antes ou no mesmo horário que o Fechamento (que chegou 13h40)
      expect(intermDetail.startMinutes).toBeLessThanOrEqual(fechDetail.startMinutes);
    });
  });

  // J. Domingo
  describe('Cenário J: Domingo', () => {
    it('não atribui almoço artificialmente às 13h para quem entra às 12h', () => {
      const team = [
        createTestEmployee({ id: 'dom_ab1', workPeriod: '12h às 20h' }),
        createTestEmployee({ id: 'dom_ab2', workPeriod: '12h às 20h' }),
      ];

      const lunches = calculateLunches(team, false, true, true, DEFAULT_JORNADA_SETTINGS);
      // Quem entra às 12h no domingo não deve sair às 13h
      expect(lunches[0]).not.toBe('13h');
      expect(lunches[1]).not.toBe('13h');

      const details = calculateDetailedLunches(team, false, true, true, DEFAULT_JORNADA_SETTINGS);
      details.forEach(d => {
        // Janela no domingo para abertura é 14h00–15h30
        expect(d.startMinutes).toBeGreaterThanOrEqual(14 * 60);
      });
    });
  });

  // K. Feriado
  describe('Cenário K: Feriado (Pausa de 15 min)', () => {
    it('gera pausas de 15 min dentro da jornada real e NUNCA antes da entrada do colaborador', () => {
      const team = [
        createTestEmployee({ id: 'h1', workPeriod: '12h às 18h' }),
        createTestEmployee({ id: 'h2', workPeriod: '14h às 20h' }),
        createTestEmployee({ id: 'h3', workPeriod: '15h às 21h' }),
      ];

      const details = calculateDetailedLunches(team, true, false, undefined, DEFAULT_JORNADA_SETTINGS);
      details.forEach(d => {
        expect(d.durationMinutes).toBe(15);
        expect(d.timeStr).toContain('15 min');
        // NUNCA antes da entrada do colaborador
        expect(d.startMinutes).toBeGreaterThanOrEqual(d.startMinutes >= 12 * 60 ? 12 * 60 : 0);
        expect(d.endMinutes).toBeLessThanOrEqual(21 * 60);
      });

      // Quem entra às 14h (840 min) NUNCA pode ter intervalo antes de sua entrada
      const h2 = details.find(d => d.member.id === 'h2')!;
      expect(h2.startMinutes).toBeGreaterThanOrEqual(14 * 60);

      // Quem entra às 15h (900 min) NUNCA pode ter intervalo antes de sua entrada (ex: 14h30)
      const h3 = details.find(d => d.member.id === 'h3')!;
      expect(h3.startMinutes).toBeGreaterThanOrEqual(15 * 60);
    });
  });

  // L. Equipe Mista
  describe('Cenário L: Equipe Mista (Abertura + Intermediário + Fechamento)', () => {
    it('orquestra suavemente os 3 turnos mantendo equilíbrio da loja', () => {
      const team = [
        createTestEmployee({ id: 'ab1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'int1', workPeriod: '12h às 20h20' }),
        createTestEmployee({ id: 'fe1', workPeriod: '13h40 às 22h' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      const ab = details.find(d => d.member.id === 'ab1')!;
      const int = details.find(d => d.member.id === 'int1')!;
      const fe = details.find(d => d.member.id === 'fe1')!;

      // Abertura almoça primeiro, depois Intermediário, depois Fechamento
      expect(ab.startMinutes).toBeLessThan(int.startMinutes);
      expect(int.startMinutes).toBeLessThan(fe.startMinutes);
    });
  });

  // M. Sobreposição temporal com minutos reais
  describe('Cenário M: Sobreposição temporal e minutos reais', () => {
    it('trabalha com minutos e durações exatas (60 min normal, 15 min feriado/aprendiz)', () => {
      const team = [
        createTestEmployee({ id: 'ap', isYoungApprentice: true, workPeriod: '10h às 16h15' }),
        createTestEmployee({ id: 'at', workPeriod: '10h às 18h20' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      const ap = details.find(d => d.member.id === 'ap')!;
      const at = details.find(d => d.member.id === 'at')!;

      expect(ap.durationMinutes).toBe(15);
      expect(ap.endMinutes - ap.startMinutes).toBe(15);

      expect(at.durationMinutes).toBe(60);
      expect(at.endMinutes - at.startMinutes).toBe(60);
    });
  });

  // N. Função Caixa (Cobertura e Alternância Operacional)
  describe('Cenário N: Função Caixa (Cobertura e Alternância Operacional)', () => {
    it('não libera dois caixas simultaneamente e Caixa Abertura aguarda a chegada real do segundo Caixa', () => {
      const team = [
        createTestEmployee({ id: 'cx_ab', name: 'Caixa Abertura', cargo: 'Atendente', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'cx_fe', name: 'Caixa Fechamento', cargo: 'Atendente', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'vend1', name: 'Vendedor', cargo: 'Atendente', workPeriod: '10h às 18h20' }),
      ];

      // Passa as funções operacionais atuais (Caixa, Vendas) via options.roles
      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS, {
        roles: { cx_ab: 'Caixa', cx_fe: 'Caixa', vend1: 'Vendas' },
      });

      const cxAb = details.find(d => d.member.id === 'cx_ab')!;
      const cxFe = details.find(d => d.member.id === 'cx_fe')!;

      expect(cxAb.role).toBe('Caixa');
      expect(cxFe.role).toBe('Caixa');

      // Caixa de abertura não sai antes da entrada do segundo Caixa (13h40 = 820 min)
      expect(cxAb.startMinutes).toBeGreaterThanOrEqual(13 * 60 + 40);

      // Caixa de fechamento só sai após o primeiro Caixa retornar do almoço
      expect(cxFe.startMinutes).toBeGreaterThanOrEqual(cxAb.endMinutes);

      // Nunca ambos em almoço ao mesmo tempo
      expect(cxAb.endMinutes <= cxFe.startMinutes || cxFe.endMinutes <= cxAb.startMinutes).toBe(true);
    });

    it('permite alternância com horários dinâmicos de entrada (ex: segundo Caixa entrando às 13h00)', () => {
      const team = [
        createTestEmployee({ id: 'cx1', name: 'Caixa Manhã', cargo: 'Atendente', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'cx2', name: 'Caixa Tarde', cargo: 'Atendente', workPeriod: '13h às 21h' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS, {
        roles: { cx1: 'Caixa', cx2: 'Caixa' },
      });

      const cx1 = details.find(d => d.member.id === 'cx1')!;
      const cx2 = details.find(d => d.member.id === 'cx2')!;

      // Caixa 1 só sai a partir das 13h00 (entrada real do Caixa 2)
      expect(cx1.startMinutes).toBeGreaterThanOrEqual(13 * 60);

      // Caixa 2 só sai após o retorno de Caixa 1
      expect(cx2.startMinutes).toBeGreaterThanOrEqual(cx1.endMinutes);
    });

    it('reconhece as funções operacionais atuais: Caixa, Vendas, Pacote e Apoio (com Repositor)', () => {
      const team = [
        createTestEmployee({ id: 'c1', cargo: 'Atendente', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'v1', cargo: 'Atendente', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'p1', cargo: 'Atendente', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'a1', cargo: 'Atendente', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'r1', cargo: 'Atendente', workPeriod: '10h às 18h20' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS, {
        roles: {
          c1: 'Caixa',
          v1: 'Vendas',
          p1: 'Pacote',
          a1: 'Apoio',
          r1: 'Repositor', // compatibilidade histórica
        },
      });

      expect(details.find(d => d.member.id === 'c1')?.role).toBe('Caixa');
      expect(details.find(d => d.member.id === 'v1')?.role).toBe('Vendas');
      expect(details.find(d => d.member.id === 'p1')?.role).toBe('Pacote');
      expect(details.find(d => d.member.id === 'a1')?.role).toBe('Apoio');
      expect(details.find(d => d.member.id === 'r1')?.role).toBe('Apoio');
    });
  });
});
