// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useHolidayCredits, HolidayCredit } from '../hooks/useHolidayCredits';
import { ShiftGrid } from '../components/ShiftGrid';
import { MobileDayScheduleView } from '../components/MobileDayScheduleView';
import { DialogProvider } from '../contexts/DialogContext';
import { Employee, Holiday, MonthYear } from '../types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function HookHarness({
  employees,
  customHolidays,
  year,
  validatedMonths,
  onResult,
}: {
  employees: Employee[];
  customHolidays: Holiday[];
  year: number;
  validatedMonths: Record<string, boolean>;
  onResult: (res: Record<string, HolidayCredit[]>) => void;
}) {
  const res = useHolidayCredits(employees, customHolidays, year, undefined, [], validatedMonths);
  React.useEffect(() => {
    onResult(res);
  }, [res, onResult]);
  return null;
}

describe('Lógica de Créditos de Feriados e Exibição de FF', () => {
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

  const makeEmp = (id: string, name: string, shiftsOct: Employee['shifts']['2026-10']): Employee => ({
    id,
    name,
    cargo: 'Vendas',
    status: 'active',
    statusColor: '#ff8400',
    workPeriod: '10h às 18h20',
    preferredDayOff: 'Segunda-feira',
    shiftName: 'Abertura',
    isYoungApprentice: false,
    shifts: { '2026-10': shiftsOct },
    dailyHours: {},
  });

  const holidayOct12: Holiday = {
    id: 'h-12-10',
    date: '2026-10-12',
    name: 'Nossa Senhora Aparecida',
    type: 'national',
    recurring: false,
  };

  it('1. Só gera crédito para quem trabalhou no feriado e reflete alterações na escala (T -> F e F -> T)', async () => {
    // 12/10 é dayIdx 11
    const baseShiftsWorked = Array(31).fill('T');
    const baseShiftsOff = Array(31).fill('T');
    baseShiftsOff[11] = 'F'; // Não trabalhou em 12/10
    baseShiftsOff[19] = 'FF 2026-10-12'; // Mesmo que tenha um FF órfão na grade!

    let latest: Record<string, HolidayCredit[]> = {};
    const onResult = vi.fn((r: Record<string, HolidayCredit[]>) => {
      latest = r;
    });

    const empWorked = makeEmp('emp-w', 'Ana Trabalhou', baseShiftsWorked);
    const empOff = makeEmp('emp-f', 'Bruno Folgou', baseShiftsOff);

    await act(async () => {
      root.render(
        <HookHarness
          employees={[empWorked, empOff]}
          customHolidays={[holidayOct12]}
          year={2026}
          validatedMonths={{ '2026-10': true }}
          onResult={onResult}
        />
      );
    });

    expect(latest['emp-w']).toHaveLength(1);
    expect(latest['emp-w'][0].status).toBe('pending');
    expect(latest['emp-f']).toHaveLength(0);

    // Simula alteração na escala: Ana passa a folgar (F) em 12/10 e Bruno passa a trabalhar (T) em 12/10
    const alteredWorked = [...baseShiftsWorked];
    alteredWorked[11] = 'F';
    const alteredOff = [...baseShiftsOff];
    alteredOff[11] = 'T';

    await act(async () => {
      root.render(
        <HookHarness
          employees={[
            makeEmp('emp-w', 'Ana Trabalhou', alteredWorked),
            makeEmp('emp-f', 'Bruno Folgou', alteredOff),
          ]}
          customHolidays={[holidayOct12]}
          year={2026}
          validatedMonths={{ '2026-10': true }}
          onResult={onResult}
        />
      );
    });

    // Ana perdeu o crédito imediatamente após a alteração, e Bruno passou a ter crédito agendado!
    expect(latest['emp-w']).toHaveLength(0);
    expect(latest['emp-f']).toHaveLength(1);
    expect(latest['emp-f'][0].holidayDate).toBe('2026-10-12');
    expect(latest['emp-f'][0].offDate).toBe('2026-10-20');
  });

  it('2. Casa corretamente formato legado FF DD/MM (ex.: FF 12/10) com feriado trabalhado 2026-10-12', async () => {
    const shifts = Array(31).fill('T');
    shifts[19] = 'FF 12/10';

    let latest: Record<string, HolidayCredit[]> = {};
    await act(async () => {
      root.render(
        <HookHarness
          employees={[makeEmp('emp-ddmm', 'Carla DDMM', shifts)]}
          customHolidays={[holidayOct12]}
          year={2026}
          validatedMonths={{ '2026-10': true }}
          onResult={(r) => {
            latest = r;
          }}
        />
      );
    });

    expect(latest['emp-ddmm']).toHaveLength(1);
    expect(latest['emp-ddmm'][0].offDate).toBe('2026-10-20');
    expect(latest['emp-ddmm'][0].status).not.toBe('pending');
  });

  it('3. ShiftGrid só exibe opção Folga Feriado (FF) para quem possui crédito pendente de feriado trabalhado', async () => {
    const currentMY: MonthYear = { month: 9, year: 2026 };
    const empWithCredit = makeEmp('emp-c', 'Com Crédito', Array(31).fill('T'));
    const empWithoutCredit = makeEmp('emp-n', 'Sem Crédito', Array(31).fill('T'));

    const holidayCredits: Record<string, HolidayCredit[]> = {
      'emp-c': [
        {
          id: '2026-10-12',
          holidayDate: '2026-10-12',
          holidayName: 'Nossa Senhora Aparecida',
          status: 'pending',
        },
      ],
      'emp-n': [],
    };

    await act(async () => {
      root.render(
        <DialogProvider>
          <ShiftGrid
            employees={[empWithCredit, empWithoutCredit]}
            currentMY={currentMY}
            today={new Date(2026, 9, 15)}
            selectedDayIdx={14}
            filter="ALL"
            isEditable={true}
            onFilterChange={vi.fn()}
            resolvedPositions={{}}
            customHolidays={[holidayOct12]}
            holidayCredits={holidayCredits}
            onUpdateShift={vi.fn()}
            onUpdateShifts={vi.fn()}
            onUpdateEmployeeDailyHour={vi.fn()}
            onUpdateTacticalPosition={vi.fn()}
            onOpenEmployeeCard={vi.fn()}
          />
        </DialogProvider>
      );
    });

    const rows = Array.from(container.querySelectorAll('tbody tr'));
    const rowWithCredit = rows.find(r => r.textContent?.includes('Com Crédito'));
    const rowWithoutCredit = rows.find(r => r.textContent?.includes('Sem Crédito'));

    expect(rowWithCredit).toBeDefined();
    expect(rowWithoutCredit).toBeDefined();

    // Na linha de quem trabalhou no feriado, deve existir a opção FF específica
    const optionsWith = Array.from(rowWithCredit!.querySelectorAll('option')).map(o => o.value);
    expect(optionsWith.some(v => v.startsWith('FF'))).toBe(true);

    // Na linha de quem NÃO trabalhou no feriado, NÃO deve existir nenhuma opção FF
    const optionsWithout = Array.from(rowWithoutCredit!.querySelectorAll('option')).map(o => o.value);
    expect(optionsWithout.some(v => v.startsWith('FF'))).toBe(false);
  });

  it('4. MobileDayScheduleView só exibe botão FF no modal rápido quando o colaborador tem crédito pendente', async () => {
    const empWith = makeEmp('emp-m1', 'Maria Com Crédito', Array(31).fill('T'));
    const empWithout = makeEmp('emp-m2', 'Pedro Sem Crédito', Array(31).fill('T'));

    const holidayCredits: Record<string, HolidayCredit[]> = {
      'emp-m1': [
        {
          id: '2026-10-12',
          holidayDate: '2026-10-12',
          holidayName: 'Nossa Senhora Aparecida',
          status: 'pending',
        },
      ],
      'emp-m2': [],
    };

    await act(async () => {
      root.render(
        <MobileDayScheduleView
          employees={[empWith, empWithout]}
          currentMY={{ month: 9, year: 2026 }}
          selectedDayIdx={14}
          monthKey="2026-10"
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
          holidayCredits={holidayCredits}
        />
      );
    });

    // Abre quick-edit de Pedro (sem crédito)
    const cards = Array.from(container.querySelectorAll('div.cursor-pointer'));
    const mariaCard = cards.find(c => c.textContent?.includes('Maria'));
    const pedroCard = cards.find(c => c.textContent?.includes('Pedro'));
    expect(mariaCard).toBeDefined();
    expect(pedroCard).toBeDefined();

    // Clica no card de Pedro (sem crédito)
    await act(async () => {
      (pedroCard as HTMLElement).click();
    });
    expect(container.textContent).not.toContain('Folga Feriado');

    // Fecha modal e clica no card de Maria (com crédito)
    const closeModalBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('close'));
    await act(async () => {
      closeModalBtn?.click();
    });
    await act(async () => {
      (mariaCard as HTMLElement).click();
    });
    expect(container.textContent).toContain('Folga Feriado');
  });
});
