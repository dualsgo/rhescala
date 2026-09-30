// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ShiftGrid } from '../components/ShiftGrid';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';
import { createTestEmployee } from './fixtures';
import { ScheduleDiffItem } from '../types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ShiftGrid Visual & Accessibility — Fase 7.6', () => {
  let container: HTMLDivElement;
  let root: Root;

  const currentMY = { month: 8, year: 2026 }; // Setembro 2026
  const monthKey = '2026-09';

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('preserva os indicadores secundários e alertas (6x1, domingo, diff, pedido) com atributos acessíveis', async () => {
    const diffs: ScheduleDiffItem[] = [
      {
        id: 'diff-1',
        empId: 'emp-1',
        empName: 'Carlos Oliveira',
        dayIdx: 0,
        dateStr: '01/09/2026',
        type: 'shift',
        officialVal: 'T',
        currentVal: 'F',
      },
    ];

    const empWithIndicators = createTestEmployee({
      id: 'emp-1',
      name: 'Carlos Oliveira',
      shifts: { [monthKey]: ['F', 'T', 'T', 'T', 'T', 'T', 'T'] },
      dailyHours: { [monthKey]: ['Folga', '10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20'] },
      requests: [
        {
          date: '2026-09-01',
          text: 'Folga para consulta médica',
          status: 'pending',
          createdAt: '2026-08-30',
        },
      ],
    });

    await act(async () => {
      root.render(
        <ShiftGrid
          employees={[empWithIndicators]}
          currentMY={currentMY}
          selectedDayIdx={0}
          customHolidays={[]}
          filter="all"
          isEditable={true}
          isReadOnly={false}
          diffs={diffs}
          resolvedPositions={{}}
          onUpdateEmployeeDailyHour={vi.fn()}
          onUpdateTacticalPosition={vi.fn()}
          onFilterChange={vi.fn()}
          onOpenEmployeeCard={vi.fn()}
          jornadaSettings={DEFAULT_JORNADA_SETTINGS}
        />
      );
    });

    // 1. Diff marker should exist with role="status" and title
    const diffMarker = container.querySelector('span[role="status"][title*="Alteração pós-oficialização"]');
    expect(diffMarker).not.toBeNull();
    expect(diffMarker?.getAttribute('aria-label')).toContain('Alteração pós-oficialização');

    // 2. Request marker should exist with role="status" and aria-label
    const requestMarker = container.querySelector('div[role="status"][aria-label*="Pedido do colaborador"]');
    expect(requestMarker).not.toBeNull();
    expect(requestMarker?.getAttribute('aria-label')).toContain('Folga para consulta médica');
  });

  it('célula sem indicadores secundários ou alertas não renderiza nós vazios', async () => {
    const cleanEmp = createTestEmployee({
      id: 'emp-2',
      name: 'Beatriz Santos',
      shifts: { [monthKey]: ['T', 'T', 'T', 'T', 'T', 'T', 'T'] },
      dailyHours: { [monthKey]: ['13h40 às 22h00', '13h40 às 22h00', '13h40 às 22h00', '13h40 às 22h00', '13h40 às 22h00', '13h40 às 22h00', '13h40 às 22h00'] },
      requests: [],
    });

    await act(async () => {
      root.render(
        <ShiftGrid
          employees={[cleanEmp]}
          currentMY={currentMY}
          selectedDayIdx={0}
          customHolidays={[]}
          filter="all"
          isEditable={true}
          isReadOnly={false}
          diffs={[]}
          resolvedPositions={{}}
          onUpdateEmployeeDailyHour={vi.fn()}
          onUpdateTacticalPosition={vi.fn()}
          onFilterChange={vi.fn()}
          onOpenEmployeeCard={vi.fn()}
          jornadaSettings={DEFAULT_JORNADA_SETTINGS}
        />
      );
    });

    // In a clean cell on day 1 (Tuesday, not Sunday, no diff, no request, not streak violation):
    // There shouldn't be diff or request markers
    const diffMarker = container.querySelector('span[title*="Alteração pós-oficialização"]');
    expect(diffMarker).toBeNull();

    const requestMarker = container.querySelector('div[role="status"][aria-label*="Pedido do colaborador"]');
    expect(requestMarker).toBeNull();
  });

  it('o botão principal de turno possui aria-label descritivo e preserva a identidade visual do turno', async () => {
    const emp = createTestEmployee({
      id: 'emp-3',
      name: 'Carlos Oliveira',
      shifts: { [monthKey]: ['F', 'T', 'T', 'T', 'T', 'T', 'T'] },
      dailyHours: { [monthKey]: ['Folga', '10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20'] },
    });

    await act(async () => {
      root.render(
        <ShiftGrid
          employees={[emp]}
          currentMY={currentMY}
          selectedDayIdx={0}
          customHolidays={[]}
          filter="all"
          isEditable={true}
          isReadOnly={false}
          diffs={[]}
          resolvedPositions={{}}
          onUpdateEmployeeDailyHour={vi.fn()}
          onUpdateTacticalPosition={vi.fn()}
          onFilterChange={vi.fn()}
          onOpenEmployeeCard={vi.fn()}
          jornadaSettings={DEFAULT_JORNADA_SETTINGS}
        />
      );
    });

    // Day 1 button has shift 'F'
    const shiftButton = container.querySelector('button[aria-label*="Turno: F"]');
    expect(shiftButton).not.toBeNull();
    expect(shiftButton?.textContent).toBe('F');
  });

  it('modo foco destaca a coluna selecionada e não aplica classes blur', async () => {
    const emp = createTestEmployee({
      id: 'emp-4',
      name: 'Carlos Oliveira',
      shifts: { [monthKey]: ['T', 'T', 'T', 'T', 'T', 'T', 'T'] },
      dailyHours: { [monthKey]: ['10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20'] },
    });

    await act(async () => {
      root.render(
        <ShiftGrid
          employees={[emp]}
          currentMY={currentMY}
          selectedDayIdx={0} // Dia 1 selecionado
          customHolidays={[]}
          filter="all"
          isEditable={true}
          isReadOnly={false}
          diffs={[]}
          resolvedPositions={{}}
          onUpdateEmployeeDailyHour={vi.fn()}
          onUpdateTacticalPosition={vi.fn()}
          onFilterChange={vi.fn()}
          onOpenEmployeeCard={vi.fn()}
          jornadaSettings={DEFAULT_JORNADA_SETTINGS}
        />
      );
    });

    // Locate the Focus toggle button
    const focusBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Foco'));
    expect(focusBtn).not.toBeNull();

    // Toggle focus on
    await act(async () => {
      focusBtn?.click();
    });

    // Button should now indicate active focus for day 1
    expect(focusBtn?.textContent).toContain('Dia 1');

    // Confirm NO blur filter classes are present on table cells (th or td)
    const blurredCells = container.querySelectorAll('th[class*="blur"], td[class*="blur"]');
    expect(blurredCells.length).toBe(0);

    // Selected column cell has orange highlight ring
    const selectedHeader = container.querySelector('th.ring-orange-500');
    expect(selectedHeader).not.toBeNull();

    // Non-selected columns have opacity-40 rather than blur
    const dimmedCells = container.querySelectorAll('.opacity-40');
    expect(dimmedCells.length).toBeGreaterThan(0);
  });
});
