import { BackendOperaciones } from '../adapters/backend/BackendOperaciones';
import { BackendTwinGateway } from '../adapters/backend/BackendTwinGateway';
import { BackendUnavailableError, fetchSession, LoginRequiredError, storedToken } from '../adapters/backend/BackendSession';
import type { OperacionesPort } from '../ports/OperacionesPort';
import type { TwinGateway } from '../ports/TwinGateway';

const PROBE_TIMEOUT_MS = 10_000;

export interface DataSourceConfig {
  apiBase: string;
  wsUrl: string;
}

export function readConfig(): DataSourceConfig {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || '/api/v1';
  const explicitWs = import.meta.env.VITE_WS_URL as string | undefined;
  const wsUrl = explicitWs || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  return { apiBase, wsUrl };
}

export interface Connection {
  gateway: TwinGateway;
  operaciones: OperacionesPort;
}

/**
 * Connects to the backend. The public session endpoint says whether sign-in is required: a missing session
 * raises LoginRequiredError and an unreachable server raises BackendUnavailableError. There is no fallback to
 * invented data. The returned gateway is already started.
 */
export async function connect(config: DataSourceConfig, token: string | null = storedToken()): Promise<Connection> {
  // A cold Render instance takes tens of seconds; the probe waits for it instead of failing fast.
  const session = await fetchSession(config.apiBase, token, PROBE_TIMEOUT_MS);
  if (session.mode === 'enforced' && !session.authenticated) {
    throw new LoginRequiredError('Inicia sesión para ver el campus en vivo.');
  }
  const user = session.authenticated && session.username && session.role
    ? { username: session.username, role: session.role, signedIn: true }
    : { username: 'desarrollo-local', role: 'ADMIN' as const, signedIn: false };
  const gateway = new BackendTwinGateway(config.apiBase, config.wsUrl, session.authenticated ? token : null, user);
  try {
    await gateway.start();
  } catch (error) {
    gateway.stop();
    throw error instanceof Error ? new BackendUnavailableError(error.message) : error;
  }
  return { gateway, operaciones: new BackendOperaciones(gateway.http) };
}
