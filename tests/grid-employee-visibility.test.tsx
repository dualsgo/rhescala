// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ShiftGrid } from '../components/ShiftGrid';
import { MobileDayScheduleView } from '../components/MobileDayScheduleView';
import { Employee, MonthYear } from '../types';
import { isEmployeeHiddenInMonth, isEmployeeActiveInMonth } from '../constants';
import { applyMonthUpdate, resolveTacticalDay } from '../hooks/useScheduleEngine';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseEmp = (id: string, name: string, cargo: any = 'Vendas', role: any = 'Vendas'): Employee => ({
  id,
  name,
  isYoungApprentice: false,
  contractType: 'CLT',
  jornada: '6x1',
  primaryRole: cargo,
  cargo,
  role,
  status: 'active',
  statusColor: '#10b981',
  shifts: {
    '2026-10': Array(31).fill('T'),
    '2026-11': Array(30).fill('T'),
  },
  dailyHours: {
    '2026-10': Array(31).fill('10h às 18h20'),
    '2026-11': Array(30).fill('10h às 18h20'),
  },
  workPeriod: '10h às 18h20',
  preferredDayOff: 'Segunda-feira',
  shiftName: 'Abertura',
});

describe('Discreet Employee Visibility directly on the Grid', () => {
  let container: HTMLDivElement;
  let root: Root;

  const currentMY: MonthYear = { year: 2026, month: 10 }; // Novembro 2026
  const monthKey = '2026-11';

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
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

  it('1. isEmployeeHiddenInMonth isola a ocultação por mês e preserva meses anteriores', () => {
    const emp = baseEmp('emp-1', 'Carlos Silva');
    emp.hiddenMonths = { '2026-11': true };

    // No mês de Novembro (2026-11), está oculto
    expect(isEmployeeHiddenInMonth(emp, '2026-11')).toBe(true);
    expect(isEmployeeActiveInMonth(emp, 2026, 10)).toBe(false);

    // No mês anterior Outubro (2026-10), permanece 100% ativo e visível!
    expect(isEmployeeHiddenInMonth(emp, '2026-10')).toBe(false);
    expect(isEmployeeActiveInMonth(emp, 2026, 9)).toBe(true);

    // Colaborador com isHidden legado global fica oculto em qualquer mês
    const globalHidden = baseEmp('emp-2', 'Mariana Costa');
    globalHidden.isHidden = true;
    expect(isEmployeeHiddenInMonth(globalHidden, '2026-11')).toBe(true);
    expect(isEmployeeHiddenInMonth(globalHidden, '2026-10')).toBe(true);
  });

  it('2. ShiftGrid renderiza botão discreto de ocultar na linha do colaborador para o gestor', () => {
    const emp1 = baseEmp('emp-1', 'Carlos Silva');
    const emp2 = baseEmp('emp-2', 'Ana Souza');
    const onToggleHide = vi.fn();

    act(() => {
      root.render(
        <ShiftGrid
          employees={[emp1, emp2]}
          currentMY={currentMY}
          selectedDayIdx={0}
          customHolidays={[]}
          filter="all"
          isReadOnly={false}
          isEditable={false}
          resolvedPositions={{}}
          onOpenEmployeeCard={vi.fn()}
          onUpdateEmployeeDailyHour={vi.fn()}
          onUpdateTacticalPosition={vi.fn()}
          onFilterChange={vi.fn()}
          onToggleHideEmployee={onToggleHide}
        />
      );
    });

    // O botão discreto de ocultar existe no DOM com aria-label correspondente
    const hideBtn = container.querySelector('[aria-label="Ocultar Carlos Silva da grade neste mês"]') as HTMLElement;
    expect(hideBtn).not.toBeNull();

    // Clicar aciona onToggleHide com o ID do colaborador
    act(() => {
      hideBtn.click();
    });
    expect(onToggleHide).toHaveBeenCalledWith('emp-1');
  });

  it('3. Colaborador oculto no mês não aparece no tbody da grade e pode ser reexibido pelo modal de Equipe', () => {
    const emp1 = baseEmp('emp-1', 'Carlos Silva');
    emp1.hiddenMonths = { '2026-11': true };
    const emp2 = baseEmp('emp-2', 'Ana Souza');
    const onToggleHide = vi.fn();

    act(() => {
      root.render(
        <ShiftGrid
          employees={[emp1, emp2]}
          currentMY={currentMY}
          selectedDayIdx={0}
          customHolidays={[]}
          filter="all"
          isReadOnly={false}
          isEditable={false}
          resolvedPositions={{}}
          onOpenEmployeeCard={vi.fn()}
          onUpdateEmployeeDailyHour={vi.fn()}
          onUpdateTacticalPosition={vi.fn()}
          onFilterChange={vi.fn()}
          onToggleHideEmployee={onToggleHide}
        />
      );
    });

    // Ana Souza está visível na tabela
    expect(container.textContent).toContain('ANA');

    // Carlos Silva NÃO está no corpo da tabela
    expect(container.textContent).not.toContain('CARLOS');

    // Botão de Equipe indica 1 colaborador oculto
    const teamTrigger = container.querySelector('[aria-label="Gerenciar visibilidade de colaboradores na grade"]') as HTMLButtonElement;
    expect(teamTrigger).not.toBeNull();

    act(() => {
      teamTrigger.click();
    });

    // Modal de visibilidade abre listando Carlos Silva em "Ocultos na Grade deste Mês"
    expect(container.textContent).toContain('Ocultos na Grade deste Mês (1)');
    expect(container.textContent).toContain('Carlos Silva');

    // Clicar em "Exibir" aciona o callback de reexibição
    const exibirBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Exibir'));
    expect(exibirBtn).toBeDefined();

    act(() => {
      exibirBtn?.click();
    });
    expect(onToggleHide).toHaveBeenCalledWith('emp-1');
  });

  it('4. Viewer (isReadOnly = true) nunca vê controles de ocultar ou gerenciar visibilidade', () => {
    const emp1 = baseEmp('emp-1', 'Carlos Silva');
    const onToggleHide = vi.fn();

    act(() => {
      root.render(
        <ShiftGrid
          employees={[emp1]}
          currentMY={currentMY}
          selectedDayIdx={0}
          customHolidays={[]}
          filter="all"
          isReadOnly={true}
          isEditable={false}
          resolvedPositions={{}}
          onOpenEmployeeCard={vi.fn()}
          onUpdateEmployeeDailyHour={vi.fn()}
          onUpdateTacticalPosition={vi.fn()}
          onFilterChange={vi.fn()}
          onToggleHideEmployee={onToggleHide}
        />
      );
    });

    // Nenhum botão de ocultar na linha
    expect(container.querySelector('[aria-label="Ocultar Carlos Silva da grade neste mês"]')).toBeNull();

    // Nenhum botão de gerenciamento de visibilidade
    expect(container.querySelector('[aria-label="Gerenciar visibilidade de colaboradores na grade"]')).toBeNull();
  });

  it('5. Motor de escala e alocação exclui colaborador oculto no mês sem contar com ele', () => {
    const caixa1 = baseEmp('caixa-1', 'Caixa Um', 'Caixa', 'Caixa');
    caixa1.hiddenMonths = { '2026-11': true }; // Oculto no mês do rascunho
    const caixa2 = baseEmp('caixa-2', 'Caixa Dois', 'Caixa', 'Caixa');
    const vend1 = baseEmp('vend-1', 'Vendedor Um', 'Vendas', 'Vendas');

    // 1. applyMonthUpdate não gera para caixa1
    const generated = applyMonthUpdate([caixa1, caixa2, vend1], 2026, 10);
    expect(generated['caixa-1']).toBeUndefined();
    expect(generated['caixa-2']).toBeDefined();
    expect(generated['vend-1']).toBeDefined();

    // 2. resolveTacticalDay ignora caixa1 e aloca o Caixa obrigatório entre a equipe visível restante
    const dailyRoles = resolveTacticalDay([caixa1, caixa2, vend1], '2026-11', 0);
    expect(dailyRoles['caixa-1']).toBeUndefined();
    expect(dailyRoles['caixa-2']).toBe('Caixa');
  });

  it('6. MobileDayScheduleView quick-edit oferece opção de ocultar para gestores', () => {
    const emp1 = baseEmp('emp-1', 'Carlos Silva');
    const onToggleHide = vi.fn();

    act(() => {
      root.render(
        <MobileDayScheduleView
          employees={[emp1]}
          allEmployees={[emp1]}
          currentMY={currentMY}
          selectedDayIdx={0}
          monthKey={monthKey}
          isHoliday={false}
          isSunday={false}
          resolvedPositions={{}}
          tacticalDisplayMode="off"
          isReadOnly={false}
          onUpdateShift={vi.fn()}
          onUpdateEmployeeDailyHour={vi.fn()}
          onUpdateTacticalPosition={vi.fn()}
          onOpenEmployeeCard={vi.fn()}
          onOpenDayDetail={vi.fn()}
          onToggleHideEmployee={onToggleHide}
        />
      );
    });

    // Clicar no cartão abre o bottom sheet de edição rápida do gestor
    const empCard = Array.from(container.querySelectorAll('span')).find(el => el.textContent?.includes('CARLOS'));
    expect(empCard).toBeDefined();

    act(() => {
      empCard?.closest('div')?.click();
    });

    // Botão de ocultar da grade neste mês está presente
    const hideBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Ocultar da Grade neste Mês'));
    expect(hideBtn).toBeDefined();

    act(() => {
      hideBtn?.click();
    });
    expect(onToggleHide).toHaveBeenCalledWith('emp-1');
  });
});
