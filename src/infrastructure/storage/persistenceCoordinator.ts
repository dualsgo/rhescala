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

/**
 * Envia o lote de dados para a nuvem GAS caso a URL esteja configurada.
 * Utiliza globalSyncQueue para garantir que as 10 operações sejam executadas
 * estritamente em série, sem atropelar outros sincronismos e sem sobrecarregar o GAS.
 * Mantém Promise.allSettled para tolerância a falhas parciais.
 */
export async function flushCloudStorage(payload: PersistencePayload): Promise<void> {
  const url = getConfiguredApiUrl();
  if (!url) return;

  const tasks: (() => Promise<void>)[] = [
    () => apiStore.set(STORAGE_KEYS.employees, payload.employees),
    () => apiStore.set(STORAGE_KEYS.validatedMonths, payload.validatedMonths),
    () => apiStore.set(STORAGE_KEYS.protectedDays, payload.protectedDaysMap),
    () => apiStore.set(STORAGE_KEYS.monthNotes, payload.monthNotes),
    () => apiStore.set(STORAGE_KEYS.officialSnapshots, payload.officialSnapshots),
    () => apiStore.set(STORAGE_KEYS.customHolidays, payload.customHolidays),
    () => apiStore.set(STORAGE_KEYS.deletedNationalHolidays, payload.deletedNationalHolidays),
    () => apiStore.set(STORAGE_KEYS.jornadaSettings, payload.jornadaSettings),
    () => apiStore.set(STORAGE_KEYS.sectionAssignments, payload.sectionAssignments),
    () => apiStore.set(STORAGE_KEYS.auditLogs, payload.auditLogs)
  ];

  await Promise.allSettled(tasks.map(task => globalSyncQueue.enqueue(task)));
}

/**
 * Orquestra o ciclo completo de salvamento manual:
 * 1. Gravação síncrona no localStorage
 * 2. Transmissão imediata via BroadcastChannel
 * 3. Envio para a nuvem GAS (se configurada)
 */
export async function executeManualSave(payload: PersistencePayload): Promise<void> {
  flushLocalStorage(payload);
  broadcastPersistenceSync(payload);
  await flushCloudStorage(payload);
}
