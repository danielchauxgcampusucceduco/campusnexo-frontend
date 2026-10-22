import { describe, expect, it } from 'vitest';
import { evaluateDeskGhosting } from './desks';
import type { StudyZoneRoi, TrackedDetection } from './model';

const now = Date.parse('2026-10-21T12:00:00Z');
const roi: StudyZoneRoi = {
  zoneId: 'Z1',
  label: 'Zona de estudio',
  polygon: [[0, 0], [1, 0], [1, 1], [0, 1]],
};
const detection = (objectClass: TrackedDetection['objectClass']): TrackedDetection => ({
  trackId: 1,
  objectClass,
  confidence: 0.9,
  box: { xMin: 0.4, yMin: 0.4, xMax: 0.6, yMax: 0.6 },
});

describe('desk ghosting policy', () => {
  it('starts the unattended timer when belongings appear', () => {
    const result = evaluateDeskGhosting(roi, [detection('BACKPACK')], undefined, now);

    expect(result.state).toBe('ALERTA_ACAPARAMIENTO');
    expect(result.unattendedSince).toBe(new Date(now).toISOString());
    expect(result.unattendedMinutes).toBe(0);
  });

  it('preserves a valid prior timer and releases at the fifteen minute boundary', () => {
    const started = evaluateDeskGhosting(roi, [detection('BACKPACK')], undefined, now);
    const result = evaluateDeskGhosting(roi, [detection('BACKPACK')], started, now + 15 * 60_000);

    expect(result.state).toBe('LIBERADO_POR_ABANDONO');
    expect(result.unattendedSince).toBe(started.unattendedSince);
    expect(result.unattendedMinutes).toBe(15);
  });

  it('resets the timer when a person returns or the desk becomes empty', () => {
    const started = evaluateDeskGhosting(roi, [detection('BACKPACK')], undefined, now);
    const returned = evaluateDeskGhosting(roi, [detection('PERSON')], started, now + 60_000);
    const empty = evaluateDeskGhosting(roi, [], started, now + 60_000);

    expect(returned.state).toBe('OCUPADO_VERIFICADO');
    expect(returned.unattendedSince).toBeNull();
    expect(empty.state).toBe('DISPONIBLE');
    expect(empty.unattendedSince).toBeNull();
  });

  it('rejects invalid evaluation timestamps before producing an unusable ISO date', () => {
    expect(() => evaluateDeskGhosting(roi, [], undefined, Number.NaN)).toThrow(RangeError);
    expect(() => evaluateDeskGhosting(roi, [], undefined, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('ignores detections whose center lies outside the desk ROI', () => {
    const narrowRoi: StudyZoneRoi = {
      zoneId: 'Z2', label: 'Mesa pequeña', polygon: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.3], [0.1, 0.3]],
    };

    const result = evaluateDeskGhosting(narrowRoi, [detection('PERSON'), detection('LAPTOP')], undefined, now);

    expect(result.state).toBe('DISPONIBLE');
    expect(result.peopleInside).toBe(0);
    expect(result.belongingsInside).toBe(0);
  });
});
