import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendUnavailableError, LoginRequiredError } from '../adapters/backend/BackendSession';
import { createGateway, type DataSourceConfig } from './gatewayFactory';

const config = (preference: DataSourceConfig['preference']): DataSourceConfig => ({ apiBase: '/api/v1', wsUrl: 'ws://x/ws', preference });

afterEach(() => vi.unstubAllGlobals());

describe('createGateway', () => {
  it('con preferencia backend, un servidor caído es un error y no un cambio silencioso a la simulación', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('network'))));
    await expect(createGateway(config('backend'))).rejects.toBeInstanceOf(BackendUnavailableError);
  });

  it('en modo auto (solo desarrollo) sí cae a la simulación', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('network'))));
    const gateway = await createGateway(config('auto'));
    expect(gateway.mode).toBe('simulation');
    gateway.stop();
  });

  it('si el servidor exige sesión y no hay token, pide iniciar sesión', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      mode: 'enforced', authenticated: false, username: null, role: null, expiresAt: null,
    }), { status: 200 }))));
    await expect(createGateway(config('backend'))).rejects.toBeInstanceOf(LoginRequiredError);
  });
});
