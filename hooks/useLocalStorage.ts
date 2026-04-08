import { useState, useEffect, useRef } from 'react';
import { SyncState, SyncStatus, SyncHistoryItem } from '../types';
import { isGasEnvironment, gasStore } from '../src/gas-api';


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
    const storedValueRef = useRef(storedValue);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        storedValueRef.current = storedValue;
    }, [storedValue]);

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
        if (syncInProgress.current && !force) return;

        updateGlobalSync('syncing', key, force ? 'Buscando Dados...' : 'Consultando Planilha...');
        try {
            let cloudData = null;

            if (isGasEnvironment) {
                // Add a timeout to the cloud call itself to be safe
                const resultPromise = gasStore.get(key);
                cloudData = await Promise.race([
                    resultPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout local')), 31000))
                ]);
            }

            if (cloudData) {
                const dataStr = JSON.stringify(cloudData);
                const localStr = JSON.stringify(storedValueRef.current);

                if (dataStr !== lastCloudValue.current || force) {
                    if (isDirty.current && !force && dataStr !== localStr) {
                        updateGlobalSync('error', key, 'Conflito de Versão');
                        window.dispatchEvent(new CustomEvent('sync-conflict', {
                            detail: {
                                key,
                                resolve: (useCloud: boolean) => {
                                    if (useCloud) {
                                        setStoredValue(cloudData);
                                        lastCloudValue.current = dataStr;
                                        isDirty.current = false;
                                        updateGlobalSync('synced', key, 'Nuvem Restaurada');
                                        try { new BroadcastChannel(`sync_${key}`).postMessage(cloudData); } catch (e) { }
                                    } else {
                                        lastCloudValue.current = dataStr; 
                                        isDirty.current = true;
                                        setStoredValue(prev => (Array.isArray(prev) ? [...prev] : {...prev}) as any); 
                                        updateGlobalSync('syncing', key, 'Salvando Alterações...');
                                    }
                                }
                            }
                        }));
                        return;
                    }

                    setStoredValue(cloudData);
                    lastCloudValue.current = dataStr;
                    isDirty.current = false;
                    try { new BroadcastChannel(`sync_${key}`).postMessage(cloudData); } catch (e) { }
                    updateGlobalSync('synced', key, force ? 'Dados Atualizados' : 'Sincronizado');
                } else {
                    updateGlobalSync('synced', key, 'Sincronizado');
                }
                initialLoadSuccess.current = true;
            } else {
                updateGlobalSync('synced', key, 'Usando Dados Locais');
                initialLoadSuccess.current = true; 
            }
        } catch (err) {
            console.error('Download error:', err);
            updateGlobalSync('error', key, 'Planilha Indisponível');
            // Resolvemos como sucesso inicial para permitir que o app funcione localmente
            initialLoadSuccess.current = true;
        } finally {
            setIsLoaded(true);
            isFirstLoadDone.current = true;
        }
    };

    // 1. Polling (45s) e Carga Inicial
    useEffect(() => {
        downloadFromCloud();
        const interval = setInterval(() => downloadFromCloud(), 45000);
        return () => clearInterval(interval);
    }, [key]);

    // 2. Upload Automático (Debounced em 3s)
    useEffect(() => {
        if (!isFirstLoadDone.current || !initialLoadSuccess.current) return;

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

                updateGlobalSync('syncing', key, 'Salvando...');
                const dataToSync = currentValueStr;

                try {
                    if (isGasEnvironment) {
                        await gasStore.set(key, JSON.parse(dataToSync));
                    }

                    lastCloudValue.current = dataToSync;
                    isDirty.current = false;
                    retryCount.current = 0;
                    updateGlobalSync('synced', key, 'Salvo');

                    try {
                        new BroadcastChannel(`sync_${key}`).postMessage(storedValue);
                    } catch (e) { }
                } catch (err) {
                    console.error('Sync failure:', err);
                    if (retryCount.current < 2) {
                        retryCount.current++;
                        updateGlobalSync('error', key, `Tentando... (${retryCount.current}/2)`);
                        setTimeout(() => {
                            syncQueue.push(syncTask);
                            processSyncQueue();
                        }, 5000);
                    } else {
                        updateGlobalSync('error', key, 'Erro ao Salvar');
                        window.dispatchEvent(new CustomEvent('sync-persistent-error', {
                            detail: { key, data: dataToSync }
                        }));
                    }
                } finally {
                    syncInProgress.current = false;
                    isGlobalSyncing = false; // Garante liberação do lock global em caso de erro bizarro
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
            if (JSON.stringify(next) !== JSON.stringify(prev)) {
                isDirty.current = true;
            }
            return next;
        });
    };

    return [storedValue, setValue, () => downloadFromCloud(true)];
}

export function useLocalPreference<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error('Error saving to localStorage', error);
        }
    };

    return [storedValue, setValue];
}

