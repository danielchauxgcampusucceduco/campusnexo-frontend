import { Client, type IMessage } from '@stomp/stompjs';
import type {
  ArchitectureTrace,
  SavingsReport,
  ScenarioInfo,
  SimulationScenario,
  SpaceTwinState,
  TwinSpace,
} from '../../domain/model';
import { SCENARIO_CATALOG } from '../../domain/scenarios';
import type { CameraFrame, ConnectionState, GatewayCapabilities, TwinGateway, TwinSnapshot } from '../../ports/TwinGateway';
import { reconstructFrame } from './reconstructFrame';

const MAX_TRACES = 40;
const SAVINGS_REFRESH_MS = 10_000;

interface SimulationResponse {
  scenario: SimulationScenario;
  spaces: TwinSpace[];
  trace: ArchitectureTrace | null;
}

export class BackendError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Adapter for the Java backend: REST for queries and commands, STOMP over WebSocket for pushed twin
 * updates (/topic/twin) and architecture traces (/topic/traces).
 */
export class BackendTwinGateway implements TwinGateway {
  readonly mode = 'backend' as const;
  readonly capabilities: GatewayCapabilities = { checkIn: false, cameraControl: false, timeScale: false, lightControl: false };

  private twins: TwinSpace[] = [];
  private savings: SavingsReport | null = null;
  private traces: ArchitectureTrace[] = [];
  private highlighted: ArchitectureTrace | null = null;
  private catalog: ScenarioInfo[] = SCENARIO_CATALOG;
  private connection: ConnectionState = 'connecting';
  private listeners = new Set<() => void>();
  private snapshot: TwinSnapshot;
  private stomp: Client | null = null;
  private savingsTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly apiBase: string, private readonly wsUrl: string) {
    this.snapshot = this.build();
  }

  /** Fails fast when the backend is unreachable, so the dual gateway can fall back. */
  static async probe(apiBase: string, timeoutMs: number): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${apiBase}/twin/spaces`, { signal: controller.signal });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async start(): Promise<void> {
    const [twins, savings, traces] = await Promise.all([
      this.get<TwinSpace[]>('/twin/spaces'),
      this.get<SavingsReport>('/twin/savings'),
      this.get<ArchitectureTrace[]>('/twin/traces?limit=20'),
    ]);
    this.twins = twins;
    this.savings = savings;
    this.traces = traces;
    try {
      this.catalog = await this.get<ScenarioInfo[]>('/simulation/scenarios');
    } catch (error) {
      if (!(error instanceof BackendError && error.status === 404)) throw error;
      this.catalog = [];
    }
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

  scenarios(): ScenarioInfo[] {
    return this.catalog;
  }

  async runScenario(scenario: SimulationScenario): Promise<ArchitectureTrace | null> {
    const response = await this.send<SimulationResponse>(`/simulation/${scenario}`, 'POST');
    for (const twin of response.spaces) this.mergeTwin(twin);
    if (response.trace) {
      this.addTrace(response.trace);
      this.highlighted = response.trace;
    }
    await this.refreshSavings();
    this.publish();
    return response.trace;
  }

  /** The backend only receives the room state from its Arduino; the dashboard cannot switch the lights. */
  setLights(): void {
    // Intentionally empty: capability lightControl is false.
  }

  setCameraOnline(): void {
    throw new Error('Con el backend la cámara se controla desde el edge; usa el escenario FALLO_CAMARA');
  }

  async checkIn(): Promise<void> {
    throw new Error('El check-in requiere la app estudiantil autenticada; está disponible en el modo de simulación');
  }

  setTimeScale(): void {
    throw new Error('El backend funciona en tiempo real');
  }

  timeScale(): number {
    return 1;
  }

  sampleCamera(spaceId: string, realTimeMs: number): CameraFrame | null {
    const twin = this.twins.find((t) => t.space.spaceId === spaceId);
    return twin ? reconstructFrame(twin, realTimeMs) : null;
  }

  // ---- internals ---------------------------------------------------------------------------

  private connectStomp(): void {
    this.stomp = new Client({
      brokerURL: this.wsUrl,
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

  private onTwin(message: IMessage): void {
    const state = JSON.parse(message.body) as SpaceTwinState;
    const existing = this.twins.find((t) => t.space.spaceId === state.spaceId);
    if (existing) {
      this.mergeTwin({ ...existing, state });
      this.publish();
    }
  }

  private onTrace(message: IMessage): void {
    this.addTrace(JSON.parse(message.body) as ArchitectureTrace);
    this.publish();
  }

  private mergeTwin(twin: TwinSpace): void {
    const index = this.twins.findIndex((t) => t.space.spaceId === twin.space.spaceId);
    this.twins = index < 0 ? [...this.twins, twin] : this.twins.map((t, i) => (i === index ? twin : t));
  }

  private addTrace(trace: ArchitectureTrace): void {
    if (this.traces.some((t) => t.traceId === trace.traceId)) return;
    this.traces = [trace, ...this.traces].slice(0, MAX_TRACES);
  }

  private async refreshSavings(): Promise<void> {
    try {
      this.savings = await this.get<SavingsReport>('/twin/savings');
      this.publish();
    } catch {
      this.connection = 'degraded';
      this.publish();
    }
  }

  private get<T>(path: string): Promise<T> {
    return this.send<T>(path, 'GET');
  }

  private async send<T>(path: string, method: 'GET' | 'POST'): Promise<T> {
    const response = await fetch(`${this.apiBase}${path}`, { method, headers: { Accept: 'application/json' } });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const problem = (await response.json()) as { detail?: string };
        if (problem.detail) detail = problem.detail;
      } catch {
        // The body is not a ProblemDetail; keep the status line.
      }
      throw new BackendError(response.status, detail);
    }
    return (await response.json()) as T;
  }

  private publish(): void {
    this.snapshot = this.build();
    for (const listener of this.listeners) listener();
  }

  private build(): TwinSnapshot {
    const frames: Record<string, CameraFrame> = {};
    for (const twin of this.twins) frames[twin.space.spaceId] = reconstructFrame(twin, 0);
    return {
      twins: this.twins,
      savings: this.savings,
      traces: this.traces,
      frames,
      now: Date.now(),
      connection: this.connection,
      highlightedTrace: this.highlighted,
    };
  }
}
