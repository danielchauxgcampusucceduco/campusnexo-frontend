/**
 * Domain model of the dashboard. Names and JSON shapes mirror the Java backend
 * (edu.campusnexo.domain and infrastructure.adapter.contract.TwinContracts) one to one,
 * so a value received over REST or STOMP is already a domain value.
 */

export const SPACE_STATUSES = [
  'LIBRE',
  'RESERVADO_EN_ESPERA',
  'OCUPADO_OPTIMO',
  'ALERTA_SUBUTILIZADO',
  'ALERTA_SOBRECUPO',
  'LIBERADO_POR_NO_SHOW',
  'HABILITADO_POPUP_PARCIALES',
  'MANTENIMIENTO',
] as const;
export type SpaceStatus = (typeof SPACE_STATUSES)[number];

/** Java: edu.campusnexo.domain.twin.HvacControlState (the supervisory "HVAC mode"). */
export const HVAC_CONTROL_STATES = [
  'APAGADO',
  'PRE_ENFRIAMIENTO_IA',
  'PRE_CALENTAMIENTO_IA',
  'CONFORT_ACTIVO',
  'ECO_SETBACK_ENTRE_CLASES',
  'CORTE_INERCIA_TERMICA',
  'BLOQUEO_AHORRO_VACIO',
  'VENTILACION_CO2_ACTIVA',
  'OVERRIDE_MANUAL_DOCENTE',
  'SIN_CLIMATIZACION',
] as const;
export type HvacControlState = (typeof HVAC_CONTROL_STATES)[number];

/** Share of rated power drawn in each state; same values as HvacControlState.powerFraction(). */
export const HVAC_POWER_FRACTION: Record<HvacControlState, number> = {
  APAGADO: 0,
  PRE_ENFRIAMIENTO_IA: 1,
  PRE_CALENTAMIENTO_IA: 1,
  CONFORT_ACTIVO: 1,
  ECO_SETBACK_ENTRE_CLASES: 0.4,
  CORTE_INERCIA_TERMICA: 0,
  BLOQUEO_AHORRO_VACIO: 0,
  VENTILACION_CO2_ACTIVA: 0.25,
  OVERRIDE_MANUAL_DOCENTE: 1,
  SIN_CLIMATIZACION: 0,
};

export const COMPRESSOR_ON: ReadonlySet<HvacControlState> = new Set([
  'PRE_ENFRIAMIENTO_IA',
  'PRE_CALENTAMIENTO_IA',
  'CONFORT_ACTIVO',
  'ECO_SETBACK_ENTRE_CLASES',
  'OVERRIDE_MANUAL_DOCENTE',
]);

/** Java: edu.campusnexo.domain.climate.HvacMode — what the unit does inside a strategy. */
export const HVAC_MODES = ['APAGADO', 'CALEFACCION', 'ENFRIAMIENTO', 'DESHUMIDIFICACION'] as const;
export type HvacMode = (typeof HVAC_MODES)[number];

export type ZoneDeskState = 'DISPONIBLE' | 'OCUPADO_VERIFICADO' | 'ALERTA_ACAPARAMIENTO' | 'LIBERADO_POR_ABANDONO';
export type DetectedObjectClass = 'PERSON' | 'LAPTOP' | 'BACKPACK' | 'BOOK';
export type SpaceType =
  | 'AULA'
  | 'SALA_ESTUDIO'
  | 'AUDITORIO'
  | 'ADMINISTRATIVA'
  | 'LOGISTICA'
  | 'BIBLIOTECA'
  | 'CAFETERIA'
  | 'LABORATORIO'
  | 'SALA_COMPUTO'
  | 'ZONA_COMUN';

/** Java: RoomCondition, the overall state of a room on the campus map. */
export const ROOM_CONDITIONS = [
  'LIBRE',
  'OCUPADO',
  'SOBRECUPO',
  'LUCES_SIN_OCUPACION',
  'EQUIPOS_SIN_USO',
  'LUCES_Y_EQUIPOS_SIN_USO',
  'MANTENIMIENTO',
] as const;
export type RoomCondition = (typeof ROOM_CONDITIONS)[number];
export type ClimateProfile = 'SEDE_TROPICAL' | 'SEDE_ANDINA' | 'SEDE_TEMPLADA';
export type MeasurementSource = 'CAMARA_YOLO' | 'CO2_BALANCE_MASICO' | 'WIFI_DISPOSITIVOS';
export type HexagonalLayer =
  | 'INBOUND_ADAPTER'
  | 'INPUT_PORT'
  | 'USE_CASE'
  | 'DOMAIN_SERVICE'
  | 'OUTPUT_PORT'
  | 'OUTBOUND_ADAPTER';

/** Java: CampusSpace (TwinContracts.SpaceInfo). */
export interface CampusSpace {
  spaceId: string;
  name: string;
  type: SpaceType;
  capacity: number;
  areaSqm: number;
  buildingId: string;
  buildingName: string;
  branchId: string;
  branchName: string;
  city: string;
  climateProfile: ClimateProfile;
  energyTariffCopPerKwh: number;
  floor: number;
  /** Workstations whose power state the room's Arduino reports. */
  computers: number;
  /** Seat grid seen by the ceiling camera; null for offices and storage rooms. */
  seatRows: number | null;
  seatColumns: number | null;
  /** The room has a climate unit the twin can command (Flyway V15). */
  hvacInstalled: boolean;
  /** The live demonstration may change this room (Flyway V15). */
  simulationAllowed: boolean;
}

/** Normalized image point, [x, y] in 0..1. */
export type NormalizedPoint = readonly [number, number];

/** Java: StudyZoneRoi (TwinContracts.RoiResponse). */
export interface StudyZoneRoi {
  zoneId: string;
  label: string;
  polygon: NormalizedPoint[];
}

/** YOLO xyxyn box. */
export interface BoundingBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/** Java: TrackedDetection (ByteTrack id + class + confidence + box). */
export interface TrackedDetection {
  trackId: number;
  objectClass: DetectedObjectClass;
  confidence: number;
  box: BoundingBox;
}

/** Java: TelemetrySnapshot. */
export interface TelemetrySnapshot {
  spaceId: string;
  capturedAt: number;
  cameraOnline: boolean;
  detections: TrackedDetection[];
  co2Ppm: number;
  indoorTemperatureC: number;
  outdoorTemperatureC: number;
  humidityPct: number;
  illuminanceLux: number;
  wifiDevices: number;
  activePowerKw: number;
}

/** Java: EnvironmentReading, published by the room Arduino (DHT22, light sensor, current sensor). */
export interface EnvironmentReading {
  spaceId: string;
  capturedAt: number;
  temperatureC: number;
  humidityPct: number;
  co2Ppm: number | null;
  illuminanceLux: number;
  lightsOn: boolean;
  devicesOn: number;
}

export interface Reservation {
  reservationId: string;
  startsAt: string;
  endsAt: string;
  expectedAttendees: number;
  reference: string;
  /** Java: ReservationOrigin — created by a person or by a demonstration scenario. */
  origin: ReservationOrigin;
}

export type ReservationOrigin = 'USUARIO' | 'SIMULACION';

/** Java: DeskObservation (TwinContracts.DeskResponse). */
export interface DeskObservation {
  zoneId: string;
  state: ZoneDeskState;
  peopleInside: number;
  belongingsInside: number;
  unattendedSince: string | null;
  unattendedMinutes: number;
  evaluatedAt: string;
}

export interface KalmanMeasurement {
  source: MeasurementSource;
  value: number;
  variance: number;
  gain: number;
}

/** Java: KalmanStep (TwinContracts.KalmanResponse). */
export interface KalmanStep {
  priorEstimate: number;
  priorVariance: number;
  elapsedMinutes: number;
  predictedVariance: number;
  measurements: KalmanMeasurement[];
  posteriorEstimate: number;
  posteriorVariance: number;
}

/** Java: ThermalDecision (TwinContracts.ThermalResponse). */
export interface ThermalDecision {
  recommendedState: HvacControlState;
  mode: HvacMode;
  setpointC: number;
  horizonMinutes: number;
  stepMinutes: number;
  freeRunningTrajectoryC: number[];
  explanation: string;
}

/** Java: SpaceTwinState (TwinContracts.TwinStateResponse). */
export interface SpaceTwinState {
  spaceId: string;
  status: SpaceStatus;
  hvacState: HvacControlState;
  hvacStateSince: string;
  /** What the unit is doing in that strategy, its setpoint and the rule that decided it (Java: HvacSetting). */
  hvacMode: HvacMode;
  hvacSetpointC: number;
  hvacReason: string;
  occupancy: number;
  occupancyEstimate: number;
  occupancyStdDev: number;
  indoorTemperatureC: number;
  outdoorTemperatureC: number;
  co2Ppm: number;
  humidityPct: number;
  cameraOnline: boolean;
  energySavedKwh: number;
  overrideUntil: string | null;
  popUpUntil: string | null;
  maintenance: boolean;
  updatedAt: string;
  desks: DeskObservation[];
  kalman: KalmanStep | null;
  thermal: ThermalDecision | null;
  condition: RoomCondition;
  lightsOn: boolean;
  illuminanceLux: number;
  devicesOn: number;
  devicesTotal: number;
  /** When the room became empty; null while there are people. */
  emptySince: string | null;
  /** Last automatic shutdown of lights and computers. */
  equipmentShutdownAt: string | null;
}

/** TwinContracts.TwinSpaceResponse. */
export interface TwinSpace {
  space: CampusSpace;
  state: SpaceTwinState;
  activeReservation: Reservation | null;
  rois: StudyZoneRoi[];
}

export interface TraceStep {
  layer: HexagonalLayer;
  component: string;
  detail: string;
  offsetMicros: number;
}

/** Java: ArchitectureTrace. */
export interface ArchitectureTrace {
  traceId: string;
  trigger: string;
  spaceId: string;
  startedAt: string;
  steps: TraceStep[];
}

export interface SpaceSavings {
  spaceId: string;
  name: string;
  branchName: string;
  hvacState: HvacControlState;
  ratedKw: number;
  kwh: number;
  cop: number;
  kgCo2: number;
}

export interface SavingsReport {
  generatedAt: string;
  totalKwh: number;
  totalCop: number;
  totalKgCo2: number;
  emissionFactorKgCo2PerKwh: number;
  spaces: SpaceSavings[];
}

export const SIMULATION_SCENARIOS = [
  'CLASE_EN_CURSO',
  'CO2_ALTO',
  'FALLO_CAMARA',
  'SOBRECUPO',
  'NO_SHOW',
  'SUBUTILIZADO',
  'POPUP_PARCIALES',
  'LUCES_ENCENDIDAS',
  'EQUIPOS_ENCENDIDOS',
  'OVERRIDE_DOCENTE',
  'MANTENIMIENTO',
  'ACAPARAMIENTO_BIBLIOTECA',
  'REINICIAR',
] as const;
export type SimulationScenario = (typeof SIMULATION_SCENARIOS)[number];

export interface ScenarioInfo {
  scenario: SimulationScenario;
  spaceId: string;
  description: string;
}
