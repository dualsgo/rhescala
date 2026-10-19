// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MobileEmployerViewer } from '../components/MobileEmployerViewer';
import { DialogProvider } from '../contexts/DialogContext';
import { Employee, JornadaSettings } from '../types';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('MobileEmployerViewer — Fase 7.4', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockEmployees: Employee[] = [
    {
      id: 'emp-1',
      name: 'Carlos Oliveira',
      cargo: 'Vendas',
      isYoungApprentice: false,
      contractType: 'CLT',
      jornada: '6x1',
      workPeriod: '10h às 18h20',
      shifts: { '2026-05': ['T', 'T', 'F', 'T', 'T', 'T', 'T'] },
      dailyHours: { '2026-05': ['10h às 18h20', '10h às 18h20', 'Folga', '10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20'] },
      tacticalPositions: { '2026-05': ['P1', 'P1', '', 'P2', 'P1', 'P1', 'P1'] },
      preferredDayOff: 'Quarta-feira',
      shiftName: 'Abertura',
      status: 'active',
      statusColor: '#000',
    },
    {
      id: 'emp-2',
      name: 'Beatriz Santos',
      cargo: 'Vendas',
      isYoungApprentice: false,
      contractType: 'CLT',
      jornada: '6x1',
      workPeriod: '13h40 às 22h00',
      shifts: { '2026-05': ['T', 'F', 'T', 'T', 'T', 'T', 'T'] },
      dailyHours: { '2026-05': ['13h40 às 22h00', 'Folga', '13h40 às 22h00', '13h40 às 22h00', '13h40 às 22h00', '13h40 às 22h00', '13h40 às 22h00'] },
      tacticalPositions: { '2026-05': ['PC', '', 'PC', 'PC', 'PC', 'PC', 'PC'] },
      preferredDayOff: 'Terça-feira',
      shiftName: 'Fechamento',
      status: 'active',
      statusColor: '#000',
    },
  ];

  const defaultJornadaSettings: JornadaSettings = DEFAULT_JORNADA_SETTINGS;

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
    vi.restoreAllMocks();
  });

  function renderViewer(props: Partial<React.ComponentProps<typeof MobileEmployerViewer>> = {}) {
    const defaultProps: React.ComponentProps<typeof MobileEmployerViewer> = {
      employees: mockEmployees,
      currentMY: { month: 4, year: 2026 }, // Maio 2026
      customHolidays: [],
      deletedNationalHolidays: [],
      jornadaSettings: defaultJornadaSettings,
      holidayCredits: [],
      selectedEmployeeId: 'emp-1',
      onSelectEmployee: vi.fn(),
      onOpenEmployeeCard: vi.fn(),
      onSwitchToFullGrid: vi.fn(),
      onMonthChange: vi.fn(),
      ...props,
    };

    act(() => {
      root.render(
        <DialogProvider>
          <MobileEmployerViewer {...defaultProps} />
        </DialogProvider>
      );
    });

    return defaultProps;
  }

  it('1. deve navegar para o mês anterior no mesmo ano ao clicar no botão chevron_left', () => {
    const onMonthChange = vi.fn();
    renderViewer({
      currentMY: { month: 4, year: 2026 },
      onMonthChange,
    });

    const prevButton = container.querySelector('button[title="Mês anterior"]') as HTMLButtonElement;
    expect(prevButton).toBeTruthy();

    act(() => {
      prevButton.click();
    });

    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenCalledWith({ month: 3, year: 2026 });
  });

  it('2. deve navegar para o mês seguinte no mesmo ano ao clicar no botão chevron_right', () => {
    const onMonthChange = vi.fn();
    renderViewer({
      currentMY: { month: 4, year: 2026 },
      onMonthChange,
    });

    const nextButton = container.querySelector('button[title="Próximo mês"]') as HTMLButtonElement;
    expect(nextButton).toBeTruthy();

    act(() => {
      nextButton.click();
    });

    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenCalledWith({ month: 5, year: 2026 });
  });

  it('3. deve transicionar de janeiro para dezembro do ano anterior ao voltar', () => {
    const onMonthChange = vi.fn();
    renderViewer({
      currentMY: { month: 0, year: 2026 }, // Janeiro 2026
      onMonthChange,
    });

    const prevButton = container.querySelector('button[title="Mês anterior"]') as HTMLButtonElement;
    act(() => {
      prevButton.click();
    });

    expect(onMonthChange).toHaveBeenCalledWith({ month: 11, year: 2025 });
  });

  it('4. deve transicionar de dezembro para janeiro do ano seguinte ao avançar', () => {
    const onMonthChange = vi.fn();
    renderViewer({
      currentMY: { month: 11, year: 2026 }, // Dezembro 2026
      onMonthChange,
    });

    const nextButton = container.querySelector('button[title="Próximo mês"]') as HTMLButtonElement;
    act(() => {
      nextButton.click();
    });

    expect(onMonthChange).toHaveBeenCalledWith({ month: 0, year: 2027 });
  });

  it('5. deve alternar entre as abas válidas (hoje, semana, equipe, mes)', () => {
    renderViewer();

    const buttons = Array.from(container.querySelectorAll('button')).filter(b => 
      ['Hoje', '7 Dias', 'Quem Trabalha', 'Mês Todo'].some(label => b.textContent?.includes(label))
    );
    expect(buttons.length).toBe(4);

    // Clicar na aba "7 Dias"
    const semanaBtn = buttons.find(b => b.textContent?.includes('7 Dias'));
    act(() => {
      semanaBtn?.click();
    });
    expect(container.textContent).toContain('Próximos 7 Dias');

    // Clicar na aba "Quem Trabalha"
    const equipeBtn = buttons.find(b => b.textContent?.includes('Quem Trabalha'));
    act(() => {
      equipeBtn?.click();
    });
    expect(container.textContent).toContain('Escalação da Loja Hoje');

    // Clicar na aba "Mês Todo"
    const mesBtn = buttons.find(b => b.textContent?.includes('Mês Todo'));
    act(() => {
      mesBtn?.click();
    });
    expect(container.textContent).toContain('Escala Completa do Mês');
  });

  it('6. deve preservar a seleção do colaborador durante a troca de abas', () => {
    renderViewer({
      selectedEmployeeId: 'emp-2',
    });

    // Inicialmente no card do emp-2
    expect(container.textContent).toContain('Beatriz Santos');

    // Trocar para a aba 7 Dias
    const semanaBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('7 Dias'));
    act(() => {
      semanaBtn?.click();
    });

    // Nome de Beatriz continua no subtítulo da semana
    expect(container.textContent).toContain('Beatriz Santos');

    // Trocar para a aba Mês Todo
    const mesBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Mês Todo'));
    act(() => {
      mesBtn?.click();
    });
    expect(container.textContent).toContain('Beatriz Santos');
  });

  it('7. deve exibir estado vazio amigável quando não houver colaboradores ativos no mês', () => {
    renderViewer({
      employees: [],
    });

    expect(container.textContent).toContain('Nenhum colaborador disponível');
    expect(container.textContent).toContain('Não há colaboradores ativos cadastrados para este mês na loja');
  });

  it('8. deve chamar onOpenEmployeeCard com aba pedidos ao clicar em Cartão Pessoal & Solicitações', () => {
    const onOpenEmployeeCard = vi.fn();
    renderViewer({
      selectedEmployeeId: 'emp-1',
      onOpenEmployeeCard,
    });

    const cardButton = Array.from(container.querySelectorAll('button')).find(b => 
      b.textContent?.includes('Cartão Pessoal & Solicitações')
    );
    expect(cardButton).toBeTruthy();

    act(() => {
      cardButton?.click();
    });

    expect(onOpenEmployeeCard).toHaveBeenCalledTimes(1);
    expect(onOpenEmployeeCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'emp-1', name: 'Carlos Oliveira' }),
      'pedidos'
    );
  });
});
