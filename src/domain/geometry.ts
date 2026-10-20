import type { BoundingBox, NormalizedPoint } from './model';

/**
 * Even-odd ray casting, identical to StudyZoneRoi.containsPoint in Java: a horizontal ray from the
 * point crosses the polygon boundary an odd number of times when the point is inside.
 */
export function containsPoint(polygon: readonly NormalizedPoint[], [px, py]: NormalizedPoint): boolean {
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
  return [(box.xMin + box.xMax) / 2, (box.yMin + box.yMax) / 2];
}

export function polygonCentroid(polygon: readonly NormalizedPoint[]): NormalizedPoint {
  const sum = polygon.reduce<[number, number]>((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / polygon.length, sum[1] / polygon.length];
}

export function boxAround([cx, cy]: NormalizedPoint, width: number, height: number): BoundingBox {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return {
    xMin: clamp(cx - width / 2),
    yMin: clamp(cy - height / 2),
    xMax: clamp(cx + width / 2),
    yMax: clamp(cy + height / 2),
  };
}
