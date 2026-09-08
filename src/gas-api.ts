declare const google: any;

const STORAGE_KEY_API_URL = 'escala_gas_api_url';

/**
 * Retorna a URL do GAS configurada pelo usuário (salva no localStorage).
 */
export function getConfiguredApiUrl(): string {
    return localStorage.getItem(STORAGE_KEY_API_URL) || '';
}

/**
 * Salva a URL do GAS no localStorage.
 */
export function setConfiguredApiUrl(url: string): void {
    localStorage.setItem(STORAGE_KEY_API_URL, url.trim());
}

/**
 * Remove a configuração (para trocar de loja/planilha).
 */
export function clearConfiguredApiUrl(): void {
    localStorage.removeItem(STORAGE_KEY_API_URL);
}

/**
 * Adapter para chamadas ao servidor Google Apps Script via fetch.
 * A URL do Web App é configurada pelo usuário na tela de setup.
 */
export const apiStore = {
    async get(key: string): Promise<any> {
        const url = getConfiguredApiUrl();
        if (!url) {
            console.warn('URL do GAS não configurada.');
            return null;
        }

        try {
            const response = await fetch(`${url}?key=${encodeURIComponent(key)}`, {
                method: 'GET',
                redirect: 'follow',
            });
            if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);
            return await response.json();
        } catch (e) {
            console.error(`Erro ao buscar ${key}:`, e);
            throw e;
        }
    },

    async set(key: string, value: any): Promise<void> {
        const url = getConfiguredApiUrl();
        if (!url) return;

        try {
            const response = await fetch(`${url}?key=${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(value),
                redirect: 'follow',
            });
            if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);
        } catch (e) {
            console.error(`Erro ao salvar ${key}:`, e);
            throw e;
        }
    },

    async login(password: string): Promise<{ success: boolean, role?: 'admin' | 'viewer', error?: string }> {
        const url = getConfiguredApiUrl();
        if (!url) return { success: false, error: 'URL da Planilha não configurada.' };

        try {
            // Tenta login via POST (padrão seguro, evita expor senha na URL e nos logs)
            const response = await fetch(`${url}?action=login`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'login', password }),
                redirect: 'follow',
            });
            if (!response.ok) throw new Error('Erro na conexão com o servidor.');
            const data = await response.json();
            // Se backend legado retornar erro de chave ausente, fallback para GET
            if (!data || (data.error && data.error.includes('Key not provided'))) {
                return await this.loginFallbackGet(url, password);
            }
            return data;
        } catch (e) {
            // Fallback para GET caso o deployment do GAS seja versão anterior que só aceita GET
            try {
                return await this.loginFallbackGet(url, password);
            } catch (fallbackErr) {
                console.error('Erro no login:', fallbackErr);
                return { success: false, error: 'Falha na autenticação. Verifique a conexão.' };
            }
        }
    },

    async loginFallbackGet(url: string, password: string): Promise<{ success: boolean, role?: 'admin' | 'viewer', error?: string }> {
        const response = await fetch(`${url}?action=login&password=${encodeURIComponent(password)}`, {
            method: 'GET',
            redirect: 'follow',
        });
        if (!response.ok) throw new Error('Erro na conexão com o servidor.');
        return await response.json();
    },

    async updatePassword(role: 'admin' | 'viewer', newPassword: string): Promise<{ success: boolean, error?: string }> {
        const url = getConfiguredApiUrl();
        if (!url) return { success: false, error: 'URL da Planilha não configurada.' };

        try {
            const response = await fetch(`${url}?action=update_password`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ role, newPassword }),
                redirect: 'follow',
            });
            if (!response.ok) throw new Error('Erro ao atualizar senha.');
            return await response.json();
        } catch (e) {
            console.error('Erro ao atualizar senha:', e);
            return { success: false, error: 'Falha ao atualizar senha.' };
        }
    },

    async checkSetup(tempUrl?: string): Promise<{ initialized: boolean }> {
        const url = tempUrl || getConfiguredApiUrl();
        if (!url) return { initialized: false };

        try {
            const response = await fetch(`${url}?action=check_setup`, {
                method: 'GET',
                redirect: 'follow',
            });
            if (!response.ok) return { initialized: false };
            return await response.json();
        } catch (e) {
            console.error('Erro ao verificar setup:', e);
            return { initialized: false };
        }
    },

    async vacuum(): Promise<{ success: boolean, removedRows?: number, error?: string }> {
        const url = getConfiguredApiUrl();
        if (!url) return { success: false, error: 'URL da Planilha não configurada.' };

        try {
            const response = await fetch(`${url}?action=cleanup`, {
                method: 'POST',
                redirect: 'follow',
            });
            if (!response.ok) throw new Error('Erro ao processar limpeza.');
            return await response.json();
        } catch (e) {
            console.error('Erro na limpeza:', e);
            return { success: false, error: 'Falha ao realizar limpeza.' };
        }
    }
};

