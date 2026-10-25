import type { EscenarioOperativo } from '../domain/model';

export type ViewId = 'campus' | 'salon' | 'biblioteca' | 'energia' | 'funciona' | 'alertas' | 'admin';

export interface EscenarioMeta {
  /** Short name on the chip. */
  label: string;
  /** Where the effect of the scenario is most visible. */
  view: ViewId;
  /** Needs someone from the administration to act. */
  attention: boolean;
}

/**
 * How the dashboard shows each operational scenario the backend recognized. The rule that recognizes it lives
 * in the Java domain (ReconocedorDeEscenarios); this table only says where to look.
 */
export const ESCENARIO_META: Record<EscenarioOperativo, EscenarioMeta> = {
  CLASE_EN_CURSO: { label: 'Clase en curso', view: 'salon', attention: false },
  CO2_ALTO: { label: 'CO₂ alto', view: 'salon', attention: true },
  FALLO_CAMARA: { label: 'Cámara caída', view: 'salon', attention: true },
  SOBRECUPO: { label: 'Sobrecupo', view: 'salon', attention: true },
  NO_SHOW: { label: 'Nadie llegó', view: 'campus', attention: false },
  SUBUTILIZADO: { label: 'Poca asistencia', view: 'campus', attention: false },
  POPUP_PARCIALES: { label: 'Sala de estudio', view: 'campus', attention: false },
  LUCES_ENCENDIDAS: { label: 'Luces sin nadie', view: 'campus', attention: true },
  EQUIPOS_ENCENDIDOS: { label: 'Equipos sin uso', view: 'campus', attention: true },
  OVERRIDE_DOCENTE: { label: 'Control docente', view: 'salon', attention: false },
  MANTENIMIENTO: { label: 'Mantenimiento', view: 'campus', attention: false },
  ACAPARAMIENTO: { label: 'Puestos acaparados', view: 'biblioteca', attention: true },
};

export const VIEW_KEYS: Record<ViewId, string> = {
  campus: 'C',
  salon: 'S',
  biblioteca: 'L',
  energia: 'E',
  funciona: 'F',
  alertas: 'A',
  admin: 'D',
};
