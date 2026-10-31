// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { HolidayCreditsTable } from '../components/HolidayCreditsTable';
import { Employee, MonthYear, Holiday } from '../types';
import { HolidayCredit } from '../hooks/useHolidayCredits';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Mock do html-to-image
vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,mockedPngData'),
}));

describe('HolidayCreditsTable — Matriz de Folgas e Créditos de Feriados', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  const currentMY: MonthYear = { month: 9, year: 2026 }; // Outubro 2026

  const mockEmployees: Employee[] = [
    {
      id: 'emp-1',
      name: 'Carlos Silva',
      cargo: 'Vendedor',
      shifts: {
        '2026-10': ['T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T'],
      },
    },
    {
      id: 'emp-2',
      name: 'Mariana Souza',
      cargo: 'Operadora de Caixa',
      shifts: {
        '2026-10': ['F', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'F', 'T', 'T', 'T'],
      },
    },
    {
      id: 'emp-3',
      name: 'João Lucas',
      cargo: 'Jovem Aprendiz',
      isYoungApprentice: true,
      shifts: {},
    },
  ];

  const mockCustomHolidays: Holiday[] = [
    {
      id: 'h-12-10',
      date: '2026-10-12',
      name: 'Nossa Senhora Aparecida',
      type: 'national',
    },
    {
      id: 'h-02-11',
      date: '2026-11-02',
      name: 'Finados',
      type: 'national',
    },
  ];

  const mockHolidayCredits: Record<string, HolidayCredit[]> = {
    'emp-1': [
      {
        id: '2026-10-12',
        holidayDate: '2026-10-12',
        holidayName: 'Nossa Senhora Aparecida',
        status: 'pending',
      },
      {
        id: '2026-11-02',
        holidayDate: '2026-11-02',
        holidayName: 'Finados',
        status: 'scheduled',
        offDate: '2026-11-15',
      },
    ],
    'emp-2': [
      {
        id: '2026-10-12',
        holidayDate: '2026-10-12',
        holidayName: 'Nossa Senhora Aparecida',
        status: 'granted',
        offDate: '2026-10-20',
      },
    ],
  };

  const mockValidatedMonths = {
    '2026-10': true,
    '2026-11': true,
  };

  it('deve renderizar a tabela com os nomes dos colaboradores e excluir Jovens Aprendizes', async () => {
    await act(async () => {
      root.render(
        <HolidayCreditsTable
          employees={mockEmployees}
          currentMY={currentMY}
          customHolidays={mockCustomHolidays}
          holidayCredits={mockHolidayCredits}
          validatedMonths={mockValidatedMonths}
        />
      );
    });

    expect(container.textContent).toContain('CARLOS');
    expect(container.textContent).toContain('MARIANA');
    expect(container.textContent).not.toContain('JOÃO');
    expect(container.textContent).not.toContain('João Lucas');
  });

  it('deve renderizar células vermelhas para pendentes, amarelas para agendadas e verdes para concluídas', async () => {
    await act(async () => {
      root.render(
        <HolidayCreditsTable
          employees={mockEmployees}
          currentMY={currentMY}
          customHolidays={mockCustomHolidays}
          holidayCredits={mockHolidayCredits}
          validatedMonths={mockValidatedMonths}
        />
      );
    });

    expect(container.textContent).toContain('PENDENTE');
    expect(container.textContent).toContain('AGENDADA');
    expect(container.textContent).toContain('CONCLUÍDA');

    // Verifica que as classes de cores corretas estão presentes no DOM
    const pendingCell = container.querySelector('.bg-rose-100');
    expect(pendingCell).not.toBeNull();

    const scheduledCell = container.querySelector('.bg-amber-100');
    expect(scheduledCell).not.toBeNull();

    const grantedCell = container.querySelector('.bg-emerald-100');
    expect(grantedCell).not.toBeNull();
  });

  it('deve conter botão para baixar a imagem PNG da tabela', async () => {
    await act(async () => {
      root.render(
        <HolidayCreditsTable
          employees={mockEmployees}
          currentMY={currentMY}
          customHolidays={mockCustomHolidays}
          holidayCredits={mockHolidayCredits}
          validatedMonths={mockValidatedMonths}
        />
      );
    });

    const downloadBtn = Array.from(container.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('Baixar Imagem (PNG)')
    );
    expect(downloadBtn).toBeDefined();
    expect(downloadBtn?.disabled).toBe(false);
  });

  it('permite alternar entre Oficializados e Todos do Ano', async () => {
    await act(async () => {
      root.render(
        <HolidayCreditsTable
          employees={mockEmployees}
          currentMY={currentMY}
          customHolidays={mockCustomHolidays}
          holidayCredits={mockHolidayCredits}
          validatedMonths={mockValidatedMonths}
        />
      );
    });

    const allYearBtn = Array.from(container.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('Todos do Ano')
    );
    expect(allYearBtn).toBeDefined();

    await act(async () => {
      allYearBtn?.click();
    });

    expect(allYearBtn?.className).toContain('bg-indigo-600');
  });
});
