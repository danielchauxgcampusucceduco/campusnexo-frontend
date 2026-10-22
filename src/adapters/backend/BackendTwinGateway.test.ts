import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendError, BackendTwinGateway } from './BackendTwinGateway';
import type { GatewayUser, TwinGateway } from '../../ports/TwinGateway';

const user = (role: GatewayUser['role']): GatewayUser => ({
  username: 'campus-user',
  role,
  signedIn: true,
});

afterEach(() => vi.unstubAllGlobals());

describe('BackendTwinGateway capabilities', () => {
  it.each([
    ['ADMIN', true, true],
    ['OPERATOR', false, true],
    ['VIEWER', false, false],
    ['SENSOR', false, false],
  ] as const)('maps the %s server role to the allowed UI capabilities', (role, scenarios, operations) => {
    const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', 'token', user(role));

    expect(gateway.capabilities.scenarios).toBe(scenarios);
    expect(gateway.capabilities.operations).toBe(operations);
    expect(gateway.capabilities.checkIn).toBe(false);
    expect(gateway.capabilities.lightControl).toBe(false);
    gateway.stop();
  });

  it('keeps real camera controls behind the edge worker', () => {
    const gateway: TwinGateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', 'token', user('ADMIN'));

    expect(() => gateway.setCameraOnline('AULA-301', false)).toThrow('la cámara se controla desde el edge');
    expect(() => gateway.setTimeScale(2)).toThrow('funciona en tiempo real');
    expect(() => gateway.setLights('AULA-301', false)).toThrow('interruptor del salón');
  });

  it('maps malformed successful JSON to an explicit backend contract error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>proxy failure</html>', { status: 200 })));
    const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', null, user('VIEWER'));

    await expect(gateway.start()).rejects.toMatchObject({
      constructor: BackendError,
      status: 200,
      message: 'El servidor devolvió una respuesta JSON inválida',
    });
  });

  it('aborts stalled REST calls and reports a bounded startup failure', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', null, user('VIEWER'));
    const startup = gateway.start();
    const failure = expect(startup).rejects.toMatchObject({
      constructor: BackendError,
      status: 0,
      message: 'El servidor tardó demasiado en responder',
    });

    await vi.advanceTimersByTimeAsync(10_000);
    await failure;
    vi.useRealTimers();
  });

  it('degrades gracefully when a pushed twin message is malformed JSON', () => {
    const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', null, user('VIEWER'));
    const receive = gateway as unknown as { onTwin: (message: { body: string }) => void };

    expect(() => receive.onTwin({ body: '{invalid' })).not.toThrow();
    expect(gateway.getSnapshot().connection).toBe('degraded');
    gateway.stop();
  });

  it('degrades gracefully when a pushed trace message is malformed JSON', () => {
    const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', null, user('VIEWER'));
    const receive = gateway as unknown as { onTrace: (message: { body: string }) => void };

    expect(() => receive.onTrace({ body: '{invalid' })).not.toThrow();
    expect(gateway.getSnapshot().connection).toBe('degraded');
    gateway.stop();
  });

  it('rejects syntactically valid but incomplete twin event payloads', () => {
    const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', null, user('VIEWER'));
    const receive = gateway as unknown as { onTwin: (message: { body: string }) => void };

    expect(() => receive.onTwin({ body: JSON.stringify({ spaceId: 'A-301', occupancy: -4 }) })).not.toThrow();
    expect(gateway.getSnapshot().twins).toEqual([]);
    expect(gateway.getSnapshot().connection).toBe('degraded');
    gateway.stop();
  });

  it('rejects trace events without an identifier', () => {
    const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', null, user('VIEWER'));
    const receive = gateway as unknown as { onTrace: (message: { body: string }) => void };

    expect(() => receive.onTrace({ body: JSON.stringify({}) })).not.toThrow();
    expect(gateway.getSnapshot().traces).toEqual([]);
    expect(gateway.getSnapshot().connection).toBe('degraded');
    gateway.stop();
  });
});
