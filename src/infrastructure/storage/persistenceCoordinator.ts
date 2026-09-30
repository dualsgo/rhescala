import { 
  Employee, 
  Holiday, 
  JornadaSettings, 
  OfficialScheduleSnapshot, 
  ProtectedDaysMap, 
  AuditLogEntry 
} from '../../../types';
import { STORAGE_KEYS, BROADCAST_CHANNELS } from './storageKeys';
import { apiStore, getConfiguredApiUrl } from '../../gas-api';
import { globalSyncQueue } from '../sync/syncQueue';

export interface PersistencePayload {
  employees: Employee[];
  jornadaSettings: JornadaSettings;
  customHolidays: Holiday[];
  deletedNationalHolidays: string[];
  monthNotes: Record<string, string>;
  trackingStartDate: string;
  officialSnapshots: Record<string, OfficialScheduleSnapshot>;
  protectedDaysMap: ProtectedDaysMap;
  sectionAssignments: Record<string, unknown>;
  validatedMonths: Record<string, boolean>;
  auditLogs: AuditLogEntry[];
}

/**
 * Grava imediatamente todos os dados da aplicação no localStorage síncrono
 * para proteção instantânea contra perda de dados.
 */
export function flushLocalStorage(payload: PersistencePayload): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(payload.employees));
    window.localStorage.setItem(STORAGE_KEYS.jornadaSettings, JSON.stringify(payload.jornadaSettings));
    window.localStorage.setItem(STORAGE_KEYS.customHolidays, JSON.stringify(payload.customHolidays));
    window.localStorage.setItem(STORAGE_KEYS.deletedNationalHolidays, JSON.stringify(payload.deletedNationalHolidays));
    window.localStorage.setItem(STORAGE_KEYS.monthNotes, JSON.stringify(payload.monthNotes));
    window.localStorage.setItem(STORAGE_KEYS.trackingStart, JSON.stringify(payload.trackingStartDate));
    window.localStorage.setItem(STORAGE_KEYS.officialSnapshots, JSON.stringify(payload.officialSnapshots));
    window.localStorage.setItem(STORAGE_KEYS.protectedDays, JSON.stringify(payload.protectedDaysMap));
    window.localStorage.setItem(STORAGE_KEYS.sectionAssignments, JSON.stringify(payload.sectionAssignments));
    window.localStorage.setItem(STORAGE_KEYS.validatedMonths, JSON.stringify(payload.validatedMonths));
    window.localStorage.setItem(STORAGE_KEYS.auditLogs, JSON.stringify(payload.auditLogs));
  } catch (err) {
    console.error('[persistenceCoordinator] Erro ao gravar no localStorage:', err);
    throw err;
  }
}

/**
 * Notifica outras abas abertas no mesmo navegador através de canais BroadcastChannel.
 */
export function broadcastPersistenceSync(payload: PersistencePayload): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;

  try {
    new BroadcastChannel(BROADCAST_CHANNELS.employeesSync).postMessage(payload.employees);
    new BroadcastChannel(BROADCAST_CHANNELS.validatedMonthsSync).postMessage(payload.validatedMonths);
  } catch (err) {
    console.warn('[persistenceCoordinator] Aviso ao transmitir via BroadcastChannel:', err);
  }
}

export interface CloudSyncResult {
  total: number;
  succeeded: number;
  failed: number;
  failedKeys: string[];
  errors: Array<{ key: string; error: unknown }>;
  skipped?: boolean;
}

export interface ManualSaveResult {
  localSuccess: boolean;
  cloudResult: CloudSyncResult;
}

export type SaveFeedbackStatus = 'full_success' | 'local_only' | 'partial_failure';

export interface SaveFeedback {
  status: SaveFeedbackStatus;
  title?: string;
  message?: string;
}

/**
 * Avalia o resultado do salvamento manual e define o feedback semântico adequado para a UI.
 */
export function determineSaveFeedback(saveResult: ManualSaveResult): SaveFeedback {
  if (saveResult.cloudResult.skipped) {
    return {
      status: 'local_only',
      title: 'Salvo Apenas Localmente',
      message: 'As alterações foram salvas no cache local deste navegador, mas a sincronização com a planilha não foi executada (URL não configurada). Será necessário sincronizar posteriormente.'
    };
  }

  if (saveResult.cloudResult.failed > 0) {
    return {
      status: 'partial_failure',
      title: 'Aviso de Sincronização',
      message: `Salvo localmente, mas ${saveResult.cloudResult.failed} item(ns) não puderam ser sincronizados com a planilha/servidor.`
    };
  }

  return {
    status: 'full_success'
  };
}

/**
 * Envia o lote de dados para a nuvem GAS caso a URL esteja configurada.
 * Utiliza globalSyncQueue para garantir que as 10 operações sejam executadas
 * estritamente em série, sem atropelar outros sincronismos e sem sobrecarregar o GAS.
 * Mantém Promise.allSettled para tolerância a falhas parciais e retorna o relatório estruturado.
 */
export async function flushCloudStorage(payload: PersistencePayload): Promise<CloudSyncResult> {
  const url = getConfiguredApiUrl();
  if (!url) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      failedKeys: [],
      errors: [],
      skipped: true
    };
  }

  const items: Array<{ key: string; task: () => Promise<void> }> = [
    { key: STORAGE_KEYS.employees, task: () => apiStore.set(STORAGE_KEYS.employees, payload.employees) },
    { key: STORAGE_KEYS.validatedMonths, task: () => apiStore.set(STORAGE_KEYS.validatedMonths, payload.validatedMonths) },
    { key: STORAGE_KEYS.protectedDays, task: () => apiStore.set(STORAGE_KEYS.protectedDays, payload.protectedDaysMap) },
    { key: STORAGE_KEYS.monthNotes, task: () => apiStore.set(STORAGE_KEYS.monthNotes, payload.monthNotes) },
    { key: STORAGE_KEYS.officialSnapshots, task: () => apiStore.set(STORAGE_KEYS.officialSnapshots, payload.officialSnapshots) },
    { key: STORAGE_KEYS.customHolidays, task: () => apiStore.set(STORAGE_KEYS.customHolidays, payload.customHolidays) },
    { key: STORAGE_KEYS.deletedNationalHolidays, task: () => apiStore.set(STORAGE_KEYS.deletedNationalHolidays, payload.deletedNationalHolidays) },
    { key: STORAGE_KEYS.jornadaSettings, task: () => apiStore.set(STORAGE_KEYS.jornadaSettings, payload.jornadaSettings) },
    { key: STORAGE_KEYS.sectionAssignments, task: () => apiStore.set(STORAGE_KEYS.sectionAssignments, payload.sectionAssignments) },
    { key: STORAGE_KEYS.auditLogs, task: () => apiStore.set(STORAGE_KEYS.auditLogs, payload.auditLogs) }
  ];

  const results = await Promise.allSettled(items.map(item => globalSyncQueue.enqueue(item.task)));

  const failedKeys: string[] = [];
  const errors: Array<{ key: string; error: unknown }> = [];
  let succeeded = 0;

  results.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      succeeded++;
    } else {
      failedKeys.push(items[idx].key);
      errors.push({ key: items[idx].key, error: res.reason });
    }
  });

  return {
    total: items.length,
    succeeded,
    failed: failedKeys.length,
    failedKeys,
    errors,
    skipped: false
  };
}

/**
 * Orquestra o ciclo completo de salvamento manual:
 * 1. Gravação síncrona no localStorage
 * 2. Transmissão imediata via BroadcastChannel
 * 3. Envio para a nuvem GAS (se configurada)
 */
export async function executeManualSave(payload: PersistencePayload): Promise<ManualSaveResult> {
  flushLocalStorage(payload);
  broadcastPersistenceSync(payload);
  const cloudResult = await flushCloudStorage(payload);
  return {
    localSuccess: true,
    cloudResult
  };
}
