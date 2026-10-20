import { describe, expect, it } from 'vitest';
import type { SimulationScenario } from '../../domain/model';
import { InMemoryPhysicsGateway } from './InMemoryPhysicsGateway';

/** The browser simulation must reach the same outcomes as SimulationService in Java. */
const START = Date.parse('2026-10-20T15:00:00Z');

async function stateAfter(scenario: SimulationScenario, spaceId: string) {
  const gateway = new InMemoryPhysicsGateway(START);
  const trace = await gateway.runScenario(scenario);
  const twin = gateway.getSnapshot().twins.find((t) => t.space.spaceId === spaceId)!;
  return { trace, state: twin.state };
}

describe('escenarios de la simulación local', () => {
  it('no-show libera el aula y bloquea el HVAC', async () => {
    const { state, trace } = await stateAfter('NO_SHOW', 'AULA-MAGNA-204');
    expect(state.status).toBe('LIBERADO_POR_NO_SHOW');
    expect(state.hvacState).toBe('BLOQUEO_AHORRO_VACIO');
    expect(trace?.steps[0]?.layer).toBe('INBOUND_ADAPTER');
    expect(trace?.steps.at(-1)?.layer).toBe('OUTBOUND_ADAPTER');
  });

  it('pre-enfriamiento en el aula tropical', async () => {
    expect((await stateAfter('PRE_ENFRIAMIENTO', 'AULA-MAGNA-204')).state.hvacState).toBe('PRE_ENFRIAMIENTO_IA');
  });

  it('mantenimiento, override docente y aula pop-up', async () => {
    expect((await stateAfter('MANTENIMIENTO', 'LAB-IA-102')).state.status).toBe('MANTENIMIENTO');
    expect((await stateAfter('OVERRIDE_DOCENTE', 'AULA-MAGNA-204')).state.hvacState).toBe('OVERRIDE_MANUAL_DOCENTE');
    expect((await stateAfter('POPUP_PARCIALES', 'AULA-ADM-101')).state.status).toBe('HABILITADO_POPUP_PARCIALES');
  });

  it('acaparamiento: mesa 1 liberada por abandono y mesa 2 en alerta', async () => {
    const { state } = await stateAfter('ACAPARAMIENTO_BIBLIOTECA', 'BIB-PISO-2');
    const desk = (id: string) => state.desks.find((d) => d.zoneId === id)?.state;
    expect(state.desks).toHaveLength(8);
    expect(desk('BIB2-M01')).toBe('LIBERADO_POR_ABANDONO');
    expect(desk('BIB2-M02')).toBe('ALERTA_ACAPARAMIENTO');
  });

  it('el fallo de cámara deja el filtro con dos mediciones', async () => {
    const { state } = await stateAfter('FALLO_CAMARA', 'AULA-301');
    expect(state.cameraOnline).toBe(false);
    expect(state.kalman?.measurements).toHaveLength(2);
  });

  it('el check-in pone a un estudiante en la mesa', async () => {
    const gateway = new InMemoryPhysicsGateway(START);
    await gateway.checkIn('BIB-PISO-2', 'BIB2-M08');
    const library = gateway.getSnapshot().twins.find((t) => t.space.spaceId === 'BIB-PISO-2')!;
    expect(library.state.desks.find((d) => d.zoneId === 'BIB2-M08')?.state).toBe('OCUPADO_VERIFICADO');
  });
});
