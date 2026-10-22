import type { CampusSpace, NormalizedPoint, RoomCondition, StudyZoneRoi } from './model';

/** Java: RoomConditionPolicy. */
export function classifyRoom(input: { maintenance: boolean; people: number; capacity: number; lightsOn: boolean; devicesOn: number }): RoomCondition {
  if (!Number.isSafeInteger(input.people) || input.people < 0) throw new RangeError('people must be a non-negative integer');
  if (!Number.isSafeInteger(input.capacity) || input.capacity <= 0) throw new RangeError('capacity must be a positive integer');
  if (!Number.isSafeInteger(input.devicesOn) || input.devicesOn < 0) throw new RangeError('devicesOn must be a non-negative integer');
  if (input.maintenance) return 'MANTENIMIENTO';
  if (input.people > input.capacity) return 'SOBRECUPO';
  if (input.people > 0) return 'OCUPADO';
  if (input.lightsOn && input.devicesOn > 0) return 'LUCES_Y_EQUIPOS_SIN_USO';
  if (input.lightsOn) return 'LUCES_SIN_OCUPACION';
  return input.devicesOn > 0 ? 'EQUIPOS_SIN_USO' : 'LIBRE';
}

export const wastesEnergy = (condition: RoomCondition) =>
  condition === 'LUCES_SIN_OCUPACION' || condition === 'EQUIPOS_SIN_USO' || condition === 'LUCES_Y_EQUIPOS_SIN_USO';

/** Same bounds as SeatGrid in Java: the top band is the front of the room (board, door). */
export const SEAT_GRID = { left: 0.05, right: 0.95, top: 0.3, bottom: 0.95, inset: 0.12 } as const;

function seatLabel(space: CampusSpace): string {
  switch (space.type) {
    case 'AULA':
    case 'SALA_ESTUDIO':
      return 'Pupitre';
    case 'SALA_COMPUTO':
      return 'Equipo';
    case 'LABORATORIO':
      return 'Puesto';
    case 'BIBLIOTECA':
    case 'CAFETERIA':
      return 'Mesa';
    default:
      return 'Asiento';
  }
}

/** Java: SeatGrid.regions. One region per seat, numbered row by row. */
export function seatGrid(space: CampusSpace): StudyZoneRoi[] {
  if (space.seatRows === null && space.seatColumns === null) return [];
  const rows = space.seatRows;
  const columns = space.seatColumns;
  if (typeof rows !== 'number' || typeof columns !== 'number'
      || !Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows <= 0 || columns <= 0) {
    throw new RangeError('seat layout dimensions must be positive integers');
  }
  if (rows * columns > 1_000) throw new RangeError('seat layout cannot exceed 1000 regions');
  const { left, right, top, bottom, inset } = SEAT_GRID;
  const cellW = (right - left) / columns;
  const cellH = (bottom - top) / rows;
  const label = seatLabel(space);
  const seats: StudyZoneRoi[] = [];
  for (let row = 0; row < rows!; row++) {
    for (let column = 0; column < columns!; column++) {
      const x0 = left + column * cellW + cellW * inset;
      const x1 = left + (column + 1) * cellW - cellW * inset;
      const y0 = top + row * cellH + cellH * inset;
      const y1 = top + (row + 1) * cellH - cellH * inset;
      const number = row * columns + column + 1;
      const polygon: NormalizedPoint[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      seats.push({ zoneId: `${space.spaceId}-P${String(number).padStart(2, '0')}`, label: `${label} ${number}`, polygon });
    }
  }
  return seats;
}

/** {@code 201-A} → block A, floor 2. */
export function roomCode(spaceId: string): { block: string; floor: number; room: number } | null {
  const match = /^(\d)(\d{2})-([A-Za-z])$/.exec(spaceId);
  return match ? { block: match[3]!.toUpperCase(), floor: Number(match[1]), room: Number(match[2]) } : null;
}
