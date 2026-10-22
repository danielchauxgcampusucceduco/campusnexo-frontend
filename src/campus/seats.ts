import type { PlanRoom } from './plan';

/** A point in floor metres (y down), with the rotation of its room in degrees. */
export interface SeatSpot {
  index: number;
  x: number;
  y: number;
  angle: number;
}

function assertRect(room: PlanRoom): void {
  const values = [room.rect.cx, room.rect.cy, room.rect.w, room.rect.h, room.rect.angle];
  if (!values.every(Number.isFinite) || room.rect.w <= 0 || room.rect.h <= 0) {
    throw new RangeError('room rectangle must have finite coordinates and positive dimensions');
  }
}

/**
 * Where each seat of a room sits on the floor plan. Seats follow the same row-by-row numbering as the
 * camera regions (SeatGrid): the front strip of the room (board, door) stays free, and the grid fills the
 * rest of the room's oriented rectangle. The library reading room shows its eight tables (4 × 2).
 */
export function seatSpots(room: PlanRoom): SeatSpot[] {
  if (room.seatRows === null && room.seatColumns === null && room.spaceId !== 'BIBLIOTECA-2B') return [];
  const rows = room.seatRows ?? (room.spaceId === 'BIBLIOTECA-2B' ? 2 : 0);
  const columns = room.seatColumns ?? (room.spaceId === 'BIBLIOTECA-2B' ? 4 : 0);
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows <= 0 || columns <= 0
      || rows * columns > 1_000) throw new RangeError('room seat layout must contain 1 to 1000 integer seats');
  assertRect(room);
  const { cx, cy, w, h, angle } = room.rect;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Local frame: u along the long side, v across it; the front strip is the first 22 % of v.
  const usableW = w * 0.86;
  const top = -h / 2 + h * 0.24;
  const usableH = h * 0.7;
  const spots: SeatSpot[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const u = -usableW / 2 + ((column + 0.5) / columns) * usableW;
      const v = top + ((row + 0.5) / rows) * usableH;
      spots.push({ index: row * columns + column, x: cx + u * cos - v * sin, y: cy + u * sin + v * cos, angle });
    }
  }
  return spots;
}

/** Spots for people standing at the front strip (those beyond the seats). */
export function standingSpots(room: PlanRoom, count: number): SeatSpot[] {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('standing count must be a non-negative integer');
  assertRect(room);
  const { cx, cy, w, h, angle } = room.rect;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return Array.from({ length: Math.min(count, 24) }, (_, i) => {
    const u = -w * 0.4 + ((i % 12) + 0.5) * (w * 0.8 / 12);
    const v = -h / 2 + h * (0.07 + Math.floor(i / 12) * 0.08);
    return { index: i, x: cx + u * cos - v * sin, y: cy + u * sin + v * cos, angle };
  });
}

/** Size of one seat glyph, so the grid never overlaps in small rooms. */
export function seatSize(room: PlanRoom): number {
  assertRect(room);
  const rows = room.seatRows ?? 2;
  const columns = room.seatColumns ?? 4;
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows <= 0 || columns <= 0) {
    throw new RangeError('room seat layout dimensions must be positive integers');
  }
  return Math.max(0.28, Math.min(0.9, Math.min((room.rect.w * 0.86) / columns, (room.rect.h * 0.7) / rows) * 0.62));
}

export function centroid(polygon: [number, number][]): [number, number] {
  if (polygon.length === 0 || polygon.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    throw new RangeError('polygon must contain finite points');
  }
  let twiceArea = 0;
  let xMoment = 0;
  let yMoment = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i]!;
    const [x2, y2] = polygon[(i + 1) % polygon.length]!;
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    xMoment += (x1 + x2) * cross;
    yMoment += (y1 + y2) * cross;
  }
  if (Math.abs(twiceArea) > Number.EPSILON) return [xMoment / (3 * twiceArea), yMoment / (3 * twiceArea)];
  return polygon.reduce<[number, number]>((sum, [x, y]) => [sum[0] + x / polygon.length, sum[1] + y / polygon.length], [0, 0]);
}
