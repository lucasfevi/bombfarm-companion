/**
 * The energy-share plateau — a pure, zero-extra-cost read-out of the search's final ladder.
 *
 * `derivePlateauBounds` and `squadEnergyShare` are tested directly against synthetic ladder data
 * where useful — the CONTIGUITY rule and the single-point (never-null, never-invented-width)
 * rule are exact, mechanical properties of that pure function, and a hand-built ladder proves
 * them far more precisely and deterministically than trying to coax a specific dip shape out of
 * the real estimator. The fixture-level cases prove the wiring: the real solve's plateau, its
 * bounds, and its zero-cost property.
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

  it('no neighbour qualifies ⇒ min === max === winShare, never null, never an invented width', () => {
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

describe('the fixture reports a bounded, correctly-shaped plateau', () => {
  it('0 <= min <= proposedEnergyShare <= max <= 1, and tolerancePct is the exported constant', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    expect(result.plateau).not.toBeNull();
    const plateau = result.plateau!;
    expect(plateau.tolerancePct).toBe(FARM_OPT_PLATEAU_TOLERANCE_PCT);
    expect(plateau.minEnergyShare).toBeGreaterThanOrEqual(0);
    expect(plateau.minEnergyShare).toBeLessThanOrEqual(plateau.proposedEnergyShare);
    expect(plateau.proposedEnergyShare).toBeLessThanOrEqual(plateau.maxEnergyShare);
    expect(plateau.maxEnergyShare).toBeLessThanOrEqual(1);
    // Measured on the committed fixture, pinned to the actual value rather than a tautology
    // that would pass for any output: the winning build holds Speed points, which fixes those
    // points and re-splits only the remaining attack+energy pool on every rung of the share
    // ladder. That leaves this particular squad's own energy-share family narrow enough that no
    // neighbouring grid share scores within tolerance of the peak, so the plateau genuinely
    // collapses to a single point. That is spec-sanctioned behaviour, not an accident: min and
    // max both equal the winner's own share, never null, never an invented width.
    //
    // RE-MEASURED THREE TIMES, every time because the winning BUILD moved — never the plateau
    // logic. The single-point collapse is unchanged throughout.
    // The single-point collapse the comment above describes is unchanged throughout.
    //   0.4744  original
    //   0.4937  House-ceiling fix: rest seconds now come from the fixture's own
    //           `casa.cycle_secs` (1181.05s) rather than the `HOUSES` table (1102s), and a longer
    //           House cycle makes each Energy point (which buys field seconds) worth more.
    //   0.5402  cadence fix: averaging the cycle over the measured hop distribution puts ~45% of
    //           plants on the fuse-bound branch, where a Speed point buys nothing. Speed's
    //           marginal value drops sharply, the winning build stops spending on it, and the
    //           freed pool goes to Energy. Same direction as the rank inversion pinned in
    //           `farm-point-rank.test.ts`, where energy overtakes speed outright.
    //   0.5000  2026-08-15 patch: crit chance and CDR became flat addends
    //           (`POINT_GAIN.critChanceFlat` / `.cdrFlat`). Both per-point gains collapsed by
    //           more than an order of magnitude, so neither stat competes for the pool any more
    //           and the split reverts toward the attack/energy pair.
    expect(plateau.minEnergyShare).toBeCloseTo(0.5, 4);
    expect(plateau.maxEnergyShare).toBeCloseTo(0.5, 4);
    expect(plateau.minEnergyShare).toBe(plateau.maxEnergyShare);
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

describe('a squad whose small point budget produces a genuinely wide plateau, through the real solve pipeline', () => {
  it('several adjacent grid shares round to the identical attack/energy split, so their objective values are bit-identical, not just close', () => {
    // The single-point collapse above is real, but it is not the only shape this feature has to
    // report correctly, and a case that only ever sees a single point cannot tell the difference
    // between a correct width computation and a broken one that always collapses. This case
    // forces a genuinely wide plateau through the SAME live `solveFarmRespec` pipeline, not a
    // hand-built ladder: a hero with a tiny reallocatable point budget (4, from level 4 with
    // every stat and luck at 0) means the ladder's 0.05-wide grid steps are finer than the
    // budget can resolve. `Math.round(pool * share)` maps five consecutive shares — 0.40, 0.45,
    // 0.50, 0.55, 0.60 — to the exact same 2-energy/2-attack integer split, so those five squads
    // are bit-identical and score exactly the same, not merely within tolerance. That produces a
    // measured, deterministic band, not a single point.
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const tinyBudgetJon: HeroRecord = {
      ...jon,
      level: 4,
      pts: { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 },
    };
    const result = solveFarmRespec({ heroes: [tinyBudgetJon], account, maxPhase });
    expect(result.plateau).not.toBeNull();
    const plateau = result.plateau!;
    expect(plateau.minEnergyShare).toBe(0.4);
    expect(plateau.maxEnergyShare).toBe(0.6);
    expect(plateau.proposedEnergyShare).toBe(0.5);
    expect(plateau.maxEnergyShare - plateau.minEnergyShare).toBeCloseTo(0.2, 9);
  });
});

describe('a squad whose neighbours all fall outside tolerance', () => {
  it('the fixture\'s own plateau is exactly this case: min === max, never null', () => {
    const result = solveFarmRespec({ heroes, account, maxPhase });
    expect(result.plateau).not.toBeNull();
    expect(result.plateau!.minEnergyShare).toBe(result.plateau!.maxEnergyShare);
  });
});

describe('a keptCurrent solve still reports a plateau', () => {
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
  it("solveFarmRespec's evaluations count equals runFarmSearch's own count for the identical search, on a pool where the frontier is provably empty (|S|=1)", () => {
    // A 1-hero pool forces frontier: [] unconditionally (heroCount can never be < |S|=1), so
    // this isolates the plateau's own cost from the frontier's, which otherwise also adds
    // evaluations to the same total.
    const oneId = [heroes.find((h) => h.name === 'Jon')!.id];
    const bases = computeHeroFarmBases({ heroes, account, enabledHeroIds: oneId });
    const budgetById = new Map(bases.map((b) => [b.heroId, reoptBudget(b.pts, b.level)] as const));
    const searchableIds = bases.map((b) => b.heroId);
    const objective = resolveFarmObjective({ kind: 'gold' });
    const search = runFarmSearch(bases, searchableIds, budgetById, account, objective, { goldScale: 1, chestScale: 1 }, { maxPhase }, 4000);

    const result = solveFarmRespec({ heroes, account, maxPhase, enabledHeroIds: oneId });
    expect(result.frontier).toHaveLength(0);
    expect(result.evaluations).toBe(search.evaluations);
  });
});
