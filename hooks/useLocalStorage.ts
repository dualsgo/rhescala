import { useState, useEffect } from 'react';

// URL DO SEU NOVO GOOGLE APPS SCRIPT (CRIE UM SCRIPT ESPECÍFICO PARA ESSE BANCO DE DADOS EM JSON)
// Substitua o link abaixo assim que implantar o novo Script no Google
export const DB_API_URL = "https://script.google.com/macros/s/AKfycbz0QeiMbI2F9MjNHFgoAacNmfXy7kEluuQHvpqJn0y0htZiMhJ6s9OZbiLQ9bLMmJZ85A/exec";

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {

    // Obtém do localStorage como fallback, para funcionar enquanto o banco carrega
    const readLocal = (): T => {
        if (typeof window === 'undefined') return initialValue;
        try {
            const item = window.localStorage.getItem(key);
            return item ? (JSON.parse(item) as T) : initialValue;
        } catch (error) {
            return initialValue;
        }
    };

    const [storedValue, setStoredValue] = useState<T>(readLocal);
    const [isLoaded, setIsLoaded] = useState(false);

    // Carrega do Banco de Dados em Nuvem (Google Sheets) na inicialização do app
    useEffect(() => {
        if (!DB_API_URL || DB_API_URL === "SUA_URL_AQUI") {
            setIsLoaded(true); // Funciona offline se não houver URL
            return;
        }

        fetch(`${DB_API_URL}?key=${key}`)
            .then(res => res.json())
            .then(data => {
                // Se retornou dados do banco, substitui o estado (Nuven > Local)
                if (data && (!Array.isArray(data) || data.length > 0)) {
                    setStoredValue(data);
                    window.localStorage.setItem(key, JSON.stringify(data));
                }
                setIsLoaded(true);
            })
            .catch(err => {
                console.error("Erro ao carregar do BD na Nuvem, usando memória offline:", err);
                setIsLoaded(true);
            });
    }, [key]);

    // O setValue agora atualiza o React, salva no Local Storage (como antes) E salva na Nuvem em 2º plano
    const setValue = (value: T | ((val: T) => T)) => {
        try {
            setStoredValue(prev => {
                const valueToStore = value instanceof Function ? value(prev) : value;

                // Backup offline imediato
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(key, JSON.stringify(valueToStore));
                }

                // Sincronização em nuvem invisível
                if (DB_API_URL && DB_API_URL !== "SUA_URL_AQUI" && isLoaded) {
                    fetch(`${DB_API_URL}?key=${key}`, {
                        method: 'POST',
                        body: JSON.stringify(valueToStore),
                    }).catch(err => console.error("Erro ao salvar no BD da nuvem:", err));
                }

                return valueToStore;
            });
        } catch (error) {
            console.warn(`Error setting key "${key}":`, error);
        }
    };

    return [storedValue, setValue];
}
