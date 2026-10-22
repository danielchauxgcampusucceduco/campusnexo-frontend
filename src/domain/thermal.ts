import type { ClimateProfile, HvacControlState, ThermalDecision } from './model';

/** Same defaults as ThermalParameters.defaults() in Java. */
export const THERMAL_PARAMETERS = {
  timeConstantMinutes: 120,
  occupantGainCPerHour: 0.06,
  hvacRateCPerMinute: 0.08,
  stepMinutes: 5,
  defaultOccupiedMinutes: 45,
  preConditioningLeadMinutes: 30,
  ecoSetbackWindowMinutes: 60,
  ecoSetbackOffsetC: 2,
  co2VentilationPpm: 1000,
} as const;

const REFERENCE_AREA_SQM = 50;
const PRE_COOLING_MARGIN_C = 0.5;

export interface ComfortBand {
  lowC: number;
  highC: number;
}

export function comfortBand(profile: ClimateProfile): ComfortBand {
  switch (profile) {
    case 'SEDE_ANDINA':
      return { lowC: 19, highC: 24 };
    case 'SEDE_TROPICAL':
      return { lowC: 23, highC: 26 };
    case 'SEDE_TEMPLADA':
      return { lowC: 20, highC: 25 };
  }
}

export interface ThermalContext {
  indoorTemperatureC: number;
  outdoorTemperatureC: number;
  occupants: number;
  areaSqm: number;
  co2Ppm: number;
  band: ComfortBand;
  minutesUntilOccupancyEnds: number | null;
  minutesUntilNextOccupancy: number | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const inBand = (band: ComfortBand, t: number) => t >= band.lowC && t <= band.highC;
const clampSetpoint = (setpoint: number) => Math.min(30, Math.max(16, setpoint));
const fixed = (value: number, digits = 1) => value.toFixed(digits);

/** First-order RC model: T(k+1) = Tout + (T(k) − Tout)·e^(−Δt/τ) + g·n·(50/A)·Δt/60. */
export function freeRunning(indoorC: number, outdoorC: number, occupants: number, areaSqm: number, horizonMinutes: number): number[] {
  if (![indoorC, outdoorC, occupants, areaSqm, horizonMinutes].every(Number.isFinite)) {
    throw new RangeError('thermal inputs must be finite');
  }
  if (!Number.isInteger(occupants) || occupants < 0 || areaSqm <= 0 || horizonMinutes < 0) {
    throw new RangeError('occupants, area and horizon must be non-negative with positive area');
  }
  const { stepMinutes, timeConstantMinutes, occupantGainCPerHour } = THERMAL_PARAMETERS;
  const steps = Math.max(1, Math.ceil(horizonMinutes / stepMinutes));
  const decay = Math.exp(-stepMinutes / timeConstantMinutes);
  const gainPerStep = (occupantGainCPerHour * occupants * (REFERENCE_AREA_SQM / areaSqm) * stepMinutes) / 60;
  const trajectory = [round2(indoorC)];
  let temperature = indoorC;
  for (let k = 0; k < steps; k++) {
    temperature = outdoorC + (temperature - outdoorC) * decay + gainPerStep;
    trajectory.push(round2(temperature));
  }
  return trajectory;
}

function decision(state: HvacControlState, setpoint: number, horizon: number, trajectory: number[], explanation: string): ThermalDecision {
  return {
    recommendedState: state,
    setpointC: round2(clampSetpoint(setpoint)),
    horizonMinutes: horizon,
    stepMinutes: THERMAL_PARAMETERS.stepMinutes,
    freeRunningTrajectoryC: trajectory,
    explanation,
  };
}

/** Port of ThermalInertiaMpcDomainService.decide. */
export function decideThermal(context: ThermalContext): ThermalDecision {
  const { indoorTemperatureC, outdoorTemperatureC, occupants, areaSqm, co2Ppm, band,
    minutesUntilOccupancyEnds, minutesUntilNextOccupancy } = context;
  if (![indoorTemperatureC, outdoorTemperatureC, occupants, areaSqm, co2Ppm, band.lowC, band.highC].every(Number.isFinite)) {
    throw new RangeError('thermal context must be finite');
  }
  if (!Number.isInteger(occupants) || occupants < 0 || areaSqm <= 0 || co2Ppm < 0
      || band.lowC >= band.highC
      || (minutesUntilOccupancyEnds !== null && (!Number.isFinite(minutesUntilOccupancyEnds) || minutesUntilOccupancyEnds < 0))
      || (minutesUntilNextOccupancy !== null && (!Number.isFinite(minutesUntilNextOccupancy) || minutesUntilNextOccupancy < 0))) {
    throw new RangeError('thermal context is outside its domain');
  }
  const p = THERMAL_PARAMETERS;
  const { indoorTemperatureC: indoor } = context;
  const midpoint = (band.lowC + band.highC) / 2;

  if (context.occupants > 0) {
    const horizon = context.minutesUntilOccupancyEnds === null ? p.defaultOccupiedMinutes : Math.max(p.stepMinutes, context.minutesUntilOccupancyEnds);
    const trajectory = freeRunning(indoor, context.outdoorTemperatureC, context.occupants, context.areaSqm, horizon);
    if (!inBand(band, indoor)) {
      const tooWarm = indoor > band.highC;
      return decision('CONFORT_ACTIVO', tooWarm ? band.highC - 1 : band.lowC + 1, horizon, trajectory,
        `Temperatura de ${fixed(indoor)} °C fuera de la banda ${fixed(band.lowC)}–${fixed(band.highC)} °C con ocupantes`);
    }
    if (context.co2Ppm > p.co2VentilationPpm) {
      return decision('VENTILACION_CO2_ACTIVA', midpoint, horizon, trajectory,
        `CO2 de ${fixed(context.co2Ppm, 0)} ppm sobre ${p.co2VentilationPpm} ppm: prioridad a la renovación de aire`);
    }
    if (trajectory.every((t) => inBand(band, t))) {
      return decision('CORTE_INERCIA_TERMICA', band.highC, horizon, trajectory,
        `La inercia térmica mantiene el confort ${horizon} min (máx. previsto ${fixed(Math.max(...trajectory))} °C): compresor apagado`);
    }
    const exit = trajectory.find((t) => !inBand(band, t)) ?? trajectory[trajectory.length - 1]!;
    return decision('CONFORT_ACTIVO', exit > band.highC ? band.highC - 1 : band.lowC + 1, horizon, trajectory,
      `Sin climatizar saldría de la banda (${fixed(exit)} °C) antes de terminar la ocupación`);
  }

  const next = context.minutesUntilNextOccupancy;
  if (next === null || next > p.ecoSetbackWindowMinutes) {
    const trajectory = freeRunning(indoor, context.outdoorTemperatureC, 0, context.areaSqm, p.defaultOccupiedMinutes);
    return decision('BLOQUEO_AHORRO_VACIO', midpoint, p.defaultOccupiedMinutes, trajectory,
      'Espacio vacío sin ocupación prevista en la ventana de control: climatización bloqueada');
  }
  const horizon = Math.max(p.stepMinutes, next);
  const trajectory = freeRunning(indoor, context.outdoorTemperatureC, 0, context.areaSqm, horizon);
  const atArrival = trajectory[trajectory.length - 1]!;
  if (next <= p.preConditioningLeadMinutes && atArrival > band.highC) {
    const target = band.highC - PRE_COOLING_MARGIN_C;
    const minutesNeeded = (atArrival - target) / p.hvacRateCPerMinute;
    if (minutesNeeded >= next - p.stepMinutes) {
      return decision('PRE_ENFRIAMIENTO_IA', target, horizon, trajectory,
        `Clase en ${next} min y llegaría a ${fixed(atArrival)} °C: se pre-enfría (${Math.ceil(minutesNeeded)} min necesarios)`);
    }
  }
  const setback = atArrival > midpoint ? band.highC + p.ecoSetbackOffsetC : band.lowC - p.ecoSetbackOffsetC;
  return decision('ECO_SETBACK_ENTRE_CLASES', setback, horizon, trajectory,
    `Clase en ${next} min: setpoint relajado ${fixed(p.ecoSetbackOffsetC)} °C entre clases`);
}
