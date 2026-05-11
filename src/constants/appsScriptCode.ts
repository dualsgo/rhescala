export const APPS_SCRIPT_CODE = `/**
 * Backend do Google Apps Script para Gestão de Escala
 * Versão: Multi-Loja (GitHub Pages) com Autenticação Dinâmica
 */

function doGet(e) {
  var action = e.parameter.action;
  var key = e.parameter.key;

  // Login/Verificação de Senha
  if (action === 'login') {
    var password = e.parameter.password;
    var adminPass = getConfig('admin_password', 'admin');
    var viewerPass = getConfig('viewer_password', '1234');


    if (password === adminPass) {
      return buildCorsResponse(JSON.stringify({ success: true, role: 'admin' }));
    } else if (password === viewerPass) {
      return buildCorsResponse(JSON.stringify({ success: true, role: 'viewer' }));
    } else {
      return buildCorsResponse(JSON.stringify({ success: false, error: 'Senha incorreta' }));
    }
  }

  // Requisição de dados normal (API)
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
    var action = e.parameter.action;
    var key = e.parameter.key;

    // Atualização de Senha
    if (action === 'update_password') {
      var body = JSON.parse(e.postData.contents);
      var role = body.role; // 'admin' ou 'viewer'
      var newPassword = body.newPassword;
      
      if (role === 'admin' || role === 'viewer') {
        setConfig(role + '_password', newPassword);
        return buildCorsResponse(JSON.stringify({ success: true }));
      }
      return buildCorsResponse(JSON.stringify({ success: false, error: 'Role inválido' }));
    }

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
 * Cria uma resposta JSON com headers CORS.
 */
function buildCorsResponse(jsonString) {
  return ContentService
    .createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── CONFIGURAÇÕES (ABA CONFIG) ─────────────────────────────────────────────

function getConfig(key, defaultValue) {
  try {
    var sheet = getOrCreateSheet('Config');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === key) return data[i][1].toString();
    }
    // Se não existir, cria com o valor padrão
    if (defaultValue !== undefined) {
      setConfig(key, defaultValue);
      return defaultValue;
    }
    return null;
  } catch (e) {
    return defaultValue;
  }
}

function setConfig(key, value) {
  var sheet = getOrCreateSheet('Config');
  var data = sheet.getDataRange().getValues();
  var found = false;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow([key, value, new Date()]);
  }
}

// ─── BANCO DE DADOS (SPREADSHEET) ───────────────────────────────────────────

function getData(key) {
  try {
    var sheet = getOrCreateSheet('Database');
    var values = sheet.getDataRange().getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      if (values[i][0] === key) return values[i][1];
    }
    return null;
  } catch (e) {
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
    throw e;
  }
}

function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (sheetName === 'Config') {
      sheet.appendRow(['Parâmetro', 'Valor', 'Última Alteração']);
    } else {
      sheet.appendRow(['Chave', 'Valor (JSON)', 'Última Atualização']);
    }
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#f3f3f3');
  }
  return sheet;
}
\`;
