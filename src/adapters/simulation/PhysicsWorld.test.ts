import { describe, expect, it } from 'vitest';
import { SEED_SPACES, regionsOf } from './campusSeed';
import { RoomPhysics } from './PhysicsWorld';

function physics() {
  const space = SEED_SPACES.find((candidate) => candidate.type === 'AULA')!;
  return new RoomPhysics(space, 13.5, regionsOf(space));
}

describe('RoomPhysics', () => {
  it('requires free people to be a non-negative integer', () => {
    const room = physics();

    expect(() => room.setFreePeople(-1)).toThrow(RangeError);
    expect(() => room.setFreePeople(1.5)).toThrow(RangeError);
    expect(() => room.setFreePeople(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
    expect(room.people()).toHaveLength(0);
  });

  it('adds and removes the requested free people immediately', () => {
    const room = physics();

    room.setFreePeople(3, true);
    expect(room.people()).toHaveLength(3);
    room.setFreePeople(1, true);
    expect(room.people()).toHaveLength(1);
  });

  it('rejects invalid animation elapsed time before moving agents', () => {
    const room = physics();
    room.setFreePeople(1, true);
    const before = { x: room.agents[0]!.x, y: room.agents[0]!.y };

    expect(() => room.animate(-1)).toThrow(RangeError);
    expect(() => room.animate(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(room.agents[0]).toMatchObject(before);
  });

  it.each([
    [Number.NaN, 24],
    [-1, 24],
    [1, Number.POSITIVE_INFINITY],
  ])('rejects invalid thermal inputs without changing the climate', (minutes, setpointC) => {
    const room = physics();
    const before = { indoorC: room.indoorC, co2Ppm: room.co2Ppm, humidityPct: room.humidityPct };

    expect(() => room.integrate(minutes, 'BLOQUEO_AHORRO_VACIO', setpointC)).toThrow(RangeError);
    expect(room).toMatchObject(before);
  });

  it('rejects invalid lighting and device commands before changing simulated equipment', () => {
    const room = physics();

    expect(() => room.setLights(1 as never)).toThrow('light state must be boolean');
    expect(() => room.setDevices(Number.NaN)).toThrow('device count must be a safe integer');
    expect(() => room.setDevices(1.5)).toThrow('device count must be a safe integer');
    expect(room.lightsOn).toBe(false);
    expect(room.devicesOn).toBe(0);
  });

  it('rejects people and unbounded object lists as desk belongings', () => {
    const room = physics();
    const deskId = room.rois[0]!.zoneId;

    expect(() => room.setDeskBelongings(deskId, ['PERSON' as never])).toThrow('supported object classes');
    expect(() => room.setDeskBelongings(deskId, Array(21).fill('BOOK'))).toThrow('at most 20');
    expect(room.people()).toHaveLength(0);
    expect(room.agents).toHaveLength(0);
  });
});
