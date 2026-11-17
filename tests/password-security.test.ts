// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { hashEmployeePassword, isHashedPassword, verifyEmployeePassword } from '../src/utils/passwordHash';
import { APPS_SCRIPT_CODE } from '../src/constants/appsScriptCode';
import { apiStore } from '../src/gas-api';

describe('Segurança de Senhas (Hash, Rate Limit e Autorização)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('hashEmployeePassword gera hash SHA-256 prefixado com salt por colaborador e nunca texto puro', async () => {
    const h1 = await hashEmployeePassword('minhaSenhaSegura', 'emp-1');
    const h2 = await hashEmployeePassword('minhaSenhaSegura', 'emp-2');

    expect(isHashedPassword(h1)).toBe(true);
    expect(h1).toMatch(/^sha256v1:[0-9a-f]{64}$/);
    expect(h1).not.toContain('minhaSenhaSegura');
    expect(h1).not.toBe(h2); // Salt por ID garante hashes distintos para a mesma senha

    expect(await verifyEmployeePassword('minhaSenhaSegura', h1, 'emp-1')).toBe(true);
    expect(await verifyEmployeePassword('senhaErrada', h1, 'emp-1')).toBe(false);
  });

  it('verifyEmployeePassword mantém compatibilidade com senhas legadas (padrão 1234 e texto puro)', async () => {
    expect(await verifyEmployeePassword('1234', undefined, 'emp-1')).toBe(true);
    expect(await verifyEmployeePassword('9999', undefined, 'emp-1')).toBe(false);
    expect(await verifyEmployeePassword('legado123', 'legado123', 'emp-1')).toBe(true);
  });

  it('APPS_SCRIPT_CODE implementa hash com salt, migração automática, rate limit e autenticação em update_password', () => {
    expect(APPS_SCRIPT_CODE).toContain('hashPasswordWithSalt');
    expect(APPS_SCRIPT_CODE).toContain('verifyStoredPassword');
    expect(APPS_SCRIPT_CODE).toContain('constantTimeEquals');
    expect(APPS_SCRIPT_CODE).toContain('CacheService.getScriptCache()');
    expect(APPS_SCRIPT_CODE).toContain('currentAdminPassword');
    expect(APPS_SCRIPT_CODE).toContain('Muitas tentativas inválidas');
  });

  it('apiStore.updatePassword envia currentAdminPassword no corpo POST', async () => {
    window.localStorage.setItem('escala_gas_api_url', 'https://script.google.com/macros/s/fake/exec');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const res = await apiStore.updatePassword('viewer', 'novaSenha123', 'adminAtual');
    expect(res.success).toBe(true);

    const [, init] = fetchSpy.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      role: 'viewer',
      newPassword: 'novaSenha123',
      currentAdminPassword: 'adminAtual',
    });
  });
});
