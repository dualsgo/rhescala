// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useLocalStorage, hasPendingCloudSync, markKeyDirty } from '../hooks/useLocalStorage';
import { apiStore } from '../src/gas-api';
import { flushCloudStorage, PersistencePayload } from '../src/infrastructure/storage/persistenceCoordinator';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Mecanismos de Proteção de Dados e Salvamento', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    markKeyDirty('test_protection_key', false);
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

  it('rastreia alterações pendentes em hasPendingCloudSync e emite local-storage-error se localStorage falhar', async () => {
    vi.spyOn(apiStore, 'get').mockResolvedValue(null);
    vi.spyOn(apiStore, 'set').mockResolvedValue(undefined);

    const storageErrors: string[] = [];
    const onStorageErr = (e: Event) => {
      storageErrors.push((e as CustomEvent<{ key: string }>).detail.key);
    };
    window.addEventListener('local-storage-error', onStorageErr);

    let setFn: ((v: string[]) => void) | null = null;
    function Harness() {
      const [val, setVal] = useLocalStorage<string[]>('test_protection_key', []);
      setFn = setVal;
      return <div>{val.join(',')}</div>;
    }

    await act(async () => {
      root.render(<Harness />);
    });

    // Simula QuotaExceededError no localStorage.setItem
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    await act(async () => {
      setFn!(['item-1']);
    });

    expect(hasPendingCloudSync()).toBe(true);
    expect(storageErrors).toContain('test_protection_key');

    setItemSpy.mockRestore();
    window.removeEventListener('local-storage-error', onStorageErr);
  });

  it('apiStore.set detecta erro lógico em resposta 200 JSON do GAS e rejeita a Promise', async () => {
    window.localStorage.setItem('escala_gas_api_url', 'https://script.google.com/macros/s/fake/exec');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      statusText: 'OK',
      text: async () => JSON.stringify({ success: false, error: 'Planilha protegida' }),
    } as Response);

    await expect(apiStore.set('k', { a: 1 })).rejects.toThrow('Planilha protegida');
  });

  it('flushCloudStorage emite sync-update não-silencioso para acionar o SyncBlockingOverlay durante salvamento manual', async () => {
    window.localStorage.setItem('escala_gas_api_url', 'https://script.google.com/macros/s/fake/exec');
    vi.spyOn(apiStore, 'set').mockResolvedValue(undefined);

    const events: Array<{ state: string; isSilent?: boolean }> = [];
    const listener = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      events.push({ state: detail.state, isSilent: detail.isSilent });
    };
    window.addEventListener('sync-update', listener);

    const payload: PersistencePayload = {
      employees: [],
      jornadaSettings: DEFAULT_JORNADA_SETTINGS,
      customHolidays: [],
      deletedNationalHolidays: [],
      monthNotes: {},
      trackingStartDate: '2026-01-01',
      officialSnapshots: {},
      protectedDaysMap: {},
      sectionAssignments: {},
      validatedMonths: {},
      auditLogs: [],
    };

    const res = await flushCloudStorage(payload);
    window.removeEventListener('sync-update', listener);

    expect(res.failed).toBe(0);
    expect(events.some(ev => ev.state === 'syncing' && ev.isSilent === false)).toBe(true);
    expect(events.some(ev => ev.state === 'synced' && ev.isSilent === false)).toBe(true);
  });
});
