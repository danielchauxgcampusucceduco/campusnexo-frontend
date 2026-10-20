import type {
  ArchitectureTrace,
  SavingsReport,
  ScenarioInfo,
  SimulationScenario,
  TrackedDetection,
  TwinSpace,
} from '../domain/model';

export type DataSourceMode = 'backend' | 'simulation';
export type ConnectionState = 'connecting' | 'live' | 'degraded' | 'offline';

/**
 * What the camera "sees" for one space. In simulation the boxes come from the physics engine; with
 * the backend they are reconstructed from the twin (desks and occupancy), because the edge worker never
 * sends images or boxes to the dashboard.
 */
export interface CameraFrame {
  spaceId: string;
  capturedAt: number;
  cameraOnline: boolean;
  detections: TrackedDetection[];
  origin: 'simulacion-edge' | 'reconstruido-desde-gemelo';
}

export interface TwinSnapshot {
  twins: TwinSpace[];
  savings: SavingsReport | null;
  traces: ArchitectureTrace[];
  frames: Record<string, CameraFrame>;
  /** Clock of the data source: simulated time in the browser, wall time with the backend. */
  now: number;
  connection: ConnectionState;
  /** Trace produced by the last user action, so the architecture view can replay it. */
  highlightedTrace: ArchitectureTrace | null;
}

export interface GatewayCapabilities {
  /** Students can check in from the phone mockup (moves a person to the desk). */
  checkIn: boolean;
  /** The camera can be switched off without a scenario. */
  cameraControl: boolean;
  /** Simulated time can be accelerated. */
  timeScale: boolean;
  /** The room lights can be switched from the dashboard (someone at the wall switch). */
  lightControl: boolean;
}

/** Driven port of the dashboard: everything the UI needs from a data source. */
export interface TwinGateway {
  readonly mode: DataSourceMode;
  readonly capabilities: GatewayCapabilities;
  start(): Promise<void>;
  stop(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): TwinSnapshot;
  scenarios(): ScenarioInfo[];
  runScenario(scenario: SimulationScenario): Promise<ArchitectureTrace | null>;
  setCameraOnline(spaceId: string, online: boolean): void;
  setLights(spaceId: string, on: boolean): void;
  checkIn(spaceId: string, zoneId: string): Promise<void>;
  setTimeScale(scale: number): void;
  timeScale(): number;
  /**
   * Live camera sample for the 60 FPS viewer. It is read on every animation frame and therefore kept
   * outside the React snapshot.
   */
  sampleCamera(spaceId: string, realTimeMs: number): CameraFrame | null;
}
