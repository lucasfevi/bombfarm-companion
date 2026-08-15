/**
 * The cost sensor for `rankNextPointForFarm`: zero pipeline calls during ranking, one pipeline
 * call per pool hero during basis extraction, and a bounded phase-sweep budget. Lives in its own
 * file because `energySwitchPointCallCount` is module-global mutable state (`advisor-pipeline.ts`)
 * — every `computeAdvisorPipeline` call (and therefore every `pipelineForHero` call) increments
 * it exactly once, which makes its delta an exact pipeline-call counter. Sharing a file with
 * parallel tests that also drive the pipeline would make the delta assertions flaky.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  rankNextPointForFarm,
  computeHeroFarmBases,
  FARM_RANK_MAX_EVALUATIONS,
} from '@bombfarm/domain/farm-point-rank';
import {
  energySwitchPointCallCount,
  resetEnergySwitchPointCallCount,
} from '@bombfarm/domain/advisor-pipeline';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();

beforeEach(() => {
  resetEnergySwitchPointCallCount();
});

describe('pipeline-call sensor', () => {
  it('basis extraction spends exactly one pipeline call per enabled hero (5-hero pool)', () => {
    resetEnergySwitchPointCallCount();
    computeHeroFarmBases({ heroes, account });
    expect(energySwitchPointCallCount).toBe(heroes.length);
  });

  it('a two-hero pool spends exactly 2 — rules out a hardcoded constant', () => {
    const twoIds = heroes.slice(0, 2).map((h) => h.id);
    resetEnergySwitchPointCallCount();
    computeHeroFarmBases({ heroes, account, enabledHeroIds: twoIds });
    expect(energySwitchPointCallCount).toBe(2);
  });

  it('a full rankNextPointForFarm call spends ZERO pipeline calls — bases are already extracted', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    const bellatrix = heroes.find((h) => h.name === 'Bellatrix')!;
    resetEnergySwitchPointCallCount();
    const result = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, maxPhase: 42 });
    expect(result.outcome).toBe('ranked');
    expect(energySwitchPointCallCount).toBe(0);
  });

  it('a full rankNextPointForFarm call under a blend objective still spends zero pipeline calls', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    const bellatrix = heroes.find((h) => h.name === 'Bellatrix')!;
    resetEnergySwitchPointCallCount();
    rankNextPointForFarm({ bases, account, heroId: bellatrix.id, objective: { kind: 'blend', weight: 0.5 }, maxPhase: 42 });
    expect(energySwitchPointCallCount).toBe(0);
  });
});

describe('evaluation budget — exact counts, at both a bounded and an unbounded maxPhase', () => {
  const bases = computeHeroFarmBases({ heroes, account });
  const bellatrix = heroes.find((h) => h.name === 'Bellatrix')!;

  it.each([42, 600])('gold: exactly 8 evaluations at maxPhase %i', (mp) => {
    const result = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, objective: { kind: 'gold' }, maxPhase: mp });
    expect(result.evaluations).toBe(8);
    expect(result.evaluations).toBeLessThanOrEqual(FARM_RANK_MAX_EVALUATIONS);
  });

  it.each([42, 600])('chests: exactly 8 evaluations at maxPhase %i', (mp) => {
    const result = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, objective: { kind: 'chests' }, maxPhase: mp });
    expect(result.evaluations).toBe(8);
    expect(result.evaluations).toBeLessThanOrEqual(FARM_RANK_MAX_EVALUATIONS);
  });

  it.each([42, 600])('blend: exactly 10 evaluations at maxPhase %i (the 2 extra frozen-scale sweeps)', (mp) => {
    const result = rankNextPointForFarm({
      bases,
      account,
      heroId: bellatrix.id,
      objective: { kind: 'blend', weight: 0.5 },
      maxPhase: mp,
    });
    expect(result.evaluations).toBe(10);
    expect(result.evaluations).toBeLessThanOrEqual(FARM_RANK_MAX_EVALUATIONS);
  });

  it('never exceeds FARM_RANK_MAX_EVALUATIONS across every objective kind, regardless of outcome', () => {
    for (const objective of [{ kind: 'gold' as const }, { kind: 'chests' as const }, { kind: 'blend' as const, weight: 0.3 }]) {
      for (const mp of [1, 5, 42, 600]) {
        const result = rankNextPointForFarm({ bases, account, heroId: bellatrix.id, objective, maxPhase: mp });
        expect(result.evaluations).toBeLessThanOrEqual(FARM_RANK_MAX_EVALUATIONS);
      }
    }
  });
});
