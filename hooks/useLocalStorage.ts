import { useState, useEffect, useRef } from 'react';
import { SyncState, SyncStatus, SyncHistoryItem } from '../types';
import { apiStore } from '../src/gas-api';


// Global state for sync status tracking
const GLOBAL_SYNC_STATUS: SyncStatus = {
    state: 'idle',
    history: []
};

import { globalSyncQueue } from '../src/infrastructure/sync/syncQueue';

/**
 * Mapa em memória que controla a geração/versão atual de cada chave persistida.
 * Permite invalidar tarefas de auto-sync e retry obsoletas no momento exato de sua execução.
 */
export const keyGenerationMap = new Map<string, number>();

export function getLocalKeyGeneration(key: string): number {
    return keyGenerationMap.get(key) || 0;
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
            if (!localItem) return initialValue;
            const parsed = JSON.parse(localItem);
            if (parsed === null || parsed === undefined) return initialValue;
            if (Array.isArray(initialValue) && !Array.isArray(parsed)) return initialValue;
            if (typeof initialValue === 'object' && initialValue !== null && !Array.isArray(initialValue) && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) return initialValue;
            return parsed;
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
                if (dataStr !== JSON.stringify(storedValueRef.current)) {
                    setStoredValue(event.data);
                    lastCloudValue.current = dataStr;
                }
            }
        };
        return () => channel.close();
    }, [key]);

    const downloadFromCloud = async (force = false) => {
        if (syncInProgress.current) return;

        // Se for forçado (botão manual do usuário), exibe modal bloqueante (isSilent = false).
        // Se for polling/carga de fundo, é silencioso (isSilent = true).
        updateGlobalSync('syncing', key, force ? 'Buscando Dados...' : 'Consultando Servidor...', !force);
        try {
            const cloudData = await apiStore.get(key);

            initialLoadSuccess.current = true;
            if (cloudData) {
                if (Array.isArray(initialValue) && !Array.isArray(cloudData)) {
                    console.warn(`[useLocalStorage] Ignorando cloudData inválido para ${key} (esperava Array)`);
                    updateGlobalSync('synced', key, 'Salvo na Planilha', !force);
                    return;
                }
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

    // 1. Polling Inteligente (60s) e Carga Inicial com pausa em background
    useEffect(() => {
        downloadFromCloud();
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            downloadFromCloud();
        }, 60000);
        return () => clearInterval(interval);
    }, [key]);

    // 2. Upload Automático (Debounced em 2.5s - Silencioso em segundo plano)
    useEffect(() => {
        if (!isFirstLoadDone.current) return;

        const currentValueStr = JSON.stringify(storedValue);
        if (currentValueStr === lastCloudValue.current) {
            isDirty.current = false;
            return;
        }

        isDirty.current = true;

        // Avança a geração local da chave. Qualquer retry de geração anterior torna-se obsoleto.
        const taskGeneration = (keyGenerationMap.get(key) || 0) + 1;
        keyGenerationMap.set(key, taskGeneration);
        retryCount.current = 0;

        const timer = setTimeout(() => {
            const syncTask = async () => {
                // Validação no momento em que a tarefa inicia execução
                if (taskGeneration !== (keyGenerationMap.get(key) || 0)) {
                    return;
                }

                if (syncInProgress.current) return;
                syncInProgress.current = true;

                updateGlobalSync('syncing', key, 'Salvando Alterações...', true);
                const dataToSync = currentValueStr;

                try {
                    await apiStore.set(key, JSON.parse(dataToSync));

                    // Validação pós-rede: descarta finalização se nova alteração ocorreu durante a requisição
                    if (taskGeneration !== (keyGenerationMap.get(key) || 0)) {
                        return;
                    }

                    lastCloudValue.current = dataToSync;
                    isDirty.current = false;
                    retryCount.current = 0;
                    updateGlobalSync('synced', key, 'Salvo na Planilha', true);

                    try {
                        new BroadcastChannel(`sync_${key}`).postMessage(storedValue);
                    } catch (e) { }
                } catch (err) {
                    console.error('Sync failure:', err);

                    // Validação no catch: se a versão ficou obsoleta, não agenda retries
                    if (taskGeneration !== (keyGenerationMap.get(key) || 0)) {
                        return;
                    }

                    if (retryCount.current < 2) {
                        retryCount.current++;
                        updateGlobalSync('error', key, `Tentando Salvar... (${retryCount.current}/2)`, false);
                        setTimeout(() => {
                            // Validação no disparo do timer: enfileira somente se ainda for a versão atual
                            if (taskGeneration === (keyGenerationMap.get(key) || 0)) {
                                globalSyncQueue.enqueue(syncTask);
                            }
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

            globalSyncQueue.enqueue(syncTask);
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
