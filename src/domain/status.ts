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
