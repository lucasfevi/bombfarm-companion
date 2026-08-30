import { describe, expect, it } from 'vitest';
import {
  catalogSlotFor,
  isKnownCategory,
  itemKindFor,
  rarityIdxFor,
  steamRarityFor,
  steamSlotFor,
} from './tags.js';

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
