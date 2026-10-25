import { HVAC_POWER_FRACTION, type HvacControlState, type TwinSpace } from './model';

/**
 * Constants of EnergyAccountingPolicy (baseline: full power 07:00–21:00 Bogotá). The backend accumulates the
 * savings; the dashboard only needs them to draw the live power next to the baseline.
 */
export const ENERGY = {
  ratedKwPerSqm: 0.12,
  scheduleStartHour: 7,
  scheduleEndHour: 21,
  /** Bogotá is UTC−5 all year (no daylight saving). */
  utcOffsetHours: -5,
  emissionFactorKgCo2PerKwh: 0.126,
} as const;

function powerFraction(state: HvacControlState): number {
  if (!Object.hasOwn(HVAC_POWER_FRACTION, state)) throw new RangeError(`unknown HVAC state: ${String(state)}`);
  return HVAC_POWER_FRACTION[state];
}

export const ratedKw = (areaSqm: number) => {
  if (!Number.isFinite(areaSqm) || areaSqm < 0) throw new RangeError('areaSqm must be a non-negative number');
  return ENERGY.ratedKwPerSqm * areaSqm;
};

function inSchedule(epochMs: number): boolean {
  const hour = new Date(epochMs + ENERGY.utcOffsetHours * 3_600_000).getUTCHours();
  return hour >= ENERGY.scheduleStartHour && hour < ENERGY.scheduleEndHour;
}

/** Live power drawn now by the HVAC fleet versus the conventional baseline, in kW. */
export function fleetPower(twins: readonly TwinSpace[], now: number): { actualKw: number; baselineKw: number } {
  if (!Number.isFinite(now)) throw new RangeError('now must be finite');
  const baselineShare = inSchedule(now) ? 1 : 0;
  return twins.filter(({ space }) => space.hvacInstalled).reduce(
    (acc, { space, state }) => ({
      actualKw: acc.actualKw + powerFraction(state.hvacState) * ratedKw(space.areaSqm),
      baselineKw: acc.baselineKw + baselineShare * ratedKw(space.areaSqm),
    }),
    { actualKw: 0, baselineKw: 0 },
  );
}

export const formatCop = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
export const formatNumber = (value: number, digits = 1) =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
