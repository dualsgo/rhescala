export const isGasEnvironment = false;

// COLOQUE AQUI A URL DO SEU WEB APP DO APPS SCRIPT
// Ex: 'https://script.google.com/macros/s/SUA_CHAVE_AQUI/exec'
const GAS_WEB_APP_URL = import.meta.env.VITE_GAS_URL || '';

/**
 * Adapter para chamadas ao servidor Google Apps Script atuando como API REST.
 */
export const apiStore = {
    async get(key: string): Promise<any> {
        if (!GAS_WEB_APP_URL) {
            console.warn('VITE_GAS_URL não está configurada no .env');
            return null;
        }
        
        try {
            const response = await fetch(`${GAS_WEB_APP_URL}?key=${encodeURIComponent(key)}`, {
                method: 'GET',
                redirect: 'follow'
            });
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.statusText}`);
            }
            const data = await response.json();
            return data;
        } catch (e) {
            console.error(`Erro ao buscar ${key} do GAS API:`, e);
            return null;
        }
    },
    async set(key: string, value: any): Promise<void> {
        if (!GAS_WEB_APP_URL) {
            console.warn('VITE_GAS_URL não está configurada no .env');
            return;
        }

        try {
            // Utilizamos text/plain para evitar o erro de CORS Preflight (OPTIONS)
            // que o Google Apps Script não suporta por padrão.
            const response = await fetch(`${GAS_WEB_APP_URL}?key=${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(value),
                redirect: 'follow'
            });
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.statusText}`);
            }
        } catch (e) {
            console.error(`Erro ao salvar ${key} no GAS API:`, e);
            throw e;
        }
    }
};
