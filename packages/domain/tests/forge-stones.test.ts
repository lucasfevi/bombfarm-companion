import { describe, expect, it } from 'vitest';
import forgeWiki from '@bombfarm/domain/data/forge-wiki.json' with { type: 'json' };
import {
  FORGE_STONE_RARITIES,
  forgeForecast,
  forgeGoldQuantile,
  forgeRollCost,
  forgeRollEssence,
  forgeScrollCost,
  nextForgeStep,
  type ForgeOptions,
} from '@bombfarm/domain/forge';

type Totals = { rolls: number; gold: number; essence: number; stones: number[] };

/**
 * Value iteration over (level, misses) written from the published tables alone — chance, pity,
 * fail level, stone points — so it shares nothing with the exact solve it checks. Misses are
 * capped where every roll is certain; sweeps run until nothing moves.
 */
function iterate(
  from: number,
  target: number,
  level: number,
  rarity: number,
  stones: readonly (number | null)[],
  protect = false,
  bonus = 0,
): Totals {
  const cap = 25;
  const parts = 3 + FORGE_STONE_RARITIES;
  const value = Array.from({ length: target + 1 }, () =>
    Array.from({ length: cap + 1 }, () => new Array<number>(parts).fill(0)),
  );
  for (let sweep = 0; sweep < 200_000; sweep++) {
    let moved = 0;
    for (let upgrade = target - 1; upgrade >= 0; upgrade--) {
      for (let missed = 0; missed <= cap; missed++) {
        const next = upgrade + 1;
        const base = Math.min(1, forgeWiki.chance[next - 1] + forgeWiki.pity_step * missed + bonus);
        const stone = stones[next - 1] ?? null;
        const spent = stone !== null && base < 1;
        const chance = Math.min(1, base + (spent ? forgeWiki.ajudas.pedra_pp[stone] : 0));
        const scrolled = protect && forgeWiki.fail_level[next - 1] < next - 1;
        const failTo = scrolled ? next - 1 : forgeWiki.fail_level[next - 1];
        const added = new Array<number>(parts).fill(0);
        added[0] = 1;
        added[1] = forgeRollCost(level, rarity, next);
        added[2] = forgeRollEssence(level, rarity, next) + (scrolled ? forgeScrollCost(level, rarity, next) : 0);
        if (spent) added[3 + stone] = 1;
        const hit = next < target ? value[next][0] : new Array<number>(parts).fill(0);
        const miss = value[failTo][Math.min(missed + 1, cap)];
        const fresh = added.map((part, c) => part + chance * hit[c] + (1 - chance) * miss[c]);
        moved = Math.max(moved, ...fresh.map((x, c) => Math.abs(x - value[upgrade][missed][c])));
        value[upgrade][missed] = fresh;
      }
    }
    if (moved < 1e-11) break;
  }
  const answer = value[from][0];
  return { rolls: answer[0], gold: answer[1], essence: answer[2], stones: answer.slice(3) };
}

function expectClose(actual: Totals, truth: Totals, label: string) {
  expect(actual.rolls, label).toBeCloseTo(truth.rolls, 6);
  expect(actual.gold / truth.gold, label).toBeCloseTo(1, 9);
  expect(actual.essence / truth.essence, label).toBeCloseTo(1, 9);
  for (let rarity = 0; rarity < FORGE_STONE_RARITIES; rarity++) {
    expect(actual.stones[rarity], `${label} stone ${rarity}`).toBeCloseTo(truth.stones[rarity], 6);
  }
}

const NONE = null;

describe('forgeForecast with stones named per target', () => {
  const cases: { label: string; from: number; target: number; stones: (number | null)[] }[] = [
    { label: 'one range', from: 8, target: 11, stones: [NONE, NONE, NONE, NONE, NONE, NONE, NONE, NONE, 1, 1, 1] },
    {
      label: 'three ranges',
      from: 8,
      target: 13,
      stones: [NONE, NONE, NONE, NONE, NONE, NONE, NONE, NONE, 0, 1, 1, 2, 2],
    },
    {
      label: 'a gap in the middle',
      from: 9,
      target: 13,
      stones: [NONE, NONE, NONE, NONE, NONE, NONE, NONE, NONE, NONE, 3, NONE, NONE, 5],
    },
    { label: 'stones from the very start', from: 0, target: 11, stones: [0, 0, 0, 0, 2, 2, 2, 2, 4, 4, 4] },
  ];

  it.each(cases)('agrees with a value iteration: $label', ({ from, target, stones }) => {
    for (const [protect, bonus] of [[false, 0], [true, 0], [false, 0.1]] as const) {
      const options: ForgeOptions = { stones, protect, bonus };
      const exact = forgeForecast(from, target, 40, 3, 0, options);
      expectClose(exact, iterate(from, target, 40, 3, stones, protect, bonus), JSON.stringify({ protect, bonus }));
    }
  });

  it('counts a stone only on the rarity it names', () => {
    const forecast = forgeForecast(8, 11, 40, 3, 0, {
      stones: [NONE, NONE, NONE, NONE, NONE, NONE, NONE, NONE, 1, 1, 1],
    });
    expect(forecast.stones[1]).toBeGreaterThan(0);
    expect(forecast.stones.filter((_, rarity) => rarity !== 1)).toEqual([0, 0, 0, 0, 0]);
  });

  it('spends one stone per attempt on a rung it cannot make certain', () => {
    const forecast = forgeForecast(13, 14, 40, 3, 0, { stones: new Array<number>(14).fill(0) });
    expect(forecast.stones[0]).toBeGreaterThan(1);
    expect(forecast.stones[0]).toBeLessThanOrEqual(forecast.rolls);
  });

  it('never spends a stone on a step that is certain, and prices the climb as if there were none', () => {
    const named = new Array<number>(4).fill(5);
    const forecast = forgeForecast(0, 4, 10, 0, 0, { stones: named });
    expect(forecast).toEqual(forgeForecast(0, 4, 10, 0));
    expect(forecast.stones).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('a dearer stone saves rolls and is monotone in rarity', () => {
    const rolls = [0, 1, 2, 3, 4, 5].map(
      (rarity) => forgeForecast(11, 13, 40, 3, 0, { stones: new Array<number>(13).fill(rarity) }).rolls,
    );
    for (let i = 1; i < rolls.length; i++) expect(rolls[i]).toBeLessThan(rolls[i - 1]);
  });

  it('keeps stonePp for the first attempt only, and lets a per-target stone take its place', () => {
    const first = forgeForecast(11, 13, 40, 3, 0, { stonePp: 0.6 });
    expect(first.rolls).toBeLessThan(forgeForecast(11, 13, 40, 3).rolls);
    const named = new Array<number | null>(13).fill(null);
    named[11] = 0;
    const both = forgeForecast(11, 13, 40, 3, 0, { stonePp: 0.6, stones: named });
    const only = forgeForecast(11, 13, 40, 3, 0, { stones: named });
    expect(both.rolls).toBeCloseTo(only.rolls, 9);
  });

  it('rejects a rarity that is not a stone', () => {
    expect(() => nextForgeStep(10, 13, 40, 3, 0, { stones: [...new Array<number>(10).fill(0), 6] })).toThrow(
      RangeError,
    );
  });
});

describe('a stone on every attempt', () => {
  it('lifts the chance by its points, capped at certainty, and reports which rarity was spent', () => {
    const stones = new Array<number | null>(15).fill(null);
    stones[13] = 4;
    const roll = nextForgeStep(13, 15, 100, 2, 0, { stones });
    expect(roll).toMatchObject({ target: 14, stoneUsed: true, stone: 4 });
    expect(roll.kind === 'roll' && roll.chance).toBeCloseTo(0.65, 12);
    stones[13] = 5;
    expect(nextForgeStep(13, 15, 100, 2, 18, { stones })).toMatchObject({ chance: 1, stoneUsed: false, stone: null });
    expect(nextForgeStep(13, 15, 100, 2, 0, { stones })).toMatchObject({ chance: 0.75, stoneUsed: true, stone: 5 });
  });
});

function enumeratedQuantile(from: number, target: number, p: number, options: ForgeOptions) {
  const outcomes = new Map<number, number>();
  let live = new Map<string, number>([[`${from}|0|0`, 1]]);
  while (live.size > 0) {
    const next = new Map<string, number>();
    for (const [key, mass] of live) {
      if (mass < 1e-10) continue;
      const [upgrade, missed, gold] = key.split('|').map(Number);
      const step = nextForgeStep(upgrade, target, 20, 2, missed, options);
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

describe('forgeGoldQuantile with stones named per target', () => {
  it('equals the enumerated distribution', () => {
    const stones = new Array<number | null>(12).fill(null);
    stones[10] = 1;
    stones[11] = 2;
    for (const p of [0.5, 0.9]) {
      const exact = forgeGoldQuantile(10, 12, 20, 2, p, 0, { stones });
      const truth = enumeratedQuantile(10, 12, p, { stones });
      expect(Math.abs(exact / truth - 1), `p${p}`).toBeLessThan(0.003);
    }
  });

  it('a stone moves the bad run down', () => {
    const stones = new Array<number | null>(14).fill(null);
    stones[12] = 3;
    stones[13] = 3;
    expect(forgeGoldQuantile(11, 14, 100, 2, 0.9, 0, { stones })).toBeLessThan(
      forgeGoldQuantile(11, 14, 100, 2, 0.9),
    );
  });
});
