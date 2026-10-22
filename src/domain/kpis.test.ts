import { describe, expect, it } from 'vitest';
import { fleetPower, ratedKw, savedKwh, savingsFromTwins } from './kpis';

describe('energy accounting policy', () => {
  it('uses Bogotá local hours and caps each telemetry interval at fifteen minutes', () => {
    const beforeSchedule = Date.parse('2026-10-21T11:59:00Z'); // 06:59 in Bogotá
    const scheduleStart = Date.parse('2026-10-21T12:00:00Z'); // 07:00 in Bogotá

    expect(savedKwh('BLOQUEO_AHORRO_VACIO', beforeSchedule, beforeSchedule + 60_000, 50)).toBe(0);
    expect(savedKwh('BLOQUEO_AHORRO_VACIO', scheduleStart, scheduleStart + 60_000, 50)).toBeCloseTo(0.1, 9);
    expect(savedKwh('BLOQUEO_AHORRO_VACIO', scheduleStart, scheduleStart + 60 * 60_000, 50)).toBeCloseTo(1.5, 9);
  });

  it('splits telemetry intervals that cross the 07:00 Bogotá schedule boundary', () => {
    const oneMinuteBeforeSeven = Date.parse('2026-10-21T11:59:00Z');

    expect(savedKwh('BLOQUEO_AHORRO_VACIO', oneMinuteBeforeSeven, oneMinuteBeforeSeven + 2 * 60_000, 50))
      .toBeCloseTo(0.1, 9);
  });

  it('stops scheduled baseline savings at the 21:00 Bogotá boundary', () => {
    const oneMinuteBeforeNine = Date.parse('2026-10-22T01:59:00Z');

    expect(savedKwh('BLOQUEO_AHORRO_VACIO', oneMinuteBeforeNine, oneMinuteBeforeNine + 2 * 60_000, 50))
      .toBeCloseTo(0.1, 9);
  });

  it('keeps fleet actual draw separate from the scheduled conventional baseline', () => {
    const space = { space: { areaSqm: 50, hvacInstalled: true }, state: { hvacState: 'VENTILACION_CO2_ACTIVA' } } as never;
    const noUnit = { space: { areaSqm: 80, hvacInstalled: false }, state: { hvacState: 'SIN_CLIMATIZACION' } } as never;
    const atSevenBogota = Date.parse('2026-10-21T12:00:00Z');

    expect(ratedKw(50)).toBe(6);
    expect(fleetPower([space, noUnit], atSevenBogota)).toEqual({ actualKw: 1.5, baselineKw: 6 });
  });

  it('rejects invalid physical inputs before they contaminate energy reports', () => {
    const state = 'BLOQUEO_AHORRO_VACIO';

    expect(() => ratedKw(-2)).toThrow(RangeError);
    expect(() => savedKwh(state, Number.NaN, 10, 50)).toThrow('from must be finite');
    expect(() => savedKwh(state, 1e100, 1e100 + 1, 50)).toThrow('from must be a valid timestamp');
    expect(() => savedKwh(state, 0, 1e100, 50)).toThrow('to must be a valid timestamp');
    expect(() => savedKwh(state, 0, 10, Number.POSITIVE_INFINITY)).toThrow('areaSqm must be finite');
    expect(() => fleetPower([], Number.NaN)).toThrow('now must be finite');
    expect(() => savingsFromTwins([], 1e100)).toThrow('valid timestamp');
    expect(() => savedKwh('UNKNOWN' as never, 0, 60_000, 50)).toThrow('unknown HVAC state');
  });

  it('rejects non-finite accumulated energy in an individual twin', () => {
    const twin = {
      space: { spaceId: 'A-301', name: 'Aula', branchName: 'Pasto', areaSqm: 50, energyTariffCopPerKwh: 900, hvacInstalled: true },
      state: { hvacState: 'APAGADO', energySavedKwh: Number.NaN },
    } as never;

    expect(() => savingsFromTwins([twin], Date.parse('2026-10-21T12:00:00Z')))
      .toThrow('energySavedKwh for A-301 must be finite');
  });

  it('reports savings only for rooms with a climate unit', () => {
    const twin = (spaceId: string, hvacInstalled: boolean) => ({
      space: { spaceId, name: spaceId, branchName: 'Pasto', areaSqm: 50, energyTariffCopPerKwh: 900, hvacInstalled },
      state: { hvacState: hvacInstalled ? 'APAGADO' : 'SIN_CLIMATIZACION', energySavedKwh: 2 },
    }) as never;
    const report = savingsFromTwins([twin('AULA', true), twin('OFICINA', false)], Date.parse('2026-10-21T12:00:00Z'));
    expect(report.spaces.map((s) => s.spaceId)).toEqual(['AULA']);
    expect(report.totalKwh).toBe(2);
  });
});
