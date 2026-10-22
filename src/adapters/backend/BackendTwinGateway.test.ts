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

  it('marks the backend session unauthorized when a command returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'session expired' }), { status: 401 },
    )));
    const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', 'expired', user('ADMIN'));

    await expect(gateway.runScenario('CLASE_EN_CURSO')).rejects.toBeInstanceOf(BackendError);
    expect(gateway.getSnapshot().connection).toBe('unauthorized');
    gateway.stop();
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

  it('rejects twin events with unknown domain enums and non-finite readings', () => {
    const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', null, user('VIEWER'));
    const receive = gateway as unknown as { onTwin: (message: { body: string }) => void };

    receive.onTwin({ body: JSON.stringify({
      spaceId: 'A-301', status: 'UNKNOWN', hvacState: 'UNKNOWN', cameraOnline: true,
      occupancy: 1, indoorTemperatureC: Number.NaN, updatedAt: '2026-10-21T12:00:00Z', desks: [],
    }) });

    expect(gateway.getSnapshot().twins).toEqual([]);
    expect(gateway.getSnapshot().connection).toBe('degraded');
    gateway.stop();
  });

  it('ignores out-of-order twin events that would roll the room back in time', () => {
    const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', null, user('VIEWER'));
    const internal = gateway as unknown as { twins: { space: { spaceId: string }; state: { updatedAt: string } }[]; onTwin: (message: { body: string }) => void };
    internal.twins = [{ space: { spaceId: 'A-301' }, state: { updatedAt: '2026-10-21T12:00:00Z' } }];

    internal.onTwin({ body: JSON.stringify({
      spaceId: 'A-301', status: 'LIBRE', hvacState: 'APAGADO', cameraOnline: false,
      occupancy: 0, occupancyEstimate: 0, occupancyStdDev: 0, indoorTemperatureC: 20,
      outdoorTemperatureC: 14, co2Ppm: 415, humidityPct: 55, energySavedKwh: 0,
      illuminanceLux: 0, devicesOn: 0, devicesTotal: 0, maintenance: false, lightsOn: false,
      desks: [], updatedAt: '2026-10-21T11:59:00Z',
    }) });

    expect(internal.twins[0]!.state.updatedAt).toBe('2026-10-21T12:00:00Z');
    expect(gateway.getSnapshot().connection).toBe('connecting');
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
