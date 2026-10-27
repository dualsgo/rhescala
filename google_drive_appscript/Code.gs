/**
 * ============================================================================
 * RHESCALA — Google Apps Script (Execução Direta no Google Drive)
 * ============================================================================
 * Arquitetura Serverless 100% Google Drive:
 * - Serve a interface completa do Rhescala via HtmlService (Index.html).
 * - Cria e gerencia automaticamente a pasta "Rhescala - Sistema de Escalas" e
 *   a planilha "Rhescala - Banco de Dados" diretamente no seu Google Drive
 *   (ou usa a própria planilha caso o script tenha sido criado dentro de uma).
 * - Suporta JSONs grandes (> 50.000 caracteres por célula) via particionamento
 *   automático em colunas, atualização in-place (sem acumular linhas inúteis)
 *   e controle de concorrência com LockService.
 * ============================================================================
 */

var DRIVE_FOLDER_NAME = 'Rhescala - Sistema de Escalas';
var DB_SPREADSHEET_NAME = 'Rhescala - Banco de Dados';
var PROP_DB_SS_ID = 'RHESCALA_DB_SPREADSHEET_ID';
var PROP_DRIVE_FOLDER_ID = 'RHESCALA_DRIVE_FOLDER_ID';
var CELL_CHUNK_SIZE = 45000; // Margem segura abaixo do limite de 50.000 chars por célula do Sheets
var CHUNK_PREFIX = '__CHUNKED__:';

// ─── 1. SERVIDOR WEB APP (HTMLSERVICE) E MENU DE PLANILHA ───────────────────

function loadAppHtmlOutput_() {
  try {
    return HtmlService.createHtmlOutputFromFile('Index');
  } catch (e1) {
    return HtmlService.createHtmlOutputFromFile('index');
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};

    // Mantém suporte opcional a chamadas REST (?action= ou ?key=)
    if (params.action || params.key) {
      return handleRestGet_(params);
    }

    var output = loadAppHtmlOutput_();
    output.setTitle('Rhescala — Gestão de Escalas')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return output;
  } catch (err) {
    logDebug('DOGET_ERROR', err.toString());
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;padding:32px;max-width:620px;margin:40px auto;border:1px solid #fecdd3;background:#fff1f2;border-radius:16px;color:#881337">' +
      '<h2 style="margin-top:0">Erro ao carregar o Rhescala</h2>' +
      '<p>Certifique-se de que o arquivo HTML foi criado com o nome <b>Index</b> (<code>Index.html</code>) no editor do Apps Script.</p>' +
      '<pre style="background:#fff;padding:12px;border-radius:8px;overflow:auto;font-size:12px">' + escapeHtml_(err.toString()) + '</pre>' +
      '</div>'
    );
  }
}

function doPost(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var bodyRaw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    return handleRestPost_(params, bodyRaw);
  } catch (err) {
    logDebug('POST_ERROR', err.toString());
    return buildJsonResponse_({ error: err.toString() });
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('📅 Rhescala')
      .addItem('Abrir Painel de Escalas', 'openAppModal_')
      .addItem('Salvar Backup JSON no Drive', 'criarBackupManualNoDrive')
      .addItem('Otimizar Banco de Dados (Vacuum)', 'executarLimpezaManual_')
      .addToUi();
  } catch (e) {
    // Ignorado quando o projeto roda standalone direto no Google Drive
  }
}

function openAppModal_() {
  var html = loadAppHtmlOutput_()
    .setWidth(1280)
    .setHeight(820);
  SpreadsheetApp.getUi().showModalDialog(html, 'Rhescala — Gestão de Escalas');
}

function executarLimpezaManual_() {
  var res = gasCleanup();
  SpreadsheetApp.getUi().alert('Otimização concluída! Linhas antigas removidas: ' + (res.removedRows || 0));
}

// ─── 2. FUNÇÕES RPC NATIVAS (CHAMADAS PELO FRONTEND VIA google.script.run) ─

/**
 * Inicializa/localiza o banco no Google Drive e verifica se as senhas já foram definidas.
 */
function gasCheckSetup() {
  var ss = getDatabaseSpreadsheet_();
  var adminSet = !!getConfig_('admin_password');
  var viewerSet = !!getConfig_('viewer_password');
  return {
    initialized: Boolean(adminSet && viewerSet),
    spreadsheetUrl: ss.getUrl(),
    spreadsheetName: ss.getName()
  };
}

/**
 * Valida a senha de Gestor (admin) ou Equipe (viewer).
 */
function gasLogin(password) {
  var pwd = String(password || '');
  var adminPass = getConfig_('admin_password', 'admin');
  var viewerPass = getConfig_('viewer_password', '1234');

  if (pwd === adminPass) {
    return { success: true, role: 'admin' };
  }
  if (pwd === viewerPass) {
    return { success: true, role: 'viewer' };
  }
  return { success: false, error: 'Senha incorreta' };
}

/**
 * Atualiza a senha de 'admin' ou 'viewer' na aba Config.
 */
function gasUpdatePassword(role, newPassword) {
  if (role !== 'admin' && role !== 'viewer') {
    return { success: false, error: 'Perfil inválido' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    setConfig_(role + '_password', String(newPassword || ''));
    SpreadsheetApp.flush();
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Busca uma chave individual no banco.
 */
function gasGetData(key) {
  if (!key) return null;
  return getData_(String(key));
}

/**
 * Busca todas as chaves solicitadas em uma única leitura da planilha (boot e polling rápidos).
 */
function gasGetBatch(keys) {
  var result = {};
  if (!keys || !keys.length) return result;

  var sheet = getOrCreateSheet_('Database');
  var values = sheet.getDataRange().getValues();
  var map = {};

  for (var i = 1; i < values.length; i++) {
    var rowKey = values[i][0];
    if (rowKey) {
      map[String(rowKey)] = readRowValue_(values[i]);
    }
  }

  for (var k = 0; k < keys.length; k++) {
    var reqKey = String(keys[k]);
    result[reqKey] = Object.prototype.hasOwnProperty.call(map, reqKey) ? map[reqKey] : null;
  }
  return result;
}

/**
 * Grava uma chave no banco com suporte automático a payloads > 50k caracteres.
 */
function gasSetData(key, valueStr) {
  if (!key) throw new Error('Key not provided');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    setData_(String(key), valueStr);
    SpreadsheetApp.flush();
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Grava múltiplas chaves em uma única transação protegida por LockService.
 */
function gasSetBatch(entriesJson) {
  var entries = typeof entriesJson === 'string' ? JSON.parse(entriesJson) : entriesJson;
  if (!entries || typeof entries !== 'object') return { success: false, error: 'Payload inválido' };

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var keys = Object.keys(entries);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var val = entries[k];
      var valStr = typeof val === 'string' ? val : JSON.stringify(val);
      setData_(k, valStr);
    }
    SpreadsheetApp.flush();
    return { success: true, count: keys.length };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Limpa versões duplicadas antigas na aba Database (Vacuum).
 */
function gasCleanup() {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var removed = cleanupDatabase_();
    SpreadsheetApp.flush();
    return { success: true, removedRows: removed };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Retorna URLs da planilha banco e da pasta dedicada no Google Drive.
 */
function gasGetDriveInfo() {
  var ss = getDatabaseSpreadsheet_();
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty(PROP_DRIVE_FOLDER_ID);
  var folderUrl = '';
  if (folderId) {
    try {
      folderUrl = DriveApp.getFolderById(folderId).getUrl();
    } catch (e) {}
  }
  return {
    spreadsheetUrl: ss.getUrl(),
    spreadsheetName: ss.getName(),
    folderUrl: folderUrl
  };
}

/**
 * Gera um snapshot JSON completo direto na pasta do Google Drive (pode ser acionado pelo editor GAS também).
 */
function criarBackupManualNoDrive() {
  var sheet = getOrCreateSheet_('Database');
  var values = sheet.getDataRange().getValues();
  var dump = {
    system: 'rhescala-drive',
    exportedAt: new Date().toISOString(),
    data: {}
  };
  for (var i = 1; i < values.length; i++) {
    var k = values[i][0];
    if (k) {
      var raw = readRowValue_(values[i]);
      try {
        dump.data[String(k)] = raw ? JSON.parse(raw) : null;
      } catch (e) {
        dump.data[String(k)] = raw;
      }
    }
  }
  var tz = Session.getScriptTimeZone() || 'America/Sao_Paulo';
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd_HH-mm');
  return gasSaveBackupToDrive('rhescala_drive_backup_' + stamp + '.json', JSON.stringify(dump, null, 2));
}

function gasSaveBackupToDrive(filename, jsonContent) {
  var folder = getOrCreateDriveFolder_();
  var tz = Session.getScriptTimeZone() || 'America/Sao_Paulo';
  var safeName = filename || ('rhescala_backup_' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd_HH-mm') + '.json');
  var file = folder.createFile(safeName, String(jsonContent || '{}'), MimeType.PLAIN_TEXT);
  return {
    success: true,
    fileName: file.getName(),
    fileUrl: file.getUrl(),
    folderUrl: folder.getUrl()
  };
}

// ─── 3. CRIAÇÃO E GESTÃO AUTOMÁTICA NO GOOGLE DRIVE ─────────────────────────

function getOrCreateDriveFolder_() {
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty(PROP_DRIVE_FOLDER_ID);
  if (savedId) {
    try {
      var existing = DriveApp.getFolderById(savedId);
      if (!existing.isTrashed()) return existing;
    } catch (e) {}
  }

  var iter = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (iter.hasNext()) {
    var found = iter.next();
    props.setProperty(PROP_DRIVE_FOLDER_ID, found.getId());
    return found;
  }

  var created = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  props.setProperty(PROP_DRIVE_FOLDER_ID, created.getId());
  return created;
}

function getDatabaseSpreadsheet_() {
  // 1. Se o script estiver vinculado a uma Planilha Google existente, usa ela
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  // 2. Se estiver rodando direto no Google Drive (standalone), abre ou cria a planilha automaticamente
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty(PROP_DB_SS_ID);
  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {}
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    ssId = props.getProperty(PROP_DB_SS_ID);
    if (ssId) {
      try {
        return SpreadsheetApp.openById(ssId);
      } catch (e2) {}
    }

    var createdSs = SpreadsheetApp.create(DB_SPREADSHEET_NAME);
    props.setProperty(PROP_DB_SS_ID, createdSs.getId());

    try {
      var folder = getOrCreateDriveFolder_();
      DriveApp.getFileById(createdSs.getId()).moveTo(folder);
    } catch (driveErr) {
      // Caso DriveApp esteja restrito, a planilha permanece funcional na raiz do Meu Drive
    }

    return createdSs;
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet_(sheetName) {
  var ss = getDatabaseSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  var lock = LockService.getScriptLock();
  var gotLock = lock.tryLock(15000);
  try {
    sheet = ss.getSheetByName(sheetName);
    if (sheet) return sheet;

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
    for (var d = 0; d < defaultSheets.length; d++) {
      var defSheet = ss.getSheetByName(defaultSheets[d]);
      if (defSheet && ss.getSheets().length > 1 && defSheet.getLastRow() === 0) {
        try { ss.deleteSheet(defSheet); } catch (e) {}
      }
    }
    return sheet;
  } finally {
    if (gotLock) lock.releaseLock();
  }
}

// ─── 4. MOTOR DE PERSISTÊNCIA CHAVE-VALOR (SEM LIMITE DE 50K CHARS) ─────────

function splitIntoChunks_(str, size) {
  var chunks = [];
  for (var i = 0; i < str.length; i += size) {
    chunks.push(str.substring(i, i + size));
  }
  return chunks;
}

function readRowValue_(row) {
  if (!row || row.length < 2) return null;
  var colB = row[1];
  if (colB === null || colB === undefined || colB === '') return null;
  var strB = String(colB);

  if (strB.indexOf(CHUNK_PREFIX) === 0) {
    var totalChunks = parseInt(strB.substring(CHUNK_PREFIX.length), 10) || 0;
    var parts = [];
    for (var c = 0; c < totalChunks; c++) {
      var part = row[3 + c];
      if (part !== undefined && part !== null) {
        parts.push(String(part));
      }
    }
    return parts.join('');
  }
  return strB;
}

function buildRowCells_(key, valueStr) {
  var now = new Date();
  var safeStr = typeof valueStr === 'string' ? valueStr : JSON.stringify(valueStr);
  if (safeStr.length <= CELL_CHUNK_SIZE) {
    return [key, safeStr, now];
  }
  var chunks = splitIntoChunks_(safeStr, CELL_CHUNK_SIZE);
  var row = [key, CHUNK_PREFIX + chunks.length, now];
  for (var i = 0; i < chunks.length; i++) {
    row.push(chunks[i]);
  }
  return row;
}

function getData_(key) {
  try {
    var sheet = getOrCreateSheet_('Database');
    var values = sheet.getDataRange().getValues();
    for (var i = values.length - 1; i >= 1; i--) {
      if (String(values[i][0]) === String(key)) {
        return readRowValue_(values[i]);
      }
    }
    return null;
  } catch (e) {
    logDebug('GET_DATA_ERROR', key + ': ' + e.toString());
    return null;
  }
}

function setData_(key, value) {
  var sheet = getOrCreateSheet_('Database');
  var rowCells = buildRowCells_(key, value);
  var lastRow = sheet.getLastRow();
  var maxCols = Math.max(sheet.getLastColumn(), rowCells.length);

  if (lastRow >= 2) {
    var keysCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = keysCol.length - 1; i >= 0; i--) {
      if (String(keysCol[i][0]) === String(key)) {
        var targetRow = i + 2;
        if (maxCols > rowCells.length) {
          sheet.getRange(targetRow, 1, 1, maxCols).clearContent();
        }
        sheet.getRange(targetRow, 1, 1, rowCells.length).setValues([rowCells]);
        return true;
      }
    }
  }

  sheet.getRange(lastRow + 1, 1, 1, rowCells.length).setValues([rowCells]);
  return true;
}

function getConfig_(key, defaultValue) {
  try {
    var sheet = getOrCreateSheet_('Config');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(key)) {
        return data[i][1].toString();
      }
    }
    if (defaultValue !== undefined) {
      setConfig_(key, defaultValue);
      return defaultValue;
    }
    return null;
  } catch (e) {
    return defaultValue !== undefined ? defaultValue : null;
  }
}

function setConfig_(key, value) {
  var sheet = getOrCreateSheet_('Config');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(key)) {
      sheet.getRange(i + 1, 2).setValue(value);
      sheet.getRange(i + 1, 3).setValue(new Date());
      return;
    }
  }
  sheet.appendRow([key, value, new Date()]);
}

function cleanupDatabase_() {
  var sheet = getOrCreateSheet_('Database');
  var data = sheet.getDataRange().getValues();
  if (data.length <= 2) return 0;

  var latestRows = {};
  var order = [];
  var headers = data[0];
  var totalOriginal = data.length - 1;

  for (var i = 1; i < data.length; i++) {
    var k = data[i][0];
    if (k) {
      var keyStr = String(k);
      if (!Object.prototype.hasOwnProperty.call(latestRows, keyStr)) {
        order.push(keyStr);
      }
      latestRows[keyStr] = data[i];
    }
  }

  var removedCount = totalOriginal - order.length;
  if (removedCount > 0) {
    var width = headers.length;
    for (var r = 0; r < order.length; r++) {
      if (latestRows[order[r]].length > width) width = latestRows[order[r]].length;
    }

    var matrix = [padRow_(headers, width)];
    for (var j = 0; j < order.length; j++) {
      matrix.push(padRow_(latestRows[order[j]], width));
    }

    sheet.clearContents();
    sheet.getRange(1, 1, matrix.length, width).setValues(matrix);
  }
  return removedCount;
}

function padRow_(row, width) {
  var copy = row.slice();
  while (copy.length < width) copy.push('');
  return copy;
}

// ─── 5. SUPORTE REST OPCIONAL E UTILITÁRIOS DE LOG ──────────────────────────

function handleRestGet_(params) {
  logDebug('GET', sanitizeLog_(JSON.stringify(params)));
  var action = params.action;
  var key = params.key;

  if (action === 'login') {
    return buildJsonResponse_(gasLogin(params.password));
  }
  if (action === 'check_setup') {
    return buildJsonResponse_(gasCheckSetup());
  }
  if (key) {
    var raw = getData_(key);
    return buildJsonResponse_(raw ? JSON.parse(raw) : null);
  }
  return buildJsonResponse_({ status: 'ok', message: 'Rhescala Drive API ativa!' });
}

function handleRestPost_(params, bodyRaw) {
  var action = params.action;
  var key = params.key;
  logDebug('POST', sanitizeLog_(JSON.stringify(params)), sanitizeLog_(bodyRaw ? bodyRaw.substring(0, 200) : 'sem body'));

  if (action === 'login') {
    var loginBody = {};
    try { loginBody = JSON.parse(bodyRaw); } catch (e) {}
    return buildJsonResponse_(gasLogin(loginBody.password || params.password));
  }
  if (action === 'update_password') {
    var pwdBody = JSON.parse(bodyRaw || '{}');
    return buildJsonResponse_(gasUpdatePassword(pwdBody.role, pwdBody.newPassword));
  }
  if (action === 'cleanup') {
    return buildJsonResponse_(gasCleanup());
  }
  if (!key) {
    return buildJsonResponse_({ error: 'Key not provided' });
  }
  return buildJsonResponse_(gasSetData(key, bodyRaw));
}

function buildJsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeLog_(text) {
  if (!text) return '';
  return text.toString()
    .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"***"')
    .replace(/password=[^&]*/gi, 'password=***')
    .replace(/"newPassword"\s*:\s*"[^"]*"/gi, '"newPassword":"***"');
}

function escapeHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function logDebug(type, details, payload) {
  try {
    var sheet = getOrCreateSheet_('DebugLog');
    sheet.appendRow([new Date(), type, sanitizeLog_(details), sanitizeLog_(payload || '')]);
    if (sheet.getLastRow() > 105) {
      sheet.deleteRows(2, 10);
    }
  } catch (e) {}
}
