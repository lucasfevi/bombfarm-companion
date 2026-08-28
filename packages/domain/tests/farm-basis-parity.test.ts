/**
 * The `farm-rate.ts` basis seam, asserted as a set of SELF-comparisons: `heroFactsFromBasis(b,
 * b.pts)` must reproduce `computeHeroFarmFacts` field for field, `squadFactsFromBases` must
 * reproduce `computeSquadFarmFacts(computeHeroFarmFacts(...))`, the moved-vector case must satisfy
 * the affine claim, and the basis must be extracted exactly once per pipeline rather than
 * re-derived. None of these read a committed number, so none of them expire with a regime.
 *
 * THE FROZEN CAPTURE IS DELETED (issue #206). `fixtures/farm-basis-parity-expected.json` held a
 * literal `computeHeroFarmFacts` output and the whole 600-row `computeFarmRates` table, captured
 * to prove ONE refactor was byte-identical. That refactor shipped, and the model has moved
 * repeatedly since — the House cycle table, the cadence rewrite, `xpPerProp`, flat crit damage,
 * the gate boss's seconds, `fieldContentionPct`, the 2026-08-23 crit-chance ability shape, the
 * FIFO field queue — so the capture could no longer match, and re-freezing it against today's
 * output would have proved nothing about the refactor it was recorded for. Its per-patch
 * footprint log, which is the part worth keeping, is preserved in `docs/fixture-corpus.md` §12.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  computeHeroFarmBases,
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  squadFactsFromBases,
  heroFactsFromBasis,
  computeFarmRates,
  farmPricedAccount,
  farmTeamBuffs,
  type HeroFarmFacts,
  type FarmRateRow,
} from '@bombfarm/domain/farm-rate';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import {
  energySwitchPointCallCount,
  resetEnergySwitchPointCallCount,
} from '@bombfarm/domain/advisor-pipeline';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();

/** Relative-error check for the one approximate assertion in this file (the affine claim). */
function expectCloseRel(actual: number, expectedValue: number, relTol: number): void {
  if (expectedValue === 0) {
    expect(Math.abs(actual)).toBeLessThanOrEqual(relTol);
    return;
  }
  const relError = Math.abs(actual - expectedValue) / Math.abs(expectedValue);
  expect(relError, `actual=${actual} expected=${expectedValue} relError=${relError}`).toBeLessThanOrEqual(relTol);
}

describe('heroFactsFromBasis(b, b.pts) — identity with computeHeroFarmFacts, every field', () => {
  it('matches the corresponding computeHeroFarmFacts entry for every fixture hero', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    const facts = computeHeroFarmFacts({ heroes, account });
    expect(bases).toHaveLength(facts.length);

    for (let i = 0; i < bases.length; i++) {
      const reconstructed = heroFactsFromBasis(bases[i], bases[i].pts);
      expect(reconstructed).toEqual(facts[i]);
    }
  });

  it('does NOT short-circuit on pts === basis.pts (same object identity still goes through the full reconstruction)', () => {
    const [basis] = computeHeroFarmBases({ heroes, account });
    const [fact] = computeHeroFarmFacts({ heroes: [heroes[0]], account });
    // Passing the exact same object reference as `basis.pts` — a short-circuit implementation
    // would still need to produce the identical result, so this alone does not distinguish the
    // two; it is asserted together with the capture-then-compare suite above, which would catch
    // a short-circuit that returns a stale/frozen shape instead of truly recomputing.
    expect(heroFactsFromBasis(basis, basis.pts)).toEqual(fact);
  });
});

describe('uptime — the §2.1 trap, asserted directly', () => {
  it('facts.uptime === pipeline.uptime / 100 exactly, for every fixture hero', () => {
    const facts = computeHeroFarmFacts({ heroes, account });
    for (const fact of facts) {
      const hero = heroes.find((h) => h.id === fact.heroId)!;
      // The account farm-rate ACTUALLY prices against — team auras weighted over the rotation,
      // not `account.teamBuffs`. Handing the pipeline the raw account here would compare two
      // different accounts and read the (correct) difference as a §2.1 parity break.
      const pipeline = pipelineForHero(hero, farmPricedAccount({ heroes, account }), 1, 0);
      expect(fact.uptime).toBe(pipeline.uptime / 100);
    }
  });
});

describe('the moved-vector case — the affine claim itself', () => {
  it('heroFactsFromBasis at a moved vector matches a full pipelineForHero re-run on a HeroRecord carrying that vector, to 1e-9 relative', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const [jonBasis] = computeHeroFarmBases({ heroes: [jon], account });
    const movedPts = { ...jonBasis.pts, attack: jonBasis.pts.attack - 5, energy: jonBasis.pts.energy + 5 };

    const reconstructed = heroFactsFromBasis(jonBasis, movedPts);

    // The re-run must price the SAME team auras the basis was built with, pinned via the override
    // path. Left to re-derive them it would not: rotation-weighted auras are a function of every
    // hero's uptime, moving 5 points from attack into energy moves this hero's uptime, and the
    // affine claim under test is about the point vector alone — it holds the whole pipeline-
    // derived context fixed, auras included (see `heroFactsFromBasis`'s own note). Comparing
    // against a re-priced run would test the aura feedback loop, not the reconstruction.
    const pinned = { ...account, teamBuffs: farmTeamBuffs({ heroes: [jon], account }), teamBuffsOverride: {} };
    const movedHero: HeroRecord = { ...jon, pts: movedPts };
    const [realRun] = computeHeroFarmFacts({ heroes: [movedHero], account: pinned });

    expectCloseRel(reconstructed.avgHitBase, realRun.avgHitBase, 1e-9);
    expectCloseRel(reconstructed.penetrationPct, realRun.penetrationPct, 1e-9);
    expectCloseRel(reconstructed.fuseSecs, realRun.fuseSecs, 1e-9);
    expectCloseRel(reconstructed.walkSpeedCells, realRun.walkSpeedCells, 1e-9);
    expectCloseRel(reconstructed.cycleSecs, realRun.cycleSecs, 1e-9);
    expectCloseRel(reconstructed.plantsPerSec, realRun.plantsPerSec, 1e-9);
    expectCloseRel(reconstructed.blocksPerBomb, realRun.blocksPerBomb, 1e-9);
    expectCloseRel(reconstructed.uptime, realRun.uptime, 1e-9);
    expectCloseRel(reconstructed.heroLuckPct, realRun.heroLuckPct, 1e-9);
    expect(reconstructed.veiaOuroLevel).toBe(realRun.veiaOuroLevel);
    expect(reconstructed.fortunaLevel).toBe(realRun.fortunaLevel);
    expect(reconstructed.degenerate).toBe(realRun.degenerate);
  });
});

describe('squadFactsFromBases — identity with computeSquadFarmFacts(computeHeroFarmFacts(...))', () => {
  it('squadFactsFromBases(bases, null, account) toEquals computeSquadFarmFacts(computeHeroFarmFacts(input), account)', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    const viaBases = squadFactsFromBases(bases, null, account);
    const viaFacts = computeSquadFarmFacts(computeHeroFarmFacts({ heroes, account }), account);
    expect(viaBases).toEqual(viaFacts);
  });
});

describe('pipeline-call count — the basis is extracted once and never re-derived', () => {
  beforeEach(() => {
    resetEnergySwitchPointCallCount();
  });

  it('computeHeroFarmBases costs 2x|enabled| (rotation-priced auras); 200 subsequent heroFactsFromBasis calls cost 0', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    expect(energySwitchPointCallCount).toBe(2 * heroes.length);

    resetEnergySwitchPointCallCount();
    for (let i = 0; i < 200; i++) {
      for (const basis of bases) {
        heroFactsFromBasis(basis, basis.pts);
      }
    }
    expect(energySwitchPointCallCount).toBe(0);
  });
});
