// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { analyzeMonthRefresh, applyMonthRefresh } from '../src/engine/orchestration/refresh-month';
import { RefreshMonthModal } from '../components/RefreshMonthModal';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';
import { createTestEmployee } from './fixtures';
import { Employee } from '../types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Atualização Contextual da Grade (RefreshMonth)', () => {
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

  it('analyzeMonthRefresh detecta colaborador sem folgas/escala e mudanças de cadastro sem alterar os dados', () => {
    const existingShifts = Array(30).fill('T');
    existingShifts[4] = 'F'; // folga manual no dia 5

    const employees: Employee[] = [
      createTestEmployee({
        id: 'emp-ok',
        name: 'Maria Editada',
        workPeriod: '09:40 às 18:00',
        shiftName: 'Fechamento', // desatualizado propositalmente
        birthday: '1994-11-15',
        shifts: { '2026-11': existingShifts },
        dailyHours: { '2026-11': Array(30).fill('13:40 às 22:00') },
      }),
      createTestEmployee({
        id: 'emp-reexibido',
        name: 'João Reexibido',
        // Sem shifts para 2026-11 (estava oculto ao gerar o mês)
        shifts: {},
      }),
    ];

    const analysis = analyzeMonthRefresh(employees, 2026, 10, [], [], DEFAULT_JORNADA_SETTINGS);

    expect(analysis.hasAnyChanges).toBe(true);
    expect(analysis.missingScheduleCount).toBe(1);

    const maria = analysis.previews.find(p => p.empId === 'emp-ok');
    expect(maria).toBeDefined();
    expect(maria?.hasMissingSchedule).toBe(false);
    expect(maria?.changes.some(c => c.kind === 'legal_override')).toBe(true);
    expect(maria?.changes.some(c => c.kind === 'shift_name_sync')).toBe(true);
    expect(maria?.changes.some(c => c.kind === 'hours_sync')).toBe(true);

    const joao = analysis.previews.find(p => p.empId === 'emp-reexibido');
    expect(joao?.hasMissingSchedule).toBe(true);
  });

  it('applyMonthRefresh gera escala só para generateForEmpIds e preserva folgas manuais dos demais', () => {
    const existingShifts = Array(30).fill('T');
    existingShifts[4] = 'F'; // folga manual no dia 5 deve ser mantida!

    const employees: Employee[] = [
      createTestEmployee({
        id: 'emp-ok',
        name: 'Maria Editada',
        workPeriod: '09:40 às 18:00',
        shiftName: 'Fechamento',
        birthday: '1994-11-15',
        shifts: { '2026-11': existingShifts },
        dailyHours: { '2026-11': Array(30).fill('13:40 às 22:00') },
      }),
      createTestEmployee({
        id: 'emp-reexibido',
        name: 'João Reexibido',
        preferredDayOff: 'Quarta-feira',
        shifts: {},
      }),
    ];

    const updated = applyMonthRefresh(employees, 2026, 10, {
      generateForEmpIds: ['emp-reexibido'],
      settings: DEFAULT_JORNADA_SETTINGS,
    });

    const maria = updated.find(e => e.id === 'emp-ok')!;
    expect(maria.shifts['2026-11'][4]).toBe('F'); // Folga manual preservada
    expect(maria.shifts['2026-11'][14]).toBe('DO'); // Aniversário sincronizado
    expect(maria.shiftName).toBe('Abertura'); // Turno sincronizado

    const joao = updated.find(e => e.id === 'emp-reexibido')!;
    expect(joao.shifts['2026-11']).toHaveLength(30);
    expect(joao.shifts['2026-11'].some(s => s === 'F')).toBe(true); // Ganhou folgas
  });

  it('RefreshMonthModal exibe prévia contextual e confirma com IDs marcados', async () => {
    const analysis = analyzeMonthRefresh(
      [createTestEmployee({ id: 'emp-reexibido', name: 'João Reexibido', shifts: {} })],
      2026,
      10,
      [],
      [],
      DEFAULT_JORNADA_SETTINGS
    );

    const onConfirm = vi.fn();
    await act(async () => {
      root.render(
        <RefreshMonthModal
          isOpen={true}
          onClose={vi.fn()}
          monthLabel="novembro de 2026"
          analysis={analysis}
          contextBanner="João Reexibido foi reexibido na grade sem folgas geradas."
          onConfirm={onConfirm}
        />
      );
    });

    expect(container.textContent).toContain('João Reexibido foi reexibido na grade sem folgas geradas.');
    expect(container.textContent).toContain('Sem escala/folgas no mês');

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Confirmar Atualização')
    );
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn?.click();
    });

    expect(onConfirm).toHaveBeenCalledWith(['emp-reexibido']);
  });
});
