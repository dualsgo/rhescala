// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from '../App';
import { DialogProvider } from '../contexts/DialogContext';
import { STORAGE_KEYS } from '../src/infrastructure/storage/storageKeys';
import { setAuthSession } from '../src/infrastructure/storage/sessionAuthAdapter';
import { createTestEmployee } from './fixtures';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Viewer Integration — Fase 7.5', () => {
  let container: HTMLDivElement;
  let root: Root;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const mockEmployees = [
    createTestEmployee({
      id: 'emp-1',
      name: 'Carlos Oliveira',
      cargo: 'Vendas',
      status: 'active',
      shifts: { [currentMonthKey]: ['T', 'T', 'F', 'T', 'T', 'T', 'T'] },
      dailyHours: { [currentMonthKey]: ['10h às 18h20', '10h às 18h20', 'Folga', '10h às 18h20', '10h às 18h20', '10h às 18h20', '10h às 18h20'] },
    }),
    createTestEmployee({
      id: 'emp-2',
      name: 'Beatriz Santos',
      cargo: 'Vendas',
      status: 'active',
      shifts: { [currentMonthKey]: ['T', 'F', 'T', 'T', 'T', 'T', 'T'] },
      dailyHours: { [currentMonthKey]: ['13h40 às 22h00', 'Folga', '13h40 às 22h00', '13h40 às 22h00', '13h40 às 22h00', '13h40 às 22h00', '13h40 às 22h00'] },
    }),
  ];

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    // Polyfill scrollIntoView for jsdom
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    // Default setup: store configured, authenticated, month validated
    window.localStorage.setItem('riHappy_gasWebAppUrl', 'https://script.google.com/macros/s/test/exec');
    window.localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(mockEmployees));
    window.localStorage.setItem(STORAGE_KEYS.validatedMonths, JSON.stringify({ [currentMonthKey]: true }));

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

  it('viewer mobile inicia no modo personal com MobileEmployerViewer', async () => {
    setAuthSession({ isAuthenticated: true, role: 'viewer' });
    window.localStorage.setItem(STORAGE_KEYS.viewerModeType, JSON.stringify('personal'));

    await act(async () => {
      root.render(
        <DialogProvider>
          <App />
        </DialogProvider>
      );
    });

    // MobileEmployerViewer contains the button with title="Ver grade completa da loja"
    const switchToGridBtn = container.querySelector('button[title="Ver grade completa da loja"]');
    expect(switchToGridBtn).not.toBeNull();

    // Container for MobileEmployerViewer should have lg:hidden class
    const mobileWrapper = switchToGridBtn?.closest('.lg\\:hidden');
    expect(mobileWrapper).not.toBeNull();
  });

  it('viewer desktop mantém estrutura da grade completa na classe hidden lg:block', async () => {
    setAuthSession({ isAuthenticated: true, role: 'viewer' });
    window.localStorage.setItem(STORAGE_KEYS.viewerModeType, JSON.stringify('personal'));

    await act(async () => {
      root.render(
        <DialogProvider>
          <App />
        </DialogProvider>
      );
    });

    // In personal mode, desktop renders renderShiftGrid inside hidden lg:block container
    const desktopGridWrapper = container.querySelector('.hidden.lg\\:block');
    expect(desktopGridWrapper).not.toBeNull();
    // ShiftGrid renders inside it with short name
    expect(desktopGridWrapper?.textContent).toContain('CARLOS');
  });

  it('viewerModeType controla a renderização entre personal e grid', async () => {
    setAuthSession({ isAuthenticated: true, role: 'viewer' });
    window.localStorage.setItem(STORAGE_KEYS.viewerModeType, JSON.stringify('grid'));

    await act(async () => {
      root.render(
        <DialogProvider>
          <App />
        </DialogProvider>
      );
    });

    // When viewerModeType is 'grid', MobileEmployerViewer should NOT be rendered
    const switchToGridBtn = container.querySelector('button[title="Ver grade completa da loja"]');
    expect(switchToGridBtn).toBeNull();

    // Full grid is rendered directly
    expect(container.textContent).toContain('CARLOS');
  });

  it('viewerSelectedEmpId é atualizado ao selecionar colaborador', async () => {
    setAuthSession({ isAuthenticated: true, role: 'viewer' });
    window.localStorage.setItem(STORAGE_KEYS.viewerModeType, JSON.stringify('personal'));
    window.localStorage.setItem(STORAGE_KEYS.viewerSelectedEmpId, JSON.stringify('emp-1'));

    await act(async () => {
      root.render(
        <DialogProvider>
          <App />
        </DialogProvider>
      );
    });

    // Initially emp-1 Carlos Oliveira is selected in MobileEmployerViewer
    const switchToGridBtn = container.querySelector('button[title="Ver grade completa da loja"]');
    const mobileViewerCard = switchToGridBtn?.closest('.bg-white, .dark\\:bg-zinc-900');
    expect(mobileViewerCard?.textContent).toContain('Carlos Oliveira');

    // Click on the selector to open modal
    const selectorTrigger = container.querySelector('.cursor-pointer') as HTMLDivElement;
    expect(selectorTrigger).not.toBeNull();
    await act(async () => {
      selectorTrigger.click();
    });

    // Modal opens, look for Beatriz Santos button
    const buttons = Array.from(container.querySelectorAll('button'));
    const beatrizBtn = buttons.find(b => b.textContent?.includes('Beatriz Santos'));
    expect(beatrizBtn).not.toBeNull();

    await act(async () => {
      beatrizBtn?.click();
    });

    // Local storage should now have emp-2
    expect(window.localStorage.getItem(STORAGE_KEYS.viewerSelectedEmpId)).toBe(JSON.stringify('emp-2'));
  });

  it('alternância personal → grid via botão Grade do MobileEmployerViewer', async () => {
    setAuthSession({ isAuthenticated: true, role: 'viewer' });
    window.localStorage.setItem(STORAGE_KEYS.viewerModeType, JSON.stringify('personal'));

    await act(async () => {
      root.render(
        <DialogProvider>
          <App />
        </DialogProvider>
      );
    });

    // MobileEmployerViewer has onSwitchToFullGrid button (title="Ver grade completa da loja")
    const switchGridBtn = container.querySelector('button[title="Ver grade completa da loja"]') as HTMLButtonElement;
    expect(switchGridBtn).not.toBeNull();

    await act(async () => {
      switchGridBtn.click();
    });

    // viewerModeType should become 'grid'
    expect(window.localStorage.getItem(STORAGE_KEYS.viewerModeType)).toBe(JSON.stringify('grid'));
    // MobileEmployerViewer is now removed
    expect(container.querySelector('button[title="Ver grade completa da loja"]')).toBeNull();
  });

  it('alternância grid → personal via botão Meu Dia na MobileNavBar', async () => {
    setAuthSession({ isAuthenticated: true, role: 'viewer' });
    window.localStorage.setItem(STORAGE_KEYS.viewerModeType, JSON.stringify('grid'));

    await act(async () => {
      root.render(
        <DialogProvider>
          <App />
        </DialogProvider>
      );
    });

    // In grid mode for viewer, MobileNavBar button 1 has title "Voltar para Meu Dia"
    const toggleBtn = container.querySelector('button[title="Voltar para Meu Dia"]') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();

    await act(async () => {
      toggleBtn.click();
    });

    // viewerModeType should become 'personal'
    expect(window.localStorage.getItem(STORAGE_KEYS.viewerModeType)).toBe(JSON.stringify('personal'));
    // Personal view is now rendered
    expect(container.querySelector('button[title="Ver grade completa da loja"]')).not.toBeNull();
  });

  it('usuário não-viewer (admin) nunca recebe o MobileEmployerViewer', async () => {
    setAuthSession({ isAuthenticated: true, role: 'admin' });
    window.localStorage.setItem(STORAGE_KEYS.viewerModeType, JSON.stringify('personal'));

    await act(async () => {
      root.render(
        <DialogProvider>
          <App />
        </DialogProvider>
      );
    });

    // Admin should never see MobileEmployerViewer even if viewerModeType is 'personal'
    const switchToGridBtn = container.querySelector('button[title="Ver grade completa da loja"]');
    expect(switchToGridBtn).toBeNull();
  });

  it('ID salvo inválido/inexistente não quebra a tela e faz fallback gracefully', async () => {
    setAuthSession({ isAuthenticated: true, role: 'viewer' });
    window.localStorage.setItem(STORAGE_KEYS.viewerModeType, JSON.stringify('personal'));
    window.localStorage.setItem(STORAGE_KEYS.viewerSelectedEmpId, JSON.stringify('non-existent-id'));

    await act(async () => {
      root.render(
        <DialogProvider>
          <App />
        </DialogProvider>
      );
    });

    // Screen should render without crashing
    const switchToGridBtn = container.querySelector('button[title="Ver grade completa da loja"]');
    expect(switchToGridBtn).not.toBeNull();
    // Fallback selects the first active employee (Carlos Oliveira)
    expect(container.textContent).toContain('Carlos Oliveira');
  });
});
