import { evaluateDeskGhosting } from '../../domain/desks';
import { kalmanUpdate, uninformedBelief, type OccupancyBelief } from '../../domain/kalman';
import { savedKwh } from '../../domain/kpis';
import {
  COMPRESSOR_ON,
  type ArchitectureTrace,
  type CampusSpace,
  type DeskObservation,
  type HexagonalLayer,
  type HvacControlState,
  type SpaceTwinState,
  type StudyZoneRoi,
  type TelemetrySnapshot,
  type TraceStep,
} from '../../domain/model';
import { classifySpace, type ActiveReservation } from '../../domain/status';
import { comfortBand, decideThermal } from '../../domain/thermal';

export interface SimReservation extends ActiveReservation {
  reservationId: string;
  spaceId: string;
}

export interface TwinRecord {
  state: SpaceTwinState;
  belief: OccupancyBelief;
  /** True once the first frame has been processed (energy accrual starts after it). */
  initialized: boolean;
}

export interface ProcessResult {
  record: TwinRecord;
  trace: ArchitectureTrace;
  commandSent: boolean;
}

/** Records the hops of one event, with the same component names as the Java backend. */
class TraceBuilder {
  private readonly steps: TraceStep[] = [];
  private readonly started = performance.now();

  constructor(private readonly trigger: string, private readonly spaceId: string, private readonly startedAt: number) {}

  step(layer: HexagonalLayer, component: string, detail: string): this {
    this.steps.push({ layer, component, detail, offsetMicros: Math.round((performance.now() - this.started) * 1000) });
    return this;
  }

  outbound(port: string, adapter: string, detail: string): this {
    return this.step('OUTPUT_PORT', port, detail).step('OUTBOUND_ADAPTER', adapter, detail);
  }

  finish(): ArchitectureTrace {
    return {
      traceId: crypto.randomUUID(),
      trigger: this.trigger,
      spaceId: this.spaceId,
      startedAt: new Date(this.startedAt).toISOString(),
      steps: this.steps,
    };
  }
}

const iso = (epochMs: number) => new Date(epochMs).toISOString();
const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function initialRecord(space: CampusSpace, outdoorC: number, now: number): TwinRecord {
  const belief = uninformedBelief(now, space.capacity);
  return {
    belief,
    initialized: false,
    state: {
      spaceId: space.spaceId,
      status: 'LIBRE',
      hvacState: 'APAGADO',
      hvacStateSince: iso(now),
      occupancy: 0,
      occupancyEstimate: 0,
      occupancyStdDev: Math.sqrt(belief.variance),
      indoorTemperatureC: outdoorC,
      outdoorTemperatureC: outdoorC,
      co2Ppm: 420,
      humidityPct: 50,
      cameraOnline: true,
      energySavedKwh: 0,
      overrideUntil: null,
      popUpUntil: null,
      maintenance: false,
      updatedAt: iso(now),
      desks: [],
      kalman: null,
      thermal: null,
    },
  };
}

const activeAt = (reservations: readonly SimReservation[], spaceId: string, at: number) =>
  reservations.find((r) => r.spaceId === spaceId && r.startsAt <= at && at < r.endsAt) ?? null;

const nextStartingAfter = (reservations: readonly SimReservation[], spaceId: string, at: number) =>
  reservations.filter((r) => r.spaceId === spaceId && r.startsAt > at).sort((a, b) => a.startsAt - b.startsAt)[0] ?? null;

/**
 * Browser twin of ProcessSpaceTelemetryService: same order of domain services and the same trace
 * vocabulary, so the architecture view reads identically in both data modes.
 */
export function processFrame(input: {
  space: CampusSpace;
  previous: TwinRecord;
  snapshot: TelemetrySnapshot | null;
  rois: readonly StudyZoneRoi[];
  reservations: readonly SimReservation[];
  now: number;
  trigger: string;
}): ProcessResult {
  const { space, previous, snapshot, rois, reservations, now, trigger } = input;
  const trace = new TraceBuilder(trigger, space.spaceId, now);
  const prev = previous.state;

  let belief = previous.belief;
  let kalman = prev.kalman;
  let desks: DeskObservation[] = prev.desks;
  let sensors = {
    indoor: prev.indoorTemperatureC,
    outdoor: prev.outdoorTemperatureC,
    co2: prev.co2Ppm,
    humidity: prev.humidityPct,
    cameraOnline: prev.cameraOnline,
  };

  if (snapshot) {
    trace
      .step('INBOUND_ADAPTER', trigger, `${snapshot.detections.length} detecciones, cámara ${snapshot.cameraOnline ? 'en línea' : 'caída'}`)
      .step('INPUT_PORT', 'ProcessSpaceTelemetryUseCase', 'process(TelemetrySnapshot)')
      .step('USE_CASE', 'ProcessSpaceTelemetryService', 'Orquesta Kalman → ROI → estado → MPC');
    const updated = kalmanUpdate(previous.belief, snapshot, space);
    belief = updated.posterior;
    kalman = updated.step;
    trace.step('DOMAIN_SERVICE', 'OccupancyKalmanDomainService',
      `x⁻=${previous.belief.estimate.toFixed(1)} P⁻=${updated.step.predictedVariance.toFixed(2)} → x=${belief.estimate.toFixed(1)} P=${belief.variance.toFixed(2)} (${updated.step.measurements.length} mediciones)`);
    if (snapshot.cameraOnline && rois.length > 0) {
      const byZone = new Map(prev.desks.map((desk) => [desk.zoneId, desk]));
      desks = rois.map((roi) => evaluateDeskGhosting(roi, snapshot.detections, byZone.get(roi.zoneId), now));
      const held = desks.filter((desk) => desk.unattendedSince !== null).length;
      trace.step('DOMAIN_SERVICE', 'StudyZoneRoi.evaluateDeskGhosting', `${desks.length} puestos evaluados por ray casting, ${held} con pertenencias sin estudiante`);
    }
    sensors = {
      indoor: snapshot.indoorTemperatureC,
      outdoor: snapshot.outdoorTemperatureC,
      co2: snapshot.co2Ppm,
      humidity: snapshot.humidityPct,
      cameraOnline: snapshot.cameraOnline,
    };
  } else {
    trace
      .step('INBOUND_ADAPTER', trigger, 'Cambio de control manual')
      .step('INPUT_PORT', 'SpaceReevaluationUseCase', `reevaluate(${space.spaceId})`)
      .step('USE_CASE', 'ProcessSpaceTelemetryService', 'Recalcula estado y estrategia HVAC');
  }

  const people = Math.round(belief.estimate);
  const reservation = activeAt(reservations, space.spaceId, now);
  const popUpActive = prev.popUpUntil !== null && now < Date.parse(prev.popUpUntil);
  const overrideActive = prev.overrideUntil !== null && now < Date.parse(prev.overrideUntil);
  const status = classifySpace({ maintenance: prev.maintenance, popUpActive, people, capacity: space.capacity, reservation, now });
  trace.step('DOMAIN_SERVICE', 'SpaceStatusPolicy', `${people}/${space.capacity} personas${reservation ? `, reserva ${reservation.reference}` : ''} → ${status}`);

  const minutesUntilEnds = reservation && people > 0 ? Math.max(0, Math.floor((reservation.endsAt - now) / 60_000)) : null;
  let minutesUntilNext: number | null;
  if (reservation && status === 'RESERVADO_EN_ESPERA') {
    minutesUntilNext = 0;
  } else {
    const next = nextStartingAfter(reservations, space.spaceId, reservation ? reservation.endsAt : now);
    minutesUntilNext = next ? Math.max(0, Math.floor((next.startsAt - now) / 60_000)) : null;
  }
  const thermal = decideThermal({
    indoorTemperatureC: sensors.indoor,
    outdoorTemperatureC: sensors.outdoor,
    occupants: people,
    areaSqm: space.areaSqm,
    co2Ppm: sensors.co2,
    band: comfortBand(space.climateProfile),
    minutesUntilOccupancyEnds: minutesUntilEnds,
    minutesUntilNextOccupancy: minutesUntilNext,
  });
  const hvacState: HvacControlState = prev.maintenance ? 'APAGADO' : overrideActive ? 'OVERRIDE_MANUAL_DOCENTE' : thermal.recommendedState;
  trace.step('DOMAIN_SERVICE', 'ThermalInertiaMpcDomainService', `${hvacState}: ${thermal.explanation}`);

  const previousUpdate = Date.parse(prev.updatedAt);
  const saved = previous.initialized ? prev.energySavedKwh + savedKwh(prev.hvacState, previousUpdate, now, space.areaSqm) : prev.energySavedKwh;
  const strategyChanged = hvacState !== prev.hvacState || !previous.initialized;

  const state: SpaceTwinState = {
    ...prev,
    status,
    hvacState,
    hvacStateSince: strategyChanged ? iso(now) : prev.hvacStateSince,
    occupancy: people,
    occupancyEstimate: round3(belief.estimate),
    occupancyStdDev: round3(Math.sqrt(belief.variance)),
    indoorTemperatureC: sensors.indoor,
    outdoorTemperatureC: sensors.outdoor,
    co2Ppm: sensors.co2,
    humidityPct: sensors.humidity,
    cameraOnline: sensors.cameraOnline,
    energySavedKwh: round3(saved),
    updatedAt: iso(Math.max(now, previousUpdate)),
    desks,
    kalman,
    thermal,
  };

  if (snapshot) {
    trace.step('USE_CASE', 'TelemetryUseCase.ingest', 'Lectura agregada guardada; observadores de alertas notificados');
  }
  trace.outbound('SpaceRepositoryPort.saveTwin', 'InMemorySpaceRepository', `${status} / ${hvacState}`);
  if (strategyChanged) {
    trace.outbound('HvacActuatorCommandPort.send', 'SimulatedEsp32Actuator',
      `${prev.hvacState} → ${hvacState}${COMPRESSOR_ON.has(hvacState) ? ' (compresor encendido)' : ''}`);
  }
  trace.outbound('RealtimeDashboardNotifierPort.publishTwinUpdate', 'InMemoryDashboardNotifier', 'Gemelo actualizado');

  return { record: { state, belief, initialized: true }, trace: trace.finish(), commandSent: strategyChanged };
}
