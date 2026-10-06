import { describe, expect, it } from 'vitest';
import forgeWiki from '@bombfarm/domain/data/forge-wiki.json' with { type: 'json' };
import {
  FORGE_MAX,
  forgeChance,
  forgeFailLevel,
  forgeForecast,
  forgeGoldQuantile,
  nextForgeStep,
  type ForgeOptions,
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

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** The simulation the exact quantile replaced, kept as the reference it must agree with. */
function simulatedQuantile(
  from: number,
  target: number,
  level: number,
  rarity: number,
  p: number,
  fails: number,
  options: ForgeOptions,
  runs = 8_000,
): number {
  const random = seededRandom(12345);
  const totals = new Float64Array(runs);
  for (let run = 0; run < runs; run++) {
    let upgrade = from;
    let missed = fails;
    let gold = 0;
    let first = true;
    while (upgrade < target) {
      const step = nextForgeStep(upgrade, target, level, rarity, missed, first ? options : { ...options, stonePp: 0 });
      if (step.kind !== 'roll') break;
      first = false;
      gold += step.cost;
      if (random() < step.chance) {
        upgrade = step.target;
        missed = 0;
      } else {
        upgrade = step.failTo;
        missed += 1;
      }
    }
    totals[run] = gold;
  }
  totals.sort();
  return totals[Math.max(1, Math.ceil(p * runs)) - 1];
}

/** Every outcome of a short climb, enumerated roll by roll with its exact gold, until the mass left is negligible. */
function enumeratedQuantile(from: number, target: number, level: number, rarity: number, p: number, fails: number) {
  const outcomes = new Map<number, number>();
  let live = new Map<string, number>([[`${from}|${fails}|0`, 1]]);
  while (live.size > 0) {
    const next = new Map<string, number>();
    for (const [key, mass] of live) {
      if (mass < 1e-10) continue;
      const [upgrade, missed, gold] = key.split('|').map(Number);
      const step = nextForgeStep(upgrade, target, level, rarity, missed);
      if (step.kind !== 'roll') continue;
      const spent = gold + step.cost;
      const keys: [string, number][] = [
        [step.target >= target ? '' : `${step.target}|0|${spent}`, mass * step.chance],
        [`${step.failTo}|${missed + 1}|${spent}`, mass * (1 - step.chance)],
      ];
      for (const [nextKey, share] of keys) {
        if (share === 0) continue;
        if (nextKey === '') outcomes.set(spent, (outcomes.get(spent) ?? 0) + share);
        else next.set(nextKey, (next.get(nextKey) ?? 0) + share);
      }
    }
    live = next;
  }
  let cumulative = 0;
  for (const gold of [...outcomes.keys()].sort((x, y) => x - y)) {
    cumulative += outcomes.get(gold) ?? 0;
    if (cumulative >= p - 1e-7) return gold;
  }
  return Number.NaN;
}

describe('forgeGoldQuantile', () => {
  it('equals the enumerated distribution on short climbs', () => {
    for (const [from, target, fails] of [[11, 12, 0], [11, 12, 3], [10, 12, 0]] as const) {
      for (const p of [0.5, 0.9]) {
        const exact = forgeGoldQuantile(from, target, 20, 2, p, fails);
        const truth = enumeratedQuantile(from, target, 20, 2, p, fails);
        expect(Math.abs(exact / truth - 1), `+${from} to +${target}, ${fails} misses, p${p}`).toBeLessThan(0.003);
      }
    }
  });

  it('agrees with the simulation within its sampling error across a grid', () => {
    for (const [level, rarity] of [[20, 0], [300, 5]] as const) {
      for (const [from, target] of [[0, 4], [8, 12], [11, 13], [11, 14]] as const) {
        for (const options of [{}, { protect: true }, { stonePp: 0.3 }, { bonus: 0.1 }] as ForgeOptions[]) {
          const exact = forgeGoldQuantile(from, target, level, rarity, 0.9, 0, options);
          const simulated = simulatedQuantile(from, target, level, rarity, 0.9, 0, options);
          expect(
            Math.abs(exact / simulated - 1),
            `L${level} r${rarity} +${from} to +${target} ${JSON.stringify(options)}`,
          ).toBeLessThan(0.06);
        }
      }
    }
  });

  it('is monotone in p and starts from the miss count it is given', () => {
    const quartile = forgeGoldQuantile(11, 14, 100, 2, 0.25);
    const median = forgeGoldQuantile(11, 14, 100, 2, 0.5);
    const bad = forgeGoldQuantile(11, 14, 100, 2, 0.9);
    expect(quartile).toBeLessThan(median);
    expect(median).toBeLessThan(bad);
    expect(forgeGoldQuantile(11, 14, 100, 2, 0.9, 6)).toBeLessThan(bad);
  });

  it('puts the 90th percentile of a risky climb at or above its expected gold', () => {
    expect(forgeGoldQuantile(10, 15, 300, 5, 0.9)).toBeGreaterThanOrEqual(forgeForecast(10, 15, 300, 5).gold);
  });

  it('puts the median of a guaranteed-only climb at exactly its sum', () => {
    expect(forgeGoldQuantile(0, 4, 10, 0, 0.5)).toBeCloseTo(200 + 450 + 800 + 1_250, 6);
  });

  it('p = 0 is the cheapest run and p = 1 the dearest it can reach', () => {
    const cost = forgeRollCost(10, 0, 9);
    expect(forgeGoldQuantile(8, 9, 10, 0, 0)).toBeCloseTo(cost, 6);
    expect(forgeGoldQuantile(8, 9, 10, 0, 0.999999)).toBeGreaterThan(cost);
  });

  it('starts from the miss count it is given', () => {
    expect(forgeGoldQuantile(14, 15, 10, 0, 1, 18)).toBeCloseTo(forgeRollCost(10, 0, 15), 6);
  });

  it('prices nothing when there is nothing to climb', () => {
    expect(forgeGoldQuantile(12, 12, 10, 0, 0.9)).toBe(0);
  });

  it('throws for a percentile outside 0…1', () => {
    expect(() => forgeGoldQuantile(8, 9, 10, 0, 1.5)).toThrow(RangeError);
    expect(() => forgeGoldQuantile(8, 9, 10, 0, -0.1)).toThrow(RangeError);
  });

  it('stays cheap at the top of the ladder: a +15 climb is read in well under a quarter second', () => {
    const started = performance.now();
    forgeGoldQuantile(8, 15, 300, 5, 0.9);
    expect(performance.now() - started).toBeLessThan(250);
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
