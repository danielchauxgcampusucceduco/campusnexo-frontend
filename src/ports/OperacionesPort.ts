import type {
  AltaDePuesto,
  Alert,
  AlertType,
  AssignmentPlan,
  EmparejamientoCpu,
  Forecast,
  MedidasEspacio,
  Persona,
  Puesto,
  Reservation,
  RevisionDePuestos,
  SensorAnomaly,
  SpaceTwinState,
  TipoPersona,
} from '../domain/model';

export interface NuevaReserva {
  startsAt: string;
  endsAt: string;
  expectedAttendees: number;
  /** Course or group code, never personal data. */
  reference: string;
  /** Institutional code of the teacher or student in charge (optional). */
  holderCode: string | null;
}

export interface NuevaPersona {
  tipo: TipoPersona;
  codigo: string;
  nombre: string;
  adscripcion: string;
}

export interface Curso {
  cursoId: string;
  asistentes: number;
}

/**
 * Driven port of the commands and the administration screens: everything the dashboard asks the backend
 * besides the live twin. The backend decides; the dashboard only sends what the person chose.
 */
export interface OperacionesPort {
  // OPERATOR and ADMIN
  setMaintenance(spaceId: string, enabled: boolean): Promise<SpaceTwinState>;
  openPopUp(spaceId: string, minutes: number): Promise<SpaceTwinState>;
  manualOverride(spaceId: string, minutes: number): Promise<SpaceTwinState>;
  reservar(spaceId: string, reserva: NuevaReserva): Promise<Reservation>;
  alertas(filter?: { spaceId?: string; type?: AlertType }): Promise<Alert[]>;
  // ADMIN, from the administration network
  /** Applies the measurements taken on site; the backend refuses a grid that leaves workstations outside. */
  ajustarEspacio(spaceId: string, medidas: MedidasEspacio): Promise<void>;
  personas(tipo?: TipoPersona): Promise<Persona[]>;
  registrarPersona(persona: NuevaPersona): Promise<Persona>;
  eliminarPersona(codigo: string): Promise<void>;
  puestos(spaceId: string): Promise<Puesto[]>;
  /** Null while the camera has not proposed the room's workstations. */
  propuesta(spaceId: string): Promise<RevisionDePuestos | null>;
  emparejar(spaceId: string): Promise<EmparejamientoCpu>;
  confirmar(spaceId: string, descartar: string[]): Promise<AltaDePuesto[]>;
  saludDeSensores(horas: number): Promise<SensorAnomaly[]>;
  asignar(cursos: Curso[], margenSeguridad: number): Promise<AssignmentPlan>;
  /** Null while the room has no history to forecast from. */
  pronostico(spaceId: string, horas: number): Promise<Forecast | null>;
  historialCsv(spaceId: string): Promise<Blob>;
}
