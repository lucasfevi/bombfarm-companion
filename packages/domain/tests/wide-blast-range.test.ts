import { describe, expect, it } from 'vitest';
import { ABILITIES, abilityMods, blastDamageSpread, damageWeightedBlastRange, wholeRangeCells } from '@bombfarm/domain/model';
import { EXTRA_RANGE_FRAC } from '@bombfarm/domain/phase-wiki';
import wikiBundle from '@bombfarm/domain/data/phase-wiki.json' with { type: 'json' };
import { simulateClear, type ClearHero } from '../src/model/clear-time';
import { computeHeroFarmFacts } from '@bombfarm/domain/farm-rate';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';

const explosaoAmpla = ABILITIES.find((ability) => ability.id === 'explosao_ampla')!;
const perLevel = explosaoAmpla.effect.kind === 'rangeCells' ? explosaoAmpla.effect.perLevel : NaN;

describe('Explosão Ampla reaches whole cells only', () => {
  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [15, 1],
    [19, 1],
    [20, 2],
  ])('level %i adds %i cells of reach', (level, cells) => {
    expect(abilityMods({ explosao_ampla: level }).rangeCells).toBe(cells);
    expect(wholeRangeCells(perLevel, level)).toBe(cells);
  });

  it('a per-level step that lands on a whole cell in binary error still counts that cell', () => {
    expect(0.29 * 100).toBeLessThan(29);
    expect(wholeRangeCells(0.29, 100)).toBe(29);
  });

  it('the catalog and label copy name the levels the reach steps at, read off the rule', () => {
    const stepLevels = Array.from({ length: explosaoAmpla.max }, (_, index) => index + 1).filter(
      (level) => wholeRangeCells(perLevel, level) > wholeRangeCells(perLevel, level - 1),
    );
    expect(stepLevels).toEqual([10, 20]);
    expect(explosaoAmpla.effectText).toMatch(/níveis 10 e 20/);
  });
});

describe('blocks per bomb at a partial Explosão Ampla level', () => {
  const { heroes, account } = loadFarmRateFixture();
  const subject = heroes[0]!;

  function priced(level: number) {
    const hero = withAbilityLevels(subject, { explosao_ampla: level });
    const [facts] = computeHeroFarmFacts({ heroes: [hero], account, enabledHeroIds: [hero.id] });
    const pipeline = pipelineForHero(hero, account, 1, 0);
    return { facts: facts!, pipeline };
  }

  it('level 9 is priced as the base reach: 1.5 blocks, not 1.95', () => {
    const { facts, pipeline } = priced(9);
    expect(pipeline.context.blastRange).toBe(1);
    expect(facts.blocksPerBomb).toBe(1.5);
  });

  it('level 15 is priced at one extra cell: 2.0 blocks, not 2.25', () => {
    const { facts, pipeline } = priced(15);
    expect(pipeline.context.blastRange).toBe(2);
    expect(facts.blocksPerBomb).toBe(2);
  });

  it('active DPS does not move between levels that share a reach, and moves at the step by a half-damage cell', () => {
    const at = (level: number) => priced(level).pipeline.active;
    expect(at(9)).toBe(at(0));
    expect(at(19)).toBe(at(10));
    expect(at(10) / at(9)).toBeCloseTo(1.75 / 1.5, 12);
    expect(at(20) / at(9)).toBeCloseTo(2 / 1.5, 12);
  });

  it('blocks per bomb stays the geometry: a rank-20 carrier still strikes 2.5 blocks a bomb', () => {
    expect(priced(20).facts.blocksPerBomb).toBe(2.5);
  });
});

describe('the farm model agrees with the rule for tracked heroes at partial levels', () => {
  it.each([
    ['payload-20260812-8heroes.json', 'Devin', 5, 1],
    ['save-20260825-11heroes-one-shot-spread.json', 'Joric', 5, 1],
    ['save-20260831-13heroes-soulbound.json', 'WB c3', 17, 2],
  ])('%s: %s at Explosão Ampla %i reaches %i cells', (fixture, name, level, reach) => {
    const { heroes, account } = loadFarmRateFixture(fixture);
    const hero = heroes.find((candidate) => candidate.name === name)!;
    expect(hero.abilities?.explosao_ampla).toBe(level);

    const { context } = pipelineForHero(hero, account, 1, 0);
    expect(context.blastRange).toBe(1 + wholeRangeCells(perLevel, level));
    expect(context.blastRange).toBe(reach);

    const [facts] = computeHeroFarmFacts({ heroes, account, enabledHeroIds: [hero.id] });
    expect(facts!.blocksPerBomb).toBe(1 + 0.5 * reach);
  });
});

describe('the cells Wide Blast adds deal a share of the hit', () => {
  it('the share is the synced wiki bundle’s, and it is a half since the 2026-09-26 patch', () => {
    expect(EXTRA_RANGE_FRAC).toBe(wikiBundle.combat.extraRangeFrac);
    expect(EXTRA_RANGE_FRAC).toBe(0.5);
  });

  it.each([
    [1, 1, 1.5],
    [2, 1.5, 1.75],
    [3, 2, 2],
  ])('a reach of %i counts as %d cells of damage, spreading %d hits a blast', (reach, weighted, spread) => {
    expect(damageWeightedBlastRange(reach)).toBe(weighted);
    expect(blastDamageSpread(reach)).toBe(spread);
  });

  it('in the clear, the extra cells are worth their full count only when the half hit still kills', () => {
    // One prop type, no crits: at 250 the full and the half hit both one-shot a 100-HP prop; at
    // 100 the full hit does and the half needs two. The base cross cannot tell the two apart —
    // every hit it lands one-shots — so any difference is the extra cells alone.
    const props = [{ hp: 100, weight: 1 }];
    const squad = (blastCells: number, hitNoCrit: number): ClearHero[] =>
      Array.from({ length: 4 }, () => ({ presence: 0.9, fuseSecs: 1.85, walkSpeedCells: 2.8, blastCells, hitNoCrit, critChance: 0, critMult: 1 }));
    const clear = (blastCells: number, hit: number) => simulateClear(squad(blastCells, hit), props, 100).clearSecs;

    expect(clear(5, 250)).toBe(clear(5, 100));
    expect(clear(13, 250)).toBeLessThan(clear(13, 100));
    expect(clear(13, 100)).toBeLessThan(clear(5, 100));
  });
});
