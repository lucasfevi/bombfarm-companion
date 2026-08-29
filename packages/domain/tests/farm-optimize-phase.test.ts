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
 * A RECORDED LOSS, not a weakening nobody noticed (issue #206). This block used to assert the
 * discriminating form — an infeasible row carrying the HIGHEST NOMINAL rate in the whole sweep is
 * still not picked, so a naive nominal argmax would have got it wrong. That case was a property
 * of the retired `save-20260813-5heroes.json` account, which was weak enough that its phase-50
 * gate was both unclearable and the best-paying row on the board.
 *
 * It does not reproduce on either in-regime capture, and this was measured before it was given
 * up rather than assumed: on `save-20260819-11882-7heroes.json` the best feasible row pays
 * 1,331,738/h against 574,153/h for the best infeasible one, and on the 11-hero 2026-08-25
 * capture it is 31,862,424 against 3,446,961. Both accounts clear far past their own gold peak,
 * so nothing infeasible is ever in contention. Weakening the roster does not create the case
 * either — cutting every hero's attack to a hundredth moves the infeasible boundary down but
 * moves the peak with it (measured across factors 0.5 down to 0.01).
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
  // The gold curve on this roster dips hard into phase 50 (578,613/h — a gate, cleared but slowly)
  // and spikes at 51 (1,331,738/h), then declines. Both neighbours are FEASIBLE here, where on the
  // retired roster the left neighbour was infeasible: the trough is what makes the curve
  // non-unimodal, and it does not need to be an unclearable phase to do it.
  it('phase 51 is a strict local maximum under the current build (> phases 50 and 52)', () => {
    const row50 = computeFarmRateRow(50, squad)!;
    const row51 = computeFarmRateRow(51, squad)!;
    const row52 = computeFarmRateRow(52, squad)!;
    expect(row51.infeasible).toBe(false);
    expect(row51.goldPerHour).toBeGreaterThan(row50.goldPerHour);
    expect(row51.goldPerHour).toBeGreaterThan(row52.goldPerHour);
  });

  // Stride 3, not stride 10: this roster's argmax is phase 51, and a stride-10 sweep starting at
  // phase 1 lands on 51 exactly, so it would have found the peak by luck and proved nothing.
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
  // RE-ASKED on the 2026-08-19 roster (issue #206): gold picks 51, chests picks 1. The retired
  // 2026-08-13 roster picked somewhere in 26–34, and pinning that band was always the weakest
  // part of this test — it is a property of one account's strength, not of the objective.
  //
  // What the two accounts agree on, and what is asserted instead, is the DIRECTION: chests want
  // the cheapest phase there is, because the chest rate is dominated by how many props you can
  // open per hour, while gold wants the deepest phase the squad can still clear quickly, because
  // gold per prop rises with phase. So the chest pick is phase 1 on both, the gold pick is
  // strictly deeper on both, and the two never coincide.
  it('the objectives pull opposite ways: chests pick phase 1, gold picks strictly deeper', () => {
    const goldPick = bestFarmPhase(squad, goldObjective, scales, { maxPhase });
    const chestPick = bestFarmPhase(squad, chestObjective, scales, { maxPhase });
    expect(goldPick).not.toBeNull();
    expect(chestPick).not.toBeNull();
    expect(chestPick!.phase).toBe(1);
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
