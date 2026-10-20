import { BackendTwinGateway } from '../adapters/backend/BackendTwinGateway';
import { InMemoryPhysicsGateway } from '../adapters/simulation/InMemoryPhysicsGateway';
import type { DataSourceMode, TwinGateway } from '../ports/TwinGateway';

const PROBE_TIMEOUT_MS = 2_500;

export interface DataSourceConfig {
  apiBase: string;
  wsUrl: string;
  preference: DataSourceMode | 'auto';
}

export function readConfig(): DataSourceConfig {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || '/api/v1';
  const explicitWs = import.meta.env.VITE_WS_URL as string | undefined;
  const wsUrl = explicitWs || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  const raw = (import.meta.env.VITE_DATA_SOURCE as string | undefined) ?? 'auto';
  const preference = raw === 'backend' || raw === 'simulation' ? raw : 'auto';
  return { apiBase, wsUrl, preference };
}

/**
 * Chooses the adapter behind the TwinGateway port: the Java backend when it answers, otherwise the
 * in-browser physics simulation, so the dashboard always works during the defense.
 */
export async function createGateway(config: DataSourceConfig, requested: DataSourceMode | 'auto' = config.preference): Promise<TwinGateway> {
  if (requested === 'simulation') return new InMemoryPhysicsGateway();
  const reachable = await BackendTwinGateway.probe(config.apiBase, PROBE_TIMEOUT_MS);
  if (reachable) {
    const backend = new BackendTwinGateway(config.apiBase, config.wsUrl);
    try {
      await backend.start();
      return backend;
    } catch {
      backend.stop();
    }
  }
  if (requested === 'backend') {
    throw new Error(`No se pudo conectar con el backend en ${config.apiBase}`);
  }
  return new InMemoryPhysicsGateway();
}
