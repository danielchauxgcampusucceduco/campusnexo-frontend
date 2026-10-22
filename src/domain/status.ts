import type { SpaceStatus } from './model';

export const NO_SHOW_GRACE_MINUTES = 15;
export const UNDERUSE_RATIO = 0.3;

export interface ActiveReservation {
  startsAt: number;
  endsAt: number;
  expectedAttendees: number;
  reference: string;
}

/** Port of SpaceStatusPolicy.classify (same precedence). */
export function classifySpace(input: {
  maintenance: boolean;
  popUpActive: boolean;
  people: number;
  capacity: number;
  reservation: ActiveReservation | null;
  now: number;
}): SpaceStatus {
  const { maintenance, popUpActive, people, capacity, reservation, now } = input;
  if (typeof maintenance !== 'boolean' || typeof popUpActive !== 'boolean') {
    throw new RangeError('maintenance and popUpActive must be booleans');
  }
  if (!Number.isSafeInteger(people) || people < 0) throw new RangeError('people must be a non-negative integer');
  if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new RangeError('capacity must be a positive integer');
  if (!Number.isFinite(now)) throw new RangeError('now must be finite');
  if (reservation) {
    if (!Number.isFinite(reservation.startsAt) || !Number.isFinite(reservation.endsAt)
        || reservation.endsAt <= reservation.startsAt) throw new RangeError('reservation interval must be valid');
    if (!Number.isSafeInteger(reservation.expectedAttendees) || reservation.expectedAttendees < 0) {
      throw new RangeError('expectedAttendees must be a non-negative integer');
    }
  }
  if (maintenance) return 'MANTENIMIENTO';
  if (popUpActive) return people > capacity ? 'ALERTA_SOBRECUPO' : 'HABILITADO_POPUP_PARCIALES';
  if (people > capacity) return 'ALERTA_SOBRECUPO';
  if (reservation) {
    if (people === 0) {
      return now >= reservation.startsAt + NO_SHOW_GRACE_MINUTES * 60_000 ? 'LIBERADO_POR_NO_SHOW' : 'RESERVADO_EN_ESPERA';
    }
    return people < reservation.expectedAttendees * UNDERUSE_RATIO ? 'ALERTA_SUBUTILIZADO' : 'OCUPADO_OPTIMO';
  }
  return people === 0 ? 'LIBRE' : 'OCUPADO_OPTIMO';
}
