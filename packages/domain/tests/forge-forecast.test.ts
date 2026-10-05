import { describe, expect, it } from 'vitest';
import forgeWiki from '@bombfarm/domain/data/forge-wiki.json' with { type: 'json' };
import {
  FORGE_MAX,
  forgeChance,
  forgeFailLevel,
  forgeForecast,
  forgeGoldPercentile,
  forgeRollCost,
  forgeRollEssence,
} from '@bombfarm/domain/forge';

/**
 * Value iteration over (level, misses) written independently of the exact solve it checks: start
 * from zero and sweep until nothing moves. Slow at the top of the ladder, so the cases it runs on
 * stay short.
 */
function iterate(from: number, fails: number, target: number, level: number, rarity: number) {
  const cap = 25;
  const make = () => Array.from({ length: target + 1 }, () => new Array<number>(cap + 1).fill(0));
  const totals = { rolls: make(), gold: make(), essence: make() };
  for (let sweep = 0; sweep < 200_000; sweep++) {
    let moved = 0;
    for (let upgrade = target - 1; upgrade >= 0; upgrade--) {
      for (let missed = 0; missed <= cap; missed++) {
        const next = upgrade + 1;
        const chance = forgeChance(next, missed);
        const failTo = forgeFailLevel(next);
        const failMissed = Math.min(cap, missed + 1);
        const price = { rolls: 1, gold: forgeRollCost(level, rarity, next), essence: forgeRollEssence(level, rarity, next) };
        for (const key of ['rolls', 'gold', 'essence'] as const) {
          const value =
            price[key] + chance * totals[key][next][0] + (1 - chance) * totals[key][failTo][failMissed];
          moved = Math.max(moved, Math.abs(value - totals[key][upgrade][missed]) / Math.max(1, Math.abs(value)));
          totals[key][upgrade][missed] = value;
        }
      }
    }
    if (moved < 1e-12) break;
  }
  return { rolls: totals.rolls[from][fails], gold: totals.gold[from][fails], essence: totals.essence[from][fails] };
}

describe('forgeForecast', () => {
  it('+4 to +5 on a level-10 common is 1.105 rolls: a 90% roll, then 95%, then certain', () => {
    const forecast = forgeForecast(4, 5, 10, 0);
    expect(forecast.rolls).toBeCloseTo(1.105, 10);
    expect(forecast.essence).toBeCloseTo(1.105, 10);
    expect(forecast.gold).toBeCloseTo(1.105 * 1_800, 6);
  });

  it('the guaranteed rungs are certain rolls: +0 to +4 on a level-10 common is 4 rolls and the sum of the four', () => {
    expect(forgeForecast(0, 4, 10, 0)).toEqual({ rolls: 4, gold: 200 + 450 + 800 + 1_250, essence: 4 });
  });

  it('forecasts nothing when the item already sits at or above the target', () => {
    expect(forgeForecast(12, 12, 300, 5)).toEqual({ rolls: 0, gold: 0, essence: 0 });
    expect(forgeForecast(15, 9, 300, 5)).toEqual({ rolls: 0, gold: 0, essence: 0 });
  });

  it('throws for a starting level outside the ladder, a negative miss count or a target above it', () => {
    expect(() => forgeForecast(-1, 15, 300, 5)).toThrow(RangeError);
    expect(() => forgeForecast(16, 15, 300, 5)).toThrow(RangeError);
    expect(() => forgeForecast(8, 15, 300, 5, -1)).toThrow(RangeError);
    expect(() => forgeForecast(8, 16, 300, 5)).toThrow(RangeError);
  });

  it.each([
    [0, 0, 9, 10, 0],
    [8, 0, 12, 100, 2],
    [10, 0, 13, 50, 1],
    [11, 3, 12, 300, 5],
    [9, 7, 13, 20, 4],
  ])('agrees with a value iteration to the fixed point: +%i with %i misses to +%i, level %i rarity %i', (from, fails, target, level, rarity) => {
    const exact = forgeForecast(from, target, level, rarity, fails);
    const reference = iterate(from, fails, target, level, rarity);
    expect(exact.rolls).toBeCloseTo(reference.rolls, 6);
    expect(exact.gold / reference.gold).toBeCloseTo(1, 9);
    expect(exact.essence / reference.essence).toBeCloseTo(1, 9);
  });

  it('a piece already carrying misses is cheaper to finish than a fresh one', () => {
    const fresh = forgeForecast(14, 15, 100, 2, 0);
    const primed = forgeForecast(14, 15, 100, 2, 4);
    expect(primed.rolls).toBeLessThan(fresh.rolls);
    expect(primed.gold).toBeLessThan(fresh.gold);
  });

  it('a climb to +15 stays finite and costs more rolls than any shorter one', () => {
    const top = forgeForecast(0, FORGE_MAX, 300, 5);
    expect(Number.isFinite(top.gold)).toBe(true);
    expect(top.rolls).toBeGreaterThan(forgeForecast(0, 14, 300, 5).rolls);
  });
});

describe('forge options', () => {
  it('a bonus lowers the expected rolls', () => {
    expect(forgeForecast(10, 13, 100, 2, 0, { bonus: 0.1 }).rolls).toBeLessThan(forgeForecast(10, 13, 100, 2).rolls);
  });

  it('a stone helps the one attempt only: +4 to +5 with a +10 stone is a single certain roll', () => {
    expect(forgeForecast(4, 5, 10, 0, 0, { stonePp: 0.1 }).rolls).toBe(1);
  });

  it('a stone that is refused changes nothing', () => {
    expect(forgeForecast(0, 4, 10, 0, 0, { stonePp: 0.6 })).toEqual(forgeForecast(0, 4, 10, 0));
  });

  it('a stone saves less than a bonus on every attempt', () => {
    const plain = forgeForecast(11, 13, 100, 2);
    const stoned = forgeForecast(11, 13, 100, 2, 0, { stonePp: 0.6 });
    const bonus = forgeForecast(11, 13, 100, 2, 0, { bonus: 0.6 });
    expect(stoned.rolls).toBeLessThan(plain.rolls);
    expect(bonus.rolls).toBeLessThan(stoned.rolls);
  });

  it('a stone agrees with simulating it', () => {
    const exact = forgeForecast(11, 12, 100, 2, 0, { stonePp: 0.3 });
    const mean = (runs: number) => {
      let total = 0;
      for (let seed = 1; seed <= runs; seed++) total += forgeGoldPercentile(11, 12, 100, 2, 0.5, seed, 1, 0, { stonePp: 0.3 });
      return total / runs;
    };
    expect(Math.abs(mean(4_000) / exact.gold - 1)).toBeLessThan(0.15);
  });

  it('protecting prices the scroll in essence and costs about the same essence as recovering the drops', () => {
    for (const [from, target] of [[11, 12], [11, 13], [10, 15], [13, 14]] as const) {
      const plain = forgeForecast(from, target, 100, 2);
      const protectedClimb = forgeForecast(from, target, 100, 2, 0, { protect: true });
      expect(protectedClimb.essence / plain.essence, `+${from} to +${target}`).toBeGreaterThan(0.99);
      expect(protectedClimb.essence / plain.essence, `+${from} to +${target}`).toBeLessThan(1.03);
      expect(protectedClimb.gold).toBeLessThan(plain.gold);
      expect(protectedClimb.rolls).toBeLessThan(plain.rolls);
    }
  });

  it('protecting changes nothing below +12', () => {
    expect(forgeForecast(0, 11, 100, 2, 0, { protect: true })).toEqual(forgeForecast(0, 11, 100, 2));
  });
});

describe('forgeGoldPercentile', () => {
  it('is deterministic for a seed and moves with it', () => {
    const first = forgeGoldPercentile(10, 15, 300, 5, 0.9, 42, 2_000);
    const again = forgeGoldPercentile(10, 15, 300, 5, 0.9, 42, 2_000);
    const otherSeed = forgeGoldPercentile(10, 15, 300, 5, 0.9, 43, 2_000);
    expect(again).toBe(first);
    expect(otherSeed).not.toBe(first);
  });

  it('puts the 90th percentile of a risky climb at or above its expected gold', () => {
    const p90 = forgeGoldPercentile(10, 15, 300, 5, 0.9, 7);
    expect(p90).toBeGreaterThanOrEqual(forgeForecast(10, 15, 300, 5).gold);
  });

  it('puts the median of a guaranteed-only climb at exactly its sum', () => {
    expect(forgeGoldPercentile(0, 4, 10, 0, 0.5, 1)).toBe(200 + 450 + 800 + 1_250);
  });

  it('is nearest-rank: p = 0 returns the cheapest run and p = 1 the dearest', () => {
    const cheapest = forgeGoldPercentile(8, 9, 10, 0, 0, 3, 500);
    const dearest = forgeGoldPercentile(8, 9, 10, 0, 1, 3, 500);
    expect(cheapest).toBe(forgeRollCost(10, 0, 9));
    expect(dearest).toBeGreaterThan(cheapest);
    expect(dearest % forgeRollCost(10, 0, 9)).toBe(0);
  });

  it('starts from the miss count it is given', () => {
    expect(forgeGoldPercentile(14, 15, 10, 0, 1, 3, 200, 18)).toBe(forgeRollCost(10, 0, 15));
  });

  it('throws for a percentile outside 0…1 or a run count below one', () => {
    expect(() => forgeGoldPercentile(8, 9, 10, 0, 1.5, 1)).toThrow(RangeError);
    expect(() => forgeGoldPercentile(8, 9, 10, 0, -0.1, 1)).toThrow(RangeError);
    expect(() => forgeGoldPercentile(8, 9, 10, 0, 0.5, 1, 0)).toThrow(RangeError);
  });
});

describe('expected essence matches the published average', () => {
  it('rounds to essencia_media for every item level, rarity and target from +0', () => {
    const mismatches: string[] = [];
    let visited = 0;
    for (const row of forgeWiki.custo_por_nivel) {
      for (const byRarity of row.por_raridade) {
        byRarity.essencia_media.forEach((published, index) => {
          visited += 1;
          const target = index + 1;
          const modelled = forgeForecast(0, target, row.nivel, byRarity.raridade).essence;
          if (Math.round(modelled) !== published) {
            mismatches.push(`level ${row.nivel} rarity ${byRarity.raridade} +${target}: ${modelled} vs ${published}`);
          }
        });
      }
    }
    expect(visited).toBe(2_700);
    expect(mismatches).toEqual([]);
  });
});
