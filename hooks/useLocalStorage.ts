import { useState, useEffect, useRef } from 'react';
import { SyncState, SyncStatus, SyncHistoryItem } from '../types';

// URL DO SEU NOVO GOOGLE APPS SCRIPT
export const DB_API_URL = "https://script.google.com/macros/s/AKfycbzSumKHux0aYikTpcBznYN85r7wxRjCtWoO7MQ1CB5B0fETDmON05g466ufg65g8M7WRg/exec";

// Global state for sync status tracking
const GLOBAL_SYNC_STATUS: SyncStatus = {
    state: 'idle',
    history: []
};

// Global lock to prevent concurrent syncs (GAS limitation)
let isGlobalSyncing = false;
const syncQueue: Array<() => Promise<void>> = [];

async function processSyncQueue() {
    if (isGlobalSyncing || syncQueue.length === 0) return;
    isGlobalSyncing = true;
    const nextSync = syncQueue.shift();
    if (nextSync) {
        try {
            await nextSync();
        } finally {
            isGlobalSyncing = false;
            // Process next after a small gap to let GAS breathe
            setTimeout(processSyncQueue, 500);
        }
    }
}

function updateGlobalSync(state: SyncState, key: string, message?: string) {
    GLOBAL_SYNC_STATUS.state = state;
    if (state === 'synced') {
        GLOBAL_SYNC_STATUS.lastSync = new Date().toLocaleTimeString('pt-BR');
    }

    const newItem: SyncHistoryItem = {
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        state,
        key,
        message
    };

    // Maintain a max history of 15 items for better debugging
    GLOBAL_SYNC_STATUS.history = [newItem, ...GLOBAL_SYNC_STATUS.history].slice(0, 15);

    // Dispatch event for components
    window.dispatchEvent(new CustomEvent('sync-update', { detail: GLOBAL_SYNC_STATUS }));
}

export function useSyncStatus() {
    const [status, setStatus] = useState<SyncStatus>(GLOBAL_SYNC_STATUS);

    useEffect(() => {
        const handleUpdate = (e: any) => setStatus({ ...e.detail });
        window.addEventListener('sync-update', handleUpdate);
        return () => window.removeEventListener('sync-update', handleUpdate);
    }, []);

    return status;
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void, () => Promise<void>] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);
    const [isLoaded, setIsLoaded] = useState(false);
    const isFirstLoadDone = useRef(false);
    const initialLoadSuccess = useRef(false);
    const lastCloudValue = useRef<string | null>(null);
    const isDirty = useRef(false);
    const retryCount = useRef(0);

    // Sincronização entre abas no mesmo computador
    useEffect(() => {
        const channel = new BroadcastChannel(`sync_${key}`);
        channel.onmessage = (event) => {
            if (event.data && !isDirty.current) {
                const dataStr = JSON.stringify(event.data);
                if (dataStr !== JSON.stringify(storedValue)) {
                    setStoredValue(event.data);
                    lastCloudValue.current = dataStr;
                }
            }
        };
        return () => channel.close();
    }, [key, storedValue]);

    const downloadFromCloud = async (force = false) => {
        if (!DB_API_URL) return;

        // Se houver edição local, não baixamos automaticamente para evitar atropelar o usuário
        if (!force && isDirty.current) return;

        updateGlobalSync('syncing', key, force ? 'Forçando Sincronia...' : 'Verificando Nuvem...');
        try {
            const res = await fetch(`${DB_API_URL}?key=${key}&_t=${Date.now()}`);
            const textData = await res.text();
            let cloudData;
            try {
                cloudData = JSON.parse(textData);
            } catch {
                updateGlobalSync('error', key, 'Erro de Formato na Nuvem');
                return;
            }

            if (cloudData && (!Array.isArray(cloudData) || cloudData.length > 0)) {
                const dataStr = JSON.stringify(cloudData);

                if (dataStr !== lastCloudValue.current || force) {
                    setStoredValue(cloudData);
                    lastCloudValue.current = dataStr;
                    try {
                        new BroadcastChannel(`sync_${key}`).postMessage(cloudData);
                    } catch (e) { }
                    updateGlobalSync('synced', key, force ? 'Sincronizado (Forçado)' : 'Sincronizado');
                } else {
                    updateGlobalSync('synced', key, 'Sincronizado');
                }

                isDirty.current = false;
                initialLoadSuccess.current = true;
            } else {
                initialLoadSuccess.current = true;
                updateGlobalSync('idle', key, 'Nuvem Pronta');
            }
        } catch (err) {
            console.error('Download error:', err);
            updateGlobalSync('error', key, 'Falha de Conexão');
        } finally {
            setIsLoaded(true);
            isFirstLoadDone.current = true;
        }
    };

    // 1. Polling Ativo (30s) e Carga Inicial
    useEffect(() => {
        downloadFromCloud();
        const interval = setInterval(() => downloadFromCloud(), 30000);
        return () => clearInterval(interval);
    }, [key]);

    // 2. Upload Protegido (Pre-Save Check)
    useEffect(() => {
        if (!isFirstLoadDone.current || !DB_API_URL || !initialLoadSuccess.current) return;

        const currentValueStr = JSON.stringify(storedValue);
        if (currentValueStr === lastCloudValue.current) {
            isDirty.current = false;
            return;
        }

        isDirty.current = true;

        const timer = setTimeout(() => {
            const syncTask = async () => {
                updateGlobalSync('syncing', key, 'Protegendo Dados...');
                const valueToSync = currentValueStr;

                try {
                    // PRE-SAVE CHECK: Verifica se outro dispositivo salvou antes
                    const checkRes = await fetch(`${DB_API_URL}?key=${key}&_t=${Date.now()}`);
                    const cloudText = await checkRes.text();

                    if (cloudText !== lastCloudValue.current && lastCloudValue.current !== null) {
                        console.warn('🚨 CONFLITO: Outro dispositivo alterou os dados primeiro!');
                        updateGlobalSync('error', key, 'CONFLITO: Dados novos na nuvem!');
                        // Abortamos o salvamento automático para não apagar o trabalho do outro
                        return;
                    }

                    updateGlobalSync('syncing', key, 'Enviando p/ Nuvem...');
                    await fetch(`${DB_API_URL}?key=${key}`, {
                        method: 'POST',
                        body: valueToSync,
                        mode: 'no-cors'
                    });

                    lastCloudValue.current = valueToSync;
                    isDirty.current = false;
                    retryCount.current = 0;
                    updateGlobalSync('synced', key, 'Salvo!');

                    try {
                        new BroadcastChannel(`sync_${key}`).postMessage(storedValue);
                    } catch (e) { }
                } catch (err) {
                    console.error('Sync failure:', err);
                    if (retryCount.current < 2) {
                        retryCount.current++;
                        updateGlobalSync('error', key, `Tentando reconectar (${retryCount.current}/2)`);
                        setTimeout(() => {
                            syncQueue.push(syncTask);
                            processSyncQueue();
                        }, 5000);
                    } else {
                        updateGlobalSync('error', key, 'Erro ao Salvar');
                    }
                }
            };

            syncQueue.push(syncTask);
            processSyncQueue();
        }, 3000);

        return () => clearTimeout(timer);
    }, [storedValue, key]);

    const setValue = (value: T | ((val: T) => T)) => {
        setStoredValue(prev => {
            const next = value instanceof Function ? value(prev) : value;
            // Só marca como dirty se as strings forem realmente diferentes
            if (JSON.stringify(next) !== JSON.stringify(prev)) {
                isDirty.current = true;
            }
            return next;
        });
    };

    return [storedValue, setValue, () => downloadFromCloud(true)];
}
