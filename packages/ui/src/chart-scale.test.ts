import { describe, expect, it } from 'vitest';
import { niceScale } from './chart-scale';

describe('niceScale', () => {
  it.each([
    [100, 4, 25, [0, 25, 50, 75, 100]],
    [10, 4, 2.5, [0, 2.5, 5, 7.5, 10]],
    [87, 4, 25, [0, 25, 50, 75, 100]],
    [101, 4, 50, [0, 50, 100, 150]],
    [7, 4, 2, [0, 2, 4, 6, 8]],
    [0.3, 3, 0.1, [0, 0.1, 0.2, 0.3]],
    [12345, 5, 2500, [0, 2500, 5000, 7500, 10000, 12500]],
  ])('fits %s with %s intervals to a step of %s', (max, tickCount, step, ticks) => {
    const scale = niceScale(max, tickCount);
    expect(scale.step).toBe(step);
    expect(scale.ticks).toEqual(ticks);
    expect(scale.max).toBe(ticks[ticks.length - 1]);
    expect(scale.max).toBeGreaterThanOrEqual(max);
  });

  it('always starts at zero and rises by whole steps', () => {
    for (const max of [1, 3, 9.5, 42, 777, 1e6, 0.004]) {
      const { ticks, step } = niceScale(max, 4);
      expect(ticks[0]).toBe(0);
      ticks.slice(1).forEach((tick, index) => {
        expect(tick).toBeCloseTo((index + 1) * step, 9);
      });
    }
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('gives %s a unit-step axis rather than dividing by it', (max) => {
    const scale = niceScale(max, 4);
    expect(scale).toEqual({ max: 4, step: 1, ticks: [0, 1, 2, 3, 4] });
  });

  it('treats a tick count below one as one interval', () => {
    expect(niceScale(10, 0).ticks).toEqual([0, 10]);
  });
});
