import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendUnavailableError, fetchSession, login } from './BackendSession';

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

  it('does not store a token from a malformed login response', async () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() };
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: '', username: 'daniel', role: 'ADMIN' }), { status: 200 }),
    ));

    await expect(login('/api/v1', 'daniel', 'secret')).rejects.toBeInstanceOf(BackendUnavailableError);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
