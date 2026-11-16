// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ShiftGrid } from '../components/ShiftGrid';
import { DialogProvider } from '../contexts/DialogContext';
import { Employee } from '../types';
import { createTestEmployee } from './fixtures';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Visibilidade por Data de Início do Contrato (hiredAt)', () => {
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

  it('oculta colaborador com hiredAt 2026-11-24 quando o dia selecionado é 10/11 e exibe ao selecionar 24/11', async () => {
    const employees: Employee[] = [
      createTestEmployee({
        id: 'emp-regular',
        name: 'Ana Regular',
        shifts: { '2026-11': Array(30).fill('T') },
      }),
      createTestEmployee({
        id: 'emp-future',
        name: 'Carlos Novo',
        hiredAt: '2026-11-24',
        shifts: {
          '2026-11': Array.from({ length: 30 }, (_, idx) => (idx >= 23 ? 'T' : 'N/A')),
        },
      }),
    ];

    const renderGrid = async (selectedDayIdx: number) => {
      await act(async () => {
        root.render(
          <DialogProvider>
            <ShiftGrid
              employees={employees}
              currentMY={{ year: 2026, month: 10 }}
              customHolidays={[]}
              filter="all"
              onFilterChange={vi.fn()}
              resolvedPositions={{}}
              diffs={[]}
              isEditable={true}
              allowRetroactive={true}
              isReadOnly={false}
              onUpdateShift={vi.fn()}
              onUpdateEmployeeDailyHour={vi.fn()}
              onUpdateTacticalPosition={vi.fn()}
              onOpenEmployeeCard={vi.fn()}
              selectedDayIdx={selectedDayIdx}
              onSelectDay={vi.fn()}
              onOpenDayDetail={vi.fn()}
            />
          </DialogProvider>
        );
      });
    };

    // Dia 10/11 (selectedDayIdx = 9): Carlos Novo (inicia 24/11) NÃO aparece na lista
    await renderGrid(9);
    const tbodyDay10 = container.querySelector('tbody');
    expect(tbodyDay10?.textContent).toContain('ANA');
    expect(tbodyDay10?.textContent).not.toContain('CARLOS');

    // Dia 24/11 (selectedDayIdx = 23): Carlos Novo PASSA a aparecer na lista
    await renderGrid(23);
    const tbodyDay24 = container.querySelector('tbody');
    expect(tbodyDay24?.textContent).toContain('ANA');
    expect(tbodyDay24?.textContent).toContain('CARLOS');
  });
});
