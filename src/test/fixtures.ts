import type { SpaceTwinState, TwinSpace } from '../domain/model';

/** A twin event exactly as the backend publishes it (TwinContracts.TwinStateResponse). */
export function twinState(overrides: Partial<SpaceTwinState> = {}): SpaceTwinState {
  return {
    spaceId: '301-A', status: 'LIBRE', occupancy: 0, occupancyEstimate: 0, occupancyStdDev: 0, cameraOnline: true,
    popUpUntil: null, maintenance: false, updatedAt: '2026-10-21T12:00:00Z', desks: [], kalman: null,
    emptySince: null, teachersPresent: 0, studentsPresent: 0, emulated: true,
    lastCameraFrameAt: '2026-10-21T12:00:00Z', sensorsReporting: true, escenarios: [],
    ...overrides,
  };
}

/** The pilot computer lab 301-A (Flyway V10). */
export function twinSpace(state: Partial<SpaceTwinState> = {}, space: Partial<TwinSpace['space']> = {}): TwinSpace {
  return {
    space: {
      spaceId: '301-A', name: 'Sala de cómputo 301-A', type: 'SALA_COMPUTO', capacity: 30, areaSqm: 60,
      buildingId: 'BLOQUE-A', buildingName: 'Bloque A', branchId: 'PASTO', branchName: 'Campus Pasto', city: 'Pasto',
      floor: 3, computers: 30, seatRows: 5, seatColumns: 6, accesibleParaEstudiantes: true, ...space,
    },
    state: twinState({ spaceId: space.spaceId ?? '301-A', ...state }),
    activeReservation: null,
    rois: [],
  };
}
