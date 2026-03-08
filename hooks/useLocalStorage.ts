import { useState, useEffect, useRef } from 'react';
import { SyncState, SyncStatus, SyncHistoryItem } from '../types';

// URL DA SUA NOVA API NO RENDER
export const DB_API_URL = "https://rhescala.onrender.com";

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
    const syncInProgress = useRef(false);

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
        if (!DB_API_URL || syncInProgress.current) return;

        // Se houver edição local, não baixamos automaticamente para evitar atropelar o usuário
        if (!force && isDirty.current) return;

        updateGlobalSync('syncing', key, force ? 'Forçando Download...' : 'Verificando Nuvem...');
        try {
            const res = await fetch(`${DB_API_URL}?key=${key}&_t=${Date.now()}`);
            const textData = await res.text();
            let cloudData;
            try {
                cloudData = JSON.parse(textData);
            } catch {
                updateGlobalSync('error', key, 'Nuvem Ocupada (Script)');
                return;
            }

            if (cloudData) {
                const dataStr = JSON.stringify(cloudData);
                if (dataStr !== lastCloudValue.current || force) {
                    setStoredValue(cloudData);
                    lastCloudValue.current = dataStr;
                    isDirty.current = false;
                    try { new BroadcastChannel(`sync_${key}`).postMessage(cloudData); } catch (e) { }
                    updateGlobalSync('synced', key, force ? 'Download OK' : 'Sincronizado');
                } else {
                    updateGlobalSync('synced', key, 'Sincronizado');
                }
                initialLoadSuccess.current = true;
            }
        } catch (err) {
            console.error('Download error:', err);
            updateGlobalSync('error', key, 'Erro de Conexão');
        } finally {
            setIsLoaded(true);
            isFirstLoadDone.current = true;
        }
    };

    // 1. Polling (30s) e Carga Inicial
    useEffect(() => {
        downloadFromCloud();
        const interval = setInterval(() => downloadFromCloud(), 30000);
        return () => clearInterval(interval);
    }, [key]);

    // 2. Upload Automático (Debounced em 1.5s)
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
                if (syncInProgress.current) return;
                syncInProgress.current = true;

                updateGlobalSync('syncing', key, 'Salvando Alterações...');
                const dataToSync = currentValueStr;

                try {
                    const res = await fetch(`${DB_API_URL}?key=${key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: dataToSync
                    });

                    if (!res.ok) throw new Error('Falha HTTP');

                    lastCloudValue.current = dataToSync;
                    isDirty.current = false;
                    retryCount.current = 0;
                    updateGlobalSync('synced', key, 'Salvo na Nuvem');

                    try {
                        new BroadcastChannel(`sync_${key}`).postMessage(storedValue);
                    } catch (e) { }
                } catch (err) {
                    console.error('Sync failure:', err);
                    if (retryCount.current < 2) {
                        retryCount.current++;
                        updateGlobalSync('error', key, `Tentando Salvar... (${retryCount.current}/2)`);
                        setTimeout(() => {
                            syncQueue.push(syncTask);
                            processSyncQueue();
                        }, 5000);
                    } else {
                        updateGlobalSync('error', key, 'Erro ao Salvar');
                    }
                } finally {
                    syncInProgress.current = false;
                }
            };

            syncQueue.push(syncTask);
            processSyncQueue();
        }, 1500);

        return () => clearTimeout(timer);
    }, [storedValue, key]);

    const setValue = (value: T | ((val: T) => T)) => {
        setStoredValue(prev => {
            const next = value instanceof Function ? value(prev) : value;
            if (JSON.stringify(next) !== JSON.stringify(prev)) {
                isDirty.current = true;
            }
            return next;
        });
    };

    return [storedValue, setValue, () => downloadFromCloud(true)];
}
