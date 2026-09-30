export type AsyncTask<T> = () => Promise<T>;

interface QueueItem<T = unknown> {
  task: AsyncTask<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

/**
 * Fila de sincronização estritamente serializada para transporte de rede.
 * Garante que apenas uma tarefa assíncrona seja executada por vez dentro da aba.
 * Rejeições ou erros em uma tarefa não travam o processamento das tarefas subsequentes.
 */
export class SyncQueue {
  private queue: QueueItem<unknown>[] = [];
  private isProcessing = false;

  /**
   * Enfileira uma tarefa assíncrona para execução serial.
   * Retorna a Promise com o resultado ou erro da tarefa específica.
   */
  enqueue<T>(task: AsyncTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task: task as AsyncTask<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processNext();
    });
  }

  /**
   * Informa se a fila está processando alguma tarefa no momento.
   */
  get isRunning(): boolean {
    return this.isProcessing;
  }

  /**
   * Informa o número de tarefas na fila (incluindo a tarefa em execução).
   */
  get size(): number {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift();

    if (item) {
      try {
        const result = await item.task();
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      } finally {
        this.isProcessing = false;
        // Agenda o próximo item para o próximo tick do event loop
        setTimeout(() => this.processNext(), 0);
      }
    } else {
      this.isProcessing = false;
    }
  }

  /**
   * Limpa a fila pendente e cancela as promises aguardando.
   */
  clear(): void {
    const pending = this.queue.splice(0, this.queue.length);
    for (const item of pending) {
      item.reject(new Error('Fila de sincronização cancelada/limpa'));
    }
  }
}

/**
 * Instância singleton compartilhada de fila de sincronização por aba.
 */
export const globalSyncQueue = new SyncQueue();
