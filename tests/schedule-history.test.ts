// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useScheduleHistory, UseScheduleHistoryReturn, HistoryStep } from '../hooks/useScheduleHistory';
import { Employee } from '../types';
import { createTestEmployee } from './fixtures';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useScheduleHistory', () => {
  it('inicializa com canUndo = false e canRedo = false', async () => {
    let historyState!: UseScheduleHistoryReturn;
    const initialEmployees: Employee[] = [
      createTestEmployee({ id: 'emp-1', name: 'Ana', shifts: { '2026-10': ['T'] } }),
    ];
    let stored = initialEmployees;
    const setStorage = vi.fn((val) => {
      stored = typeof val === 'function' ? val(stored) : val;
    });

    function TestComponent() {
      historyState = useScheduleHistory(stored, setStorage);
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(historyState.canUndo).toBe(false);
    expect(historyState.canRedo).toBe(false);
    expect(historyState.lastUndoDescription).toBeNull();

    root.unmount();
  });

  it('armazena estado anterior ao executar setEmployees e permite Desfazer (undo)', async () => {
    let historyState!: UseScheduleHistoryReturn;
    let stored: Employee[] = [
      createTestEmployee({ id: 'emp-1', name: 'Ana', shifts: { '2026-10': ['T'] } }),
    ];
    const setStorage = vi.fn((val) => {
      stored = typeof val === 'function' ? val(stored) : val;
    });

    function TestComponent() {
      historyState = useScheduleHistory(stored, setStorage);
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    // 1. Aplica alteração (ex: presets)
    await act(async () => {
      historyState.setEmployees(
        (prev) => prev.map((e) => ({ ...e, shifts: { '2026-10': ['F'] } })),
        'Aplicação de pré-definições'
      );
    });

    // Re-render com novo stored
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(setStorage).toHaveBeenCalled();
    expect(stored[0].shifts['2026-10'][0]).toBe('F');
    expect(historyState.canUndo).toBe(true);
    expect(historyState.canRedo).toBe(false);
    expect(historyState.lastUndoDescription).toBe('Aplicação de pré-definições');

    // 2. Desfaz alteração
    let undoneResult: any;
    await act(async () => {
      undoneResult = historyState.undo();
    });

    // Re-render
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(undoneResult?.description).toBe('Aplicação de pré-definições');
    expect(stored[0].shifts['2026-10'][0]).toBe('T');
    expect(historyState.canUndo).toBe(false);
    expect(historyState.canRedo).toBe(true);
    expect(historyState.lastRedoDescription).toBe('Aplicação de pré-definições');

    // 3. Refaz alteração (redo)
    let redoneResult: any;
    await act(async () => {
      redoneResult = historyState.redo();
    });

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(redoneResult?.description).toBe('Aplicação de pré-definições');
    expect(stored[0].shifts['2026-10'][0]).toBe('F');
    expect(historyState.canUndo).toBe(true);
    expect(historyState.canRedo).toBe(false);

    root.unmount();
  });

  it('uma nova alteração após um Desfazer limpa a pilha de Refazer', async () => {
    let historyState!: UseScheduleHistoryReturn;
    let stored: Employee[] = [
      createTestEmployee({ id: 'emp-1', name: 'Ana', shifts: { '2026-10': ['T'] } }),
    ];
    const setStorage = vi.fn((val) => {
      stored = typeof val === 'function' ? val(stored) : val;
    });

    function TestComponent() {
      historyState = useScheduleHistory(stored, setStorage);
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    // Ação 1
    await act(async () => {
      historyState.setEmployees(
        (prev) => prev.map((e) => ({ ...e, shifts: { '2026-10': ['F'] } })),
        'Ação 1'
      );
    });

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    // Desfaz Ação 1
    await act(async () => {
      historyState.undo();
    });

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(historyState.canRedo).toBe(true);

    // Nova Ação 2 descarta o refazer da Ação 1
    await act(async () => {
      historyState.setEmployees(
        (prev) => prev.map((e) => ({ ...e, shifts: { '2026-10': ['FF'] } })),
        'Ação 2'
      );
    });

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(historyState.canRedo).toBe(false);
    expect(historyState.lastUndoDescription).toBe('Ação 2');

    root.unmount();
  });
});
