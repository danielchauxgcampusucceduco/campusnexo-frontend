import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendUnavailableError, LoginRequiredError } from '../adapters/backend/BackendSession';
import { connect, type DataSourceConfig } from './gatewayFactory';

const config: DataSourceConfig = { apiBase: '/api/v1', wsUrl: 'ws://x/ws' };

afterEach(() => vi.unstubAllGlobals());

describe('connect', () => {
  it('un servidor caído es un error explícito, nunca datos inventados', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('network'))));
    await expect(connect(config)).rejects.toBeInstanceOf(BackendUnavailableError);
  });

  it('si el servidor exige sesión y no hay token, pide iniciar sesión', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      mode: 'enforced', authenticated: false, username: null, role: null, expiresAt: null,
    }), { status: 200 }))));
    await expect(connect(config)).rejects.toBeInstanceOf(LoginRequiredError);
  });

  it('si la carga inicial falla, el error dice que el servidor no está disponible', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(String(input).endsWith('/auth/session')
      ? new Response(JSON.stringify({ mode: 'enforced', authenticated: true, username: 'ana', role: 'ADMIN', expiresAt: null }))
      : new Response('{}', { status: 503 }))));
    await expect(connect(config, 'token')).rejects.toBeInstanceOf(BackendUnavailableError);
  });
});
