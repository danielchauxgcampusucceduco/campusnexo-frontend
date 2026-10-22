import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SimulationScenario } from '../../domain/model';
import { InMemoryPhysicsGateway } from './InMemoryPhysicsGateway';

/** The browser simulation must reach the same outcomes as SimulationService in Java. */
const START = Date.parse('2026-10-20T15:00:00Z');

async function stateAfter(scenario: SimulationScenario, spaceId: string) {
  const gateway = new InMemoryPhysicsGateway(START);
  const trace = await gateway.runScenario(scenario);
  const twin = gateway.getSnapshot().twins.find((t) => t.space.spaceId === spaceId)!;
  return { trace, state: twin.state, twin };
}

const seated = (state: { desks: { state: string }[] }) => state.desks.filter((d) => d.state === 'OCUPADO_VERIFICADO').length;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('campus de la simulación local', () => {
  it('tiene los salones del plano en los bloques A y B con sus pupitres', () => {
    const twins = new InMemoryPhysicsGateway(START).getSnapshot().twins;
    expect(twins).toHaveLength(107);
    expect(twins.some((t) => t.space.buildingId === 'BLOQUE-A')).toBe(true);
    expect(twins.find((t) => t.space.spaceId === '421-A')!.rois).toHaveLength(36);
    expect(twins.find((t) => t.space.spaceId === '4A-SALA-DE-JUNTAS-GALERAS')!.rois).toHaveLength(0);
  });

  it('clamps the simulation clock to its supported range and rejects NaN', () => {
    const gateway = new InMemoryPhysicsGateway(START);

    gateway.setTimeScale(0);
    expect(gateway.timeScale()).toBe(1);
    gateway.setTimeScale(500);
    expect(gateway.timeScale()).toBe(300);
    expect(() => gateway.setTimeScale(Number.NaN)).toThrow(RangeError);
  });

  it('starts one clock, stops it cleanly and does not publish after disposal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
    const gateway = new InMemoryPhysicsGateway(START);
    gateway.setTimeScale(60);
    await gateway.start();
    await gateway.start();
    const startedAt = gateway.getSnapshot().now;

    await vi.advanceTimersByTimeAsync(1_000);
    const tickedAt = gateway.getSnapshot().now;
    gateway.stop();
    const stoppedAt = gateway.getSnapshot().now;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(tickedAt - startedAt).toBe(60_000);
    expect(gateway.getSnapshot().now).toBe(stoppedAt);
  });

  it('publishes camera-off state and continues occupancy fusion without camera measurements', () => {
    const gateway = new InMemoryPhysicsGateway(START);

    gateway.setCameraOnline('421-A', false);

    const room = gateway.getSnapshot().twins.find((t) => t.space.spaceId === '421-A')!;
    expect(room.state.cameraOnline).toBe(false);
    expect(room.state.kalman?.measurements.every((measurement) => measurement.source !== 'CAMARA_YOLO')).toBe(true);
  });
});

describe('escenarios de la simulación local', () => {
  it('clase en curso: 26 pupitres ocupados y luces encendidas', async () => {
    const { state, trace } = await stateAfter('CLASE_EN_CURSO', '421-A');
    expect(state.status).toBe('OCUPADO_OPTIMO');
    expect(state.condition).toBe('OCUPADO');
    expect(state.lightsOn).toBe(true);
    expect(seated(state)).toBe(26);
    expect(trace?.steps[0]?.layer).toBe('INBOUND_ADAPTER');
    expect(trace?.steps.at(-1)?.layer).toBe('OUTBOUND_ADAPTER');
  });

  it('no-show libera el salón y apaga el clima', async () => {
    const { state } = await stateAfter('NO_SHOW', '402-B');
    expect(state.status).toBe('LIBERADO_POR_NO_SHOW');
    expect(state.hvacState).toBe('BLOQUEO_AHORRO_VACIO');
  });

  it('sobrecupo en el laboratorio: 15 puestos ocupados', async () => {
    const { state } = await stateAfter('SOBRECUPO', '3B-DE-BIOPROCESOS-LABORATORIO');
    expect(state.condition).toBe('SOBRECUPO');
    expect(seated(state)).toBe(15);
  });

  it('luces encendidas en un salón vacío: el Arduino las apaga', async () => {
    const { state, trace } = await stateAfter('LUCES_ENCENDIDAS', '423-A');
    expect(state.lightsOn).toBe(false);
    expect(state.condition).toBe('LIBRE');
    expect(trace?.steps.some((s) => s.component === 'RoomEquipmentCommandPort.send')).toBe(true);
  });

  it('equipos encendidos en la sala de cómputo vacía: se suspenden', async () => {
    const { state } = await stateAfter('EQUIPOS_ENCENDIDOS', '309-A');
    expect(state.devicesOn).toBe(0);
    expect(state.devicesTotal).toBe(24);
  });

  it('mantenimiento, control docente y sala de estudio para parciales', async () => {
    expect((await stateAfter('MANTENIMIENTO', '2B-LABORATORIO-MULTIFUNCIONAL')).state.condition).toBe('MANTENIMIENTO');
    expect((await stateAfter('OVERRIDE_DOCENTE', '420-A')).state.hvacState).toBe('OVERRIDE_MANUAL_DOCENTE');
    expect((await stateAfter('POPUP_PARCIALES', '503-A')).state.status).toBe('HABILITADO_POPUP_PARCIALES');
  });

  it('acaparamiento: mesa 1 liberada por abandono y mesa 2 en alerta', async () => {
    const { state } = await stateAfter('ACAPARAMIENTO_BIBLIOTECA', 'BIBLIOTECA-2B');
    const desk = (id: string) => state.desks.find((d) => d.zoneId === id)?.state;
    expect(state.desks).toHaveLength(8);
    expect(desk('BIB2B-M01')).toBe('LIBERADO_POR_ABANDONO');
    expect(desk('BIB2B-M02')).toBe('ALERTA_ACAPARAMIENTO');
  });

  it('el fallo de cámara deja el filtro con dos mediciones', async () => {
    const { state } = await stateAfter('FALLO_CAMARA', '421-A');
    expect(state.cameraOnline).toBe(false);
    expect(state.kalman?.measurements).toHaveLength(2);
  });

  it('el check-in pone a un estudiante en la mesa', async () => {
    const gateway = new InMemoryPhysicsGateway(START);
    await gateway.checkIn('BIBLIOTECA-2B', 'BIB2B-M08');
    const library = gateway.getSnapshot().twins.find((t) => t.space.spaceId === 'BIBLIOTECA-2B')!;
    expect(library.state.desks.find((d) => d.zoneId === 'BIB2B-M08')?.state).toBe('OCUPADO_VERIFICADO');
  });
});
