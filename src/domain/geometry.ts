import type { BoundingBox, NormalizedPoint } from './model';

/**
 * Even-odd ray casting, identical to StudyZoneRoi.containsPoint in Java: a horizontal ray from the
 * point crosses the polygon boundary an odd number of times when the point is inside.
 */
export function containsPoint(polygon: readonly NormalizedPoint[], [px, py]: NormalizedPoint): boolean {
  if (![px, py].every(Number.isFinite) || px < 0 || px > 1 || py < 0 || py > 1) {
    throw new RangeError('point must be finite and normalized');
  }
  if (polygon.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1)) {
    throw new RangeError('polygon points must be finite and normalized');
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i]!;
    const [bx, by] = polygon[j]!;
    if (ay > py !== by > py) {
      const intersectionX = ((bx - ax) * (py - ay)) / (by - ay) + ax;
      if (px < intersectionX) inside = !inside;
    }
  }
  return inside;
}

export function boxCenter(box: BoundingBox): NormalizedPoint {
  const coordinates = [box.xMin, box.yMin, box.xMax, box.yMax];
  if (!coordinates.every(Number.isFinite)) throw new RangeError('box coordinates must be finite');
  if (box.xMin < 0 || box.yMin < 0 || box.xMax > 1 || box.yMax > 1
      || box.xMin > box.xMax || box.yMin > box.yMax) {
    throw new RangeError('box must be ordered within normalized image bounds');
  }
  return [(box.xMin + box.xMax) / 2, (box.yMin + box.yMax) / 2];
}

export function polygonCentroid(polygon: readonly NormalizedPoint[]): NormalizedPoint {
  if (polygon.length === 0) throw new RangeError('polygon must contain at least one point');
  if (polygon.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1)) {
    throw new RangeError('polygon points must be finite and normalized');
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
  const sum = polygon.reduce<[number, number]>((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / polygon.length, sum[1] / polygon.length];
}

export function boxAround([cx, cy]: NormalizedPoint, width: number, height: number): BoundingBox {
  if (![cx, cy, width, height].every(Number.isFinite)) throw new RangeError('point and dimensions must be finite');
  if (width < 0 || height < 0) throw new RangeError('box dimensions must be non-negative');
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return {
    xMin: clamp(cx - width / 2),
    yMin: clamp(cy - height / 2),
    xMax: clamp(cx + width / 2),
    yMax: clamp(cy + height / 2),
  };
}
