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
});
