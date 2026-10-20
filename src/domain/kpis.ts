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

export const ratedKw = (areaSqm: number) => ENERGY.ratedKwPerSqm * areaSqm;

function inSchedule(epochMs: number): boolean {
  const hour = new Date(epochMs + ENERGY.utcOffsetHours * 3_600_000).getUTCHours();
  return hour >= ENERGY.scheduleStartHour && hour < ENERGY.scheduleEndHour;
}

export function savedKwh(state: HvacControlState, from: number, to: number, areaSqm: number): number {
  if (to <= from) return 0;
  const minutes = Math.min((to - from) / 60_000, ENERGY.maxIntervalMinutes);
  const baseline = inSchedule(from) ? 1 : 0;
  return (baseline - HVAC_POWER_FRACTION[state]) * ratedKw(areaSqm) * (minutes / 60);
}

export const kwhToCop = (kwh: number, tariffCopPerKwh: number) => kwh * tariffCopPerKwh;
export const kwhToKgCo2 = (kwh: number, factor: number = ENERGY.emissionFactorKgCo2PerKwh) => kwh * factor;

/** Savings report computed from twin states, same aggregation as TwinQueryService.savings(). */
export function savingsFromTwins(twins: readonly TwinSpace[], generatedAt: number, factor: number = ENERGY.emissionFactorKgCo2PerKwh): SavingsReport {
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
