// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useScheduleCommands, ScheduleCommands, PendingAuditAction } from '../hooks/useScheduleCommands';
import { Employee, MonthYear, AuditLogEntry } from '../types';
import { createTestEmployee } from './fixtures';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useScheduleCommands', () => {
  const currentMY: MonthYear = { year: 2026, month: 9 };
  const monthKey = '2026-10';

  it('em modo rascunho (não validado), deve aplicar alteração de turno sem auditoria', async () => {
    let commands!: ScheduleCommands;
    let employees: Employee[] = [
      createTestEmployee({
        id: 'emp-1',
        name: 'Maria Silva',
        shifts: { '2026-10': ['T'] },
        dailyHours: { '2026-10': ['10h às 18h20'] },
      }),
    ];
    let auditLogs: AuditLogEntry[] = [];
    let pendingAction: PendingAuditAction | null = null;

    const setEmployees = vi.fn((updater) => {
      employees = typeof updater === 'function' ? updater(employees) : updater;
    });
    const setAuditLogs = vi.fn((updater) => {
      auditLogs = typeof updater === 'function' ? updater(auditLogs) : updater;
    });
    const setPendingAuditAction = vi.fn((action) => {
      pendingAction = action;
    });

    function TestComponent() {
      commands = useScheduleCommands({
        employees,
        setEmployees,
        currentMY,
        monthKey,
        isReadOnly: false,
        isValidated: false,
        setAuditLogs,
        setPendingAuditAction,
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    // Executa alteração de turno
    await act(async () => {
      commands.handleUpdateShift('emp-1', 0, 'F');
    });

    expect(setEmployees).toHaveBeenCalled();
    expect(employees[0].shifts['2026-10'][0]).toBe('F');
    expect(pendingAction).toBeNull();
    expect(auditLogs).toHaveLength(0);

    root.unmount();
  });

  it('em escala oficializada (validada), deve interceptar e gerar log após confirmação de justificativa', async () => {
    let commands!: ScheduleCommands;
    let employees: Employee[] = [
      createTestEmployee({
        id: 'emp-1',
        name: 'Carlos Oliveira',
        shifts: { '2026-10': ['T'] },
        dailyHours: { '2026-10': ['10h às 18h20'] },
      }),
    ];
    let auditLogs: AuditLogEntry[] = [];
    let pendingAction: PendingAuditAction | null = null;

    const setEmployees = vi.fn((updater) => {
      employees = typeof updater === 'function' ? updater(employees) : updater;
    });
    const setAuditLogs = vi.fn((updater) => {
      auditLogs = typeof updater === 'function' ? updater(auditLogs) : updater;
    });
    const setPendingAuditAction = vi.fn((action) => {
      pendingAction = action;
    });

    function TestComponent() {
      commands = useScheduleCommands({
        employees,
        setEmployees,
        currentMY,
        monthKey,
        isReadOnly: false,
        isValidated: true, // Escala oficializada!
        setAuditLogs,
        setPendingAuditAction,
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    // Dispara alteração de turno
    await act(async () => {
      commands.handleUpdateShift('emp-1', 0, 'F');
    });

    // Deve ter interceptado
    expect(setPendingAuditAction).toHaveBeenCalled();
    expect(pendingAction).not.toBeNull();
    expect(pendingAction!.impacts).toHaveLength(1);
    expect(pendingAction!.impacts[0].empName).toBe('Carlos Oliveira');

    // Confirma com justificativa
    await act(async () => {
      pendingAction!.onConfirm('Troca de folga acordada com a gerência');
    });

    expect(setEmployees).toHaveBeenCalled();
    expect(employees[0].shifts['2026-10'][0]).toBe('F');
    expect(setAuditLogs).toHaveBeenCalled();
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].justification).toBe('Troca de folga acordada com a gerência');
    expect(auditLogs[0].isPostOfficialization).toBe(true);

    root.unmount();
  });

  it('quando isReadOnly for true, deve ignorar qualquer comando de alteração', async () => {
    let commands!: ScheduleCommands;
    const employees: Employee[] = [
      createTestEmployee({
        id: 'emp-1',
        shifts: { '2026-10': ['T'] },
      }),
    ];
    const setEmployees = vi.fn();
    const setAuditLogs = vi.fn();
    const setPendingAuditAction = vi.fn();

    function TestComponent() {
      commands = useScheduleCommands({
        employees,
        setEmployees,
        currentMY,
        monthKey,
        isReadOnly: true, // Apenas leitura!
        isValidated: false,
        setAuditLogs,
        setPendingAuditAction,
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    await act(async () => {
      commands.handleUpdateShift('emp-1', 0, 'F');
      commands.handleUpdateShifts([{ empId: 'emp-1', dayIdx: 0, newShift: 'F' }]);
      commands.onUpdateEmployeeDailyHour('emp-1', 0, '12h às 20h');
      commands.onUpdateTacticalPosition('emp-1', 0, 'P1');
    });

    expect(setEmployees).not.toHaveBeenCalled();
    expect(setAuditLogs).not.toHaveBeenCalled();
    expect(setPendingAuditAction).not.toHaveBeenCalled();

    root.unmount();
  });
});
