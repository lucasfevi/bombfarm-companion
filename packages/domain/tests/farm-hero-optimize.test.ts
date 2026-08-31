/**
 * `optimizeHeroForFarm` — the Points tab's per-hero farm search.
 *
 * The claim this file exists to hold is that ONE hero moves and the rotation still scores as a
 * rotation: a search that quietly reallocated the rest of the pool would produce a number no
 * player could act on, and would look identical in every field of the result.
 *
 * Reads the default roster fixture and is NOT held behind `capture-regime`, for the same reason
 * `farm-optimize-core.test.ts` is not: nothing here asserts a game number. Every case is a
 * property of the search itself — a budget bound, an untouched key, a fixed point, determinism,
 * a named outcome — and holds whatever the sheet math underneath happens to compute. The one
 * pair of cases that needs the roster to be realistic ("improvable", "diverges from DPS") is
 * guarded by its own vacuity check rather than by a capture date.
 */
import { describe, expect, it } from 'vitest';
import {
  optimizeHeroForFarm,
  type HeroFarmOptimizeResult,
} from '@bombfarm/domain/farm-hero-optimize';
import { computeHeroFarmBases, squadFactsFromBases } from '@bombfarm/domain/farm-rate';
import { farmObjectiveScales } from '@bombfarm/domain/farm-optimize-objective';
import { optimizeBuild } from '@bombfarm/domain/points-reopt';
import { budgetOf, reoptBudget, REOPT_KEYS } from '@bombfarm/domain/points-reopt-core';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();
const bases = computeHeroFarmBases({ heroes, account });

function optimize(heroId: string): HeroFarmOptimizeResult {
  return optimizeHeroForFarm({ bases, account, heroId, maxPhase });
}

const improvedEntries = bases
  .map((basis) => ({ basis, result: optimize(basis.heroId) }))
  .filter((entry) => entry.result.outcome === 'improved');

describe('the search moves ONE hero and scores the whole rotation', () => {
  it('at least one hero on this roster is improvable — otherwise every case below is vacuous', () => {
    expect(improvedEntries.length).toBeGreaterThan(0);
  });

  it('the reported rate is reproducible from a ONE-hero assignment — nobody else was moved', () => {
    // The discriminating half is the assignment's single entry: had the search also moved a
    // pool-mate, the squad it scored would carry that move and this rebuild, which carries only
    // the target's, could not land on the same number.
    for (const { basis, result } of improvedEntries) {
      const squad = squadFactsFromBases(bases, new Map([[basis.heroId, result.pts]]), account);
      const gold = farmObjectiveScales(squad, { maxPhase }).goldScale;
      expect(gold, `${basis.heroName} moved more than its own points`).toBeCloseTo(
        result.proposedGoldPerHour,
        6,
      );
    }
  });

  it('never proposes more points than the hero owns, and never touches Luck', () => {
    for (const basis of bases) {
      const result = optimize(basis.heroId);
      expect(budgetOf(result.pts)).toBeLessThanOrEqual(reoptBudget(basis.pts, basis.level));
      expect(result.pts.luck).toBe(basis.pts.luck);
      expect(Object.keys(result.pts)).toHaveLength(8);
    }
  });

  it('gainPct is never negative and never non-finite, whatever the outcome', () => {
    for (const basis of bases) {
      const result = optimize(basis.heroId);
      expect(Number.isFinite(result.gainPct)).toBe(true);
      expect(result.gainPct).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.currentGoldPerHour)).toBe(true);
      expect(Number.isFinite(result.proposedGoldPerHour)).toBe(true);
      expect(Number.isFinite(result.evaluations)).toBe(true);
    }
  });

  it('an outcome other than improved hands back the player own vector, unchanged', () => {
    for (const basis of bases) {
      const result = optimize(basis.heroId);
      if (result.outcome === 'improved') continue;
      expect(result.pts).toEqual(basis.pts);
      expect(result.gainPct).toBe(0);
    }
  });
});

describe('re-running on its own proposal is a fixed point, not a compounding gain', () => {
  it('a second search over the proposed build finds nothing more to move', () => {
    for (const { basis, result } of improvedEntries) {
      const rebuilt = computeHeroFarmBases({
        heroes: heroes.map((hero) =>
          hero.id === basis.heroId ? ({ ...hero, pts: result.pts } as HeroRecord) : hero,
        ),
        account,
      });
      const again = optimizeHeroForFarm({ bases: rebuilt, account, heroId: basis.heroId, maxPhase });
      expect(again.gainPct, `${basis.heroName} compounded`).toBeLessThan(1e-6);
    }
  });
});

describe('the two targets are genuinely different searches', () => {
  it('at least one hero gets a different allocation under farm than under DPS', () => {
    const { phase, mitigationPct } = account.context;
    if (phase == null) throw new Error('fixture must carry account.context.phase for this test');

    const divergent = improvedEntries.filter(({ basis }) => {
      const hero = heroes.find((h) => h.id === basis.heroId)!;
      const pipeline = pipelineForHero(hero, account, phase, mitigationPct);
      const dps = optimizeBuild({
        pts: basis.pts,
        effective: pipeline.effective,
        effectiveDelta: pipeline.A.effectiveDelta,
        context: pipeline.context,
        level: basis.level,
      });
      const farm = optimize(basis.heroId);
      return REOPT_KEYS.some((key: SheetKey) => dps.pts[key] !== farm.pts[key]);
    });

    expect(divergent.length).toBeGreaterThan(0);
  });
});

describe('every degenerate input returns a named outcome rather than throwing', () => {
  it('an empty pool', () => {
    const result = optimizeHeroForFarm({ bases: [], account, heroId: bases[0].heroId, maxPhase });
    expect(result.outcome).toBe('emptyPool');
    expect(result.gainPct).toBe(0);
  });

  it('a heroId that names nobody in the pool', () => {
    const result = optimizeHeroForFarm({ bases, account, heroId: 'not-a-hero', maxPhase });
    expect(result.outcome).toBe('heroNotInPool');
    expect(result.gainPct).toBe(0);
  });

  it('a hero with no budget at all', () => {
    const zeroed: HeroRecord[] = heroes.map((hero, index) =>
      index === 0 ? ({ ...hero, level: 0, pts: ZERO_PTS() } as HeroRecord) : hero,
    );
    const zeroedBases = computeHeroFarmBases({ heroes: zeroed, account });
    const result = optimizeHeroForFarm({
      bases: zeroedBases,
      account,
      heroId: zeroedBases[0].heroId,
      maxPhase,
    });
    expect(['noBudget', 'degenerate']).toContain(result.outcome);
  });
});

describe('the search is deterministic', () => {
  it('two calls on identical input return identical vectors and identical gains', () => {
    for (const basis of bases) {
      const first = optimize(basis.heroId);
      const second = optimize(basis.heroId);
      expect(second.pts).toEqual(first.pts);
      expect(second.gainPct).toBe(first.gainPct);
      expect(second.recommendedPhase).toBe(first.recommendedPhase);
    }
  });
});
