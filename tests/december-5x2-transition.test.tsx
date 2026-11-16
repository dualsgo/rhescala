// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { FIVE_BY_TWO_EFFECTIVE_DATE, getEffectiveJornadaOnDate } from '../src/engine/config/schedule-constants';
import { applyMonthUpdate } from '../src/engine/orchestration/month-generator';
import { optimizeDecemberPeak } from '../src/engine/peaks/seasonal-peaks';
import { ShiftGrid } from '../components/ShiftGrid';
import { DialogProvider } from '../contexts/DialogContext';
import { Employee } from '../types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Transição Híbrida 6x1 -> 5x2 em 16/12/2026', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const makeTeam = (): Employee[] =>
    Array.from({ length: 8 }, (_, idx) => ({
      id: `emp-${idx + 1}`,
      name: `Colaborador ${idx + 1}`,
      isYoungApprentice: false,
      cargo: idx < 2 ? 'Caixa' : 'Vendas',
      primaryRole: idx < 2 ? 'Caixa' : 'Vendas',
      jornada: '6x1',
      status: 'active',
      statusColor: '#ff8400',
      shifts: {
        // Carryover realista de Novembro (trabalhou 29 e 30/11)
        '2026-11': [...Array(28).fill('T'), 'T', 'T'],
      },
      dailyHours: {},
      workPeriod: idx % 2 === 0 ? '10h às 18h20' : '13h40 às 22h',
      preferredDayOff: ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira'][idx % 4],
      shiftName: idx % 2 === 0 ? 'Abertura' : 'Fechamento',
    }));

  it('1. getEffectiveJornadaOnDate retorna 6x1 até 15/12/2026 e 5x2 a partir de 16/12/2026', () => {
    const emp = makeTeam()[0];
    expect(FIVE_BY_TWO_EFFECTIVE_DATE).toBe('2026-12-16');
    expect(getEffectiveJornadaOnDate(emp, '2026-12-15')).toBe('6x1');
    expect(getEffectiveJornadaOnDate(emp, '2026-12-16')).toBe('5x2');
    expect(getEffectiveJornadaOnDate(emp, '2026-12-24')).toBe('5x2');
  });

  it('2. applyMonthUpdate em 2026-12 gera escala híbrida sem violações de 7º dia e com 2 folgas semanais a partir da semana de 16/12', () => {
    const team = makeTeam();
    const res = applyMonthUpdate(team, 2026, 11); // Dezembro = month 11

    const isRest = (s: string) => ['F', 'LF', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s.startsWith('FF');

    for (const emp of team) {
      const shifts = res[emp.id].shifts;
      expect(shifts).toHaveLength(31);

      // Nunca pode atingir 7 dias seguidos (inclusive com carryover de Novembro)
      let streak = 2; // 29 e 30/11
      for (let d = 0; d < 31; d++) {
        if (isRest(shifts[d])) streak = 0;
        else streak++;
        expect(streak).toBeLessThanOrEqual(6);
      }

      // Semana de transição (Seg 14/12 a Dom 20/12 -> índices 13..19): >= 2 folgas
      const weekTransitionRests = shifts.slice(13, 20).filter(isRest).length;
      expect(weekTransitionRests).toBeGreaterThanOrEqual(2);

      // Semana do Natal (Seg 21/12 a Dom 27/12 -> índices 20..26): >= 2 folgas
      const weekXmasRests = shifts.slice(20, 27).filter(isRest).length;
      expect(weekXmasRests).toBeGreaterThanOrEqual(2);
    }
  });

  it('3. optimizeDecemberPeak preserva força máxima no Natal (21..24/12), respeita 5x2 e mantém streak <= 6 em todo o mês', () => {
    const team = makeTeam();
    const base = applyMonthUpdate(team, 2026, 11);
    const withBase = team.map(e => ({
      ...e,
      shifts: { ...e.shifts, '2026-12': base[e.id].shifts },
    }));

    const optimized = optimizeDecemberPeak(withBase, '2026-12');
    const isRest = (s: string) => ['F', 'LF', 'FE', 'AT', 'DO', 'N/A'].includes(s) || s.startsWith('FF');

    for (const emp of team) {
      const shifts = optimized[emp.id].shifts;
      let streak = 2;
      for (let d = 0; d < 31; d++) {
        if (isRest(shifts[d])) streak = 0;
        else streak++;
        expect(streak).toBeLessThanOrEqual(6);
      }

      // Dias críticos 21, 22, 23, 24 (índices 20, 21, 22, 23): 100% presentes
      expect(shifts[20]).toBe('T');
      expect(shifts[21]).toBe('T');
      expect(shifts[22]).toBe('T');
      expect(shifts[23]).toBe('T');

      // Semana do Natal (21..27/12): 25/12 + 26/12 ou 27/12 = 2 folgas 5x2
      const weekXmasRests = shifts.slice(20, 27).filter(isRest).length;
      expect(weekXmasRests).toBeGreaterThanOrEqual(2);
    }
  });

  it('4. ShiftGrid exibe badges /6 até 15/12, muda para /5 em 16/12 com contagem contínua e mostra 6/5 como atenção (não erro 7º)', async () => {
    const emp = makeTeam()[0];
    // Trabalha continuamente de 11/12 até 16/12 (indices 10..15): dia 15 = 5/6, dia 16 = 6/5!
    const decShifts = Array(31).fill('F');
    for (let i = 10; i <= 15; i++) decShifts[i] = 'T';
    emp.shifts['2026-12'] = decShifts;

    await act(async () => {
      root.render(
        <DialogProvider>
          <ShiftGrid
            employees={[emp]}
            currentMY={{ month: 11, year: 2026 }}
            today={new Date(2026, 11, 16)}
            selectedDayIdx={15}
            filter="all"
            isEditable={true}
            onFilterChange={vi.fn()}
            resolvedPositions={{}}
            customHolidays={[]}
            onUpdateShift={vi.fn()}
            onUpdateShifts={vi.fn()}
            onUpdateEmployeeDailyHour={vi.fn()}
            onUpdateTacticalPosition={vi.fn()}
            onOpenEmployeeCard={vi.fn()}
          />
        </DialogProvider>
      );
    });

    // Alterna para visão Tradicional para visualizar os dias 15/12 e 16/12 lado a lado
    const traditionalBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Tradicional')
    );
    expect(traditionalBtn).toBeDefined();
    await act(async () => {
      traditionalBtn?.click();
    });

    const text = container.textContent || '';
    // Até 15/12: denominador /6 (5/6 no dia 15/12)
    expect(text).toContain('5/6');
    // Em 16/12 (6º dia contínuo entrando no 5x2): badge 6/5 (sem virar 7º)
    expect(text).toContain('6/5');
    expect(text).not.toContain('7º');
  });
});
