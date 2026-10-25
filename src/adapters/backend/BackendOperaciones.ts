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
} from '../../domain/model';
import type { Curso, NuevaPersona, NuevaReserva, OperacionesPort } from '../../ports/OperacionesPort';
import { BackendError, type Http } from './http';

/** The backend gives the AI service up to 20 s; the dashboard waits a little longer. */
const AI_TIMEOUT_MS = 25_000;

const id = (value: string) => encodeURIComponent(value);

/** Adapter of the commands and administration routes of the Java backend. */
export class BackendOperaciones implements OperacionesPort {
  constructor(private readonly http: Http) {}

  setMaintenance(spaceId: string, enabled: boolean): Promise<SpaceTwinState> {
    return this.http(`/twin/spaces/${id(spaceId)}/maintenance`, { method: 'POST', query: { enabled } });
  }

  openPopUp(spaceId: string, minutes: number): Promise<SpaceTwinState> {
    return this.http(`/twin/spaces/${id(spaceId)}/popup`, { method: 'POST', query: { minutes } });
  }

  manualOverride(spaceId: string, minutes: number): Promise<SpaceTwinState> {
    return this.http(`/twin/spaces/${id(spaceId)}/override`, { method: 'POST', query: { minutes } });
  }

  reservar(spaceId: string, reserva: NuevaReserva): Promise<Reservation> {
    return this.http(`/spaces/${id(spaceId)}/reservations`, { method: 'POST', body: reserva });
  }

  alertas(filter: { spaceId?: string; type?: AlertType } = {}): Promise<Alert[]> {
    return this.http('/alerts', { query: { ...filter, limit: 100 } });
  }

  async ajustarEspacio(spaceId: string, medidas: MedidasEspacio): Promise<void> {
    await this.http(`/admin/spaces/${id(spaceId)}`, { method: 'PUT', body: medidas });
  }

  personas(tipo?: TipoPersona): Promise<Persona[]> {
    return this.http('/admin/personas', { query: { tipo } });
  }

  registrarPersona(persona: NuevaPersona): Promise<Persona> {
    return this.http('/admin/personas', { method: 'POST', body: persona });
  }

  eliminarPersona(codigo: string): Promise<void> {
    return this.http(`/admin/personas/${id(codigo)}`, { method: 'DELETE', as: 'none' });
  }

  puestos(spaceId: string): Promise<Puesto[]> {
    return this.http(`/admin/spaces/${id(spaceId)}/puestos`);
  }

  async propuesta(spaceId: string): Promise<RevisionDePuestos | null> {
    try {
      return await this.http<RevisionDePuestos>(`/admin/spaces/${id(spaceId)}/propuesta`);
    } catch (error) {
      if (error instanceof BackendError && error.code === 'propuesta_not_found') return null;
      throw error;
    }
  }

  emparejar(spaceId: string): Promise<EmparejamientoCpu> {
    return this.http(`/admin/spaces/${id(spaceId)}/emparejamiento`, { method: 'POST' });
  }

  confirmar(spaceId: string, descartar: string[]): Promise<AltaDePuesto[]> {
    return this.http(`/admin/spaces/${id(spaceId)}/propuesta/confirmar`, { method: 'POST', body: { descartar } });
  }

  saludDeSensores(horas: number): Promise<SensorAnomaly[]> {
    return this.http('/admin/ia/sensores', { query: { horas }, timeoutMs: AI_TIMEOUT_MS });
  }

  asignar(cursos: Curso[], margenSeguridad: number): Promise<AssignmentPlan> {
    return this.http('/admin/ia/asignacion', { method: 'POST', body: { cursos, margenSeguridad }, timeoutMs: AI_TIMEOUT_MS });
  }

  async pronostico(spaceId: string, horas: number): Promise<Forecast | null> {
    try {
      return await this.http<Forecast>(`/admin/spaces/${id(spaceId)}/pronostico`, { query: { horas }, timeoutMs: AI_TIMEOUT_MS });
    } catch (error) {
      if (error instanceof BackendError && error.code === 'history_not_available') return null;
      throw error;
    }
  }

  historialCsv(spaceId: string): Promise<Blob> {
    return this.http(`/admin/spaces/${id(spaceId)}/historial.csv`, { as: 'blob' });
  }
}
