import { describe, expect, it } from 'vitest';
import { FORGE_CHART_HEIGHT, forgeChartGeometry, forgeChartWindow, type ForgeChartStep } from './forge-chart-geometry';

const WIDTH = 560;

const STEPS: ForgeChartStep[] = [
  { attempt: 1, to: 9, outcome: 'success', kind: 'roll' },
  { attempt: 2, to: 10, outcome: 'success', kind: 'roll' },
  { attempt: 3, to: 8, outcome: 'fail', kind: 'roll' },
];

function climb(length: number, from = 1): ForgeChartStep[] {
  return Array.from({ length }, (_, index) => ({ attempt: from + index, to: 8 + (index % 4), outcome: 'success', kind: 'roll' }));
}

function geometry(steps: readonly ForgeChartStep[], window: number, start = 8, target = 12) {
  return forgeChartGeometry({ width: WIDTH, window, start, target, steps });
}

describe('forgeChartWindow', () => {
  it('holds more attempts on a wider chart, between a floor and a ceiling', () => {
    expect(forgeChartWindow(400)).toBe(30);
    expect(forgeChartWindow(800)).toBeGreaterThan(forgeChartWindow(400));
    expect(forgeChartWindow(120)).toBe(24);
    expect(forgeChartWindow(0)).toBe(24);
    expect(forgeChartWindow(4_000)).toBe(90);
  });
});

describe('forgeChartGeometry', () => {
  it('draws the climb as horizontal-then-vertical segments, never a diagonal', () => {
    const chart = geometry(STEPS, 30);
    expect(chart.path).toMatch(/^M[\d.]+ [\d.]+( H[\d.]+ V[\d.]+){3}$/);
    const start = /^M([\d.]+) ([\d.]+)/.exec(chart.path);
    expect(Number(start?.[1])).toBe(chart.left);
  });

  it('puts one point per call at the level the server returned, coloured by its outcome', () => {
    const chart = geometry(STEPS, 30);
    expect(chart.points.map((point) => [point.attempt, point.outcome])).toEqual([
      [1, 'success'],
      [2, 'success'],
      [3, 'fail'],
    ]);
    const [first, second, third] = chart.points;
    expect(first && second && third).toBeTruthy();
    if (!first || !second || !third) return;
    expect(second.y).toBeLessThan(first.y);
    expect(third.y).toBeGreaterThan(second.y);
    expect(third.x).toBeGreaterThan(second.x);
  });

  it('marks the safe floor and the target as horizontal guides inside the level range', () => {
    const chart = geometry(STEPS, 30);
    expect(chart.floor).toEqual({ y: chart.axisY, level: 8 });
    expect(chart.target.level).toBe(12);
    expect(chart.target.y).toBeLessThan(chart.floor?.y ?? 0);
    expect(geometry([], 30, 13, 15).floor).toBeNull();
  });

  it('with the run shorter than the window, draws the whole run and never an axis shorter than ten', () => {
    const chart = geometry(STEPS, 30);
    expect(chart.points).toHaveLength(3);
    expect(chart.ticks.map((tick) => tick.attempt)).toEqual([0, 10]);
    expect(chart.points[2]?.x).toBeLessThan(chart.right);
    const ten = geometry(climb(10), 30);
    expect(ten.points[9]?.x).toBe(ten.right);
  });

  it('with the run longer than the window, keeps the last N attempts and drops the rest', () => {
    const chart = geometry(climb(91), 45);
    expect(chart.points).toHaveLength(45);
    expect(chart.points[0]?.attempt).toBe(47);
    expect(chart.points[44]?.attempt).toBe(91);
    expect(chart.points[44]?.x).toBe(chart.right);
  });

  it('enters the window at the level the piece stood on before its first attempt, not at a gap', () => {
    const steps: ForgeChartStep[] = [
      { attempt: 1, to: 9, outcome: 'success', kind: 'roll' },
      { attempt: 2, to: 10, outcome: 'success', kind: 'roll' },
      { attempt: 3, to: 11, outcome: 'success', kind: 'roll' },
    ];
    const chart = forgeChartGeometry({ width: WIDTH, window: 2, start: 8, target: 12, steps });
    const entry = /^M([\d.]+) ([\d.]+)/.exec(chart.path);
    expect(chart.points.map((point) => point.attempt)).toEqual([2, 3]);
    expect(Number(entry?.[1])).toBe(chart.left);
    expect(Number(entry?.[2])).toBe(chart.axisY);
    expect(chart.points[0]?.y).toBeLessThan(chart.axisY);
  });

  it('labels the axis with the real attempt numbers the window holds', () => {
    expect(geometry(climb(91), 45).ticks.map((tick) => tick.attempt)).toEqual([50, 60, 70, 80, 90]);
    expect(geometry(climb(25), 45).ticks.map((tick) => tick.attempt)).toEqual([0, 10, 20]);
  });

  it('spaces ticks so their labels cannot collide, however narrow the chart', () => {
    const narrow = forgeChartGeometry({ width: 100, window: 40, start: 8, target: 12, steps: climb(40) });
    const gaps = narrow.ticks.slice(1).map((tick, index) => tick.x - (narrow.ticks[index]?.x ?? 0));
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(28);
  });

  it('shrinks the marks and thins the line as the window fills', () => {
    const few = geometry(climb(8), 45);
    const many = geometry(climb(91), 45);
    expect(many.markRadius).toBeLessThan(few.markRadius);
    expect(many.lineWidth).toBeLessThan(few.lineWidth);
    expect(many.markRadius * 2).toBeLessThan((many.right - many.left) / 45);
  });

  it('draws a run of one attempt as a single mark on a full-length axis', () => {
    const chart = forgeChartGeometry({ width: WIDTH, window: 45, start: 0, target: 15, steps: [{ attempt: 1, to: 15, outcome: 'critical', kind: 'roll' }] });
    expect(chart.points).toHaveLength(1);
    expect(chart.points[0]?.attempt).toBe(1);
    expect(chart.ticks.map((tick) => tick.attempt)).toEqual([0, 10]);
    expect(chart.points[0]?.x).toBeLessThan(chart.right);
  });

  it('holds the pending roll a slot past the last mark, at the level the piece stands on now', () => {
    const chart = forgeChartGeometry({ width: WIDTH, window: 30, start: 8, target: 12, steps: STEPS, pending: true });
    const last = chart.points[2];
    expect(last).toBeTruthy();
    if (!last || !chart.ghost) throw new Error('expected a last point and a ghost');
    expect(chart.ghost.attempt).toBe(4);
    expect(chart.ghost.y).toBe(last.y);
    expect(chart.ghost.fromX).toBe(last.x);
    expect(chart.ghost.x).toBeGreaterThan(last.x);
  });

  it('holds the very first roll of a run at the level the climb starts from, with nothing drawn yet', () => {
    const chart = forgeChartGeometry({ width: WIDTH, window: 30, start: 8, target: 12, steps: [], pending: true });
    expect(chart.points).toHaveLength(0);
    if (!chart.ghost) throw new Error('expected a ghost');
    expect(chart.ghost.attempt).toBe(1);
    expect(chart.ghost.y).toBe(chart.axisY);
    expect(chart.ghost.fromX).toBe(chart.left);
    expect(chart.ghost.x).toBeGreaterThan(chart.left);
  });

  it('reserves the pending roll its own slot, so the mark that fills it lands inside the box', () => {
    const full = forgeChartGeometry({ width: WIDTH, window: 45, start: 8, target: 12, steps: climb(45), pending: true });
    if (!full.ghost) throw new Error('expected a ghost');
    expect(full.points).toHaveLength(45);
    expect(full.ghost.x).toBe(full.right);
    expect(full.points[44]?.x).toBeLessThan(full.right);
  });

  it('draws no ghost with no roll pending, whether or not the run has rolled yet', () => {
    expect(geometry(STEPS, 30).ghost).toBeNull();
    expect(geometry([], 30).ghost).toBeNull();
  });

  it('keeps every coordinate inside the measured box', () => {
    const chart = forgeChartGeometry({ width: WIDTH, window: 45, start: 0, target: 15, steps: climb(91) });
    for (const point of chart.points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(WIDTH);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(FORGE_CHART_HEIGHT);
    }
  });
});
