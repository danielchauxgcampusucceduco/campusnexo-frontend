import type { KalmanMeasurement, KalmanStep, MeasurementSource, TelemetrySnapshot } from './model';

/** Same defaults as KalmanParameters.defaults() in Java. */
export const KALMAN_PARAMETERS = {
  processNoisePerMinute: 0.8,
  cameraVariance: 0.64,
  co2RelativeError: 0.35,
  wifiRelativeError: 0.3,
  peoplePerDevice: 0.8,
  outdoorCo2Ppm: 420,
  co2PpmPerPersonSqm: 1000,
} as const;

export interface OccupancyBelief {
  estimate: number;
  variance: number;
  at: number;
}

export function uninformedBelief(at: number, capacity: number): OccupancyBelief {
  return { estimate: 0, variance: Math.max(4, (capacity * capacity) / 4), at };
}

interface Observation {
  source: MeasurementSource;
  value: number;
  variance: number;
}

const relativeVariance = (value: number, relativeError: number) => Math.max(1, (relativeError * value + 2) ** 2);

/**
 * Port of OccupancyKalmanDomainService.update: random-walk prediction P⁻ = P + Q·Δt, then a scalar
 * update per measurement with K = P⁻/(P⁻ + R), x = x⁻ + K(z − x⁻), P = (1 − K)P⁻.
 */
export function kalmanUpdate(
  previous: OccupancyBelief,
  snapshot: TelemetrySnapshot,
  space: { capacity: number; areaSqm: number },
): { step: KalmanStep; posterior: OccupancyBelief } {
  const minutes = Math.max(0, (snapshot.capturedAt - previous.at) / 60_000);
  let estimate = previous.estimate;
  let variance = previous.variance + KALMAN_PARAMETERS.processNoisePerMinute * minutes;
  const predictedVariance = variance;

  const observations: Observation[] = [];
  if (snapshot.cameraOnline) {
    const people = snapshot.detections.filter((d) => d.objectClass === 'PERSON').length;
    observations.push({ source: 'CAMARA_YOLO', value: people, variance: KALMAN_PARAMETERS.cameraVariance });
  }
  const co2Excess = Math.max(0, snapshot.co2Ppm - KALMAN_PARAMETERS.outdoorCo2Ppm);
  const fromCo2 = (co2Excess * space.areaSqm) / KALMAN_PARAMETERS.co2PpmPerPersonSqm;
  observations.push({
    source: 'CO2_BALANCE_MASICO',
    value: fromCo2,
    variance: relativeVariance(fromCo2, KALMAN_PARAMETERS.co2RelativeError),
  });
  const fromWifi = snapshot.wifiDevices * KALMAN_PARAMETERS.peoplePerDevice;
  observations.push({
    source: 'WIFI_DISPOSITIVOS',
    value: fromWifi,
    variance: relativeVariance(fromWifi, KALMAN_PARAMETERS.wifiRelativeError),
  });

  const measurements: KalmanMeasurement[] = [];
  for (const observation of observations) {
    const gain = variance / (variance + observation.variance);
    estimate += gain * (observation.value - estimate);
    variance *= 1 - gain;
    measurements.push({ ...observation, gain });
  }
  const bounded = Math.min(Math.max(0, estimate), space.capacity * 3);
  const posterior = { estimate: bounded, variance: Math.max(variance, 1e-6), at: snapshot.capturedAt };
  return {
    posterior,
    step: {
      priorEstimate: previous.estimate,
      priorVariance: previous.variance,
      elapsedMinutes: minutes,
      predictedVariance,
      measurements,
      posteriorEstimate: posterior.estimate,
      posteriorVariance: posterior.variance,
    },
  };
}
