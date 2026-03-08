import { useState, useEffect, useRef } from 'react';
import { SyncState, SyncStatus, SyncHistoryItem } from '../types';

// URL DO SEU NOVO GOOGLE APPS SCRIPT
export const DB_API_URL = "https://script.google.com/macros/s/AKfycbzSumKHux0aYikTpcBznYN85r7wxRjCtWoO7MQ1CB5B0fETDmON05g466ufg65g8M7WRg/exec";

// Global state for sync status tracking
const GLOBAL_SYNC_STATUS: SyncStatus = {
    state: 'idle',
    history: []
};

function updateGlobalSync(state: SyncState, key: string, message?: string) {
    GLOBAL_SYNC_STATUS.state = state;
    if (state === 'synced') {
        GLOBAL_SYNC_STATUS.lastSync = new Date().toLocaleTimeString();
    }

    const newItem: SyncHistoryItem = {
        timestamp: new Date().toLocaleTimeString(),
        state,
        key,
        message
    };

    // Maintain a max history of 10 items
    GLOBAL_SYNC_STATUS.history = [newItem, ...GLOBAL_SYNC_STATUS.history].slice(0, 10);

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

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') return initialValue;
        try {
            const item = window.localStorage.getItem(key);
            return item ? (JSON.parse(item) as T) : initialValue;
        } catch (error) {
            return initialValue;
        }
    });

    const [isLoaded, setIsLoaded] = useState(false);
    const isFirstLoadDone = useRef(false);
    const lastCloudValue = useRef<string>(JSON.stringify(storedValue));

    // 1. Carregamento Inicial da Nuvem
    useEffect(() => {
        if (!DB_API_URL) {
            setIsLoaded(true);
            isFirstLoadDone.current = true;
            return;
        }

        updateGlobalSync('syncing', key, 'Baixando dados...');

        // Adiciona um timestamp para evitar cache do navegador/celular
        fetch(`${DB_API_URL}?key=${key}&_t=${Date.now()}`)
            .then(res => res.text())
            .then(textData => {
                let data;
                try {
                    data = JSON.parse(textData);
                } catch (err) {
                    console.warn(`⚠️ ALERTA [${key}]: Nuvem retornou dados inválidos. Usando offline.`);
                    updateGlobalSync('error', key, 'Dados da nuvem inválidos');
                    setIsLoaded(true);
                    isFirstLoadDone.current = true;
                    return;
                }

                if (key === 'riHappyEmployeesData' && !Array.isArray(data)) {
                    console.error("⚠️ ALERTA: URL do 'Hub' detectada no lugar do 'Cofre'. Bloqueando carga.");
                    updateGlobalSync('error', key, 'URL do Script incorreta');
                    setIsLoaded(true);
                    isFirstLoadDone.current = true;
                    return;
                }

                if (data && (!Array.isArray(data) || data.length > 0)) {
                    console.log(`✅ Dados [${key}] baixados da nuvem.`);
                    const dataStr = JSON.stringify(data);
                    setStoredValue(data);
                    lastCloudValue.current = dataStr;
                    window.localStorage.setItem(key, dataStr);
                    updateGlobalSync('synced', key, 'Dados baixados');
                } else {
                    updateGlobalSync('idle', key, 'Sem dados na nuvem');
                }
                setIsLoaded(true);
                isFirstLoadDone.current = true;
            })
            .catch(err => {
                console.error(`Erro ao carregar do BD [${key}]:`, err);
                updateGlobalSync('error', key, 'Falha na conexão ao baixar');
                setIsLoaded(true);
                isFirstLoadDone.current = true;
            });
    }, [key]);

    // 2. Sincronização Automática (Debounce de 2 segundos)
    useEffect(() => {
        // Só sincroniza se já terminou a carga inicial
        if (!isFirstLoadDone.current || !DB_API_URL) return;

        const currentValueStr = JSON.stringify(storedValue);

        // Se o valor atual for igual ao que estava na nuvem, não faz nada
        if (currentValueStr === lastCloudValue.current) return;

        const timer = setTimeout(() => {
            console.log(`☁️ Sincronizando [${key}] com a nuvem...`);
            updateGlobalSync('syncing', key, 'Salvando alterações...');

            // Registra o valor que está sendo enviado para evitar loops
            const valueToSync = currentValueStr;

            fetch(`${DB_API_URL}?key=${key}`, {
                method: 'POST',
                body: valueToSync,
            })
                .then(() => {
                    console.log(`✅ [${key}] salvo na nuvem com sucesso!`);
                    lastCloudValue.current = valueToSync;
                    updateGlobalSync('synced', key, 'Alterações salvas');
                })
                .catch(err => {
                    console.error(`❌ Erro ao salvar [${key}] na nuvem:`, err);
                    updateGlobalSync('error', key, 'Falha na conexão ao salvar');
                });
        }, 2000); // Debounce de 2 segundos para dar tempo de fazer várias edições

        return () => clearTimeout(timer);
    }, [storedValue, key]);

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            setStoredValue(prev => {
                const valueToStore = value instanceof Function ? value(prev) : value;

                // Salva no localStorage IMEDIATAMENTE (segurança offline)
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(key, JSON.stringify(valueToStore));
                }

                return valueToStore;
            });
        } catch (error) {
            console.warn(`Erro ao setar key "${key}":`, error);
        }
    };

    return [storedValue, setValue];
}
