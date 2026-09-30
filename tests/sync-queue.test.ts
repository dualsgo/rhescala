import { describe, it, expect, beforeEach } from 'vitest';
import { SyncQueue } from '../src/infrastructure/sync/syncQueue';

describe('SyncQueue', () => {
  let queue: SyncQueue;

  beforeEach(() => {
    queue = new SyncQueue();
  });

  it('Teste 1 — serialização: deve executar A, B e C estritamente em sequência (nunca concorrentes)', async () => {
    const events: string[] = [];

    const taskA = () => new Promise<void>((resolve) => {
      events.push('A inicia');
      setTimeout(() => {
        events.push('A termina');
        resolve();
      }, 30);
    });

    const taskB = () => new Promise<void>((resolve) => {
      events.push('B inicia');
      setTimeout(() => {
        events.push('B termina');
        resolve();
      }, 20);
    });

    const taskC = () => new Promise<void>((resolve) => {
      events.push('C inicia');
      setTimeout(() => {
        events.push('C termina');
        resolve();
      }, 10);
    });

    await Promise.all([
      queue.enqueue(taskA),
      queue.enqueue(taskB),
      queue.enqueue(taskC)
    ]);

    expect(events).toEqual([
      'A inicia',
      'A termina',
      'B inicia',
      'B termina',
      'C inicia',
      'C termina'
    ]);
  });

  it('Teste 2 — erro não trava fila: quando A rejeita, B deve executar e resolver normalmente', async () => {
    const events: string[] = [];

    const taskA = () => new Promise<void>((_, reject) => {
      events.push('A inicia');
      setTimeout(() => {
        events.push('A falha');
        reject(new Error('Falha de rede em A'));
      }, 20);
    });

    const taskB = () => new Promise<string>((resolve) => {
      events.push('B inicia');
      setTimeout(() => {
        events.push('B conclui');
        resolve('OK de B');
      }, 10);
    });

    let errorA: Error | null = null;
    const promiseA = queue.enqueue(taskA).catch(err => {
      errorA = err;
    });
    const promiseB = queue.enqueue(taskB);

    const resultB = await promiseB;
    await promiseA;

    expect(errorA).toBeInstanceOf(Error);
    expect((errorA as unknown as Error).message).toBe('Falha de rede em A');
    expect(resultB).toBe('OK de B');
    expect(events).toEqual([
      'A inicia',
      'A falha',
      'B inicia',
      'B conclui'
    ]);
  });

  it('Teste 3 — retorno: await enqueue(task) retorna o resultado produzido por task', async () => {
    const task = async () => {
      return { status: 200, data: 'teste_payload' };
    };

    const result = await queue.enqueue(task);
    expect(result).toEqual({ status: 200, data: 'teste_payload' });
  });

  it('Teste 4 — salvamento manual: 10 operações remotas devem executar uma por vez', async () => {
    let activeWorkers = 0;
    let maxConcurrency = 0;
    const completedTasks: number[] = [];

    const createManualTask = (index: number) => async () => {
      activeWorkers++;
      if (activeWorkers > maxConcurrency) {
        maxConcurrency = activeWorkers;
      }

      await new Promise(res => setTimeout(res, 10));
      completedTasks.push(index);
      activeWorkers--;
    };

    const tasks = Array.from({ length: 10 }, (_, i) => createManualTask(i));
    await Promise.all(tasks.map(t => queue.enqueue(t)));

    expect(maxConcurrency).toBe(1);
    expect(completedTasks).toHaveLength(10);
    expect(completedTasks).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('Teste 5 — concorrência auto + manual: auto-sync em andamento não é atropelado pelo salvamento manual', async () => {
    const timeline: string[] = [];

    const autoSyncTask = () => new Promise<void>((resolve) => {
      timeline.push('auto-sync A inicia');
      setTimeout(() => {
        timeline.push('auto-sync A termina');
        resolve();
      }, 40);
    });

    const manualSaveTask = () => new Promise<void>((resolve) => {
      timeline.push('manual-save começa');
      setTimeout(() => {
        timeline.push('manual-save termina');
        resolve();
      }, 20);
    });

    // Dispara auto-sync
    const autoPromise = queue.enqueue(autoSyncTask);

    // Imediatamente tenta disparar manual-save enquanto auto-sync ainda roda
    const manualPromise = queue.enqueue(manualSaveTask);

    await Promise.all([autoPromise, manualPromise]);

    expect(timeline).toEqual([
      'auto-sync A inicia',
      'auto-sync A termina',
      'manual-save começa',
      'manual-save termina'
    ]);
  });

  it('Teste 6 — duas operações automáticas: duas chaves useLocalStorage distintas executam serializadas', async () => {
    const executedKeys: string[] = [];
    let isExecuting = false;
    let hadConcurrency = false;

    const makeKeyTask = (key: string) => async () => {
      if (isExecuting) hadConcurrency = true;
      isExecuting = true;

      await new Promise(res => setTimeout(res, 25));
      executedKeys.push(key);

      isExecuting = false;
    };

    await Promise.all([
      queue.enqueue(makeKeyTask('riHappyEmployeesData')),
      queue.enqueue(makeKeyTask('riHappyValidatedMonths'))
    ]);

    expect(hadConcurrency).toBe(false);
    expect(executedKeys).toEqual(['riHappyEmployeesData', 'riHappyValidatedMonths']);
  });

  it('Teste 7 — duas chamadas consecutivas ao salvamento manual: 2x 10 tarefas executam sequencialmente sem ultrapassar concorrência 1', async () => {
    let activeWorkers = 0;
    let maxConcurrency = 0;
    const executionLog: string[] = [];

    const makeManualBatch = (batchId: number) => {
      return Array.from({ length: 10 }, (_, i) => async () => {
        activeWorkers++;
        if (activeWorkers > maxConcurrency) maxConcurrency = activeWorkers;
        await new Promise(r => setTimeout(r, 5));
        executionLog.push(`batch_${batchId}_task_${i}`);
        activeWorkers--;
      });
    };

    const batch1 = makeManualBatch(1);
    const batch2 = makeManualBatch(2);

    // Ambas chamadas disparam quase juntas
    const p1 = Promise.all(batch1.map(t => queue.enqueue(t)));
    const p2 = Promise.all(batch2.map(t => queue.enqueue(t)));

    await Promise.all([p1, p2]);

    expect(maxConcurrency).toBe(1);
    expect(executionLog).toHaveLength(20);
    // Todos os 10 do batch 1 devem ter executado antes de qualquer um do batch 2
    expect(executionLog.slice(0, 10)).toEqual(Array.from({ length: 10 }, (_, i) => `batch_1_task_${i}`));
    expect(executionLog.slice(10, 20)).toEqual(Array.from({ length: 10 }, (_, i) => `batch_2_task_${i}`));
  });

  it('Teste 8 — auto-sync + manual + auto-sync: preserva a ordem cronológica perfeita de enfileiramento', async () => {
    const sequence: string[] = [];

    const autoSync1 = async () => {
      await new Promise(r => setTimeout(r, 15));
      sequence.push('auto-1');
    };

    const manualTask1 = async () => {
      await new Promise(r => setTimeout(r, 10));
      sequence.push('manual-1');
    };
    const manualTask2 = async () => {
      await new Promise(r => setTimeout(r, 10));
      sequence.push('manual-2');
    };

    const autoSync2 = async () => {
      await new Promise(r => setTimeout(r, 10));
      sequence.push('auto-2');
    };

    await Promise.all([
      queue.enqueue(autoSync1),
      queue.enqueue(manualTask1),
      queue.enqueue(manualTask2),
      queue.enqueue(autoSync2)
    ]);

    expect(sequence).toEqual(['auto-1', 'manual-1', 'manual-2', 'auto-2']);
  });

  it('Teste 9 — falha no meio da fila: erro na tarefa 3 de 5 não interrompe nem altera as tarefas subsequentes', async () => {
    const executed: number[] = [];
    const errors: Array<{ index: number; error: Error }> = [];

    const tasks = [1, 2, 3, 4, 5].map(idx => async () => {
      await new Promise(r => setTimeout(r, 5));
      if (idx === 3) {
        throw new Error(`Erro intencional na tarefa ${idx}`);
      }
      executed.push(idx);
      return idx;
    });

    const promises = tasks.map((t, idx) =>
      queue.enqueue(t).catch(err => {
        errors.push({ index: idx + 1, error: err });
      })
    );

    await Promise.all(promises);

    expect(executed).toEqual([1, 2, 4, 5]);
    expect(errors).toHaveLength(1);
    expect(errors[0].index).toBe(3);
    expect(errors[0].error.message).toBe('Erro intencional na tarefa 3');
  });

  it('Teste 10 — fila recebendo novas tarefas enquanto uma tarefa longa está executando', async () => {
    const events: string[] = [];

    const longTask = async () => {
      events.push('longa_inicia');
      await new Promise(r => setTimeout(r, 40));
      events.push('longa_termina');
    };

    const pLong = queue.enqueue(longTask);

    // Enfileira tarefas enquanto longTask ainda está no meio de sua execução
    setTimeout(() => {
      events.push('tarefa_2_enfileirada');
      queue.enqueue(async () => {
        events.push('tarefa_2_executa');
      });
    }, 10);

    setTimeout(() => {
      events.push('tarefa_3_enfileirada');
      queue.enqueue(async () => {
        events.push('tarefa_3_executa');
      });
    }, 20);

    await pLong;
    // Aguarda conclusão das tarefas posteriores
    await new Promise(r => setTimeout(r, 50));

    expect(events).toEqual([
      'longa_inicia',
      'tarefa_2_enfileirada',
      'tarefa_3_enfileirada',
      'longa_termina',
      'tarefa_2_executa',
      'tarefa_3_executa'
    ]);
  });

  it('Teste 11 — simulação de retry assíncrono: tarefas intermediárias executam imediatamente sem bloquear pelo retry delay', async () => {
    const eventLog: string[] = [];
    let attempts = 0;

    const flakyTask = async () => {
      attempts++;
      eventLog.push(`flaky_tentativa_${attempts}`);
      if (attempts === 1) {
        // Simula falha e agendamento de retry com delay de 30ms
        setTimeout(() => {
          eventLog.push('flaky_reagendada');
          queue.enqueue(flakyTask);
        }, 30);
        throw new Error('Falha temporária');
      }
      return 'sucesso_flaky';
    };

    const normalTask = async () => {
      eventLog.push('normal_executa');
      return 'sucesso_normal';
    };

    // Enfileira a tarefa intermitente e uma tarefa normal logo atrás
    const pFlakyFirst = queue.enqueue(flakyTask).catch(() => 'falha_capturada');
    const pNormal = queue.enqueue(normalTask);

    await Promise.all([pFlakyFirst, pNormal]);

    // A tarefa normal executou imediatamente após a falha da primeira, sem aguardar o timeout de retry!
    expect(eventLog).toEqual([
      'flaky_tentativa_${attempts}'.replace('${attempts}', '1'),
      'normal_executa'
    ]);

    // Aguarda o retry disparar e executar
    await new Promise(r => setTimeout(r, 60));

    expect(eventLog).toEqual([
      'flaky_tentativa_1',
      'normal_executa',
      'flaky_reagendada',
      'flaky_tentativa_2'
    ]);
  });
});
