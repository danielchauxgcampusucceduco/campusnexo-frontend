import type { ScenarioInfo } from './model';

/** Same catalog as SimulationScenario in Java (used when the backend is not reachable). */
export const SCENARIO_CATALOG: ScenarioInfo[] = [
  { scenario: 'CLASE_EN_CURSO', spaceId: '421-A', description: 'Clase con 26 estudiantes en sus pupitres; la inercia térmica permite apagar la calefacción' },
  { scenario: 'CO2_ALTO', spaceId: '422-A', description: 'Salón lleno con 1450 ppm de CO2: la ventilación pasa a tener prioridad' },
  { scenario: 'FALLO_CAMARA', spaceId: '421-A', description: 'La cámara se desconecta; el sistema sigue estimando con CO2 y Wi-Fi' },
  { scenario: 'SOBRECUPO', spaceId: '3B-DE-BIOPROCESOS-LABORATORIO', description: '22 personas en un laboratorio con 15 puestos' },
  { scenario: 'NO_SHOW', spaceId: '402-B', description: 'Reserva iniciada hace 20 min sin asistentes: se libera el salón y se apaga el clima' },
  { scenario: 'SUBUTILIZADO', spaceId: '414-B', description: 'Reserva para 30 personas con solo 6 asistentes' },
  { scenario: 'POPUP_PARCIALES', spaceId: '503-A', description: 'Semana de parciales: el salón libre se abre como sala de estudio' },
  { scenario: 'LUCES_ENCENDIDAS', spaceId: '423-A', description: 'Salón vacío hace 8 min con las luces encendidas: el Arduino las apaga' },
  { scenario: 'EQUIPOS_ENCENDIDOS', spaceId: '309-A', description: 'Sala de cómputo vacía hace 12 min con 24 equipos encendidos: se suspenden' },
  { scenario: 'OVERRIDE_DOCENTE', spaceId: '420-A', description: 'El docente toma el control manual del clima por 45 min' },
  { scenario: 'MANTENIMIENTO', spaceId: '2B-LABORATORIO-MULTIFUNCIONAL', description: 'El laboratorio entra en mantenimiento' },
  { scenario: 'ACAPARAMIENTO_BIBLIOTECA', spaceId: 'BIBLIOTECA-2B', description: 'Mesas con pertenencias sin estudiante: alerta y liberación a los 15 min' },
  { scenario: 'REINICIAR', spaceId: '*', description: 'Restablece todos los salones y elimina las reservas de simulación' },
];
