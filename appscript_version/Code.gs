/**
 * Backend do Google Apps Script para Gestão de Escala
 * Este script deve ser copiado para o arquivo Code.gs no editor do GAS.
 */

// ─── SERVIDO DA WEB APP ──────────────────────────────────────────────────────

function doGet() {
  console.log('Web App acessada');
  try {
    const output = HtmlService.createHtmlOutputFromFile('Index');
    output.setTitle('Gestão de Escala')
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
 * Os dados são armazenados na aba 'Database' em formato chave-valor.
 */
function getData(key) {
  console.log(`Buscando dados para chave: ${key}`);
  try {
    const sheet = getOrCreateSheet('Database');
    const values = sheet.getDataRange().getValues();
    
    // Procura do fim para o início para pegar a versão mais recente
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i][0] === key) {
        return values[i][1];
      }
    }
    return null;
  } catch (e) {
    console.error(`Erro ao buscar ${key}:`, e);
    return null;
  }
}

function setData(key, valueStr) {
  console.log(`Salvando dados para chave: ${key} (Tamanho: ${valueStr.length})`);
  try {
    const sheet = getOrCreateSheet('Database');
    // Sempre adiciona uma nova linha para manter histórico e evitar limite de caracteres da célula
    sheet.appendRow([key, valueStr, new Date()]);
    return true;
  } catch (e) {
    console.error(`Erro ao salvar ${key}:`, e);
    throw e;
  }
}

/**
 * Helper para pegar ou criar a aba do banco de dados
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['Chave', 'Valor (JSON)', 'Última Atualização']);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#f3f3f3');
    // Esconder a aba do usuário casual para evitar edições manuais
    // sheet.hideSheet(); 
  }
  return sheet;
}

/**
 * Funções auxiliares para incluir arquivos HTML (CSS/JS) se não estiverem inlined
 * (Embora estejamos usando o vite-plugin-singlefile, mantemos por segurança)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * LOGS (Opcional)
 */
function logToSheet(message) {
  const sheet = getOrCreateSheet('Logs');
  sheet.appendRow([new Date(), message]);
}
