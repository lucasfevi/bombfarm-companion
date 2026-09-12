import { describe, expect, it } from 'vitest';
import { railTintFor } from './roll-rail-tint';

describe('railTintFor', () => {
  it('maps low, middle and high percentiles to three different tints', () => {
    expect(new Set([railTintFor(5), railTintFor(50), railTintFor(95)]).size).toBe(3);
    expect(railTintFor(5)).toBe('low');
    expect(railTintFor(50)).toBe('mid');
    expect(railTintFor(95)).toBe('high');
  });

  it('splits on exact thirds, with each boundary belonging to the tint above it', () => {
    expect(railTintFor(100 / 3 - 1e-9)).toBe('low');
    expect(railTintFor(100 / 3)).toBe('mid');
    expect(railTintFor(200 / 3 - 1e-9)).toBe('mid');
    expect(railTintFor(200 / 3)).toBe('high');
  });

  it('covers the ends of the scale', () => {
    expect(railTintFor(0)).toBe('low');
    expect(railTintFor(100)).toBe('high');
  });
});
