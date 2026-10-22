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

  it('computes centers and polygon vertex averages', () => {
    expect(boxCenter({ xMin: 0.2, yMin: 0.3, xMax: 0.6, yMax: 0.7 })).toEqual([0.4, 0.5]);
    expect(polygonCentroid(square)).toEqual([0.5, 0.5]);
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
});
