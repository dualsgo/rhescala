/* eslint-disable no-useless-escape */
export const APPS_SCRIPT_CODE = `/**
 * Backend do Google Apps Script para Gestão de Escala
 * Versão: Multi-Loja (GitHub Pages) com Autenticação Dinâmica
 */

function doGet(e) {
  try {
    logDebug('GET', sanitizeLog(JSON.stringify(e.parameter)));
    var action = e.parameter.action;
    var key = e.parameter.key;

    // Login/Verificação de Senha
    if (action === 'login') {
      return handleLoginRequest(e.parameter.password);
    }

    // Requisição de dados normal (API)
    if (key) {
      var data = getData(key);
      var response = data ? JSON.parse(data) : null;
      return buildCorsResponse(JSON.stringify(response));
    }

    // Verificar se a planilha já está configurada
    if (action === 'check_setup') {
      var adminSet = !!getConfig('admin_password');
      var viewerSet = !!getConfig('viewer_password');
      return buildCorsResponse(JSON.stringify({ 
        initialized: adminSet && viewerSet 
      }));
    }

    // Ping de teste de conexão
    return buildCorsResponse(JSON.stringify({ status: 'ok', message: 'Escala API ativa!' }));
  } catch (err) {
    logDebug('GET_ERROR', err.toString());
    return buildCorsResponse(JSON.stringify({ error: err.toString() }));
  }
}

function doPost(e) {
  try {
    var action = e.parameter.action;
    var key = e.parameter.key;
    logDebug('POST', sanitizeLog(JSON.stringify(e.parameter)), sanitizeLog(e.postData ? e.postData.contents : 'sem body'));

    // Login seguro via POST (evita exposição de senha na URL e no histórico)
    if (action === 'login') {
      var body = {};
      try { body = JSON.parse(e.postData.contents); } catch (err) {}
      var password = body.password || e.parameter.password;
      return handleLoginRequest(password);
    }

    // Atualização de Senha (exige senha atual de admin quando já configurado)
    if (action === 'update_password') {
      var body = JSON.parse(e.postData.contents);
      var role = body.role; // 'admin' ou 'viewer'
      var newPassword = body.newPassword;
      var currentAdminPassword = body.currentAdminPassword;

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 4) {
        return buildCorsResponse(JSON.stringify({ success: false, error: 'A nova senha deve ter pelo menos 4 caracteres.' }));
      }

      var existingAdminPass = getConfig('admin_password');
      if (existingAdminPass) {
        var authCheck = verifyStoredPassword(currentAdminPassword, existingAdminPass);
        if (!authCheck.valid) {
          return buildCorsResponse(JSON.stringify({ success: false, error: 'Senha atual de administrador inválida ou não informada.' }));
        }
      }
      
      if (role === 'admin' || role === 'viewer') {
        setConfig(role + '_password', hashPasswordWithSalt(newPassword));
        return buildCorsResponse(JSON.stringify({ success: true }));
      }
      return buildCorsResponse(JSON.stringify({ success: false, error: 'Role inválido' }));
    }

    // Limpeza de histórico (Vacuum)
    if (action === 'cleanup') {
      var count = cleanupDatabase();
      return buildCorsResponse(JSON.stringify({ success: true, removedRows: count }));
    }

    if (!key) {
      return buildCorsResponse(JSON.stringify({ error: 'Key not provided' }));
    }

    var valueStr = e.postData.contents;
    setData(key, valueStr);

    return buildCorsResponse(JSON.stringify({ success: true }));
  } catch (err) {
    logDebug('POST_ERROR', err.toString());
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
    } else if (sheetName === 'DebugLog') {
      sheet.appendRow(['Data/Hora', 'Tipo', 'Detalhes', 'Payload']);
    } else {
      sheet.appendRow(['Chave', 'Valor (JSON)', 'Última Atualização']);
    }
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#f3f3f3');
    
    var defaultSheets = ['Página1', 'Sheet1'];
    defaultSheets.forEach(function(name) {
      var defaultSheet = ss.getSheetByName(name);
      if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
        try { ss.deleteSheet(defaultSheet); } catch (e) { }
      }
    });
  }
  return sheet;
}

function sanitizeLog(text) {
  if (!text) return '';
  return text.toString()
    .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"***"')
    .replace(/password=[^&]*/gi, 'password=***')
    .replace(/"newPassword"\s*:\s*"[^"]*"/gi, '"newPassword":"***"');
}

function logDebug(type, details, payload) {
  try {
    var sheet = getOrCreateSheet('DebugLog');
    sheet.appendRow([new Date(), type, sanitizeLog(details), sanitizeLog(payload || '')]);
    // Mantém apenas as últimas 100 linhas de log
    if (sheet.getLastRow() > 105) {
      sheet.deleteRows(2, 10);
    }
  } catch (e) {}
}

/**
 * Remove versões antigas de dados, mantendo apenas a última de cada chave.
 * Execução em lote (batch) para alta performance sem risco de timeout no GAS.
 */
function cleanupDatabase() {
  var sheet = getOrCreateSheet('Database');
  var data = sheet.getDataRange().getValues();
  if (data.length <= 2) return 0;
  
  var latestRows = {};
  var headers = data[0];
  var totalOriginal = data.length - 1;
  
  // Mapeia a linha mais recente de cada chave
  for (var i = 1; i < data.length; i++) {
    var key = data[i][0];
    if (key) {
      latestRows[key] = data[i];
    }
  }
  
  var preservedRows = [headers];
  for (var k in latestRows) {
    if (latestRows.hasOwnProperty(k)) {
      preservedRows.push(latestRows[k]);
    }
  }
  
  var removedCount = totalOriginal - (preservedRows.length - 1);
  if (removedCount > 0) {
    sheet.clearContents();
    sheet.getRange(1, 1, preservedRows.length, preservedRows[0].length).setValues(preservedRows);
  }
  
  return removedCount;
}

function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function sha256Hex(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var b = (raw[i] < 0 ? raw[i] + 256 : raw[i]).toString(16);
    out.push(b.length === 1 ? '0' + b : b);
  }
  return out.join('');
}

function hashPasswordWithSalt(plain, existingSalt) {
  var salt = existingSalt || Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  return 'sha256:' + salt + ':' + sha256Hex(salt + ':' + plain);
}

function verifyStoredPassword(input, stored) {
  if (typeof input !== 'string' || !input || typeof stored !== 'string' || !stored) {
    return { valid: false, needsMigration: false };
  }
  if (stored.indexOf('sha256:') === 0) {
    var parts = stored.split(':');
    if (parts.length !== 3) return { valid: false, needsMigration: false };
    var expected = hashPasswordWithSalt(input, parts[1]);
    return { valid: constantTimeEquals(expected, stored), needsMigration: false };
  }
  return { valid: constantTimeEquals(input, stored), needsMigration: true };
}

function handleLoginRequest(password) {
  var cache = CacheService.getScriptCache();
  var attemptsKey = 'login_failed_attempts';
  var lockKey = 'login_lock_until';

  if (cache.get(lockKey)) {
    return buildCorsResponse(JSON.stringify({
      success: false,
      error: 'Muitas tentativas inválidas. Aguarde 5 minutos e tente novamente.'
    }));
  }

  var adminPass = getConfig('admin_password', 'admin');
  var viewerPass = getConfig('viewer_password', '1234');

  var adminCheck = verifyStoredPassword(password, adminPass);
  if (adminCheck.valid) {
    cache.remove(attemptsKey);
    if (adminCheck.needsMigration) {
      setConfig('admin_password', hashPasswordWithSalt(password));
    }
    return buildCorsResponse(JSON.stringify({ success: true, role: 'admin' }));
  }

  var viewerCheck = verifyStoredPassword(password, viewerPass);
  if (viewerCheck.valid) {
    cache.remove(attemptsKey);
    if (viewerCheck.needsMigration) {
      setConfig('viewer_password', hashPasswordWithSalt(password));
    }
    return buildCorsResponse(JSON.stringify({ success: true, role: 'viewer' }));
  }

  var fails = parseInt(cache.get(attemptsKey) || '0', 10) + 1;
  if (fails >= 5) {
    cache.put(lockKey, '1', 300);
    cache.remove(attemptsKey);
    return buildCorsResponse(JSON.stringify({
      success: false,
      error: 'Muitas tentativas inválidas. Aguarde 5 minutos e tente novamente.'
    }));
  }
  cache.put(attemptsKey, String(fails), 300);
  return buildCorsResponse(JSON.stringify({ success: false, error: 'Senha incorreta' }));
}
`;
