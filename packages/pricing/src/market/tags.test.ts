import { describe, expect, it } from 'vitest';
import {
  BOUGHT_SKIN_HASH,
  FIRST_BOUGHT_SKIN_INDEX,
  actChestFamilyFor,
  boughtSkinHashFor,
  catalogSlotFor,
  isKnownCategory,
  itemKindFor,
  rarityIdxFor,
  steamRarityFor,
  steamSlotFor,
} from './tags.js';
import { LIVE_MARKET_ROWS } from './__fixtures__/live-market-rows.js';

/**
 * The slot pairs below were read off the live market on 2026-08-28 by querying each Steam tag and
 * seeing which item came back. Five of the eight are not what an English translation of the
 * catalog would produce, and a wrong one costs a whole slot its price with nothing reported, so
 * they are pinned here against a well-meaning "tidy-up" back to the obvious guesses.
 */
const CONFIRMED_SLOTS: [steamTag: string, catalogSlot: string, witness: string][] = [
  ['helmet', 'elmo', 'Gold Helmet (Rare)'],
  ['armor', 'peito', 'Ember Chestplate (Rare)'],
  ['legs', 'calca', 'Ember Leggings (Rare)'],
  ['boots', 'bota', 'Ember Boots (Rare)'],
  ['gloves', 'luva', 'Ember Gloves (Rare)'],
  ['ring', 'anel', 'Ember Ring (Rare)'],
  ['amulet', 'amuleto', 'Ember Amulet (Rare)'],
];

describe('the Steam slot tags', () => {
  it.each(CONFIRMED_SLOTS)('maps %s to %s (witness: %s)', (steamTag, catalogSlot) => {
    expect(catalogSlotFor(steamTag)).toBe(catalogSlot);
    expect(steamSlotFor(catalogSlot)).toBe(steamTag);
  });

  it('rejects the plausible English guesses that the live market disproved', () => {
    for (const guess of ['chest', 'pants', 'boot', 'glove']) {
      expect(catalogSlotFor(guess)).toBeNull();
    }
  });

  it('has no mapping for a tag the market has never published', () => {
    expect(catalogSlotFor('wings')).toBeNull();
  });
});

describe('the Steam rarity tags', () => {
  it.each([
    ['uncommon', 1],
    ['rare', 2],
    ['legendary', 4],
  ])('maps the confirmed %s to catalog index %i', (steamTag, idx) => {
    expect(rarityIdxFor(steamTag)).toBe(idx);
    expect(steamRarityFor(idx)).toBe(steamTag);
  });
});

describe('the act chest families', () => {
  it.each([
    ['Hero Cage (Act 1)', 'chest_hero'],
    ['Time Chest (Act 3)', 'chest_time'],
    ['Gem Chest (Act 2)', 'chest_gem'],
    ['Skill Stone Chest (Act 3)', 'chest_skill'],
  ])('reads the family off %s without reading the act out of the name', (hashName, family) => {
    expect(actChestFamilyFor(hashName)).toBe(family);
  });

  it('matches a family named on its own, with no act after it', () => {
    expect(actChestFamilyFor('Time Chest')).toBe('chest_time');
  });

  it('needs the family at the front, so a hash that merely contains one does not borrow its def', () => {
    expect(actChestFamilyFor('Ancient Time Chest (Act 1)')).toBeNull();
  });

  it('fails closed on a family it does not name', () => {
    expect(actChestFamilyFor('Rune Chest (Act 1)')).toBeNull();
  });
});

describe('the bought skin listings', () => {
  it.each([
    [4, 'Forest Warden Skin'],
    [5, 'Shadow Hunter Skin'],
    [6, 'White Oracle Skin'],
    [7, 'Cobalt Sorcerer Skin'],
    [8, 'Royal Sentinel Skin'],
  ])('names the listing skin %i is worn as', (skinIndex, hashName) => {
    expect(boughtSkinHashFor(skinIndex)).toBe(hashName);
  });

  it('spells the one attested name exactly as the live market carries it', () => {
    const listed = LIVE_MARKET_ROWS.filter((row) => row.tags.category === 'skin').map(
      (row) => row.row.hashName,
    );

    expect(listed).toContain(boughtSkinHashFor(8));
  });

  it('gives every bought index a listing of its own, so no two skins share one price', () => {
    const named = Object.values(BOUGHT_SKIN_HASH);

    expect(new Set(named).size).toBe(named.length);
  });

  it('starts the bought range exactly where the table does', () => {
    expect(boughtSkinHashFor(FIRST_BOUGHT_SKIN_INDEX)).not.toBeNull();
    expect(boughtSkinHashFor(FIRST_BOUGHT_SKIN_INDEX - 1)).toBeNull();
  });

  it('leaves every birth skin unnamed, because none of them was ever for sale', () => {
    for (const birth of [0, 1, 2, 3]) {
      expect(boughtSkinHashFor(birth)).toBeNull();
    }
  });

  it('fails closed on an index it does not name, rather than reaching for a neighbour', () => {
    expect(boughtSkinHashFor(9)).toBeNull();
    expect(boughtSkinHashFor(-1)).toBeNull();
  });
});

describe('the Steam category tags', () => {
  it('maps each category the inventory parser already has a rule for', () => {
    expect(itemKindFor('equip')).toBe('equipment');
    expect(itemKindFor('gem')).toBe('gem');
    expect(itemKindFor('key')).toBe('key');
    expect(itemKindFor('time')).toBe('material');
  });

  it('leaves chest, stone and skin unmapped, because nothing here says what kind they are', () => {
    expect(itemKindFor('chest')).toBeNull();
    expect(itemKindFor('stone')).toBeNull();
    expect(itemKindFor('skin')).toBeNull();
  });

  it('still recognises those categories, so they do not warn on every single run', () => {
    for (const known of ['equip', 'gem', 'key', 'time', 'chest', 'stone', 'skin']) {
      expect(isKnownCategory(known)).toBe(true);
    }
    expect(isKnownCategory('mount')).toBe(false);
  });
});
