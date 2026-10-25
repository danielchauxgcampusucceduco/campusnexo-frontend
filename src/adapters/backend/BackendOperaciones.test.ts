import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendOperaciones } from './BackendOperaciones';
import { BackendError, httpClient } from './http';

const problem = (status: number, code: string) => new Response(JSON.stringify({ detail: code, code }), { status });

function operaciones(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return { api: new BackendOperaciones(httpClient('/api/v1', 'token', () => {})), fetchMock };
}

afterEach(() => vi.unstubAllGlobals());

describe('BackendOperaciones', () => {
  it('reads "no proposal yet" and "no history yet" as empty results, not as failures', async () => {
    await expect(operaciones(problem(404, 'propuesta_not_found')).api.propuesta('301-A')).resolves.toBeNull();
    await expect(operaciones(problem(409, 'history_not_available')).api.pronostico('301-A', 12)).resolves.toBeNull();
  });

  it('keeps every other error, with its code', async () => {
    await expect(operaciones(problem(404, 'space_not_found')).api.propuesta('X')).rejects.toMatchObject({ code: 'space_not_found' });
    await expect(operaciones(problem(503, 'ai_unavailable')).api.pronostico('301-A', 12)).rejects.toBeInstanceOf(BackendError);
  });

  it('sends the confirmation with the discarded seats and the bearer token', async () => {
    const { api, fetchMock } = operaciones(new Response('[]'));

    await api.confirmar('301-A', ['A4']);

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('/api/v1/admin/spaces/301-A/propuesta/confirmar');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ descartar: ['A4'] });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token');
  });

  it('passes room commands as query parameters and escapes the room id', async () => {
    const { api, fetchMock } = operaciones(new Response('{}'));

    await api.setMaintenance('301 A', true);

    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/twin/spaces/301%20A/maintenance?enabled=true');
  });

  it('sends the measurements of a room with PUT', async () => {
    const { api, fetchMock } = operaciones(new Response('{}'));
    const medidas = { capacity: 28, areaSqm: 58.5, seatRows: 4, seatColumns: 7, computers: 28, hvacInstalled: true };

    await api.ajustarEspacio('301-A', medidas);

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('/api/v1/admin/spaces/301-A');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual(medidas);
  });

  it('accepts the empty answer of a deletion', async () => {
    const { api } = operaciones(new Response(null, { status: 204 }));
    await expect(api.eliminarPersona('D-001')).resolves.toBeUndefined();
  });
});
