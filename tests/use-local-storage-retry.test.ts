// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useLocalStorage, keyGenerationMap } from '../hooks/useLocalStorage';
import { apiStore } from '../src/gas-api';
import { globalSyncQueue } from '../src/infrastructure/sync/syncQueue';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useLocalStorage — Auditoria e Correção de Retry Obsoleto', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    keyGenerationMap.clear();
    globalSyncQueue.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Helper para montar o hook e expor getter e setter
  function mountHook<T>(key: string, initialValue: T) {
    let currentValue!: T;
    let setValue!: (val: T | ((prev: T) => T)) => void;

    function TestComponent() {
      const [val, setVal] = useLocalStorage<T>(key, initialValue);
      currentValue = val;
      setValue = setVal;
      return null;
    }

    act(() => {
      root!.render(React.createElement(TestComponent));
    });

    return {
      get: () => currentValue,
      set: (newVal: T | ((prev: T) => T)) => {
        act(() => {
          setValue(newVal);
        });
      }
    };
  }

  it('1. Retry antigo é ignorado quando existe edição posterior (valor antigo nunca volta a ser enviado)', async () => {
    const key = 'test_key_obsolete_retry';
    const calls: unknown[] = [];

    // apiStore.get retorna null (planilha nova)
    vi.spyOn(apiStore, 'get').mockResolvedValue(null);

    // apiStore.set: primeira chamada (versão A) falha, segunda chamada (versão B) tem sucesso
    const apiSetSpy = vi.spyOn(apiStore, 'set').mockImplementation(async (_k, val) => {
      calls.push(val);
      if (val === 'valor_A') {
        throw new Error('Falha simulada na versão A');
      }
      return undefined;
    });

    const hook = mountHook<string>(key, 'inicial');

    // Inicialização
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Edição 1: seta "valor_A"
    hook.set('valor_A');
    expect(hook.get()).toBe('valor_A');

    // Avança debounce de 2500ms para disparar tentativa da versão A
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    // Verifica que versão A foi enviada e falhou
    expect(calls).toEqual(['valor_A']);

    // Agora, antes dos 5000ms do retry de A vencerem, o usuário faz a Edição 2: "valor_B"
    hook.set('valor_B');

    // Avança o tempo de forma a vencer o debounce de B (2500ms) e o timer de retry de A (5000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // O retry de A foi descartado! Somente "valor_B" foi persistido com sucesso!
    // "valor_A" NUNCA mais foi enviado após a criação de "valor_B"
    expect(calls).toEqual(['valor_A', 'valor_B']);
    expect(apiSetSpy).toHaveBeenCalledTimes(2);
  });

  it('2. Retry antigo NÃO é ignorado quando nenhuma edição posterior ocorreu', async () => {
    const key = 'test_key_valid_retry';
    const calls: unknown[] = [];
    let attempt = 0;

    vi.spyOn(apiStore, 'get').mockResolvedValue(null);
    vi.spyOn(apiStore, 'set').mockImplementation(async (_k, val) => {
      attempt++;
      calls.push(val);
      if (attempt === 1) {
        throw new Error('Falha temporária de rede');
      }
      return undefined; // Sucesso na 2ª tentativa (1º retry)
    });

    const hook = mountHook<string>(key, 'inicial');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Edição única: "valor_unico"
    hook.set('valor_unico');

    // Debounce de 2500ms -> primeira tentativa falha
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(calls).toEqual(['valor_unico']);
    expect(attempt).toBe(1);

    // Avança 5000ms para disparar o retry
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // O retry executou com sucesso porque não houve edição posterior!
    expect(attempt).toBe(2);
    expect(calls).toEqual(['valor_unico', 'valor_unico']);
  });

  it('3. Nova edição enquanto o retry está aguardando gera apenas a persistência válida mais recente', async () => {
    const key = 'test_key_debounce_during_retry';
    const sentValues: string[] = [];

    vi.spyOn(apiStore, 'get').mockResolvedValue(null);
    vi.spyOn(apiStore, 'set').mockImplementation(async (_k, val) => {
      sentValues.push(val as string);
      if (val === 'estado_1') {
        throw new Error('Erro no estado 1');
      }
      return undefined;
    });

    const hook = mountHook<string>(key, 'inicial');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // 1. Altera para estado_1 -> falha
    hook.set('estado_1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(sentValues).toEqual(['estado_1']);

    // 2. Passam 2000ms (retry ainda aguarda em setTimeout de 5000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // 3. Usuário altera para estado_2
    hook.set('estado_2');

    // 4. Avança tempo suficiente para disparar debounce de estado_2 e o timer do retry de estado_1
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    // estado_1 falhou uma vez, o retry de estado_1 foi ignorado, e estado_2 persistiu com sucesso
    expect(sentValues).toEqual(['estado_1', 'estado_2']);
  });

  it('4. Falha da versão mais recente continua podendo gerar retry normalmente', async () => {
    const key = 'test_key_latest_can_retry';
    let attempts = 0;
    const sentValues: string[] = [];

    vi.spyOn(apiStore, 'get').mockResolvedValue(null);
    vi.spyOn(apiStore, 'set').mockImplementation(async (_k, val) => {
      sentValues.push(val as string);
      if (val === 'v1') throw new Error('v1 falha');
      if (val === 'v2') {
        attempts++;
        if (attempts === 1) throw new Error('v2 falha na tentativa 1');
        return undefined; // Sucesso na tentativa 2 (retry de v2)
      }
    });

    const hook = mountHook<string>(key, 'inicial');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Altera para v1 -> falha
    hook.set('v1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    // Usuário altera para v2 (invalida retry de v1)
    hook.set('v2');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500); // Debounce de v2
    });

    // v2 executou 1ª tentativa e falhou
    expect(sentValues).toEqual(['v1', 'v2']);

    // Avança 5000ms para retry de v2
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // Retry de v2 executou normalmente!
    expect(sentValues).toEqual(['v1', 'v2', 'v2']);
  });

  it('5. Duas chaves diferentes continuam independentes (retry de employees não invalida jornadaSettings)', async () => {
    const callsEmployees: string[] = [];
    const callsJornada: string[] = [];

    vi.spyOn(apiStore, 'get').mockResolvedValue(null);
    vi.spyOn(apiStore, 'set').mockImplementation(async (key, val) => {
      if (key === 'employees') {
        callsEmployees.push(val as string);
        if (callsEmployees.length === 1) throw new Error('Falha employees');
      } else if (key === 'jornadaSettings') {
        callsJornada.push(val as string);
      }
      return undefined;
    });

    let setEmp!: (v: string) => void;
    let setJor!: (v: string) => void;

    function MultiHookComponent() {
      const [, sE] = useLocalStorage<string>('employees', 'emp_0');
      const [, sJ] = useLocalStorage<string>('jornadaSettings', 'jor_0');
      setEmp = sE;
      setJor = sJ;
      return null;
    }

    act(() => {
      root!.render(React.createElement(MultiHookComponent));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Seta employees para 'emp_1' -> falha
    act(() => {
      setEmp('emp_1');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(callsEmployees).toEqual(['emp_1']);

    // Enquanto o retry de employees aguarda, seta jornadaSettings para 'jor_1'
    act(() => {
      setJor('jor_1');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500); // Debounce de jornada
    });
    expect(callsJornada).toEqual(['jor_1']);

    // Avança o tempo para o retry de employees (5000ms a partir da falha)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // O retry de employees executou com sucesso e NÃO foi invalidado pela alteração em jornadaSettings!
    expect(callsEmployees).toEqual(['emp_1', 'emp_1']);
    expect(callsJornada).toEqual(['jor_1']);
  });

  it('6. Preserva o limite de 2 tentativas de retry quando o erro persiste sem novas edições', async () => {
    const key = 'test_key_max_retries';
    let attempts = 0;

    vi.spyOn(apiStore, 'get').mockResolvedValue(null);
    vi.spyOn(apiStore, 'set').mockImplementation(async () => {
      attempts++;
      throw new Error('Servidor permanentemente fora do ar');
    });

    const hook = mountHook<string>(key, 'inicial');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    hook.set('falha_continua');

    // 1ª tentativa (após debounce de 2500ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(attempts).toBe(1);

    // 1º retry (após 5000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(attempts).toBe(2);

    // 2º retry (após outros 5000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(attempts).toBe(3);

    // Avança mais 10000ms: nenhuma tentativa adicional deve ocorrer (limite de 2 retries respeitado)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(attempts).toBe(3);
  });

  it('7. Garantir que a correção não cria tarefas infinitas na globalSyncQueue', async () => {
    const key = 'test_key_no_infinite_tasks';

    vi.spyOn(apiStore, 'get').mockResolvedValue(null);
    vi.spyOn(apiStore, 'set').mockResolvedValue(undefined);

    const hook = mountHook<string>(key, 'inicial');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // 3 edições rápidas consecutivas
    hook.set('edicao_1');
    hook.set('edicao_2');
    hook.set('edicao_3');

    // Avança debounce de 2500ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    // Após processamento, o tamanho da fila deve retornar a zero
    expect(globalSyncQueue.size).toBe(0);
    expect(globalSyncQueue.isRunning).toBe(false);
  });
});
