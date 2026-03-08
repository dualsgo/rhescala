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
    // Inicializa sempre com o placeholder (sem ler o disco)
    const [storedValue, setStoredValue] = useState<T>(initialValue);

    const [isLoaded, setIsLoaded] = useState(false);
    const isFirstLoadDone = useRef(false);
    const lastCloudValue = useRef<string | null>(null);
    const isDirty = useRef(false);
    const retryCount = useRef(0);

    const downloadFromCloud = async (force = false) => {
        if (!DB_API_URL) return;

        updateGlobalSync('syncing', key, force ? 'Forçando Sincronia...' : 'Baixando Nuvem...');
        try {
            const res = await fetch(`${DB_API_URL}?key=${key}&_t=${Date.now()}`);
            const textData = await res.text();
            let cloudData;
            try {
                cloudData = JSON.parse(textData);
            } catch {
                updateGlobalSync('error', key, 'Erro: Dados da Nuvem Corrompidos');
                return;
            }

            // OBRIGATORIEDADE: Se a nuvem tem dados, nós USAMOS eles, 
            // ignorando qualquer coisa local (a menos que o usuário esteja editando agora mesmo)
            if (cloudData && (!Array.isArray(cloudData) || cloudData.length > 0)) {
                const dataStr = JSON.stringify(cloudData);

                // Se for a primeira vez ou um force sync, sobrescrevemos sem perguntar
                if (!isFirstLoadDone.current || force) {
                    setStoredValue(cloudData);
                    lastCloudValue.current = dataStr;
                    isDirty.current = false;
                    updateGlobalSync('synced', key, 'Nuvem Carregada (OK)');
                } else if (!isDirty.current) {
                    // Se não houver edição pendente, sincroniza
                    setStoredValue(cloudData);
                    lastCloudValue.current = dataStr;
                    updateGlobalSync('synced', key, 'Sincronizado');
                }
            } else {
                updateGlobalSync('idle', key, 'Nuvem Pronta');
            }
        } catch (err) {
            console.error('Download error:', err);
            updateGlobalSync('error', key, 'Falha de Conexão com a Nuvem');
        } finally {
            setIsLoaded(true);
            isFirstLoadDone.current = true;
        }
    };

    // 1. Carregamento Inicial OBRIGATÓRIO (Assunto ao Cloud)
    useEffect(() => {
        downloadFromCloud();
    }, [key]);

    // 2. Upload para a Nuvem
    useEffect(() => {
        if (!isFirstLoadDone.current || !DB_API_URL) return;

        const currentValueStr = JSON.stringify(storedValue);
        if (currentValueStr === lastCloudValue.current) {
            isDirty.current = false;
            return;
        }

        isDirty.current = true;

        const timer = setTimeout(() => {
            const syncTask = async () => {
                updateGlobalSync('syncing', key, 'Salvando...');
                const valueToSync = currentValueStr;

                try {
                    await fetch(`${DB_API_URL}?key=${key}`, {
                        method: 'POST',
                        body: valueToSync,
                        mode: 'no-cors'
                    });

                    lastCloudValue.current = valueToSync;
                    isDirty.current = false;
                    retryCount.current = 0;
                    updateGlobalSync('synced', key, 'Salvo na Nuvem');
                } catch (err) {
                    console.error('Sync failure:', err);
                    if (retryCount.current < 3) {
                        retryCount.current++;
                        updateGlobalSync('error', key, `Tentando salvar (${retryCount.current}/3)`);
                        setTimeout(() => {
                            syncQueue.push(syncTask);
                            processSyncQueue();
                        }, 5000 * retryCount.current);
                    } else {
                        updateGlobalSync('error', key, 'Erro Crítico de Rede');
                    }
                }
            };

            syncQueue.push(syncTask);
            processSyncQueue();
        }, 1500);

        return () => clearTimeout(timer);
    }, [storedValue, key]);

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            setStoredValue(prev => {
                const next = value instanceof Function ? value(prev) : value;
                isDirty.current = true;
                return next;
            });
        } catch (error) {
            console.warn(`Erro em memória [${key}]:`, error);
        }
    };

    return [storedValue, setValue, () => downloadFromCloud(true)];
}
