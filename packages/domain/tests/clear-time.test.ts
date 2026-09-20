import { describe, expect, it } from 'vitest';
import {
  expectedHitsToKill,
  simulateClear,
  FIRST_KILL_SEC,
  UNCLEARABLE,
  type ClearHero,
  type ClearPropType,
} from '../src/model/clear-time';
import { WIKI_PROPS } from '../src/phase-wiki';

/** A prop mix at a stone HP, the wiki's spawn weights. */
function mixAt(stoneHp: number): ClearPropType[] {
  return WIKI_PROPS.map((prop) => ({ hp: stoneHp * prop.hpMult, weight: prop.weight }));
}

function hero(overrides: Partial<ClearHero> = {}): ClearHero {
  return {
    presence: 0.9,
    fuseSecs: 1.85,
    walkSpeedCells: 2.8,
    blastCells: 13,
    hitNoCrit: 200_000,
    critChance: 0.4,
    critMult: 7,
    ...overrides,
  };
}

describe('expectedHitsToKill rolls the crit per hit', () => {
  it('a prop the crit one-shots but the normal hit does not needs more than one hit on average', () => {
    // 289k bush, 180k normal hit, 42% crits of 7×: one hit kills only when it crits.
    const hits = expectedHitsToKill(289_000, 180_000, 0.42, 7.02);
    expect(hits).toBeGreaterThan(1.5);
    expect(hits).toBeLessThan(1.65);
    // The crit-averaged hit (610k) would call this a one-shot.
    expect(Math.ceil(289_000 / (180_000 * (1 + 0.42 * 6.02)))).toBe(1);
  });

  it('without crits it is the plain ceiling', () => {
    expect(expectedHitsToKill(5, 1, 0, 7)).toBe(5);
    expect(expectedHitsToKill(4.5, 1, 0, 7)).toBe(5);
    expect(expectedHitsToKill(1, 1, 0, 7)).toBe(1);
  });

  it('with certain crits it is the ceiling over the crit', () => {
    expect(expectedHitsToKill(20, 1, 1, 7)).toBe(3);
  });

  it('is exactly one when even the normal hit one-shots, and zero for a dead prop', () => {
    expect(expectedHitsToKill(100, 100, 0.5, 7)).toBe(1);
    expect(expectedHitsToKill(0, 100, 0.5, 7)).toBe(0);
  });

  it('is infinite when the hit is not positive', () => {
    expect(expectedHitsToKill(100, 0, 0.5, 7)).toBe(Infinity);
    expect(expectedHitsToKill(100, Number.NaN, 0.5, 7)).toBe(Infinity);
  });

  it('agrees with a Monte Carlo roll to within its sampling error', () => {
    const hp = 1_000;
    const hit = 120;
    const p = 0.35;
    const mult = 4;
    let seed = 12345;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const trials = 40_000;
    let total = 0;
    for (let t = 0; t < trials; t++) {
      let dealt = 0;
      let hits = 0;
      while (dealt < hp) {
        dealt += random() < p ? hit * mult : hit;
        hits += 1;
      }
      total += hits;
    }
    const simulated = total / trials;
    expect(Math.abs(expectedHitsToKill(hp, hit, p, mult) - simulated)).toBeLessThan(0.05);
  });

  it('is monotone: more HP never needs fewer hits, a bigger hit never needs more', () => {
    let previous = 0;
    for (let hp = 100; hp <= 5_000; hp += 100) {
      const hits = expectedHitsToKill(hp, 130, 0.3, 5);
      expect(hits).toBeGreaterThanOrEqual(previous);
      previous = hits;
    }
    previous = Infinity;
    for (let hit = 50; hit <= 3_000; hit += 50) {
      const hits = expectedHitsToKill(2_000, hit, 0.3, 5);
      expect(hits).toBeLessThanOrEqual(previous + 1e-9);
      previous = hits;
    }
  });

  it('converges to the crit-averaged reading when many hits are needed, from above', () => {
    // The last hit overshoots the HP, so the exact expectation sits a little above HP / E[hit]
    // and the gap shrinks as the hit count grows.
    const exact = expectedHitsToKill(40 * 130, 130, 0.3, 5);
    const averaged = (40 * 130) / (130 * (1 + 0.3 * 4));
    expect(exact).toBeGreaterThan(averaged);
    expect(exact / averaged - 1).toBeLessThan(0.05);
    const exactFar = expectedHitsToKill(58 * 130, 130, 0.3, 5);
    const averagedFar = (58 * 130) / (130 * (1 + 0.3 * 4));
    expect(exactFar / averagedFar - 1).toBeLessThan(exact / averaged - 1);
  });
});

describe('simulateClear', () => {
  it('a stronger squad clears faster and lands fewer hits per kill', () => {
    const props = mixAt(525_000);
    const weak = simulateClear([hero({ hitNoCrit: 60_000 })], props, 100);
    const strong = simulateClear([hero({ hitNoCrit: 600_000 })], props, 100);
    expect(strong.clearSecs).toBeLessThan(weak.clearSecs);
    expect(strong.expectedHtk).toBeLessThan(weak.expectedHtk);
    expect(strong.expectedHtk).toBeGreaterThanOrEqual(1);
  });

  it('more heroes clear faster, with diminishing returns on the last props', () => {
    const props = mixAt(525_000);
    const one = simulateClear([hero()], props, 100).clearSecs;
    const four = simulateClear(Array.from({ length: 4 }, () => hero()), props, 100).clearSecs;
    const nine = simulateClear(Array.from({ length: 9 }, () => hero()), props, 100).clearSecs;
    expect(four).toBeLessThan(one);
    expect(nine).toBeLessThan(four);
    expect(one / four).toBeGreaterThan(nine / four);
  });

  it('doubling the hit does not halve the clear: the head and the starved tail do not scale with damage', () => {
    const props = mixAt(525_000);
    const squad = Array.from({ length: 9 }, () => hero({ hitNoCrit: 100_000 }));
    const base = simulateClear(squad, props, 100).clearSecs;
    const doubled = simulateClear(
      squad.map((h) => ({ ...h, hitNoCrit: 200_000 })),
      props,
      100,
    ).clearSecs;
    expect(doubled).toBeLessThan(base);
    expect(doubled / base).toBeGreaterThan(0.55);
  });

  it('is monotone in the hit: a bigger hit never lengthens the clear, however many prop types', () => {
    const props = mixAt(1_000);
    for (const [w, cells, p, m] of [[1.9, 5, 0.07, 1.45], [2.8, 13, 0.4, 7], [2.5, 13, 0.3, 4.8]] as const) {
      for (const count of [1, 5, 9]) {
        let previous = Infinity;
        for (let hit = 200; hit <= 20_000; hit += 40) {
          const squad = Array.from({ length: count }, () => hero({ walkSpeedCells: w, blastCells: cells, critChance: p, critMult: m, hitNoCrit: hit }));
          const clear = simulateClear(squad, props, 100).clearSecs;
          expect(clear).toBeLessThanOrEqual(previous * (1 + 1e-9));
          previous = clear;
        }
      }
    }
  });

  it('a squad that cannot damage anything never clears', () => {
    const props = mixAt(525_000);
    expect(simulateClear([], props, 100)).toBe(UNCLEARABLE);
    for (const squad of [[hero({ hitNoCrit: 0 })], [hero({ presence: 0 })]]) {
      const result = simulateClear(squad, props, 100);
      expect(result.clearSecs).toBe(Infinity);
      expect(result.expectedHtk).toBe(Infinity);
      expect(result.killShareByHero).toEqual([0]);
    }
  });

  it('kill shares follow the hit: sum to one, and the harder hitter takes the larger share', () => {
    const props = mixAt(525_000);
    const result = simulateClear([hero({ hitNoCrit: 100_000 }), hero({ hitNoCrit: 400_000 }), hero({ presence: 0 })], props, 100);
    expect(result.killShareByHero).toHaveLength(3);
    expect(result.killShareByHero[0] + result.killShareByHero[1]).toBeCloseTo(1, 12);
    expect(result.killShareByHero[2]).toBe(0);
    expect(result.killShareByHero[1]).toBeGreaterThan(result.killShareByHero[0]);
  });

  it('an empty map costs only the head', () => {
    expect(simulateClear([hero()], mixAt(525_000), 0).clearSecs).toBe(FIRST_KILL_SEC);
  });

  it('a hero absent from the field contributes nothing', () => {
    const props = mixAt(525_000);
    const withGhost = simulateClear([hero(), hero({ presence: 0 })], props, 100);
    const alone = simulateClear([hero()], props, 100);
    expect(withGhost.clearSecs).toBe(alone.clearSecs);
  });

  it('is deterministic and finite for a full board sweep of prop HPs', () => {
    const squad = Array.from({ length: 9 }, () => hero());
    for (let phase = 1; phase <= 600; phase += 37) {
      const props = mixAt(1_000 * Math.pow(1.02, phase));
      const a = simulateClear(squad, props, 100);
      const b = simulateClear(squad, props, 100);
      expect(a).toEqual(b);
      expect(Number.isFinite(a.clearSecs)).toBe(true);
      expect(a.clearSecs).toBeGreaterThan(FIRST_KILL_SEC);
    }
  });

  it('prices 600 rows of a nine-hero squad in well under a second', () => {
    const squad = Array.from({ length: 9 }, () => hero());
    const started = performance.now();
    for (let phase = 1; phase <= 600; phase++) {
      simulateClear(squad, mixAt(1_000 * Math.pow(1.02, phase)), 100);
    }
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
