import { describe, expect, it } from 'vitest';
import { fleetPower, ratedKw, savedKwh } from './kpis';

describe('energy accounting policy', () => {
  it('uses Bogotá local hours and caps each telemetry interval at fifteen minutes', () => {
    const beforeSchedule = Date.parse('2026-10-21T11:59:00Z'); // 06:59 in Bogotá
    const scheduleStart = Date.parse('2026-10-21T12:00:00Z'); // 07:00 in Bogotá

    expect(savedKwh('BLOQUEO_AHORRO_VACIO', beforeSchedule, beforeSchedule + 60_000, 50)).toBe(0);
    expect(savedKwh('BLOQUEO_AHORRO_VACIO', scheduleStart, scheduleStart + 60_000, 50)).toBeCloseTo(0.1, 9);
    expect(savedKwh('BLOQUEO_AHORRO_VACIO', scheduleStart, scheduleStart + 60 * 60_000, 50)).toBeCloseTo(1.5, 9);
  });

  it('keeps fleet actual draw separate from the scheduled conventional baseline', () => {
    const space = { space: { areaSqm: 50 }, state: { hvacState: 'VENTILACION_CO2_ACTIVA' } } as never;
    const atSevenBogota = Date.parse('2026-10-21T12:00:00Z');

    expect(ratedKw(50)).toBe(6);
    expect(fleetPower([space], atSevenBogota)).toEqual({ actualKw: 1.5, baselineKw: 6 });
  });
});
