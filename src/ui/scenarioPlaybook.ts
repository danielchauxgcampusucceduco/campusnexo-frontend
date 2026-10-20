import type { SimulationScenario } from '../domain/model';

export type ViewId = 'campus' | 'salon' | 'biblioteca' | 'funciona' | 'energia';

export interface ScenarioStage {
  /** Short name on the scenario button. */
  label: string;
  /** Keyboard shortcut shown on the button. */
  key: string;
  /** Where presentation mode takes the audience. Null keeps the current view. */
  view: ViewId | null;
}

/**
 * Presentation choreography: for each defense scenario, the view where its effect is most visible.
 * The affected room comes from the scenario catalog, so the buttons and the backend stay in sync.
 */
export const SCENARIO_STAGE: Record<SimulationScenario, ScenarioStage> = {
  CLASE_EN_CURSO: { label: 'Clase en curso', key: '1', view: 'salon' },
  CO2_ALTO: { label: 'CO₂ alto', key: '2', view: 'campus' },
  FALLO_CAMARA: { label: 'Cámara caída', key: '3', view: 'salon' },
  SOBRECUPO: { label: 'Sobrecupo', key: '4', view: 'salon' },
  NO_SHOW: { label: 'Nadie llegó', key: '5', view: 'campus' },
  SUBUTILIZADO: { label: 'Poca asistencia', key: '6', view: 'campus' },
  POPUP_PARCIALES: { label: 'Sala de estudio', key: '7', view: 'biblioteca' },
  LUCES_ENCENDIDAS: { label: 'Luces sin nadie', key: '8', view: 'campus' },
  EQUIPOS_ENCENDIDOS: { label: 'Equipos sin uso', key: '9', view: 'campus' },
  OVERRIDE_DOCENTE: { label: 'Control docente', key: '0', view: 'campus' },
  MANTENIMIENTO: { label: 'Mantenimiento', key: 'M', view: 'campus' },
  ACAPARAMIENTO_BIBLIOTECA: { label: 'Mesas ocupadas con cosas', key: 'B', view: 'biblioteca' },
  REINICIAR: { label: 'Reiniciar todo', key: 'R', view: null },
};

/** Groups shown in the side column, ordered like the shortcuts. Reiniciar sits apart, at the end. */
export const SCENARIO_GROUPS: { title: string; scenarios: SimulationScenario[] }[] = [
  { title: 'Personas y cámara', scenarios: ['CLASE_EN_CURSO', 'CO2_ALTO', 'FALLO_CAMARA', 'SOBRECUPO'] },
  { title: 'Reservas', scenarios: ['NO_SHOW', 'SUBUTILIZADO', 'POPUP_PARCIALES'] },
  { title: 'Energía y Arduino', scenarios: ['LUCES_ENCENDIDAS', 'EQUIPOS_ENCENDIDOS', 'OVERRIDE_DOCENTE', 'MANTENIMIENTO'] },
  { title: 'Biblioteca', scenarios: ['ACAPARAMIENTO_BIBLIOTECA'] },
];

export const VIEW_KEYS: Record<ViewId, string> = {
  campus: 'C',
  salon: 'S',
  biblioteca: 'L',
  funciona: 'F',
  energia: 'E',
};
