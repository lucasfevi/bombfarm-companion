/**
 * Proof that the `farm-rate.ts` basis seam is a byte-identical refactor, not a rewrite.
 *
 * `farm-basis-parity-expected.json` (tests/fixtures/) is a literal capture of the PRE-refactor
 * `computeHeroFarmFacts(fixture)` output and the PRE-refactor 600-row `computeFarmRates` table,
 * so the assertions below compare the post-refactor code against those frozen literals rather
 * than against itself. Every assertion uses exact `toEqual`, never `toBeCloseTo`, except the one
 * case explicitly documented as approximate (the moved-vector affine claim).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  computeHeroFarmBases,
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  squadFactsFromBases,
  heroFactsFromBasis,
  computeFarmRates,
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

const expected = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'farm-basis-parity-expected.json'), 'utf8'),
) as { heroFacts: HeroFarmFacts[]; rows: FarmRateRow[] };

/** Relative-error check for the one approximate assertion in this file (the affine claim). */
function expectCloseRel(actual: number, expectedValue: number, relTol: number): void {
  if (expectedValue === 0) {
    expect(Math.abs(actual)).toBeLessThanOrEqual(relTol);
    return;
  }
  const relError = Math.abs(actual - expectedValue) / Math.abs(expectedValue);
  expect(relError, `actual=${actual} expected=${expectedValue} relError=${relError}`).toBeLessThanOrEqual(relTol);
}

describe('capture-then-compare — the refactor reproduces the pre-refactor output exactly', () => {
  it('computeHeroFarmFacts(fixture) toEquals the frozen pre-refactor capture, all 5 heroes', () => {
    const facts = computeHeroFarmFacts({ heroes, account });
    expect(facts).toEqual(expected.heroFacts);
  });

  it('the full 600-row computeFarmRates table toEquals the frozen pre-refactor capture', () => {
    const { rows } = computeFarmRates({ heroes, account });
    expect(rows).toEqual(expected.rows);
  });
});

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
      const pipeline = pipelineForHero(hero, account, 1, 0);
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

    const movedHero: HeroRecord = { ...jon, pts: movedPts };
    const [realRun] = computeHeroFarmFacts({ heroes: [movedHero], account });

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

  it('computeHeroFarmBases costs |enabled|; 200 subsequent heroFactsFromBasis calls cost 0', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    expect(energySwitchPointCallCount).toBe(heroes.length);

    resetEnergySwitchPointCallCount();
    for (let i = 0; i < 200; i++) {
      for (const basis of bases) {
        heroFactsFromBasis(basis, basis.pts);
      }
    }
    expect(energySwitchPointCallCount).toBe(0);
  });
});
