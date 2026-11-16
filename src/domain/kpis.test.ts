import { describe, expect, it } from 'vitest';
import { fleetPower, hvacPowerKw, ratedKw, savingsFromTwins } from './kpis';

const twin = (hvacState: string, occupancy: number, reserved = false, hvacInstalled = true, areaSqm = 50) =>
  ({ space: { areaSqm, hvacInstalled }, state: { hvacState, occupancy }, activeReservation: reserved ? {} : null }) as never;

describe('live power of the climate fleet', () => {
  const atSevenBogota = Date.parse('2026-10-21T12:00:00Z');
  const beforeSeven = Date.parse('2026-10-21T11:59:00Z');

  it('keeps actual draw separate from the baseline of rooms in scheduled use', () => {
    expect(ratedKw(50)).toBe(6);
    const inClass = twin('VENTILACION_CO2_ACTIVA', 20);
    const noUnit = twin('SIN_CLIMATIZACION', 10, false, false, 80);
    expect(fleetPower([inClass, noUnit], atSevenBogota)).toEqual({ actualKw: 1.5, baselineKw: 6 });
    // A class outside the usual hours runs a conventional unit too.
    expect(fleetPower([inClass], beforeSeven).baselineKw).toBe(6);
  });

  it('counts a booked room in the baseline even before anyone arrives, and an empty unbooked one in neither', () => {
    expect(fleetPower([twin('PRE_CALENTAMIENTO_IA', 0, true)], atSevenBogota)).toEqual({ actualKw: 6, baselineKw: 6 });
    expect(fleetPower([twin('BLOQUEO_AHORRO_VACIO', 0)], atSevenBogota)).toEqual({ actualKw: 0, baselineKw: 0 });
  });

  it('gives 0 kW for a unit that is off', () => {
    expect(hvacPowerKw(twin('BLOQUEO_AHORRO_VACIO', 0))).toBe(0);
    expect(hvacPowerKw(twin('CORTE_INERCIA_TERMICA', 30))).toBe(0);
    expect(hvacPowerKw(twin('CONFORT_ACTIVO', 30))).toBe(6);
  });

  it('rejects invalid inputs before they reach the charts', () => {
    expect(() => ratedKw(-2)).toThrow(RangeError);
    expect(() => fleetPower([], Number.NaN)).toThrow('now must be finite');
    expect(() => fleetPower([twin('TURBO', 0)], 0)).toThrow('unknown HVAC state');
  });
});

describe('savings from the pushed twins', () => {
  it('follows the accumulated kWh of each room with a unit, with its tariff and the emission factor', () => {
    const room = (spaceId: string, kwh: number, hvacInstalled = true) => ({
      space: { spaceId, name: spaceId, branchName: 'Pasto', hvacInstalled, areaSqm: 50, energyTariffCopPerKwh: 865 },
      state: { hvacState: 'BLOQUEO_AHORRO_VACIO', energySavedKwh: kwh },
    }) as never;

    const report = savingsFromTwins([room('308-A', 2), room('309-A', 0.5), room('BIB', 9, false)], 0.126, 0);

    expect(report.spaces.map((s) => s.spaceId)).toEqual(['308-A', '309-A']);
    expect(report.totalKwh).toBe(2.5);
    expect(report.totalCop).toBe(2163);
    expect(report.totalKgCo2).toBe(0.315);
    expect(report.spaces[0]!.ratedKw).toBe(6);
  });
});
