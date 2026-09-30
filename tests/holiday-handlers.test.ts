// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React, { useState, act } from 'react';
import { createRoot } from 'react-dom/client';
import { useHolidayHandlers, UseHolidayHandlersReturn } from '../hooks/useHolidayHandlers';
import { Holiday } from '../types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useHolidayHandlers', () => {
  function mountHook(initialCustom: Holiday[] = [], initialDeleted: string[] = []) {
    let hookResult!: UseHolidayHandlersReturn;
    let customHolidaysState!: Holiday[];
    let deletedNationalState!: string[];

    function TestComponent() {
      const [customHolidays, setCustomHolidays] = useState<Holiday[]>(initialCustom);
      const [deletedNationalHolidays, setDeletedNationalHolidays] = useState<string[]>(initialDeleted);

      customHolidaysState = customHolidays;
      deletedNationalState = deletedNationalHolidays;

      hookResult = useHolidayHandlers({
        setCustomHolidays,
        setDeletedNationalHolidays,
      });

      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);

    return {
      render: async () => {
        await act(async () => {
          root.render(React.createElement(TestComponent));
        });
        return {
          getHook: () => hookResult,
          getCustomHolidays: () => customHolidaysState,
          getDeletedNational: () => deletedNationalState,
        };
      },
      cleanup: () => root.unmount(),
    };
  }

  it('onAddHoliday deve gerar um ID único e incluir o feriado em customHolidays', async () => {
    const helper = mountHook();
    const env = await helper.render();

    await act(async () => {
      env.getHook().onAddHoliday({
        date: '2026-10-25',
        name: 'Feriado Municipal de Teste',
        type: 'municipal',
        recurring: false,
      });
    });

    const list = env.getCustomHolidays();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Feriado Municipal de Teste');
    expect(list[0].date).toBe('2026-10-25');
    expect(list[0].id).toBeDefined();
    expect(typeof list[0].id).toBe('string');
    expect(env.getDeletedNational()).toEqual([]);

    helper.cleanup();
  });

  it('onRemoveHoliday com ID de feriado nacional deve adicioná-lo em deletedNationalHolidays', async () => {
    const helper = mountHook();
    const env = await helper.render();

    await act(async () => {
      env.getHook().onRemoveHoliday('national-tiradentes');
    });

    expect(env.getDeletedNational()).toContain('national-tiradentes');
    expect(env.getCustomHolidays()).toEqual([]);

    helper.cleanup();
  });

  it('onRemoveHoliday com ID de feriado customizado deve filtrá-lo de customHolidays', async () => {
    const initialHoliday: Holiday = {
      id: 'cust-1',
      name: 'Aniversário da Cidade',
      date: '2026-08-15',
      type: 'municipal',
      recurring: false,
    };

    const helper = mountHook([initialHoliday]);
    const env = await helper.render();

    expect(env.getCustomHolidays().length).toBe(1);

    await act(async () => {
      env.getHook().onRemoveHoliday('cust-1');
    });

    expect(env.getCustomHolidays()).toEqual([]);
    expect(env.getDeletedNational()).toEqual([]);

    helper.cleanup();
  });

  it('onEditHoliday em feriado nacional deve excluí-lo dos nacionais e criar um novo feriado customizado', async () => {
    const helper = mountHook();
    const env = await helper.render();

    await act(async () => {
      env.getHook().onEditHoliday('national-finados', {
        name: 'Finados (Horário Especial)',
        date: '2026-11-02',
        type: 'national',
        recurring: true,
      });
    });

    expect(env.getDeletedNational()).toContain('national-finados');
    const custom = env.getCustomHolidays();
    expect(custom.length).toBe(1);
    expect(custom[0].name).toBe('Finados (Horário Especial)');
    expect(custom[0].id).not.toBe('national-finados');

    helper.cleanup();
  });

  it('onEditHoliday em feriado customizado deve atualizar o registro correspondente in-place', async () => {
    const initialHoliday: Holiday = {
      id: 'cust-99',
      name: 'Nome Antigo',
      date: '2026-06-24',
      type: 'state',
      recurring: false,
    };

    const helper = mountHook([initialHoliday]);
    const env = await helper.render();

    await act(async () => {
      env.getHook().onEditHoliday('cust-99', {
        name: 'São João',
        date: '2026-06-24',
        type: 'state',
        recurring: false,
      });
    });

    const custom = env.getCustomHolidays();
    expect(custom.length).toBe(1);
    expect(custom[0].id).toBe('cust-99');
    expect(custom[0].name).toBe('São João');
    expect(env.getDeletedNational()).toEqual([]);

    helper.cleanup();
  });
});
