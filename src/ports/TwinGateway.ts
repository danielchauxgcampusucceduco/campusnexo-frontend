import type { ArchitectureTrace, SavingsReport, SpaceTwinState, TwinSpace } from '../domain/model';

/** 'unauthorized': the session expired or was revoked; the person must sign in again. */
export type ConnectionState = 'connecting' | 'live' | 'degraded' | 'offline' | 'unauthorized';

/**
 * From the camera frame captured at the edge to the twin event received by this browser (QA-2: p95 ≤ 2 s).
 * Edge and browser clocks are compared directly, so a skew between them shifts the figure.
 */
export interface Latency {
  p50Ms: number;
  p95Ms: number;
  samples: number;
}

export interface TwinSnapshot {
  twins: TwinSpace[];
  savings: SavingsReport | null;
  traces: ArchitectureTrace[];
  /** Wall time of the last update. */
  now: number;
  connection: ConnectionState;
  latency: Latency | null;
}

export interface GatewayCapabilities {
  /** Manual controls, reservations and alerts (OPERATOR or ADMIN). */
  operations: boolean;
  /** People, workstations and the AI tools (ADMIN, from the administration network). */
  administration: boolean;
}

/** Who is using the dashboard. */
export interface GatewayUser {
  username: string;
  role: 'VIEWER' | 'OPERATOR' | 'ADMIN' | 'SENSOR';
  /** False when the backend runs in development mode without sign-in. */
  signedIn: boolean;
}

/** Driven port of the dashboard: the live twin of the campus. */
export interface TwinGateway {
  readonly capabilities: GatewayCapabilities;
  readonly user: GatewayUser;
  start(): Promise<void>;
  stop(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): TwinSnapshot;
  /** Merges a state the backend returned to a command, without waiting for the push. */
  accept(state: SpaceTwinState): void;
  /** Reloads one room after its catalog data changed (the push only carries the state). */
  refresh(spaceId: string): Promise<void>;
}
