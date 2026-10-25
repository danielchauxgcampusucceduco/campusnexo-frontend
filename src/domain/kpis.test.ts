import { describe, expect, it } from 'vitest';
import { fleetPower, ratedKw } from './kpis';

describe('live power of the climate fleet', () => {
  it('keeps actual draw separate from the scheduled conventional baseline', () => {
    const space = { space: { areaSqm: 50, hvacInstalled: true }, state: { hvacState: 'VENTILACION_CO2_ACTIVA' } } as never;
    const noUnit = { space: { areaSqm: 80, hvacInstalled: false }, state: { hvacState: 'SIN_CLIMATIZACION' } } as never;
    const atSevenBogota = Date.parse('2026-10-21T12:00:00Z');
    const beforeSeven = Date.parse('2026-10-21T11:59:00Z');

    expect(ratedKw(50)).toBe(6);
    expect(fleetPower([space, noUnit], atSevenBogota)).toEqual({ actualKw: 1.5, baselineKw: 6 });
    expect(fleetPower([space], beforeSeven).baselineKw).toBe(0);
  });

  it('rejects invalid inputs before they reach the charts', () => {
    expect(() => ratedKw(-2)).toThrow(RangeError);
    expect(() => fleetPower([], Number.NaN)).toThrow('now must be finite');
    const unknown = { space: { areaSqm: 50, hvacInstalled: true }, state: { hvacState: 'TURBO' } } as never;
    expect(() => fleetPower([unknown], 0)).toThrow('unknown HVAC state');
  });
});
