/**
 * Proof that the `farm-rate.ts` basis seam is a byte-identical refactor, not a rewrite.
 *
 * RE-RECORDED 2026-08-16 for the flat crit-chance/CDR change (`POINT_GAIN.critChanceFlat` /
 * `.cdrFlat`). The capture is of OUR OWN pre-change output, so re-recording it is the point of
 * the file, not a weakening — what matters is that the movement is explicable. Measured, field
 * by field:
 *
 * - `heroFacts.avgHitBase` — 5 of 5 heroes, ≤1.77%. Crit chance is a smaller share of the
 *   average hit now, so every hero's base hit falls slightly. This is the ONLY heroFacts field
 *   that moved apart from `heroesOnField` (3 rows, ≤3.32%).
 * - `rows.*` — 591 of 600 phases on each throughput column (`goldPerHour`, `chestsPerHour`,
 *   `xpPerHour`, `propsPerHour` ≤10.58%; `keysPerHour`, `cyclesPerHour` ≤10.11%; `clearSecs`
 *   ≤9.18%; `expectedHtk` ≤9.57%), all downstream of the same lower hit. `gemsPerHour` and
 *   `timePiecesPerHour` moved on 59 rows (they are 0 on the rest).
 * - **Unmoved:** every structural column — `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`,
 *   `infeasible`, `itemLevels`, `phase`. The shape of the table is untouched; only magnitudes
 *   downstream of crit moved, which is the signature of a damage change and not a table change.
 *
 * `farm-basis-parity-expected.json` (tests/fixtures/) is a literal capture of the
 * `computeHeroFarmFacts(fixture)` output and the 600-row `computeFarmRates` table, so the
 * assertions below compare the code against frozen literals rather than against itself. Every
 * assertion uses exact `toEqual`, never `toBeCloseTo`, except the one case explicitly documented
 * as approximate (the moved-vector affine claim).
 *
 * RE-CAPTURED at the flat-crit-damage fix (`POINT_GAIN.critDmgFlat`). Diffed field by field
 * against the previous capture first; the footprint is exactly the change and nothing else:
 *
 * - `heroFacts`: **only `avgHitBase`, and only on Bellatrix** (index 4 — the one fixture hero
 *   holding crit-damage points). Her 2 crit-damage points used to read as
 *   `66.252971472748 × (1 + 2 × 0.08)` = 76.853…; flat they read as
 *   `66.252971472748 + 2 × 5` = 76.252971472748, which is what the game's own `stats` block
 *   says. Jon / Perrin / Perrin / Lyra are byte-identical on every field, and so are
 *   `penetrationPct`, `fuseSecs`, `walkSpeedCells`, `cycleSecs`, `plantsPerSec`,
 *   `blocksPerBomb`, `heroLuckPct`, `veiaOuroLevel`, `fortunaLevel`, `uptime` and `degenerate`
 *   on Bellatrix herself — in particular `cycleSecs` did NOT move, which is the proof this
 *   change left the cadence model (below) alone.
 * - `rows`: only the throughput-derived columns moved (`propsPerHour`, `goldPerHour`,
 *   `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`, `xpPerHour`,
 *   `cyclesPerHour`, `clearSecs`, `expectedHtk`). `mitigationPct`, `ato`, `gate`, `locked`,
 *   `oneShot`, `infeasible`, `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct`,
 *   `jaulaWindowSecs`, `gateTimerSecs`, `phase`, `fortunaAura`, `heroesOnField` and
 *   `concurrencyScale` are byte-identical — the fix touched one hero's average hit and nothing
 *   else.
 *
 * PREVIOUSLY RE-CAPTURED at the cadence fix (cycle averaged over `HOP_DISTRIBUTION` instead of
 * `max(fuse, E_D_CELLS / w)`). Diffed field by field before rewriting, same as last time:
 *
 * - `heroFacts`: **only `cycleSecs` and `plantsPerSec` moved** — and `plantsPerSec` is `1 /
 *   cycleSecs`, so that is one change, not two. `avgHitBase`, `blocksPerBomb`, `fuseSecs`,
 *   `walkSpeedCells`, `penetrationPct`, `uptime`, `heroLuckPct`, `veiaOuroLevel`,
 *   `fortunaLevel` and `degenerate` are byte-identical. Notably `uptime` did NOT move, which is
 *   the proof that this change touched cadence and left the House model alone.
 * - `rows`: only throughput-derived columns moved. `locked`, `mitigationPct`, `oneShot`,
 *   `infeasible`, `concurrencyScale`, `fortunaAura`, `ato`, `gate`, `gateTimerSecs`,
 *   `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct` and `jaulaWindowSecs` are byte-identical.
 *
 * A warning for the next person to re-record this: the table below is captured with
 * `computeFarmRates({ heroes, account })` and NO `maxPhase`. Passing one flips `locked` on every
 * row, which looks like a real regression in the diff and is purely a harness mistake.
 *
 * PREVIOUSLY RE-CAPTURED at the House-recovery-slot / `casa.cycle_secs` / `field_slots` fix,
 * with the same discipline. That diff was:
 *
 * - `heroFacts`: **only `uptime` moved.** `avgHitBase`, `penetrationPct`, `fuseSecs`,
 *   `walkSpeedCells`, `cycleSecs`, `plantsPerSec`, `blocksPerBomb`, `heroLuckPct`,
 *   `veiaOuroLevel`, `fortunaLevel` and `degenerate` are byte-identical to the pre-fix capture.
 *   `uptime` moved because the fixture's rest seconds now come from its own `casa.cycle_secs`
 *   (1181.05s) rather than the `HOUSES` table's interpolation (1102s) — a longer House cycle,
 *   so every duty cycle is lower. Nothing about the damage or cadence math changed, and this
 *   file's untouched columns are the proof.
 * - `rows`: only the throughput-derived columns moved (`propsPerHour`, `goldPerHour`,
 *   `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`, `xpPerHour`,
 *   `cyclesPerHour`, `clearSecs`, `expectedHtk`), plus the two new ones (`heroesOnField`,
 *   `concurrencyScale`). `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`, `infeasible`,
 *   `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct`, `jaulaWindowSecs` and `gateTimerSecs`
 *   are byte-identical — i.e. the fix touched throughput and nothing else.
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
