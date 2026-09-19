/**
 * `bestFarmPhase` — the joint phase argmax: the candidate phase set, infeasible-row exclusion,
 * the non-unimodality pin, and objective-driven pick changes.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveFarmObjective,
  bestFarmPhase,
  type FarmObjectiveScales,
} from '@bombfarm/domain/farm-optimize-objective';
import {
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  computeFarmRateRow,
  type HeroFarmFacts,
} from '@bombfarm/domain/farm-rate';
import { FUSE_FLOOR, STAT_CAPS } from '@bombfarm/domain/model';
import { holdSuiteUntilInRegime } from './helpers/capture-regime';
import { FARM_OPTIMIZE_FIXTURE, loadFarmRateFixture } from './helpers/farm-rate-fixtures';

holdSuiteUntilInRegime(`sheet-math/${FARM_OPTIMIZE_FIXTURE}`, 'sheet');

const { heroes, account, maxPhase } = loadFarmRateFixture(FARM_OPTIMIZE_FIXTURE);
const heroFacts = computeHeroFarmFacts({ heroes, account });
const squad = computeSquadFarmFacts(heroFacts, account);

const goldObjective = resolveFarmObjective({ kind: 'gold' });
const chestObjective = resolveFarmObjective({ kind: 'chests' });

function fullSweepScales(): FarmObjectiveScales {
  let goldScale = 0;
  let chestScale = 0;
  for (let phase = 1; phase <= 600; phase++) {
    const row = computeFarmRateRow(phase, squad);
    if (!row || row.infeasible) continue;
    if (row.goldPerHour > goldScale) goldScale = row.goldPerHour;
    if (row.chestsPerHour > chestScale) chestScale = row.chestsPerHour;
  }
  return { goldScale, chestScale };
}
const scales = fullSweepScales();

describe('bestFarmPhase — maxPhase bounds the candidate set', () => {
  it('maxPhase: 42 ⇒ the pick is <= 42', () => {
    const pick = bestFarmPhase(squad, goldObjective, scales, { maxPhase: 42 });
    expect(pick).not.toBeNull();
    expect(pick!.phase).toBeLessThanOrEqual(42);
  });

  it.each([null, 0, -1, NaN])('maxPhase: %s ⇒ every phase in [1,600] is a candidate, no row excluded for being locked', (mp) => {
    const pick = bestFarmPhase(squad, goldObjective, scales, { maxPhase: mp as number | null });
    const unbounded = bestFarmPhase(squad, goldObjective, scales, { maxPhase: null });
    expect(pick).toEqual(unbounded);
  });
});

/**
 * A RECORDED LOSS, not a weakening nobody noticed. This block used to assert the discriminating
 * form — an infeasible row carrying the HIGHEST NOMINAL rate in the whole sweep is still not
 * picked, so a naive nominal argmax would have got it wrong. That case was a property of the
 * retired `save-20260813-5heroes.json` account, which was weak enough that its phase-50 gate was
 * both unclearable and the best-paying row on the board.
 *
 * It does not reproduce on any later capture, and this was measured before it was given up
 * rather than assumed: on this roster the best feasible row pays 30,449,438/h at phase 67 and
 * the first infeasible one (phase 150) 2,810,415/h; the same account's 2026-08-19 capture read
 * 1,331,738 against 574,153, and the 11-hero 2026-08-25 capture 31,862,424 against 3,446,961.
 * Every account clears far past its own gold peak, so nothing infeasible is ever in contention.
 * Weakening the roster does not create the case either — cutting every hero's attack to a
 * hundredth moves the infeasible boundary down but moves the peak with it (measured across
 * factors 0.5 down to 0.01).
 *
 * What is left is the claim without the discrimination: the pick is never infeasible, over a
 * sweep that genuinely contains infeasible rows. Restoring the stronger form needs an
 * early-account capture — a roster whose best-paying phase is one it cannot clear.
 */
describe('bestFarmPhase — infeasible rows never win', () => {
  it('the pick is never an infeasible row, over a sweep that contains plenty of them', () => {
    const infeasiblePhases: number[] = [];
    for (let phase = 1; phase <= 600; phase += 1) {
      const row = computeFarmRateRow(phase, squad);
      if (row?.infeasible) infeasiblePhases.push(phase);
    }
    expect(infeasiblePhases.length, 'no infeasible row in the sweep — this guard has no subject').toBeGreaterThan(10);

    const pick = bestFarmPhase(squad, goldObjective, scales, { maxPhase: null });
    expect(pick).not.toBeNull();
    expect(pick!.row.infeasible).toBe(false);
    expect(infeasiblePhases).not.toContain(pick!.phase);
  });
});

describe('bestFarmPhase — the non-unimodality pin', () => {
  // Every gate carves a trough into this roster's gold curve — cleared, but slowly — and the
  // row after it rebounds: 28,337,753/h at the phase-70 gate against 29,665,961 at 69 and
  // 29,925,804 at 71. That makes 71 a strict local maximum even though the global peak is 67
  // (30,449,438/h), four rows to its left. Both neighbours are FEASIBLE, where on the retired
  // roster the left neighbour was infeasible: the trough is what makes the curve non-unimodal,
  // and it does not need to be an unclearable phase to do it.
  it('phase 71 is a strict local maximum under the current build (> phases 70 and 72) that is not the global peak (65)', () => {
    const row70 = computeFarmRateRow(70, squad)!;
    const row71 = computeFarmRateRow(71, squad)!;
    const row72 = computeFarmRateRow(72, squad)!;
    expect(row70.gate).toBe(true);
    expect(row71.infeasible).toBe(false);
    expect(row71.goldPerHour).toBeGreaterThan(row70.goldPerHour);
    expect(row71.goldPerHour).toBeGreaterThan(row72.goldPerHour);
    const fullSweep = bestFarmPhase(squad, goldObjective, scales, { maxPhase: null });
    // RE-PINNED 2026-09-19 for the standing-props clear (ADR-017); the previous figure is in the git history.
    expect(fullSweep!.phase).toBe(65);
    expect(fullSweep!.value).toBeGreaterThan(row71.goldPerHour);
  });

  // Stride 4, not 3 or 10: this roster's argmax is phase 67 = 1 + 3 × 22, so a stride-3 sweep
  // starting at phase 1 lands on it exactly and would have found the peak by luck; stride 4's
  // grid (…, 65, 69, …) straddles it instead.
  it('a stride-3 subsampled sweep returns a different, lower-valued phase than the full sweep', () => {
    const fullSweep = bestFarmPhase(squad, goldObjective, scales, { maxPhase: null });
    const strided = bestFarmPhase(squad, goldObjective, scales, { maxPhase: null, phaseStride: 3 });
    expect(fullSweep).not.toBeNull();
    expect(strided).not.toBeNull();
    expect(strided!.phase).not.toBe(fullSweep!.phase);
    expect(strided!.value).toBeLessThan(fullSweep!.value);
  });
});

describe('bestFarmPhase — changing the objective changes the pick', () => {
  // Gold picks 67 and chests picks 1 here; the same account's 2026-08-19 capture picked 51 and
  // 1, and the retired 2026-08-13 roster somewhere in 26–34. Pinning the gold phase is the
  // weakest part of this test — it is a property of one account's strength, not of the
  // objective — so what is asserted is the DIRECTION every capture agrees on: chests want the
  // cheapest phase there is, because the chest rate is dominated by how many props you can open
  // per hour, while gold wants the deepest phase the squad can still clear quickly, because gold
  // per prop rises with phase. So the chest pick is phase 1, the gold pick is strictly deeper,
  // and the two never coincide.
  it('the objectives pull opposite ways: chests pick the first 75-prop map (51), gold picks strictly deeper', () => {
    const goldPick = bestFarmPhase(squad, goldObjective, scales, { maxPhase });
    const chestPick = bestFarmPhase(squad, chestObjective, scales, { maxPhase });
    expect(goldPick).not.toBeNull();
    expect(chestPick).not.toBeNull();
    // Chests follow props per hour alone, and under the standing-props clear a 75-prop map a
    // roster one-shots yields more props per hour than a 50-prop one: the head and the starved
    // tail are paid once per wave whatever the map holds.
    expect(chestPick!.phase).toBe(51);
    expect(goldPick!.phase).toBeGreaterThan(chestPick!.phase);
  });
});

describe('bestFarmPhase — no feasible phase at all ⇒ null, never a fabricated phase 1', () => {
  it('a fully degenerate squad (zero throughput) returns null', () => {
    const degenerateHero: HeroFarmFacts = {
      heroId: 'degenerate',
      heroName: 'Degenerate',
      avgHitBase: 0,
      penetrationPct: 0,
      fuseSecs: 2,
      fuseFloorSecs: FUSE_FLOOR,
      cdrCapPct: STAT_CAPS.cdr,
      walkSpeedCells: 0,
      cycleSecs: Infinity,
      plantsPerSec: 0,
      blocksPerBomb: 1.5,
      uptime: 0.5,
      heroLuckPct: 0,
      veiaOuroLevel: 0,
      fortunaLevel: 0,
      degenerate: true,
    };
    const degenerateSquad = computeSquadFarmFacts([degenerateHero], account);
    const pick = bestFarmPhase(degenerateSquad, goldObjective, { goldScale: 1, chestScale: 1 }, { maxPhase: null });
    expect(pick).toBeNull();
  });
});
