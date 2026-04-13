/**
 * Backend do Google Apps Script para Gestão de Escala - Ri Happy
 * Versão: 2.1 (Suporte a Auditoria e Sincronização em Tempo Real)
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
 */
function getData(key) {
  try {
    const sheet = getOrCreateSheet('Database');
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return null;
    
    // Busca as últimas 1000 linhas para performance
    const lookback = Math.min(lastRow - 1, 1000);
    const values = sheet.getRange(lastRow - lookback + 1, 1, lookback, 2).getValues();
    
    // Varre de baixo para cima (mais recente primeiro)
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i][0] === key) {
        let val = values[i][1];
        try {
          return JSON.parse(val);
        } catch(e) {
          return val;
        }
      }
    }
    return null;
  } catch (e) {
    console.error(`Erro ao buscar ${key}:`, e);
    return null;
  }
}

/**
 * Salva dados na Planilha (Logs de Auditoria e Estado do App).
 */
function setData(key, value) {
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
  
  try {
    const sheet = getOrCreateSheet('Database');
    sheet.appendRow([key, valueStr, new Date()]);
    
    // Se for uma alteração manual (escala ou horas), também registramos no Log de Auditoria real
    if (key === 'escalaChangeLogs') {
      try {
        const logs = JSON.parse(valueStr);
        if (logs && Array.isArray(logs) && logs.length > 0) {
          saveRealTimeAudit(logs[logs.length - 1]);
        }
      } catch (err) {}
    }

    // Limpeza se passar de 5000 linhas
    if (sheet.getLastRow() > 5000) {
      cleanupDatabase(sheet);
    }
    return true;
  } catch (e) {
    console.error(`Erro ao salvar ${key}:`, e);
    throw e;
  }
}

/**
 * Registra especificamente a última ação na aba de Auditoria
 */
function saveRealTimeAudit(logEntry) {
  try {
    const sheet = getOrCreateSheet('AuditLog');
    sheet.appendRow([
      new Date(),
      logEntry.user || 'Gestor',
      logEntry.action || '-',
      logEntry.details || '-',
      logEntry.type || 'edit'
    ]);
  } catch (e) {
    console.error('Erro na auditoria:', e);
  }
}

/**
 * Remove registros antigos mantendo apenas o mais recente de cada chave
 */
function cleanupDatabase(sheet) {
  const values = sheet.getDataRange().getValues();
  const latestData = {};
  
  for (let i = 1; i < values.length; i++) {
    const key = values[i][0];
    latestData[key] = [values[i][0], values[i][1], values[i][2]];
  }
  
  sheet.clearContents();
  sheet.appendRow(['Chave', 'Valor (JSON)', 'Última Atualização']);
  const rows = Object.values(latestData);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }
}

/**
 * Helper: Cria aba se não existir
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

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
