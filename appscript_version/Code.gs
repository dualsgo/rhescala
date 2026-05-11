/**
 * Backend do Google Apps Script para Gestão de Escala
 * Versão: Multi-Loja (GitHub Pages)
 * 
 * INSTRUÇÕES DE DEPLOY:
 * 1. Abra sua Planilha Google
 * 2. Vá em Extensões → Apps Script
 * 3. Cole este código e salve (Ctrl+S)
 * 4. Clique em Implantar → Nova Implantação
 * 5. Tipo: Aplicativo Web
 * 6. Executar como: Eu mesmo
 * 7. Quem tem acesso: Qualquer pessoa
 * 8. Copie o link gerado e cole no app
 */

function doGet(e) {
  // Requisição de dados (API)
  var key = e.parameter.key;
  if (key) {
    var data = getData(key);
    var response = data ? JSON.parse(data) : null;
    return buildCorsResponse(JSON.stringify(response));
  }

  // Ping de teste de conexão
  return buildCorsResponse(JSON.stringify({ status: 'ok', message: 'Escala API ativa!' }));
}

function doPost(e) {
  try {
    var key = e.parameter.key;
    if (!key) {
      return buildCorsResponse(JSON.stringify({ error: 'Key not provided' }));
    }

    var valueStr = e.postData.contents;
    setData(key, valueStr);

    return buildCorsResponse(JSON.stringify({ success: true }));
  } catch (err) {
    return buildCorsResponse(JSON.stringify({ error: err.toString() }));
  }
}

/**
 * Cria uma resposta JSON com headers CORS para aceitar requisições do GitHub Pages.
 */
function buildCorsResponse(jsonString) {
  return ContentService
    .createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── BANCO DE DADOS (SPREADSHEET) ───────────────────────────────────────────

function getData(key) {
  try {
    var sheet = getOrCreateSheet('Database');
    var values = sheet.getDataRange().getValues();

    // Percorre do fim para o início (pega a versão mais recente)
    for (var i = values.length - 1; i >= 0; i--) {
      if (values[i][0] === key) {
        return values[i][1];
      }
    }
    return null;
  } catch (e) {
    console.error('Erro ao buscar ' + key + ':', e);
    return null;
  }
}

function setData(key, value) {
  var valueStr = typeof value === 'string' ? value : JSON.stringify(value);
  try {
    var sheet = getOrCreateSheet('Database');
    sheet.appendRow([key, valueStr, new Date()]);
    return true;
  } catch (e) {
    console.error('Erro ao salvar ' + key + ':', e);
    throw e;
  }
}

function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['Chave', 'Valor (JSON)', 'Última Atualização']);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#f3f3f3');
  }
  return sheet;
}
