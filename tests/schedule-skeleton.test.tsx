// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ScheduleSkeleton } from '../components/ScheduleSkeleton';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ScheduleSkeleton Component', () => {
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

  it('deve renderizar com papel de status acessível para leitores de tela', async () => {
    await act(async () => {
      root.render(<ScheduleSkeleton mode="auto" />);
    });
    const skeleton = container.querySelector('[role="status"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute('aria-label')).toBe('Carregando escala...');
    expect(skeleton?.className).toContain('animate-pulse');
  });

  it('deve suportar modo mobile isolado', async () => {
    await act(async () => {
      root.render(<ScheduleSkeleton mode="mobile" />);
    });
    const mobileContainer = container.querySelector('.flex.flex-col');
    expect(mobileContainer).not.toBeNull();
  });

  it('deve suportar modo tabela desktop isolado com contagem correta de linhas', async () => {
    await act(async () => {
      root.render(<ScheduleSkeleton mode="table" rowsCount={6} />);
    });
    const rows = container.querySelectorAll('[data-testid="skeleton-table-row"]');
    expect(rows.length).toBe(6);
  });
});
