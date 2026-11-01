import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendUnavailableError, fetchSession, InvalidCredentialsError, login, logout, storedToken, storeToken } from './BackendSession';

afterEach(() => vi.unstubAllGlobals());

describe('fetchSession', () => {
  it.each([
    ['unknown mode', { mode: 'unknown', authenticated: false, username: null, role: null, expiresAt: null }],
    ['authenticated without identity', { mode: 'enforced', authenticated: true, username: null, role: null, expiresAt: null }],
    ['invalid role', { mode: 'enforced', authenticated: true, username: 'daniel', role: 'ROOT', expiresAt: null }],
    ['invalid authenticated flag', { mode: 'development', authenticated: 'yes', username: null, role: null, expiresAt: null }],
    ['invalid expiry timestamp', { mode: 'enforced', authenticated: false, username: null, role: null, expiresAt: 'soon' }],
  ])('rejects a malformed session contract (%s)', async (_case, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    ));

    await expect(fetchSession('/api/v1', null, 100)).rejects.toBeInstanceOf(BackendUnavailableError);
  });

  it('sends the current bearer token when checking a session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      mode: 'enforced', authenticated: false, username: null, role: null, expiresAt: null,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchSession('/api/v1', 'session-token', 100);

    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      headers: { Accept: 'application/json', Authorization: 'Bearer session-token' },
    });
  });

  it('aborts an unresponsive session probe after its configured timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const failure = expect(fetchSession('/api/v1', null, 100)).rejects.toBeInstanceOf(BackendUnavailableError);

    await vi.advanceTimersByTimeAsync(100);
    await failure;
    vi.useRealTimers();
  });

  it('does not store a token from a malformed login response', async () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: '', username: 'daniel', role: 'ADMIN' }), { status: 200 }),
    ));

    await expect(login('/api/v1', 'daniel', 'secret')).rejects.toBeInstanceOf(BackendUnavailableError);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('bounds login requests and returns control when the server stalls', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const failure = expect(login('/api/v1', 'daniel', 'secret', 50)).rejects.toBeInstanceOf(BackendUnavailableError);

    await vi.advanceTimersByTimeAsync(50);
    await failure;
    vi.useRealTimers();
  });

  it.each([
    [401, 'Usuario o contraseña incorrectos.'],
    [429, 'Demasiados intentos: espera un minuto.'],
  ])('maps authentication HTTP %i to a safe user-facing error', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));

    await expect(login('/api/v1', 'daniel', 'wrong')).rejects.toMatchObject({
      constructor: InvalidCredentialsError,
      message,
    });
  });

  it('returns no stored token when browser storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage disabled'); },
      removeItem: () => { throw new Error('storage disabled'); },
      setItem: () => { throw new Error('storage disabled'); },
    });

    expect(storedToken()).toBeNull();
    expect(() => logout()).not.toThrow();
  });

  it('keeps the session for other tabs until it expires', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const now = Date.parse('2026-11-01T12:00:00Z');

    storeToken('abc', '2026-11-01T20:00:00Z', now);

    expect(storedToken(now)).toBe('abc');
    expect(storedToken(Date.parse('2026-11-01T20:00:01Z'))).toBeNull();
    expect(values.size).toBe(0);
  });

  it('drops a saved entry it cannot read', () => {
    const values = new Map<string, string>([['campusnexo.session', 'token-from-an-old-version']]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });

    expect(storedToken()).toBeNull();
    expect(values.size).toBe(0);
  });
});
