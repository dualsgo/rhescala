// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getAuthSession, 
  setAuthSession, 
  clearAuthSession 
} from '../src/infrastructure/storage/sessionAuthAdapter';
import { STORAGE_KEYS } from '../src/infrastructure/storage/storageKeys';

describe('sessionAuthAdapter', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('deve retornar sessão desautenticada padrão quando sessionStorage estiver vazio', () => {
    const session = getAuthSession();
    expect(session).toEqual({ isAuthenticated: false, role: 'viewer' });
  });

  it('deve salvar e recuperar sessão autenticada de admin com sucesso', () => {
    setAuthSession({ isAuthenticated: true, role: 'admin' });
    
    expect(window.sessionStorage.getItem(STORAGE_KEYS.authSession)).toBe(
      JSON.stringify({ isAuthenticated: true, role: 'admin' })
    );

    const session = getAuthSession();
    expect(session).toEqual({ isAuthenticated: true, role: 'admin' });
  });

  it('deve salvar e recuperar sessão autenticada de viewer com sucesso', () => {
    setAuthSession({ isAuthenticated: true, role: 'viewer' });
    
    const session = getAuthSession();
    expect(session).toEqual({ isAuthenticated: true, role: 'viewer' });
  });

  it('deve remover a chave ao salvar uma sessão com isAuthenticated: false', () => {
    setAuthSession({ isAuthenticated: true, role: 'admin' });
    expect(window.sessionStorage.getItem(STORAGE_KEYS.authSession)).not.toBeNull();

    setAuthSession({ isAuthenticated: false, role: 'viewer' });
    expect(window.sessionStorage.getItem(STORAGE_KEYS.authSession)).toBeNull();
    expect(getAuthSession()).toEqual({ isAuthenticated: false, role: 'viewer' });
  });

  it('deve remover a chave com clearAuthSession', () => {
    setAuthSession({ isAuthenticated: true, role: 'admin' });
    clearAuthSession();
    expect(window.sessionStorage.getItem(STORAGE_KEYS.authSession)).toBeNull();
    expect(getAuthSession()).toEqual({ isAuthenticated: false, role: 'viewer' });
  });

  it('deve ignorar conteúdo inválido ou corrompido no sessionStorage e retornar padrão', () => {
    window.sessionStorage.setItem(STORAGE_KEYS.authSession, 'invalid-json{{{');
    expect(getAuthSession()).toEqual({ isAuthenticated: false, role: 'viewer' });

    window.sessionStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify({ role: 'superadmin' }));
    expect(getAuthSession()).toEqual({ isAuthenticated: false, role: 'viewer' });

    window.sessionStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify({ isAuthenticated: 'yes', role: 'admin' }));
    expect(getAuthSession()).toEqual({ isAuthenticated: false, role: 'viewer' });
  });
});
