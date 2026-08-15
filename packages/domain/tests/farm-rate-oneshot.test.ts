/**
 * The one-shot boundary.
 *
 * `oneShot` is `true` iff every enabled hero clears `maxPropHp = line.hp × 3.2` (the highest
 * `hpMult` in `WIKI_PROPS`, `purple_crystal`). This is also the case the `hitsToKill` `ceil` in
 * `E[HTK]` exists to preserve — at `oneShot === true`, `expectedHtk === 1` exactly and
 * `propsPerHour` equals the pure plant rate (the "plant-rate-bound" claim).
 */
import { describe, expect, it } from 'vitest';
import { computeSquadFarmFacts, computeFarmRateRow, type HeroFarmFacts } from '@bombfarm/domain/farm-rate';
import { wikiPhaseLine } from '@bombfarm/domain/phase-wiki';
import { mitigationFactor, EFF_IA } from '@bombfarm/domain/model';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { account } = loadFarmRateFixture();
const MAX_HP_MULT = 3.2; // purple_crystal — the highest hpMult in WIKI_PROPS (design.md §2.2).

function syntheticHero(overrides: Partial<HeroFarmFacts> & { heroId: string }): HeroFarmFacts {
  return {
    heroName: overrides.heroId,
    avgHitBase: 100,
    penetrationPct: 0,
    fuseSecs: 2,
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

  it('at oneShot === true, expectedHtk === 1 exactly and propsPerHour equals the pure plant rate', () => {
    const mitF = mitigationFactor(line.mitig, 0);
    const avgHitBase = maxPropHp / mitF;
    const hero = syntheticHero({ heroId: 'exact', avgHitBase, plantsPerSec: 0.4, blocksPerBomb: 1.5, uptime: 1 });
    const squad = computeSquadFarmFacts([hero], { ...account, slots: 100 });
    const row = computeFarmRateRow(phase, squad)!;
    expect(row.oneShot).toBe(true);
    expect(row.expectedHtk).toBe(1);

    // `concurrencyScale` moved from the squad to the row when the House recovery-slot ceiling
    // landed (it is now `min(1, fieldSlots / heroesOnField)`, and `heroesOnField` is per-phase).
    // This hero is at uptime 1 ⇒ it asks the House for nothing ⇒ both ceilings are inert here.
    const pureRate = 3600 * row.concurrencyScale * (hero.plantsPerSec * hero.blocksPerBomb * EFF_IA * hero.uptime);
    expect(row.propsPerHour).toBeCloseTo(pureRate, 6);
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
