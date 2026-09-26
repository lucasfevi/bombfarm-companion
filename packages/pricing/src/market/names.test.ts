import { describe, expect, it } from 'vitest';
import { MARKET_RARITY_WORD, MARKET_SLOT_WORD, generateMarketNames } from './names.js';
import type { CatalogView } from './names.js';
import { COMMITTED_CATALOG } from './__fixtures__/committed-catalog.js';

const SMALL: CatalogView = {
  defs: [
    { defId: 'ember_amuleto', set: 'ember', slot: 'amuleto', level: 10 },
    { defId: 'ember_peito', set: 'ember', slot: 'peito', level: 10 },
    { defId: 'glacier_calca', set: 'glacier', slot: 'calca', level: 60 },
  ],
  rarityIdxs: [2, 3],
  rarityTokens: { 2: 'raro', 3: 'epico' },
  gems: [{ defId: 'gem_topaz', name: 'Topaz', rarityIdx: 3 }],
};

const generated = generateMarketNames(COMMITTED_CATALOG);

describe('the equipment name forms', () => {
  const names = generateMarketNames(SMALL);

  it('emits the current form, set word and slot word and level and rarity', () => {
    expect(names.get('Glacier Leggings Lv 60 (Epic)')).toMatchObject({
      category: 'equip',
      defId: 'glacier_calca',
      set: 'glacier',
      slot: 'calca',
      rarityIdx: 3,
      level: 60,
      kind: 'equipment',
    });
  });

  it('emits the pre-rename form too, with the same identity behind it', () => {
    expect(names.get('Glacier Leggings (Epic)')).toEqual(names.get('Glacier Leggings Lv 60 (Epic)'));
  });

  it('uses the words the live market spells, not a translation of the catalog code', () => {
    expect(names.has('Ember Chestplate Lv 10 (Rare)')).toBe(true);
    expect(names.has('Ember Peito Lv 10 (Rare)')).toBe(false);
    expect(names.has('Ember Chest Lv 10 (Rare)')).toBe(false);
  });

  it('claims the slot noun Steam must name, which is what the cross-check looks for', () => {
    expect(names.get('Ember Amulet Lv 10 (Rare)')?.slotWord).toBe('Amulet');
    expect(names.get('Ember Chestplate Lv 10 (Rare)')?.slotWord).toBe('Chestplate');
  });

  it('claims no slot noun for anything whose name form implies no slot', () => {
    expect(names.get('Topaz Gem')?.slotWord).toBeNull();
  });
});

describe('the non-equipment name forms', () => {
  it.each([
    ['Emerald Gem', { category: 'gem', defId: 'gem_emerald', rarityIdx: 2, kind: 'gem' }],
    ['Topaz Gem', { category: 'gem', defId: 'gem_topaz', rarityIdx: 3, kind: 'gem' }],
    ['Gate Key (Rare)', { category: 'key', defId: 'map_key_raro', rarityIdx: 2, kind: 'key' }],
    ['Skill Stone (Uncommon)', { category: 'stone', defId: 'skill_stone_incomum', rarityIdx: 1 }],
    ['Time Part (Epic)', { category: 'time', defId: 'time_part_epico', rarityIdx: 3 }],
    ['Item Chest (Lv 30)', { category: 'chest', defId: 'chest_item_30', rarityIdx: 0, level: 30 }],
    ['Hero Cage (Act 1)', { category: 'chest', defId: 'chest_hero_1', rarityIdx: 1, act: 1 }],
    ['Skill Stone Chest (Act 1)', { category: 'chest', defId: 'chest_skill_1', act: 1 }],
    ['Time Chest (Act 3)', { category: 'chest', defId: 'chest_time_3', rarityIdx: 3, act: 3 }],
    ['Gem Chest (Act 2)', { category: 'chest', defId: 'chest_gem_2', rarityIdx: 2, act: 2 }],
    ['Hero (Legendary)', { category: 'hero', defId: null, rarityIdx: 4 }],
    ['Royal Sentinel Skin', { category: 'skin', defId: null, rarityIdx: null }],
  ])('generates %s', (name, identity) => {
    expect(generated.get(name)).toMatchObject(identity);
  });

  it('takes a gem rarity from the bundle, because the name carries none', () => {
    expect(generated.get('Emerald Gem')?.rarityIdx).toBe(2);
    expect(generated.get('Diamond Gem')?.rarityIdx).toBe(4);
  });
});

describe('the generated set as a whole', () => {
  it('covers every slot and every rarity the catalog has, or a whole slot loses its price', () => {
    for (const slot of new Set(COMMITTED_CATALOG.defs.map((def) => def.slot))) {
      expect(MARKET_SLOT_WORD[slot], slot).toBeDefined();
    }
    for (const rarityIdx of COMMITTED_CATALOG.rarityIdxs) {
      expect(MARKET_RARITY_WORD[rarityIdx], String(rarityIdx)).toBeDefined();
    }
  });

  it('generates both forms for every catalog def and rarity', () => {
    const equipment = [...generated.values()].filter((identity) => identity.category === 'equip');
    const defsTimesRarities =
      COMMITTED_CATALOG.defs.length * COMMITTED_CATALOG.rarityIdxs.length;

    expect(defsTimesRarities).toBe(240 * 6);
    expect(equipment).toHaveLength(defsTimesRarities * 2);
  });

  /**
   * Two identities generating one name is the only way this could mis-key a row, and the first
   * one added would silently win. The count is what catches it: a collision shows up as a
   * shortfall against what the committed data says every family is worth.
   */
  it('gives each family its own names, with none lost to a collision', () => {
    const equipment = 240 * 6 * 2;
    const gems = 9;
    const raritySuffixed = 3 * 6;
    const itemChests = 30;
    const actChests = 4 * 5;
    const rankChests = 5;
    const heroes = 6;
    const skins = 5;

    expect(generated.size).toBe(
      equipment + gems + raritySuffixed + itemChests + actChests + rankChests + heroes + skins,
    );
  });
});
