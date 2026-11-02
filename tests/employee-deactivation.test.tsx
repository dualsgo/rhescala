// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DeactivateEmployeeModal } from '../components/DeactivateEmployeeModal';
import { TeamView } from '../components/TeamView';
import { DialogProvider } from '../contexts/DialogContext';
import { isEmployeeActiveInMonth, isEmployeeActiveOnDay, isEmployeeEligibleForMonth } from '../constants';
import { Employee } from '../types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Mecânica de Desativação de Colaborador (Fim de Contrato ou Demissão)', () => {
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

  const baseEmp = (id: string, name: string): Employee => ({
    id,
    name,
    isYoungApprentice: false,
    cargo: 'Vendas',
    status: 'active',
    statusColor: '#ff8400',
    shifts: {
      '2026-09': Array(30).fill('T'),
      '2026-10': Array(31).fill('T'),
      '2026-11': Array(30).fill('T'),
    },
    dailyHours: {},
    workPeriod: '10h às 18h20',
    preferredDayOff: 'Segunda-feira',
    shiftName: 'Abertura',
  });

  it('1. isEmployeeActiveInMonth preserva meses anteriores à desativação e oculta totalmente no mês da desativação e seguintes', () => {
    const emp = baseEmp('emp-1', 'Lucas Sazonal');
    emp.contractType = 'Sazonal';
    emp.status = 'inactive';
    emp.inactiveReason = 'fim_contrato';
    emp.inactiveDate = '2026-10-15';
    emp.firedAt = '2026-10-15';

    // Setembro (2026-09, month 8): mês anterior à desativação permanece preservado!
    expect(isEmployeeActiveInMonth(emp, 2026, 8)).toBe(true);
    expect(isEmployeeEligibleForMonth(emp, 2026, 8)).toBe(true);

    // Outubro (2026-10, month 9): mês em que ocorreu a desativação -> oculta totalmente no mês atual/desativação!
    expect(isEmployeeActiveInMonth(emp, 2026, 9)).toBe(false);
    expect(isEmployeeEligibleForMonth(emp, 2026, 9)).toBe(false);

    // Novembro (2026-11, month 10): após a desativação, NÃO aparece mais na grade!
    expect(isEmployeeActiveInMonth(emp, 2026, 10)).toBe(false);
    expect(isEmployeeEligibleForMonth(emp, 2026, 10)).toBe(false);
  });

  it('2. isEmployeeActiveOnDay preserva atividade em meses anteriores e oculta no mês da desativação e seguintes', () => {
    const emp = baseEmp('emp-2', 'Juliana Demitida');
    emp.status = 'inactive';
    emp.inactiveReason = 'demissao';
    emp.inactiveDate = '2026-10-15';
    emp.firedAt = '2026-10-15';

    // No mês da desativação (15/10/2026 e 16/10/2026): oculto para não exibir nada no mês atual
    expect(isEmployeeActiveOnDay(emp, '2026-10-15', '2026-10', 14)).toBe(false);
    expect(isEmployeeActiveOnDay(emp, '2026-10-16', '2026-10', 15)).toBe(false);

    // No mês anterior (30/09/2026): histórico preservado
    expect(isEmployeeActiveOnDay(emp, '2026-09-30', '2026-09', 29)).toBe(true);
  });

  it('3. DeactivateEmployeeModal renderiza opções de Fim de Contrato e Demissão com data efetiva', async () => {
    const emp = baseEmp('emp-3', 'Roberto Rocha');
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <DeactivateEmployeeModal
          employee={emp}
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );
    });

    expect(container.textContent).toContain('Desativação de Colaborador');
    expect(container.textContent).toContain('Roberto Rocha');
    expect(container.textContent).toContain('Fim de Contrato / Término de Vigência');
    expect(container.textContent).toContain('Demissão / Rescisão Contratual');
    expect(container.textContent).toContain('Cadastro e Histórico 100% Preservados');

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('Confirmar Desativação')
    );
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn?.click();
    });

    expect(onConfirm).toHaveBeenCalledWith('emp-3', expect.any(String), expect.any(String));
  });

  it('4. Permite alternar motivo para fim_contrato e confirmar com data customizada', async () => {
    const emp = baseEmp('emp-4', 'Fernanda Silva');
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <DeactivateEmployeeModal
          employee={emp}
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );
    });

    // Encontra o container/label que tem "Fim de Contrato" e clica nele
    const labelFimContrato = Array.from(container.querySelectorAll('label')).find(l =>
      l.textContent?.includes('Fim de Contrato')
    );
    expect(labelFimContrato).toBeDefined();

    await act(async () => {
      labelFimContrato?.click();
    });

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeDefined();

    // Simula evento de input com setter do protótipo
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(dateInput, '2026-10-31');
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('Confirmar Desativação')
    );

    await act(async () => {
      confirmBtn?.click();
    });

    expect(onConfirm).toHaveBeenCalledWith('emp-4', 'fim_contrato', '2026-10-31');
  });

  it('5. TeamView segrega colaboradores desativados em seção recolhida por padrão e aplica estilo opaco ao expandir', async () => {
    const activeEmp = baseEmp('emp-active', 'Mariana Ativa');
    const inactiveEmp = {
      ...baseEmp('emp-inactive', 'Carlos Desativado'),
      status: 'inactive' as const,
      inactiveReason: 'fim_contrato' as const,
      inactiveDate: '2026-10-20',
      firedAt: '2026-10-20',
    };

    await act(async () => {
      root.render(
        <DialogProvider>
          <TeamView
            employees={[activeEmp, inactiveEmp]}
            onUpdateEmployee={vi.fn()}
            onDeleteEmployee={vi.fn()}
            onAddEmployee={vi.fn()}
          />
        </DialogProvider>
      );
    });

    // Colaborador ativo aparece normalmente na grade principal
    const activeGrid = container.querySelector('[data-testid="active-employees-grid"]');
    expect(activeGrid?.textContent).toContain('Mariana Ativa');
    expect(activeGrid?.textContent).not.toContain('Carlos Desativado');

    // Colaborador desativado fica escondido por padrão dentro da seção segregada
    const inactiveSection = container.querySelector('[data-testid="inactive-employees-section"]');
    expect(inactiveSection).not.toBeNull();
    expect(container.querySelector('[data-testid="inactive-employees-grid"]')).toBeNull();

    // Ao clicar em Mostrar Desativados, exibe o card com estilo opaco/segregado
    const toggleBtn = container.querySelector('[data-testid="toggle-inactive-section-btn"]') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();

    await act(async () => {
      toggleBtn.click();
    });

    const inactiveCard = container.querySelector('[data-testid="inactive-card-emp-inactive"]');
    expect(inactiveCard).not.toBeNull();
    expect(inactiveCard?.className).toContain('opacity-60');
    expect(inactiveCard?.textContent).toContain('Carlos Desativado');
    expect(inactiveCard?.textContent).toContain('Fim de Contrato');
  });
});
