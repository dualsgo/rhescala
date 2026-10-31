// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useState, act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ShiftGrid } from '../components/ShiftGrid';
import { MobileFilterDrawer } from '../components/MobileFilterDrawer';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';
import { createTestEmployee } from './fixtures';
import { useScheduleFilters } from '../hooks/useScheduleFilters';
import { resolveEffectiveShift } from '../hooks/useScheduleEngine';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Filtro "Somente quem está trabalhando" (ocultar folgas ao selecionar um dia)', () => {
  let container: HTMLDivElement;
  let root: Root;

  // Mês no passado recente para garantir que dias passados também sejam clicáveis na seleção
  const currentMY = { month: 8, year: 2026 }; // Setembro 2026
  const monthKey = '2026-09';

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

  it('resolveEffectiveShift respeita precedência de vigência contratual, atestado e férias por período', () => {
    const emp = createTestEmployee({
      id: 'emp-prec',
      name: 'Mariana Costa',
      hiredAt: '2026-09-03',
      firedAt: '2026-09-25',
      atestadoStart: '2026-09-05',
      atestadoEnd: '2026-09-06',
      vacationStart: '2026-09-10',
      vacationEnd: '2026-09-15',
      shifts: {
        [monthKey]: Array(30).fill('T'),
      },
    });

    expect(resolveEffectiveShift(emp, '2026-09-01', monthKey, 0)).toBe('N/A');
    expect(resolveEffectiveShift(emp, '2026-09-03', monthKey, 2)).toBe('T');
    expect(resolveEffectiveShift(emp, '2026-09-05', monthKey, 4)).toBe('AT');
    expect(resolveEffectiveShift(emp, '2026-09-12', monthKey, 11)).toBe('FE');
    expect(resolveEffectiveShift(emp, '2026-09-26', monthKey, 25)).toBe('N/A');
  });

  it('oculta na tabela (tbody) todos os colaboradores de folga/ausência no dia selecionado e atualiza ao clicar em outro dia', async () => {
    const employees = [
      createTestEmployee({
        id: 'emp-trab-d1',
        name: 'Ana Trabalha DiaUm',
        cargo: 'Caixa',
        shifts: { [monthKey]: ['T', 'F', 'T'] },
        dailyHours: { [monthKey]: ['10h às 18h20', 'Folga', '10h às 18h20'] },
      }),
      createTestEmployee({
        id: 'emp-folga-d1',
        name: 'Bruno Folga DiaUm',
        cargo: 'Vendas',
        shifts: { [monthKey]: ['F', 'T', 'T'] },
        dailyHours: { [monthKey]: ['Folga', '13h40 às 22h00', '13h40 às 22h00'] },
      }),
      createTestEmployee({
        id: 'emp-ff-d1',
        name: 'Carla FeriadoComp DiaUm',
        cargo: 'Vendas',
        shifts: { [monthKey]: ['FF 2026-09-07', 'T', 'F'] },
        dailyHours: { [monthKey]: ['Folga', '10h às 18h20', 'Folga'] },
      }),
      createTestEmployee({
        id: 'emp-curso-d1',
        name: 'Diego Aprendiz Curso',
        cargo: 'Apoio',
        isYoungApprentice: true,
        shifts: { [monthKey]: ['C', 'T', 'T'] },
        dailyHours: { [monthKey]: ['Curso', '14h às 18h', '14h às 18h'] },
      }),
      createTestEmployee({
        id: 'emp-ferias-periodo',
        name: 'Elena Ferias Periodo',
        cargo: 'Pacote',
        vacationStart: '2026-09-01',
        vacationEnd: '2026-09-10',
        // Mesmo que o array shifts tenha 'T', o período de férias sobrepõe para 'FE'
        shifts: { [monthKey]: ['T', 'T', 'T'] },
      }),
      createTestEmployee({
        id: 'emp-atestado-periodo',
        name: 'Fabio Atestado Periodo',
        cargo: 'Fiscal',
        atestadoStart: '2026-09-01',
        atestadoEnd: '2026-09-01',
        shifts: { [monthKey]: ['T', 'T', 'T'] },
      }),
    ];

    function StatefulGridHarness() {
      const [selectedDayIdx, setSelectedDayIdx] = useState(0); // Dia 1 selecionado inicialmente
      const filters = useScheduleFilters();

      return (
        <ShiftGrid
          employees={employees}
          currentMY={currentMY}
          selectedDayIdx={selectedDayIdx}
          onSelectDay={setSelectedDayIdx}
          customHolidays={[]}
          filter={filters.filter}
          onFilterChange={filters.setFilter}
          contractFilter={filters.contractFilter}
          onContractFilterChange={filters.setContractFilter}
          onlyWorkingToday={filters.onlyWorkingToday}
          onToggleOnlyWorkingToday={filters.toggleOnlyWorkingToday}
          selectedGroup={filters.selectedGroup}
          onSelectedGroupChange={filters.setSelectedGroup}
          isEditable={false} // Mesmo com edição travada, clicar nos dias deve funcionar!
          allowRetroactive={false}
          isReadOnly={false}
          diffs={[]}
          resolvedPositions={{}}
          onUpdateEmployeeDailyHour={vi.fn()}
          onUpdateTacticalPosition={vi.fn()}
          onOpenEmployeeCard={vi.fn()}
          jornadaSettings={DEFAULT_JORNADA_SETTINGS}
        />
      );
    }

    await act(async () => {
      root.render(<StatefulGridHarness />);
    });

    const getTbodyText = () => container.querySelector('tbody')?.textContent || '';

    // 1. Sem filtro ativo: todos os 6 colaboradores aparecem na grade
    expect(getTbodyText()).toContain('ANA');
    expect(getTbodyText()).toContain('BRUNO');
    expect(getTbodyText()).toContain('CARLA');
    expect(getTbodyText()).toContain('DIEGO');
    expect(getTbodyText()).toContain('ELENA');
    expect(getTbodyText()).toContain('FABIO');

    // 2. Clicar no botão rápido "Ocultar Folgas"
    const toggleWorkingBtn = container.querySelector(
      'button[aria-label="Filtrar somente quem está trabalhando no dia selecionado"]'
    ) as HTMLButtonElement;
    expect(toggleWorkingBtn).not.toBeNull();
    expect(toggleWorkingBtn.textContent).toContain('Ocultar Folgas');

    await act(async () => {
      toggleWorkingBtn.click();
    });

    // No Dia 1 (índice 0), somente ANA está trabalhando em loja ('T')
    expect(toggleWorkingBtn.textContent).toContain('Trabalhando (1)');
    expect(getTbodyText()).toContain('ANA');
    expect(getTbodyText()).not.toContain('BRUNO'); // F
    expect(getTbodyText()).not.toContain('CARLA'); // FF
    expect(getTbodyText()).not.toContain('DIEGO'); // C (curso externo)
    expect(getTbodyText()).not.toContain('ELENA'); // FE por período
    expect(getTbodyText()).not.toContain('FABIO'); // AT por período

    // 3. Clicar no cabeçalho da coluna do Dia 2 (mesmo sendo dia passado com isEditable=false)
    const dayHeaders = Array.from(container.querySelectorAll('thead th'));
    // dayHeaders[0] é "Colaborador", dayHeaders[1] é Dia 1, dayHeaders[2] é Dia 2
    const day2Header = dayHeaders[2] as HTMLTableCellElement;
    expect(day2Header).toBeDefined();
    expect(day2Header.className).not.toContain('pointer-events-none');

    await act(async () => {
      day2Header.click();
    });

    // No Dia 2 (índice 1):
    // - ANA está de folga ('F') -> oculta!
    // - ELENA continua em férias por período -> oculta!
    // - BRUNO ('T'), CARLA ('T'), DIEGO ('T'), FABIO ('T' pois atestado era só dia 1) -> visíveis (4)!
    expect(toggleWorkingBtn.textContent).toContain('Trabalhando (4)');
    expect(getTbodyText()).not.toContain('ANA');
    expect(getTbodyText()).not.toContain('ELENA');
    expect(getTbodyText()).toContain('BRUNO');
    expect(getTbodyText()).toContain('CARLA');
    expect(getTbodyText()).toContain('DIEGO');
    expect(getTbodyText()).toContain('FABIO');
  }, 15000);

  it('MobileFilterDrawer envia os identificadores canônicos de turno para setSelectedGroup', async () => {
    const setSelectedGroup = vi.fn();
    const setOnlyWorkingToday = vi.fn();

    await act(async () => {
      root.render(
        <MobileFilterDrawer
          isOpen={true}
          onClose={vi.fn()}
          onlyWorkingToday={false}
          setOnlyWorkingToday={setOnlyWorkingToday}
          selectedGroup={null}
          setSelectedGroup={setSelectedGroup}
          contractFilter="all"
          setContractFilter={vi.fn()}
          isCompactMode={false}
          setIsCompactMode={vi.fn()}
          hidePastDays={false}
          setHidePastDays={vi.fn()}
          isCurrentMonth={true}
          onResetFilters={vi.fn()}
        />
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const aberturaBtn = buttons.find((b) => b.textContent?.includes('Abertura (A)'));
    const folgasBtn = buttons.find((b) => b.textContent?.includes('Folgas no Dia'));

    expect(aberturaBtn).toBeDefined();
    expect(folgasBtn).toBeDefined();

    await act(async () => {
      aberturaBtn?.click();
    });
    expect(setSelectedGroup).toHaveBeenCalledWith('Abertura');

    await act(async () => {
      folgasBtn?.click();
    });
    expect(setSelectedGroup).toHaveBeenCalledWith('Folgas/Outros');
  });
});

