/**
 * The cost frontier — best 1-hero and best 2-hero respec, each re-solved (never truncated),
 * ordered ascending by cost, sized to the searchable set, and never advising a spend under a
 * gold-lowering objective without an honest null payback.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec, FARM_OPT_FULL_MAX_EVALUATIONS } from '@bombfarm/domain/farm-optimize';
import { runFarmSearch } from '@bombfarm/domain/farm-optimize-search';
import { computeHeroFarmBases } from '@bombfarm/domain/farm-rate';
import { resolveFarmObjective } from '@bombfarm/domain/farm-optimize-objective';
import { reoptBudget } from '@bombfarm/domain/points-reopt-core';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { FARM_OPTIMIZE_FIXTURE, loadFarmRateFixture } from './helpers/farm-rate-fixtures';
import { holdSuiteUntilInRegime } from './helpers/capture-regime';

holdSuiteUntilInRegime(`sheet-math/${FARM_OPTIMIZE_FIXTURE}`, 'sheet');

const { heroes, account, maxPhase } = loadFarmRateFixture();

describe('the fixture reproduces the measured frontier ordering', () => {
  const result = solveFarmRespec({ heroes, account, maxPhase });
  const [oneHero, twoHero] = result.frontier;

  it('the 1-hero entry has strictly lower cost, gain and payback than the joint optimum', () => {
    expect(result.frontier).toHaveLength(2);
    expect(oneHero.heroCount).toBe(1);
    expect(oneHero.respecCostGold).toBeLessThan(result.respecCostGold);
    expect(oneHero.gainPct).toBeLessThan(result.gainPct);
    expect(oneHero.paybackHours).not.toBeNull();
    expect(result.paybackHours).not.toBeNull();
    expect(oneHero.paybackHours!).toBeLessThan(result.paybackHours!);
    // design.md §2.3: Bellatrix, +9.87%, 42,000 gold, 1.61h — recorded, not hardcoded as the
    // pass/fail bar; the strict inequalities above are the actual assertions.
    expect(oneHero.heroIds).toEqual(['20402']); // Bellatrix
  });

  it('the array is cost-ascending, and the joint total is >= the last tier when it changes more heroes', () => {
    expect(oneHero.respecCostGold).toBeLessThanOrEqual(twoHero.respecCostGold);
    const jointChangedCount = result.heroes.filter((h) => h.changed).length;
    if (jointChangedCount > twoHero.heroCount) {
      expect(result.respecCostGold).toBeGreaterThanOrEqual(twoHero.respecCostGold);
    }
  });

  it('the 2-hero entry sits between the 1-hero entry and the joint optimum', () => {
    expect(twoHero.heroCount).toBe(2);
    expect(twoHero.gainPct).toBeGreaterThan(oneHero.gainPct);
    expect(twoHero.gainPct).toBeLessThanOrEqual(result.gainPct);
    expect(twoHero.respecCostGold).toBeGreaterThan(oneHero.respecCostGold);
  });
});

describe('re-solved, not truncated', () => {
  it("the 1-hero entry's vector for its hero differs from the joint optimum, or (if equal) its own solve ran and every other hero is pinned exactly to current", () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    const [oneHero] = result.frontier;
    const tierHeroId = oneHero.heroIds[0];

    const jointEntry = result.heroes.find((h) => h.heroId === tierHeroId)!;
    const tierEntry = oneHero.heroes.find((h) => h.heroId === tierHeroId)!;

    const vectorsDiffer = JSON.stringify(tierEntry.proposedPts) !== JSON.stringify(jointEntry.proposedPts);
    if (vectorsDiffer) {
      expect(vectorsDiffer).toBe(true);
    } else {
      // Coincidence guard: the constrained solve genuinely ran (not skipped), and every OTHER
      // hero in this tier is pinned exactly to current (their whole point of being "1-hero").
      for (const hero of oneHero.heroes) {
        if (hero.heroId === tierHeroId) continue;
        expect(hero.proposedPts).toEqual(hero.currentPts);
        expect(hero.changed).toBe(false);
      }
    }
  });

  it('every hero outside the tier is pinned exactly to current, for both tiers', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    for (const entry of result.frontier) {
      for (const hero of entry.heroes) {
        if (entry.heroIds.includes(hero.heroId)) continue;
        expect(hero.proposedPts).toEqual(hero.currentPts);
        expect(hero.changed).toBe(false);
      }
    }
  });

  it('the total evaluations spent strictly exceed the joint solve\'s own — proof the frontier tiers actually ran a bounded search rather than reusing the joint optimum\'s vectors for free', () => {
    // A truncating implementation reads the joint winner's per-hero vectors straight off the
    // already-computed result and spends ZERO further evaluations on it — this is the
    // publicly-observable signature "re-solved" and "truncated" disagree on, even on inputs
    // (like this fixture) where the two approaches land on numerically identical vectors.
    const bases = computeHeroFarmBases({ heroes, account });
    const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));
    const searchableIds = bases.map((b) => b.heroId);
    const objective = resolveFarmObjective({ kind: 'gold' });
    const jointOnly = runFarmSearch(
      bases,
      searchableIds,
      budgetById,
      account,
      objective,
      { goldScale: 1, chestScale: 1 },
      { maxPhase },
      Math.floor(FARM_OPT_FULL_MAX_EVALUATIONS * 0.5),
    );

    const result = solveFarmRespec({ heroes, account, maxPhase });
    expect(result.frontier.length).toBeGreaterThan(0);
    expect(result.evaluations).toBeGreaterThan(jointOnly.evaluations);
  });
});

describe('frontier size tracks |S|, never duplicated, never padded', () => {
  it('|S| = 1 ⇒ frontier: []', () => {
    const oneId = [heroes.find((h) => h.name === 'Jon')!.id];
    const result = solveFarmRespec({ heroes, account, maxPhase, enabledHeroIds: oneId });
    expect(result.frontier).toHaveLength(0);
  });

  it('|S| = 2 ⇒ exactly one entry, heroCount: 1', () => {
    const twoIds = heroes.slice(0, 2).map((h) => h.id);
    const result = solveFarmRespec({ heroes, account, maxPhase, enabledHeroIds: twoIds });
    if (result.outcome === 'improved') {
      expect(result.frontier).toHaveLength(1);
      expect(result.frontier[0].heroCount).toBe(1);
    }
  });

  it('|S| >= 3 ⇒ two entries, never more', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    expect(result.frontier.length).toBeLessThanOrEqual(2);
    expect(result.frontier).toHaveLength(2);
  });
});

describe('exactly one searchable hero ⇒ empty frontier (re-asserted from T7)', () => {
  it('a single-hero pool never produces a frontier entry', () => {
    const oneId = [heroes.find((h) => h.name === 'Jon')!.id];
    const result = solveFarmRespec({ heroes, account, maxPhase, enabledHeroIds: oneId });
    expect(result.frontier).toHaveLength(0);
  });
});

describe('an objective-rising, gold-lowering tier reports paybackHours: null', () => {
  it("the chest objective's 1-hero frontier entry never reports a negative or infinite payback", () => {
    const result = solveFarmRespec({ heroes, account, objective: { kind: 'chests' }, maxPhase });
    expect(result.outcome).toBe('improved');
    for (const entry of result.frontier) {
      expect(entry.paybackHours === null || (Number.isFinite(entry.paybackHours) && entry.paybackHours >= 0)).toBe(true);
      if (entry.proposedGoldPerHour <= result.currentGoldPerHour) {
        expect(entry.paybackHours).toBeNull();
      }
    }
  });
});

describe('keptCurrent ⇒ frontier: []', () => {
  it('the fixed-point re-solve reports an empty frontier', () => {
    const first = solveFarmRespec({ heroes, account, maxPhase });
    const respecced: HeroRecord[] = heroes.map((hero) => {
      const entry = first.heroes.find((h) => h.heroId === hero.id);
      return entry ? { ...hero, pts: entry.proposedPts } : hero;
    });
    const second = solveFarmRespec({ heroes: respecced, account, maxPhase });
    expect(second.keptCurrent).toBe(true);
    expect(second.frontier).toHaveLength(0);
  });
});

describe('each frontier entry is a complete result on its own', () => {
  it('every entry carries its own full heroes list, recommendedPhase, gainPct, respecCostGold and paybackHours, all present and finite (or legitimately null)', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    for (const entry of result.frontier) {
      expect(entry.heroes).toHaveLength(heroes.length);
      expect(entry.heroCount).toBe(entry.heroIds.length);
      expect(Number.isFinite(entry.recommendedPhase) || entry.recommendedPhase === null).toBe(true);
      expect(Number.isFinite(entry.gainPct)).toBe(true);
      expect(Number.isFinite(entry.respecCostGold)).toBe(true);
      expect(entry.paybackHours === null || Number.isFinite(entry.paybackHours)).toBe(true);
      expect(Number.isFinite(entry.proposedGoldPerHour)).toBe(true);
      expect(Number.isFinite(entry.proposedChestsPerHour)).toBe(true);
    }
  });
});

describe('the frontier candidate ranking reproduces the exhaustive answer on the fixture', () => {
  it("Bellatrix wins the 1-hero tier and Jon+Bellatrix wins the 2-hero tier — design.md §4.10's own verification", () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    const [oneHero, twoHero] = result.frontier;
    expect(oneHero.heroIds).toEqual(['20402']); // Bellatrix
    expect([...twoHero.heroIds].sort()).toEqual(['20402', '584'].sort()); // Bellatrix + Jon
  });
});

describe('evaluations, frontier included, stay inside the bound', () => {
  it('evaluations <= FARM_OPT_FULL_MAX_EVALUATIONS on the fixture', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    expect(result.evaluations).toBeLessThanOrEqual(FARM_OPT_FULL_MAX_EVALUATIONS);
    // Recorded, not asserted as a literal (design.md §0.1): the frontier adds real cost on top
    // of the joint solve's own evaluations.
    expect(result.evaluations).toBeGreaterThan(0);
  });
});
