import { afterEach, describe, expect, it, vi } from 'vitest';
import { twinSpace, twinState } from '../../test/fixtures';
import type { GatewayUser } from '../../ports/TwinGateway';
import { BackendError, BackendTwinGateway } from './BackendTwinGateway';

const user = (role: GatewayUser['role']): GatewayUser => ({ username: 'campus-user', role, signedIn: true });

type Internal = {
  twins: ReturnType<typeof twinSpace>[];
  onTwin: (message: { body: string }) => void;
  onTrace: (message: { body: string }) => void;
  refreshSavings: () => Promise<void>;
};

function gatewayWith(role: GatewayUser['role'] = 'VIEWER') {
  const gateway = new BackendTwinGateway('/api/v1', 'ws://localhost/ws', null, user(role));
  return { gateway, internal: gateway as unknown as Internal };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('BackendTwinGateway', () => {
  it.each([
    ['ADMIN', true, true],
    ['OPERATOR', true, false],
    ['VIEWER', false, false],
    ['SENSOR', false, false],
  ] as const)('maps the %s server role to the screens it may use', (role, operations, administration) => {
    const { gateway } = gatewayWith(role);

    expect(gateway.capabilities).toEqual({ operations, administration });
    gateway.stop();
  });

  it('maps malformed successful JSON to an explicit backend contract error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>proxy failure</html>', { status: 200 })));
    const { gateway } = gatewayWith();

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
    const { gateway } = gatewayWith();
    const failure = expect(gateway.start()).rejects.toMatchObject({
      constructor: BackendError,
      status: 0,
      message: 'El servidor tardó demasiado en responder',
    });

    await vi.advanceTimersByTimeAsync(10_000);
    await failure;
  });

  it('keeps the ProblemDetail code so the UI can ask for the VPN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'Fuera de la red de administración', code: 'admin_network_required' }), { status: 403 },
    )));
    const { gateway } = gatewayWith('ADMIN');

    await expect(gateway.http('/admin/personas')).rejects.toMatchObject({ status: 403, code: 'admin_network_required' });
    expect(gateway.getSnapshot().connection).toBe('connecting');
  });

  it('marks the session unauthorized when any request returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'session expired' }), { status: 401 })));
    const { gateway } = gatewayWith('ADMIN');

    await expect(gateway.http('/admin/personas')).rejects.toBeInstanceOf(BackendError);
    expect(gateway.getSnapshot().connection).toBe('unauthorized');
    gateway.stop();
  });

  it('degrades the connection when a scheduled savings refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network offline')));
    const { gateway, internal } = gatewayWith();

    await internal.refreshSavings();

    expect(gateway.getSnapshot().connection).toBe('degraded');
  });

  it('degrades gracefully on malformed pushed messages', () => {
    const { gateway, internal } = gatewayWith();

    expect(() => internal.onTwin({ body: '{invalid' })).not.toThrow();
    expect(() => internal.onTrace({ body: JSON.stringify({}) })).not.toThrow();
    expect(gateway.getSnapshot().traces).toEqual([]);
    expect(gateway.getSnapshot().connection).toBe('degraded');
  });

  it.each([
    ['an unknown status', { status: 'UNKNOWN' }],
    ['a non-finite reading', { indoorTemperatureC: Number.NaN }],
    ['a negative occupancy', { occupancy: -4 }],
    ['a padded room id', { spaceId: ' 301-A ' }],
    ['an unknown HVAC mode', { hvacMode: 'TURBO' }],
    ['no presence counts', { teachersPresent: undefined }],
    ['no recognized scenarios', { escenarios: undefined }],
  ])('rejects twin events with %s', (_case, override) => {
    const { gateway, internal } = gatewayWith();
    internal.twins = [twinSpace()];

    internal.onTwin({ body: JSON.stringify({ ...twinState({ updatedAt: '2026-10-21T12:01:00Z' }), ...override }) });

    expect(internal.twins[0]!.state.updatedAt).toBe('2026-10-21T12:00:00Z');
    expect(gateway.getSnapshot().connection).toBe('degraded');
  });

  it('applies newer states and ignores out-of-order or duplicate ones', () => {
    const { gateway, internal } = gatewayWith();
    internal.twins = [twinSpace()];

    internal.onTwin({ body: JSON.stringify(twinState({ updatedAt: '2026-10-21T11:59:00Z', status: 'MANTENIMIENTO' })) });
    internal.onTwin({ body: JSON.stringify(twinState({ status: 'OCUPADO_OPTIMO' })) });
    expect(internal.twins[0]!.state.status).toBe('LIBRE');

    gateway.accept(twinState({
      updatedAt: '2026-10-21T12:00:05Z', status: 'OCUPADO_OPTIMO', teachersPresent: 1, studentsPresent: 24,
      escenarios: [{ escenario: 'CLASE_EN_CURSO', descripcion: 'Docente frente al tablero y estudiantes en sus puestos' }],
    }));
    const state = gateway.getSnapshot().twins[0]!.state;
    expect(state.status).toBe('OCUPADO_OPTIMO');
    expect(state.escenarios.map((e) => e.escenario)).toEqual(['CLASE_EN_CURSO']);
    expect(gateway.getSnapshot().connection).toBe('connecting');
  });

  it('measures the latency from the camera frame to this browser', () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-21T12:00:10.000Z') });
    const { gateway, internal } = gatewayWith();
    internal.twins = [twinSpace()];
    expect(gateway.getSnapshot().latency).toBeNull();

    gateway.accept(twinState({ updatedAt: '2026-10-21T12:00:09Z', lastCameraFrameAt: '2026-10-21T12:00:09.400Z' }));
    // Same frame again (an environment reading): no new sample.
    gateway.accept(twinState({ updatedAt: '2026-10-21T12:00:09.500Z', lastCameraFrameAt: '2026-10-21T12:00:09.400Z' }));

    expect(gateway.getSnapshot().latency).toEqual({ p50Ms: 600, p95Ms: 600, samples: 1 });
  });
});
