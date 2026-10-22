import { describe, expect, it } from 'vitest';
import { reconstructFrame } from './reconstructFrame';
import type { SpaceTwinState, StudyZoneRoi, TwinSpace } from '../../domain/model';

const roi: StudyZoneRoi = {
  zoneId: 'Z1',
  label: 'Mesa 1',
  polygon: [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]],
};

function twin(overrides: Partial<SpaceTwinState> = {}, rois: StudyZoneRoi[] = []): TwinSpace {
  const state: SpaceTwinState = {
    spaceId: 'AULA-301',
    status: 'LIBRE',
    hvacState: 'APAGADO',
    hvacStateSince: '2026-10-21T12:00:00Z',
    occupancy: 0,
    occupancyEstimate: 0,
    occupancyStdDev: 0,
    indoorTemperatureC: 22,
    outdoorTemperatureC: 14,
    co2Ppm: 430,
    humidityPct: 55,
    cameraOnline: true,
    energySavedKwh: 0,
    overrideUntil: null,
    popUpUntil: null,
    maintenance: false,
    updatedAt: '2026-10-21T12:00:00Z',
    desks: [],
    kalman: null,
    thermal: null,
    condition: 'LIBRE',
    lightsOn: false,
    illuminanceLux: 200,
    devicesOn: 0,
    devicesTotal: 0,
    emptySince: null,
    equipmentShutdownAt: null,
    ...overrides,
  };
  return {
    space: {
      spaceId: 'AULA-301',
      name: 'Salón 301',
      type: 'AULA',
      capacity: 36,
      areaSqm: 48,
      buildingId: 'A',
      buildingName: 'Bloque A',
      branchId: 'PASTO',
      branchName: 'Pasto',
      city: 'Pasto',
      climateProfile: 'SEDE_ANDINA',
      energyTariffCopPerKwh: 900,
      floor: 3,
      computers: 0,
      seatRows: 6,
      seatColumns: 6,
    },
    state,
    activeReservation: null,
    rois,
  };
}

describe('reconstructFrame', () => {
  it('emits frame metadata but no detections when the camera is offline', () => {
    const frame = reconstructFrame(twin({ cameraOnline: false, occupancy: 18 }), 0);

    expect(frame.cameraOnline).toBe(false);
    expect(frame.detections).toEqual([]);
    expect(frame.capturedAt).toBe(Date.parse('2026-10-21T12:00:00Z'));
  });

  it('reconstructs verified people, belongings and remaining occupancy deterministically', () => {
    const input = twin({
      occupancy: 3,
      desks: [{
        zoneId: 'Z1',
        state: 'OCUPADO_VERIFICADO',
        peopleInside: 2,
        belongingsInside: 1,
        unattendedSince: null,
        unattendedMinutes: 0,
        evaluatedAt: '2026-10-21T12:00:00Z',
      }],
    }, [roi]);

    const first = reconstructFrame(input, 1_000);
    const second = reconstructFrame(input, 1_000);

    expect(first).toEqual(second);
    expect(first.detections.filter((item) => item.objectClass === 'PERSON')).toHaveLength(3);
    expect(first.detections.filter((item) => item.objectClass === 'LAPTOP')).toHaveLength(1);
  });

  it('does not create negative remaining detections when desks exceed aggregate occupancy', () => {
    const input = twin({
      occupancy: 1,
      desks: [{
        zoneId: 'Z1',
        state: 'OCUPADO_VERIFICADO',
        peopleInside: 2,
        belongingsInside: 0,
        unattendedSince: null,
        unattendedMinutes: 0,
        evaluatedAt: '2026-10-21T12:00:00Z',
      }],
    }, [roi]);

    expect(reconstructFrame(input, 0).detections).toHaveLength(2);
  });
});
