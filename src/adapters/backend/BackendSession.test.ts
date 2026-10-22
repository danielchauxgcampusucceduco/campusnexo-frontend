import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendUnavailableError, fetchSession, InvalidCredentialsError, login, logout, storedToken } from './BackendSession';

afterEach(() => vi.unstubAllGlobals());

describe('fetchSession', () => {
  it.each([
    ['unknown mode', { mode: 'unknown', authenticated: false, username: null, role: null, expiresAt: null }],
    ['authenticated without identity', { mode: 'enforced', authenticated: true, username: null, role: null, expiresAt: null }],
    ['invalid role', { mode: 'enforced', authenticated: true, username: 'daniel', role: 'ROOT', expiresAt: null }],
    ['invalid authenticated flag', { mode: 'development', authenticated: 'yes', username: null, role: null, expiresAt: null }],
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
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: '', username: 'daniel', role: 'ADMIN' }), { status: 200 }),
    ));

    await expect(login('/api/v1', 'daniel', 'secret')).rejects.toBeInstanceOf(BackendUnavailableError);
    expect(storage.setItem).not.toHaveBeenCalled();
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
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('storage disabled'); },
      removeItem: () => { throw new Error('storage disabled'); },
      setItem: () => { throw new Error('storage disabled'); },
    });

    expect(storedToken()).toBeNull();
    expect(() => logout()).not.toThrow();
  });
});
