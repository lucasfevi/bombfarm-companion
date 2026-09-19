/**
 * The one-shot boundary.
 *
 * `oneShot` is `true` iff every enabled hero clears `maxPropHp = line.hp × 3.2` (the highest
 * `hpMult` in `WIKI_PROPS`, `purple_crystal`). This is also the case the `hitsToKill` `ceil` in
 * `E[HTK]` exists to preserve — at `oneShot === true`, `expectedHtk === 1` exactly and the
 * STEADY-STATE part of the clear runs at the pure plant rate (the "plant-rate-bound" claim).
 * Not the whole clear: it also pays the head the squad spends coming up to speed, which no plant
 * rate can shorten.
 */
import { describe, expect, it } from 'vitest';
import {
  computeSquadFarmFacts,
  computeFarmRateRow,
  clearHeadSeconds,
  type HeroFarmFacts,
} from '@bombfarm/domain/farm-rate';
import { wikiPhaseLine, propCountForAto } from '@bombfarm/domain/phase-wiki';
import { mitigationFactor, EFF_IA, FUSE_FLOOR, STAT_CAPS } from '@bombfarm/domain/model';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { account } = loadFarmRateFixture();
const MAX_HP_MULT = 3.2; // purple_crystal — the highest hpMult in WIKI_PROPS.

function syntheticHero(overrides: Partial<HeroFarmFacts> & { heroId: string }): HeroFarmFacts {
  return {
    heroName: overrides.heroId,
    avgHitBase: 100,
    penetrationPct: 0,
    fuseSecs: 2,
    fuseFloorSecs: FUSE_FLOOR,
    cdrCapPct: STAT_CAPS.cdr,
    walkSpeedCells: 2,
    cycleSecs: 2,
    plantsPerSec: 0.5,
    blocksPerBomb: 1.5,
    uptime: 1,
    heroLuckPct: 0,
    veiaOuroLevel: 0,
    fortunaLevel: 0,
    degenerate: false,
    ...overrides,
  };
}

describe('oneShot boundary', () => {
  const phase = 42;
  const line = wikiPhaseLine(phase)!;
  const maxPropHp = line.hp * MAX_HP_MULT;

  it('avgHit === maxPropHp (exact boundary) ⇒ oneShot true', () => {
    // Solve for avgHitBase so that avgHitBase × mitF === maxPropHp exactly.
    const mitF = mitigationFactor(line.mitig, 0);
    const avgHitBase = maxPropHp / mitF;
    const hero = syntheticHero({ heroId: 'exact', avgHitBase });
    const squad = computeSquadFarmFacts([hero], { ...account, slots: 100 });
    const row = computeFarmRateRow(phase, squad)!;
    expect(row.oneShot).toBe(true);
  });

  it('one ulp below the boundary ⇒ oneShot false', () => {
    const mitF = mitigationFactor(line.mitig, 0);
    const avgHitBase = (maxPropHp - Number.EPSILON * maxPropHp) / mitF;
    const hero = syntheticHero({ heroId: 'below', avgHitBase });
    const squad = computeSquadFarmFacts([hero], { ...account, slots: 100 });
    const row = computeFarmRateRow(phase, squad)!;
    expect(row.oneShot).toBe(false);
  });

  it('at oneShot === true, expectedHtk === 1 and the clear is cadence alone: more damage buys nothing', () => {
    const mitF = mitigationFactor(line.mitig, 0);
    const avgHitBase = maxPropHp / mitF;
    const hero = syntheticHero({ heroId: 'exact', avgHitBase, plantsPerSec: 0.4, blocksPerBomb: 1.5, uptime: 1 });
    const squad = computeSquadFarmFacts([hero], { ...account, slots: 100 });
    const row = computeFarmRateRow(phase, squad)!;
    expect(row.oneShot).toBe(true);
    expect(row.expectedHtk).toBeCloseTo(1, 12);
    expect(row.clearSecs).toBeGreaterThan(clearHeadSeconds(0, 0));
    const doubled = computeFarmRateRow(
      phase,
      computeSquadFarmFacts([{ ...hero, avgHitBase: avgHitBase * 2 }], { ...account, slots: 100 }),
    )!;
    expect(doubled.clearSecs).toBeCloseTo(row.clearSecs, 9);
    expect(row.propsPerHour).toBeLessThan((3600 * propCountForAto(row.ato)) / EFF_IA / row.clearSecs);
  });

  it('empty pool ⇒ oneShot false (not a vacuous true)', () => {
    const squad = computeSquadFarmFacts([], account);
    const row = computeFarmRateRow(phase, squad)!;
    expect(row.oneShot).toBe(false);
  });

  it('one hero one-shots, another does not ⇒ oneShot false (every enabled hero must clear it)', () => {
    const mitF = mitigationFactor(line.mitig, 0);
    const strong = syntheticHero({ heroId: 'strong', avgHitBase: maxPropHp / mitF });
    const weak = syntheticHero({ heroId: 'weak', avgHitBase: 1 });
    const squad = computeSquadFarmFacts([strong, weak], { ...account, slots: 100 });
    const row = computeFarmRateRow(phase, squad)!;
    expect(row.oneShot).toBe(false);
  });
});
