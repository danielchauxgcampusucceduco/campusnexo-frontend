import { describe, expect, it } from 'vitest';
import { floorName, PLAN_FLOORS, PLAN_ROOMS, planRoom, validatePlanFloors } from './plan';

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

  it('validates floor identity and dimensions before indexing bundled campus geometry', () => {
    const floors = JSON.parse(JSON.stringify(PLAN_FLOORS));

    expect(validatePlanFloors(floors)).toHaveLength(PLAN_FLOORS.length);
    floors[0].width = 0;
    expect(() => validatePlanFloors(floors)).toThrow('floor metadata');
  });

  it('rejects room geometry and seat layouts that cannot be rendered safely', () => {
    const floors = JSON.parse(JSON.stringify(PLAN_FLOORS));
    floors[0].rooms[0].rect.w = Number.NaN;
    expect(() => validatePlanFloors(floors)).toThrow('rectangle');

    const invalidSeats = JSON.parse(JSON.stringify(PLAN_FLOORS));
    invalidSeats[0].rooms[0].seatRows = 1001;
    invalidSeats[0].rooms[0].seatColumns = 2;
    expect(() => validatePlanFloors(invalidSeats)).toThrow('seat layout');
  });
});
