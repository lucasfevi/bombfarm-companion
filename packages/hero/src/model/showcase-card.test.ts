import { describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { abilityIconRecipe, artFrameRecipe } from '@bombfarm/game-art';
import { showcaseEn } from '../copy';
import {
  SHOWCASE_ABILITY_GAP_PX,
  SHOWCASE_GEAR_GAP_PX,
  SHOWCASE_GEAR_SLOTS,
  SHOWCASE_MAX_ABILITIES,
  SHOWCASE_TILE_SIZE,
  gearAverageFigures,
  rowWidthPx,
  showcaseCardContentWidthPx,
  showcaseCardReading,
  showcaseTileWidthCss,
  showcaseTileWidthPx,
  squadGearAveragesText,
} from './showcase-card';
import { ZERO_SHEET, item, rowFixture } from './showcase.test-fixture';

const WINDOW = { min: 0, max: 100 };
const RANGES = {
  attack: WINDOW,
  energy: WINDOW,
  speed: WINDOW,
  luck: WINDOW,
  critChance: WINDOW,
  critDmg: WINDOW,
  penetration: WINDOW,
  cdr: WINDOW,
};

describe('showcaseCardReading', () => {
  it('reads the type, the birth grade placement and the two highest rolls off one hero', () => {
    const row = rowFixture({
      id: 'h',
      abilities: { olho_clinico: 20, golpe_brutal: 12, explosao_ampla: 3 },
      birth: { ...ZERO_SHEET, attack: 40, cdr: 97, critDmg: 94, luck: 50 },
      statRanges: RANGES,
    });
    const reading = showcaseCardReading(row);
    expect(reading.types).toEqual(['crit']);
    expect(reading.birth?.mean).toBeCloseTo((40 + 97 + 94 + 50) / 8, 6);
    expect(reading.birth?.railLetter).toBe(row.report?.computedLetter);
    expect(reading.highestRolls).toEqual([
      { key: 'cdr', percentile: 97 },
      { key: 'critDmg', percentile: 94 },
    ]);
  });

  it('reads the ladder against the stored grade the game gave the hero', () => {
    const row = rowFixture({ id: 's', rank: 'S', birth: { ...ZERO_SHEET, attack: 40 }, statRanges: RANGES });
    expect(showcaseCardReading(row).birth?.railLetter).toBe('S');
  });

  it('leaves the birth placement and highest rolls out for a hero nothing can be placed for', () => {
    const reading = showcaseCardReading(rowFixture({ id: 'bare' }));
    expect(reading.birth).toBeUndefined();
    expect(reading.highestRolls).toEqual([]);
    expect(reading.types).toEqual([]);
  });
});

describe('gearAverageFigures', () => {
  it('reads the average level and forge of what the hero wears, as whole numbers', () => {
    const loadout = { ...emptyLoadout(), arma: item(120, 12), elmo: item(129, 15, 'ember_elmo') };
    const { gear } = showcaseCardReading(rowFixture({ id: 'g', loadout }));
    expect(gearAverageFigures(gear, 'en')).toEqual({ level: '125', forge: '14' });
  });

  it('has no figures for a hero wearing nothing, rather than averaging nothing to zero', () => {
    const { gear } = showcaseCardReading(rowFixture({ id: 'naked' }));
    expect(gearAverageFigures(gear, 'en')).toBeUndefined();
  });
});

describe('squadGearAveragesText', () => {
  it('keeps one decimal of forge, and has no line for a squad wearing nothing', () => {
    expect(
      squadGearAveragesText({ itemCount: 80, averageLevel: 101.6, averageUpgrade: 13.14 }, showcaseEn, 'en'),
    ).toBe('Lv 102 · forged +13.1');
    expect(squadGearAveragesText({ itemCount: 0 }, showcaseEn, 'en')).toBeUndefined();
  });
});

describe('showcase card layout', () => {
  const narrowest = showcaseCardContentWidthPx();

  it('draws both icon rows at one size step, and that step takes its width from the card', () => {
    expect(SHOWCASE_TILE_SIZE).toBe('fluid');
    expect(artFrameRecipe({ size: SHOWCASE_TILE_SIZE, rarity: 2 })).toContain('w-(--art-tile)');
    expect(abilityIconRecipe({ size: SHOWCASE_TILE_SIZE })).toContain('size-(--art-tile)');
    expect(showcaseTileWidthCss()).toBe(
      `calc((100cqi - ${String((SHOWCASE_GEAR_SLOTS - 1) * SHOWCASE_GEAR_GAP_PX)}px) / ${String(SHOWCASE_GEAR_SLOTS)})`,
    );
  });

  it('fills the content width exactly with eight gear slots, at the narrowest card and a wide one', () => {
    for (const content of [narrowest, showcaseCardContentWidthPx(420)]) {
      expect(rowWidthPx(SHOWCASE_GEAR_SLOTS, showcaseTileWidthPx(content), SHOWCASE_GEAR_GAP_PX)).toBeCloseTo(content, 9);
    }
  });

  it('never draws a tile smaller than the fixed 32px one the card drew before it grew with its width', () => {
    expect(showcaseTileWidthPx(narrowest)).toBeGreaterThanOrEqual(32);
  });

  it('fits the largest ability pool on one row at the gear tile size, with room for the Wide Blast ring', () => {
    expect(
      rowWidthPx(SHOWCASE_MAX_ABILITIES, showcaseTileWidthPx(narrowest), SHOWCASE_ABILITY_GAP_PX),
    ).toBeLessThanOrEqual(narrowest);
  });
});
