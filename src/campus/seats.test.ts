import { describe, expect, it } from 'vitest';
import { PLAN_ROOMS } from './plan';
import { centroid, seatSize, seatSpots, standingSpots } from './seats';

const library = PLAN_ROOMS.find(({ spaceId }) => spaceId === 'BIBLIOTECA-2B')!;
const classroom = PLAN_ROOMS.find((room) => room.seatRows !== null && room.seatColumns !== null)!;

describe('floor plan seat placement', () => {
  it('shows the eight library tables in stable row-major indexes', () => {
    const spots = seatSpots(library);

    expect(spots.map(({ index }) => index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(spots.every(({ x, y, angle }) => Number.isFinite(x) && Number.isFinite(y) && angle === library.rect.angle)).toBe(true);
  });

  it('caps the people drawn beyond seats and keeps glyphs within supported sizes', () => {
    expect(standingSpots(classroom, 100)).toHaveLength(24);
    expect(standingSpots(classroom, 0)).toHaveLength(0);
    expect(seatSize(classroom)).toBeGreaterThanOrEqual(0.28);
    expect(seatSize(classroom)).toBeLessThanOrEqual(0.9);
  });

  it('computes area-weighted floor polygon centroids and rejects empty outlines', () => {
    expect(centroid([[0, 0], [4, 0], [4, 2], [0, 2]])).toEqual([2, 1]);
    expect(() => centroid([])).toThrow('finite points');
  });

  it('rejects unsafe seat layouts and invalid standing counts before rendering', () => {
    expect(() => seatSpots({ ...classroom, seatRows: 0 })).toThrow('seat layout');
    expect(() => seatSpots({ ...classroom, seatRows: 1_000, seatColumns: 2 })).toThrow('1000 integer seats');
    expect(() => standingSpots(classroom, -1)).toThrow('standing count');
    expect(() => seatSize({ ...classroom, rect: { ...classroom.rect, w: Number.NaN } })).toThrow('rectangle');
  });
});
