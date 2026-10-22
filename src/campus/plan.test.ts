import { describe, expect, it } from 'vitest';
import { floorName, PLAN_FLOORS, PLAN_ROOMS, planRoom } from './plan';

describe('campus plan index', () => {
  it('indexes every room exactly once and returns the source room object', () => {
    const ids = PLAN_ROOMS.map(({ spaceId }) => spaceId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(PLAN_FLOORS.flatMap(({ rooms }) => rooms)).toEqual(PLAN_ROOMS);
    for (const room of PLAN_ROOMS) expect(planRoom(room.spaceId)).toBe(room);
    expect(planRoom('UNKNOWN-ROOM')).toBeUndefined();
  });

  it('resolves known floor names and labels unknown floors predictably', () => {
    for (const floor of PLAN_FLOORS) expect(floorName(floor.floor)).toBe(floor.name);
    expect(floorName(-1)).toBe('Piso -1');
  });
});
