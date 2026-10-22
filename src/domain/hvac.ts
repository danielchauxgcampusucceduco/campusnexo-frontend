import { COMPRESSOR_ON, type ClimateProfile, type HvacControlState, type HvacMode, type ThermalDecision } from './model';
import { comfortBand, toward, type ComfortBand } from './thermal';

/**
 * Port of edu.campusnexo.domain.twin.hvac: the climate family (Abstract Factory) and the chain of HVAC rules
 * (Chain of Responsibility) that turn the MPC proposal into what the unit is told to do. Same order as
 * HvacSettingChain.standard(): sin equipo → mantenimiento → docente → compresor → familia → MPC.
 */

/** Java: CompressorGuard.standard() — 10 min on, 5 min off before switching. */
export const COMPRESSOR_GUARD = { minimumOnMinutes: 10, minimumOffMinutes: 5 } as const;

export function mustHoldCompressor(onNow: boolean, onRequested: boolean, minutesInCurrentState: number): boolean {
  if (onNow && !onRequested) return minutesInCurrentState < COMPRESSOR_GUARD.minimumOnMinutes;
  if (!onNow && onRequested) return minutesInCurrentState < COMPRESSOR_GUARD.minimumOffMinutes;
  return false;
}

export interface FamilyContext {
  occupied: boolean;
  indoorTemperatureC: number;
  outdoorTemperatureC: number;
  humidityPct: number;
}

interface FamilyDecision {
  mode: HvacMode;
  setpointC: number;
  explanation: string;
}

/** The family's own thermal strategy (Java: createThermalStrategy of each ClimatePolicyFactory). */
export function familyStrategy(profile: ClimateProfile, context: FamilyContext): FamilyDecision {
  const band = comfortBand(profile);
  const indoor = context.indoorTemperatureC;
  const idle = (setpointC: number, explanation: string): FamilyDecision => ({ mode: 'APAGADO', setpointC, explanation });
  switch (profile) {
    case 'SEDE_ANDINA': {
      const heating = band.lowC + 1;
      const cooling = band.highC + 1;
      if (!context.occupied) return idle(heating, 'Sin ocupación; no se climatiza el espacio');
      if (indoor < heating - 1) return { mode: 'CALEFACCION', setpointC: heating, explanation: 'Temperatura interior bajo el setpoint de calefacción con ocupación presente' };
      if (indoor > cooling + 1) return { mode: 'ENFRIAMIENTO', setpointC: cooling, explanation: 'Temperatura interior sobre el límite de confort con ocupación presente' };
      return idle(heating, 'Temperatura interior dentro de la banda de confort');
    }
    case 'SEDE_TROPICAL': {
      const cooling = band.highC - 0.5;
      if (!context.occupied) return idle(cooling, 'Sin ocupación; no se climatiza el espacio');
      if (indoor > cooling + 0.5) return { mode: 'ENFRIAMIENTO', setpointC: cooling, explanation: 'Temperatura interior sobre el setpoint de enfriamiento con ocupación presente' };
      if (context.humidityPct > 70) return { mode: 'DESHUMIDIFICACION', setpointC: cooling, explanation: 'Humedad relativa sobre el máximo de confort; se recomienda deshumidificar' };
      return idle(cooling, 'Temperatura y humedad dentro de la banda de confort');
    }
    case 'SEDE_TEMPLADA': {
      if (!context.occupied) return idle(band.highC, 'Sin ocupación; no se climatiza el espacio');
      if (indoor < band.lowC) return { mode: 'CALEFACCION', setpointC: band.lowC, explanation: 'Temperatura interior bajo la banda de confort' };
      if (indoor > band.highC) {
        if (context.outdoorTemperatureC <= indoor - 2) return idle(band.highC, 'Exterior más fresco que el interior; se prefiere enfriamiento libre por ventilación natural');
        return { mode: 'ENFRIAMIENTO', setpointC: band.highC, explanation: 'Temperatura interior sobre la banda de confort' };
      }
      return idle(band.highC, 'Temperatura interior dentro de la banda de confort');
    }
    default:
      throw new RangeError(`unsupported climate profile: ${String(profile)}`);
  }
}

/** Java: HvacSetting — what the unit is doing, since when and why. */
export interface HvacSetting {
  state: HvacControlState;
  mode: HvacMode;
  setpointC: number;
  /** Epoch ms. */
  since: number;
  reason: string;
}

/** Java: HvacResolution. */
export interface HvacResolution {
  state: HvacControlState;
  mode: HvacMode;
  setpointC: number;
  explanation: string;
  decidedBy: HvacRuleName;
}

export interface HvacRequest {
  hvacInstalled: boolean;
  maintenance: boolean;
  overrideActive: boolean;
  previous: HvacSetting;
  predicted: ThermalDecision;
  profile: ClimateProfile;
  climate: FamilyContext;
  firstDecision: boolean;
  now: number;
}

export const HVAC_RULES = [
  'NoClimateUnitRule',
  'MaintenanceRule',
  'ManualOverrideRule',
  'CompressorProtectionRule',
  'FamilyStrategyRule',
  'PredictiveControlRule',
] as const;
export type HvacRuleName = (typeof HVAC_RULES)[number];

type Next = (request: HvacRequest) => HvacResolution;
type Rule = (request: HvacRequest, next: Next) => HvacResolution;

const fixed = (value: number) => value.toFixed(1);
const midpoint = (band: ComfortBand) => (band.lowC + band.highC) / 2;

const RULES: Record<HvacRuleName, Rule> = {
  NoClimateUnitRule: (request, next) => (request.hvacInstalled ? next(request)
    : { state: 'SIN_CLIMATIZACION', mode: 'APAGADO', setpointC: request.previous.setpointC, explanation: 'El espacio no tiene equipo de climatización', decidedBy: 'NoClimateUnitRule' }),
  MaintenanceRule: (request, next) => (!request.maintenance ? next(request)
    : { state: 'APAGADO', mode: 'APAGADO', setpointC: request.previous.setpointC, explanation: 'Espacio en mantenimiento: climatización apagada', decidedBy: 'MaintenanceRule' }),
  ManualOverrideRule: (request, next) => {
    if (!request.overrideActive) return next(request);
    const target = midpoint(comfortBand(request.profile));
    return { state: 'OVERRIDE_MANUAL_DOCENTE', mode: toward(request.climate.indoorTemperatureC, target), setpointC: target,
      explanation: `Control manual del docente: hacia ${fixed(target)} °C`, decidedBy: 'ManualOverrideRule' };
  },
  CompressorProtectionRule: (request, next) => {
    const proposal = next(request);
    if (request.firstDecision) return proposal;
    const current = request.previous;
    const onNow = COMPRESSOR_ON.has(current.state);
    const minutes = Math.floor((request.now - current.since) / 60_000);
    if (!mustHoldCompressor(onNow, COMPRESSOR_ON.has(proposal.state), minutes)) return proposal;
    const minimum = onNow ? COMPRESSOR_GUARD.minimumOnMinutes : COMPRESSOR_GUARD.minimumOffMinutes;
    return { state: current.state, mode: current.mode, setpointC: current.setpointC,
      explanation: `Se mantiene ${current.state} por protección del compresor (mínimo ${minimum} min, lleva ${minutes}). Pendiente: ${proposal.explanation}`,
      decidedBy: 'CompressorProtectionRule' };
  },
  FamilyStrategyRule: (request, next) => {
    const proposal = next(request);
    if (!request.climate.occupied) return proposal;
    const family = familyStrategy(request.profile, request.climate);
    if (COMPRESSOR_ON.has(proposal.state) && family.mode !== 'APAGADO') {
      return { ...proposal, mode: family.mode, setpointC: family.setpointC,
        explanation: `${proposal.explanation}; modo de la familia ${request.profile}: ${family.explanation}`, decidedBy: 'FamilyStrategyRule' };
    }
    if (proposal.state === 'CORTE_INERCIA_TERMICA' && family.mode === 'DESHUMIDIFICACION') {
      return { state: 'CONFORT_ACTIVO', mode: 'DESHUMIDIFICACION', setpointC: family.setpointC,
        explanation: `Familia ${request.profile}: ${family.explanation}`, decidedBy: 'FamilyStrategyRule' };
    }
    return proposal;
  },
  PredictiveControlRule: (request) => ({ state: request.predicted.recommendedState, mode: request.predicted.mode,
    setpointC: request.predicted.setpointC, explanation: request.predicted.explanation, decidedBy: 'PredictiveControlRule' }),
};

/** Java: HvacSettingChain.standard().proceed(request). */
export function resolveHvac(request: HvacRequest): HvacResolution {
  const run = (position: number): Next => (r) => {
    const name = HVAC_RULES[position];
    if (name === undefined) throw new Error('Ninguna regla HVAC decidió: la última regla debe ser terminal');
    return RULES[name](r, run(position + 1));
  };
  return run(0)(request);
}
