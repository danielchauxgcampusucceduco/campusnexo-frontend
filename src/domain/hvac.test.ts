import { describe, expect, it } from 'vitest';
import { familyStrategy, HVAC_RULES, mustHoldCompressor, resolveHvac, type HvacRequest } from './hvac';
import { comfortBand, decideThermal } from './thermal';

const NOW = Date.parse('2026-10-22T13:00:00Z');
const MINUTE = 60_000;

function request(overrides: Partial<HvacRequest> = {}): HvacRequest {
  const band = comfortBand('SEDE_ANDINA');
  const predicted = decideThermal({ indoorTemperatureC: 21, outdoorTemperatureC: 13.5, occupants: 20, areaSqm: 60, co2Ppm: 600, band,
    minutesUntilOccupancyEnds: 60, minutesUntilNextOccupancy: null });
  return {
    hvacInstalled: true, maintenance: false, overrideActive: false,
    previous: { state: 'APAGADO', mode: 'APAGADO', setpointC: 21, since: NOW - 60 * MINUTE, reason: 'inicio' },
    predicted, profile: 'SEDE_ANDINA',
    climate: { occupied: true, indoorTemperatureC: 21, outdoorTemperatureC: 13.5, humidityPct: 55 },
    firstDecision: false, now: NOW, ...overrides,
  };
}

describe('HVAC rule chain (port of HvacSettingChain.standard)', () => {
  it('keeps the same rule order as the backend', () => {
    expect(HVAC_RULES).toEqual(['NoClimateUnitRule', 'MaintenanceRule', 'ManualOverrideRule', 'CompressorProtectionRule',
      'FamilyStrategyRule', 'PredictiveControlRule']);
  });

  it('never climatizes a room without a unit, even in maintenance or with an override', () => {
    const resolution = resolveHvac(request({ hvacInstalled: false, maintenance: true, overrideActive: true }));
    expect(resolution).toMatchObject({ state: 'SIN_CLIMATIZACION', mode: 'APAGADO', decidedBy: 'NoClimateUnitRule' });
  });

  it('maintenance wins over the teacher', () => {
    expect(resolveHvac(request({ maintenance: true, overrideActive: true })).state).toBe('APAGADO');
  });

  it('the teacher takes the room to the middle of the family band', () => {
    const resolution = resolveHvac(request({ overrideActive: true, climate: { occupied: true, indoorTemperatureC: 17, outdoorTemperatureC: 10, humidityPct: 50 } }));
    expect(resolution).toMatchObject({ state: 'OVERRIDE_MANUAL_DOCENTE', mode: 'CALEFACCION', setpointC: 21.5 });
  });

  it('holds a compressor that was switched on less than 10 minutes ago', () => {
    const emptyRoom = decideThermal({ indoorTemperatureC: 21, outdoorTemperatureC: 13.5, occupants: 0, areaSqm: 60, co2Ppm: 420,
      band: comfortBand('SEDE_ANDINA'), minutesUntilOccupancyEnds: null, minutesUntilNextOccupancy: null });
    expect(emptyRoom.recommendedState).toBe('BLOQUEO_AHORRO_VACIO');
    const resolution = resolveHvac(request({
      predicted: emptyRoom,
      climate: { occupied: false, indoorTemperatureC: 21, outdoorTemperatureC: 13.5, humidityPct: 55 },
      previous: { state: 'CONFORT_ACTIVO', mode: 'CALEFACCION', setpointC: 20, since: NOW - 4 * MINUTE, reason: 'frío' },
    }));
    expect(resolution.decidedBy).toBe('CompressorProtectionRule');
    expect(resolution.state).toBe('CONFORT_ACTIVO');
    expect(resolution.explanation).toContain('lleva 4');
  });

  it('lets the first decision through without the compressor guard', () => {
    const resolution = resolveHvac(request({ firstDecision: true,
      previous: { state: 'CONFORT_ACTIVO', mode: 'CALEFACCION', setpointC: 20, since: NOW, reason: 'frío' } }));
    expect(resolution.decidedBy).not.toBe('CompressorProtectionRule');
  });

  it('a tropical room dehumidifies when the band holds but the air is wet', () => {
    const band = comfortBand('SEDE_TROPICAL');
    const predicted = decideThermal({ indoorTemperatureC: 24.5, outdoorTemperatureC: 24.5, occupants: 10, areaSqm: 60, co2Ppm: 600, band,
      minutesUntilOccupancyEnds: 30, minutesUntilNextOccupancy: null });
    expect(predicted.recommendedState).toBe('CORTE_INERCIA_TERMICA');
    const resolution = resolveHvac(request({ profile: 'SEDE_TROPICAL', predicted,
      climate: { occupied: true, indoorTemperatureC: 24.5, outdoorTemperatureC: 24.5, humidityPct: 82 } }));
    expect(resolution).toMatchObject({ state: 'CONFORT_ACTIVO', mode: 'DESHUMIDIFICACION', decidedBy: 'FamilyStrategyRule' });
  });
});

describe('compressor guard and families', () => {
  it('applies 10 min on and 5 min off', () => {
    expect(mustHoldCompressor(true, false, 9)).toBe(true);
    expect(mustHoldCompressor(true, false, 10)).toBe(false);
    expect(mustHoldCompressor(false, true, 4)).toBe(true);
    expect(mustHoldCompressor(false, true, 5)).toBe(false);
    expect(mustHoldCompressor(true, true, 0)).toBe(false);
  });

  it('the Andean family heats first', () => {
    expect(familyStrategy('SEDE_ANDINA', { occupied: true, indoorTemperatureC: 17, outdoorTemperatureC: 10, humidityPct: 50 }).mode).toBe('CALEFACCION');
    expect(familyStrategy('SEDE_ANDINA', { occupied: false, indoorTemperatureC: 17, outdoorTemperatureC: 10, humidityPct: 50 }).mode).toBe('APAGADO');
  });
});

describe('MPC pre-conditioning (port of ThermalInertiaMpcDomainService)', () => {
  it('pre-heats a cold empty room just before class, with a heating mode', () => {
    const decision = decideThermal({ indoorTemperatureC: 16, outdoorTemperatureC: 9, occupants: 0, areaSqm: 60, co2Ppm: 420,
      band: comfortBand('SEDE_ANDINA'), minutesUntilOccupancyEnds: null, minutesUntilNextOccupancy: 20 });
    expect(decision.recommendedState).toBe('PRE_CALENTAMIENTO_IA');
    expect(decision.mode).toBe('CALEFACCION');
    expect(decision.setpointC).toBe(19.5);
    expect(decision.explanation).toContain('pre-calienta');
  });

  it('pre-cools a hot empty room before class', () => {
    const decision = decideThermal({ indoorTemperatureC: 29, outdoorTemperatureC: 31, occupants: 0, areaSqm: 60, co2Ppm: 420,
      band: comfortBand('SEDE_TROPICAL'), minutesUntilOccupancyEnds: null, minutesUntilNextOccupancy: 20 });
    expect(decision.recommendedState).toBe('PRE_ENFRIAMIENTO_IA');
    expect(decision.mode).toBe('ENFRIAMIENTO');
  });

  it('every strategy declares a mode consistent with the compressor', () => {
    const decision = decideThermal({ indoorTemperatureC: 21, outdoorTemperatureC: 13.5, occupants: 0, areaSqm: 60, co2Ppm: 420,
      band: comfortBand('SEDE_ANDINA'), minutesUntilOccupancyEnds: null, minutesUntilNextOccupancy: null });
    expect(decision).toMatchObject({ recommendedState: 'BLOQUEO_AHORRO_VACIO', mode: 'APAGADO' });
  });
});
