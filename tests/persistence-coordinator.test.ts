// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  flushLocalStorage, 
  broadcastPersistenceSync, 
  flushCloudStorage, 
  executeManualSave, 
  determineSaveFeedback,
  ManualSaveResult,
  PersistencePayload 
} from '../src/infrastructure/storage/persistenceCoordinator';
import { STORAGE_KEYS, BROADCAST_CHANNELS } from '../src/infrastructure/storage/storageKeys';
import { apiStore } from '../src/gas-api';
import { DEFAULT_JORNADA_SETTINGS } from '../src/engine/config/schedule-constants';
import { createTestEmployee } from './fixtures';

describe('persistenceCoordinator', () => {
  const dummyPayload: PersistencePayload = {
    employees: [createTestEmployee({ id: 'emp-1', name: 'Maria' })],
    jornadaSettings: DEFAULT_JORNADA_SETTINGS,
    customHolidays: [],
    deletedNationalHolidays: ['2026-01-01'],
    monthNotes: { '2026-10': 'Nota de teste' },
    trackingStartDate: '2026-01-01',
    officialSnapshots: {},
    protectedDaysMap: { '2026-10': { 12: 0 } },
    sectionAssignments: {},
    validatedMonths: { '2026-10': true },
    auditLogs: []
  };

  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('flushLocalStorage deve gravar todas as 11 chaves com JSON válido', () => {
    flushLocalStorage(dummyPayload);

    expect(window.localStorage.getItem(STORAGE_KEYS.employees)).toBe(JSON.stringify(dummyPayload.employees));
    expect(window.localStorage.getItem(STORAGE_KEYS.jornadaSettings)).toBe(JSON.stringify(dummyPayload.jornadaSettings));
    expect(window.localStorage.getItem(STORAGE_KEYS.customHolidays)).toBe(JSON.stringify(dummyPayload.customHolidays));
    expect(window.localStorage.getItem(STORAGE_KEYS.deletedNationalHolidays)).toBe(JSON.stringify(dummyPayload.deletedNationalHolidays));
    expect(window.localStorage.getItem(STORAGE_KEYS.monthNotes)).toBe(JSON.stringify(dummyPayload.monthNotes));
    expect(window.localStorage.getItem(STORAGE_KEYS.trackingStart)).toBe(JSON.stringify(dummyPayload.trackingStartDate));
    expect(window.localStorage.getItem(STORAGE_KEYS.officialSnapshots)).toBe(JSON.stringify(dummyPayload.officialSnapshots));
    expect(window.localStorage.getItem(STORAGE_KEYS.protectedDays)).toBe(JSON.stringify(dummyPayload.protectedDaysMap));
    expect(window.localStorage.getItem(STORAGE_KEYS.sectionAssignments)).toBe(JSON.stringify(dummyPayload.sectionAssignments));
    expect(window.localStorage.getItem(STORAGE_KEYS.validatedMonths)).toBe(JSON.stringify(dummyPayload.validatedMonths));
    expect(window.localStorage.getItem(STORAGE_KEYS.auditLogs)).toBe(JSON.stringify(dummyPayload.auditLogs));
  });

  it('broadcastPersistenceSync deve postar nos canais de colaboradores e meses validados', () => {
    const postMessageSpy = vi.fn();
    const originalBroadcastChannel = window.BroadcastChannel;

    // Mock do BroadcastChannel
    class MockBroadcastChannel {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      postMessage(msg: unknown) {
        postMessageSpy(this.name, msg);
      }
      close() {}
    }
    (window as unknown as { BroadcastChannel: typeof MockBroadcastChannel }).BroadcastChannel = MockBroadcastChannel;

    try {
      broadcastPersistenceSync(dummyPayload);

      expect(postMessageSpy).toHaveBeenCalledWith(BROADCAST_CHANNELS.employeesSync, dummyPayload.employees);
      expect(postMessageSpy).toHaveBeenCalledWith(BROADCAST_CHANNELS.validatedMonthsSync, dummyPayload.validatedMonths);
    } finally {
      window.BroadcastChannel = originalBroadcastChannel;
    }
  });

  it('flushCloudStorage não deve chamar apiStore.set se URL do GAS não estiver configurada', async () => {
    const apiSetSpy = vi.spyOn(apiStore, 'set').mockResolvedValue(undefined);
    window.localStorage.removeItem(STORAGE_KEYS.gasApiUrl);

    const result = await flushCloudStorage(dummyPayload);
    expect(apiSetSpy).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
    expect(result.total).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('flushCloudStorage deve enviar 10 chaves para a nuvem quando a URL estiver configurada e retornar sucesso total', async () => {
    window.localStorage.setItem(STORAGE_KEYS.gasApiUrl, 'https://script.google.com/macros/s/test/exec');
    const apiSetSpy = vi.spyOn(apiStore, 'set').mockResolvedValue(undefined);

    const result = await flushCloudStorage(dummyPayload);

    expect(apiSetSpy).toHaveBeenCalledTimes(10);
    expect(apiSetSpy).toHaveBeenCalledWith(STORAGE_KEYS.employees, dummyPayload.employees);
    expect(apiSetSpy).toHaveBeenCalledWith(STORAGE_KEYS.validatedMonths, dummyPayload.validatedMonths);
    expect(apiSetSpy).toHaveBeenCalledWith(STORAGE_KEYS.protectedDays, dummyPayload.protectedDaysMap);
    expect(apiSetSpy).toHaveBeenCalledWith(STORAGE_KEYS.monthNotes, dummyPayload.monthNotes);
    expect(apiSetSpy).toHaveBeenCalledWith(STORAGE_KEYS.officialSnapshots, dummyPayload.officialSnapshots);
    expect(apiSetSpy).toHaveBeenCalledWith(STORAGE_KEYS.customHolidays, dummyPayload.customHolidays);
    expect(apiSetSpy).toHaveBeenCalledWith(STORAGE_KEYS.deletedNationalHolidays, dummyPayload.deletedNationalHolidays);
    expect(apiSetSpy).toHaveBeenCalledWith(STORAGE_KEYS.jornadaSettings, dummyPayload.jornadaSettings);
    expect(apiSetSpy).toHaveBeenCalledWith(STORAGE_KEYS.sectionAssignments, dummyPayload.sectionAssignments);
    expect(apiSetSpy).toHaveBeenCalledWith(STORAGE_KEYS.auditLogs, dummyPayload.auditLogs);

    expect(result.total).toBe(10);
    expect(result.succeeded).toBe(10);
    expect(result.failed).toBe(0);
    expect(result.failedKeys).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('flushCloudStorage deve retornar falha parcial estruturada sem lançar exceção quando 1 ou mais chaves falham', async () => {
    window.localStorage.setItem(STORAGE_KEYS.gasApiUrl, 'https://script.google.com/macros/s/test/exec');
    vi.spyOn(apiStore, 'set').mockImplementation(async (key) => {
      if (key === STORAGE_KEYS.employees || key === STORAGE_KEYS.auditLogs) {
        throw new Error(`Timeout ao sincronizar ${key}`);
      }
      return undefined;
    });

    const result = await flushCloudStorage(dummyPayload);

    expect(result.total).toBe(10);
    expect(result.succeeded).toBe(8);
    expect(result.failed).toBe(2);
    expect(result.failedKeys).toEqual([STORAGE_KEYS.employees, STORAGE_KEYS.auditLogs]);
    expect(result.errors).toHaveLength(2);
    expect((result.errors[0].error as Error).message).toContain(STORAGE_KEYS.employees);
    expect((result.errors[1].error as Error).message).toContain(STORAGE_KEYS.auditLogs);
  });

  it('executeManualSave deve orquestrar localStorage, broadcast e retornar resultado estruturado', async () => {
    window.localStorage.setItem(STORAGE_KEYS.gasApiUrl, 'https://script.google.com/macros/s/test/exec');
    const apiSetSpy = vi.spyOn(apiStore, 'set').mockResolvedValue(undefined);

    const result = await executeManualSave(dummyPayload);

    // 1. Verificou gravação local
    expect(window.localStorage.getItem(STORAGE_KEYS.employees)).toBeDefined();
    // 2. Verificou chamada de rede
    expect(apiSetSpy).toHaveBeenCalledTimes(10);
    // 3. Verificou retorno estruturado
    expect(result.localSuccess).toBe(true);
    expect(result.cloudResult.succeeded).toBe(10);
    expect(result.cloudResult.failed).toBe(0);
  });

  describe('determineSaveFeedback (Correção Semântica do Feedback)', () => {
    it('1. skipped === true não produz feedback full_success (Salvo na Planilha)', () => {
      const offlineResult: ManualSaveResult = {
        localSuccess: true,
        cloudResult: {
          total: 0,
          succeeded: 0,
          failed: 0,
          failedKeys: [],
          errors: [],
          skipped: true
        }
      };

      const feedback = determineSaveFeedback(offlineResult);

      expect(feedback.status).toBe('local_only');
      expect(feedback.status).not.toBe('full_success');
      expect(feedback.title).toBe('Salvo Apenas Localmente');
      expect(feedback.message).toContain('sincronizar posteriormente');
      expect(feedback.message).not.toContain('Salvo na Planilha');
    });

    it('2. sincronização remota com 100% de sucesso produz status full_success', () => {
      const fullSuccessResult: ManualSaveResult = {
        localSuccess: true,
        cloudResult: {
          total: 10,
          succeeded: 10,
          failed: 0,
          failedKeys: [],
          errors: [],
          skipped: false
        }
      };

      const feedback = determineSaveFeedback(fullSuccessResult);

      expect(feedback.status).toBe('full_success');
    });

    it('3. falha parcial remota produz status partial_failure com quantidade de itens', () => {
      const partialFailureResult: ManualSaveResult = {
        localSuccess: true,
        cloudResult: {
          total: 10,
          succeeded: 8,
          failed: 2,
          failedKeys: [STORAGE_KEYS.employees, STORAGE_KEYS.auditLogs],
          errors: [],
          skipped: false
        }
      };

      const feedback = determineSaveFeedback(partialFailureResult);

      expect(feedback.status).toBe('partial_failure');
      expect(feedback.message).toContain('2 item(ns) não puderam ser sincronizados');
    });
  });

  describe('Falha Real de flushLocalStorage (Problema 2)', () => {
    it('falha real ao gravar no localStorage lança exceção e impede que seja dado como salvo', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      expect(() => flushLocalStorage(dummyPayload)).toThrow(DOMException);
      setItemSpy.mockRestore();
    });
  });
});
