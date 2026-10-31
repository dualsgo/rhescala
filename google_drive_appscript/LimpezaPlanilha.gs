/**
 * ============================================================================
 * RHESCALA — SCRIPT DE LIMPEZA E OTIMIZAÇÃO DIRETO NA PLANILHA (VACUUM & PURGE)
 * ============================================================================
 * 
 * COMO USAR:
 * 1. Abra a sua Planilha Google do Rhescala.
 * 2. No menu superior, clique em "Extensões" > "Apps Script".
 * 3. Crie um novo arquivo de script (clique no "+" ao lado de Arquivos > Script)
 *    e nomeie como "LimpezaPlanilha.gs" (ou cole no final do arquivo Code.gs existente).
 * 4. Cole todo o código abaixo e clique em Salvar (ícone de disquete).
 * 5. Ao recarregar a planilha, aparecerá o menu "🧹 Manutenção Rhescala".
 *    Basta clicar em "Executar Limpeza Completa" sempre que desejar!
 * 
 * O QUE ESTE SCRIPT FAZ:
 * - Desduplica a aba "Database" (ou "ESCALA_DATA"): mantém estritamente a versão mais
 *   recente de cada chave (colaboradores, folgas, horários) e deleta centenas/milhares
 *   de revisões obsoletas salvas anteriormente.
 * - Suporta particionamento (__CHUNKED__): preserva colunas extras de dados grandes.
 * - Trunca a aba "Logs": mantém apenas os 50 registros mais recentes para diagnóstico,
 *   evitando o acúmulo de milhares de requisições de depuração.
 * - Compacta Células (Sheet Trim): remove linhas e colunas vazias excedentes que pesam
 *   a planilha no Google Drive, tornando a abertura e a API muito mais rápidas.
 * - Proteção com LockService: impede conflito caso alguém esteja editando no momento.
 * ============================================================================
 */

/**
 * Cria o menu interativo automaticamente ao abrir a planilha.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🧹 Manutenção Rhescala')
      .addItem('Executar Limpeza Completa (Evitar Acúmulo)', 'executarLimpezaPlanilhaRhescala')
      .addSeparator()
      .addItem('Ativar Limpeza Automática Semanal (Domingos 23h)', 'instalarGatilhoLimpezaSemanal')
      .addItem('Desativar Limpeza Automática', 'removerGatilhosLimpeza')
      .addToUi();
  } catch (e) {
    // Modo headless / execução via gatilho
  }
}

/**
 * Ponto de entrada manual disparado pelo menu da planilha com feedback visual.
 */
function executarLimpezaPlanilhaRhescala() {
  var ui = SpreadsheetApp.getUi();
  
  var resposta = ui.alert(
    '🧹 Otimização do Banco Rhescala',
    'Deseja iniciar a limpeza da planilha?\n\n' +
    '• Remove revisões antigas acumuladas na aba de Dados.\n' +
    '• Trunca registros antigos de log (mantendo os últimos 50).\n' +
    '• Compacta linhas e colunas em branco desnecessárias.\n\n' +
    'Nenhum dado ativo da escala será perdido.',
    ui.ButtonSet.YES_NO
  );

  if (resposta !== ui.Button.YES) {
    return;
  }

  var resultado = executarRotinaLimpezaCore_();

  if (resultado.sucesso) {
    ui.alert(
      '✅ Limpeza Concluída com Sucesso!',
      'Relatório de Manutenção:\n\n' +
      '• Linhas antigas de dados removidas: ' + resultado.linhasDadosRemovidas + '\n' +
      '• Chaves ativas preservadas: ' + resultado.chavesPreservadas + '\n' +
      '• Linhas de log expurgadas: ' + resultado.linhasLogsRemovidas + '\n' +
      '• Linhas vazias compactadas: ' + resultado.linhasVaziasCompactadas + '\n\n' +
      'A planilha foi compactada e sua velocidade de leitura/escrita foi restaurada!',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert(
      '⚠️ Atenção na Execução',
      'Não foi possível concluir a limpeza: ' + resultado.erro,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Ponto de entrada silencioso para execução via acionador automático (Trigger).
 */
function executarLimpezaAutomaticaSilenciosa() {
  var res = executarRotinaLimpezaCore_();
  Logger.log('Limpeza Automática: ' + JSON.stringify(res));
}

/**
 * Núcleo da rotina de limpeza e desduplicação com LockService.
 */
function executarRotinaLimpezaCore_() {
  var lock = LockService.getScriptLock();
  var obteveLock = lock.tryLock(45000); // 45 segundos de timeout para segurança

  if (!obteveLock) {
    return {
      sucesso: false,
      erro: 'A planilha está em sincronização com o Rhescala no momento. Tente novamente em instantes.'
    };
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return { sucesso: false, erro: 'Nenhuma planilha ativa encontrada.' };
    }

    var relatorio = {
      sucesso: true,
      linhasDadosRemovidas: 0,
      chavesPreservadas: 0,
      linhasLogsRemovidas: 0,
      linhasVaziasCompactadas: 0
    };

    // ─── 1. DESDUPLICAÇÃO DA ABA DE DADOS (Database ou ESCALA_DATA) ─────────
    var dbSheet = localizarAba_(ss, ['Database', 'ESCALA_DATA', 'DATABASE']);
    if (dbSheet) {
      var data = dbSheet.getDataRange().getValues();
      if (data && data.length > 2) {
        var headers = data[0];
        var latestRows = {};
        var order = [];
        var totalOriginal = data.length - 1;

        // Varre de cima para baixo: a última ocorrência de cada chave é a versão mais recente
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var key = row[0] ? String(row[0]).trim() : '';
          if (key) {
            if (!Object.prototype.hasOwnProperty.call(latestRows, key)) {
              order.push(key);
            }
            latestRows[key] = row;
          }
        }

        var removed = totalOriginal - order.length;
        if (removed > 0 && order.length > 0) {
          // Determina a largura máxima de colunas (respeitando chunks grandes)
          var maxCols = headers.length;
          for (var k = 0; k < order.length; k++) {
            if (latestRows[order[k]].length > maxCols) {
              maxCols = latestRows[order[k]].length;
            }
          }

          var matrix = [preencherColunasVazias_(headers, maxCols)];
          for (var j = 0; j < order.length; j++) {
            matrix.push(preencherColunasVazias_(latestRows[order[j]], maxCols));
          }

          dbSheet.clearContents();
          dbSheet.getRange(1, 1, matrix.length, maxCols).setValues(matrix);
          relatorio.linhasDadosRemovidas = removed;
          relatorio.chavesPreservadas = order.length;
        } else {
          relatorio.chavesPreservadas = order.length;
        }
      }
    }

    // ─── 2. PURGA DE LOGS ANTIGOS (Logs, VACUUM_LOGS ou DEBUG_LOGS) ─────────
    var logSheet = localizarAba_(ss, ['Logs', 'VACUUM_LOGS', 'DEBUG_LOGS', 'LOGS']);
    if (logSheet) {
      var totalLogRows = logSheet.getLastRow();
      var MANTER_ULTIMOS_LOGS = 50;
      if (totalLogRows > MANTER_ULTIMOS_LOGS + 1) { // +1 cabeçalho
        var linhasParaDeletar = totalLogRows - MANTER_ULTIMOS_LOGS - 1;
        logSheet.deleteRows(2, linhasParaDeletar);
        relatorio.linhasLogsRemovidas = linhasParaDeletar;
      }
    }

    // ─── 3. COMPACTAÇÃO DE LINHAS E COLUNAS VAZIAS (TRIM) ───────────────────
    var abas = ss.getSheets();
    for (var a = 0; a < abas.length; a++) {
      var sheet = abas[a];
      var compactadas = compactarLinhasEColunasVazias_(sheet);
      relatorio.linhasVaziasCompactadas += compactadas;
    }

    // Registrar no log da planilha que a limpeza foi executada
    try {
      if (logSheet) {
        logSheet.appendRow([
          new Date(),
          'VACUUM_SUCESSO',
          'Limpeza executada: ' + relatorio.linhasDadosRemovidas + ' linhas de dados desduplicadas, ' +
          relatorio.linhasLogsRemovidas + ' logs expurgados, ' + relatorio.linhasVaziasCompactadas + ' linhas vazias podadas.'
        ]);
      }
    } catch (eLog) {}

    return relatorio;
  } catch (err) {
    return {
      sucesso: false,
      erro: err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Remove linhas e colunas vazias além dos dados preenchidos (+ margem de respiro).
 */
function compactarLinhasEColunasVazias_(sheet) {
  var linhasRemovidas = 0;
  try {
    var maxRows = sheet.getMaxRows();
    var lastRow = sheet.getLastRow();
    var RESPIRO_LINHAS = 5;

    if (lastRow > 0 && maxRows > lastRow + RESPIRO_LINHAS) {
      var linhasParaPodar = maxRows - (lastRow + RESPIRO_LINHAS);
      sheet.deleteRows(lastRow + RESPIRO_LINHAS + 1, linhasParaPodar);
      linhasRemovidas = linhasParaPodar;
    }

    var maxCols = sheet.getMaxColumns();
    var lastCol = sheet.getLastColumn();
    var RESPIRO_COLUNAS = 2;

    if (lastCol > 0 && maxCols > lastCol + RESPIRO_COLUNAS) {
      var colsParaPodar = maxCols - (lastCol + RESPIRO_COLUNAS);
      sheet.deleteColumns(lastCol + RESPIRO_COLUNAS + 1, colsParaPodar);
    }
  } catch (eTrim) {}
  return linhasRemovidas;
}

/**
 * Garante que a linha tenha exatamente 'largura' colunas com strings vazias nos buracos.
 */
function preencherColunasVazias_(row, largura) {
  var copia = row.slice();
  while (copia.length < largura) {
    copia.push('');
  }
  return copia;
}

/**
 * Localiza a primeira aba que bater com qualquer um dos nomes candidatos.
 */
function localizarAba_(ss, nomesCandidatos) {
  for (var i = 0; i < nomesCandidatos.length; i++) {
    var s = ss.getSheetByName(nomesCandidatos[i]);
    if (s) return s;
  }
  return null;
}

/**
 * Instala um gatilho para rodar a limpeza semanalmente de forma 100% automática.
 */
function instalarGatilhoLimpezaSemanal() {
  removerGatilhosLimpeza();

  ScriptApp.newTrigger('executarLimpezaAutomaticaSilenciosa')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(23)
    .create();

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Limpeza Automática Ativada!',
      'Um acionador foi criado para executar a rotina de limpeza e compactação todos os Domingos às 23:00.\n\n' +
      'A planilha se manterá leve e otimizada continuamente!',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
}

/**
 * Remove qualquer gatilho anterior da rotina de limpeza para evitar duplicidade.
 */
function removerGatilhosLimpeza() {
  var gatilhos = ScriptApp.getProjectTriggers();
  var removidos = 0;
  for (var i = 0; i < gatilhos.length; i++) {
    if (gatilhos[i].getHandlerFunction() === 'executarLimpezaAutomaticaSilenciosa') {
      ScriptApp.deleteTrigger(gatilhos[i]);
      removidos++;
    }
  }

  try {
    SpreadsheetApp.getUi().alert(
      'Gatilhos Atualizados',
      'Acionadores automáticos anteriores removidos: ' + removidos,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
}

