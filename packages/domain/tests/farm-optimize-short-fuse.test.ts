import { describe, expect, it } from 'vitest';
import { optimizeHeroForFarm } from '@bombfarm/domain/farm-hero-optimize';
import { computeHeroFarmBases, type HeroFarmBasis } from '@bombfarm/domain/farm-rate';
import { abilityMods, STAT_CAPS } from '@bombfarm/domain/model';
import { FARM_OPTIMIZE_FIXTURE, loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account, maxPhase } = loadFarmRateFixture(FARM_OPTIMIZE_FIXTURE);
const bases = computeHeroFarmBases({ heroes, account });

const CDR_PER_POINT = 0.5;
const BASE_SHEET_CDR = 60;
const SHORT_FUSE_RANK = 20;

function carrierBasis(basis: HeroFarmBasis, shortFuseRank: number): HeroFarmBasis {
  const sheetCdr = BASE_SHEET_CDR + abilityMods({ pavio_curto: shortFuseRank }).sheetCdrFlat;
  const effective = { ...basis.effective, cdr: sheetCdr };
  const effectiveDelta = { ...basis.effectiveDelta, cdr: CDR_PER_POINT };
  return {
    ...basis,
    effective,
    effectiveDelta,
    ...(basis.auraFree ? { auraFree: { ...basis.auraFree, effective, effectiveDelta } } : {}),
  };
}

function cdrPointsBought(shortFuseRank: number, heroId: string): number {
  const pool = bases.map((basis) => carrierBasis(basis, shortFuseRank));
  const own = pool.find((basis) => basis.heroId === heroId)!;
  const result = optimizeHeroForFarm({ bases: pool, account, heroId, maxPhase });
  return result.pts.cdr - own.pts.cdr;
}

const cdrBuyers = bases.filter((basis) => cdrPointsBought(0, basis.heroId) > 0);

describe('Short Fuse and the cooldown-reduction cap in the farm respec', () => {
  it('has heroes that buy cooldown reduction at all — otherwise the cases below are vacuous', () => {
    expect(cdrBuyers.length).toBeGreaterThan(0);
  });

  it('stops buying the moment the whole sheet, Short Fuse included, reaches the cap', () => {
    for (const rank of [0, SHORT_FUSE_RANK]) {
      const sheetStart = BASE_SHEET_CDR + abilityMods({ pavio_curto: rank }).sheetCdrFlat;
      const pointsToCap = Math.ceil((STAT_CAPS.cdr - sheetStart) / CDR_PER_POINT);
      for (const basis of cdrBuyers) {
        expect(cdrPointsBought(rank, basis.heroId), `${basis.heroName} at rank ${rank}`).toBeLessThanOrEqual(
          pointsToCap,
        );
      }
    }
  });

  it('a rank-20 carrier buys at least the cooldown points its flat bonus replaces fewer, most of them exactly that', () => {
    const replaced = abilityMods({ pavio_curto: SHORT_FUSE_RANK }).sheetCdrFlat / CDR_PER_POINT;
    const pointsToCapWithout = (STAT_CAPS.cdr - BASE_SHEET_CDR) / CDR_PER_POINT;
    const capBound = cdrBuyers.filter((basis) => cdrPointsBought(0, basis.heroId) === pointsToCapWithout);
    expect(capBound.length).toBeGreaterThan(0);
    const saved = capBound.map((basis) => pointsToCapWithout - cdrPointsBought(SHORT_FUSE_RANK, basis.heroId));
    for (const [index, points] of saved.entries()) expect(points, capBound[index].heroName).toBeGreaterThanOrEqual(replaced);
    expect(saved.filter((points) => points === replaced).length).toBeGreaterThan(capBound.length / 2);
  });
});
