import { savingsFromTwins, ratedKw } from '../../domain/kpis';
import {
  HVAC_POWER_FRACTION,
  type ArchitectureTrace,
  type DeskObservation,
  type ScenarioInfo,
  type SimulationScenario,
  type TelemetrySnapshot,
  type TwinSpace,
} from '../../domain/model';
import { SCENARIO_CATALOG } from '../../domain/scenarios';
import type { CameraFrame, GatewayCapabilities, TwinGateway, TwinSnapshot } from '../../ports/TwinGateway';
import { AVERAGE_OUTSIDE_C, ROIS_BY_SPACE, SEED_SPACES } from './campusSeed';
import { RoomPhysics } from './PhysicsWorld';
import { initialRecord, processFrame, type SimReservation, type TwinRecord } from './SimulatedTwinPipeline';

const MINUTE = 60_000;
const TICK_REAL_MS = 100;
const FRAME_EVERY_REAL_MS = 1_000;
const MAX_TRACES = 40;
const SIM_PREFIX = 'SIM-';
/** Simulated minutes without spontaneous library events after a scenario, so the audience sees its effect. */
const QUIET_AFTER_SCENARIO_MINUTES = 20;
const FRAME_TRIGGER = 'MQTT · YoloMqttTelemetryInboundAdapter (simulado)';
const SCENARIO_TRIGGER = 'REST · SimulationController (simulado)';
const CONTROL_TRIGGER = 'REST · TwinControlUseCase (simulado)';
const CHECK_IN_TRIGGER = 'App estudiantil · check-in QR (simulado)';

interface Room {
  physics: RoomPhysics;
  record: TwinRecord;
}

/** 10:00 in Bogotá (UTC−5) of the current day: inside the campus schedule, so savings are meaningful. */
function campusMorning(): number {
  const bogota = new Date(Date.now() - 5 * 3_600_000);
  return Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth(), bogota.getUTCDate(), 15, 0, 0);
}

/**
 * Fallback adapter that runs the whole campus inside the browser: a physics engine (people, air,
 * temperature) feeds synthetic YOLO frames into a TypeScript twin of ProcessSpaceTelemetryService.
 * Animation runs on real time (smooth 60 FPS camera), while physics and frames run on simulated time,
 * which can be accelerated so a 15-minute abandonment timer fits in a live demo.
 */
export class InMemoryPhysicsGateway implements TwinGateway {
  readonly mode = 'simulation' as const;
  readonly capabilities: GatewayCapabilities = { checkIn: true, cameraControl: true, timeScale: true };

  private readonly rooms = new Map<string, Room>();
  private reservations: SimReservation[] = [];
  private traces: ArchitectureTrace[] = [];
  private highlighted: ArchitectureTrace | null = null;
  private listeners = new Set<() => void>();
  private snapshot: TwinSnapshot;
  private simNow: number;
  private scale = 60;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTickReal = 0;
  private sinceLastFrameReal = 0;
  private autonomyClock = 0;

  constructor(startAt: number = campusMorning()) {
    this.simNow = startAt;
    this.resetWorld();
    this.snapshot = this.buildSnapshot();
  }

  async start(): Promise<void> {
    if (this.timer) return;
    this.lastTickReal = performance.now();
    this.timer = setInterval(() => this.tick(), TICK_REAL_MS);
    this.processAll(FRAME_TRIGGER);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): TwinSnapshot {
    return this.snapshot;
  }

  scenarios(): ScenarioInfo[] {
    return SCENARIO_CATALOG;
  }

  setTimeScale(scale: number): void {
    this.scale = Math.min(300, Math.max(1, scale));
    this.publish();
  }

  timeScale(): number {
    return this.scale;
  }

  setCameraOnline(spaceId: string, online: boolean): void {
    this.room(spaceId).physics.cameraOnline = online;
    this.processSpace(spaceId, CONTROL_TRIGGER, true);
  }

  async checkIn(spaceId: string, zoneId: string): Promise<void> {
    const physics = this.room(spaceId).physics;
    physics.setDeskPerson(zoneId, true, true);
    physics.setDeskBelongings(zoneId, ['LAPTOP']);
    this.processSpace(spaceId, CHECK_IN_TRIGGER, true);
  }

  sampleCamera(spaceId: string, realTimeMs: number): CameraFrame | null {
    const room = this.rooms.get(spaceId);
    if (!room) return null;
    return {
      spaceId,
      capturedAt: this.simNow,
      cameraOnline: room.physics.cameraOnline,
      detections: room.physics.detections(false, realTimeMs),
      origin: 'simulacion-edge',
    };
  }

  async runScenario(scenario: SimulationScenario): Promise<ArchitectureTrace | null> {
    const now = this.simNow;
    this.autonomyClock = -QUIET_AFTER_SCENARIO_MINUTES;
    const at =(minutes: number) => now + minutes * MINUTE;
    switch (scenario) {
      case 'CLASE_EN_CURSO':
        this.reserve('AULA-301', at(-10), at(80), 28, scenario);
        this.setRoom('AULA-301', { people: 26, indoorC: 22.5, co2: 780, humidity: 55, camera: true });
        break;
      case 'CO2_ALTO':
        this.setRoom('AULA-301', { people: 30, indoorC: 22.8, co2: 1450, humidity: 62, camera: true });
        break;
      case 'FALLO_CAMARA':
        this.setRoom('AULA-301', { people: 18, indoorC: 22.4, co2: 820, humidity: 57, camera: false });
        break;
      case 'NO_SHOW':
        this.clearSimulationReservations('AULA-MAGNA-204');
        this.reserve('AULA-MAGNA-204', at(-20), at(100), 40, scenario);
        this.setRoom('AULA-MAGNA-204', { people: 0, indoorC: 26.8, co2: 440, humidity: 70, camera: true, outdoorC: 31.8 });
        break;
      case 'PRE_ENFRIAMIENTO':
        this.clearSimulationReservations('AULA-MAGNA-204');
        this.reserve('AULA-MAGNA-204', at(20), at(110), 42, scenario);
        this.setRoom('AULA-MAGNA-204', { people: 0, indoorC: 28.5, co2: 430, humidity: 74, camera: true, outdoorC: 32 });
        break;
      case 'OVERRIDE_DOCENTE':
        this.updateControls('AULA-MAGNA-204', { overrideUntil: new Date(at(45)).toISOString() });
        return this.processSpace('AULA-MAGNA-204', CONTROL_TRIGGER, true, false);
      case 'SOBRECUPO':
        this.setRoom('LAB-IA-102', { people: 31, indoorC: 23.5, co2: 900, humidity: 58, camera: true });
        break;
      case 'MANTENIMIENTO':
        this.updateControls('LAB-IA-102', { maintenance: true });
        return this.processSpace('LAB-IA-102', CONTROL_TRIGGER, true, false);
      case 'SUBUTILIZADO':
        this.reserve('AULA-ADM-101', at(-10), at(80), 30, scenario);
        this.setRoom('AULA-ADM-101', { people: 6, indoorC: 22, co2: 520, humidity: 60, camera: true });
        break;
      case 'POPUP_PARCIALES':
        this.clearSimulationReservations('AULA-ADM-101');
        this.updateControls('AULA-ADM-101', { popUpUntil: new Date(at(120)).toISOString() });
        this.setRoom('AULA-ADM-101', { people: 9, indoorC: 22.4, co2: 560, humidity: 58, camera: true });
        break;
      case 'ACAPARAMIENTO_BIBLIOTECA':
        this.libraryHoarding(now);
        break;
      case 'REINICIAR':
        this.reservations = this.reservations.filter((r) => !r.reference.startsWith(SIM_PREFIX));
        this.resetWorld();
        this.processAll(SCENARIO_TRIGGER);
        return this.traces[0] ?? null;
    }
    const target = SCENARIO_CATALOG.find((s) => s.scenario === scenario)!.spaceId;
    return this.processSpace(target, SCENARIO_TRIGGER, true);
  }

  // ---- world -------------------------------------------------------------------------------

  private resetWorld(): void {
    this.rooms.clear();
    for (const space of SEED_SPACES) {
      const outdoor = AVERAGE_OUTSIDE_C[space.branchId] ?? 20;
      const physics = new RoomPhysics(space, outdoor, ROIS_BY_SPACE[space.spaceId] ?? []);
      this.rooms.set(space.spaceId, { physics, record: initialRecord(space, outdoor, this.simNow) });
    }
    const baseline: Record<string, number> = { 'AULA-301': 12, 'AULA-MAGNA-204': 0, 'AULA-ADM-101': 0, 'BIB-PISO-2': 34, 'LAB-IA-102': 8 };
    for (const [spaceId, people] of Object.entries(baseline)) {
      const physics = this.room(spaceId).physics;
      physics.setFreePeople(people, true);
      physics.co2Ppm = 420 + (people * 1000) / physics.space.areaSqm;
    }
    const library = this.room('BIB-PISO-2').physics;
    library.setDeskPerson('BIB2-M03', true, true);
    library.setDeskBelongings('BIB2-M03', ['LAPTOP']);
    library.setDeskPerson('BIB2-M06', true, true);
    library.setDeskBelongings('BIB2-M06', ['BOOK', 'LAPTOP']);
    library.setDeskBelongings('BIB2-M07', ['BACKPACK']);
  }

  private room(spaceId: string): Room {
    const room = this.rooms.get(spaceId);
    if (!room) throw new Error(`Espacio desconocido: ${spaceId}`);
    return room;
  }

  private setRoom(spaceId: string, values: { people: number; indoorC: number; co2: number; humidity: number; camera: boolean; outdoorC?: number }): void {
    const physics = this.room(spaceId).physics;
    physics.setFreePeople(values.people);
    physics.indoorC = values.indoorC;
    physics.co2Ppm = values.co2;
    physics.humidityPct = values.humidity;
    physics.cameraOnline = values.camera;
    if (values.outdoorC !== undefined) physics.outdoorC = values.outdoorC;
  }

  private updateControls(spaceId: string, controls: Partial<Pick<TwinRecord['state'], 'overrideUntil' | 'popUpUntil' | 'maintenance'>>): void {
    const room = this.room(spaceId);
    room.record = { ...room.record, state: { ...room.record.state, ...controls } };
  }

  private libraryHoarding(now: number): void {
    const room = this.room('BIB-PISO-2');
    const physics = room.physics;
    physics.clearDesks();
    physics.setFreePeople(34);
    physics.setDeskBelongings('BIB2-M01', ['LAPTOP', 'BACKPACK']);
    physics.setDeskBelongings('BIB2-M02', ['BOOK']);
    for (const desk of ['BIB2-M03', 'BIB2-M04', 'BIB2-M05']) {
      physics.setDeskPerson(desk, true, true);
      physics.setDeskBelongings(desk, ['LAPTOP']);
    }
    const held = (zoneId: string, minutesAgo: number, belongings: number): DeskObservation => ({
      zoneId, state: 'ALERTA_ACAPARAMIENTO', peopleInside: 0, belongingsInside: belongings,
      unattendedSince: new Date(now - minutesAgo * MINUTE).toISOString(), unattendedMinutes: minutesAgo,
      evaluatedAt: new Date(now).toISOString(),
    });
    room.record = { ...room.record, state: { ...room.record.state, desks: [held('BIB2-M01', 16, 2), held('BIB2-M02', 6, 1)] } };
  }

  private reserve(spaceId: string, startsAt: number, endsAt: number, expectedAttendees: number, scenario: SimulationScenario): void {
    this.reservations = this.reservations.filter((r) => !(r.spaceId === spaceId && r.reference.startsWith(SIM_PREFIX)
      && r.startsAt < endsAt && r.endsAt > startsAt));
    this.reservations.push({ reservationId: crypto.randomUUID(), spaceId, startsAt, endsAt, expectedAttendees, reference: SIM_PREFIX + scenario });
  }

  private clearSimulationReservations(spaceId: string): void {
    this.reservations = this.reservations.filter((r) => !(r.spaceId === spaceId && r.reference.startsWith(SIM_PREFIX)));
  }

  // ---- loop --------------------------------------------------------------------------------

  private tick(): void {
    const realNow = performance.now();
    const realElapsed = Math.min(500, realNow - this.lastTickReal);
    this.lastTickReal = realNow;
    const simMinutes = (realElapsed * this.scale) / MINUTE;
    this.simNow += realElapsed * this.scale;

    for (const room of this.rooms.values()) {
      room.physics.animate(realElapsed / 1000);
      const thermal = room.record.state.thermal;
      room.physics.integrate(simMinutes, room.record.state.hvacState, thermal?.setpointC ?? 22);
    }
    this.studentLife(simMinutes);

    this.sinceLastFrameReal += realElapsed;
    if (this.sinceLastFrameReal >= FRAME_EVERY_REAL_MS) {
      this.sinceLastFrameReal = 0;
      this.processAll(FRAME_TRIGGER);
    }
  }

  /** Occasional library events so the anti-hoarding monitor stays alive between scenarios. */
  private studentLife(simMinutes: number): void {
    this.autonomyClock += simMinutes;
    if (this.autonomyClock < 7) return;
    this.autonomyClock = 0;
    const physics = this.room('BIB-PISO-2').physics;
    const seated = physics.agents.filter((a) => a.deskId !== null && a.objectClass === 'PERSON' && !a.leaving);
    const freeDesks = physics.rois.filter((roi) => !physics.agents.some((a) => a.deskId === roi.zoneId));
    if (seated.length > 2 && Math.random() < 0.5) {
      physics.setDeskPerson(seated[Math.floor(Math.random() * seated.length)]!.deskId!, false);
    } else if (freeDesks.length > 0) {
      const desk = freeDesks[Math.floor(Math.random() * freeDesks.length)]!.zoneId;
      physics.setDeskPerson(desk, true);
      physics.setDeskBelongings(desk, ['LAPTOP']);
    }
  }

  private snapshotOf(room: Room): TelemetrySnapshot {
    const { physics, record } = room;
    return {
      spaceId: physics.space.spaceId,
      capturedAt: this.simNow,
      cameraOnline: physics.cameraOnline,
      detections: physics.detections(true, performance.now()),
      co2Ppm: Math.round(physics.co2Ppm),
      indoorTemperatureC: Math.round(physics.indoorC * 100) / 100,
      outdoorTemperatureC: physics.outdoorC,
      humidityPct: Math.round(physics.humidityPct),
      illuminanceLux: physics.illuminanceLux,
      wifiDevices: physics.wifiDevices(),
      activePowerKw: physics.activePowerKw(HVAC_POWER_FRACTION[record.state.hvacState], ratedKw(physics.space.areaSqm)),
    };
  }

  private processAll(trigger: string): void {
    for (const spaceId of this.rooms.keys()) this.processSpace(spaceId, trigger, false, true, false);
    this.publish();
  }

  private processSpace(spaceId: string, trigger: string, highlight: boolean, withFrame = true, publish = true): ArchitectureTrace {
    const room = this.room(spaceId);
    const result = processFrame({
      space: room.physics.space,
      previous: room.record,
      snapshot: withFrame ? this.snapshotOf(room) : null,
      rois: room.physics.rois,
      reservations: this.reservations,
      now: this.simNow,
      trigger,
    });
    room.record = result.record;
    this.traces = [result.trace, ...this.traces].slice(0, MAX_TRACES);
    if (highlight) this.highlighted = result.trace;
    if (publish) this.publish();
    return result.trace;
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }

  private buildSnapshot(): TwinSnapshot {
    const twins: TwinSpace[] = SEED_SPACES.map((space) => {
      const room = this.room(space.spaceId);
      const active = this.reservations.find((r) => r.spaceId === space.spaceId && r.startsAt <= this.simNow && this.simNow < r.endsAt);
      return {
        space,
        state: room.record.state,
        activeReservation: active
          ? { reservationId: active.reservationId, startsAt: new Date(active.startsAt).toISOString(), endsAt: new Date(active.endsAt).toISOString(), expectedAttendees: active.expectedAttendees, reference: active.reference }
          : null,
        rois: room.physics.rois.slice(),
      };
    });
    const frames: Record<string, CameraFrame> = {};
    for (const [spaceId, room] of this.rooms) {
      frames[spaceId] = { spaceId, capturedAt: this.simNow, cameraOnline: room.physics.cameraOnline, detections: room.physics.detections(false, 0), origin: 'simulacion-edge' };
    }
    return {
      twins,
      savings: savingsFromTwins(twins, this.simNow),
      traces: this.traces,
      frames,
      now: this.simNow,
      connection: 'live',
      highlightedTrace: this.highlighted,
    };
  }
}
