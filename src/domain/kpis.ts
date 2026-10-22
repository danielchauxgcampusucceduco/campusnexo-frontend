import { HVAC_POWER_FRACTION, type HvacControlState, type SavingsReport, type TwinSpace } from './model';

/** Energy accounting identical to EnergyAccountingPolicy (baseline: full power 07:00–21:00 Bogotá). */
export const ENERGY = {
  ratedKwPerSqm: 0.12,
  maxIntervalMinutes: 15,
  scheduleStartHour: 7,
  scheduleEndHour: 21,
  /** Bogotá is UTC−5 all year (no daylight saving). */
  utcOffsetHours: -5,
  emissionFactorKgCo2PerKwh: 0.126,
} as const;

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function requireNonNegative(value: number, name: string): void {
  requireFinite(value, name);
  if (value < 0) throw new RangeError(`${name} must be non-negative`);
}

export const ratedKw = (areaSqm: number) => {
  requireNonNegative(areaSqm, 'areaSqm');
  return ENERGY.ratedKwPerSqm * areaSqm;
};

function inSchedule(epochMs: number): boolean {
  const hour = new Date(epochMs + ENERGY.utcOffsetHours * 3_600_000).getUTCHours();
  return hour >= ENERGY.scheduleStartHour && hour < ENERGY.scheduleEndHour;
}

function nextScheduleBoundary(epochMs: number): number {
  const local = new Date(epochMs + ENERGY.utcOffsetHours * 3_600_000);
  const localDayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
    - ENERGY.utcOffsetHours * 3_600_000;
  const boundaries = [ENERGY.scheduleStartHour, ENERGY.scheduleEndHour]
    .map((hour) => localDayStart + hour * 3_600_000)
    .filter((boundary) => boundary > epochMs);
  return boundaries.length > 0 ? Math.min(...boundaries) : localDayStart + 24 * 3_600_000 + ENERGY.scheduleStartHour * 3_600_000;
}

export function savedKwh(state: HvacControlState, from: number, to: number, areaSqm: number): number {
  requireFinite(from, 'from');
  requireFinite(to, 'to');
  requireNonNegative(areaSqm, 'areaSqm');
  if (to <= from) return 0;
  const end = from + Math.min(to - from, ENERGY.maxIntervalMinutes * 60_000);
  const actualFraction = HVAC_POWER_FRACTION[state];
  const power = ratedKw(areaSqm);
  let cursor = from;
  let energy = 0;
  while (cursor < end) {
    const segmentEnd = Math.min(end, nextScheduleBoundary(cursor));
    const baselineFraction = inSchedule(cursor) ? 1 : 0;
    energy += (baselineFraction - actualFraction) * power * ((segmentEnd - cursor) / 3_600_000);
    cursor = segmentEnd;
  }
  return energy;
}

export const kwhToCop = (kwh: number, tariffCopPerKwh: number) => {
  requireFinite(kwh, 'kwh');
  requireNonNegative(tariffCopPerKwh, 'tariffCopPerKwh');
  return kwh * tariffCopPerKwh;
};
export const kwhToKgCo2 = (kwh: number, factor: number = ENERGY.emissionFactorKgCo2PerKwh) => {
  requireFinite(kwh, 'kwh');
  requireNonNegative(factor, 'factor');
  return kwh * factor;
};

/** Savings report computed from twin states, same aggregation as TwinQueryService.savings(). */
export function savingsFromTwins(twins: readonly TwinSpace[], generatedAt: number, factor: number = ENERGY.emissionFactorKgCo2PerKwh): SavingsReport {
  requireFinite(generatedAt, 'generatedAt');
  requireNonNegative(factor, 'factor');
  if (!Number.isFinite(new Date(generatedAt).getTime())) throw new RangeError('generatedAt must be a valid timestamp');
  const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;
  const spaces = twins.map(({ space, state }) => ({
    spaceId: space.spaceId,
    name: space.name,
    branchName: space.branchName,
    hvacState: state.hvacState,
    ratedKw: round(ratedKw(space.areaSqm), 2),
    kwh: round(state.energySavedKwh, 3),
    cop: round(kwhToCop(state.energySavedKwh, space.energyTariffCopPerKwh), 0),
    kgCo2: round(kwhToKgCo2(state.energySavedKwh, factor), 3),
  }));
  return {
    generatedAt: new Date(generatedAt).toISOString(),
    totalKwh: round(spaces.reduce((sum, s) => sum + s.kwh, 0), 3),
    totalCop: round(spaces.reduce((sum, s) => sum + s.cop, 0), 0),
    totalKgCo2: round(spaces.reduce((sum, s) => sum + s.kgCo2, 0), 3),
    emissionFactorKgCo2PerKwh: factor,
    spaces,
  };
}

/** Live power drawn now by the HVAC fleet versus the conventional baseline, in kW. */
export function fleetPower(twins: readonly TwinSpace[], now: number): { actualKw: number; baselineKw: number } {
  requireFinite(now, 'now');
  const baselineShare = inSchedule(now) ? 1 : 0;
  return twins.reduce(
    (acc, { space, state }) => ({
      actualKw: acc.actualKw + HVAC_POWER_FRACTION[state.hvacState] * ratedKw(space.areaSqm),
      baselineKw: acc.baselineKw + baselineShare * ratedKw(space.areaSqm),
    }),
    { actualKw: 0, baselineKw: 0 },
  );
}

export const formatCop = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
export const formatNumber = (value: number, digits = 1) =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
