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
  const ids = (filter: Partial<typeof EMPTY_FORGE_FILTER>) =>
    filterForgeItems(GEAR, { ...EMPTY_FORGE_FILTER, ...filter }, nameOf).map((item) => item.id);

  it('narrows to one wearer, one slot, and a rarity set', () => {
    expect(ids({ heroId: 'h1' })).toEqual(['sword']);
    expect(ids({ slot: 'elmo' })).toEqual(['helm']);
    expect(ids({ rarities: [0, 4] })).toEqual(['boots', 'ring']);
  });

  it('reads the forge rung as a ceiling, so it finds the pieces still worth forging', () => {
    expect(ids({ maxForge: 0 })).toEqual(['boots']);
    expect(ids({ maxForge: 8 })).toEqual(['helm', 'boots']);
    expect(ids({ maxForge: 14 })).toEqual(['sword', 'helm', 'boots']);
    expect(ids({ maxForge: null })).toEqual(['sword', 'helm', 'boots', 'ring']);
  });

  it('splits the bag into what a hero is wearing and what nobody is', () => {
    expect(ids({ worn: 'worn' })).toEqual(['sword', 'helm']);
    expect(ids({ worn: 'spare' })).toEqual(['boots', 'ring']);
    expect(ids({ worn: 'all' })).toEqual(['sword', 'helm', 'boots', 'ring']);
  });

  it('matches every word of the search, ignoring case and accents', () => {
    const found = filterForgeItems(GEAR, { ...EMPTY_FORGE_FILTER, text: 'STEEL bótá' }, nameOf).map((item) => item.id);
    expect(found).toEqual(['boots']);
  });

  it('knows an empty filter', () => {
    expect(isEmptyForgeFilter(EMPTY_FORGE_FILTER)).toBe(true);
    expect(isEmptyForgeFilter({ ...EMPTY_FORGE_FILTER, maxForge: 14 })).toBe(false);
    expect(isEmptyForgeFilter({ ...EMPTY_FORGE_FILTER, worn: 'spare' })).toBe(false);
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
