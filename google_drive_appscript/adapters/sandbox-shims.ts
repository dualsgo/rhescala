// Blindagem de execução prioritária (importada antes de qualquer hook/módulo React)
// Evita SecurityError em iframes sandboxed do Google Apps Script (*.googleusercontent.com)
(function installGasSandboxShims() {
  if (typeof window === 'undefined') return;

  const createMemoryStorage = (): Storage => {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(key, String(value));
      },
    };
  };

  for (const prop of ['localStorage', 'sessionStorage'] as const) {
    try {
      const s = window[prop];
      if (!s) throw new Error('Storage indisponível');
      const probe = '__rhescala_probe__';
      s.setItem(probe, '1');
      s.removeItem(probe);
    } catch {
      try {
        Object.defineProperty(window, prop, {
          value: createMemoryStorage(),
          configurable: true,
        });
      } catch {}
    }
  }

  const NativeBC = (window as any).BroadcastChannel;
  class SafeBroadcastChannel {
    private inner: any = null;
    public onmessage: ((ev: any) => void) | null = null;
    constructor(name: string) {
      if (typeof NativeBC === 'function') {
        try {
          this.inner = new NativeBC(name);
          this.inner.onmessage = (ev: any) => {
            if (typeof this.onmessage === 'function') this.onmessage(ev);
          };
        } catch {
          this.inner = null;
        }
      }
    }
    postMessage(data: any) {
      try {
        this.inner?.postMessage(data);
      } catch {}
    }
    close() {
      try {
        this.inner?.close();
      } catch {}
    }
  }
  try {
    (window as any).BroadcastChannel = SafeBroadcastChannel;
  } catch {}
})();
export {};
