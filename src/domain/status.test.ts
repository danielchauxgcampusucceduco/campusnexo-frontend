import { describe, expect, it } from 'vitest';
import { classifySpace, NO_SHOW_GRACE_MINUTES, UNDERUSE_RATIO } from './status';

const now = Date.parse('2026-10-21T12:00:00Z');
const base = {
  maintenance: false,
  popUpActive: false,
  people: 0,
  capacity: 40,
  reservation: null,
  now,
};

describe('space status policy', () => {
  it('gives maintenance and popup precedence over reservation status', () => {
    const reservation = { startsAt: now - 30 * 60_000, endsAt: now + 60_000, expectedAttendees: 30, reference: 'R-1' };

    expect(classifySpace({ ...base, maintenance: true, popUpActive: true, people: 50, reservation })).toBe('MANTENIMIENTO');
    expect(classifySpace({ ...base, popUpActive: true, people: 40, reservation })).toBe('HABILITADO_POPUP_PARCIALES');
    expect(classifySpace({ ...base, popUpActive: true, people: 41, reservation })).toBe('ALERTA_SOBRECUPO');
  });

  it('applies strict underuse and inclusive no-show boundaries', () => {
    const reservation = { startsAt: now, endsAt: now + 60 * 60_000, expectedAttendees: 40, reference: 'R-2' };

    expect(classifySpace({ ...base, people: 11, reservation })).toBe('ALERTA_SUBUTILIZADO');
    expect(classifySpace({ ...base, people: 12, reservation })).toBe('OCUPADO_OPTIMO');
    expect(classifySpace({ ...base, reservation, now: now + NO_SHOW_GRACE_MINUTES * 60_000 - 1 })).toBe('RESERVADO_EN_ESPERA');
    expect(classifySpace({ ...base, reservation, now: now + NO_SHOW_GRACE_MINUTES * 60_000 })).toBe('LIBERADO_POR_NO_SHOW');
    expect(UNDERUSE_RATIO).toBe(0.3);
  });

  it('rejects invalid occupancy and reservation intervals instead of classifying corrupt data', () => {
    const reservation = { startsAt: now, endsAt: now + 60_000, expectedAttendees: 10, reference: 'R-3' };

    expect(() => classifySpace({ ...base, people: -1 })).toThrow('people');
    expect(() => classifySpace({ ...base, capacity: 0 })).toThrow('capacity');
    expect(() => classifySpace({ ...base, reservation: { ...reservation, endsAt: now } })).toThrow('interval');
    expect(() => classifySpace({ ...base, reservation: { ...reservation, expectedAttendees: -1 } })).toThrow('expectedAttendees');
  });
});
