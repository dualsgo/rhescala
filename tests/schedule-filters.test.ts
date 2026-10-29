// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useScheduleFilters, ScheduleFiltersState } from '../hooks/useScheduleFilters';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useScheduleFilters', () => {
  it('deve inicializar com valores padrão e permitir atualizar e limpar filtros', async () => {
    let hookState!: ScheduleFiltersState;

    function TestComponent() {
      hookState = useScheduleFilters();
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(hookState.filter).toBe('all');
    expect(hookState.contractFilter).toBe('all');
    expect(hookState.onlyWorkingToday).toBe(false);
    expect(hookState.selectedGroup).toBeNull();
    expect(hookState.hasActiveFilters).toBe(false);

    // Atualiza filtros
    await act(async () => {
      hookState.setFilter('sunday');
      hookState.setContractFilter('clt');
      hookState.toggleOnlyWorkingToday();
      hookState.setSelectedGroup('Abertura');
    });

    expect(hookState.filter).toBe('sunday');
    expect(hookState.contractFilter).toBe('clt');
    expect(hookState.onlyWorkingToday).toBe(true);
    expect(hookState.selectedGroup).toBe('Abertura');
    expect(hookState.hasActiveFilters).toBe(true);

    // Limpa filtros
    await act(async () => {
      hookState.clearFilters();
    });

    expect(hookState.filter).toBe('all');
    expect(hookState.contractFilter).toBe('all');
    expect(hookState.onlyWorkingToday).toBe(false);
    expect(hookState.selectedGroup).toBeNull();
    expect(hookState.hasActiveFilters).toBe(false);

    root.unmount();
  });

  it('deve garantir exclusão mútua entre onlyWorkingToday e o grupo Folgas/Outros', async () => {
    let hookState!: ScheduleFiltersState;

    function TestComponent() {
      hookState = useScheduleFilters();
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    await act(async () => {
      hookState.setSelectedGroup('Folgas/Outros');
    });
    expect(hookState.selectedGroup).toBe('Folgas/Outros');
    expect(hookState.onlyWorkingToday).toBe(false);

    // Ativar onlyWorkingToday limpa Folgas/Outros para não produzir grade vazia contraditória
    await act(async () => {
      hookState.setOnlyWorkingToday(true);
    });
    expect(hookState.onlyWorkingToday).toBe(true);
    expect(hookState.selectedGroup).toBeNull();

    // Selecionar Folgas/Outros desativa onlyWorkingToday
    await act(async () => {
      hookState.setSelectedGroup('Folgas/Outros');
    });
    expect(hookState.selectedGroup).toBe('Folgas/Outros');
    expect(hookState.onlyWorkingToday).toBe(false);

    root.unmount();
  });
});
