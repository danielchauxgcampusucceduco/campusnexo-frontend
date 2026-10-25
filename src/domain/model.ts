/**
 * Domain model of the dashboard. Names and JSON shapes mirror the Java backend
 * (edu.campusnexo.domain and infrastructure.adapter.contract.TwinContracts) one to one,
 * so a value received over REST or STOMP is already a domain value. The dashboard only reads and shows
 * them: every rule (fusion, states, scenarios) runs in the backend.
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

/** Java: edu.campusnexo.domain.climate.HvacMode — what the unit does inside a strategy. */
export const HVAC_MODES = ['APAGADO', 'CALEFACCION', 'ENFRIAMIENTO', 'DESHUMIDIFICACION'] as const;
export type HvacMode = (typeof HVAC_MODES)[number];

export type ZoneDeskState = 'DISPONIBLE' | 'OCUPADO_VERIFICADO' | 'ALERTA_ACAPARAMIENTO' | 'LIBERADO_POR_ABANDONO';
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
/** Conditions where something draws power with nobody in the room. */
export const WASTE_CONDITIONS: ReadonlySet<RoomCondition> = new Set(['LUCES_SIN_OCUPACION', 'EQUIPOS_SIN_USO', 'LUCES_Y_EQUIPOS_SIN_USO']);

export type ClimateProfile = 'SEDE_TROPICAL' | 'SEDE_ANDINA' | 'SEDE_TEMPLADA';
export type MeasurementSource = 'CAMARA_YOLO' | 'CO2_BALANCE_MASICO' | 'WIFI_DISPOSITIVOS';
export type HexagonalLayer =
  | 'INBOUND_ADAPTER'
  | 'INPUT_PORT'
  | 'USE_CASE'
  | 'DOMAIN_SERVICE'
  | 'OUTPUT_PORT'
  | 'OUTBOUND_ADAPTER';

/** Java: EscenarioOperativo, recognized by ReconocedorDeEscenarios from the twin state. */
export const ESCENARIOS_OPERATIVOS = [
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
  'ACAPARAMIENTO',
] as const;
export type EscenarioOperativo = (typeof ESCENARIOS_OPERATIVOS)[number];

/** TwinContracts.EscenarioResponse. */
export interface EscenarioReconocido {
  escenario: EscenarioOperativo;
  descripcion: string;
}

/** Java: SeatGrid.TEACHER_ZONE_BOTTOM — the band in front of the board where a person counts as teacher. */
export const TEACHER_ZONE_BOTTOM = 0.3;
/** Java: DeskGhostingPolicy — belongings alone for this long release the desk. */
export const DESK_ABANDON_MINUTES = 15;

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
  /** Seat grid seen by the camera; null for offices and storage rooms. */
  seatRows: number | null;
  seatColumns: number | null;
  /** The room has a climate unit the twin can command. */
  hvacInstalled: boolean;
}

/** Normalized floor point, [x, y] in 0..1; y = 0 is the board. */
export type NormalizedPoint = readonly [number, number];

/** Java: StudyZoneRoi (TwinContracts.RoiResponse). */
export interface StudyZoneRoi {
  zoneId: string;
  label: string;
  polygon: NormalizedPoint[];
}

/** TwinContracts.ReservationInfo. */
export interface Reservation {
  reservationId: string;
  startsAt: string;
  endsAt: string;
  expectedAttendees: number;
  reference: string;
  /** Institutional code of the registered teacher or student in charge; null when nobody was named. */
  holderCode: string | null;
  checkedInAt: string | null;
}

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
  /** People in the band in front of the board (Java: Presence). */
  teachersPresent: number;
  /** People inside a seat region. */
  studentsPresent: number;
  /** The camera data came from the device emulator, not from a real camera. */
  emulated: boolean;
  lastCameraFrameAt: string | null;
  escenarios: EscenarioReconocido[];
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

// ---- Administration (Java: alert, persona, activo and AiAdvisorPort) ------------------------------

export const ALERT_TYPES = [
  'CO2_ALTO',
  'SOBRECUPO',
  'CONSUMO_ESPACIO_VACIO',
  'RESERVA_SIN_USO',
  'CPU_ENCENDIDA_SIN_USUARIO',
  'ACTIVO_FALTANTE',
  'SENSOR_ANOMALO',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertSeverity = 'INFORMATIVA' | 'ADVERTENCIA' | 'CRITICA';

/** AlertResponse. */
export interface Alert {
  alertId: string;
  spaceId: string;
  type: AlertType;
  severity: AlertSeverity;
  detectedAt: string;
  message: string;
  measuredValue: number;
  thresholdValue: number;
}

export type TipoPersona = 'DOCENTE' | 'ESTUDIANTE';

/** PersonaResponse: only the institutional code, name and affiliation; no contact or biometric data. */
export interface Persona {
  tipo: TipoPersona;
  codigo: string;
  nombre: string;
  adscripcion: string;
  puedeReservar: SpaceType[];
  reservaMaximaHoras: number;
}

/** EspacioRequest: measurements taken on site; seatRows and seatColumns both null for a room without seats. */
export interface MedidasEspacio {
  capacity: number;
  areaSqm: number;
  seatRows: number | null;
  seatColumns: number | null;
  computers: number;
  hvacInstalled: boolean;
}

export type TipoActivo = 'CPU' | 'SILLA' | 'MESA';

export interface ActivoDelPuesto {
  codigo: string;
  tipo: TipoActivo;
  fueraDeServicio: boolean;
  potenciaW: number;
  ultimoLatido: string | null;
}

/** PuestoResponse: a workstation (Composite of CPU, chair and desk) and what the camera and its PC report. */
export interface Puesto {
  codigo: string;
  spaceId: string;
  numero: number;
  operativo: boolean;
  potenciaNominalW: number;
  ocupado: boolean;
  cpuEncendida: boolean;
  cpuSinUsuario: boolean;
  faltantes: TipoActivo[];
  activos: ActivoDelPuesto[];
}

/** Java: PuestoPropuesto — what the camera found at one seat of the empty room. */
export interface PuestoPropuesto {
  fila: number;
  columna: number;
  monitor: boolean;
  silla: boolean;
  mesa: boolean;
  cpu: string | null;
}

/** Java: PropuestaDePuestos.Alta — what confirming the proposal adds at one seat. */
export interface AltaDePuesto {
  etiqueta: string;
  numero: number;
  agregar: TipoActivo[];
  cpu: string | null;
}

/** Java: EmparejamientoCpu; `ranura` is the slot of each computer (ISO-8601 duration or seconds). */
export interface EmparejamientoCpu {
  spaceId: string;
  inicio: string;
  ranura: string | number;
  cpus: string[];
}

/** RegistroDePuestosUseCase.Revision; without a pending proposal the backend answers 404 propuesta_not_found. */
export interface RevisionDePuestos {
  propuesta: { spaceId: string; recibidaAt: string; emulada: boolean; puestos: PuestoPropuesto[] };
  altas: AltaDePuesto[];
  incompletos: PuestoPropuesto[];
  cpusSinPuesto: string[];
  emparejamiento: EmparejamientoCpu | null;
}

/** AiAdvisorPort.SensorAnomaly. */
export interface SensorAnomaly {
  spaceId: string;
  sensor: string;
  at: string;
  kind: string;
  value: number;
  detail: string;
}

/** AiAdvisorPort.AssignmentPlan. */
export interface AssignmentPlan {
  feasible: boolean;
  assignments: { courseId: string; roomId: string; attendance: number; capacity: number; utilizationPct: number; nominalPowerKw: number }[];
  totalPowerKw: number | null;
  reason: string | null;
}

/** AiAdvisorPort.Forecast. */
export interface Forecast {
  spaceId: string;
  method: string;
  samplesUsed: number;
  points: { at: string; people: number; low: number; high: number }[];
  note: string | null;
}
