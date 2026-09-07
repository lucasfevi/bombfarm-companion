import { describe, expect, it } from 'vitest';
import { computeHeroFarmFacts, farmPricedAccount } from '@bombfarm/domain/farm-rate';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { FUSE_FLOOR, STAT_CAPS } from '@bombfarm/domain/model';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();
const priced = farmPricedAccount({ heroes, account });

describe('farm facts carry the fuse floor and the cooldown cap beside the fuse', () => {
  it('reports both constants on every hero, each as itself', () => {
    const facts = computeHeroFarmFacts({ heroes, account });
    expect(facts.length).toBeGreaterThan(0);

    for (const fact of facts) {
      expect(fact.fuseFloorSecs).toBe(FUSE_FLOOR);
      expect(fact.cdrCapPct).toBe(STAT_CAPS.cdr);
    }
  });

  it('never reports a fuse below the floor it also reports', () => {
    for (const fact of computeHeroFarmFacts({ heroes, account })) {
      expect(fact.fuseSecs).toBeGreaterThanOrEqual(fact.fuseFloorSecs);
    }
  });

  it('agrees with the per-hero combat result on the fuse and on both constants', () => {
    for (const fact of computeHeroFarmFacts({ heroes, account })) {
      const pipeline = pipelineForHero(heroes.find((h) => h.id === fact.heroId)!, priced, 1, 0);
      expect(fact.fuseSecs).toBe(pipeline.fuseSecs);
      expect(fact.fuseFloorSecs).toBe(pipeline.fuseFloorSecs);
      expect(fact.cdrCapPct).toBe(pipeline.cdrCapPct);
    }
  });
});
