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

/** How a room is used now, as the camera sees it: what the campus map paints. */
export const ROOM_CONDITIONS = ['LIBRE', 'OCUPADO', 'SOBRECUPO', 'MANTENIMIENTO'] as const;
export type RoomCondition = (typeof ROOM_CONDITIONS)[number];

export type MeasurementSource = 'CAMARA_YOLO' | 'WIFI_DISPOSITIVOS';
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
  'FALLO_CAMARA',
  'SOBRECUPO',
  'NO_SHOW',
  'SUBUTILIZADO',
  'POPUP_PARCIALES',
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
  floor: number;
  /** Workstations of the room; their agents report whether each one is on. */
  computers: number;
  /** Seat grid seen by the camera; null for offices and storage rooms. */
  seatRows: number | null;
  seatColumns: number | null;
  /** Academic and study spaces: the camera follows them and they are offered as available (offices are not). */
  accesibleParaEstudiantes: boolean;
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

/** Java: SpaceTwinState (TwinContracts.TwinStateResponse). */
export interface SpaceTwinState {
  spaceId: string;
  status: SpaceStatus;
  occupancy: number;
  occupancyEstimate: number;
  occupancyStdDev: number;
  cameraOnline: boolean;
  popUpUntil: string | null;
  maintenance: boolean;
  updatedAt: string;
  desks: DeskObservation[];
  kalman: KalmanStep | null;
  /** When the room became empty; null while there are people. */
  emptySince: string | null;
  /** People in the band in front of the board (Java: Presence). */
  teachersPresent: number;
  /** People inside a seat region. */
  studentsPresent: number;
  /** The camera data came from the device emulator, not from a real camera. */
  emulated: boolean;
  lastCameraFrameAt: string | null;
  /** The room's camera has reported at least once; without it the room has no sensor (not the same as free). */
  sensorsReporting: boolean;
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

// ---- Administration (Java: alert, persona, activo and AiAdvisorPort) ------------------------------

export const ALERT_TYPES = [
  'SOBRECUPO',
  'RESERVA_SIN_USO',
  'HORARIO_SIN_USO',
  'CPU_ENCENDIDA_SIN_USUARIO',
  'ACTIVO_FALTANTE',
  'FALLO_CAMARA',
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

/** AiAdvisorPort.AssignmentPlan; `nominalPowerKw` and `totalPowerKw` carry the cost the service minimized: the capacity. */
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

/** GET /demo: the compressed academic day of the system demo (backend DemoSimulation). */
/** RESERVA_SIN_USO: a class of the timetable that nobody attended. */
export type UsoDemo = 'CLASE' | 'RESERVA_SIN_USO' | 'LIBRE';

export interface FranjaDemo {
  etiqueta: string;
  desde: number;
  hasta: number;
}

export interface PersonaDemo {
  x: number;
  y: number;
  docente: boolean;
}

export interface SalaDemo {
  spaceId: string;
  nombre: string;
  tipo: SpaceType;
  edificio: string;
  piso: number;
  aforo: number;
  filas: number;
  columnas: number;
  horario: { uso: UsoDemo; curso: string | null; detalle: string | null }[];
  ahora: {
    uso: UsoDemo;
    curso: string | null;
    personas: number;
    docente: boolean;
    /** The camera lost its signal: the twin keeps its last estimate. */
    camaraEnLinea: boolean;
    /** Until which time the room stays free (HH:MM); null while a class is under way. */
    libreHasta: string | null;
    personasVistas: PersonaDemo[];
    hallazgos: string[];
  };
}

export interface DemoSnapshot {
  generadoEn: string;
  /** Loops of the simulated week; `diaSemana` names the weekday this one plays (Lunes … Viernes). */
  dia: number;
  diaSemana: string;
  programa: string;
  hora: string;
  minutoDelDia: number;
  franjaActual: number;
  minutosSimuladosPorMinuto: number;
  franjas: FranjaDemo[];
  salones: SalaDemo[];
}

/** POST /admin/personas/importar: rows read, people saved and each rejected row with its reason. */
export interface ImportacionPersonas {
  filas: number;
  guardadas: number;
  rechazadas: { fila: number; codigo: string; motivo: string }[];
}

// ---- Availability (GET /disponibilidad; Java: DisponibilidadUseCase) ----------------------------------

/** PROGRAMADO_SIN_USO: a class or booking under way with nobody in the room, so it is free in practice. */
export const ESTADOS_FRANJA = ['LIBRE', 'CLASE', 'RESERVADO', 'OCUPADO', 'PROGRAMADO_SIN_USO'] as const;
export type EstadoFranja = (typeof ESTADOS_FRANJA)[number];

export interface FranjaDisponible {
  /** HH:MM:SS */
  desde: string;
  hasta: string;
  estado: EstadoFranja;
  detalle: string | null;
}

/** One student space; `ahora` and `libreHasta` are null on another day or while it is in use. */
export interface EspacioDisponible {
  spaceId: string;
  nombre: string;
  tipo: SpaceType;
  edificio: string;
  piso: number;
  aforo: number;
  conCamara: boolean;
  personas: number;
  ahora: EstadoFranja | null;
  libreHasta: string | null;
  franjas: FranjaDisponible[];
}

export interface DisponibilidadDelCampus {
  /** YYYY-MM-DD */
  fecha: string;
  generadoEn: string;
  abre: string;
  cierra: string;
  espacios: EspacioDisponible[];
}

/** The room's use now: out of service, over capacity, with people, or free. */
export function roomCondition({ space, state }: Pick<TwinSpace, 'space' | 'state'>): RoomCondition {
  if (state.maintenance) return 'MANTENIMIENTO';
  if (state.occupancy > space.capacity) return 'SOBRECUPO';
  return state.occupancy > 0 ? 'OCUPADO' : 'LIBRE';
}
