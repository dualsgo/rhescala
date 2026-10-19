// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toLocalISODate, parseLocalISODate, addDaysToISODate } from '../src/utils/date';
import { apiStore, setConfiguredApiUrl, clearConfiguredApiUrl } from '../src/gas-api';

describe('date utils (fuso local)', () => {
  it('toLocalISODate usa componentes locais, não UTC (ex.: 22h no Brasil)', () => {
    // 19/10/2026 22:30 horário local -> deve continuar sendo dia 19
    const lateNight = new Date(2026, 9, 19, 22, 30, 0);
    expect(toLocalISODate(lateNight)).toBe('2026-10-19');
  });

  it('parseLocalISODate retorna meia-noite local do mesmo dia', () => {
    const d = parseLocalISODate('2026-03-05');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(0);
  });

  it('addDaysToISODate cruza meses e anos corretamente', () => {
    expect(addDaysToISODate('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToISODate('2026-12-20', 29)).toBe('2027-01-18');
    expect(addDaysToISODate('2028-02-28', 1)).toBe('2028-02-29'); // ano bissexto
    expect(addDaysToISODate('', 5)).toBe('');
  });
});

describe('apiStore.login — sem downgrade inseguro para GET', () => {
  const URL_GAS = 'https://script.google.com/macros/s/fake/exec';

  beforeEach(() => {
    setConfiguredApiUrl(URL_GAS);
  });

  afterEach(() => {
    clearConfiguredApiUrl();
    vi.unstubAllGlobals();
  });

  it('falha de rede no POST NÃO envia a senha via GET', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await apiStore.login('segredo');

    expect(result.success).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('password=');
  });

  it('backend legado ("Key not provided") usa fallback GET', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'Key not provided' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, role: 'viewer' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiStore.login('1234');

    expect(result).toEqual({ success: true, role: 'viewer' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe('GET');
  });

  it('resposta normal do POST é retornada sem fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, role: 'admin' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiStore.login('admin');

    expect(result).toEqual({ success: true, role: 'admin' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
