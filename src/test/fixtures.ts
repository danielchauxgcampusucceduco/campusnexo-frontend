import type { SpaceTwinState, TwinSpace } from '../domain/model';

/** A twin event exactly as the backend publishes it (TwinContracts.TwinStateResponse). */
export function twinState(overrides: Partial<SpaceTwinState> = {}): SpaceTwinState {
  return {
    spaceId: '301-A', status: 'LIBRE', hvacState: 'APAGADO', hvacStateSince: '2026-10-21T12:00:00Z',
    hvacMode: 'APAGADO', hvacSetpointC: 21, hvacReason: 'Sin lecturas todavía',
    occupancy: 0, occupancyEstimate: 0, occupancyStdDev: 0, indoorTemperatureC: 20, outdoorTemperatureC: 14,
    co2Ppm: 415, humidityPct: 55, cameraOnline: true, energySavedKwh: 0, overrideUntil: null, popUpUntil: null,
    maintenance: false, updatedAt: '2026-10-21T12:00:00Z', desks: [], kalman: null, thermal: null,
    condition: 'LIBRE', lightsOn: false, illuminanceLux: 0, devicesOn: 0, devicesTotal: 30, emptySince: null,
    equipmentShutdownAt: null, teachersPresent: 0, studentsPresent: 0, emulated: true,
    lastCameraFrameAt: '2026-10-21T12:00:00Z', escenarios: [],
    ...overrides,
  };
}

/** The pilot computer lab 301-A (Flyway V10). */
export function twinSpace(state: Partial<SpaceTwinState> = {}, space: Partial<TwinSpace['space']> = {}): TwinSpace {
  return {
    space: {
      spaceId: '301-A', name: 'Sala de cómputo 301-A', type: 'SALA_COMPUTO', capacity: 30, areaSqm: 60,
      buildingId: 'BLOQUE-A', buildingName: 'Bloque A', branchId: 'PASTO', branchName: 'Campus Pasto', city: 'Pasto',
      climateProfile: 'SEDE_ANDINA', energyTariffCopPerKwh: 900, floor: 3, computers: 30, seatRows: 5, seatColumns: 6,
      hvacInstalled: true, ...space,
    },
    state: twinState({ spaceId: space.spaceId ?? '301-A', ...state }),
    activeReservation: null,
    rois: [],
  };
}
