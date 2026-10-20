import type { SimulationScenario } from '../domain/model';

export type ViewId = 'camara' | 'gemelo' | 'biblioteca' | 'arquitectura' | 'energia';

export interface ScenarioStage {
  /** Short name on the dock button. */
  label: string;
  /** Keyboard shortcut shown on the button. */
  key: string;
  /** Where presentation mode takes the audience. Null keeps the current view. */
  view: ViewId | null;
}

/**
 * Presentation choreography: for each defense scenario, the view where its effect is most visible.
 * The affected space comes from the scenario catalog, so the dock and the backend stay in sync.
 */
export const SCENARIO_STAGE: Record<SimulationScenario, ScenarioStage> = {
  CLASE_EN_CURSO: { label: 'Clase en curso', key: '1', view: 'gemelo' },
  CO2_ALTO: { label: 'CO₂ alto', key: '2', view: 'gemelo' },
  FALLO_CAMARA: { label: 'Cámara caída', key: '3', view: 'camara' },
  SOBRECUPO: { label: 'Sobrecupo', key: '4', view: 'gemelo' },
  NO_SHOW: { label: 'No-show', key: '5', view: 'gemelo' },
  SUBUTILIZADO: { label: 'Subutilizado', key: '6', view: 'gemelo' },
  POPUP_PARCIALES: { label: 'Aula pop-up', key: '7', view: 'biblioteca' },
  PRE_ENFRIAMIENTO: { label: 'Pre-enfriamiento', key: '8', view: 'gemelo' },
  OVERRIDE_DOCENTE: { label: 'Control docente', key: '9', view: 'gemelo' },
  MANTENIMIENTO: { label: 'Mantenimiento', key: '0', view: 'gemelo' },
  ACAPARAMIENTO_BIBLIOTECA: { label: 'Acaparamiento', key: 'B', view: 'biblioteca' },
  REINICIAR: { label: 'Reiniciar todo', key: 'R', view: null },
};

/** Dock groups, ordered like the shortcuts. Reiniciar sits apart, pinned at the end. */
export const SCENARIO_GROUPS: { title: string; scenarios: SimulationScenario[] }[] = [
  { title: 'Sensores y Kalman', scenarios: ['CLASE_EN_CURSO', 'CO2_ALTO', 'FALLO_CAMARA', 'SOBRECUPO'] },
  { title: 'Reservas', scenarios: ['NO_SHOW', 'SUBUTILIZADO', 'POPUP_PARCIALES'] },
  { title: 'Clima y operación', scenarios: ['PRE_ENFRIAMIENTO', 'OVERRIDE_DOCENTE', 'MANTENIMIENTO'] },
  { title: 'Biblioteca', scenarios: ['ACAPARAMIENTO_BIBLIOTECA'] },
];

export const VIEW_KEYS: Record<ViewId, string> = {
  gemelo: 'G',
  camara: 'C',
  biblioteca: 'L',
  arquitectura: 'A',
  energia: 'E',
};
