// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useLocalStorage, keyGenerationMap } from '../hooks/useLocalStorage';
import { apiStore } from '../src/gas-api';
import { globalSyncQueue } from '../src/infrastructure/sync/syncQueue';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useLocalStorage — Conflitos e Tratamento de Eventos Órfãos (Fase 6.9)', () => {
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

  function mountHook<T>(key: string, initialValue: T) {
    let currentValue!: T;
    let setValue!: (val: T | ((prev: T) => T)) => void;
    let reloadFn!: () => Promise<void>;

    function TestComponent() {
      const [val, setVal, reload] = useLocalStorage<T>(key, initialValue);
      currentValue = val;
      setValue = setVal;
      reloadFn = reload;
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
      },
      reload: async () => {
        await act(async () => {
          await reloadFn();
        });
      }
    };
  }

  it('1. isDirty === false + cloud diferente: cloud é aplicada normalmente ao estado local', async () => {
    const key = 'test_clean_cloud_update';
    vi.spyOn(apiStore, 'get').mockResolvedValue('versao_da_nuvem');
    vi.spyOn(apiStore, 'set').mockResolvedValue(undefined);

    const hook = mountHook<string>(key, 'versao_inicial');

    // Executa a carga inicial da nuvem
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Como isDirty é false, a versão da nuvem é adotada sem conflito
    expect(hook.get()).toBe('versao_da_nuvem');
    expect(window.localStorage.getItem(key)).toBe(JSON.stringify('versao_da_nuvem'));
  });

  it('2. isDirty === true + cloud diferente: evento sync-conflict é produzido e local NÃO é sobrescrito antes da decisão', async () => {
    const key = 'test_conflict_detection';
    let cloudValue = 'nuvem_v1';
    vi.spyOn(apiStore, 'get').mockImplementation(async () => cloudValue);
    // Simula que a gravação remota falha (ex: offline), de forma que isDirty permaneça true
    vi.spyOn(apiStore, 'set').mockRejectedValue(new Error('Offline'));

    let conflictDispatched = false;
    let conflictDetail: any = null;

    const conflictListener = (e: Event) => {
      conflictDispatched = true;
      conflictDetail = (e as CustomEvent).detail;
    };
    window.addEventListener('sync-conflict', conflictListener);

    try {
      const hook = mountHook<string>(key, 'inicial');

      // Carga inicial: sincroniza com nuvem_v1
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(hook.get()).toBe('nuvem_v1');

      // Usuário altera localmente para "minha_edicao_local" (marca isDirty = true)
      hook.set('minha_edicao_local');
      expect(hook.get()).toBe('minha_edicao_local');

      // Agora a nuvem muda para "nuvem_v2" (alterada por outro usuário)
      cloudValue = 'nuvem_v2';

      // Dispara o download da nuvem (simulando polling periódico de 60s)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      // Conflito foi detectado!
      expect(conflictDispatched).toBe(true);
      expect(conflictDetail?.key).toBe(key);
      expect(typeof conflictDetail?.resolve).toBe('function');

      // O valor local NÃO foi sobrescrito antes da decisão do usuário!
      expect(hook.get()).toBe('minha_edicao_local');
    } finally {
      window.removeEventListener('sync-conflict', conflictListener);
    }
  });

  it('3. Usuário escolhe "Usar dados da planilha": versão local é substituída pela versão da nuvem', async () => {
    const key = 'test_conflict_use_cloud';
    let cloudValue = 'nuvem_inicial';
    vi.spyOn(apiStore, 'get').mockImplementation(async () => cloudValue);
    vi.spyOn(apiStore, 'set').mockRejectedValue(new Error('Offline'));

    let conflictReceived = false;
    const conflictListener = (e: Event) => {
      conflictReceived = true;
      const detail = (e as CustomEvent).detail;
      // Usuário escolhe aceitar a nuvem
      detail.resolve(true);
    };
    window.addEventListener('sync-conflict', conflictListener);

    try {
      const hook = mountHook<string>(key, 'inicial');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      hook.set('edicao_local_a_ser_descartada');
      cloudValue = 'nuvem_recente_v2';

      // Polling de 60s detecta conflito e listener chama resolve(true)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(conflictReceived).toBe(true);
      // A versão local foi descartada e substituída pela nuvem
      expect(hook.get()).toBe('nuvem_recente_v2');
      expect(window.localStorage.getItem(key)).toBe(JSON.stringify('nuvem_recente_v2'));
    } finally {
      window.removeEventListener('sync-conflict', conflictListener);
    }
  });

  it('4. Usuário escolhe "Manter alterações locais": dado local permanece e não cria loop infinito de persistência', async () => {
    const key = 'test_conflict_keep_local';
    let cloudValue = 'nuvem_original';
    vi.spyOn(apiStore, 'set').mockRejectedValue(new Error('Offline'));
    vi.spyOn(apiStore, 'get').mockImplementation(async () => cloudValue);

    let conflictReceived = false;
    const conflictListener = (e: Event) => {
      conflictReceived = true;
      const detail = (e as CustomEvent).detail;
      // Usuário escolhe manter local
      detail.resolve(false);
    };
    window.addEventListener('sync-conflict', conflictListener);

    try {
      const hook = mountHook<string>(key, 'inicial');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      hook.set('edicao_local_importante');
      cloudValue = 'nuvem_externa_diferente';

      // Polling detecta conflito e usuário escolhe manter local
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(conflictReceived).toBe(true);
      // Dado local permaneceu intacto
      expect(hook.get()).toBe('edicao_local_importante');

      // Avança mais tempo e verifica que a fila permanece estável (sem loops)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      expect(globalSyncQueue.isRunning).toBe(false);
      expect(globalSyncQueue.size).toBe(0);
    } finally {
      window.removeEventListener('sync-conflict', conflictListener);
    }
  });

  it('5. Duas detecções consecutivas de conflito: tratadas de forma independente e consistente', async () => {
    const key = 'test_consecutive_conflicts';
    let cloudValue = 'nuvem_v1';
    vi.spyOn(apiStore, 'get').mockImplementation(async () => cloudValue);
    vi.spyOn(apiStore, 'set').mockRejectedValue(new Error('Offline'));

    let conflictCount = 0;
    const conflictListener = (e: Event) => {
      conflictCount++;
      const detail = (e as CustomEvent).detail;
      // Na primeira, mantém local; na segunda, aceita nuvem
      if (conflictCount === 1) {
        detail.resolve(false);
      } else {
        detail.resolve(true);
      }
    };
    window.addEventListener('sync-conflict', conflictListener);

    try {
      const hook = mountHook<string>(key, 'inicial');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      // 1. Edição local 1
      hook.set('local_1');
      cloudValue = 'nuvem_v2';
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(conflictCount).toBe(1);
      expect(hook.get()).toBe('local_1');

      // 2. A nuvem muda novamente para v3
      cloudValue = 'nuvem_v3';
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(conflictCount).toBe(2);
      expect(hook.get()).toBe('nuvem_v3');
    } finally {
      window.removeEventListener('sync-conflict', conflictListener);
    }
  });

  it('6. Retry esgotado: sync-persistent-error é produzido e dados não são marcados como sincronizados na nuvem', async () => {
    const key = 'test_persistent_error_event';
    vi.spyOn(apiStore, 'get').mockResolvedValue(null);
    vi.spyOn(apiStore, 'set').mockImplementation(async () => {
      throw new Error('Falha 500 do servidor');
    });

    let persistentErrorDispatched = false;
    let persistentErrorKey = '';

    const errorListener = (e: Event) => {
      persistentErrorDispatched = true;
      persistentErrorKey = (e as CustomEvent).detail?.key;
    };
    window.addEventListener('sync-persistent-error', errorListener);

    try {
      const hook = mountHook<string>(key, 'inicial');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      hook.set('dado_que_falhara');

      // Tentativa 1 (debounce 2500ms)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });

      // Retry 1 (5000ms)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // Retry 2 (5000ms) -> esgota os retries
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(persistentErrorDispatched).toBe(true);
      expect(persistentErrorKey).toBe(key);
      // Os dados permanecem preservados localmente no localStorage
      expect(window.localStorage.getItem(key)).toBe(JSON.stringify('dado_que_falhara'));
    } finally {
      window.removeEventListener('sync-persistent-error', errorListener);
    }
  });

  it('7. Falha persistente em uma chave não impede outra chave de sincronizar normalmente', async () => {
    const keyFalha = 'key_que_falha';
    const keySucesso = 'key_que_tem_sucesso';

    vi.spyOn(apiStore, 'get').mockResolvedValue(null);
    vi.spyOn(apiStore, 'set').mockImplementation(async (key) => {
      if (key === keyFalha) throw new Error('Falha persistente');
      return undefined;
    });

    let setF!: (v: string) => void;
    let setS!: (v: string) => void;
    let valS!: string;

    function TwoHooksComponent() {
      const [, sF] = useLocalStorage<string>(keyFalha, 'initF');
      const [vS, sS] = useLocalStorage<string>(keySucesso, 'initS');
      setF = sF;
      setS = sS;
      valS = vS;
      return null;
    }

    act(() => {
      root!.render(React.createElement(TwoHooksComponent));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Dispara falha na primeira chave
    act(() => {
      setF('dado_falho');
    });

    // Dispara edição na segunda chave
    act(() => {
      setS('dado_com_sucesso');
    });

    // Avança debounce de 2500ms e retries
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    // A segunda chave completou com sucesso e está preservada
    expect(valS).toBe('dado_com_sucesso');
    expect(window.localStorage.getItem(keySucesso)).toBe(JSON.stringify('dado_com_sucesso'));
  });
});
