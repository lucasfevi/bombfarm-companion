/**
 * `solveFarmRespec`'s core: the shape of the result, the non-negative-gain invariant, hero-entry
 * completeness, absolute-target vectors, and the total tie-break comparator.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec, type FarmRespecInput } from '@bombfarm/domain/farm-optimize';
import { compareFarmCandidates, type FarmCandidate } from '@bombfarm/domain/farm-optimize-search';
import { budgetOf, reoptBudget } from '@bombfarm/domain/points-reopt-core';
import type { HeroFarmBasis } from '@bombfarm/domain/farm-rate';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();

describe('the result carries every promised field, present and finite (or legitimately null)', () => {
  it('proposed vectors, recommended phase, objective values, gainPct, respecCostGold, paybackHours', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });

    expect(result.heroes.length).toBeGreaterThan(0);
    for (const hero of result.heroes) {
      expect(Object.keys(hero.proposedPts)).toHaveLength(8);
    }
    expect(Number.isFinite(result.recommendedPhase) || result.recommendedPhase === null).toBe(true);
    expect(Number.isFinite(result.currentObjective)).toBe(true);
    expect(Number.isFinite(result.proposedObjective)).toBe(true);
    expect(Number.isFinite(result.gainPct)).toBe(true);
    expect(Number.isFinite(result.respecCostGold)).toBe(true);
    expect(result.paybackHours === null || Number.isFinite(result.paybackHours)).toBe(true);
  });

  it('paybackHours === respecCostGold / (proposedGoldPerHour - currentGoldPerHour), in HOURS, to 1e-9', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    const deltaGold = result.proposedGoldPerHour - result.currentGoldPerHour;
    expect(deltaGold).toBeGreaterThan(0); // the fixture's gold solve genuinely improves gold/hr.
    expect(result.paybackHours).not.toBeNull();
    expect(result.paybackHours!).toBeCloseTo(result.respecCostGold / deltaGold, 9);
  });
});

describe('proposedObjective >= currentObjective, gainPct >= 0, no exception', () => {
  const objectives: FarmRespecInput['objective'][] = [{ kind: 'gold' }, { kind: 'chests' }, { kind: 'blend', weight: 0.5 }];
  const pools: (readonly string[] | undefined)[] = [undefined, heroes.slice(0, 2).map((h) => h.id), heroes.slice(0, 1).map((h) => h.id)];
  const maxPhases: (number | null)[] = [42, null];

  for (const objective of objectives) {
    for (const pool of pools) {
      for (const mp of maxPhases) {
        it(`objective=${JSON.stringify(objective)} pool=${pool ? pool.length : 'all'} maxPhase=${mp}`, () => {
          expect(() => {
            const result = solveFarmRespec({ heroes, account, objective, enabledHeroIds: pool, maxPhase: mp });
            expect(result.proposedObjective).toBeGreaterThanOrEqual(result.currentObjective);
            expect(result.gainPct).toBeGreaterThanOrEqual(0);
          }).not.toThrow();
        });
      }
    }
  }
});

describe('nothing beats the current build (the fixed point re-solve)', () => {
  it('keptCurrent: true, gainPct: 0, every changed: false, respecCostGold: 0, heroes still lists every enabled hero', () => {
    const first = solveFarmRespec({ heroes, account, maxPhase });
    expect(first.outcome).toBe('improved'); // sanity: the fixture DOES improve on the first solve.

    const respecced: HeroRecord[] = heroes.map((hero) => {
      const entry = first.heroes.find((h) => h.heroId === hero.id);
      return entry ? { ...hero, pts: entry.proposedPts } : hero;
    });
    const second = solveFarmRespec({ heroes: respecced, account, maxPhase });

    expect(second.outcome).toBe('nothingToGain');
    expect(second.keptCurrent).toBe(true);
    expect(second.gainPct).toBe(0);
    expect(second.respecCostGold).toBe(0);
    expect(second.heroes).toHaveLength(heroes.length);
    for (const hero of second.heroes) {
      expect(hero.changed).toBe(false);
    }
  });
});

describe('one entry per enabled hero, including unchanged ones with their own cost', () => {
  it('heroes.length === enabledCount; an unchanged hero still carries a positive respecCostGold; the top-level total sums changed heroes only', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    expect(result.heroes).toHaveLength(heroes.length);

    const unchanged = result.heroes.find((h) => !h.changed);
    expect(unchanged, 'expected at least one unchanged hero on the fixture').toBeDefined();
    expect(unchanged!.respecCostGold).toBeGreaterThan(0);

    const expectedTotal = result.heroes.filter((h) => h.changed).reduce((sum, h) => sum + h.respecCostGold, 0);
    expect(result.respecCostGold).toBe(expectedTotal);
  });
});

describe('every proposedPts is a full 8-key absolute target, within the hero\'s own budget', () => {
  it('all 8 keys present, integer-valued, non-negative, and budgetOf <= reoptBudget(currentPts, level)', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    for (const hero of result.heroes) {
      const keys = Object.keys(hero.proposedPts) as SheetKey[];
      expect(keys.sort()).toEqual(
        ['attack', 'critChance', 'critDmg', 'cdr', 'energy', 'luck', 'penetration', 'speed'].sort(),
      );
      for (const key of keys) {
        expect(Number.isInteger(hero.proposedPts[key])).toBe(true);
        expect(hero.proposedPts[key]).toBeGreaterThanOrEqual(0);
      }
      const budget = reoptBudget(hero.currentPts, hero.level);
      expect(budgetOf(hero.proposedPts)).toBeLessThanOrEqual(budget);
    }
  });
});

describe('the total tie-break comparator, one case per rule', () => {
  function fakeBasis(heroId: string, pts: Partial<Record<SheetKey, number>>): HeroFarmBasis {
    const fullPts: Record<SheetKey, number> = {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
      luck: 0,
      ...pts,
    };
    return { heroId, heroName: heroId, level: 10, pts: fullPts } as unknown as HeroFarmBasis;
  }

  function fakeCandidate(name: string, value: number, assignment: Map<string, Record<SheetKey, number>>): FarmCandidate {
    return { name, assignment, value, pick: null, squad: {} as FarmCandidate['squad'] };
  }

  it('rule 2 — equal value, fewer points moved wins, EVEN AGAINST what rule 4 (lexicographic) alone would pick', () => {
    // Deliberately adversarial to rule 4: a moves 1 point (attack 10->11) and would LOSE the
    // lexicographic tie-break on its own (11 > b's 9 at the first-compared key, 'attack'). b
    // moves 3 points (attack 10->9, energy 10->12) and would WIN lexicographic alone. If rule 2
    // were dropped, both tie on heroesChanged (1 each) and the comparator would fall straight to
    // rule 4 and pick b — the exact regression this case exists to catch.
    const bases = [fakeBasis('h1', { attack: 10, energy: 10 })];
    const a = fakeCandidate('a', 100, new Map([['h1', { ...bases[0].pts, attack: 11 }]])); // 1 point moved
    const b = fakeCandidate('b', 100, new Map([['h1', { ...bases[0].pts, attack: 9, energy: 12 }]])); // 3 points moved
    expect(compareFarmCandidates(a, b, bases)).toBeLessThan(0);
    expect(compareFarmCandidates(b, a, bases)).toBeGreaterThan(0);
  });

  it('rule 3 — equal value, equal points moved, fewer heroes changed wins', () => {
    const bases = [fakeBasis('h1', { attack: 10 }), fakeBasis('h2', { attack: 10 })];
    // a: 2 points moved on ONE hero.
    const a = fakeCandidate('a', 100, new Map([['h1', { ...bases[0].pts, attack: 12 }]]));
    // b: 1 point moved on EACH of two heroes — same total (2), more heroes touched.
    const b = fakeCandidate(
      'b',
      100,
      new Map([
        ['h1', { ...bases[0].pts, attack: 11 }],
        ['h2', { ...bases[1].pts, attack: 11 }],
      ]),
    );
    expect(compareFarmCandidates(a, b, bases)).toBeLessThan(0);
    expect(compareFarmCandidates(b, a, bases)).toBeGreaterThan(0);
  });

  it('rule 4 — equal value, equal points moved, equal heroes changed, lexicographic by (heroId, REOPT_KEYS order) wins', () => {
    const bases = [fakeBasis('h1', { attack: 10, energy: 10 }), fakeBasis('h2', { attack: 10, energy: 10 })];
    // a moves 1 attack->energy on h1 (the lexicographically FIRST hero id).
    const a = fakeCandidate('a', 100, new Map([['h1', { ...bases[0].pts, attack: 9, energy: 11 }]]));
    // b makes the identical shaped move but on h2 instead.
    const b = fakeCandidate('b', 100, new Map([['h2', { ...bases[1].pts, attack: 9, energy: 11 }]]));
    // At h1 (sorted first), a's attack is 9 (moved) vs b's h1 default 10 (unmoved) — smaller wins.
    expect(compareFarmCandidates(a, b, bases)).toBeLessThan(0);
    expect(compareFarmCandidates(b, a, bases)).toBeGreaterThan(0);
  });

  it('all four rules equal ⇒ the assignments are proven identical', () => {
    const bases = [fakeBasis('h1', { attack: 10, energy: 5 })];
    const sharedVector = { ...bases[0].pts, attack: 8, energy: 7 };
    const a = fakeCandidate('a', 100, new Map([['h1', { ...sharedVector }]]));
    const b = fakeCandidate('b', 100, new Map([['h1', { ...sharedVector }]]));
    expect(compareFarmCandidates(a, b, bases)).toBe(0);
    expect(a.assignment.get('h1')).toEqual(b.assignment.get('h1'));
  });
});
