import { describe, expect, it } from 'vitest';
import {
  BOUGHT_SKIN_HASH,
  FIRST_BOUGHT_SKIN_INDEX,
  actChestFamilyFor,
  boughtSkinHashFor,
  itemKindFor,
} from './tags.js';
import { LIVE_MARKET_ROWS } from './__fixtures__/live-market-rows.js';

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
    const listed = LIVE_MARKET_ROWS.map((row) => row.hashName);

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

  it('leaves chest, stone, hero and skin unmapped, because nothing here says what kind they are', () => {
    expect(itemKindFor('chest')).toBeNull();
    expect(itemKindFor('stone')).toBeNull();
    expect(itemKindFor('hero')).toBeNull();
    expect(itemKindFor('skin')).toBeNull();
  });
});
