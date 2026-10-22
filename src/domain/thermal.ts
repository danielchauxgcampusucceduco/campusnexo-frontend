import type { ClimateProfile, HvacControlState, HvacMode, ThermalDecision } from './model';

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
const PRE_CONDITIONING_MARGIN_C = 0.5;

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
    default:
      throw new RangeError(`unsupported climate profile: ${String(profile)}`);
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

/** Java: HvacMode.toward — heating when the target is warmer than the room, cooling otherwise. */
export function toward(indoorC: number, targetC: number): HvacMode {
  return targetC > indoorC ? 'CALEFACCION' : 'ENFRIAMIENTO';
}

/** A strategy with the unit running, heating or cooling towards {@code target}. */
function active(state: HvacControlState, indoorC: number, target: number, horizon: number, trajectory: number[], explanation: string): ThermalDecision {
  const setpointC = round2(clampSetpoint(target));
  return { recommendedState: state, mode: toward(indoorC, setpointC), setpointC, horizonMinutes: horizon,
    stepMinutes: THERMAL_PARAMETERS.stepMinutes, freeRunningTrajectoryC: trajectory, explanation };
}

/** A strategy with the unit stopped; the setpoint is informative. */
function idle(state: HvacControlState, setpoint: number, horizon: number, trajectory: number[], explanation: string): ThermalDecision {
  return { recommendedState: state, mode: 'APAGADO', setpointC: round2(clampSetpoint(setpoint)), horizonMinutes: horizon,
    stepMinutes: THERMAL_PARAMETERS.stepMinutes, freeRunningTrajectoryC: trajectory, explanation };
}

/** One degree inside the nearest edge of the band. */
const backIntoBand = (t: number, band: ComfortBand) => (t > band.highC ? band.highC - 1 : band.lowC + 1);

/** Port of ThermalInertiaMpcDomainService.decide (same strategies, setpoints, modes and explanations). */
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
  return occupants > 0 ? decideOccupied(context) : decideEmpty(context);
}

function decideOccupied(context: ThermalContext): ThermalDecision {
  const p = THERMAL_PARAMETERS;
  const { band, indoorTemperatureC: indoor } = context;
  const horizon = context.minutesUntilOccupancyEnds === null ? p.defaultOccupiedMinutes : Math.max(p.stepMinutes, context.minutesUntilOccupancyEnds);
  const trajectory = freeRunning(indoor, context.outdoorTemperatureC, context.occupants, context.areaSqm, horizon);
  if (!inBand(band, indoor)) {
    return active('CONFORT_ACTIVO', indoor, backIntoBand(indoor, band), horizon, trajectory,
      `Temperatura de ${fixed(indoor)} °C fuera de la banda ${fixed(band.lowC)}–${fixed(band.highC)} °C con ocupantes`);
  }
  if (context.co2Ppm > p.co2VentilationPpm) {
    return idle('VENTILACION_CO2_ACTIVA', (band.lowC + band.highC) / 2, horizon, trajectory,
      `CO2 de ${fixed(context.co2Ppm, 0)} ppm sobre ${p.co2VentilationPpm} ppm: prioridad a la renovación de aire`);
  }
  if (trajectory.every((t) => inBand(band, t))) {
    return idle('CORTE_INERCIA_TERMICA', indoor, horizon, trajectory,
      `La inercia térmica mantiene el confort ${horizon} min (previsto ${fixed(Math.min(...trajectory))}–${fixed(Math.max(...trajectory))} °C): equipo apagado`);
  }
  const exit = trajectory.find((t) => !inBand(band, t)) ?? trajectory[trajectory.length - 1]!;
  return active('CONFORT_ACTIVO', indoor, backIntoBand(exit, band), horizon, trajectory,
    `Sin climatizar saldría de la banda (${fixed(exit)} °C) antes de terminar la ocupación`);
}

function decideEmpty(context: ThermalContext): ThermalDecision {
  const p = THERMAL_PARAMETERS;
  const { band, indoorTemperatureC: indoor } = context;
  const next = context.minutesUntilNextOccupancy;
  if (next === null || next > p.ecoSetbackWindowMinutes) {
    const trajectory = freeRunning(indoor, context.outdoorTemperatureC, 0, context.areaSqm, p.defaultOccupiedMinutes);
    return idle('BLOQUEO_AHORRO_VACIO', indoor, p.defaultOccupiedMinutes, trajectory,
      'Espacio vacío sin ocupación prevista en la ventana de control: climatización bloqueada');
  }
  const horizon = Math.max(p.stepMinutes, next);
  const trajectory = freeRunning(indoor, context.outdoorTemperatureC, 0, context.areaSqm, horizon);
  const atArrival = trajectory[trajectory.length - 1]!;
  if (next <= p.preConditioningLeadMinutes && !inBand(band, atArrival)) {
    const tooWarm = atArrival > band.highC;
    const target = tooWarm ? band.highC - PRE_CONDITIONING_MARGIN_C : band.lowC + PRE_CONDITIONING_MARGIN_C;
    const minutesNeeded = Math.abs(atArrival - target) / p.hvacRateCPerMinute;
    if (minutesNeeded >= next - p.stepMinutes) {
      return active(tooWarm ? 'PRE_ENFRIAMIENTO_IA' : 'PRE_CALENTAMIENTO_IA', indoor, target, horizon, trajectory,
        `Clase en ${next} min y llegaría a ${fixed(atArrival)} °C: se ${tooWarm ? 'pre-enfría' : 'pre-calienta'} (${Math.ceil(minutesNeeded)} min necesarios)`);
    }
  }
  const setback = atArrival > (band.lowC + band.highC) / 2 ? band.highC + p.ecoSetbackOffsetC : band.lowC - p.ecoSetbackOffsetC;
  return active('ECO_SETBACK_ENTRE_CLASES', indoor, setback, horizon, trajectory,
    `Clase en ${next} min: setpoint relajado ${fixed(p.ecoSetbackOffsetC)} °C entre clases`);
}
