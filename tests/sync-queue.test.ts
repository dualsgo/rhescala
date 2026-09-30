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
});
