import { Client, type IMessage } from '@stomp/stompjs';
import type { ArchitectureTrace, SavingsReport, SpaceTwinState, TwinSpace } from '../../domain/model';
import { HVAC_CONTROL_STATES, HVAC_MODES, SPACE_STATUSES } from '../../domain/model';
import type { ConnectionState, GatewayCapabilities, GatewayUser, Latency, TwinGateway, TwinSnapshot } from '../../ports/TwinGateway';
import { httpClient, type Http } from './http';

export { BackendError } from './http';

const MAX_TRACES = 40;
const LATENCY_WINDOW = 60;
const SAVINGS_REFRESH_MS = 10_000;
const TWIN_NUMERIC_FIELDS = [
  'occupancy', 'occupancyEstimate', 'occupancyStdDev', 'indoorTemperatureC', 'outdoorTemperatureC',
  'co2Ppm', 'humidityPct', 'energySavedKwh', 'illuminanceLux', 'devicesOn', 'devicesTotal', 'hvacSetpointC',
  'teachersPresent', 'studentsPresent',
] as const;
const TWIN_BOOLEAN_FIELDS = ['cameraOnline', 'maintenance', 'lightsOn', 'emulated'] as const;

/** The first field of a pushed twin event outside the contract, or null when the event is valid. */
export function twinContractProblem(state: SpaceTwinState): string | null {
  if (!state || typeof state !== 'object') return 'evento';
  if (typeof state.spaceId !== 'string' || !state.spaceId.trim() || state.spaceId !== state.spaceId.trim()) return 'spaceId';
  if (!SPACE_STATUSES.includes(state.status)) return 'status';
  if (!HVAC_CONTROL_STATES.includes(state.hvacState)) return 'hvacState';
  if (!HVAC_MODES.includes(state.hvacMode)) return 'hvacMode';
  const numeric = TWIN_NUMERIC_FIELDS.find((field) => !Number.isFinite(state[field]));
  if (numeric) return numeric;
  const flag = TWIN_BOOLEAN_FIELDS.find((field) => typeof state[field] !== 'boolean');
  if (flag) return flag;
  if (!Number.isSafeInteger(state.occupancy) || state.occupancy < 0) return 'occupancy';
  if (!Array.isArray(state.desks)) return 'desks';
  if (!Array.isArray(state.escenarios)) return 'escenarios';
  if (typeof state.updatedAt !== 'string' || !Number.isFinite(Date.parse(state.updatedAt))) return 'updatedAt';
  return null;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!;
}

/**
 * Adapter for the Java backend: REST for the initial state, STOMP over WebSocket for pushed twin updates
 * (/topic/twin) and architecture traces (/topic/traces). The STOMP CONNECT frame carries the session token too;
 * what the UI offers follows the role the backend granted.
 */
export class BackendTwinGateway implements TwinGateway {
  readonly capabilities: GatewayCapabilities;
  readonly user: GatewayUser;
  /** Shared with the operations adapter, so a 401 anywhere ends the session here. */
  readonly http: Http;

  private twins: TwinSpace[] = [];
  private savings: SavingsReport | null = null;
  private traces: ArchitectureTrace[] = [];
  private latencies: number[] = [];
  private connection: ConnectionState = 'connecting';
  private listeners = new Set<() => void>();
  private snapshot: TwinSnapshot;
  private stomp: Client | null = null;
  private savingsTimer: ReturnType<typeof setInterval> | null = null;

  constructor(apiBase: string, private readonly wsUrl: string, private readonly token: string | null, user: GatewayUser) {
    this.user = user;
    const admin = user.role === 'ADMIN';
    this.capabilities = { operations: admin || user.role === 'OPERATOR', administration: admin };
    this.http = httpClient(apiBase, token, () => this.expire());
    this.snapshot = this.build();
  }

  async start(): Promise<void> {
    const [twins, savings, traces] = await Promise.all([
      this.http<TwinSpace[]>('/twin/spaces'),
      this.http<SavingsReport>('/twin/savings'),
      this.http<ArchitectureTrace[]>('/twin/traces', { query: { limit: 20 } }),
    ]);
    this.twins = twins;
    this.savings = savings;
    this.traces = traces;
    this.connection = 'degraded';
    this.connectStomp();
    this.savingsTimer = setInterval(() => void this.refreshSavings(), SAVINGS_REFRESH_MS);
    this.publish();
  }

  stop(): void {
    if (this.savingsTimer) clearInterval(this.savingsTimer);
    void this.stomp?.deactivate();
    this.stomp = null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): TwinSnapshot {
    return this.snapshot;
  }

  accept(state: SpaceTwinState): void {
    const existing = this.twins.find((t) => t.space.spaceId === state.spaceId);
    if (!existing || Date.parse(state.updatedAt) <= Date.parse(existing.state.updatedAt)) return;
    const frame = state.lastCameraFrameAt ? Date.parse(state.lastCameraFrameAt) : Number.NaN;
    if (Number.isFinite(frame) && state.lastCameraFrameAt !== existing.state.lastCameraFrameAt) {
      this.latencies = [...this.latencies.slice(1 - LATENCY_WINDOW), Math.max(0, Date.now() - frame)];
    }
    this.mergeTwin({ ...existing, state });
    this.publish();
  }

  async refresh(spaceId: string): Promise<void> {
    this.mergeTwin(await this.http<TwinSpace>(`/twin/spaces/${encodeURIComponent(spaceId)}`));
    this.publish();
  }

  // ---- internals ---------------------------------------------------------------------------

  private expire(): void {
    this.connection = 'unauthorized';
    void this.stomp?.deactivate();
    this.publish();
  }

  private connectStomp(): void {
    this.stomp = new Client({
      brokerURL: this.wsUrl,
      connectHeaders: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      reconnectDelay: 3_000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      onConnect: () => {
        this.connection = 'live';
        this.stomp?.subscribe('/topic/twin', (message) => this.onTwin(message));
        this.stomp?.subscribe('/topic/traces', (message) => this.onTrace(message));
        this.publish();
      },
      onWebSocketClose: () => {
        this.connection = 'degraded';
        this.publish();
      },
      onStompError: () => {
        this.connection = 'degraded';
        this.publish();
      },
    });
    this.stomp.activate();
  }

  /**
   * A bad event is dropped and logged. It does not mark the feed as degraded: the socket is still delivering and
   * the next valid event of that room brings it up to date.
   */
  private onTwin(message: IMessage): void {
    let state: SpaceTwinState;
    try {
      state = JSON.parse(message.body) as SpaceTwinState;
    } catch {
      console.warn('Evento del gemelo descartado: JSON inválido');
      return;
    }
    const problem = twinContractProblem(state);
    if (problem) {
      console.warn(`Evento del gemelo descartado (${String(state?.spaceId)}): campo ${problem} fuera de contrato`);
      return;
    }
    this.accept(state);
  }

  private onTrace(message: IMessage): void {
    try {
      const trace = JSON.parse(message.body) as ArchitectureTrace;
      if (!trace || typeof trace !== 'object' || typeof trace.traceId !== 'string' || trace.traceId.length === 0) {
        throw new TypeError('Invalid trace event contract');
      }
      if (!this.traces.some((t) => t.traceId === trace.traceId)) this.traces = [trace, ...this.traces].slice(0, MAX_TRACES);
      this.publish();
    } catch {
      console.warn('Traza descartada: fuera de contrato');
    }
  }

  private mergeTwin(twin: TwinSpace): void {
    this.twins = this.twins.map((t) => (t.space.spaceId === twin.space.spaceId ? twin : t));
  }

  private async refreshSavings(): Promise<void> {
    try {
      this.savings = await this.http<SavingsReport>('/twin/savings');
      // A failed refresh degrades the feed; the next one that works brings it back while the socket is up.
      if (this.connection === 'degraded' && this.stomp?.connected) this.connection = 'live';
      this.publish();
    } catch {
      if (this.connection !== 'unauthorized') this.connection = 'degraded';
      this.publish();
    }
  }

  private latency(): Latency | null {
    if (this.latencies.length === 0) return null;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    return { p50Ms: percentile(sorted, 0.5), p95Ms: percentile(sorted, 0.95), samples: sorted.length };
  }

  private publish(): void {
    this.snapshot = this.build();
    for (const listener of this.listeners) listener();
  }

  private build(): TwinSnapshot {
    return {
      twins: this.twins,
      savings: this.savings,
      traces: this.traces,
      now: Date.now(),
      connection: this.connection,
      latency: this.latency(),
    };
  }
}
