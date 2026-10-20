import type { ScenarioInfo } from './model';

/** Same catalog as SimulationScenario in Java (used when the backend is not reachable). */
export const SCENARIO_CATALOG: ScenarioInfo[] = [
  { scenario: 'CLASE_EN_CURSO', spaceId: 'AULA-301', description: 'Clase reservada con asistencia normal; la inercia térmica permite cortar el compresor' },
  { scenario: 'CO2_ALTO', spaceId: 'AULA-301', description: 'Aula llena con 1450 ppm de CO2: la ventilación pasa a tener prioridad' },
  { scenario: 'FALLO_CAMARA', spaceId: 'AULA-301', description: 'La cámara se desconecta; Kalman sigue estimando con CO2 y Wi-Fi' },
  { scenario: 'NO_SHOW', spaceId: 'AULA-MAGNA-204', description: 'Reserva iniciada hace 20 min sin asistentes: se libera y se bloquea el HVAC' },
  { scenario: 'PRE_ENFRIAMIENTO', spaceId: 'AULA-MAGNA-204', description: 'Aula tropical vacía a 28,5 °C con clase en 20 min: pre-enfriamiento' },
  { scenario: 'OVERRIDE_DOCENTE', spaceId: 'AULA-MAGNA-204', description: 'El docente toma el control manual del aire por 45 min' },
  { scenario: 'SOBRECUPO', spaceId: 'LAB-IA-102', description: '31 personas en un laboratorio con aforo de 24' },
  { scenario: 'MANTENIMIENTO', spaceId: 'LAB-IA-102', description: 'El laboratorio entra en mantenimiento' },
  { scenario: 'SUBUTILIZADO', spaceId: 'AULA-ADM-101', description: 'Reserva para 30 personas con solo 6 asistentes' },
  { scenario: 'POPUP_PARCIALES', spaceId: 'AULA-ADM-101', description: 'Semana de parciales: el aula libre se abre como sala de estudio pop-up' },
  { scenario: 'ACAPARAMIENTO_BIBLIOTECA', spaceId: 'BIB-PISO-2', description: 'Puestos con pertenencias sin estudiante: alerta y liberación a los 15 min' },
  { scenario: 'REINICIAR', spaceId: '*', description: 'Restablece todos los espacios y elimina las reservas de simulación' },
];
