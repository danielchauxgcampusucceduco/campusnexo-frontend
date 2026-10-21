import { BackendTwinGateway } from '../adapters/backend/BackendTwinGateway';
import { BackendUnavailableError, fetchSession, LoginRequiredError, storedToken } from '../adapters/backend/BackendSession';
import { InMemoryPhysicsGateway } from '../adapters/simulation/InMemoryPhysicsGateway';
import type { DataSourceMode, TwinGateway } from '../ports/TwinGateway';

const PROBE_TIMEOUT_MS = 2_500;

export interface DataSourceConfig {
  apiBase: string;
  wsUrl: string;
  /**
   * backend: real data or an explicit error, never a silent switch (production builds default to it).
   * auto: try the backend, fall back to the simulation (development default, for a laptop demo).
   */
  preference: DataSourceMode | 'auto';
}

export function readConfig(): DataSourceConfig {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || '/api/v1';
  const explicitWs = import.meta.env.VITE_WS_URL as string | undefined;
  const wsUrl = explicitWs || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  const raw = import.meta.env.VITE_DATA_SOURCE as string | undefined;
  const fallback = import.meta.env.PROD ? 'backend' : 'auto';
  const preference = raw === 'backend' || raw === 'simulation' || raw === 'auto' ? raw : fallback;
  return { apiBase, wsUrl, preference };
}

/**
 * Chooses the adapter behind the TwinGateway port. With the backend, the public session endpoint says
 * whether sign-in is required; a missing session raises LoginRequiredError and an unreachable server raises
 * BackendUnavailableError, unless the preference is 'auto', which falls back to the in-browser simulation.
 * The returned gateway is already started.
 */
export async function createGateway(config: DataSourceConfig, requested: DataSourceMode | 'auto' = config.preference,
                                    token: string | null = storedToken()): Promise<TwinGateway> {
  if (requested === 'simulation') return simulation();
  let session;
  try {
    session = await fetchSession(config.apiBase, token, PROBE_TIMEOUT_MS);
  } catch (error) {
    if (requested === 'auto') return simulation();
    throw error;
  }
  if (session.mode === 'enforced' && !session.authenticated) {
    throw new LoginRequiredError('Inicia sesión para ver el campus en vivo.');
  }
  const user = session.authenticated && session.username && session.role
    ? { username: session.username, role: session.role, signedIn: true }
    : { username: 'desarrollo-local', role: 'ADMIN' as const, signedIn: false };
  const backend = new BackendTwinGateway(config.apiBase, config.wsUrl, session.authenticated ? token : null, user);
  try {
    await backend.start();
    return backend;
  } catch (error) {
    backend.stop();
    if (requested === 'auto') return simulation();
    throw error instanceof Error ? new BackendUnavailableError(error.message) : error;
  }
}

async function simulation(): Promise<TwinGateway> {
  const gateway = new InMemoryPhysicsGateway();
  await gateway.start();
  return gateway;
}
