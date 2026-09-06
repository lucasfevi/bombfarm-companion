import { describe, expect, it } from 'vitest';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import {
  EMPTY_FORGE_FILTER,
  FORGE_BANDS,
  filterForgeItems,
  forgeBandHolds,
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

// One piece on each of the band endpoints — +0, +8, +10, +12, +14 — and one past the top of the
// ladder, so every option has a boundary piece to claim or refuse.
const ROWS = [
  gearRow('sword', 'steel_arma', { upgrade: 12, power: 40, equipped_on: 'h1' }),
  gearRow('helm', 'steel_elmo', { upgrade: 8, power: 30, equipped_on: 'h2' }),
  gearRow('boots', 'steel_bota', { upgrade: 0, power: 30, rarity: 4 }),
  gearRow('ring', 'steel_anel', { upgrade: 15, power: 5, rarity: 0, level: 20 }),
  gearRow('amulet', 'steel_amuleto', { upgrade: 10, power: 34 }),
  gearRow('chest', 'steel_peito', { upgrade: 14, power: 44 }),
  { id: 'gem', def_id: 'gem_ruby', category: 2, rarity: 3, level: 0 },
];

const GEAR = gearOf(buildInventoryView(ROWS).items);
const nameOf = (item: InventoryViewItem) => item.defId;

const ALL_GEAR = ['sword', 'helm', 'boots', 'ring', 'amulet', 'chest'];

describe('gearOf', () => {
  it('keeps gear and nothing else', () => {
    expect(GEAR.map((item) => item.id)).toEqual(ALL_GEAR);
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

  it('reads the forge rung as a band, one option to a stretch of the ladder', () => {
    expect(ids({ forge: null })).toEqual(ALL_GEAR);
    expect(ids({ forge: 'at0' })).toEqual(['boots']);
    expect(ids({ forge: 'at8' })).toEqual(['helm']);
    expect(ids({ forge: '8to10' })).toEqual(['helm', 'amulet']);
    expect(ids({ forge: '10to12' })).toEqual(['sword', 'amulet']);
    expect(ids({ forge: '12to14' })).toEqual(['sword', 'chest']);
    expect(ids({ forge: 'from14' })).toEqual(['ring', 'chest']);
  });

  it('hands a piece on a shoulder to both bands that meet there, which is what the overlap is for', () => {
    for (const [upgrade, both] of [
      [8, ['at8', '8to10']],
      [10, ['8to10', '10to12']],
      [12, ['10to12', '12to14']],
      [14, ['12to14', 'from14']],
    ] as const) {
      for (const band of both) expect(forgeBandHolds(band, upgrade), `${band} at ${String(upgrade)}`).toBe(true);
    }
  });

  it('leaves the rungs between +0 and the safe floor out of every band', () => {
    for (const upgrade of [1, 4, 7]) {
      expect(FORGE_BANDS.filter((band) => forgeBandHolds(band, upgrade))).toEqual([]);
    }
  });

  it('splits the bag into what a hero is wearing and what nobody is', () => {
    expect(ids({ worn: 'worn' })).toEqual(['sword', 'helm']);
    expect(ids({ worn: 'spare' })).toEqual(['boots', 'ring', 'amulet', 'chest']);
    expect(ids({ worn: 'all' })).toEqual(ALL_GEAR);
  });

  it('matches every word of the search, ignoring case and accents', () => {
    const found = filterForgeItems(GEAR, { ...EMPTY_FORGE_FILTER, text: 'STEEL bótá' }, nameOf).map((item) => item.id);
    expect(found).toEqual(['boots']);
  });

  it('knows an empty filter', () => {
    expect(isEmptyForgeFilter(EMPTY_FORGE_FILTER)).toBe(true);
    expect(isEmptyForgeFilter({ ...EMPTY_FORGE_FILTER, forge: '12to14' })).toBe(false);
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
      'amuleto',
      'peito',
      'bota',
    ]);
    expect(forgeRarities(GEAR)).toEqual([0, 2, 4]);
  });
});
