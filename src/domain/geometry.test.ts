import { describe, expect, it } from 'vitest';
import { boxAround, boxCenter, containsPoint, polygonCentroid } from './geometry';
import type { NormalizedPoint } from './model';

describe('geometry helpers', () => {
  const square: NormalizedPoint[] = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]];

  it('handles empty and single point polygons without throwing', () => {
    expect(containsPoint([], [0.5, 0.5])).toBe(false);
    expect(containsPoint([[0.5, 0.5]], [0.5, 0.5])).toBe(false);
  });

  it('keeps the ray-casting boundary convention stable', () => {
    expect(containsPoint(square, [0.5, 0.5])).toBe(true);
    expect(containsPoint(square, [0.2, 0.5])).toBe(true);
    expect(containsPoint(square, [0.9, 0.5])).toBe(false);
  });

  it('computes box centers and area-weighted polygon centroids', () => {
    expect(boxCenter({ xMin: 0.2, yMin: 0.3, xMax: 0.6, yMax: 0.7 })).toEqual([0.4, 0.5]);
    const squareCenter = polygonCentroid(square);
    expect(squareCenter[0]).toBeCloseTo(0.5, 10);
    expect(squareCenter[1]).toBeCloseTo(0.5, 10);
    const concave: NormalizedPoint[] = [[0.1, 0.1], [0.5, 0.1], [0.5, 0.3], [0.3, 0.3], [0.3, 0.6], [0.1, 0.6]];
    const [cx, cy] = polygonCentroid(concave);
    expect(cx).toBeCloseTo(0.257142857, 8);
    expect(cy).toBeCloseTo(0.307142857, 8);
    expect(containsPoint(concave, [cx, cy])).toBe(true);
  });

  it('clamps generated boxes to normalized image bounds', () => {
    const box = boxAround([0.02, 0.98], 0.2, 0.2);

    expect(box.xMin).toBe(0);
    expect(box.xMax).toBeCloseTo(0.12);
    expect(box.yMin).toBeCloseTo(0.88);
    expect(box.yMax).toBe(1);
  });

  it('rejects empty centroid geometry instead of returning NaN coordinates', () => {
    expect(() => polygonCentroid([])).toThrow(RangeError);
  });

  it('rejects invalid dimensions before generating normalized boxes', () => {
    expect(() => boxAround([0.5, 0.5], -1, 0.2)).toThrow(RangeError);
    expect(() => boxAround([0.5, 0.5], Number.POSITIVE_INFINITY, 0.2)).toThrow(RangeError);
  });

  it('rejects unordered or out-of-frame detection boxes before computing centers', () => {
    expect(() => boxCenter({ xMin: 0.8, yMin: 0.2, xMax: 0.3, yMax: 0.8 })).toThrow('ordered');
    expect(() => boxCenter({ xMin: 0, yMin: 0, xMax: 1.1, yMax: 1 })).toThrow('normalized');
    expect(() => boxCenter({ xMin: 0, yMin: Number.NaN, xMax: 1, yMax: 1 })).toThrow('finite');
  });

  it('rejects non-normalized ROI coordinates and query points', () => {
    expect(() => containsPoint([[0, 0], [2, 0], [1, 1]], [0.5, 0.5])).toThrow('polygon points');
    expect(() => containsPoint(square, [Number.NaN, 0.5])).toThrow('point');
    expect(() => polygonCentroid([[0, 0], [Number.POSITIVE_INFINITY, 1]])).toThrow('polygon points');
  });
});
