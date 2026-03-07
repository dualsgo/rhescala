import { useState, useEffect } from 'react';

// URL DO SEU NOVO GOOGLE APPS SCRIPT (CRIE UM SCRIPT ESPECÍFICO PARA ESSE BANCO DE DADOS EM JSON)
// Substitua o link abaixo assim que implantar o novo Script no Google
export const DB_API_URL = "https://script.google.com/macros/s/AKfycbxV3_Lq7J9LGbQ4M20p5zqMyqZ9ciX1zOkx_wHnecL0eX0qF-S57qLQgtVV3fAFPOzorw/exec";

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
        if (!DB_API_URL) {
            setIsLoaded(true); // Funciona offline se não houver URL
            return;
        }

        fetch(`${DB_API_URL}?key=${key}`)
            .then(res => res.text())
            .then(textData => {
                let data;
                try {
                    data = JSON.parse(textData);
                } catch (err) {
                    console.warn(`⚠️ ALERTA: O Cofre retornou dados inválidos ('${textData.slice(0, 20)}...'). A célula A1 da planilha deve conter apenas JSON ou estar vazia. Ignorando a nuvem por segurança.`);
                    setIsLoaded(true);
                    return;
                }

                // Prevenção de Segurança: Se os dados vierem da URL errada (ex: Painel Visual), não corrompe o Editor.
                // O RHEscala espera que a lista de funcionários (riHappyEmployeesData) seja um Array.
                if (key === 'riHappyEmployeesData' && !Array.isArray(data)) {
                    console.error("⚠️ ALERTA: A URL colocada parece ser do Painel Visual (Hub), e não do 'Cofre' do Editor. Os dados não foram carregados para evitar corromper a escala.");
                    setIsLoaded(true);
                    return;
                }

                // Se retornou dados válidos do banco, substitui o estado (Nuvem > Local)
                if (data && (!Array.isArray(data) || data.length > 0)) {
                    console.log(`✅ Dados [${key}] carregados da nuvem com sucesso!`);
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
                if (DB_API_URL && isLoaded) {
                    fetch(`${DB_API_URL}?key=${key}`, {
                        method: 'POST',
                        body: JSON.stringify(valueToStore),
                    })
                        .then(() => console.log(`☁️ Alteração em [${key}] salva na nuvem com sucesso!`))
                        .catch(err => console.error("❌ Erro ao salvar no BD da nuvem:", err));
                }

                return valueToStore;
            });
        } catch (error) {
            console.warn(`Error setting key "${key}":`, error);
        }
    };

    return [storedValue, setValue];
}
