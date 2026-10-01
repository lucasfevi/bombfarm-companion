/**
 * The set objective at the phase-argmax layer: one set's chests per hour, over that set's band,
 * with a clear-time cap.
 *
 * Every claim here is arithmetic over a squad — which phases are candidates, what a row is worth,
 * which rows a cap removes — so it holds whatever the game has since patched and is not gated on
 * the capture's regime. The squads come from captures only because they are realistic, not
 * because any figure is pinned.
 */
import { describe, expect, it } from 'vitest';
import {
  bestFarmPhase,
  farmObjectiveValue,
  fastestClearPhase,
  resolveFarmObjective,
  type BestFarmPhaseOptions,
  type FarmObjectiveScales,
} from '@bombfarm/domain/farm-optimize-objective';
import {
  computeFarmRateRow,
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  type SquadFarmFacts,
} from '@bombfarm/domain/farm-rate';
import { itemLevelsForPhase } from '@bombfarm/domain/phase-wiki';
import { SET_FARM_MAX_CLEAR_SECS, SET_FARM_SETS, setFarmBand } from '@bombfarm/domain/team-plan';
import { FARM_OPTIMIZE_FIXTURE, loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const SCALES: FarmObjectiveScales = { goldScale: 1, chestScale: 1 };

function squadOf(file: string): { squad: SquadFarmFacts; maxPhase: number } {
  const { heroes, account, maxPhase } = loadFarmRateFixture(file);
  if (maxPhase == null) throw new Error(`${file} carries no maxPhase`);
  return { squad: computeSquadFarmFacts(computeHeroFarmFacts({ heroes, account }), account), maxPhase };
}

/** Fast clears on its low phases, slow past ~phase 50 — both sides of the cap in one squad. */
const { squad, maxPhase } = squadOf(FARM_OPTIMIZE_FIXTURE);

function setOptions(setId: string, overrides: Partial<BestFarmPhaseOptions> = {}): BestFarmPhaseOptions {
  const band = setFarmBand(setId)!;
  return {
    maxPhase,
    phaseRange: { min: band.minPhase, max: band.maxPhase },
    maxClearSecs: SET_FARM_MAX_CLEAR_SECS,
    ...overrides,
  };
}

function setObjective(setId: string) {
  return resolveFarmObjective({ kind: 'setChests', itemLevel: setFarmBand(setId)!.itemLevel });
}

/** Every row the brute force would consider, independently of `bestFarmPhase`'s own loop. */
function bruteForceBest(setId: string, maxClearSecs: number) {
  const band = setFarmBand(setId)!;
  const objective = setObjective(setId);
  let best: { phase: number; value: number } | null = null;
  for (let phase = band.minPhase; phase <= Math.min(band.maxPhase, maxPhase); phase++) {
    const row = computeFarmRateRow(phase, squad, { maxPhase })!;
    if (row.infeasible || row.clearSecs > maxClearSecs) continue;
    const value = farmObjectiveValue(row, objective, SCALES);
    if (best === null || value > best.value) best = { phase, value };
  }
  return best;
}

describe('resolveFarmObjective — the set kind', () => {
  it('carries its item level and reads chests per hour', () => {
    expect(resolveFarmObjective({ kind: 'setChests', itemLevel: 30 })).toEqual({
      kind: 'setChests',
      weight: 0,
      unit: 'chestsPerHour',
      itemLevel: 30,
    });
  });

  it('without a usable item level it names no set and falls back to all chests, never throws', () => {
    for (const itemLevel of [undefined, 0, -10, NaN, Infinity]) {
      expect(resolveFarmObjective({ kind: 'setChests', itemLevel })).toEqual(resolveFarmObjective({ kind: 'chests' }));
    }
  });
});

describe('farmObjectiveValue — a set is worth its share of the phase’s chests', () => {
  it('a phase rolling only this level pays every chest, an overlap half, any other phase none', () => {
    let sawWhole = false;
    let sawHalf = false;
    let sawNone = false;
    for (let phase = 1; phase <= 120; phase++) {
      const row = computeFarmRateRow(phase, squad, { maxPhase })!;
      const levels = itemLevelsForPhase(phase);
      const value = farmObjectiveValue(row, resolveFarmObjective({ kind: 'setChests', itemLevel: 30 }), SCALES);
      if (!levels.includes(30)) {
        expect(value, `phase ${phase}`).toBe(0);
        sawNone = true;
      } else if (levels.length === 1) {
        expect(value, `phase ${phase}`).toBe(row.chestsPerHour);
        sawWhole = true;
      } else {
        expect(value, `phase ${phase}`).toBeCloseTo(row.chestsPerHour / 2, 12);
        sawHalf = true;
      }
    }
    expect([sawWhole, sawHalf, sawNone]).toEqual([true, true, true]);
  });
});

describe('bestFarmPhase — the band sweep under a clear cap', () => {
  for (const setId of SET_FARM_SETS.filter((id) => setFarmBand(id)!.minPhase <= maxPhase)) {
    it(`${setId}: the pick is the brute-force best inside the band, unlocked, and clears inside the cap`, () => {
      const band = setFarmBand(setId)!;
      const pick = bestFarmPhase(squad, setObjective(setId), SCALES, setOptions(setId));
      const reference = bruteForceBest(setId, SET_FARM_MAX_CLEAR_SECS);
      expect(pick?.phase ?? null).toBe(reference?.phase ?? null);
      if (pick === null) return;
      expect(pick.phase).toBeGreaterThanOrEqual(band.minPhase);
      expect(pick.phase).toBeLessThanOrEqual(Math.min(band.maxPhase, maxPhase));
      expect(pick.row.clearSecs).toBeLessThanOrEqual(SET_FARM_MAX_CLEAR_SECS);
      expect(pick.value).toBeGreaterThan(0);
    });
  }

  it('non-vacuity: the sweep above finds a farmable phase for several sets on this squad', () => {
    const farmable = SET_FARM_SETS.filter(
      (setId) => bestFarmPhase(squad, setObjective(setId), SCALES, setOptions(setId)) !== null,
    );
    expect(farmable.length).toBeGreaterThanOrEqual(3);
  });

  it('the cap is load-bearing on this squad: lifting it moves at least one set to a slower phase', () => {
    const moved = SET_FARM_SETS.filter((setId) => setFarmBand(setId)!.minPhase <= maxPhase).some((setId) => {
      const capped = bestFarmPhase(squad, setObjective(setId), SCALES, setOptions(setId));
      const uncapped = bestFarmPhase(squad, setObjective(setId), SCALES, setOptions(setId, { maxClearSecs: null }));
      return uncapped !== null && uncapped.row.clearSecs > SET_FARM_MAX_CLEAR_SECS && capped?.phase !== uncapped.phase;
    });
    expect(moved).toBe(true);
  });

  it('prefers a phase that rolls only this set over an overlap phase when their clears are comparable', () => {
    // 'gold' drops on 21–50: 21–30 share with the set below, 41–50 with the set above.
    const band = setFarmBand('gold')!;
    const rows = [];
    for (let phase = band.minPhase; phase <= band.maxPhase; phase++) rows.push(computeFarmRateRow(phase, squad, { maxPhase })!);
    const chests = rows.map((row) => row.chestsPerHour);
    // Non-vacuity: within a factor of two everywhere, so the halved share is what decides.
    expect(Math.max(...chests) / Math.min(...chests)).toBeLessThan(2);
    const pick = bestFarmPhase(squad, setObjective('gold'), SCALES, setOptions('gold'));
    expect(pick).not.toBeNull();
    expect(itemLevelsForPhase(pick!.phase)).toEqual([band.itemLevel]);
  });

  it('a band wholly above maxPhase has no candidate, and the fallback names its first phase', () => {
    const above = SET_FARM_SETS.find((id) => setFarmBand(id)!.minPhase > maxPhase)!;
    expect(bestFarmPhase(squad, setObjective(above), SCALES, setOptions(above))).toBeNull();
    expect(fastestClearPhase(squad, setOptions(above))).toBe(setFarmBand(above)!.minPhase);
  });

  it('nothing inside the cap ⇒ no pick, and the fallback is the band phase the squad clears fastest', () => {
    const options = setOptions('ember', { maxClearSecs: 1 });
    expect(bestFarmPhase(squad, setObjective('ember'), SCALES, options)).toBeNull();
    const fallback = fastestClearPhase(squad, options)!;
    const band = setFarmBand('ember')!;
    const fastest = Math.min(
      ...Array.from({ length: band.maxPhase - band.minPhase + 1 }, (_, i) =>
        computeFarmRateRow(band.minPhase + i, squad, { maxPhase })!.clearSecs,
      ),
    );
    expect(computeFarmRateRow(fallback, squad, { maxPhase })!.clearSecs).toBe(fastest);
  });

  it('the cap applies to a pinned phase too', () => {
    const slow = bestFarmPhase(squad, resolveFarmObjective({ kind: 'chests' }), SCALES, {
      maxPhase,
      pinnedPhase: maxPhase,
    });
    expect(slow, 'non-vacuity: the account’s top phase clears at all').not.toBeNull();
    expect(slow!.row.clearSecs).toBeGreaterThan(SET_FARM_MAX_CLEAR_SECS);
    expect(
      bestFarmPhase(squad, resolveFarmObjective({ kind: 'chests' }), SCALES, {
        maxPhase,
        pinnedPhase: maxPhase,
        maxClearSecs: SET_FARM_MAX_CLEAR_SECS,
      }),
    ).toBeNull();
  });

  it('absent range and cap leave the gold argmax exactly as it was', () => {
    const gold = resolveFarmObjective({ kind: 'gold' });
    for (const exhaustive of [false, true]) {
      const plain = bestFarmPhase(squad, gold, SCALES, { maxPhase, exhaustive });
      const withNulls = bestFarmPhase(squad, gold, SCALES, { maxPhase, exhaustive, phaseRange: null, maxClearSecs: null });
      expect(withNulls).toEqual(plain);
    }
  });
});
