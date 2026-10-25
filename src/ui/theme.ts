import type { AlertSeverity, AlertType, HexagonalLayer, HvacControlState, HvacMode, MeasurementSource, RoomCondition, SpaceStatus, SpaceType, TipoActivo, TipoPersona, ZoneDeskState } from '../domain/model';

export interface Meta {
  label: string;
  /** Fill colour: dots, map faces, chart marks, night viewports. */
  color: string;
  /** Text colour of the same hue, ≥ 4.5:1 on the light surfaces. */
  ink: string;
  hint: string;
}

/** Reservation and capacity state, in the words staff use. */
export const STATUS_META: Record<SpaceStatus, Meta> = {
  LIBRE: { label: 'Libre', color: 'var(--color-st-libre)', ink: 'var(--color-st-libre-ink)', hint: 'Sin personas ni reserva en curso' },
  RESERVADO_EN_ESPERA: { label: 'Reservado, esperando', color: 'var(--color-st-espera)', ink: 'var(--color-st-espera-ink)', hint: 'La reserva empezó y todavía no llega nadie' },
  OCUPADO_OPTIMO: { label: 'En uso', color: 'var(--color-st-optimo)', ink: 'var(--color-st-optimo-ink)', hint: 'Las personas caben y coinciden con la reserva' },
  ALERTA_SUBUTILIZADO: { label: 'Poca asistencia', color: 'var(--color-st-subutilizado)', ink: 'var(--color-st-subutilizado-ink)', hint: 'Llegó menos del 30 % de los esperados' },
  ALERTA_SOBRECUPO: { label: 'Sobrecupo', color: 'var(--color-st-sobrecupo)', ink: 'var(--color-st-sobrecupo-ink)', hint: 'Hay más personas que puestos' },
  LIBERADO_POR_NO_SHOW: { label: 'Liberado: nadie llegó', color: 'var(--color-st-noshow)', ink: 'var(--color-st-noshow-ink)', hint: 'Pasaron 15 min de la reserva sin asistentes' },
  HABILITADO_POPUP_PARCIALES: { label: 'Abierto para estudiar', color: 'var(--color-st-popup)', ink: 'var(--color-st-popup-ink)', hint: 'Abierto como sala de estudio en semana de parciales' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'var(--color-st-mantenimiento)', ink: 'var(--color-st-mantenimiento-ink)', hint: 'Fuera de servicio' },
};

/** Climate strategy, in plain words (Pasto is cold: the active mode is heating). */
export const HVAC_META: Record<HvacControlState, Meta> = {
  APAGADO: { label: 'Clima apagado', color: 'var(--color-st-mantenimiento)', ink: 'var(--color-st-mantenimiento-ink)', hint: 'Sin climatización' },
  PRE_ENFRIAMIENTO_IA: { label: 'Pre-enfriando el salón', color: 'var(--color-hv-frio)', ink: 'var(--color-hv-frio-ink)', hint: 'Se enfría justo a tiempo para la próxima clase' },
  PRE_CALENTAMIENTO_IA: { label: 'Pre-calentando el salón', color: 'var(--color-hv-calor)', ink: 'var(--color-hv-calor-ink)', hint: 'Se calienta justo a tiempo para la próxima clase' },
  CONFORT_ACTIVO: { label: 'Climatización activa', color: 'var(--color-hv-calor)', ink: 'var(--color-hv-calor-ink)', hint: 'Trabajando para volver a la temperatura cómoda' },
  ECO_SETBACK_ENTRE_CLASES: { label: 'Ahorro entre clases', color: 'var(--color-hv-ahorro)', ink: 'var(--color-hv-ahorro-ink)', hint: 'Temperatura relajada hasta la próxima clase' },
  CORTE_INERCIA_TERMICA: { label: 'Apagado: el salón guarda el calor', color: 'var(--color-hv-ahorro)', ink: 'var(--color-hv-ahorro-ink)', hint: 'Las paredes mantienen la temperatura hasta el final de la clase' },
  BLOQUEO_AHORRO_VACIO: { label: 'Apagado: salón vacío', color: 'var(--color-hv-ahorro)', ink: 'var(--color-hv-ahorro-ink)', hint: 'Nadie dentro y sin clase próxima' },
  VENTILACION_CO2_ACTIVA: { label: 'Ventilando por CO₂', color: 'var(--color-hv-aire)', ink: 'var(--color-hv-aire-ink)', hint: 'Renovar el aire es lo primero' },
  OVERRIDE_MANUAL_DOCENTE: { label: 'Control del docente', color: 'var(--color-hv-manual)', ink: 'var(--color-hv-manual-ink)', hint: 'El docente tomó el control del clima' },
  SIN_CLIMATIZACION: { label: 'Sin equipo de clima', color: 'var(--color-st-mantenimiento)', ink: 'var(--color-st-mantenimiento-ink)', hint: 'Este espacio no tiene climatización que controlar' },
};

/** What the unit does inside its strategy (Java: HvacMode). */
export const HVAC_MODE_LABEL: Record<HvacMode, string> = {
  APAGADO: 'Equipo detenido',
  CALEFACCION: 'Calentando',
  ENFRIAMIENTO: 'Enfriando',
  DESHUMIDIFICACION: 'Deshumidificando',
};

/** Overall state of a room on the campus map. */
export const CONDITION_META: Record<RoomCondition, Meta> = {
  LIBRE: { label: 'Libre', color: 'var(--color-rc-libre)', ink: 'var(--color-rc-libre-ink)', hint: 'Sin personas y todo apagado' },
  OCUPADO: { label: 'Ocupado', color: 'var(--color-rc-ocupado)', ink: 'var(--color-rc-ocupado-ink)', hint: 'Con personas, dentro del aforo' },
  SOBRECUPO: { label: 'Sobrecupo', color: 'var(--color-rc-sobrecupo)', ink: 'var(--color-rc-sobrecupo-ink)', hint: 'Más personas que puestos' },
  LUCES_SIN_OCUPACION: { label: 'Luces encendidas sin nadie', color: 'var(--color-rc-luces)', ink: 'var(--color-rc-luces-ink)', hint: 'El sistema las apaga a los 5 min' },
  EQUIPOS_SIN_USO: { label: 'Equipos encendidos sin uso', color: 'var(--color-rc-equipos)', ink: 'var(--color-rc-equipos-ink)', hint: 'El sistema los suspende a los 5 min' },
  LUCES_Y_EQUIPOS_SIN_USO: { label: 'Luces y equipos encendidos sin nadie', color: 'var(--color-rc-ambos)', ink: 'var(--color-rc-ambos-ink)', hint: 'El sistema los apaga a los 5 min' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'var(--color-st-mantenimiento)', ink: 'var(--color-st-mantenimiento-ink)', hint: 'Fuera de servicio' },
};

export const SPACE_TYPE_LABEL: Record<SpaceType, string> = {
  AULA: 'Salón con pupitres',
  SALA_ESTUDIO: 'Sala de estudio',
  AUDITORIO: 'Auditorio',
  ADMINISTRATIVA: 'Oficina administrativa',
  LOGISTICA: 'Logística interna',
  BIBLIOTECA: 'Biblioteca',
  CAFETERIA: 'Cafetería',
  LABORATORIO: 'Laboratorio',
  SALA_COMPUTO: 'Sala de cómputo',
  ZONA_COMUN: 'Zona común',
};

/** What one seat is called in each kind of room. */
export const SEAT_WORD: Record<SpaceType, [string, string]> = {
  AULA: ['pupitre', 'pupitres'],
  SALA_ESTUDIO: ['pupitre', 'pupitres'],
  AUDITORIO: ['silla', 'sillas'],
  ADMINISTRATIVA: ['puesto', 'puestos'],
  LOGISTICA: ['puesto', 'puestos'],
  BIBLIOTECA: ['mesa', 'mesas'],
  CAFETERIA: ['mesa', 'mesas'],
  LABORATORIO: ['puesto', 'puestos'],
  SALA_COMPUTO: ['equipo', 'equipos'],
  ZONA_COMUN: ['asiento', 'asientos'],
};

export const DESK_META: Record<ZoneDeskState, Meta> = {
  DISPONIBLE: { label: 'Libre', color: 'var(--color-st-libre)', ink: 'var(--color-st-libre-ink)', hint: 'Puesto vacío' },
  OCUPADO_VERIFICADO: { label: 'Ocupado', color: 'var(--color-st-optimo)', ink: 'var(--color-st-optimo-ink)', hint: 'La cámara ve a alguien sentado' },
  ALERTA_ACAPARAMIENTO: { label: 'Cosas sin estudiante', color: 'var(--color-st-subutilizado)', ink: 'var(--color-st-subutilizado-ink)', hint: 'Corre el cronómetro de 15 min' },
  LIBERADO_POR_ABANDONO: { label: 'Liberado por abandono', color: 'var(--color-st-noshow)', ink: 'var(--color-st-noshow-ink)', hint: 'Más de 15 min sin estudiante; vuelve a estar disponible' },
};

export const MEASUREMENT_META: Record<MeasurementSource, { label: string; symbol: string }> = {
  CAMARA_YOLO: { label: 'Cámara con IA', symbol: 'z_cam' },
  CO2_BALANCE_MASICO: { label: 'CO₂ del aire', symbol: 'z_CO₂' },
  WIFI_DISPOSITIVOS: { label: 'Celulares en el Wi-Fi', symbol: 'z_wifi' },
};

export const LAYER_META: Record<HexagonalLayer, { label: string; ring: number }> = {
  INBOUND_ADAPTER: { label: 'Adaptador de entrada', ring: 3 },
  INPUT_PORT: { label: 'Puerto de entrada', ring: 2 },
  USE_CASE: { label: 'Caso de uso', ring: 1 },
  DOMAIN_SERVICE: { label: 'Servicio de dominio', ring: 0 },
  OUTPUT_PORT: { label: 'Puerto de salida', ring: 2 },
  OUTBOUND_ADAPTER: { label: 'Adaptador de salida', ring: 3 },
};

export const ALERT_LABEL: Record<AlertType, string> = {
  CO2_ALTO: 'CO₂ alto',
  SOBRECUPO: 'Sobrecupo',
  CONSUMO_ESPACIO_VACIO: 'Consumo con el salón vacío',
  RESERVA_SIN_USO: 'Reserva sin uso',
  CPU_ENCENDIDA_SIN_USUARIO: 'Computador encendido sin usuario',
  ACTIVO_FALTANTE: 'Falta una silla, mesa o CPU',
  SENSOR_ANOMALO: 'Sensor con lecturas anómalas',
};

export const SEVERITY_META: Record<AlertSeverity, { label: string; color: string; ink: string }> = {
  INFORMATIVA: { label: 'Informativa', color: 'var(--color-st-optimo)', ink: 'var(--color-st-optimo-ink)' },
  ADVERTENCIA: { label: 'Advertencia', color: 'var(--color-st-subutilizado)', ink: 'var(--color-st-subutilizado-ink)' },
  CRITICA: { label: 'Crítica', color: 'var(--color-st-sobrecupo)', ink: 'var(--color-st-sobrecupo-ink)' },
};

export const PERSONA_LABEL: Record<TipoPersona, string> = { DOCENTE: 'Docente', ESTUDIANTE: 'Estudiante' };
export const ACTIVO_LABEL: Record<TipoActivo, string> = { CPU: 'CPU', SILLA: 'Silla', MESA: 'Mesa' };
