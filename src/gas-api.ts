declare const google: any;

const STORAGE_KEY_API_URL = 'escala_gas_api_url';

/**
 * Retorna a URL do GAS configurada pelo usuário (salva no localStorage).
 */
export function getConfiguredApiUrl(): string {
    return localStorage.getItem(STORAGE_KEY_API_URL) || '';
}

/**
 * Salva a URL do GAS no localStorage após validar que utiliza protocolo seguro (HTTPS ou localhost).
 */
export function setConfiguredApiUrl(url: string): void {
    const trimmed = url.trim();
    if (!trimmed) {
        throw new Error('URL da API não pode ser vazia.');
    }
    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new Error('URL da API inválida.');
    }
    const isLocalDev = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (parsed.protocol !== 'https:' && !isLocalDev) {
        throw new Error('A URL da API deve utilizar HTTPS.');
    }
    localStorage.setItem(STORAGE_KEY_API_URL, trimmed);
}

/**
 * Remove a configuração (para trocar de loja/planilha).
 */
export function clearConfiguredApiUrl(): void {
    localStorage.removeItem(STORAGE_KEY_API_URL);
}

const DEFAULT_FETCH_TIMEOUT_MS = 25000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): Promise<Response> {
    if (typeof AbortController === 'undefined') {
        return fetch(input, init);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error(`Tempo limite excedido (${Math.round(timeoutMs / 1000)}s) ao comunicar com o servidor.`);
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
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
            const response = await fetchWithTimeout(`${url}?key=${encodeURIComponent(key)}`, {
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
            const response = await fetchWithTimeout(`${url}?key=${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(value),
                redirect: 'follow',
            });
            if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);

            // GAS pode responder 200 OK com payload JSON de erro lógico
            const text = typeof response.text === 'function' ? await response.text() : '';
            if (text) {
                try {
                    const parsed = JSON.parse(text);
                    if (parsed && (parsed.success === false || typeof parsed.error === 'string')) {
                        throw new Error(parsed.error || 'Falha retornada pelo servidor ao salvar dados.');
                    }
                } catch (parseErr) {
                    if (parseErr instanceof SyntaxError) {
                        // Resposta não-JSON (ex: "OK" em texto puro) é válida
                    } else {
                        throw parseErr;
                    }
                }
            }
        } catch (e) {
            console.error(`Erro ao salvar ${key}:`, e);
            throw e;
        }
    },

    async login(password: string): Promise<{ success: boolean, role?: 'admin' | 'viewer', error?: string }> {
        const url = getConfiguredApiUrl();
        if (!url) return { success: false, error: 'URL da Planilha não configurada.' };

        let data: { success: boolean, role?: 'admin' | 'viewer', error?: string } | null;
        try {
            // Login via POST (padrão seguro, evita expor senha na URL e nos logs)
            const response = await fetch(`${url}?action=login`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'login', password }),
                redirect: 'follow',
            });
            if (!response.ok) throw new Error('Erro na conexão com o servidor.');
            data = await response.json();
        } catch (e) {
            // Falhas de rede NÃO fazem downgrade para GET (evita vazar a senha na URL).
            console.error('Erro no login:', e);
            return { success: false, error: 'Falha na autenticação. Verifique a conexão.' };
        }

        // Fallback para GET somente quando o backend legado (sem suporte a login via POST)
        // responde explicitamente que a chave não foi informada.
        if (!data || (typeof data.error === 'string' && data.error.includes('Key not provided'))) {
            try {
                return await this.loginFallbackGet(url, password);
            } catch (fallbackErr) {
                console.error('Erro no login (backend legado):', fallbackErr);
                return { success: false, error: 'Falha na autenticação. Verifique a conexão.' };
            }
        }
        return data;
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

