import { HVAC_POWER_FRACTION, type HvacControlState, type SavingsReport, type TwinSpace } from './model';

/**
 * Constants of EnergyAccountingPolicy. Baseline: a conventional system runs the unit at full power while the room is in
 * scheduled use (a booking under way, or people in it) within campus hours, 07:00–21:00 Bogotá. The backend accumulates
 * the savings; the dashboard only needs them to draw the live power next to the baseline.
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

/** What the room's unit draws now: its strategy's share of the rated power (0 kW when it is off). */
export function hvacPowerKw({ space, state }: Pick<TwinSpace, 'space' | 'state'>): number {
  return space.hvacInstalled ? powerFraction(state.hvacState) * ratedKw(space.areaSqm) : 0;
}

/** Whether the conventional baseline would run the room's unit now. */
function inScheduledUse({ state, activeReservation }: Pick<TwinSpace, 'state' | 'activeReservation'>, now: number): boolean {
  return inSchedule(now) && (activeReservation !== null || state.occupancy > 0);
}

/**
 * Live power drawn now by the HVAC fleet versus the conventional baseline, in kW. The header and the energy view read
 * this same figure (one source of truth); it is the climate units only, not lights or computers.
 */
export function fleetPower(twins: readonly TwinSpace[], now: number): { actualKw: number; baselineKw: number } {
  if (!Number.isFinite(now)) throw new RangeError('now must be finite');
  return twins.filter(({ space }) => space.hvacInstalled).reduce(
    (acc, twin) => ({
      actualKw: acc.actualKw + hvacPowerKw(twin),
      baselineKw: acc.baselineKw + (inScheduledUse(twin, now) ? ratedKw(twin.space.areaSqm) : 0),
    }),
    { actualKw: 0, baselineKw: 0 },
  );
}

export const formatCop = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
export const formatNumber = (value: number, digits = 1) =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * The savings report from the twin states the socket pushes (each carries its accumulated `energySavedKwh`), with
 * the backend's rules (TwinQueryService.savings): rooms with a climate unit, kWh × the space's tariff and × the
 * emission factor. The dashboard no longer polls /twin/savings every few seconds next to the live feed.
 */
export function savingsFromTwins(twins: readonly TwinSpace[], emissionFactorKgCo2PerKwh: number, now: number): SavingsReport {
  const spaces = twins.filter(({ space }) => space.hvacInstalled).map(({ space, state }) => ({
    spaceId: space.spaceId,
    name: space.name,
    branchName: space.branchName,
    hvacState: state.hvacState,
    ratedKw: round(ratedKw(space.areaSqm), 2),
    kwh: round(state.energySavedKwh, 3),
    cop: round(state.energySavedKwh * space.energyTariffCopPerKwh, 0),
    kgCo2: round(state.energySavedKwh * emissionFactorKgCo2PerKwh, 3),
  }));
  return {
    generatedAt: new Date(now).toISOString(),
    totalKwh: round(spaces.reduce((sum, s) => sum + s.kwh, 0), 3),
    totalCop: round(spaces.reduce((sum, s) => sum + s.cop, 0), 0),
    totalKgCo2: round(spaces.reduce((sum, s) => sum + s.kgCo2, 0), 3),
    emissionFactorKgCo2PerKwh,
    spaces,
  };
}
