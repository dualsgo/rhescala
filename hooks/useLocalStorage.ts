import { useState, useEffect, useRef } from 'react';

// URL DO SEU NOVO GOOGLE APPS SCRIPT
export const DB_API_URL = "https://script.google.com/macros/s/AKfycbxV3_Lq7J9LGbQ4M20p5zqMyqZ9ciX1zOkx_wHnecL0eX0qF-S57qLQgtVV3fAFPOzorw/exec";

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

        fetch(`${DB_API_URL}?key=${key}`)
            .then(res => res.text())
            .then(textData => {
                let data;
                try {
                    data = JSON.parse(textData);
                } catch (err) {
                    console.warn(`⚠️ ALERTA [${key}]: Nuvem retornou dados inválidos. Usando offline.`);
                    setIsLoaded(true);
                    isFirstLoadDone.current = true;
                    return;
                }

                if (key === 'riHappyEmployeesData' && !Array.isArray(data)) {
                    console.error("⚠️ ALERTA: URL do 'Hub' detectada no lugar do 'Cofre'. Bloqueando carga.");
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
                }
                setIsLoaded(true);
                isFirstLoadDone.current = true;
            })
            .catch(err => {
                console.error(`Erro ao carregar do BD [${key}]:`, err);
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

            // Registra o valor que está sendo enviado para evitar loops
            const valueToSync = currentValueStr;

            fetch(`${DB_API_URL}?key=${key}`, {
                method: 'POST',
                body: valueToSync,
            })
                .then(() => {
                    console.log(`✅ [${key}] salvo na nuvem com sucesso!`);
                    lastCloudValue.current = valueToSync;
                })
                .catch(err => {
                    console.error(`❌ Erro ao salvar [${key}] na nuvem:`, err);
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
