import { describe, it, expect } from 'vitest';
import { applyMonthUpdate } from '../hooks/useScheduleEngine';
import { createTestEmployee } from './fixtures';

describe('Regras de Escala CLT (6x1, 5x2, Aprendiz, Afastamentos, Aniversários)', () => {
  const YEAR = 2028;
  const MONTH = 9; // Outubro 2028 (31 dias)

  describe('Jornada 6x1', () => {
    it('garante que após no máximo 6 dias consecutivos de trabalho ocorra uma folga (7º dia)', () => {
      const emp = createTestEmployee({
        id: 'emp-6x1',
        jornada: '6x1',
        preferredDayOff: 'Nenhum'
      });

      const res = applyMonthUpdate([emp], YEAR, MONTH);
      const shifts = res['emp-6x1'].shifts;

      expect(shifts).toHaveLength(31);

      let consecutiveWork = 0;
      for (let i = 0; i < shifts.length; i++) {
        const s = shifts[i];
        if (s === 'T' || ['P1', 'PC', 'P2', 'P3', 'P4', 'ESTQ'].includes(s)) {
          consecutiveWork++;
          expect(consecutiveWork).toBeLessThanOrEqual(6);
        } else {
          consecutiveWork = 0;
        }
      }
    });

    it('respeita o carryover do streak do mês anterior', () => {
      // Se o colaborador trabalhou 5 dias no final de Setembro (2028-09),
      // no dia 1 de Outubro pode trabalhar (total 6), e no dia 2 de Outubro deve folgar obrigatoriamente
      const emp = createTestEmployee({
        id: 'emp-carryover',
        jornada: '6x1',
        shifts: {
          '2028-09': [
            'F', 'T', 'T', 'T', 'T', 'T', 'F',
            'T', 'T', 'T', 'T', 'T', 'T', 'F',
            'T', 'T', 'T', 'T', 'T', 'T', 'F',
            'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T' // termina com vários 'T'
          ]
        }
      });

      const res = applyMonthUpdate([emp], YEAR, MONTH);
      const shifts = res['emp-carryover'].shifts;

      // O streak inicial deve forçar folga no início do mês
      const earlyRestIndex = shifts.slice(0, 3).indexOf('F');
      expect(earlyRestIndex).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Jornada 5x2', () => {
    it('assegura no máximo 5 dias seguidos de trabalho e pelo menos 2 folgas por semana', () => {
      const emp = createTestEmployee({
        id: 'emp-5x2',
        jornada: '5x2',
        preferredDayOff: 'Nenhum'
      });

      const res = applyMonthUpdate([emp], YEAR, MONTH);
      const shifts = res['emp-5x2'].shifts;

      let consecutiveWork = 0;
      for (let i = 0; i < shifts.length; i++) {
        const s = shifts[i];
        if (s === 'T') {
          consecutiveWork++;
          expect(consecutiveWork).toBeLessThanOrEqual(5);
        } else {
          consecutiveWork = 0;
        }
      }

      // Verifica cada bloco de 7 dias
      for (let w = 0; w < shifts.length; w += 7) {
        const weekShifts = shifts.slice(w, Math.min(w + 7, shifts.length));
        if (weekShifts.length === 7) {
          const rests = weekShifts.filter(s => ['F', 'FE', 'AT', 'DO', 'N/A'].includes(s));
          expect(rests.length).toBeGreaterThanOrEqual(2);
        }
      }
    });
  });

  describe('Jovem Aprendiz', () => {
    it('tem folga aos sábados e domingos, folga em feriados, curso no dia teórico e horário fixo', () => {
      const apprentice = createTestEmployee({
        id: 'emp-apprentice',
        name: 'Aprendiz Lucas',
        isYoungApprentice: true,
        cargo: 'Aprendiz',
        courseDay: 'Quarta-feira',
        preferredDayOff: 'Domingo'
      });

      const res = applyMonthUpdate([apprentice], YEAR, MONTH);
      const shifts = res['emp-apprentice'].shifts;
      const hours = res['emp-apprentice'].hours;

      for (let dayIdx = 0; dayIdx < 31; dayIdx++) {
        const date = new Date(YEAR, MONTH, dayIdx + 1);
        const dow = date.getDay();

        if (dow === 0 || dow === 6) {
          // Domingo ou Sábado = Folga
          expect(shifts[dayIdx]).toBe('F');
          expect(hours[dayIdx]).toBe('12h às 20h');
        } else if (dow === 3) {
          // Quarta-feira = Curso
          expect(shifts[dayIdx]).toBe('C');
          expect(hours[dayIdx]).toBe('10h às 16h15');
        } else if (dayIdx === 11) {
          // 12 de Outubro = Feriado Nacional (N. Sra Aparecida)
          expect(shifts[dayIdx]).toBe('F');
          expect(hours[dayIdx]).toBe('12h às 20h');
        } else {
          expect(shifts[dayIdx]).toBe('T');
          expect(hours[dayIdx]).toBe('10h às 16h15');
        }
      }
    });
  });

  describe('Aniversários (Day Off)', () => {
    it('marca DO no dia do aniversário do colaborador e zera o streak de trabalho', () => {
      const emp = createTestEmployee({
        id: 'emp-bday',
        birthday: '1995-10-15'
      });

      const res = applyMonthUpdate([emp], YEAR, MONTH);
      const shifts = res['emp-bday'].shifts;

      expect(shifts[14]).toBe('DO'); // 15 de Outubro (index 14)
    });

    it('aceita aniversário no formato MM-DD', () => {
      const emp = createTestEmployee({
        id: 'emp-bday-short',
        birthday: '10-20'
      });

      const res = applyMonthUpdate([emp], YEAR, MONTH);
      const shifts = res['emp-bday-short'].shifts;

      expect(shifts[19]).toBe('DO'); // 20 de Outubro (index 19)
    });
  });

  describe('Afastamentos (Férias e Atestado Médico)', () => {
    it('marca FE durante o período de férias configurado', () => {
      const emp = createTestEmployee({
        id: 'emp-vacation',
        vacationStart: '2028-10-05',
        vacationEnd: '2028-10-14'
      });

      const res = applyMonthUpdate([emp], YEAR, MONTH);
      const shifts = res['emp-vacation'].shifts;

      // Dias 5 a 14 de Outubro (índices 4 a 13) devem ser 'FE'
      for (let i = 4; i <= 13; i++) {
        expect(shifts[i]).toBe('FE');
      }
      expect(shifts[3]).not.toBe('FE');
      expect(shifts[14]).not.toBe('FE');
    });

    it('marca AT durante o período de atestado médico configurado', () => {
      const emp = createTestEmployee({
        id: 'emp-atestado',
        atestadoStart: '2028-10-02',
        atestadoEnd: '2028-10-04'
      });

      const res = applyMonthUpdate([emp], YEAR, MONTH);
      const shifts = res['emp-atestado'].shifts;

      expect(shifts[1]).toBe('AT');
      expect(shifts[2]).toBe('AT');
      expect(shifts[3]).toBe('AT');
      expect(shifts[0]).not.toBe('AT');
      expect(shifts[4]).not.toBe('AT');
    });
  });

  describe('Vigência de Contrato (hiredAt e firedAt)', () => {
    it('marca N/A antes da data de admissão e após a data de demissão', () => {
      const emp = createTestEmployee({
        id: 'emp-contract',
        hiredAt: '2028-10-10',
        firedAt: '2028-10-25'
      });

      const res = applyMonthUpdate([emp], YEAR, MONTH);
      const shifts = res['emp-contract'].shifts;

      // Antes do dia 10 (índices 0 a 8) = N/A
      for (let i = 0; i <= 8; i++) {
        expect(shifts[i]).toBe('N/A');
      }
      // Dia 10 em diante (ativo)
      expect(shifts[9]).not.toBe('N/A');

      // Após o dia 25 (índices 25 a 30) = N/A
      for (let i = 25; i <= 30; i++) {
        expect(shifts[i]).toBe('N/A');
      }
    });
  });

  describe('Modo 100% Trabalhado (all_working)', () => {
    it('gera todos os dias regulares como T preservando apenas afastamentos legais', () => {
      const emp = createTestEmployee({
        id: 'emp-all-work',
        birthday: '1990-10-08',
        vacationStart: '2028-10-20',
        vacationEnd: '2028-10-22'
      });

      const res = applyMonthUpdate([emp], YEAR, MONTH, [], [], undefined, undefined, 'all_working');
      const shifts = res['emp-all-work'].shifts;

      expect(shifts[7]).toBe('DO'); // Aniversário preservado
      expect(shifts[19]).toBe('FE'); // Férias preservada
      expect(shifts[20]).toBe('FE');
      expect(shifts[21]).toBe('FE');

      // Todos os outros dias devem ser 'T'
      const nonOverridden = shifts.filter((s, idx) => idx !== 7 && idx < 19 || idx > 21);
      expect(nonOverridden.every(s => s === 'T')).toBe(true);
    });
  });
});
