import { describe, expect, it } from 'vitest';
import { FORGE_CHART_BOX, forgeChartGeometry, type ForgeChartStep } from './forge-chart-geometry';

const STEPS: ForgeChartStep[] = [
  { attempt: 1, to: 9, outcome: 'success', kind: 'roll' },
  { attempt: 2, to: 10, outcome: 'success', kind: 'roll' },
  { attempt: 3, to: 8, outcome: 'fail', kind: 'roll' },
];

describe('forgeChartGeometry', () => {
  it('draws the climb as horizontal-then-vertical segments, never a diagonal', () => {
    const geometry = forgeChartGeometry(8, 12, STEPS);
    expect(geometry.path).toMatch(/^M[\d.]+ [\d.]+( H[\d.]+ V[\d.]+){3}$/);
    const start = /^M([\d.]+) ([\d.]+)/.exec(geometry.path);
    expect(Number(start?.[1])).toBe(geometry.left);
  });

  it('puts one point per call at the level the server returned, coloured by its outcome', () => {
    const geometry = forgeChartGeometry(8, 12, STEPS);
    expect(geometry.points.map((point) => [point.attempt, point.outcome])).toEqual([
      [1, 'success'],
      [2, 'success'],
      [3, 'fail'],
    ]);
    const [first, second, third] = geometry.points;
    expect(first && second && third).toBeTruthy();
    if (!first || !second || !third) return;
    expect(second.y).toBeLessThan(first.y);
    expect(third.y).toBeGreaterThan(second.y);
    expect(third.x).toBeGreaterThan(second.x);
  });

  it('marks the safe floor and the target as horizontal guides inside the level range', () => {
    const geometry = forgeChartGeometry(8, 12, STEPS);
    expect(geometry.floor).toEqual({ y: geometry.axisY, level: 8 });
    expect(geometry.target.level).toBe(12);
    expect(geometry.target.y).toBeLessThan(geometry.floor?.y ?? 0);
    expect(forgeChartGeometry(13, 15, []).floor).toBeNull();
  });

  it('ticks the attempt axis every ten calls, and never draws it shorter than ten', () => {
    expect(forgeChartGeometry(8, 12, STEPS).ticks.map((tick) => tick.attempt)).toEqual([0, 10]);
    const long = Array.from({ length: 25 }, (_, index) => ({ attempt: index + 1, to: 9, outcome: 'success', kind: 'roll' }) as const);
    const geometry = forgeChartGeometry(8, 12, long);
    expect(geometry.ticks.map((tick) => tick.attempt)).toEqual([0, 10, 20]);
    expect(geometry.points[24]?.x).toBe(geometry.right);
  });

  it('keeps every coordinate inside the fixed box', () => {
    const geometry = forgeChartGeometry(0, 15, [{ attempt: 1, to: 15, outcome: 'critical', kind: 'roll' }]);
    for (const point of geometry.points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(FORGE_CHART_BOX.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(FORGE_CHART_BOX.height);
    }
  });
});
