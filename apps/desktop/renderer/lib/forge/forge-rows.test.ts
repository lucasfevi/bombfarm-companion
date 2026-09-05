import { describe, expect, it } from 'vitest';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import {
  EMPTY_FORGE_FILTER,
  filterForgeItems,
  forgeHeroIds,
  forgeRarities,
  forgeSlots,
  gearOf,
  isEmptyForgeFilter,
} from './forge-rows';

function gearRow(
  id: string,
  defId: string,
  overrides: Partial<{ upgrade: number; rarity: number; level: number; power: number; equipped_on: string }> = {},
) {
  return { id, def_id: defId, category: 0, rarity: 2, level: 20, upgrade: 0, power: 10, ...overrides };
}

const ROWS = [
  gearRow('sword', 'steel_arma', { upgrade: 12, power: 40, equipped_on: 'h1' }),
  gearRow('helm', 'steel_elmo', { upgrade: 8, power: 30, equipped_on: 'h2' }),
  gearRow('boots', 'steel_bota', { upgrade: 0, power: 30, rarity: 4 }),
  gearRow('ring', 'steel_anel', { upgrade: 15, power: 5, rarity: 0, level: 20 }),
  { id: 'gem', def_id: 'gem_ruby', category: 2, rarity: 3, level: 0 },
];

const GEAR = gearOf(buildInventoryView(ROWS).items);
const nameOf = (item: InventoryViewItem) => item.defId;

describe('gearOf', () => {
  it('keeps gear and nothing else', () => {
    expect(GEAR.map((item) => item.id)).toEqual(['sword', 'helm', 'boots', 'ring']);
  });
});

describe('filterForgeItems', () => {
  it('narrows to one wearer, one slot, a forge floor, and a rarity set', () => {
    const ids = (filter: Partial<typeof EMPTY_FORGE_FILTER>) =>
      filterForgeItems(GEAR, { ...EMPTY_FORGE_FILTER, ...filter }, nameOf).map((item) => item.id);
    expect(ids({ heroId: 'h1' })).toEqual(['sword']);
    expect(ids({ slot: 'elmo' })).toEqual(['helm']);
    expect(ids({ minForge: 8 })).toEqual(['sword', 'helm', 'ring']);
    expect(ids({ minForge: 15 })).toEqual(['ring']);
    expect(ids({ rarities: [0, 4] })).toEqual(['boots', 'ring']);
  });

  it('matches every word of the search, ignoring case and accents', () => {
    const ids = filterForgeItems(GEAR, { ...EMPTY_FORGE_FILTER, text: 'STEEL bótá' }, nameOf).map((item) => item.id);
    expect(ids).toEqual(['boots']);
  });

  it('knows an empty filter', () => {
    expect(isEmptyForgeFilter(EMPTY_FORGE_FILTER)).toBe(true);
    expect(isEmptyForgeFilter({ ...EMPTY_FORGE_FILTER, minForge: 1 })).toBe(false);
  });
});

describe('the toolbar\'s own options', () => {
  it('lists wearers with the field heroes first, then by name', () => {
    const inField = (heroId: string) => heroId === 'h2';
    const nameOfHero = (heroId: string) => (heroId === 'h1' ? 'Alpha' : 'Zed');
    expect(forgeHeroIds(GEAR, inField, nameOfHero)).toEqual(['h2', 'h1']);
    expect(forgeHeroIds(GEAR, () => false, nameOfHero)).toEqual(['h1', 'h2']);
  });

  it('lists the slots present in the catalog\'s order, and the rarities ascending', () => {
    expect(forgeSlots(GEAR, ['arma', 'elmo', 'anel', 'amuleto', 'peito', 'calca', 'luva', 'bota'])).toEqual([
      'arma',
      'elmo',
      'anel',
      'bota',
    ]);
    expect(forgeRarities(GEAR)).toEqual([0, 2, 4]);
  });
});
