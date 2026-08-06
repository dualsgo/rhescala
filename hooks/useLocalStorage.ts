import { useState, useEffect, useRef } from 'react';
import { SyncState, SyncStatus, SyncHistoryItem } from '../types';
import { apiStore } from '../src/gas-api';


// Global state for sync status tracking
const GLOBAL_SYNC_STATUS: SyncStatus = {
    state: 'idle',
    history: []
};

// Global lock to prevent concurrent syncs
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
            // Process next after a small gap
            setTimeout(processSyncQueue, 100);
        }
    }
}

function updateGlobalSync(state: SyncState, key: string, message?: string, isSilent = false) {
    GLOBAL_SYNC_STATUS.state = state;
    GLOBAL_SYNC_STATUS.isSilent = isSilent;
    if (state === 'synced') {
        GLOBAL_SYNC_STATUS.lastSync = new Date().toLocaleTimeString('pt-BR');
    }

    const newItem: SyncHistoryItem = {
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        state,
        key,
        message,
        isSilent
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
    const [storedValue, setStoredValue] = useState<T>(() => {
        // Tenta carregar do localStorage primeiro (cache local)
        try {
            const localItem = window.localStorage.getItem(key);
            return localItem ? JSON.parse(localItem) : initialValue;
        } catch (e) {
            return initialValue;
        }
    });
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
        if (syncInProgress.current) return;

        // Se for forçado (botão manual do usuário), exibe modal bloqueante (isSilent = false).
        // Se for polling/carga de fundo, é silencioso (isSilent = true).
        updateGlobalSync('syncing', key, force ? 'Buscando Dados...' : 'Consultando Servidor...', !force);
        try {
            const cloudData = await apiStore.get(key);

            initialLoadSuccess.current = true;
            if (cloudData) {
                const dataStr = JSON.stringify(cloudData);
                const localStr = JSON.stringify(storedValueRef.current);

                if (dataStr !== lastCloudValue.current || force) {
                    if (isDirty.current && !force && dataStr !== localStr) {
                        // CONFLITO - Exibe modal para decidir
                        updateGlobalSync('error', key, 'Conflito de Versão', false);
                        window.dispatchEvent(new CustomEvent('sync-conflict', {
                            detail: {
                                key,
                                resolve: (useCloud: boolean) => {
                                    if (useCloud) {
                                        setStoredValue(cloudData);
                                        lastCloudValue.current = dataStr;
                                        isDirty.current = false;
                                        updateGlobalSync('synced', key, 'Nuvem Restaurada', false);
                                        try { new BroadcastChannel(`sync_${key}`).postMessage(cloudData); } catch (e) { }
                                    } else {
                                        lastCloudValue.current = dataStr; 
                                        isDirty.current = true;
                                        setStoredValue(prev => (Array.isArray(prev) ? [...prev] : {...prev}) as any); 
                                        updateGlobalSync('syncing', key, 'Salvando Alterações...', true);
                                    }
                                }
                            }
                        }));
                        return;
                    }

                    setStoredValue(cloudData);
                    lastCloudValue.current = dataStr;
                    isDirty.current = false;
                    // Atualiza o cache local
                    try {
                        window.localStorage.setItem(key, dataStr);
                        new BroadcastChannel(`sync_${key}`).postMessage(cloudData);
                    } catch (e) { }
                    updateGlobalSync('synced', key, force ? 'Dados Atualizados' : 'Salvo na Planilha', !force);
                } else {
                    updateGlobalSync('synced', key, 'Salvo na Planilha', !force);
                }
            } else {
                // Caso cloudData seja null (planilha nova)
                updateGlobalSync('synced', key, 'Salvo na Planilha', !force);
                lastCloudValue.current = null;
            }
        } catch (err) {
            console.error('Download error:', err);
            updateGlobalSync('error', key, 'Erro de Conexão', false);
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

    // 2. Upload Automático (Debounced em 2.5s - Silencioso em segundo plano)
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

                updateGlobalSync('syncing', key, 'Salvando Alterações...', true);
                const dataToSync = currentValueStr;

                try {
                    await apiStore.set(key, JSON.parse(dataToSync));

                    lastCloudValue.current = dataToSync;
                    isDirty.current = false;
                    retryCount.current = 0;
                    updateGlobalSync('synced', key, 'Salvo na Planilha', true);

                    try {
                        new BroadcastChannel(`sync_${key}`).postMessage(storedValue);
                    } catch (e) { }
                } catch (err) {
                    console.error('Sync failure:', err);
                    if (retryCount.current < 2) {
                        retryCount.current++;
                        updateGlobalSync('error', key, `Tentando Salvar... (${retryCount.current}/2)`, false);
                        setTimeout(() => {
                            syncQueue.push(syncTask);
                            processSyncQueue();
                        }, 5000);
                    } else {
                        updateGlobalSync('error', key, 'Salvo Apenas Localmente', false);
                        // Dispara evento para sugerir backup
                        window.dispatchEvent(new CustomEvent('sync-persistent-error', {
                            detail: { key, data: dataToSync }
                        }));
                    }
                } finally {
                    syncInProgress.current = false;
                }
            };

            syncQueue.push(syncTask);
            processSyncQueue();
        }, 2500);

        return () => clearTimeout(timer);
    }, [storedValue, key]);

    const setValue = (value: T | ((val: T) => T)) => {
        setStoredValue(prev => {
            const next = value instanceof Function ? value(prev) : value;
            if (JSON.stringify(next) !== JSON.stringify(prev)) {
                isDirty.current = true;
                // Salva no localStorage imediatamente para evitar perda de dados
                try {
                    window.localStorage.setItem(key, JSON.stringify(next));
                } catch (e) {}
            }
            return next;
        });
    };

    return [storedValue, setValue, () => downloadFromCloud(true)];
}

/**
 * Hook para persistência local simples (sem sincronização com nuvem).
 * Ideal para preferências de UI como Tema Escuro, etc.
 */
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
