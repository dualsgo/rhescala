import { STORAGE_KEYS } from './storageKeys';

export interface AuthSession {
  isAuthenticated: boolean;
  role: 'admin' | 'viewer';
}

const DEFAULT_AUTH_SESSION: AuthSession = {
  isAuthenticated: false,
  role: 'viewer',
};

/**
 * Lê e valida a sessão de autenticação ativa armazenada no sessionStorage.
 * Retorna a sessão padrão caso o storage esteja vazio, inacessível ou corrompido.
 */
export function getAuthSession(): AuthSession {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return DEFAULT_AUTH_SESSION;
    }
    const saved = window.sessionStorage.getItem(STORAGE_KEYS.authSession);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed &&
        typeof parsed.isAuthenticated === 'boolean' &&
        (parsed.role === 'admin' || parsed.role === 'viewer')
      ) {
        return parsed as AuthSession;
      }
    }
  } catch {
    // Falha silenciosa para ambientes sem storage ou JSON corrompido
  }
  return DEFAULT_AUTH_SESSION;
}

/**
 * Grava ou remove a sessão de autenticação no sessionStorage.
 * Se isAuthenticated for false, a chave é removida para limpeza.
 */
export function setAuthSession(session: AuthSession): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;

    if (session.isAuthenticated) {
      window.sessionStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEYS.authSession);
    }
  } catch {
    // Proteção contra QuotaExceededError ou Storage desabilitado
  }
}

/**
 * Remove explicitamente a sessão de autenticação do sessionStorage.
 */
export function clearAuthSession(): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(STORAGE_KEYS.authSession);
  } catch {
    // Proteção contra Storage desabilitado
  }
}
