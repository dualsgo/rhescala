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
    syncStatus: { state: 'synced' as const, pendingCount: 0 },
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
});
