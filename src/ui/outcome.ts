import type { ArchitectureTrace, HvacControlState, ScenarioInfo, SimulationScenario, TwinSpace } from '../domain/model';
import { DESK_META, HVAC_META, STATUS_META } from './theme';

/** What the audience reads after a scenario: the measurement, the domain decision and its effect. */
export interface ScenarioOutcome {
  id: string;
  scenario: SimulationScenario;
  spaceId: string;
  spaceName: string;
  cause: string;
  causeDetail: string | null;
  decision: string;
  decisionColor: string | null;
  decisionRule: string;
  effect: string;
  effectDetail: string | null;
  traceId: string | null;
}


/** First clause of the catalog description: the situation that triggers the scenario. */
function causeOf(description: string): string {
  const clause = description.split(/[:;]/)[0]?.trim() ?? description;
  return clause.charAt(0).toUpperCase() + clause.slice(1);
}

/**
 * Built on every render from the live twin, so the strip follows the room as it settles (people
 * still walking in after a "Sobrecupo", the 15-minute timer of a held desk running out).
 */
export function summarizeOutcome(
  scenario: SimulationScenario,
  info: ScenarioInfo | undefined,
  trace: ArchitectureTrace | null,
  twin: TwinSpace | undefined,
  hvacBefore: HvacControlState | null,
): ScenarioOutcome {
  const id = trace?.traceId ?? scenario;
  if (scenario === 'REINICIAR' || !twin) {
    return {
      id, scenario, spaceId: '*', spaceName: 'Todo el campus',
      cause: 'Se reinicia la demostración',
      causeDetail: null,
      decision: 'Espacios restablecidos',
      decisionColor: null,
      decisionRule: 'SimulationUseCase',
      effect: 'Reservas de simulación eliminadas',
      effectDetail: null,
      traceId: trace?.traceId ?? null,
    };
  }

  const { state, space } = twin;
  const cause = causeOf(info?.description ?? scenario);
  let decision = STATUS_META[state.status].label;
  let decisionColor: string | null = STATUS_META[state.status].ink;
  let decisionRule = 'SpaceStatusPolicy';

  if (scenario === 'ACAPARAMIENTO_BIBLIOTECA') {
    const released = state.desks.filter((d) => d.state === 'LIBERADO_POR_ABANDONO').length;
    const held = state.desks.filter((d) => d.state === 'ALERTA_ACAPARAMIENTO').length;
    decision = [
      released > 0 ? `${released} ${released === 1 ? 'mesa liberada' : 'mesas liberadas'} por abandono` : null,
      held > 0 ? `${held} con cronómetro de 15 min` : null,
    ].filter(Boolean).join(', ') || 'Sin mesas acaparadas';
    decisionColor = released > 0 ? DESK_META.LIBERADO_POR_ABANDONO.ink : DESK_META.ALERTA_ACAPARAMIENTO.ink;
    decisionRule = 'StudyZoneRoi.evaluateDeskGhosting';
  } else if (scenario === 'FALLO_CAMARA') {
    const sources = state.kalman?.measurements.length ?? 0;
    decision = `Kalman sigue con ${sources} ${sources === 1 ? 'medición' : 'mediciones'}: CO₂ y Wi-Fi`;
    decisionColor = null;
    decisionRule = 'OccupancyKalmanDomainService';
  }

  const changed = hvacBefore !== null && hvacBefore !== state.hvacState;
  const effect = changed ? `HVAC: ${HVAC_META[state.hvacState].label}` : `HVAC sin cambios: ${HVAC_META[state.hvacState].label}`;
  const effectDetail = changed
    ? `antes ${HVAC_META[hvacBefore].label.toLowerCase()}; orden enviada al actuador`
    : 'no hizo falta enviar una orden al actuador';
  const reservation = twin.activeReservation ? `, reserva ${twin.activeReservation.reference}` : '';

  return {
    id,
    scenario,
    spaceId: space.spaceId,
    spaceName: space.name,
    cause,
    causeDetail: `${state.occupancy} de ${space.capacity} personas ahora${reservation}`,
    decision,
    decisionColor,
    decisionRule,
    effect,
    effectDetail,
    traceId: trace?.traceId ?? null,
  };
}
