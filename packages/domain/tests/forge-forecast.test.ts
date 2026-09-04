import { describe, expect, it } from 'vitest';
import {
  FORGE_MAX,
  FORGE_SAFE,
  forgeChance,
  forgeForecast,
  forgeGoldPercentile,
  forgeRollCost,
  forgeSafeJumpCost,
} from '@bombfarm/domain/forge';

/**
 * From +8 a +15 climb is a renewal cycle: each pass either reaches the top or falls back to +8
 * (through +0 and a safe jump when the fall is from the last roll), so the expectation is the
 * per-cycle total divided by the per-cycle chance of finishing. Written out independently of the
 * iteration it checks.
 */
function closedFormClimbFromSafe(level: number, rarity: number) {
  let reach = 1;
  let rollsPerCycle = 0;
  let goldPerCycle = 0;
  for (let target = FORGE_SAFE + 1; target <= FORGE_MAX; target++) {
    rollsPerCycle += reach;
    goldPerCycle += reach * forgeRollCost(level, rarity, target);
    reach *= forgeChance(target);
  }
  const fallsFromTop = (reach / forgeChance(FORGE_MAX)) * (1 - forgeChance(FORGE_MAX));
  return {
    rolls: rollsPerCycle / reach,
    safeJumps: fallsFromTop / reach,
    gold: (goldPerCycle + fallsFromTop * forgeSafeJumpCost(level, rarity)) / reach,
  };
}

describe('forgeForecast', () => {
  it('a +15 climb from +8 on a level-300 mythic is 731.984 rolls, 4 safe jumps and 73,405,270 gold in expectation', () => {
    const forecast = forgeForecast(8, 15, 300, 5);
    expect(forecast.rolls).toBeCloseTo(731.984127, 5);
    expect(forecast.safeJumps).toBeCloseTo(4, 8);
    expect(forecast.gold).toBeCloseTo(73_405_270.48, 1);
  });

  it('the +15 climb from +8 agrees with its closed form, so the iteration ran to the fixed point', () => {
    const forecast = forgeForecast(8, 15, 300, 5);
    const exact = closedFormClimbFromSafe(300, 5);
    expect(forecast.rolls).toBeCloseTo(exact.rolls, 6);
    expect(forecast.safeJumps).toBeCloseTo(exact.safeJumps, 8);
    expect(forecast.gold).toBeCloseTo(exact.gold, 2);
  });

  it('a +15 climb from +0 is the same rolls, one safe jump more, and one safe-jump cost more', () => {
    const fromZero = forgeForecast(0, 15, 300, 5);
    const fromSafe = forgeForecast(8, 15, 300, 5);
    expect(fromZero.rolls).toBeCloseTo(fromSafe.rolls, 8);
    expect(fromZero.safeJumps).toBeCloseTo(fromSafe.safeJumps + 1, 8);
    expect(fromZero.gold).toBeCloseTo(fromSafe.gold + forgeSafeJumpCost(300, 5), 2);
    expect(fromZero.gold).toBeCloseTo(73_619_690.48, 1);
  });

  it('a single step from +11 to +12 on a level-300 mythic is 9.02381 rolls and 878,604.29 gold, with no safe jump', () => {
    const forecast = forgeForecast(11, 12, 300, 5);
    expect(forecast.rolls).toBeCloseTo(9.02381, 5);
    expect(forecast.safeJumps).toBe(0);
    expect(forecast.gold).toBeCloseTo(878_604.2857, 3);
  });

  it('+0 to +8 on a level-10 common is no rolls, one safe jump and exactly 14,200 gold', () => {
    expect(forgeForecast(0, 8, 10, 0)).toEqual({ rolls: 0, safeJumps: 1, gold: 14_200 });
  });

  it('+8 to +9 on a level-10 common is 1.25 rolls and 6,250 gold', () => {
    const forecast = forgeForecast(8, 9, 10, 0);
    expect(forecast.rolls).toBeCloseTo(1.25, 10);
    expect(forecast.safeJumps).toBe(0);
    expect(forecast.gold).toBeCloseTo(6_250, 6);
  });

  it('forecasts nothing when the item already sits at or above the target', () => {
    expect(forgeForecast(12, 12, 300, 5)).toEqual({ rolls: 0, safeJumps: 0, gold: 0 });
    expect(forgeForecast(15, 9, 300, 5)).toEqual({ rolls: 0, safeJumps: 0, gold: 0 });
  });

  it('throws for a starting level outside the ladder', () => {
    expect(() => forgeForecast(-1, 15, 300, 5)).toThrow(RangeError);
    expect(() => forgeForecast(16, 15, 300, 5)).toThrow(RangeError);
  });
});

describe('forgeGoldPercentile', () => {
  it('is deterministic for a seed and moves with it', () => {
    const first = forgeGoldPercentile(8, 15, 300, 5, 0.9, 42, 2_000);
    const again = forgeGoldPercentile(8, 15, 300, 5, 0.9, 42, 2_000);
    const otherSeed = forgeGoldPercentile(8, 15, 300, 5, 0.9, 43, 2_000);
    expect(again).toBe(first);
    expect(otherSeed).not.toBe(first);
  });

  it('puts the 90th percentile of a risky +15 climb at or above its expected gold', () => {
    const p90 = forgeGoldPercentile(8, 15, 300, 5, 0.9, 7);
    expect(p90).toBeGreaterThanOrEqual(forgeForecast(8, 15, 300, 5).gold);
  });

  it('puts the median of a safe-only +0 to +8 climb at exactly the safe-jump cost', () => {
    expect(forgeGoldPercentile(0, 8, 10, 0, 0.5, 1)).toBe(forgeSafeJumpCost(10, 0));
  });

  it('is nearest-rank: p = 0 returns the cheapest run and p = 1 the dearest', () => {
    const cheapest = forgeGoldPercentile(8, 9, 10, 0, 0, 3, 500);
    const dearest = forgeGoldPercentile(8, 9, 10, 0, 1, 3, 500);
    expect(cheapest).toBe(forgeRollCost(10, 0, 9));
    expect(dearest).toBeGreaterThan(cheapest);
    expect(dearest % forgeRollCost(10, 0, 9)).toBe(0);
  });

  it('throws for a percentile outside 0…1 or a run count below one', () => {
    expect(() => forgeGoldPercentile(8, 9, 10, 0, 1.5, 1)).toThrow(RangeError);
    expect(() => forgeGoldPercentile(8, 9, 10, 0, -0.1, 1)).toThrow(RangeError);
    expect(() => forgeGoldPercentile(8, 9, 10, 0, 0.5, 1, 0)).toThrow(RangeError);
  });
});
