import { boxCenter, containsPoint } from './geometry';
import type { DeskObservation, StudyZoneRoi, TrackedDetection } from './model';

export const DESK_ABANDON_MINUTES = 15;

/** Port of StudyZoneRoi.evaluateDeskGhosting: person → verified; belongings alone → alert → released at 15 min. */
export function evaluateDeskGhosting(
  roi: StudyZoneRoi,
  detections: readonly TrackedDetection[],
  previous: DeskObservation | undefined,
  now: number,
): DeskObservation {
  if (!Number.isFinite(now)) throw new RangeError('evaluation time must be finite');
  let people = 0;
  let belongings = 0;
  for (const detection of detections) {
    if (containsPoint(roi.polygon, boxCenter(detection.box))) {
      if (detection.objectClass === 'PERSON') people++;
      else belongings++;
    }
  }
  const evaluatedAt = new Date(now).toISOString();
  if (people > 0) {
    return { zoneId: roi.zoneId, state: 'OCUPADO_VERIFICADO', peopleInside: people, belongingsInside: belongings, unattendedSince: null, unattendedMinutes: 0, evaluatedAt };
  }
  if (belongings === 0) {
    return { zoneId: roi.zoneId, state: 'DISPONIBLE', peopleInside: 0, belongingsInside: 0, unattendedSince: null, unattendedMinutes: 0, evaluatedAt };
  }
  const tracksSameAbandonment = previous?.zoneId === roi.zoneId
    && (previous.state === 'ALERTA_ACAPARAMIENTO' || previous.state === 'LIBERADO_POR_ABANDONO');
  const previousSince = tracksSameAbandonment && previous.unattendedSince
    ? Date.parse(previous.unattendedSince)
    : null;
  const since = previousSince !== null && previousSince <= now ? previousSince : now;
  const minutes = Math.floor((now - since) / 60_000);
  return {
    zoneId: roi.zoneId,
    state: minutes >= DESK_ABANDON_MINUTES ? 'LIBERADO_POR_ABANDONO' : 'ALERTA_ACAPARAMIENTO',
    peopleInside: 0,
    belongingsInside: belongings,
    unattendedSince: new Date(since).toISOString(),
    unattendedMinutes: minutes,
    evaluatedAt,
  };
}
