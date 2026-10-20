import type { PlanRoom } from './plan';

/** A point in floor metres (y down), with the rotation of its room in degrees. */
export interface SeatSpot {
  index: number;
  x: number;
  y: number;
  angle: number;
}

/**
 * Where each seat of a room sits on the floor plan. Seats follow the same row-by-row numbering as the
 * camera regions (SeatGrid): the front strip of the room (board, door) stays free, and the grid fills the
 * rest of the room's oriented rectangle. The library reading room shows its eight tables (4 × 2).
 */
export function seatSpots(room: PlanRoom): SeatSpot[] {
  const rows = room.seatRows ?? (room.spaceId === 'BIBLIOTECA-2B' ? 2 : 0);
  const columns = room.seatColumns ?? (room.spaceId === 'BIBLIOTECA-2B' ? 4 : 0);
  if (rows === 0 || columns === 0) return [];
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
  const rows = room.seatRows ?? 2;
  const columns = room.seatColumns ?? 4;
  return Math.max(0.28, Math.min(0.9, Math.min((room.rect.w * 0.86) / columns, (room.rect.h * 0.7) / rows) * 0.62));
}

export function centroid(polygon: [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const [px, py] of polygon) {
    x += px;
    y += py;
  }
  return [x / polygon.length, y / polygon.length];
}
