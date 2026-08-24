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
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture();
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

describe('bestFarmPhase — infeasible rows never win', () => {
  it('an infeasible phase with the highest nominal rate is not picked — the fixture\'s own phase 50 gate', () => {
    const gateRow = computeFarmRateRow(50, squad)!;
    expect(gateRow.infeasible).toBe(true);

    const pick = bestFarmPhase(squad, goldObjective, scales, { maxPhase: null });
    expect(pick).not.toBeNull();
    expect(pick!.phase).not.toBe(50);
    expect(pick!.row.infeasible).toBe(false);
  });
});

describe('bestFarmPhase — the non-unimodality pin', () => {
  it('phase 51 is a strict local maximum under the current build (> phases 50 and 52)', () => {
    const row50 = computeFarmRateRow(50, squad)!;
    const row51 = computeFarmRateRow(51, squad)!;
    const row52 = computeFarmRateRow(52, squad)!;
    expect(row50.infeasible).toBe(true);
    expect(row51.infeasible).toBe(false);
    expect(row51.goldPerHour).toBeGreaterThan(row52.goldPerHour);
  });

  it('a stride-10 subsampled sweep returns a different, lower-valued phase than the full sweep', () => {
    const fullSweep = bestFarmPhase(squad, goldObjective, scales, { maxPhase: null });
    const strided = bestFarmPhase(squad, goldObjective, scales, { maxPhase: null, phaseStride: 10 });
    expect(fullSweep).not.toBeNull();
    expect(strided).not.toBeNull();
    expect(strided!.phase).not.toBe(fullSweep!.phase);
    expect(strided!.value).toBeLessThan(fullSweep!.value);
  });
});

describe('bestFarmPhase — changing the objective changes the pick', () => {
  it('the gold pick sits in 26–34 and the chest pick is phase 1', () => {
    // The band's upper edge moved 32 → 34 at the 2026-08-23 crit-chance ability shape: two of
    // this fixture's heroes carry Olho Clínico 20, so the squad hits harder and its gold argmax
    // walks up into phases it previously could not clear fast enough to be worth farming. The
    // claim this test makes is unchanged — the gold pick is a mid-game phase and the chest pick
    // is phase 1, and the two never coincide.
    const goldPick = bestFarmPhase(squad, goldObjective, scales, { maxPhase });
    const chestPick = bestFarmPhase(squad, chestObjective, scales, { maxPhase });
    expect(goldPick).not.toBeNull();
    expect(chestPick).not.toBeNull();
    expect(goldPick!.phase).toBeGreaterThanOrEqual(26);
    expect(goldPick!.phase).toBeLessThanOrEqual(34);
    expect(chestPick!.phase).toBe(1);
    expect(goldPick!.phase).not.toBe(chestPick!.phase);
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
