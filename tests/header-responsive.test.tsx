// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Header } from '../components/Header';
import { MonthYear } from '../types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Header — Responsividade e Acessibilidade (Fase 7.7.2)', () => {
  let container: HTMLDivElement;
  let root: Root;

  const defaultMY: MonthYear = { month: 9, year: 2026 }; // Outubro de 2026
  const baseProps = {
    currentView: 'grid',
    currentMY: defaultMY,
    filter: 'all' as const,
    onViewChange: vi.fn(),
    onMonthChange: vi.fn(),
    onFilterChange: vi.fn(),
    onShareWhatsApp: vi.fn(),
    onShareApoioWhatsApp: vi.fn(),
    syncStatus: { state: 'synced' as const, pendingCount: 0, history: [] },
    selectedDayIdx: 0,
    isReadOnly: false,
    isEditable: false,
    onToggleEdit: vi.fn(),
    allowRetroactive: false,
    onToggleRetroactive: vi.fn(),
    onPrint: vi.fn(),
    onCreateMonth: vi.fn(),
    onApplyFolgas: vi.fn(),
    onSortearDomingo: vi.fn(),
    showNotes: false,
    onToggleNotes: vi.fn(),
    canGoNext: true,
    sundayViolations: [],
    onLogout: vi.fn(),
    onSwitchRole: vi.fn(),
    onShowHelp: vi.fn(),
    isValidated: true,
    onToggleValidation: vi.fn(),
    pendingRequestsCount: 3,
    inconsistencyCount: 2,
    onOpenInconsistencyModal: vi.fn(),
    diffCount: 5,
    onOpenDiffModal: vi.fn(),
    onManualSave: vi.fn(),
  };

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

  it('deve renderizar os badges de auditoria e alertas com aria-label explicativo e contadores corretos', async () => {
    await act(async () => {
      root.render(<Header {...baseProps} />);
    });

    // Badge de divergências (diff)
    const diffBtn = container.querySelector('button[aria-label="5 divergências pós-oficialização"]');
    expect(diffBtn).not.toBeNull();
    expect(diffBtn?.textContent).toContain('5');

    // Badge de inconsistências CLT
    const alertaBtn = container.querySelector('button[aria-label="2 alertas de inconsistência CLT"]');
    expect(alertaBtn).not.toBeNull();
    expect(alertaBtn?.textContent).toContain('2');
  });

  it('deve renderizar o botão de salvar com aria-label descritivo e disparar callback ao clicar', async () => {
    await act(async () => {
      root.render(<Header {...baseProps} />);
    });

    const saveBtn = container.querySelector('button[aria-label="Salvar escala agora (Atalho Ctrl+S)"]') as HTMLButtonElement | null;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn?.textContent).toContain('Salvar');

    // Validação cirúrgica do breakpoint do atalho Ctrl+S (>= 1440px e não 2xl/1536px)
    const ctrlSSpan = Array.from(saveBtn?.querySelectorAll('span') || []).find(el => el.textContent?.includes('Ctrl+S'));
    expect(ctrlSSpan).toBeDefined();
    expect(ctrlSSpan?.className).toContain('min-[1440px]:inline');
    expect(ctrlSSpan?.className).not.toContain('2xl:inline');

    act(() => {
      saveBtn?.click();
    });
    expect(baseProps.onManualSave).toHaveBeenCalled();
  });

  it('deve renderizar navegação com acessibilidade e rótulos progressivos para Operações', async () => {
    await act(async () => {
      root.render(<Header {...baseProps} />);
    });

    const navGrade = container.querySelector('button[aria-label="Grade"]');
    expect(navGrade).not.toBeNull();

    const navOperacoes = container.querySelector('button[aria-label*="Operações"]');
    expect(navOperacoes).not.toBeNull();
    expect(navOperacoes?.textContent).toContain('Operações');
  });

  it('deve renderizar controles de mês com aria-label apropriado', async () => {
    await act(async () => {
      root.render(<Header {...baseProps} />);
    });

    const prevMonthBtn = container.querySelector('button[aria-label="Mês Anterior"]');
    expect(prevMonthBtn).not.toBeNull();

    const nextMonthBtn = container.querySelector('button[aria-label="Próximo Mês"]');
    expect(nextMonthBtn).not.toBeNull();
  });

  it('no modo viewer (isReadOnly=true), botões administrativos ficam ocultos e exibe Acesso Gerencial', async () => {
    await act(async () => {
      root.render(<Header {...baseProps} isReadOnly={true} />);
    });

    // Não deve renderizar badges de auditoria no modo viewer
    expect(container.querySelector('button[aria-label="5 divergências pós-oficialização"]')).toBeNull();
    expect(container.querySelector('button[aria-label="2 alertas de inconsistência CLT"]')).toBeNull();

    // Deve exibir botão de Acesso Gerencial
    const adminBtn = container.querySelector('button[aria-label="Entrar com acesso gerencial de Administrador"]');
    expect(adminBtn).not.toBeNull();
  });

  it('deve implementar navegação esquerda compacta para faixa lg (< xl) preservando descoberta e contador', async () => {
    await act(async () => {
      root.render(<Header {...baseProps} pendingRequestsCount={3} />);
    });

    // 1. Os quatro itens continuam presentes
    const navGrade = container.querySelector('button[aria-label="Grade"]');
    const navAnalise = container.querySelector('button[aria-label="Análise"]');
    const navRequests = container.querySelector('button[aria-label="Solicitações"]');
    const navOperacoes = container.querySelector('button[aria-label*="Operações"]');

    expect(navGrade).not.toBeNull();
    expect(navAnalise).not.toBeNull();
    expect(navRequests).not.toBeNull();
    expect(navOperacoes).not.toBeNull();

    // 2 & 3. Classes de padding e gap compactos em lg e normais em xl
    expect(navGrade?.className).toContain('px-2');
    expect(navGrade?.className).toContain('xl:px-3.5');
    expect(navGrade?.className).toContain('gap-1');
    expect(navGrade?.className).toContain('xl:gap-1.5');
    expect(navOperacoes?.className).toContain('px-2');
    expect(navOperacoes?.className).toContain('xl:px-3');

    // 2 & 3. Rótulo compacto em lg ("Pedidos") e completo em xl ("Solicitações")
    const fullRequestsLabel = navRequests?.querySelector('span.hidden.xl\\:inline');
    const compactRequestsLabel = navRequests?.querySelector('span.inline.xl\\:hidden');
    expect(fullRequestsLabel?.textContent).toBe('Solicitações');
    expect(compactRequestsLabel?.textContent).toBe('Pedidos');

    // 4. Solicitações continua exibindo o contador
    const badge = navRequests?.querySelector('span[aria-label="3 solicitações pendentes"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('3');

    // 5. Operações continua sendo um controle de menu
    expect(navOperacoes?.getAttribute('title')).toContain('Menu Operações & Loja');
    expect(navOperacoes?.textContent).toContain('Operações');

    // 6. aria-label e title continuam disponíveis
    expect(navRequests?.getAttribute('aria-label')).toBe('Solicitações');
    expect(navRequests?.getAttribute('title')).toBe('Visualizar Solicitações');
    expect(navGrade?.getAttribute('aria-label')).toBe('Grade');
    expect(navGrade?.getAttribute('title')).toBe('Visualizar Grade');
  });
});
