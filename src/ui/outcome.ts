import type { ArchitectureTrace, HvacControlState, ScenarioInfo, SimulationScenario, TwinSpace } from '../domain/model';
import { CONDITION_META, DESK_META, HVAC_META, SEAT_WORD, STATUS_META } from './theme';

/** What the audience reads after a scenario: what happened, what the system decided and what it did. */
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

/** State of the room just before the scenario, to tell what changed. */
export interface Before {
  hvac: HvacControlState | null;
  lightsOn: boolean;
  devicesOn: number;
}

/** First clause of the catalog description: the situation that triggers the scenario. */
function causeOf(description: string): string {
  const clause = description.split(/[:;]/)[0]?.trim() ?? description;
  return clause.charAt(0).toUpperCase() + clause.slice(1);
}

/**
 * Built on every render from the live twin, so the strip follows the room as it settles (people still
 * walking in after a "Sobrecupo", the 15-minute timer of a held desk running out).
 */
export function summarizeOutcome(
  scenario: SimulationScenario,
  info: ScenarioInfo | undefined,
  trace: ArchitectureTrace | null,
  twin: TwinSpace | undefined,
  before: Before | null,
): ScenarioOutcome {
  const id = trace?.traceId ?? scenario;
  if (scenario === 'REINICIAR' || !twin) {
    return {
      id, scenario, spaceId: '*', spaceName: 'Todo el campus',
      cause: 'Se reinicia la demostración',
      causeDetail: null,
      decision: 'Salones como a las 10 de la mañana',
      decisionColor: null,
      decisionRule: 'Se borran las reservas de prueba',
      effect: 'Listo para el siguiente escenario',
      effectDetail: null,
      traceId: trace?.traceId ?? null,
    };
  }

  const { state, space } = twin;
  const seats = state.desks.length;
  const seated = state.desks.filter((d) => d.state === 'OCUPADO_VERIFICADO').length;
  const [, seatPlural] = SEAT_WORD[space.type];
  const causeDetail = seats > 0
    ? `${state.occupancy} personas · ${seated} de ${seats} ${seatPlural} ocupados`
    : `${state.occupancy} personas ahora`;

  let decision = STATUS_META[state.status].label;
  let decisionColor: string | null = STATUS_META[state.status].ink;
  let decisionRule = 'Regla de aforo y reservas';

  if (scenario === 'ACAPARAMIENTO_BIBLIOTECA') {
    const released = state.desks.filter((d) => d.state === 'LIBERADO_POR_ABANDONO').length;
    const held = state.desks.filter((d) => d.state === 'ALERTA_ACAPARAMIENTO').length;
    decision = [
      released > 0 ? `${released} ${released === 1 ? 'mesa liberada' : 'mesas liberadas'}` : null,
      held > 0 ? `${held} con cronómetro de 15 min` : null,
    ].filter(Boolean).join(', ') || 'Sin mesas ocupadas con cosas';
    decisionColor = released > 0 ? DESK_META.LIBERADO_POR_ABANDONO.ink : DESK_META.ALERTA_ACAPARAMIENTO.ink;
    decisionRule = 'La cámara ve cosas en la mesa, pero no a la persona';
  } else if (scenario === 'FALLO_CAMARA') {
    decision = 'Seguir contando sin cámara';
    decisionColor = null;
    decisionRule = 'Estima con el CO₂ del aire y los celulares en el Wi-Fi';
  } else if (scenario === 'LUCES_ENCENDIDAS' || scenario === 'EQUIPOS_ENCENDIDOS') {
    decision = scenario === 'LUCES_ENCENDIDAS' ? 'Apagar las luces' : 'Apagar luces y suspender equipos';
    decisionColor = CONDITION_META.LUCES_SIN_OCUPACION.ink;
    decisionRule = 'Salón vacío más de 5 min con energía encendida';
  } else if (scenario === 'CO2_ALTO') {
    decision = 'Ventilar el salón';
    decisionColor = HVAC_META.VENTILACION_CO2_ACTIVA.ink;
    decisionRule = 'Más de 1000 ppm de CO₂: el aire va primero';
  } else if (scenario === 'OVERRIDE_DOCENTE') {
    decision = 'El docente manda en el clima';
    decisionColor = HVAC_META.OVERRIDE_MANUAL_DOCENTE.ink;
    decisionRule = 'Durante 45 minutos';
  } else if (state.condition === 'SOBRECUPO') {
    decisionColor = CONDITION_META.SOBRECUPO.ink;
  }

  const lightsChanged = before !== null && before.lightsOn !== state.lightsOn;
  const devicesChanged = before !== null && before.devicesOn !== state.devicesOn;
  const hvacChanged = before?.hvac != null && before.hvac !== state.hvacState;
  let effect: string;
  let effectDetail: string | null;
  // Energy scenarios switch the room on and the Arduino switches it off within the same frames, so
  // "before" may already read off: the scenario itself says what was on.
  const energyScenario = scenario === 'LUCES_ENCENDIDAS' || scenario === 'EQUIPOS_ENCENDIDOS';
  const relayed = trace?.steps.some((s) => s.component.startsWith('RoomEquipmentCommandPort')) ?? false;
  if ((energyScenario || relayed) && !state.lightsOn && state.devicesOn === 0) {
    const devices = scenario === 'EQUIPOS_ENCENDIDOS' ? twin?.space.computers ?? 0 : devicesChanged && before ? before.devicesOn : 0;
    effect = `Arduino: luces apagadas${devices > 0 ? ` y ${devices} equipos suspendidos` : ''}`;
    effectDetail = 'El relé del salón cortó la energía sin que nadie lo pidiera';
  } else if ((lightsChanged || devicesChanged) && !state.lightsOn && state.devicesOn === 0) {
    const parts = [lightsChanged ? 'luces apagadas' : null, devicesChanged && before ? `${before.devicesOn} equipos suspendidos` : null].filter(Boolean);
    effect = `Arduino: ${parts.join(' y ')}`;
    effectDetail = 'El relé del salón cortó la energía';
  } else if (hvacChanged) {
    effect = HVAC_META[state.hvacState].label;
    effectDetail = `Antes: ${HVAC_META[before!.hvac!].label.toLowerCase()}`;
  } else {
    effect = `${HVAC_META[state.hvacState].label}, luces ${state.lightsOn ? 'encendidas' : 'apagadas'}`;
    effectDetail = 'No hizo falta dar ninguna orden';
  }

  return {
    id, scenario, spaceId: space.spaceId, spaceName: space.name, cause: causeOf(info?.description ?? scenario),
    causeDetail, decision, decisionColor, decisionRule, effect, effectDetail, traceId: trace?.traceId ?? null,
  };
}
