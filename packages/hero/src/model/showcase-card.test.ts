import { describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { showcaseEn, showcasePtBR } from '../copy';
import {
  SHOWCASE_ABILITY_GAP_PX,
  SHOWCASE_ABILITY_TILE_PX,
  SHOWCASE_GEAR_GAP_PX,
  SHOWCASE_GEAR_SLOTS,
  SHOWCASE_GEAR_TILE_PX,
  SHOWCASE_MAX_ABILITIES,
  averageItemLevelText,
  rowWidthPx,
  showcaseCardContentWidthPx,
  showcaseCardReading,
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
  it('reads the type, the birth roll and the highest rolls off one hero', () => {
    const row = rowFixture({
      id: 'h',
      abilities: { olho_clinico: 20, golpe_brutal: 12, explosao_ampla: 3 },
      birth: { ...ZERO_SHEET, attack: 40, cdr: 97, critDmg: 94, luck: 50 },
      statRanges: RANGES,
    });
    const reading = showcaseCardReading(row, showcaseEn, 'en');
    expect(reading.types).toEqual(['crit']);
    expect(reading.birthRollPct).toBeCloseTo((40 + 97 + 94 + 50) / 8, 6);
    expect(reading.highestRolls).toBe('Highest rolls: CDR 97%, Crit DMG 94%');
  });

  it('leaves the birth roll and highest rolls out for a hero nothing can be placed for', () => {
    const reading = showcaseCardReading(rowFixture({ id: 'bare' }), showcaseEn, 'en');
    expect(reading.birthRollPct).toBeUndefined();
    expect(reading.highestRolls).toBeUndefined();
    expect(reading.types).toEqual([]);
  });
});

describe('averageItemLevelText', () => {
  it('prints the average level and forge of what the hero wears, as whole numbers', () => {
    const loadout = { ...emptyLoadout(), arma: item(120, 12), elmo: item(129, 15, 'ember_elmo') };
    const { gear } = showcaseCardReading(rowFixture({ id: 'g', loadout }), showcaseEn, 'en');
    expect(averageItemLevelText(gear, showcaseEn, 'en')).toBe('Average item level 125 · +14');
    expect(averageItemLevelText(gear, showcasePtBR, 'pt')).toBe('Nível médio dos itens 125 · +14');
  });

  it('says nothing is equipped rather than averaging nothing to zero', () => {
    const { gear } = showcaseCardReading(rowFixture({ id: 'naked' }), showcaseEn, 'en');
    expect(averageItemLevelText(gear, showcaseEn, 'en')).toBe('Nothing equipped');
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
  it('fits the largest ability pool on one row at the narrowest card width', () => {
    expect(rowWidthPx(SHOWCASE_MAX_ABILITIES, SHOWCASE_ABILITY_TILE_PX, SHOWCASE_ABILITY_GAP_PX)).toBeLessThanOrEqual(
      showcaseCardContentWidthPx(),
    );
  });

  it('fits all eight gear slots on one row at the narrowest card width', () => {
    expect(rowWidthPx(SHOWCASE_GEAR_SLOTS, SHOWCASE_GEAR_TILE_PX, SHOWCASE_GEAR_GAP_PX)).toBeLessThanOrEqual(
      showcaseCardContentWidthPx(),
    );
  });
});
