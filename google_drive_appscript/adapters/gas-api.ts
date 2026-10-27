declare const google: any;

export const GAS_NATIVE_SENTINEL = '__GAS_DRIVE_NATIVE__';

export function isGasEnvironment(): boolean {
    try {
        return (
            typeof window !== 'undefined' &&
            typeof google !== 'undefined' &&
            Boolean(google && google.script && google.script.run)
        );
    } catch {
        return false;
    }
}

export function callGas<T = any>(functionName: string, ...args: any[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        if (!isGasEnvironment()) {
            reject(new Error('Google Apps Script não detectado (modo offline local).'));
            return;
        }

        const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout ao executar '${functionName}' no Google Apps Script.`));
        }, 30000);

        try {
            google.script.run
                .withSuccessHandler((result: T) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .withFailureHandler((error: any) => {
                    clearTimeout(timeoutId);
                    const msg = error?.message || String(error || 'Erro desconhecido no Google Apps Script');
                    console.error(`[GAS Drive] Erro em ${functionName}:`, error);
                    reject(new Error(msg));
                })
                [functionName](...args);
        } catch (err) {
            clearTimeout(timeoutId);
            reject(err);
        }
    });
}

interface PendingRead {
    key: string;
    resolve: (val: any) => void;
    reject: (err: any) => void;
}

let pendingReads: PendingRead[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function enqueueGasBatchGet(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
        pendingReads.push({ key, resolve, reject });
        if (!batchTimer) {
            batchTimer = setTimeout(async () => {
                const batch = pendingReads;
                pendingReads = [];
                batchTimer = null;

                const uniqueKeys = Array.from(new Set(batch.map(b => b.key)));
                try {
                    const resultMap = await callGas<Record<string, string | null>>('gasGetBatch', uniqueKeys);
                    for (const item of batch) {
                        const raw = resultMap ? resultMap[item.key] : null;
                        if (raw === null || raw === undefined || raw === '') {
                            item.resolve(null);
                        } else if (typeof raw === 'string') {
                            try {
                                item.resolve(JSON.parse(raw));
                            } catch {
                                item.resolve(raw);
                            }
                        } else {
                            item.resolve(raw);
                        }
                    }
                } catch (err) {
                    for (const item of batch) {
                        item.reject(err);
                    }
                }
            }, 25);
        }
    });
}

export function getConfiguredApiUrl(): string {
    return GAS_NATIVE_SENTINEL;
}

export function setConfiguredApiUrl(_url: string): void {
    // No-op na versão nativa Google Drive
}

export function clearConfiguredApiUrl(): void {
    // No-op na versão nativa Google Drive
}

// Fallback local caso o arquivo Index.html seja aberto fora do Google Drive para testes visuais
function localMockGet(key: string): any {
    try {
        const raw = window.localStorage.getItem(`__gas_offline_${key}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function localMockSet(key: string, value: any): void {
    try {
        window.localStorage.setItem(`__gas_offline_${key}`, JSON.stringify(value));
    } catch {}
}

export const apiStore = {
    async get(key: string): Promise<any> {
        if (!isGasEnvironment()) {
            return localMockGet(key);
        }
        return enqueueGasBatchGet(key);
    },

    async set(key: string, value: any): Promise<void> {
        if (!isGasEnvironment()) {
            localMockSet(key, value);
            return;
        }
        await callGas('gasSetData', key, JSON.stringify(value));
    },

    async login(password: string): Promise<{ success: boolean; role?: 'admin' | 'viewer'; error?: string }> {
        if (!isGasEnvironment()) {
            const adminP = localMockGet('__cfg_admin') || 'admin';
            const viewerP = localMockGet('__cfg_viewer') || '1234';
            if (password === adminP) return { success: true, role: 'admin' };
            if (password === viewerP) return { success: true, role: 'viewer' };
            return { success: false, error: 'Senha incorreta' };
        }
        try {
            return await callGas('gasLogin', password);
        } catch (e) {
            console.error('Erro no login GAS:', e);
            return { success: false, error: 'Falha ao autenticar no Google Drive.' };
        }
    },

    async updatePassword(role: 'admin' | 'viewer', newPassword: string): Promise<{ success: boolean; error?: string }> {
        if (!isGasEnvironment()) {
            localMockSet(`__cfg_${role}`, newPassword);
            localMockSet('__cfg_init', true);
            return { success: true };
        }
        try {
            return await callGas('gasUpdatePassword', role, newPassword);
        } catch (e: any) {
            console.error('Erro ao atualizar senha no GAS:', e);
            return { success: false, error: e?.message || 'Falha ao atualizar senha na planilha.' };
        }
    },

    async checkSetup(): Promise<{ initialized: boolean; spreadsheetUrl?: string; spreadsheetName?: string; error?: string }> {
        if (!isGasEnvironment()) {
            return { initialized: Boolean(localMockGet('__cfg_init') ?? true) };
        }
        try {
            return await callGas('gasCheckSetup');
        } catch (e: any) {
            console.error('Erro ao verificar setup no GAS:', e);
            return { initialized: false, error: e?.message || String(e) };
        }
    },

    async vacuum(): Promise<{ success: boolean; removedRows?: number; error?: string }> {
        if (!isGasEnvironment()) {
            return { success: true, removedRows: 0 };
        }
        try {
            return await callGas('gasCleanup');
        } catch (e) {
            console.error('Erro na otimização GAS:', e);
            return { success: false, error: 'Falha ao otimizar planilha no Drive.' };
        }
    },

    async getDriveInfo(): Promise<{ spreadsheetUrl?: string; spreadsheetName?: string; folderUrl?: string } | null> {
        if (!isGasEnvironment()) return null;
        try {
            return await callGas('gasGetDriveInfo');
        } catch {
            return null;
        }
    },

    async saveBackupToDrive(filename: string, jsonContent: string): Promise<{ success: boolean; fileName?: string; fileUrl?: string; folderUrl?: string; error?: string }> {
        if (!isGasEnvironment()) {
            return { success: false, error: 'Disponível apenas quando hospedado no Google Drive / Apps Script.' };
        }
        try {
            return await callGas('gasSaveBackupToDrive', filename, jsonContent);
        } catch (e: any) {
            return { success: false, error: e?.message || 'Erro ao salvar backup no Google Drive.' };
        }
    },
};
