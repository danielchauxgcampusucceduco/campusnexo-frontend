import { savingsFromTwins, ratedKw } from '../../domain/kpis';
import {
  HVAC_POWER_FRACTION,
  type ArchitectureTrace,
  type DeskObservation,
  type EnvironmentReading,
  type ScenarioInfo,
  type SimulationScenario,
  type TelemetrySnapshot,
  type TwinSpace,
} from '../../domain/model';
import { SCENARIO_CATALOG } from '../../domain/scenarios';
import type { CameraFrame, GatewayCapabilities, TwinGateway, TwinSnapshot } from '../../ports/TwinGateway';
import { CAMPUS, LIBRARY_ID, regionsOf, SEED_SPACES } from './campusSeed';
import { RoomPhysics } from './PhysicsWorld';
import { initialRecord, processFrame, type EquipmentCommand, type SimReservation, type TwinRecord } from './SimulatedTwinPipeline';

const MINUTE = 60_000;
const TICK_REAL_MS = 100;
const FRAME_EVERY_REAL_MS = 1_000;
/** The Arduino publishes every few camera frames. */
const ENVIRONMENT_EVERY_FRAMES = 3;
const MAX_TRACES = 40;
const SIM_PREFIX = 'SIM-';
/** Simulated minutes without spontaneous library events after a scenario, so the audience sees its effect. */
const QUIET_AFTER_SCENARIO_MINUTES = 20;
const FRAME_TRIGGER = 'MQTT · YoloMqttTelemetryInboundAdapter (simulado)';
const SCENARIO_TRIGGER = 'REST · SimulationController (simulado)';
const CONTROL_TRIGGER = 'REST · TwinControlUseCase (simulado)';
const CHECK_IN_TRIGGER = 'App estudiantil · check-in QR (simulado)';
const ARDUINO_TRIGGER = 'MQTT · ArduinoMqttEnvironmentInboundAdapter (simulado)';
const SCENARIO_ARDUINO_TRIGGER = 'REST · SimulationController (lectura Arduino, simulado)';

interface Room {
  physics: RoomPhysics;
  record: TwinRecord;
  /** People left without switching off: the Arduino keeps reporting lights or computers on. */
  forgotEquipment: boolean;
}

/** Rooms left with equipment on at 10:00, so the automatic shutdown shows within minutes. */
const MORNING_FORGOTTEN: Record<string, { lights: boolean; devices: boolean }> = {
  '424-A': { lights: true, devices: false },
  '310-A': { lights: false, devices: true },
};

/** Deterministic pseudo-random value in [0, 1) for a room, so every reset looks the same. */
function seeded(text: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return ((hash >>> 0) % 10_000) / 10_000;
}

/** People at 10:00 (illustrative): about two of every three classrooms in class, offices staffed. */
function morningPeople(space: { spaceId: string; type: string; capacity: number }): number {
  const roll = seeded(space.spaceId, 1);
  switch (space.type) {
    case 'ADMINISTRATIVA':
      return Math.max(1, Math.round(space.capacity * (0.4 + roll * 0.6)));
    case 'LOGISTICA':
      return roll < 0.5 ? 1 : 0;
    case 'BIBLIOTECA':
    case 'CAFETERIA':
      return Math.round(space.capacity * (0.25 + roll * 0.3));
    case 'AUDITORIO':
      return roll < 0.4 ? Math.round(space.capacity * 0.5) : 0;
    default:
      return roll < 0.62 ? Math.round(space.capacity * (0.45 + seeded(space.spaceId, 2) * 0.45)) : 0;
  }
}

/** 10:00 in Bogotá (UTC−5) of the current day: inside the campus schedule, so savings are meaningful. */
function campusMorning(): number {
  const bogota = new Date(Date.now() - 5 * 3_600_000);
  return Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth(), bogota.getUTCDate(), 15, 0, 0);
}

/**
 * Fallback adapter that runs the whole campus inside the browser: a physics engine (people, air,
 * temperature) feeds synthetic YOLO frames into a TypeScript twin of the backend pipeline (camera, Arduino and re-evaluation use cases).
 * Animation runs on real time (smooth 60 FPS camera), while physics and frames run on simulated time,
 * which can be accelerated so a 15-minute abandonment timer fits in a live demo.
 */
export class InMemoryPhysicsGateway implements TwinGateway {
  readonly mode = 'simulation' as const;
  readonly capabilities: GatewayCapabilities = { checkIn: true, cameraControl: true, timeScale: true, lightControl: true, scenarios: true, operations: true };
  readonly user = null;

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
  private framesSinceEnvironment = 0;
  private autonomyClock = 0;
  private campusClock = 0;

  constructor(startAt: number = campusMorning()) {
    if (!Number.isFinite(startAt) || !Number.isFinite(new Date(startAt).getTime())) {
      throw new RangeError('La hora inicial de simulación debe ser una marca de tiempo válida');
    }
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
    if (!Number.isFinite(scale)) throw new RangeError('La escala de tiempo debe ser finita');
    this.scale = Math.min(300, Math.max(1, scale));
    this.publish();
  }

  timeScale(): number {
    return this.scale;
  }

  /** Switches the lights of a room by hand (simulates someone at the wall switch). */
  setLights(spaceId: string, on: boolean): void {
    const room = this.room(spaceId);
    room.physics.setLights(on);
    room.forgotEquipment = on && room.physics.people().length === 0;
    this.processEnvironment(spaceId, ARDUINO_TRIGGER, true);
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
    const definition = SCENARIO_CATALOG.find((item) => item.scenario === scenario);
    if (!definition) throw new RangeError(`Escenario desconocido: ${String(scenario)}`);
    const now = this.simNow;
    this.autonomyClock = -QUIET_AFTER_SCENARIO_MINUTES;
    this.campusClock = -QUIET_AFTER_SCENARIO_MINUTES;
    const at = (minutes: number) => now + minutes * MINUTE;
    const target = definition.spaceId;
    switch (scenario) {
      case 'CLASE_EN_CURSO':
        this.reserve(target, at(-10), at(80), 28, scenario);
        this.setRoom(target, { people: 26, indoorC: 22.4, co2: 780, humidity: 55, camera: true, lights: true });
        break;
      case 'CO2_ALTO':
        this.setRoom(target, { people: 30, indoorC: 21.2, co2: 1450, humidity: 62, camera: true, lights: true });
        break;
      case 'FALLO_CAMARA':
        this.setRoom(target, { people: 18, indoorC: 20.3, co2: 820, humidity: 57, camera: false, lights: true });
        break;
      case 'SOBRECUPO':
        this.setRoom(target, { people: this.room(target).physics.space.capacity + 7, indoorC: 21.8, co2: 980, humidity: 58, camera: true, lights: true, devices: this.room(target).physics.space.computers });
        break;
      case 'NO_SHOW':
        this.clearSimulationReservations(target);
        this.reserve(target, at(-20), at(100), 30, scenario);
        this.setRoom(target, { people: 0, indoorC: 18.6, co2: 440, humidity: 54, camera: true, lights: false, devices: 0 });
        break;
      case 'SUBUTILIZADO':
        this.reserve(target, at(-10), at(80), 30, scenario);
        this.setRoom(target, { people: 6, indoorC: 19.4, co2: 520, humidity: 60, camera: true, lights: true });
        break;
      case 'POPUP_PARCIALES':
        this.clearSimulationReservations(target);
        this.updateControls(target, { popUpUntil: new Date(at(120)).toISOString() });
        this.setRoom(target, { people: 9, indoorC: 19.8, co2: 560, humidity: 58, camera: true, lights: true });
        break;
      case 'LUCES_ENCENDIDAS':
        return this.idleRoom(target, 8, true, 0);
      case 'EQUIPOS_ENCENDIDOS':
        return this.idleRoom(target, 12, true, this.room(target).physics.space.computers);
      case 'OVERRIDE_DOCENTE':
        this.updateControls(target, { overrideUntil: new Date(at(45)).toISOString() });
        return this.processSpace(target, CONTROL_TRIGGER, true, false);
      case 'MANTENIMIENTO':
        this.updateControls(target, { maintenance: true });
        return this.processSpace(target, CONTROL_TRIGGER, true, false);
      case 'ACAPARAMIENTO_BIBLIOTECA':
        this.libraryHoarding(now);
        break;
      case 'REINICIAR':
        this.reservations = this.reservations.filter((r) => !r.reference.startsWith(SIM_PREFIX));
        this.resetWorld();
        this.processAll(SCENARIO_TRIGGER);
        return this.traces[0] ?? null;
    }
    // People appear seated at once, as in the backend scenario frames; camera first, then the Arduino.
    this.room(target).physics.animate(60);
    this.processSpace(target, SCENARIO_TRIGGER, true, true, false);
    return this.processEnvironment(target, SCENARIO_ARDUINO_TRIGGER, true);
  }

  /** The room has been empty for {@code idleMinutes} with equipment on; the Arduino reading triggers the shutdown. */
  private idleRoom(spaceId: string, idleMinutes: number, lights: boolean, devices: number): ArchitectureTrace {
    this.setRoom(spaceId, { people: 0, indoorC: 18.9, co2: 430, humidity: 52, camera: true, lights, devices }, true);
    const room = this.room(spaceId);
    room.forgotEquipment = true;
    this.processSpace(spaceId, SCENARIO_TRIGGER, false, true, false);
    room.record = { ...room.record, state: { ...room.record.state, emptySince: new Date(this.simNow - idleMinutes * MINUTE).toISOString(), equipmentShutdownAt: null } };
    return this.processEnvironment(spaceId, SCENARIO_ARDUINO_TRIGGER, true);
  }

  // ---- world -------------------------------------------------------------------------------

  private resetWorld(): void {
    this.rooms.clear();
    for (const space of SEED_SPACES) {
      const physics = new RoomPhysics(space, CAMPUS.averageOutsideC, regionsOf(space));
      this.rooms.set(space.spaceId, { physics, record: initialRecord(space, CAMPUS.averageOutsideC, this.simNow), forgotEquipment: false });
    }
    const scenarioRooms = new Set(SCENARIO_CATALOG.map((s) => s.spaceId));
    for (const space of SEED_SPACES) {
      // Scenario rooms start empty so each scenario shows its own effect.
      const people = scenarioRooms.has(space.spaceId) && space.spaceId !== LIBRARY_ID ? 0 : morningPeople(space);
      if (people === 0 && space.spaceId !== LIBRARY_ID) continue;
      const physics = this.room(space.spaceId).physics;
      physics.setFreePeople(people, true);
      physics.co2Ppm = 420 + (people * 1000) / physics.space.areaSqm;
      physics.indoorC = 19.5 + Math.min(2.5, people / 15);
      physics.setLights(true);
      physics.setDevices(this.devicesInUse(physics, people));
    }
    for (const [spaceId, forgotten] of Object.entries(MORNING_FORGOTTEN)) {
      const room = this.room(spaceId);
      room.physics.setLights(forgotten.lights);
      room.physics.setDevices(forgotten.devices ? room.physics.space.computers : 0);
      room.forgotEquipment = true;
    }
    const library = this.room(LIBRARY_ID).physics;
    library.setDeskPerson('BIB2B-M03', true, true);
    library.setDeskBelongings('BIB2B-M03', ['LAPTOP']);
    library.setDeskPerson('BIB2B-M06', true, true);
    library.setDeskBelongings('BIB2B-M06', ['BOOK', 'LAPTOP']);
    library.setDeskBelongings('BIB2B-M07', ['BACKPACK']);
  }

  /** Computers people switch on: one each in computer rooms and labs, all of them in offices. */
  private devicesInUse(physics: RoomPhysics, people: number): number {
    const { type, computers } = physics.space;
    if (people === 0) return 0;
    if (type === 'ADMINISTRATIVA' || type === 'LOGISTICA') return computers;
    if (type === 'SALA_COMPUTO' || type === 'LABORATORIO') return Math.min(computers, people);
    return Math.min(computers, 1);
  }

  private room(spaceId: string): Room {
    const room = this.rooms.get(spaceId);
    if (!room) throw new Error(`Espacio desconocido: ${spaceId}`);
    return room;
  }

  private setRoom(spaceId: string, values: { people: number; indoorC: number; co2: number; humidity: number; camera: boolean; outdoorC?: number; lights?: boolean; devices?: number }, instant = false): void {
    const room = this.room(spaceId);
    const physics = room.physics;
    physics.setFreePeople(values.people, instant);
    if (values.lights !== undefined) physics.setLights(values.lights);
    physics.setDevices(values.devices ?? this.devicesInUse(physics, values.people));
    room.forgotEquipment = false;
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
    const room = this.room(LIBRARY_ID);
    const physics = room.physics;
    physics.clearDesks();
    physics.setFreePeople(30);
    physics.setLights(true);
    physics.setDevices(6);
    physics.setDeskBelongings('BIB2B-M01', ['LAPTOP', 'BACKPACK']);
    physics.setDeskBelongings('BIB2B-M02', ['BOOK']);
    for (const desk of ['BIB2B-M03', 'BIB2B-M04', 'BIB2B-M05']) {
      physics.setDeskPerson(desk, true, true);
      physics.setDeskBelongings(desk, ['LAPTOP']);
    }
    const held = (zoneId: string, minutesAgo: number, belongings: number): DeskObservation => ({
      zoneId, state: 'ALERTA_ACAPARAMIENTO', peopleInside: 0, belongingsInside: belongings,
      unattendedSince: new Date(now - minutesAgo * MINUTE).toISOString(), unattendedMinutes: minutesAgo,
      evaluatedAt: new Date(now).toISOString(),
    });
    room.record = { ...room.record, state: { ...room.record.state, desks: [held('BIB2B-M01', 16, 2), held('BIB2B-M02', 6, 1)] } };
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
    this.campusLife(simMinutes);
    for (const room of this.rooms.values()) this.habits(room);

    this.sinceLastFrameReal += realElapsed;
    if (this.sinceLastFrameReal >= FRAME_EVERY_REAL_MS) {
      this.sinceLastFrameReal = 0;
      this.framesSinceEnvironment++;
      if (this.framesSinceEnvironment >= ENVIRONMENT_EVERY_FRAMES) {
        this.framesSinceEnvironment = 0;
        for (const spaceId of this.rooms.keys()) this.processEnvironment(spaceId, ARDUINO_TRIGGER, false, false);
      }
      this.processAll(FRAME_TRIGGER);
    }
  }

  /** Whoever walks in switches the lights on; the last one out switches everything off, unless they forget. */
  private habits(room: Room): void {
    const { physics } = room;
    const people = physics.people().length;
    if (people > 0) {
      room.forgotEquipment = false;
      if (!physics.lightsOn) physics.setLights(true);
      const wanted = this.devicesInUse(physics, people);
      if (physics.devicesOn < wanted) physics.setDevices(wanted);
    } else if (!room.forgotEquipment && (physics.lightsOn || physics.devicesOn > 0) && physics.agents.every((a) => a.objectClass !== 'PERSON')) {
      physics.setLights(false);
      physics.setDevices(0);
    }
  }

  /** Every few simulated minutes a class ends or starts somewhere; sometimes the room is left with the lights on. */
  private campusLife(simMinutes: number): void {
    this.campusClock += simMinutes;
    if (this.campusClock < 6) return;
    this.campusClock = 0;
    const scenarioRooms = new Set(SCENARIO_CATALOG.map((s) => s.spaceId));
    const candidates = [...this.rooms.values()].filter((r) => r.physics.space.seatRows !== null && r.physics.space.spaceId !== LIBRARY_ID
      && !scenarioRooms.has(r.physics.space.spaceId) && !r.record.state.maintenance);
    const room = candidates[Math.floor(Math.random() * candidates.length)];
    if (!room) return;
    const physics = room.physics;
    if (physics.people().length > 0) {
      physics.setFreePeople(0);
      room.forgotEquipment = Math.random() < 0.35;
    } else {
      physics.setFreePeople(Math.round(physics.space.capacity * (0.45 + Math.random() * 0.45)));
    }
  }

  /** Occasional library events so the anti-hoarding monitor stays alive between scenarios. */
  private studentLife(simMinutes: number): void {
    this.autonomyClock += simMinutes;
    if (this.autonomyClock < 7) return;
    this.autonomyClock = 0;
    const physics = this.room(LIBRARY_ID).physics;
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

  private environmentOf(room: Room): EnvironmentReading {
    const { physics } = room;
    return {
      spaceId: physics.space.spaceId,
      capturedAt: this.simNow,
      temperatureC: Math.round((physics.indoorC + (Math.random() - 0.5) * 0.1) * 10) / 10,
      humidityPct: Math.round(physics.humidityPct * 10) / 10,
      co2Ppm: null,
      illuminanceLux: physics.lux(),
      lightsOn: physics.lightsOn,
      devicesOn: physics.devicesOn,
    };
  }

  /** The room Arduino executes a shutdown order: lights off at once, computers after the warning. */
  private applyEquipmentCommand(command: EquipmentCommand | null): void {
    if (!command) return;
    const room = this.room(command.spaceId);
    if (command.lightsOff) room.physics.setLights(false);
    if (command.suspendDevices) room.physics.setDevices(0);
    room.forgotEquipment = false;
  }

  private processEnvironment(spaceId: string, trigger: string, highlight: boolean, publish = true): ArchitectureTrace {
    const room = this.room(spaceId);
    const result = processFrame({
      space: room.physics.space,
      previous: room.record,
      snapshot: null,
      environment: this.environmentOf(room),
      rois: room.physics.rois,
      reservations: this.reservations,
      now: this.simNow,
      trigger,
    });
    room.record = result.record;
    this.applyEquipmentCommand(result.equipmentCommand);
    this.traces = [result.trace, ...this.traces].slice(0, MAX_TRACES);
    if (highlight) this.highlighted = result.trace;
    if (publish) this.publish();
    return result.trace;
  }

  /** Camera frame; scenario frames skip the random missed detections so their outcome is repeatable. */
  private snapshotOf(room: Room, noise = true): TelemetrySnapshot {
    const { physics, record } = room;
    return {
      spaceId: physics.space.spaceId,
      capturedAt: this.simNow,
      cameraOnline: physics.cameraOnline,
      detections: physics.detections(noise, performance.now()),
      co2Ppm: Math.round(physics.co2Ppm),
      indoorTemperatureC: Math.round(physics.indoorC * 100) / 100,
      outdoorTemperatureC: physics.outdoorC,
      humidityPct: Math.round(physics.humidityPct),
      illuminanceLux: physics.lux(),
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
      snapshot: withFrame ? this.snapshotOf(room, !highlight && trigger === FRAME_TRIGGER) : null,
      rois: room.physics.rois,
      reservations: this.reservations,
      now: this.simNow,
      trigger,
    });
    room.record = result.record;
    this.applyEquipmentCommand(result.equipmentCommand);
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
