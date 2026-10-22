import { describe, expect, it } from 'vitest';
import { roomCode } from './room';

describe('room code parser', () => {
  it('extracts the block, floor and two-digit room from a campus room code', () => {
    expect(roomCode('203-a')).toEqual({ block: 'A', floor: 2, room: 3 });
    expect(roomCode('503-B')).toEqual({ block: 'B', floor: 5, room: 3 });
  });

  it.each(['A-203', '203-AA', '203-', '203-A-extra', ''])('rejects malformed room code %j', (value) => {
    expect(roomCode(value)).toBeNull();
  });
});
