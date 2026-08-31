import { describe, expect, it } from 'vitest';
import { buildInventoryView, mapInventoryHeroes } from '@bombfarm/domain/inventory-view';
import type { InventoryGridLabels } from '@bombfarm/game-art';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import { inventoryLabels } from './inventory-labels';

/** One row of each of the six kinds the wire's `category` codes partition, in wire shape. */
const ROWS = [
  {
    id: 'g1',
    def_id: 'steel_luva',
    category: 0,
    set: 'steel',
    rarity: 2,
    level: 20,
    upgrade: 8,
    sell_value: '360',
    equipped_on: 'h1',
    stats: [
      { stat: 0, value: 55, effective: 90.2 },
      { stat: 5, value: 0.4, effective: 0.656 },
    ],
  },
  { id: 'c1', def_id: 'chest_item_90', category: 1, rarity: 0, level: 0, sell_value: '100' },
  { id: 'm1', def_id: 'gem_amethyst', category: 2, rarity: 4, level: 0, sell_value: '260' },
  { id: 't1', def_id: 'time_part_raro', category: 3, rarity: 2, level: 0, sell_value: '180' },
  { id: 'k1', def_id: 'map_key_epico', category: 4, rarity: 3, level: 0, sell_value: '220' },
  { id: 'k2', def_id: 'map_key_epico', category: 4, rarity: 3, level: 0, sell_value: '220' },
  { id: 's1', def_id: 'skill_stone_mitico', category: 5, rarity: 5, level: 0, sell_value: '300' },
];

const HEROES = mapInventoryHeroes([
  { id: 'h1', name: 'Kendo', rarity: 5, level: 157, rank: 'S', skin: 3, stars: 2 },
]);

function item(id: string): InventoryViewItem {
  const found = buildInventoryView(ROWS).items.find((entry) => entry.id === id);
  if (!found) throw new Error(`no test row ${id}`);
  return found;
}

function equippedByOf(labels: InventoryGridLabels, id: string) {
  const resolve = labels.equippedBy;
  if (!resolve) throw new Error('labels carry no equippedBy resolver');
  return resolve(item(id));
}

describe('desktop inventory labels', () => {
  /**
   * The bug this pins: gear used to be named by title-casing the catalog's own slot token, which
   * is Portuguese, so the English shell printed "Elmo" and "Bota".
   */
  it('names gear through the bilingual set and slot maps, not the raw wire token', () => {
    expect(inventoryLabels(en, 'en').itemName(item('g1'))).toBe('Steel · Gloves');
    expect(inventoryLabels(ptBR, 'pt').itemName(item('g1'))).toBe('Aço · Luva');
  });

  /** The three parts stay apart so the card can colour each one; joining them would force it to
   *  colour the separators too. */
  it('gives gear a rarity, a level and a forge, and gives a gem only a rarity', () => {
    const labels = inventoryLabels(en, 'en');
    expect(labels.itemRarity(item('g1'))).toBe('Rare');
    expect(labels.itemLevel(item('g1'))).toBe('Level 20');
    expect(labels.itemForge(item('g1'))).toBe('+8');

    expect(labels.itemRarity(item('m1'))).toBe('Legendary');
    expect(labels.itemLevel(item('m1'))).toBe('');
    expect(labels.itemForge(item('m1'))).toBe('');
  });

  /**
   * A key, a house part and a skill stone are named by their tier, so repeating it below the name
   * read "Epic / Epic". The empty rarity is also the card's signal to colour the NAME instead.
   */
  it('leaves the rarity empty for the kinds whose name is already their tier', () => {
    const labels = inventoryLabels(en, 'en');
    for (const id of ['k1', 't1', 's1']) {
      expect(labels.itemName(item(id))).not.toBe('');
      expect(labels.itemRarity(item(id))).toBe('');
      expect(labels.itemLevel(item(id))).toBe('');
    }
  });

  it('leaves the forge empty on an unforged item, so the card draws no separator for it', () => {
    expect(inventoryLabels(en, 'en').itemForge(item('m1'))).toBe('');
  });

  it('splits a stat into label and value, and suffixes only the percent one', () => {
    const labels = inventoryLabels(en, 'en');
    expect(item('g1').stats.map((stat) => labels.itemStat(stat))).toEqual([
      { label: 'Damage', value: '+90.2' },
      { label: 'Penetration', value: '+65.60%' },
    ]);
  });

  it('hands the card the hero identity in pieces — rank, name, rarity, level, avatar skin', () => {
    expect(equippedByOf(inventoryLabels(en, 'en', HEROES), 'g1')).toEqual({
      name: 'Kendo',
      rank: 'S',
      rarityIdx: 5,
      level: 'Level 157',
      stars: 2,
      skin: 3,
      unknown: false,
    });
  });

  it('still reports a worn item as equipped when the hero is not in the roster it was given', () => {
    expect(equippedByOf(inventoryLabels(en, 'en'), 'g1')).toEqual({
      name: 'Equipped',
      rank: '',
      rarityIdx: -1,
      level: '',
      stars: 0,
      skin: 0,
      unknown: true,
    });
  });

  /** The dropdown draws the same identity block the card footer does, so the option carries the
   *  same pieces — a bare name would make the list the one place a hero is unrecognisable. */
  it('gives the hero filter options the full identity, falling back to the raw id', () => {
    const resolve = inventoryLabels(en, 'en', HEROES).heroOption;
    if (!resolve) throw new Error('labels carry no heroOption resolver');

    expect(resolve('h1')).toEqual({
      id: 'h1',
      name: 'Kendo',
      rank: 'S',
      rarityIdx: 5,
      stars: 2,
      level: 'Level 157',
    });
    expect(resolve('nobody')).toEqual({
      id: 'nobody',
      name: 'nobody',
      rank: '',
      rarityIdx: -1,
      stars: 0,
      level: '',
    });
  });

  it('leaves a loose item with no hero line at all', () => {
    expect(equippedByOf(inventoryLabels(en, 'en', HEROES), 'k1')).toBeNull();
  });

  it('titles every one of the kind groups the capture produces, in both locales', () => {
    for (const copy of [en, ptBR]) {
      const labels = inventoryLabels(copy, 'en');
      for (const group of buildInventoryView(ROWS).groups) {
        expect(labels.groupTitle(group.kind)).toBeTruthy();
      }
    }
  });

  it('matches free text against the localized name and the raw wire id alike', () => {
    const text = inventoryLabels(en, 'en').searchText(item('g1')).toLowerCase();
    expect(text).toContain('gloves');
    expect(text).toContain('steel_luva');
  });
});
