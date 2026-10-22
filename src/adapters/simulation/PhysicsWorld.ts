import { boxAround, polygonCentroid } from '../../domain/geometry';
import { COMPRESSOR_ON, HVAC_POWER_FRACTION, type CampusSpace, type DetectedObjectClass, type HvacControlState, type NormalizedPoint, type StudyZoneRoi, type TrackedDetection } from '../../domain/model';
import { THERMAL_PARAMETERS } from '../../domain/thermal';
import { LIBRARY_ID } from './campusSeed';

/** Something the ceiling camera can see. Positions are normalized image coordinates. */
export interface Agent {
  trackId: number;
  objectClass: DetectedObjectClass;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  /** Desk the agent belongs to (persons sitting there or belongings left on it). */
  deskId: string | null;
  leaving: boolean;
  /** Phase for the small idle sway of seated people. */
  phase: number;
}

const DOOR: NormalizedPoint = [0.03, 0.5];
const WALK_SPEED_PER_SECOND = 0.22;
const BOX: Record<DetectedObjectClass, [number, number]> = {
  PERSON: [0.045, 0.075],
  LAPTOP: [0.05, 0.035],
  BACKPACK: [0.035, 0.045],
  BOOK: [0.03, 0.025],
};
const YOLO_MISS_PROBABILITY = 0.02;
const MAX_SIMULATED_PEOPLE = 1_000;

/**
 * Physical state of one room: people and objects (for the camera), the air (temperature, CO2,
 * humidity) and what the room's Arduino reads (light level, lighting relay, computers drawing power).
 * Temperature follows the same RC model as the MPC, and CO2 relaxes towards the steady state
 * Cₑₓₜ + n·1000/A used by the Kalman mass-balance measurement. In rooms with a seat grid, people walk
 * to a free seat; anyone beyond the seats stands at the front.
 */
export class RoomPhysics {
  agents: Agent[] = [];
  indoorC: number;
  outdoorC: number;
  co2Ppm = 430;
  humidityPct: number;
  illuminanceLux: number;
  cameraOnline = true;
  lightsOn = false;
  devicesOn = 0;
  private nextTrackId = 1;

  constructor(readonly space: CampusSpace, outdoorC: number, readonly rois: readonly StudyZoneRoi[]) {
    this.outdoorC = outdoorC;
    this.indoorC = space.climateProfile === 'SEDE_TROPICAL' ? 27 : space.climateProfile === 'SEDE_ANDINA' ? 20.5 : 22.5;
    this.humidityPct = space.climateProfile === 'SEDE_TROPICAL' ? 70 : 55;
    this.illuminanceLux = 90;
  }

  /** Seats people take one by one (the library tables belong to the anti-hoarding monitor instead). */
  private get seatsForPeople(): boolean {
    return this.rois.length > 0 && this.space.spaceId !== LIBRARY_ID;
  }

  setLights(on: boolean): void {
    if (typeof on !== 'boolean') throw new RangeError('light state must be boolean');
    this.lightsOn = on;
  }

  setDevices(count: number): void {
    if (!Number.isSafeInteger(count)) throw new RangeError('device count must be a safe integer');
    this.devicesOn = Math.max(0, Math.min(this.space.computers, Math.round(count)));
  }

  /** Light sensor reading: the lamps when they are on, otherwise the daylight through the windows. */
  lux(): number {
    return this.lightsOn ? 410 : 85;
  }

  people(): Agent[] {
    return this.agents.filter((a) => a.objectClass === 'PERSON' && !a.leaving);
  }

  /** A free seat region, then the front band; the aisle band of the library; or a grid for offices. */
  private freeSeat(): NormalizedPoint {
    const taken = this.agents.filter((a) => a.objectClass === 'PERSON' && !a.leaving).map((a) => [a.targetX, a.targetY] as const);
    if (this.seatsForPeople) {
      const free = this.rois.filter((roi) => {
        const [cx, cy] = polygonCentroid(roi.polygon);
        return !taken.some(([tx, ty]) => Math.abs(tx - cx) < 0.004 && Math.abs(ty - cy) < 0.004);
      });
      if (free.length > 0) return polygonCentroid(free[Math.floor(Math.random() * free.length)]!.polygon);
      for (let index = 0; index < 36; index++) {
        const x = 0.06 + (index % 12) * 0.078;
        const y = 0.08 + Math.floor(index / 12) * 0.07;
        if (!taken.some(([tx, ty]) => Math.abs(tx - x) < 0.01 && Math.abs(ty - y) < 0.01)) return [x, y];
      }
      return [0.1 + Math.random() * 0.8, 0.08 + Math.random() * 0.14];
    }
    const isLibrary = this.rois.length > 0;
    const columns = isLibrary ? 12 : Math.ceil(Math.sqrt(this.space.capacity * 1.7));
    const rows = isLibrary ? 3 : Math.ceil((this.space.capacity * 1.6) / columns);
    for (let index = 0; index < columns * rows; index++) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = isLibrary ? 0.04 + column * 0.078 : 0.14 + (column / Math.max(1, columns - 1)) * 0.78;
      const y = isLibrary ? 0.13 + row * 0.07 : 0.2 + (row / Math.max(1, rows - 1)) * 0.68;
      if (!taken.some(([tx, ty]) => Math.abs(tx - x) < 0.01 && Math.abs(ty - y) < 0.01)) {
        return [x, y];
      }
    }
    return [0.1 + Math.random() * 0.8, isLibrary ? 0.13 + Math.random() * 0.14 : 0.2 + Math.random() * 0.7];
  }

  private spawn(objectClass: DetectedObjectClass, target: NormalizedPoint, deskId: string | null, fromDoor: boolean): Agent {
    const start = fromDoor ? DOOR : target;
    const agent: Agent = {
      trackId: this.nextTrackId++, objectClass, x: start[0], y: start[1], targetX: target[0], targetY: target[1],
      deskId, leaving: false, phase: Math.random() * Math.PI * 2,
    };
    this.agents.push(agent);
    return agent;
  }

  /** Adjusts the number of free-roaming people (not sitting at a library desk). */
  setFreePeople(count: number, instant = false): void {
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_SIMULATED_PEOPLE) {
      throw new RangeError(`La cantidad de personas debe ser un entero entre 0 y ${MAX_SIMULATED_PEOPLE}`);
    }
    const free = this.people().filter((a) => a.deskId === null);
    for (let i = free.length; i < count; i++) {
      this.spawn('PERSON', this.freeSeat(), null, !instant);
    }
    for (let i = count; i < free.length; i++) {
      const leaver = free[free.length - 1 - (i - count)]!;
      if (instant) {
        this.agents = this.agents.filter((a) => a !== leaver);
      } else {
        leaver.leaving = true;
        leaver.targetX = DOOR[0];
        leaver.targetY = DOOR[1];
      }
    }
  }

  deskCenter(deskId: string): NormalizedPoint {
    const roi = this.rois.find((r) => r.zoneId === deskId);
    if (!roi) throw new Error(`Puesto desconocido ${deskId}`);
    return polygonCentroid(roi.polygon);
  }

  /** Places (or removes) the person of a desk; belongings stay unless cleared explicitly. */
  setDeskPerson(deskId: string, present: boolean, instant = false): void {
    const current = this.agents.find((a) => a.deskId === deskId && a.objectClass === 'PERSON' && !a.leaving);
    if (present && !current) {
      const [x, y] = this.deskCenter(deskId);
      this.spawn('PERSON', [x - 0.02, y - 0.01], deskId, !instant);
    } else if (!present && current) {
      if (instant) {
        this.agents = this.agents.filter((a) => a !== current);
      } else {
        current.leaving = true;
        current.targetX = DOOR[0];
        current.targetY = DOOR[1];
      }
    }
  }

  setDeskBelongings(deskId: string, classes: Exclude<DetectedObjectClass, 'PERSON'>[]): void {
    if (classes.length > 20 || classes.some((objectClass) => !['LAPTOP', 'BACKPACK', 'BOOK'].includes(objectClass))) {
      throw new RangeError('Desk belongings must contain at most 20 supported object classes');
    }
    this.agents = this.agents.filter((a) => !(a.deskId === deskId && a.objectClass !== 'PERSON'));
    const [x, y] = this.deskCenter(deskId);
    classes.forEach((objectClass, index) => this.spawn(objectClass, [x + 0.035 + index * 0.012, y + 0.035 - index * 0.02], deskId, false));
  }

  clearDesks(): void {
    this.agents = this.agents.filter((a) => a.deskId === null);
  }

  /** Real-time animation step: people walk at a constant speed; those who reach the door disappear. */
  animate(realSeconds: number): void {
    if (!Number.isFinite(realSeconds) || realSeconds < 0) {
      throw new RangeError('El tiempo de animación debe ser finito y no negativo');
    }
    const step = WALK_SPEED_PER_SECOND * realSeconds;
    for (const agent of this.agents) {
      const dx = agent.targetX - agent.x;
      const dy = agent.targetY - agent.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= step) {
        agent.x = agent.targetX;
        agent.y = agent.targetY;
      } else {
        agent.x += (dx / distance) * step;
        agent.y += (dy / distance) * step;
      }
    }
    this.agents = this.agents.filter((a) => !(a.leaving && Math.hypot(a.x - DOOR[0], a.y - DOOR[1]) < 0.005));
  }

  /** Simulated-time physics step (minutes) under the current HVAC strategy. */
  integrate(minutes: number, hvacState: HvacControlState, setpointC: number): void {
    if (!Object.hasOwn(HVAC_POWER_FRACTION, hvacState)) throw new RangeError(`unknown HVAC state: ${String(hvacState)}`);
    if (!Number.isFinite(minutes) || minutes < 0 || !Number.isFinite(setpointC)) {
      throw new RangeError('La integración térmica requiere duración y setpoint finitos');
    }
    if (minutes <= 0) return;
    const occupants = this.people().length;
    const { timeConstantMinutes, occupantGainCPerHour, hvacRateCPerMinute } = THERMAL_PARAMETERS;
    const drift = this.outdoorC + (this.indoorC - this.outdoorC) * Math.exp(-minutes / timeConstantMinutes)
      + (occupantGainCPerHour * occupants * (50 / this.space.areaSqm) * minutes) / 60;
    let temperature = drift;
    if (COMPRESSOR_ON.has(hvacState)) {
      const delta = setpointC - temperature;
      temperature += Math.sign(delta) * Math.min(Math.abs(delta), hvacRateCPerMinute * minutes);
    }
    this.indoorC = temperature;

    const steadyCo2 = 420 + (occupants * 1000) / this.space.areaSqm;
    const tau = hvacState === 'VENTILACION_CO2_ACTIVA' ? 6 : 20;
    this.co2Ppm += (steadyCo2 - this.co2Ppm) * (1 - Math.exp(-minutes / tau));
    const humidityTarget = this.space.climateProfile === 'SEDE_TROPICAL' ? (hvacState === 'CONFORT_ACTIVO' ? 60 : 72) : 55;
    this.humidityPct += (humidityTarget - this.humidityPct) * (1 - Math.exp(-minutes / 60));
  }

  /** What YOLO + ByteTrack would report now: boxes of visible agents, with occasional missed persons. */
  detections(withNoise: boolean, swayTime: number): TrackedDetection[] {
    if (!this.cameraOnline) return [];
    const result: TrackedDetection[] = [];
    for (const agent of this.agents) {
      if (withNoise && agent.objectClass === 'PERSON' && Math.random() < YOLO_MISS_PROBABILITY) continue;
      const [width, height] = BOX[agent.objectClass];
      const seated = agent.objectClass === 'PERSON' && Math.hypot(agent.targetX - agent.x, agent.targetY - agent.y) < 0.002;
      const sway = seated ? Math.sin(swayTime / 900 + agent.phase) * 0.0025 : 0;
      result.push({
        trackId: agent.trackId,
        objectClass: agent.objectClass,
        confidence: agent.objectClass === 'PERSON' ? 0.86 + 0.1 * Math.abs(Math.sin(agent.phase + swayTime / 4000)) : 0.74 + 0.08 * Math.abs(Math.cos(agent.phase)),
        box: boxAround([agent.x + sway, agent.y], width, height),
      });
    }
    return result;
  }

  wifiDevices(): number {
    return Math.round(this.people().length * 1.1);
  }

  /** Lighting (≈ 10 W/m²), computers (≈ 120 W each) and the share of the HVAC in use. */
  activePowerKw(hvacPowerShare: number, ratedKw: number): number {
    const lights = this.lightsOn ? this.space.areaSqm * 0.01 : 0;
    return Math.round((0.1 + lights + this.devicesOn * 0.12 + hvacPowerShare * ratedKw) * 100) / 100;
  }
}
