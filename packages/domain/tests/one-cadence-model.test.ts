/**
 * One bombing-cadence model behind every DPS figure (apps/web/docs/adr/016).
 *
 * The advisor's `bombsPerSecond` and the farm board's per-band `plantsPerSecByAto` are the same
 * function of the same sheet, so a hero's Combat-stage bombs/s and its farm-board plants/s at
 * the same difficulty band are one number. These are self-comparisons between two shipped paths
 * on a fixture roster — no committed figure, so nothing here expires with a capture regime.
 */
import { describe, expect, it } from 'vitest';
import {
  bombsPerSecond,
  cycleSecondsForHero,
  fuseSeconds,
  GRID_SPEED_COEF,
  rankNextPoint,
  sustainedDps,
} from '@bombfarm/domain/model';
import { cycleSecondsForHero as farmCycleSecondsForHero, computeHeroFarmBases, heroFactsFromBasis } from '@bombfarm/domain/farm-rate';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { phaseLine } from '@bombfarm/domain/phases';
import { phaseMapCoord } from '@bombfarm/domain/phase-wiki';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();

describe('the advisor prices bombs/s on the farm board’s measured cycle', () => {
  it('farm-rate re-exports the model’s own cycleSecondsForHero, not a copy', () => {
    expect(farmCycleSecondsForHero).toBe(cycleSecondsForHero);
  });

  it.each([26, 51, 151, 301, 451])(
    'phase %i: every fixture hero’s pipeline bombs/s equals 1 / cycleSecondsForHero at that phase’s band',
    (phase) => {
      const line = phaseLine(phase)!;
      const ato = phaseMapCoord(phase)!.ato;
      for (const hero of heroes) {
        const pipeline = pipelineForHero(hero, account, phase, line.mitig * 100);
        expect(pipeline.context.ato).toBe(ato);
        const cycle = cycleSecondsForHero(
          fuseSeconds(pipeline.effective.cdr),
          pipeline.effective.speed * GRID_SPEED_COEF,
          ato,
        );
        expect(bombsPerSecond(pipeline.effective, pipeline.context)).toBe(1 / cycle);
      }
    },
  );

  it('the farm board’s plantsPerSecByAto for a hero is the advisor’s bombs/s at that band, bit for bit', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    expect(bases.length).toBeGreaterThan(0);
    for (const basis of bases) {
      const facts = heroFactsFromBasis(basis, basis.pts);
      for (let ato = 1; ato <= 5; ato++) {
        expect(bombsPerSecond(basis.effective, { ...basis.context, ato })).toBe(facts.plantsPerSecByAto?.[ato - 1]);
      }
    }
  });
});

describe('Speed is a throughput stat under the shared cycle', () => {
  it('+10 Speed raises sustained DPS for every fixture hero at its farm phase', () => {
    const phase = account.context.phase ?? 1;
    const mitigationPct = phaseLine(phase)!.mitig * 100;
    for (const hero of heroes) {
      const { effective, context } = pipelineForHero(hero, account, phase, mitigationPct);
      expect(sustainedDps({ ...effective, speed: effective.speed + 10 }, context)).toBeGreaterThan(
        sustainedDps(effective, context),
      );
    }
  });

  it('a Speed point scores above zero in the next-point ranking for every fixture hero', () => {
    const phase = account.context.phase ?? 1;
    const mitigationPct = phaseLine(phase)!.mitig * 100;
    for (const hero of heroes) {
      const { ranking } = pipelineForHero(hero, account, phase, mitigationPct);
      expect(ranking.find((row) => row.stat === 'speed')!.gainPct).toBeGreaterThan(0);
    }
  });

  it('rankNextPoint reads the band: the same hero ranks Speed differently at a denser band', () => {
    const phase = account.context.phase ?? 1;
    const mitigationPct = phaseLine(phase)!.mitig * 100;
    const { effective, context } = pipelineForHero(heroes[0], account, phase, mitigationPct);
    const speedGain = (ato: number) =>
      rankNextPoint(effective, { ...context, ato }).find((row) => row.stat === 'speed')!.gainPct;
    expect(speedGain(5)).not.toBe(speedGain(1));
  });
});
