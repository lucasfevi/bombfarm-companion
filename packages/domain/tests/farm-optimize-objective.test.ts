/**
 * The objective layer: `resolveFarmObjective`, `farmObjectiveValue`. Phase argmax
 * (`bestFarmPhase`) is covered separately in `farm-optimize-phase.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveFarmObjective,
  farmObjectiveValue,
  bestFarmPhase,
  farmObjectiveScales,
  type FarmObjectiveScales,
} from '@bombfarm/domain/farm-optimize-objective';
import { computeHeroFarmFacts, computeSquadFarmFacts, computeFarmRateRow } from '@bombfarm/domain/farm-rate';
import { assertInRegime } from './helpers/capture-regime';
import { FARM_OPTIMIZE_FIXTURE, loadFarmRateFixture } from './helpers/farm-rate-fixtures';

assertInRegime(`sheet-math/${FARM_OPTIMIZE_FIXTURE}`, 'sheet');

const { heroes, account, maxPhase } = loadFarmRateFixture(FARM_OPTIMIZE_FIXTURE);
const heroFacts = computeHeroFarmFacts({ heroes, account });
const squad = computeSquadFarmFacts(heroFacts, account);
const row = computeFarmRateRow(1, squad, { maxPhase })!;

const scales: FarmObjectiveScales = { goldScale: row.goldPerHour, chestScale: row.chestsPerHour };

/** The design's own normalizer rule: each currency's scale is the CURRENT build's own best over
 *  the candidate phase set — never the row under test, or every norm trivially equals 1. */
function currentBuildScales(): FarmObjectiveScales {
  let goldScale = 0;
  let chestScale = 0;
  for (let phase = 1; phase <= (maxPhase ?? 600); phase++) {
    const candidate = computeFarmRateRow(phase, squad, { maxPhase });
    if (!candidate || candidate.infeasible) continue;
    if (candidate.goldPerHour > goldScale) goldScale = candidate.goldPerHour;
    if (candidate.chestsPerHour > chestScale) chestScale = candidate.chestsPerHour;
  }
  return { goldScale, chestScale };
}

describe('resolveFarmObjective — total, never throws', () => {
  it('gold and chests select the right column, weight reported as 1/0', () => {
    expect(resolveFarmObjective({ kind: 'gold' })).toEqual({ kind: 'gold', weight: 1, unit: 'goldPerHour' });
    expect(resolveFarmObjective({ kind: 'chests' })).toEqual({
      kind: 'chests',
      weight: 0,
      unit: 'chestsPerHour',
    });
  });

  it('blend at weight 0.5 resolves to a normalized blend', () => {
    expect(resolveFarmObjective({ kind: 'blend', weight: 0.5 })).toEqual({
      kind: 'blend',
      weight: 0.5,
      unit: 'normalized',
    });
  });

  it('blend at weight 1 resolves to the SAME object shape as gold', () => {
    expect(resolveFarmObjective({ kind: 'blend', weight: 1 })).toEqual(resolveFarmObjective({ kind: 'gold' }));
  });

  it('blend at weight 0 resolves to the SAME object shape as chests', () => {
    expect(resolveFarmObjective({ kind: 'blend', weight: 0 })).toEqual(resolveFarmObjective({ kind: 'chests' }));
  });

  it('weight NaN clamps to 1, -3 clamps to 0, 7 clamps to 1, undefined defaults to 1', () => {
    expect(resolveFarmObjective({ kind: 'blend', weight: NaN }).weight).toBe(1);
    expect(resolveFarmObjective({ kind: 'blend', weight: -3 }).weight).toBe(0);
    expect(resolveFarmObjective({ kind: 'blend', weight: 7 }).weight).toBe(1);
    expect(resolveFarmObjective({ kind: 'blend', weight: undefined }).weight).toBe(1);
  });

  it('a null objective defaults to gold, and never throws', () => {
    expect(resolveFarmObjective(null)).toEqual({ kind: 'gold', weight: 1, unit: 'goldPerHour' });
    expect(resolveFarmObjective(undefined)).toEqual({ kind: 'gold', weight: 1, unit: 'goldPerHour' });
    expect(() => resolveFarmObjective(null)).not.toThrow();
  });

  it('an unknown kind (cast through `as`) resolves to gold', () => {
    const bogus = { kind: 'diamonds' as unknown as 'gold' };
    expect(resolveFarmObjective(bogus)).toEqual({ kind: 'gold', weight: 1, unit: 'goldPerHour' });
  });
});

describe('farmObjectiveValue — each kind selects the right column', () => {
  it('gold selects row.goldPerHour', () => {
    expect(farmObjectiveValue(row, resolveFarmObjective({ kind: 'gold' }), scales)).toBe(row.goldPerHour);
  });

  it('chests selects row.chestsPerHour', () => {
    expect(farmObjectiveValue(row, resolveFarmObjective({ kind: 'chests' }), scales)).toBe(row.chestsPerHour);
  });

  it('blend at w=0.5 sits strictly between the two normalized endpoints', () => {
    // Phase 29 (the current build's gold-optimal phase) is neither currency's own best, so both
    // normalized terms are < 1 and unequal — the row used to derive `scales` (phase 1) would make
    // the blend collapse onto a single point, which is why the scales are the full-sweep maxima.
    const buildScales = currentBuildScales();
    const midRow = computeFarmRateRow(29, squad, { maxPhase })!;

    const goldValue = farmObjectiveValue(midRow, resolveFarmObjective({ kind: 'gold' }), buildScales);
    const chestValue = farmObjectiveValue(midRow, resolveFarmObjective({ kind: 'chests' }), buildScales);
    const blendValue = farmObjectiveValue(midRow, resolveFarmObjective({ kind: 'blend', weight: 0.5 }), buildScales);

    const goldNorm = goldValue / buildScales.goldScale;
    const chestNorm = chestValue / buildScales.chestScale;
    expect(goldNorm).not.toBe(chestNorm);
    const lo = Math.min(goldNorm, chestNorm);
    const hi = Math.max(goldNorm, chestNorm);
    expect(blendValue).toBeGreaterThan(lo);
    expect(blendValue).toBeLessThan(hi);
  });

  it('blend at w=1 produces the identical bestFarmPhase pick as gold', () => {
    const goldObjective = resolveFarmObjective({ kind: 'gold' });
    const blendObjective = resolveFarmObjective({ kind: 'blend', weight: 1 });
    const goldPick = bestFarmPhase(squad, goldObjective, scales, { maxPhase });
    const blendPick = bestFarmPhase(squad, blendObjective, scales, { maxPhase });
    expect(blendPick).toEqual(goldPick);
  });

  it('blend at w=0 produces the identical bestFarmPhase pick as chests', () => {
    const chestObjective = resolveFarmObjective({ kind: 'chests' });
    const blendObjective = resolveFarmObjective({ kind: 'blend', weight: 0 });
    const chestPick = bestFarmPhase(squad, chestObjective, scales, { maxPhase });
    const blendPick = bestFarmPhase(squad, blendObjective, scales, { maxPhase });
    expect(blendPick).toEqual(chestPick);
  });

  it('zero/absent scales make that blend term contribute 0, never NaN', () => {
    const zeroScales: FarmObjectiveScales = { goldScale: 0, chestScale: 0 };
    const value = farmObjectiveValue(row, resolveFarmObjective({ kind: 'blend', weight: 0.5 }), zeroScales);
    expect(value).toBe(0);
    expect(Number.isNaN(value)).toBe(false);
  });
});

describe('farmObjectiveScales — the frozen blend normalizers, exported (lifted from goldChestReadout)', () => {
  it('matches the manual per-currency best-over-phase scan (currentBuildScales) on the fixture', () => {
    const scan = currentBuildScales();
    const lifted = farmObjectiveScales(squad, { maxPhase });
    expect(lifted.goldScale).toBeCloseTo(scan.goldScale, 6);
    expect(lifted.chestScale).toBeCloseTo(scan.chestScale, 6);
  });

  /**
   * The drift canary: two constants nothing else in the suite pins, so any change to the
   * throughput model that nobody meant to make shows up here as a number moving.
   *
   * RE-BASED onto `save-20260819-11882-7heroes.json` (issue #206) — the retired 2026-08-13
   * capture had left its regime, and the pinned figures had been re-recorded six times as the
   * model moved beneath them. That whole history described the OLD roster and is preserved in
   * `docs/fixture-corpus.md` rather than carried forward here, where it would describe a fixture
   * this test no longer reads.
   *
   * BOTH scales are `…PerHour` maxima over the sweep — `goldPick.row.goldPerHour` and
   * `chestPick.row.chestsPerHour` — so anything that scales squad throughput moves both, and the
   * two moving by DIFFERENT factors is the interesting signal: it means the change was
   * phase-dependent and pushed the two currencies' argmax phases apart.
   *
   * Safe to re-record when the model genuinely moves, for the same reason as before: the sibling
   * test above is an independent brute-force scan that must still agree to 6 decimals, so a
   * re-record can only ever restate the model, never paper over a disagreement between the two
   * routes to it.
   */
  it('on the committed fixture (maxPhase 52): goldScale ≈ 1 331 737.54, chestScale ≈ 4.185706', () => {
    const scales = farmObjectiveScales(squad, { maxPhase });
    expect(scales.goldScale).toBeCloseTo(1331737.54, 1);
    expect(scales.chestScale).toBeCloseTo(4.185706, 5);
  });
});
