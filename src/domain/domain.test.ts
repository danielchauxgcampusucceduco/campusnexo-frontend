import { describe, expect, it } from 'vitest';
import { evaluateDeskGhosting } from './desks';
import { containsPoint } from './geometry';
import { kalmanUpdate, uninformedBelief } from './kalman';
import { savedKwh } from './kpis';
import type { NormalizedPoint, StudyZoneRoi, TelemetrySnapshot, TrackedDetection } from './model';
import { classifySpace } from './status';
import { comfortBand, decideThermal, freeRunning } from './thermal';

/** Same cases as the Java tests: both implementations must agree. */
const T0 = Date.parse('2026-10-20T15:00:00Z');
const lShape: NormalizedPoint[] = [[0.1, 0.1], [0.5, 0.1], [0.5, 0.3], [0.3, 0.3], [0.3, 0.6], [0.1, 0.6]];
const person = (id: number, x: number, y: number, objectClass: TrackedDetection['objectClass'] = 'PERSON'): TrackedDetection => ({
  trackId: id, objectClass, confidence: 0.9, box: { xMin: x - 0.02, yMin: y - 0.02, xMax: x + 0.02, yMax: y + 0.02 },
});

describe('geometría y puestos', () => {
  it('ray casting sobre un polígono cóncavo', () => {
    expect(containsPoint(lShape, [0.2, 0.2])).toBe(true);
    expect(containsPoint(lShape, [0.45, 0.2])).toBe(true);
    expect(containsPoint(lShape, [0.45, 0.5])).toBe(false);
    expect(containsPoint(lShape, [0.05, 0.2])).toBe(false);
  });

  it('cronómetro anti-acaparamiento de 15 minutos', () => {
    const roi: StudyZoneRoi = { zoneId: 'Z1', label: 'Mesa L', polygon: lShape };
    const backpack = [person(7, 0.2, 0.2, 'BACKPACK')];
    const first = evaluateDeskGhosting(roi, backpack, undefined, T0);
    expect(first.state).toBe('ALERTA_ACAPARAMIENTO');
    const released = evaluateDeskGhosting(roi, backpack, first, T0 + 15 * 60_000);
    expect(released.state).toBe('LIBERADO_POR_ABANDONO');
    expect(evaluateDeskGhosting(roi, [person(1, 0.2, 0.2)], released, T0 + 16 * 60_000).state).toBe('OCUPADO_VERIFICADO');
  });
});

describe('Kalman', () => {
  const snapshot = (camera: boolean, people: number): TelemetrySnapshot => ({
    spaceId: 'AULA-301', capturedAt: T0 + 60_000, cameraOnline: camera,
    detections: Array.from({ length: people }, (_, i) => person(i, 0.12, 0.15)),
    co2Ppm: 820, indoorTemperatureC: 22, outdoorTemperatureC: 14, humidityPct: 55, illuminanceLux: 300, wifiDevices: 22, activePowerKw: 2,
  });

  it('la cámara domina la fusión', () => {
    const { step } = kalmanUpdate(uninformedBelief(T0, 32), snapshot(true, 24), { capacity: 32, areaSqm: 48 });
    expect(step.measurements).toHaveLength(3);
    expect(Math.abs(step.posteriorEstimate - 24)).toBeLessThan(1);
  });

  it('sin cámara usa CO2 y Wi-Fi con más incertidumbre', () => {
    const online = kalmanUpdate(uninformedBelief(T0, 32), snapshot(true, 18), { capacity: 32, areaSqm: 48 });
    const offline = kalmanUpdate(uninformedBelief(T0, 32), snapshot(false, 18), { capacity: 32, areaSqm: 48 });
    expect(offline.step.measurements).toHaveLength(2);
    expect(offline.posterior.variance).toBeGreaterThan(online.posterior.variance);
  });

  it('rechaza timestamps regresivos y medidas no finitas antes de mutar el cálculo', () => {
    const belief = uninformedBelief(T0, 32);
    expect(() => kalmanUpdate(belief, { ...snapshot(false, 0), capturedAt: T0 - 1 }, { capacity: 32, areaSqm: 48 })).toThrow(RangeError);
    expect(() => kalmanUpdate(belief, { ...snapshot(false, 0), co2Ppm: Number.NaN }, { capacity: 32, areaSqm: 48 })).toThrow(RangeError);
  });

  it('requires positive floor area for CO2 mass-balance conversion', () => {
    expect(() => kalmanUpdate(uninformedBelief(T0, 32), snapshot(false, 0), { capacity: 32, areaSqm: 0 })).toThrow(RangeError);
  });
});

describe('MPC térmico', () => {
  it('converge a la temperatura exterior', () => {
    const trajectory = freeRunning(30, 20, 0, 50, 600);
    expect(trajectory.at(-1)!).toBeLessThan(20.2);
  });

  it('rejects unknown climate profiles at the domain boundary', () => {
    expect(() => comfortBand('UNKNOWN' as never)).toThrow('unsupported climate profile');
  });

  it('rechaza contexto térmico no finito, áreas nulas y horizontes negativos', () => {
    expect(() => freeRunning(20, 14, 0, 0, 10)).toThrow(RangeError);
    expect(() => freeRunning(Number.NaN, 14, 0, 50, 10)).toThrow(RangeError);
    expect(() => freeRunning(20, 14, 0, 50, -1)).toThrow(RangeError);
    expect(() => decideThermal({
      indoorTemperatureC: 20,
      outdoorTemperatureC: 14,
      occupants: 0,
      areaSqm: 50,
      co2Ppm: 400,
      band: { lowC: 25, highC: 20 },
      minutesUntilOccupancyEnds: null,
      minutesUntilNextOccupancy: null,
    })).toThrow(RangeError);
  });

  it('elige las mismas estrategias que el servicio Java', () => {
    const andean = comfortBand('SEDE_ANDINA');
    const tropical = comfortBand('SEDE_TROPICAL');
    const base = { areaSqm: 48, minutesUntilNextOccupancy: null };
    expect(decideThermal({ ...base, indoorTemperatureC: 22.5, outdoorTemperatureC: 14, occupants: 26, co2Ppm: 780, band: andean, minutesUntilOccupancyEnds: 80 }).recommendedState).toBe('CORTE_INERCIA_TERMICA');
    expect(decideThermal({ ...base, indoorTemperatureC: 22.8, outdoorTemperatureC: 14, occupants: 30, co2Ppm: 1450, band: andean, minutesUntilOccupancyEnds: 60 }).recommendedState).toBe('VENTILACION_CO2_ACTIVA');
    const preCool = decideThermal({ indoorTemperatureC: 28.5, outdoorTemperatureC: 32, occupants: 0, areaSqm: 72, co2Ppm: 430, band: tropical, minutesUntilOccupancyEnds: null, minutesUntilNextOccupancy: 20 });
    expect(preCool.recommendedState).toBe('PRE_ENFRIAMIENTO_IA');
    expect(preCool.setpointC).toBe(25.5);
    expect(decideThermal({ indoorTemperatureC: 27, outdoorTemperatureC: 31.8, occupants: 0, areaSqm: 72, co2Ppm: 440, band: tropical, minutesUntilOccupancyEnds: null, minutesUntilNextOccupancy: null }).recommendedState).toBe('BLOQUEO_AHORRO_VACIO');
  });

  it('restores comfort immediately when occupied temperatures leave either band edge', () => {
    const band = comfortBand('SEDE_ANDINA');
    const base = {
      outdoorTemperatureC: 14, occupants: 20, areaSqm: 48, co2Ppm: 500,
      band, minutesUntilOccupancyEnds: 30, minutesUntilNextOccupancy: null,
    };
    const tooWarm = decideThermal({ ...base, indoorTemperatureC: 25 });
    const tooCold = decideThermal({ ...base, indoorTemperatureC: 18 });

    expect(tooWarm.recommendedState).toBe('CONFORT_ACTIVO');
    expect(tooWarm.setpointC).toBe(23);
    expect(tooCold.recommendedState).toBe('CONFORT_ACTIVO');
    expect(tooCold.setpointC).toBe(20);
  });
});

describe('estado y energía', () => {
  it('no-show tras 15 minutos', () => {
    const reservation = { startsAt: T0 - 20 * 60_000, endsAt: T0 + 100 * 60_000, expectedAttendees: 40, reference: 'IS-701' };
    expect(classifySpace({ maintenance: false, popUpActive: false, people: 0, capacity: 48, reservation, now: T0 })).toBe('LIBERADO_POR_NO_SHOW');
  });

  it('ahorro en horario con el compresor bloqueado', () => {
    expect(savedKwh('BLOQUEO_AHORRO_VACIO', T0, T0 + 10 * 60_000, 50)).toBeCloseTo(1, 9);
  });
});
