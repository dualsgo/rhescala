declare const google: any;

/**
 * Adapter para chamadas de servidor do Google Apps Script (google.script.run).
 */

export const isGasEnvironment = typeof google !== 'undefined' && google.script && google.script.run;

export function callGas(functionName: string, ...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!isGasEnvironment) {
            console.warn(`[GAS Bridge] Chamada para '${functionName}' em ambiente não-GAS.`, args);
            setTimeout(() => reject(new Error("Não estamos em ambiente Google Apps Script")), 100);
            return;
        }

        // Timeout de 30 segundos para evitar travamento infinito da UI
        const timeoutId = setTimeout(() => {
            console.error(`[GAS Bridge] Timeout na função '${functionName}' após 30s.`);
            reject(new Error(`Timeout ao chamar '${functionName}' no Google Apps Script.`));
        }, 30000);

        google.script.run
            .withSuccessHandler((result: any) => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .withFailureHandler((error: any) => {
                clearTimeout(timeoutId);
                console.error(`[GAS Bridge] Erro na função '${functionName}':`, error);
                reject(error);
            })
            [functionName](...args);
    });
}

/**
 * Helper específico para salvar/buscar dados na Planilha
 */
export const gasStore = {
    async get(key: string): Promise<any> {
        try {
            const result = await callGas('getData', key);
            return typeof result === 'string' ? JSON.parse(result) : result;
        } catch (e) {
            console.error(`Erro ao buscar ${key} do GAS:`, e);
            return null;
        }
    },
    async set(key: string, value: any): Promise<void> {
        try {
            const valueStr = JSON.stringify(value);
            await callGas('setData', key, valueStr);
        } catch (e) {
            console.error(`Erro ao salvar ${key} no GAS:`, e);
            throw e;
        }
    }
};
