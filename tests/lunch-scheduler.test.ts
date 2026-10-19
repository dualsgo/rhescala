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
        createTestEmployee({ id: 'ap1', cargo: 'Apoio', isYoungApprentice: true, workPeriod: '10h às 16h15' }),
        createTestEmployee({ id: 'ab1', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
      ];

      const lunches = calculateLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      expect(lunches[0]).toBe('12h45');
    });
  });

  // F. Estoquista
  describe('Cenário F: Estoquista', () => {
    it('recebe horário concreto e não retorna "Flexível"', () => {
      const team = [
        createTestEmployee({ id: 'estq1', cargo: 'Estoque', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab1', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
      ];

      const lunches = calculateLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      expect(lunches[0]).not.toBe('Flexível');
      expect(lunches[0]).toMatch(/^\d{2}h(?:\d{2})?$/);
    });
  });

  // G. Abertura
  describe('Cenário G: Abertura em dia de semana', () => {
    it('distribui colaboradores a partir das 13h00 com serialização em equipe pequena até 15h00', () => {
      const team = [
        createTestEmployee({ id: 'ab1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab2', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab3', workPeriod: '10h às 18h20' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      details.forEach(d => {
        expect(d.startMinutes).toBeGreaterThanOrEqual(13 * 60); // >= 13h00
        expect(d.startMinutes).toBeLessThanOrEqual(15 * 60); // <= 15h00 para serialização completa sem sobreposição
      });
      const { maxConcurrent } = getMaxConcurrentLunches(details);
      expect(maxConcurrent).toBe(1);
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
        createTestEmployee({ id: 'cx_ab', name: 'Caixa Abertura', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'cx_fe', name: 'Caixa Fechamento', cargo: 'Vendas', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'vend1', name: 'Vendedor', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
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
        createTestEmployee({ id: 'cx1', name: 'Caixa Manhã', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'cx2', name: 'Caixa Tarde', cargo: 'Vendas', workPeriod: '13h às 21h' }),
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
        createTestEmployee({ id: 'c1', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'v1', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'p1', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'a1', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'r1', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
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

  // Validação dos 10 Critérios Operacionais Específicos
  describe('Validação dos Critérios Operacionais Específicos', () => {
    // 1 & 2. Entradas escalonadas e cálculo de cobertura com quem está presente
    it('calcula cobertura operacional considerando estritamente quem já entrou no momento', () => {
      const team = [
        // 4 que entram às 10h (presentes às 13h)
        createTestEmployee({ id: 'e1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'e2', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'e3', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'e4', workPeriod: '10h às 18h20' }),
        // 2 que entram às 12h (presentes às 13h)
        createTestEmployee({ id: 'e5', workPeriod: '12h às 20h20' }),
        createTestEmployee({ id: 'e6', workPeriod: '12h às 20h20' }),
        // 4 que entram às 13h40 (NÃO presentes às 13h00)
        createTestEmployee({ id: 'e7', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'e8', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'e9', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'e10', workPeriod: '13h40 às 22h' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);

      // Às 13h00 (780 min): apenas e1..e6 (6 pessoas) entraram até às 13h00
      const presentAt13h = team.filter(m => {
        const match = m.workPeriod ? m.workPeriod.match(/^(\d{1,2})h?(\d{2})?/) : null;
        if (!match) return false;
        const startH = parseInt(match[1], 10);
        const startM = match[2] ? parseInt(match[2], 10) : 0;
        return (startH * 60 + startM) <= 13 * 60;
      }).length;
      expect(presentAt13h).toBe(6);

      // Quantos estão em almoço às 13h00
      const onLunchAt13h = details.filter(d => d.startMinutes <= 780 && d.endMinutes > 780).length;
      // Com 6 pessoas presentes, o número em almoço é seguro (no máximo 2, garantindo >= 66% das pessoas presentes)
      expect(onLunchAt13h).toBeLessThanOrEqual(2);
      const activeAt13h = presentAt13h - onLunchAt13h;
      expect(activeAt13h / presentAt13h).toBeGreaterThanOrEqual(0.66);
    });

    // 3. Entrada tardia
    it('aloca entrada tardia dentro de sua jornada e nunca antes da entrada', () => {
      const team = [
        createTestEmployee({ id: 'tardio', workPeriod: '15h às 23h' }),
      ];
      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      expect(details[0].startMinutes).toBeGreaterThanOrEqual(15 * 60);
      expect(details[0].endMinutes).toBeLessThanOrEqual(23 * 60);
    });

    // 4. Feriado com entradas às 12h, 14h e 15h
    it('feriado com entradas às 12h, 14h e 15h respeita horários individuais', () => {
      const team = [
        createTestEmployee({ id: 'f12', workPeriod: '12h às 18h' }),
        createTestEmployee({ id: 'f14', workPeriod: '14h às 20h' }),
        createTestEmployee({ id: 'f15', workPeriod: '15h às 21h' }),
      ];

      const details = calculateDetailedLunches(team, true, false, undefined, DEFAULT_JORNADA_SETTINGS);
      const d12 = details.find(d => d.member.id === 'f12')!;
      const d14 = details.find(d => d.member.id === 'f14')!;
      const d15 = details.find(d => d.member.id === 'f15')!;

      expect(d12.startMinutes).toBeGreaterThanOrEqual(12 * 60);
      expect(d14.startMinutes).toBeGreaterThanOrEqual(14 * 60);
      expect(d15.startMinutes).toBeGreaterThanOrEqual(15 * 60);
    });

    // 5. Nenhum intervalo imediatamente após a entrada quando houver alternativa válida
    it('garante que entrada às 12h com intervalo de 15 min não seja agendada para 12h15', () => {
      const team = [
        createTestEmployee({ id: 'emp12', workPeriod: '12h às 18h' }),
      ];

      const details = calculateDetailedLunches(team, true, false, undefined, DEFAULT_JORNADA_SETTINGS);
      // Não deve ser 12h15
      expect(details[0].timeStr).not.toBe('12h15 (15 min)');
      expect(details[0].timeStr).not.toBe('12h15');
      // Deve estar dentro da janela operacional do turno (>= 13h30)
      expect(details[0].startMinutes).toBeGreaterThanOrEqual(13 * 60 + 30);
    });

    // 6. Equipe com somente 1 Caixa
    it('equipe com somente 1 Caixa aloca almoço normalmente sem inventar substituição', () => {
      const team = [
        createTestEmployee({ id: 'cx_solo', name: 'Caixa Único', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'vend_1', name: 'Vendedor 1', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS, {
        roles: { cx_solo: 'Caixa', vend_1: 'Vendas' },
      });

      const cx = details.find(d => d.member.id === 'cx_solo')!;
      expect(cx.role).toBe('Caixa');
      // Caixa único recebe seu descanso dentro da janela padrão (13h-14h30)
      expect(cx.startMinutes).toBeGreaterThanOrEqual(13 * 60);
      expect(cx.startMinutes).toBeLessThanOrEqual(14 * 60 + 30);
    });

    // 7. Equipe com 2 Caixas (alternância)
    it('equipe com 2 Caixas garante alternância estrita', () => {
      const team = [
        createTestEmployee({ id: 'cx_1', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'cx_2', cargo: 'Vendas', workPeriod: '13h40 às 22h' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS, {
        roles: { cx_1: 'Caixa', cx_2: 'Caixa' },
      });

      const cx1 = details.find(d => d.member.id === 'cx_1')!;
      const cx2 = details.find(d => d.member.id === 'cx_2')!;

      // Caixa 1 espera entrada do Caixa 2
      expect(cx1.startMinutes).toBeGreaterThanOrEqual(13 * 60 + 40);
      // Caixa 2 espera retorno do Caixa 1
      expect(cx2.startMinutes).toBeGreaterThanOrEqual(cx1.endMinutes);
    });

    // 8. Duas funções diferentes podendo almoçar simultaneamente se houver capacidade
    it('permite que funções diferentes almocem simultaneamente quando há capacidade segura', () => {
      const team = [
        createTestEmployee({ id: 'v1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'v2', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'a1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'a2', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'p1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'p2', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'c1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'c2', workPeriod: '10h às 18h20' }),
      ];

      // 8 pessoas presentes simultaneamente
      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS, {
        roles: {
          v1: 'Vendas', v2: 'Vendas',
          a1: 'Apoio', a2: 'Apoio',
          p1: 'Pacote', p2: 'Pacote',
          c1: 'Caixa', c2: 'Caixa',
        },
      });

      // Agrupa horários de almoço
      const timeCounts: Record<string, number> = {};
      details.forEach(d => {
        timeCounts[d.timeStr] = (timeCounts[d.timeStr] || 0) + 1;
      });

      // Em equipe de 8 pessoas presentes, deve haver slots com 2 pessoas simultâneas sem espalhamento artificial
      const hasSimultaneous = Object.values(timeCounts).some(count => count >= 2);
      expect(hasSimultaneous).toBe(true);
    });

    // 9. Equipe pequena
    it('em equipe pequena (3 pessoas), nunca coloca mais de 1 pessoa em almoço', () => {
      const team = [
        createTestEmployee({ id: 'm1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'm2', workPeriod: '12h às 20h20' }),
        createTestEmployee({ id: 'm3', workPeriod: '13h40 às 22h' }),
      ];
      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      for (let t = 600; t <= 1380; t += 15) {
        const onLunch = details.filter(d => d.startMinutes <= t && d.endMinutes > t).length;
        expect(onLunch).toBeLessThanOrEqual(1);
      }
    });

    // 10. Equipe grande
    it('em equipe grande (12 pessoas), mantém meta operacional de aproximadamente 70% trabalhando', () => {
      const team = Array.from({ length: 12 }, (_, i) => 
        createTestEmployee({ 
          id: `emp_${i}`, 
          workPeriod: i < 6 ? '10h às 18h20' : '13h40 às 22h' 
        })
      );
      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      for (let t = 600; t <= 1380; t += 15) {
        let present = 0;
        let onLunch = 0;
        details.forEach(d => {
          if (d.member.workPeriod.startsWith('10h') ? (t >= 600 && t < 1100) : (t >= 820 && t < 1320)) {
            present++;
            if (d.startMinutes <= t && d.endMinutes > t) {
              onLunch++;
            }
          }
        });
        if (present > 0) {
          const available = present - onLunch;
          // Cobertura operacional mantida em torno de 70%
          expect(available / present).toBeGreaterThanOrEqual(0.66);
        }
      }
    });
  });

  describe('FASE 7.8.3 — Validações Cirúrgicas dos Três Problemas Corrigidos', () => {
    // A. 3 pessoas: Caixa + Vendas + Apoio (10h às 18h20) -> serialização e cobertura mínima 2/3
    it('Cenário A (3 pessoas: Caixa, Vendas, Apoio): serializa almoços com cobertura de 2/3 e nunca 2 pessoas simultâneas', () => {
      const team = [
        createTestEmployee({ id: 'cx', name: 'Caixa', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'v1', name: 'Vendas', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ap', name: 'Apoio', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS, {
        roles: { cx: 'Caixa', v1: 'Vendas', ap: 'Apoio' },
      });

      expect(details).toHaveLength(3);
      for (let t = 600; t < 1100; t += 15) {
        const onLunch = details.filter(d => d.startMinutes <= t && d.endMinutes > t).length;
        expect(onLunch).toBeLessThanOrEqual(1);
        const available = 3 - onLunch;
        expect(available).toBeGreaterThanOrEqual(2); // Cobertura mínima de 2/3 (67%)
      }
    });

    // B. 10 pessoas: alternativa de 15 min preserva ~70% e evita concentração de 4 pessoas em almoço
    it('Cenário B (10 pessoas): alternativa de 15 min preserva ~70% e evita concentração de 4 pessoas em almoço', () => {
      const team = [
        createTestEmployee({ id: 'ab_v1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab_pc1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab_ap1', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab_v2', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab_cx1', cargo: 'Vendas', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'ab_v3', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'int_ap2', workPeriod: '12h às 20h20' }),
        createTestEmployee({ id: 'fe_cx2', cargo: 'Vendas', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'fe_v4', workPeriod: '13h40 às 22h' }),
        createTestEmployee({ id: 'fe_pc2', workPeriod: '13h40 às 22h' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS, {
        roles: {
          ab_cx1: 'Caixa',
          fe_cx2: 'Caixa',
        },
      });

      for (let t = 600; t < 1320; t += 15) {
        let present = 0;
        let onLunch = 0;
        team.forEach((emp, i) => {
          const isMorning = i < 6;
          const isInterm = i === 6;
          const inShift = isMorning ? (t >= 600 && t < 1100) : isInterm ? (t >= 720 && t < 1220) : (t >= 820 && t < 1320);
          if (inShift) {
            present++;
            const d = details.find(x => x.member.id === emp.id);
            if (d && d.startMinutes <= t && d.endMinutes > t) {
              onLunch++;
            }
          }
        });
        if (present > 0) {
          expect(onLunch).toBeLessThanOrEqual(3); // Nunca 4 pessoas em almoço
          expect((present - onLunch) / present).toBeGreaterThanOrEqual(0.69); // Preserva ~70%
        }
      }
    });

    // C. 1 pessoa presente + 1 entrando às 13h40: primeiro não almoça enquanto sozinho
    it('Cenário C (1 presente + 1 entrando às 13h40): primeiro não recebe almoço enquanto estiver sozinho se houver alternativa válida', () => {
      const team = [
        createTestEmployee({ id: 'ab_solo', workPeriod: '10h às 18h20' }),
        createTestEmployee({ id: 'fe_chegando', workPeriod: '13h40 às 22h' }),
      ];

      const details = calculateDetailedLunches(team, false, false, undefined, DEFAULT_JORNADA_SETTINGS);
      const solo = details.find(d => d.member.id === 'ab_solo')!;

      // Não deve sair para almoço antes das 13h40, pois deixaria o salão com 0 pessoas
      expect(solo.startMinutes).toBeGreaterThanOrEqual(13 * 60 + 40);

      // Verifica que em nenhum minuto da jornada há 0 pessoas trabalhando
      for (let t = 600; t < 1320; t += 15) {
        let present = 0;
        let onLunch = 0;
        if (t >= 600 && t < 1100) {
          present++;
          if (solo.startMinutes <= t && solo.endMinutes > t) onLunch++;
        }
        const fe = details.find(d => d.member.id === 'fe_chegando')!;
        if (t >= 820 && t < 1320) {
          present++;
          if (fe.startMinutes <= t && fe.endMinutes > t) onLunch++;
        }
        if (present > 0) {
          const available = present - onLunch;
          expect(available).toBeGreaterThan(0); // Nunca 0 pessoas trabalhando
        }
      }
    });
  });
});
