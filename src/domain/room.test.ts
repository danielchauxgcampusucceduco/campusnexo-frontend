import { describe, expect, it } from 'vitest';
import { classifyRoom, wastesEnergy } from './room';
import type { RoomCondition } from './model';

describe('room condition policy', () => {
  it('prioritizes maintenance, then occupancy and energy waste', () => {
    expect(classifyRoom({ maintenance: true, people: 50, capacity: 40, lightsOn: true, devicesOn: 4 })).toBe('MANTENIMIENTO');
    expect(classifyRoom({ maintenance: false, people: 41, capacity: 40, lightsOn: true, devicesOn: 4 })).toBe('SOBRECUPO');
    expect(classifyRoom({ maintenance: false, people: 1, capacity: 40, lightsOn: true, devicesOn: 4 })).toBe('OCUPADO');
    expect(classifyRoom({ maintenance: false, people: 0, capacity: 40, lightsOn: true, devicesOn: 4 })).toBe('LUCES_Y_EQUIPOS_SIN_USO');
  });

  it('marks only empty-room energy conditions as waste', () => {
    const waste: RoomCondition[] = ['LUCES_SIN_OCUPACION', 'EQUIPOS_SIN_USO', 'LUCES_Y_EQUIPOS_SIN_USO'];

    for (const condition of waste) expect(wastesEnergy(condition)).toBe(true);
    for (const condition of ['LIBRE', 'OCUPADO', 'SOBRECUPO', 'MANTENIMIENTO'] as const) {
      expect(wastesEnergy(condition)).toBe(false);
    }
  });

  it('rejects invalid counts before applying condition precedence', () => {
    expect(() => classifyRoom({ maintenance: true, people: -1, capacity: 40, lightsOn: false, devicesOn: 0 })).toThrow('people');
    expect(() => classifyRoom({ maintenance: false, people: 0, capacity: 0, lightsOn: false, devicesOn: 0 })).toThrow('capacity');
    expect(() => classifyRoom({ maintenance: false, people: 0, capacity: 40, lightsOn: false, devicesOn: 1.2 })).toThrow('devicesOn');
  });

  it('rejects non-boolean room switches at the domain boundary', () => {
    expect(() => classifyRoom({ maintenance: 'false', people: 0, capacity: 40, lightsOn: false, devicesOn: 0 } as never))
      .toThrow('must be booleans');
    expect(() => classifyRoom({ maintenance: false, people: 0, capacity: 40, lightsOn: 0, devicesOn: 0 } as never))
      .toThrow('must be booleans');
  });
});
