import type { AlertSeverity, AlertType, EstadoFranja, HexagonalLayer, MeasurementSource, RoomCondition, SpaceStatus, SpaceType, TipoActivo, TipoPersona, ZoneDeskState } from '../domain/model';

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

/** How a room is used now, on the campus map. */
export const CONDITION_META: Record<RoomCondition, Meta> = {
  LIBRE: { label: 'Libre', color: 'var(--color-rc-libre)', ink: 'var(--color-rc-libre-ink)', hint: 'La cámara no ve a nadie' },
  OCUPADO: { label: 'Ocupado', color: 'var(--color-rc-ocupado)', ink: 'var(--color-rc-ocupado-ink)', hint: 'Con personas, dentro del aforo' },
  SOBRECUPO: { label: 'Sobrecupo', color: 'var(--color-rc-sobrecupo)', ink: 'var(--color-rc-sobrecupo-ink)', hint: 'Más personas que puestos' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'var(--color-st-mantenimiento)', ink: 'var(--color-st-mantenimiento-ink)', hint: 'Fuera de servicio' },
};

/** What an hour of a student space holds (GET /disponibilidad). */
export const FRANJA_META: Record<EstadoFranja, Meta> = {
  LIBRE: { label: 'Libre', color: 'var(--color-st-libre)', ink: 'var(--color-st-libre-ink)', hint: 'Sin clase, sin reserva y sin nadie' },
  CLASE: { label: 'Clase del horario', color: 'var(--color-st-optimo)', ink: 'var(--color-st-optimo-ink)', hint: 'Una clase del horario académico' },
  RESERVADO: { label: 'Reservado', color: 'var(--color-st-espera)', ink: 'var(--color-st-espera-ink)', hint: 'Una reserva en el sistema' },
  OCUPADO: { label: 'Ocupado ahora', color: 'var(--color-st-popup)', ink: 'var(--color-st-popup-ink)', hint: 'La cámara ve personas' },
  PROGRAMADO_SIN_USO: { label: 'Programado, nadie llegó', color: 'var(--color-st-noshow)', ink: 'var(--color-st-noshow-ink)', hint: 'Libre en la práctica: se avisa a la administración' },
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
  SOBRECUPO: 'Sobrecupo',
  RESERVA_SIN_USO: 'Reserva sin uso',
  HORARIO_SIN_USO: 'Clase sin asistentes',
  CPU_ENCENDIDA_SIN_USUARIO: 'Computador encendido sin usuario',
  ACTIVO_FALTANTE: 'Falta una silla, mesa o CPU',
  FALLO_CAMARA: 'Cámara sin señal',
};

export const SEVERITY_META: Record<AlertSeverity, { label: string; color: string; ink: string }> = {
  INFORMATIVA: { label: 'Informativa', color: 'var(--color-st-optimo)', ink: 'var(--color-st-optimo-ink)' },
  ADVERTENCIA: { label: 'Advertencia', color: 'var(--color-st-subutilizado)', ink: 'var(--color-st-subutilizado-ink)' },
  CRITICA: { label: 'Crítica', color: 'var(--color-st-sobrecupo)', ink: 'var(--color-st-sobrecupo-ink)' },
};

export const PERSONA_LABEL: Record<TipoPersona, string> = { DOCENTE: 'Docente', ESTUDIANTE: 'Estudiante' };
export const ACTIVO_LABEL: Record<TipoActivo, string> = { CPU: 'CPU', SILLA: 'Silla', MESA: 'Mesa' };
