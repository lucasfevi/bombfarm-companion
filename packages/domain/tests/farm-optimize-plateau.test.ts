/**
 * The energy-share plateau — a pure, zero-extra-cost read-out of the search's final ladder.
 * 1:1 to `FRAD-25`, `FRAD-26`, `FRAD-27`, `FRAD-17`.
 *
 * `derivePlateauBounds` and `squadEnergyShare` are tested directly against synthetic ladder data
 * where useful — the CONTIGUITY rule and the single-point (`FRAD-26`) rule are exact, mechanical
 * properties of that pure function, and a hand-built ladder proves them far more precisely and
 * deterministically than trying to coax a specific dip shape out of the real estimator. The
 * fixture-level cases prove the wiring: the real solve's plateau, its bounds, and its zero-cost
 * property.
 */
import { describe, expect, it } from 'vitest';
import { solveFarmRespec, FARM_OPT_PLATEAU_TOLERANCE_PCT } from '@bombfarm/domain/farm-optimize';
import { runFarmSearch, derivePlateauBounds, squadEnergyShare } from '@bombfarm/domain/farm-optimize-search';
import { computeHeroFarmBases } from '@bombfarm/domain/farm-rate';
import { resolveFarmObjective } from '@bombfarm/domain/farm-optimize-objective';
import { reoptBudget } from '@bombfarm/domain/points-reopt-core';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();

describe('derivePlateauBounds — the contiguity and single-point rules, on synthetic ladders', () => {
  it('a width of several grid steps when every neighbour in the run qualifies', () => {
    const ladder = [
      { share: 0.4, value: 90 },
      { share: 0.45, value: 96 },
      { share: 0.5, value: 99 },
      { share: 0.55, value: 100 }, // peak
      { share: 0.6, value: 99 },
      { share: 0.65, value: 96 },
      { share: 0.7, value: 90 },
    ];
    const bounds = derivePlateauBounds(ladder, 0.55, 100, 5); // 5% tolerance ⇒ floor 95.
    expect(bounds.min).toBe(0.45);
    expect(bounds.max).toBe(0.65);
    expect(bounds.max - bounds.min).toBeCloseTo(0.2, 9);
  });

  it('a non-contiguous qualifying set is NOT spanned — the run stops at a mid-grid dip', () => {
    const ladder = [
      { share: 0.4, value: 99 },
      { share: 0.45, value: 99 },
      { share: 0.5, value: 40 }, // the dip, well below floor
      { share: 0.55, value: 100 }, // peak
      { share: 0.6, value: 99 },
      { share: 0.65, value: 99 },
    ];
    // floor with 5% tolerance is 95 — 0.4/0.45/0.6/0.65 all qualify on their own, but 0.5 does
    // not, so the run around the peak (0.55) must stop at 0.5, never crossing the dip to reach
    // 0.4/0.45 even though those points individually score above the floor too.
    const bounds = derivePlateauBounds(ladder, 0.55, 100, 5);
    expect(bounds.min).toBe(0.55); // 0.5 (the dip) blocks the walk left at the very first step.
    expect(bounds.max).toBe(0.65);
  });

  it('no neighbour qualifies ⇒ min === max === winShare, never null, never an invented width (FRAD-26)', () => {
    const ladder = [
      { share: 0.4, value: 10 },
      { share: 0.45, value: 10 },
      { share: 0.5, value: 10 },
      { share: 0.55, value: 10 },
    ];
    // winShare's own true value is the peak (100 here), far above every grid neighbour.
    const bounds = derivePlateauBounds(ladder, 0.52, 100, 1);
    expect(bounds.min).toBe(0.52);
    expect(bounds.max).toBe(0.52);
    expect(bounds.min).toBe(bounds.max);
  });

  it('an empty ladder ⇒ min === max === winShare (the budget-exhausted-before-any-sweep edge)', () => {
    const bounds = derivePlateauBounds([], 0.33, 100, 1);
    expect(bounds.min).toBe(0.33);
    expect(bounds.max).toBe(0.33);
  });

  it('winShare between two qualifying grid points is folded into the reported range', () => {
    const ladder = [
      { share: 0.4, value: 99 },
      { share: 0.45, value: 100 },
      { share: 0.5, value: 99 },
    ];
    const bounds = derivePlateauBounds(ladder, 0.47, 100, 5);
    expect(bounds.min).toBeLessThanOrEqual(0.47);
    expect(bounds.max).toBeGreaterThanOrEqual(0.47);
  });
});

describe('squadEnergyShare — the aggregate denominator', () => {
  it('is 0 when the searchable set is empty (the zero-pool guard)', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));
    expect(squadEnergyShare(bases, [], budgetById, null)).toBe(0);
  });
});

describe('FRAD-25 — the fixture reports a bounded, correctly-shaped plateau', () => {
  it('0 <= min <= proposedEnergyShare <= max <= 1, and tolerancePct is the exported constant', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    expect(result.plateau).not.toBeNull();
    const plateau = result.plateau!;
    expect(plateau.tolerancePct).toBe(FARM_OPT_PLATEAU_TOLERANCE_PCT);
    expect(plateau.minEnergyShare).toBeGreaterThanOrEqual(0);
    expect(plateau.minEnergyShare).toBeLessThanOrEqual(plateau.proposedEnergyShare);
    expect(plateau.proposedEnergyShare).toBeLessThanOrEqual(plateau.maxEnergyShare);
    expect(plateau.maxEnergyShare).toBeLessThanOrEqual(1);
    // Measured on the committed fixture (recorded, not asserted as a hardcoded band — design.md
    // §0.1): the WINNER holds Speed points, so its own energy-share family is narrower than the
    // pure attack/energy sweep design.md §4.7 measures separately — here it collapses to a
    // single point (design's own documented "narrower because it spends points on Speed").
    expect(plateau.maxEnergyShare - plateau.minEnergyShare).toBeGreaterThanOrEqual(0);
  });

  it('peak === proposedObjective: no probed ladder share out-scores the winner', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));
    const searchableIds = bases.map((b) => b.heroId);
    const objective = resolveFarmObjective({ kind: 'gold' });
    const search = runFarmSearch(bases, searchableIds, budgetById, account, objective, { goldScale: 1, chestScale: 1 }, { maxPhase }, 4000);
    const bestLadderValue = search.ladder.reduce((max, entry) => Math.max(max, entry.value), -Infinity);
    expect(bestLadderValue).toBeLessThanOrEqual(search.winner.value * (1 + 1e-9));
  });
});

describe('FRAD-26 — a squad whose neighbours all fall outside tolerance', () => {
  it('the fixture\'s own plateau is exactly this case: min === max, never null', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    expect(result.plateau).not.toBeNull();
    expect(result.plateau!.minEnergyShare).toBe(result.plateau!.maxEnergyShare);
  });
});

describe('FRAD-27 — a keptCurrent solve still reports a plateau', () => {
  it('currentEnergyShare lies inside [min, max]', () => {
    const first = solveFarmRespec({ heroes, account, maxPhase });
    const respecced: HeroRecord[] = heroes.map((hero) => {
      const entry = first.heroes.find((h) => h.heroId === hero.id);
      return entry ? { ...hero, pts: entry.proposedPts } : hero;
    });
    const second = solveFarmRespec({ heroes: respecced, account, maxPhase });
    expect(second.keptCurrent).toBe(true);
    expect(second.plateau).not.toBeNull();
    const plateau = second.plateau!;
    expect(plateau.currentEnergyShare).toBeGreaterThanOrEqual(plateau.minEnergyShare);
    expect(plateau.currentEnergyShare).toBeLessThanOrEqual(plateau.maxEnergyShare);
  });
});

describe('a zero-searchable-pool squad', () => {
  it('currentEnergyShare === 0 and no NaN, on the noBudget fast path', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const zeroBudgetJon: HeroRecord = {
      ...jon,
      level: 5,
      pts: { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 5 },
    };
    const result = solveFarmRespec({ heroes: [zeroBudgetJon], account, maxPhase });
    expect(result.outcome).toBe('noBudget');
    expect(result.plateau).not.toBeNull();
    expect(result.plateau!.currentEnergyShare).toBe(0);
    expect(Number.isNaN(result.plateau!.currentEnergyShare)).toBe(false);
  });
});

describe('the plateau adds ZERO evaluations', () => {
  it('solveFarmRespec\'s evaluations count equals runFarmSearch\'s own count for the identical search', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));
    const searchableIds = bases.map((b) => b.heroId);
    const objective = resolveFarmObjective({ kind: 'gold' });
    const search = runFarmSearch(bases, searchableIds, budgetById, account, objective, { goldScale: 1, chestScale: 1 }, { maxPhase }, 4000);

    const result = solveFarmRespec({ heroes, account, maxPhase });
    expect(result.evaluations).toBe(search.evaluations);
  });
});
