/**
 * Backend do Google Apps Script para Gestão de Escala - Ri Happy
 * Este script deve ser copiado para o arquivo Code.gs no editor do GAS.
 */

// ─── SERVIDOR DA WEB APP ──────────────────────────────────────────────────────

function doGet() {
  console.log('Web App acessada');
  try {
    const output = HtmlService.createHtmlOutputFromFile('Index');
    output.setTitle('Gestão de Escala - Ri Happy')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
    return output;
  } catch (e) {
    console.error('Erro ao carregar Index.html:', e);
    return HtmlService.createHtmlOutput('<b>Erro crítico:</b> Arquivo HTML não encontrado ou malformado. Verifique os logs.');
  }
}

// ─── BANCO DE DADOS (SPREADSHEET) ───────────────────────────────────────────

/**
 * Busca dados da Planilha por chave.
 * Os dados são armazenados na aba 'Database' em formato chave-valor (append-only log).
 */
function getData(key) {
  console.log(`Buscando dados para chave: ${key}`);
  try {
    const sheet = getOrCreateSheet('Database');
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return null;
    
    // Busca apenas as últimas 1000 linhas para performance
    const lookback = Math.min(lastRow - 1, 1000);
    const values = sheet.getRange(lastRow - lookback + 1, 1, lookback, 2).getValues();
    
    // Varre de baixo para cima para pegar a versão mais recente
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i][0] === key) {
        let val = values[i][1];
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try {
            return JSON.parse(val);
          } catch(e) {
            return val;
          }
        }
        return val;
      }
    }
    return null;
  } catch (e) {
    console.error(`Erro ao buscar ${key}:`, e);
    return null;
  }
}

/**
 * Salva dados na Planilha.
 */
function setData(key, value) {
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
  console.log(`Salvando dados para chave: ${key} (Tamanho: ${valueStr.length})`);
  
  try {
    const sheet = getOrCreateSheet('Database');
    sheet.appendRow([key, valueStr, new Date()]);
    
    // Limpeza periódica: se a planilha estiver muito grande (ex: > 5000 linhas), limpamos duplicatas
    const lastRow = sheet.getLastRow();
    if (lastRow > 5000) {
      cleanupDatabase(sheet);
    }
    return true;
  } catch (e) {
    console.error(`Erro ao salvar ${key}:`, e);
    throw e;
  }
}

/**
 * Especial: Salva log de alterações em aba separada para auditoria
 */
function saveChangeLog(logEntry) {
  try {
    const sheet = getOrCreateSheet('AuditLog');
    sheet.appendRow([
      new Date(),
      logEntry.user || 'Desconhecido',
      logEntry.action,
      logEntry.details,
      logEntry.type
    ]);
  } catch (e) {
    console.error('Erro ao salvar log de auditoria:', e);
  }
}

/**
 * Remove registros antigos da tabela Database mantendo apenas o último de cada chave
 */
function cleanupDatabase(sheet) {
  console.log('Iniciando limpeza do banco de dados...');
  const values = sheet.getDataRange().getValues();
  const latestData = {};
  
  // Mapeia a última ocorrência de cada chave
  for (let i = 1; i < values.length; i++) {
    const key = values[i][0];
    latestData[key] = [values[i][0], values[i][1], values[i][2]];
  }
  
  // Limpa tudo e reinsere apenas os mais recentes
  sheet.clearContents();
  sheet.appendRow(['Chave', 'Valor (JSON)', 'Última Atualização']);
  const rowsToInsert = Object.values(latestData);
  if (rowsToInsert.length > 0) {
    sheet.getRange(2, 1, rowsToInsert.length, 3).setValues(rowsToInsert);
  }
  console.log('Limpeza concluída.');
}


/**
 * Helper para pegar ou criar uma aba
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (sheetName === 'Database') {
      sheet.appendRow(['Chave', 'Valor (JSON)', 'Última Atualização']);
    } else if (sheetName === 'AuditLog') {
      sheet.appendRow(['Data/Hora', 'Usuário', 'Ação', 'Detalhes', 'Tipo']);
    }
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f3f3f3');
  }
  return sheet;
}

/**
 * Funções auxiliares para incluir arquivos HTML (CSS/JS) se não estiverem inlined
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * LOGS genéricos
 */
function logToSheet(message) {
  const sheet = getOrCreateSheet('Logs');
  sheet.appendRow([new Date(), message]);
}
