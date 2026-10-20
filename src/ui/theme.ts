import type { DetectedObjectClass, HexagonalLayer, HvacControlState, MeasurementSource, SpaceStatus, ZoneDeskState } from '../domain/model';

export interface Meta {
  label: string;
  color: string;
  hint: string;
}

export const STATUS_META: Record<SpaceStatus, Meta> = {
  LIBRE: { label: 'Libre', color: 'var(--color-st-libre)', hint: 'Sin ocupación ni reserva activa' },
  RESERVADO_EN_ESPERA: { label: 'Reservado, en espera', color: 'var(--color-st-espera)', hint: 'La reserva empezó y aún no llega nadie' },
  OCUPADO_OPTIMO: { label: 'Ocupado', color: 'var(--color-st-optimo)', hint: 'Uso acorde a la capacidad y a la reserva' },
  ALERTA_SUBUTILIZADO: { label: 'Subutilizado', color: 'var(--color-st-subutilizado)', hint: 'Menos del 30 % de los asistentes esperados' },
  ALERTA_SOBRECUPO: { label: 'Sobrecupo', color: 'var(--color-st-sobrecupo)', hint: 'Más personas que el aforo' },
  LIBERADO_POR_NO_SHOW: { label: 'Liberado por no-show', color: 'var(--color-st-noshow)', hint: '15 min de reserva sin asistentes' },
  HABILITADO_POPUP_PARCIALES: { label: 'Aula pop-up de parciales', color: 'var(--color-st-popup)', hint: 'Abierta como sala de estudio' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'var(--color-st-mantenimiento)', hint: 'Fuera de servicio' },
};

export const HVAC_META: Record<HvacControlState, Meta> = {
  APAGADO: { label: 'Apagado', color: 'var(--color-st-mantenimiento)', hint: 'Sin climatización' },
  PRE_ENFRIAMIENTO_IA: { label: 'Pre-enfriamiento IA', color: 'var(--color-hv-frio)', hint: 'Enfría antes de que llegue la clase' },
  CONFORT_ACTIVO: { label: 'Confort activo', color: 'var(--color-hv-calor)', hint: 'Compresor trabajando para volver a la banda' },
  ECO_SETBACK_ENTRE_CLASES: { label: 'Eco entre clases', color: 'var(--color-hv-ahorro)', hint: 'Setpoint relajado hasta la próxima clase' },
  CORTE_INERCIA_TERMICA: { label: 'Corte por inercia térmica', color: 'var(--color-hv-ahorro)', hint: 'La masa térmica sostiene el confort' },
  BLOQUEO_AHORRO_VACIO: { label: 'Bloqueo por vacío', color: 'var(--color-hv-ahorro)', hint: 'Espacio vacío sin clase próxima' },
  VENTILACION_CO2_ACTIVA: { label: 'Ventilación por CO₂', color: 'var(--color-hv-aire)', hint: 'Renovación de aire prioritaria' },
  OVERRIDE_MANUAL_DOCENTE: { label: 'Control manual docente', color: 'var(--color-hv-manual)', hint: 'El docente tomó el control' },
};

export const DESK_META: Record<ZoneDeskState, Meta> = {
  DISPONIBLE: { label: 'Disponible', color: '#3c9d8f', hint: 'Puesto vacío' },
  OCUPADO_VERIFICADO: { label: 'Ocupado verificado', color: '#5b9bd8', hint: 'Hay un estudiante en el puesto' },
  ALERTA_ACAPARAMIENTO: { label: 'Pertenencias sin estudiante', color: '#e0a531', hint: 'Corre el cronómetro de 15 min' },
  LIBERADO_POR_ABANDONO: { label: 'Liberado por abandono', color: '#e0664f', hint: 'Más de 15 min sin estudiante' },
};

/** Colours for the camera overlay (drawn on the night viewport). */
export const OBJECT_META: Record<DetectedObjectClass, { label: string; color: string }> = {
  PERSON: { label: 'PERSON', color: '#7fe3d2' },
  LAPTOP: { label: 'LAPTOP', color: '#f2c14e' },
  BACKPACK: { label: 'BACKPACK', color: '#f08a5d' },
  BOOK: { label: 'BOOK', color: '#c3a6f0' },
};

export const MEASUREMENT_META: Record<MeasurementSource, { label: string; symbol: string }> = {
  CAMARA_YOLO: { label: 'Cámara YOLO + ByteTrack', symbol: 'z_cam' },
  CO2_BALANCE_MASICO: { label: 'Balance de masa de CO₂', symbol: 'z_CO₂' },
  WIFI_DISPOSITIVOS: { label: 'Dispositivos Wi-Fi', symbol: 'z_wifi' },
};

export const LAYER_META: Record<HexagonalLayer, { label: string; ring: number }> = {
  INBOUND_ADAPTER: { label: 'Adaptador de entrada', ring: 3 },
  INPUT_PORT: { label: 'Puerto de entrada', ring: 2 },
  USE_CASE: { label: 'Caso de uso', ring: 1 },
  DOMAIN_SERVICE: { label: 'Servicio de dominio', ring: 0 },
  OUTPUT_PORT: { label: 'Puerto de salida', ring: 2 },
  OUTBOUND_ADAPTER: { label: 'Adaptador de salida', ring: 3 },
};

export const BRANCH_ORDER = ['SEDE-ANDINA', 'SEDE-TROPICAL', 'SEDE-TEMPLADA'] as const;
export const BRANCH_LABEL: Record<string, { name: string; city: string; climate: string }> = {
  'SEDE-ANDINA': { name: 'Sede Andina', city: 'Pasto', climate: 'Clima frío de montaña' },
  'SEDE-TROPICAL': { name: 'Sede Tropical', city: 'Barranquilla', climate: 'Cálido y húmedo' },
  'SEDE-TEMPLADA': { name: 'Sede Templada', city: 'Medellín', climate: 'Templado' },
};
