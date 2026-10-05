import { describe, expect, it } from 'vitest';
import { FORGE_GUARANTEED, FORGE_MAX, forgeForecast, nextForgeStep } from '@bombfarm/domain/forge';
import {
  INITIAL_FORGE_PLAN,
  clampForgeTarget,
  defaultForgeTarget,
  forgePlanFor,
  forgePlanForecast,
  forgeCollectionBonus,
  forgePlanReducer,
  parseForgeLimit,
} from './use-forge-plan';

describe('defaultForgeTarget', () => {
  it('aims at the last rung that always lands while the piece is below it', () => {
    expect(defaultForgeTarget(0)).toBe(FORGE_GUARANTEED);
    expect(defaultForgeTarget(3)).toBe(FORGE_GUARANTEED);
  });

  it('aims one rung up from the guaranteed rungs onward, and never past the top', () => {
    expect(defaultForgeTarget(8)).toBe(9);
    expect(defaultForgeTarget(12)).toBe(13);
    expect(defaultForgeTarget(FORGE_MAX)).toBe(FORGE_MAX);
  });
});

describe('clampForgeTarget', () => {
  it('holds the target between the next rung and the top', () => {
    expect(clampForgeTarget(3, 8)).toBe(9);
    expect(clampForgeTarget(99, 8)).toBe(FORGE_MAX);
    expect(clampForgeTarget(11, 8)).toBe(11);
  });
});

describe('parseForgeLimit', () => {
  it('keeps the digits and drops everything else', () => {
    expect(parseForgeLimit('120,000')).toBe(120000);
    expect(parseForgeLimit('12a3')).toBe(123);
  });

  it('reads an empty or zero field as no limit', () => {
    expect(parseForgeLimit('')).toBeNull();
    expect(parseForgeLimit('abc')).toBeNull();
    expect(parseForgeLimit('0')).toBeNull();
  });
});

describe('forgePlanFor', () => {
  it('starts a newly picked piece at its own default target and keeps the limits', () => {
    const plan = { ...INITIAL_FORGE_PLAN, itemId: 'a', target: 14, maxGold: 5000, attempts: 3 };
    expect(forgePlanFor(plan, { id: 'b', upgrade: 2 })).toEqual({
      itemId: 'b',
      target: FORGE_GUARANTEED,
      maxGold: 5000,
      attempts: 3,
    });
  });

  it('keeps the chosen target for the same piece, clamped to where the piece now stands', () => {
    const plan = { ...INITIAL_FORGE_PLAN, itemId: 'a', target: 10 };
    expect(forgePlanFor(plan, { id: 'a', upgrade: 8 }).target).toBe(10);
    expect(forgePlanFor(plan, { id: 'a', upgrade: 11 }).target).toBe(12);
  });

  it('has no target without a piece', () => {
    expect(forgePlanFor({ ...INITIAL_FORGE_PLAN, itemId: 'a', target: 12 }, null).itemId).toBeNull();
  });
});

describe('forgePlanReducer', () => {
  it('steps the target within its bounds', () => {
    const start = forgePlanReducer(INITIAL_FORGE_PLAN, { kind: 'step', itemId: 'a', upgrade: 12, delta: 1 });
    expect(start.target).toBe(14);
    const top = forgePlanReducer(start, { kind: 'step', itemId: 'a', upgrade: 12, delta: 1 });
    expect(top.target).toBe(FORGE_MAX);
    expect(forgePlanReducer(top, { kind: 'step', itemId: 'a', upgrade: 12, delta: 1 }).target).toBe(FORGE_MAX);
    const floor = forgePlanReducer(top, { kind: 'step', itemId: 'a', upgrade: 12, delta: -1 });
    expect(floor.target).toBe(14);
  });

  it('steps from the default when the piece changed under the plan', () => {
    const plan = { ...INITIAL_FORGE_PLAN, itemId: 'a', target: 14 };
    expect(forgePlanReducer(plan, { kind: 'step', itemId: 'b', upgrade: 0, delta: 1 }).target).toBe(FORGE_GUARANTEED + 1);
  });

  it('parses the two limits as it stores them', () => {
    const withGold = forgePlanReducer(INITIAL_FORGE_PLAN, { kind: 'maxGold', text: '12,000' });
    expect(withGold.maxGold).toBe(12000);
    const withAttempts = forgePlanReducer(withGold, { kind: 'attempts', text: '' });
    expect(withAttempts).toEqual({ ...INITIAL_FORGE_PLAN, maxGold: 12000, attempts: null });
  });
});

describe('forgePlanForecast from the misses a piece carries', () => {
  it('a piece at +13 with 3 misses forecasts from a 30% roll, not 15%', () => {
    const withMisses = forgePlanForecast(13, 14, 20, 2, 0, 3);
    expect(withMisses?.rolls).toBeCloseTo(forgeForecast(13, 14, 20, 2, 3).rolls, 12);
    expect(withMisses?.rolls).toBeLessThan(forgePlanForecast(13, 14, 20, 2)?.rolls ?? 0);
    expect(nextForgeStep(13, 14, 20, 2, 3)).toMatchObject({ target: 14 });
    const step = nextForgeStep(13, 14, 20, 2, 3);
    expect(step.kind === 'roll' && step.chance).toBeCloseTo(0.3, 12);
  });
});

describe('forgeCollectionBonus', () => {
  it('reads the Collection forge axis as a chance addend, and nothing when it is absent', () => {
    expect(forgeCollectionBonus({ totals: { colecao: { forja: 10 } } })).toBeCloseTo(0.1, 12);
    expect(forgeCollectionBonus({ totals: { colecao: {} } })).toBe(0);
    expect(forgeCollectionBonus({ totals: {} })).toBe(0);
    expect(forgeCollectionBonus(undefined)).toBe(0);
  });

  it('reaches the forecast: a bonus makes the plan cheaper', () => {
    const plain = forgePlanForecast(11, 12, 20, 2);
    expect(forgePlanForecast(11, 12, 20, 2, 0.1)?.rolls).toBeLessThan(plain?.rolls ?? 0);
  });
});

describe('forgePlanForecast', () => {
  it('carries the expected figures and a bad run that costs at least the expectation', () => {
    const forecast = forgePlanForecast(12, 13, 20, 2);
    expect(forecast).not.toBeNull();
    expect(forecast?.rolls).toBeCloseTo(forgeForecast(12, 13, 20, 2).rolls, 12);
    expect(forecast?.gold).toBeCloseTo(forgeForecast(12, 13, 20, 2).gold, 6);
    expect(forecast?.essence).toBeCloseTo(forgeForecast(12, 13, 20, 2).essence, 6);
    expect(forecast?.badRunGold).toBeGreaterThanOrEqual(forecast?.gold ?? Number.POSITIVE_INFINITY);
  });

  it('prices the protected climb from +12 up, and not below it', () => {
    const withScroll = forgePlanForecast(11, 13, 20, 2);
    expect(withScroll?.protected?.gold).toBeCloseTo(forgeForecast(11, 13, 20, 2, 0, { protect: true }).gold, 6);
    expect(withScroll?.protected?.gold).toBeLessThan(withScroll?.gold ?? 0);
    expect(forgePlanForecast(5, 11, 20, 2)?.protected).toBeNull();
  });

  it('counts a chance bonus and a starting miss count in every figure', () => {
    const plain = forgePlanForecast(11, 12, 20, 2);
    expect(forgePlanForecast(11, 12, 20, 2, 0.2)?.rolls).toBeLessThan(plain?.rolls ?? 0);
    expect(forgePlanForecast(11, 12, 20, 2, 0, 3)?.rolls).toBeLessThan(plain?.rolls ?? 0);
  });

  it('prints the same bad-run figure on every call, because the seed is fixed', () => {
    expect(forgePlanForecast(8, 15, 50, 3)?.badRunGold).toBe(forgePlanForecast(8, 15, 50, 3)?.badRunGold);
  });

  it('withholds itself for a level the cost table does not carry, and for a target not above the piece', () => {
    expect(forgePlanForecast(12, 13, 25, 2)).toBeNull();
    expect(forgePlanForecast(13, 13, 20, 2)).toBeNull();
    expect(forgePlanForecast(FORGE_MAX, FORGE_MAX, 20, 2)).toBeNull();
  });
});
