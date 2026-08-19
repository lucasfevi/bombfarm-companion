/**
 * Determinism (deep-equal solves, input-order independence, locale independence), the fixed
 * point, frozen luck, and a re-assertion of the non-negative-gain invariant after the round trip.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec, type FarmRespecInput } from '@bombfarm/domain/farm-optimize';
import { compareFarmCandidates, type FarmCandidate } from '@bombfarm/domain/farm-optimize-search';
import type { HeroFarmBasis } from '@bombfarm/domain/farm-rate';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const OBJECTIVES: FarmRespecInput['objective'][] = [{ kind: 'gold' }, { kind: 'chests' }, { kind: 'blend', weight: 0.5 }];

describe('two solves on deep-equal, non-identical inputs are deep-equal, under all three objectives', () => {
  for (const objective of OBJECTIVES) {
    it(`objective=${JSON.stringify(objective)}`, () => {
      const first = loadFarmRateFixture();
      const second = loadFarmRateFixture();
      expect(first.heroes).not.toBe(second.heroes); // rebuilt, not reused — deep-equal, not identity-equal.
      expect(first.heroes).toEqual(second.heroes);

      const resultA = solveFarmRespec({ heroes: first.heroes, account: first.account, objective, maxPhase: first.maxPhase });
      const resultB = solveFarmRespec({ heroes: second.heroes, account: second.account, objective, maxPhase: second.maxPhase });
      expect(resultB).toEqual(resultA);
      // Explicitly re-asserted on the plateau field too, per the task's own emphasis — even
      // though T5 always reports it as null, a future T8 regression must still be caught here.
      expect(resultB.plateau).toEqual(resultA.plateau);
    });
  }
});

describe('input-order independence', () => {
  const { heroes, account, maxPhase } = loadFarmRateFixture();
  const forward = solveFarmRespec({ heroes, account, maxPhase });
  const reversedHeroes = [...heroes].reverse();
  const reversedIds = heroes.map((h) => h.id).reverse();
  const backward = solveFarmRespec({ heroes: reversedHeroes, account, maxPhase, enabledHeroIds: reversedIds });

  it('reversing heroes[] and enabledHeroIds[] leaves every hero\'s proposedPts unchanged', () => {
    expect(backward.heroes).toHaveLength(forward.heroes.length);
    for (const entry of forward.heroes) {
      const match = backward.heroes.find((h) => h.heroId === entry.heroId);
      expect(match, `hero ${entry.heroId} missing from the reversed-order result`).toBeDefined();
      expect(match!.proposedPts).toEqual(entry.proposedPts);
    }
  });

  it('reversing heroes[] and enabledHeroIds[] leaves recommendedPhase, gainPct and respecCostGold identical', () => {
    expect(backward.recommendedPhase).toBe(forward.recommendedPhase);
    // gainPct is a ULP-level exception, not a semantic one: it is derived from a SUM over heroes
    // (proposedObjective/currentObjective), and IEEE 754 addition is not associative, so summing
    // the same hero contributions in a different order can move the last couple of bits. Every
    // input to that sum is already proven order-independent above (each hero's own proposedPts
    // is bit-identical forward vs backward) — this is float summation order, not the solver
    // picking a different answer. Surfaced by issue #132's crit/cdr revert changing which digits
    // the fixture's numbers carry; pre-existing in the summation, not introduced by the revert.
    expect(backward.gainPct).toBeCloseTo(forward.gainPct, 9);
    expect(backward.respecCostGold).toBe(forward.respecCostGold);
  });
});

describe('determinism holds on a narrower pool too', () => {
  it('two solves on the same 2-hero pool, rebuilt independently, are deep-equal', () => {
    const first = loadFarmRateFixture();
    const second = loadFarmRateFixture();
    const twoIds = first.heroes.slice(0, 2).map((h) => h.id);

    const resultA = solveFarmRespec({ heroes: first.heroes, account: first.account, maxPhase: first.maxPhase, enabledHeroIds: twoIds });
    const resultB = solveFarmRespec({ heroes: second.heroes, account: second.account, maxPhase: second.maxPhase, enabledHeroIds: twoIds });
    expect(resultB).toEqual(resultA);
  });
});

describe('locale independence: the lexicographic tie-break uses plain <, not localeCompare', () => {
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

  it("ids where localeCompare and plain < disagree ('á-hero' vs 'b-hero') resolve by plain <", () => {
    // Sanity: these two ids must actually disagree between the two orderings, or the case below
    // proves nothing.
    expect('á-hero'.localeCompare('b-hero')).toBeLessThan(0); // locale: á sorts near a, before b.
    expect('á-hero' < 'b-hero').toBe(false); // plain <: á is U+00E1, after ASCII 'b' (U+0062).

    const bases = [fakeBasis('á-hero', { attack: 10 }), fakeBasis('b-hero', { attack: 10 })];
    const a = fakeCandidate('a', 100, new Map([['á-hero', { ...bases[0].pts, attack: 9, energy: 1 }]]));
    const b = fakeCandidate('b', 100, new Map([['b-hero', { ...bases[1].pts, attack: 9, energy: 1 }]]));

    // Under plain-< ascending order, 'b-hero' is checked FIRST (á > b in code-unit order), so
    // b's moved attack (9, smaller) beats a's default (10, unmoved) there — b wins. A
    // localeCompare-based ordering would check 'á-hero' first instead and flip the outcome.
    expect(compareFarmCandidates(a, b, bases)).toBeGreaterThan(0);
    expect(compareFarmCandidates(b, a, bases)).toBeLessThan(0);
  });

  it("ids where numeral length differs ('a-10' vs 'a-9') resolve by plain < (a-10 before a-9)", () => {
    const bases = [fakeBasis('a-10', { attack: 10 }), fakeBasis('a-9', { attack: 10 })];
    const a = fakeCandidate('a', 100, new Map([['a-10', { ...bases[0].pts, attack: 9, energy: 1 }]]));
    const b = fakeCandidate('b', 100, new Map([['a-9', { ...bases[1].pts, attack: 9, energy: 1 }]]));
    // Plain < puts 'a-10' before 'a-9' (character '1' < '9'), so 'a-10' is checked first: a's
    // moved attack there (9) beats b's default (10) — a wins.
    expect('a-10' < 'a-9').toBe(true);
    expect(compareFarmCandidates(a, b, bases)).toBeLessThan(0);
  });
});

describe('the fixed point: re-solving on the solver\'s own proposal changes nothing, three times over', () => {
  const { heroes, account, maxPhase } = loadFarmRateFixture();

  it('keptCurrent, gainPct 0, outcome nothingToGain — repeated three times so a regression shows as oscillation', () => {
    let currentHeroes: readonly HeroRecord[] = heroes;

    const first = solveFarmRespec({ heroes: currentHeroes, account, maxPhase });
    expect(first.outcome).toBe('improved'); // sanity: there IS something to fix first.

    let previous = first;
    for (let round = 0; round < 3; round++) {
      const respecced: HeroRecord[] = currentHeroes.map((hero) => {
        const entry = previous.heroes.find((h) => h.heroId === hero.id);
        return entry ? { ...hero, pts: entry.proposedPts } : hero;
      });

      const result = solveFarmRespec({ heroes: respecced, account, maxPhase });

      expect(result.keptCurrent, `round ${round}`).toBe(true);
      expect(result.gainPct, `round ${round}`).toBe(0);
      expect(result.outcome, `round ${round}`).toBe('nothingToGain');
      // Non-negative-gain re-asserted after the round trip.
      expect(result.proposedObjective, `round ${round}`).toBeGreaterThanOrEqual(result.currentObjective);

      currentHeroes = respecced;
      previous = result;
    }
  });

  it('the winning seed on a kept-current re-solve is \'current\' — the mechanism the fixed point rests on', () => {
    // design.md §4.4: on a re-run the previous winner IS the 'current' seed, out-scores every
    // canonical seed, and is already a local optimum, so the descent starts and ends there.
    const first = solveFarmRespec({ heroes, account, maxPhase });
    const respecced: HeroRecord[] = heroes.map((hero) => {
      const entry = first.heroes.find((h) => h.heroId === hero.id);
      return entry ? { ...hero, pts: entry.proposedPts } : hero;
    });
    const second = solveFarmRespec({ heroes: respecced, account, maxPhase });
    expect(second.winningSeed).toBe('current');
  });

  it('holds on a narrower (2-hero) pool too', () => {
    const twoIds = heroes.slice(0, 2).map((h) => h.id);
    const first = solveFarmRespec({ heroes, account, maxPhase, enabledHeroIds: twoIds });
    const respecced: HeroRecord[] = heroes.map((hero) => {
      const entry = first.heroes.find((h) => h.heroId === hero.id);
      return entry ? { ...hero, pts: entry.proposedPts } : hero;
    });
    const second = solveFarmRespec({ heroes: respecced, account, maxPhase, enabledHeroIds: twoIds });
    expect(second.keptCurrent).toBe(true);
    expect(second.gainPct).toBe(0);
  });
});

describe('proposed luck always equals current luck, under every objective', () => {
  for (const objective of OBJECTIVES) {
    it(`objective=${JSON.stringify(objective)}`, () => {
      const { heroes, account, maxPhase } = loadFarmRateFixture();
      const jon = heroes.find((h) => h.name === 'Jon')!;
      // A hero whose luck is the majority of its level (level 38, luck 30) — the case that would
      // catch a search that treats luck as spendable budget.
      const highLuckJon: HeroRecord = { ...jon, pts: { ...jon.pts, luck: 30 } };
      const mutatedHeroes = heroes.map((h) => (h.id === jon.id ? highLuckJon : h));

      const result = solveFarmRespec({ heroes: mutatedHeroes, account, objective, maxPhase });
      expect(result.heroes.length).toBeGreaterThan(0);
      for (const hero of result.heroes) {
        expect(hero.proposedPts.luck).toBe(hero.currentPts.luck);
      }
      // The fixture's own heroes all carry luck 0 — covered by every other case in this file too.
      const untouchedHero = result.heroes.find((h) => h.heroId !== jon.id)!;
      expect(untouchedHero.currentPts.luck).toBe(0);
      expect(untouchedHero.proposedPts.luck).toBe(0);
    });
  }
});
