import type { DiscoveryRow } from '../discover.js';
import type { FacetName } from '../types.js';

/**
 * Every row the Steam market carried for this app on 2026-08-29, with the facet tags each one was
 * discovered under. Transcribed from a flat `search/render` walk plus one narrowed query per tag
 * — the same two passes the sweep makes, so these are the tags Steam answered with, not an
 * interpretation of the names.
 *
 * A shape witness, not a price source: it proves the reconciliation turns real market rows into
 * the right identities. Nothing asserts these prices are current, and it never needs refreshing
 * to stay true.
 *
 * Two things here are worth reading twice. `Ember Amulet (Rare)` and `Ember Amulet Lv 10 (Rare)`
 * are separate live hashes with byte-identical facets — the game renamed its items after launch
 * and Steam hashes are immutable. And `Hero Cage (Act 1)` and `Skill Stone Chest (Act 1)` share
 * every facet they have, which is why nothing outside the catalog is keyed on facets.
 */
function row(
  hashName: string,
  listings: number,
  sellPriceCents: number,
  tags: Partial<Record<FacetName, string>>,
): DiscoveryRow {
  return {
    row: { hashName, name: hashName, sellPriceCents, listings, iconUrl: null, type: null },
    tags,
  };
}

const equip = (
  hashName: string,
  listings: number,
  cents: number,
  set: string,
  slot: string,
  rarity: string,
  level: string,
): DiscoveryRow => row(hashName, listings, cents, { category: 'equip', set, slot, rarity, level });

export const LIVE_MARKET_ROWS: DiscoveryRow[] = [
  equip('Ember Amulet (Rare)', 1, 578, 'ember', 'amulet', 'rare', '10'),
  equip('Ember Amulet Lv 10 (Rare)', 1, 289, 'ember', 'amulet', 'rare', '10'),
  equip('Ember Boots (Rare)', 2, 347, 'ember', 'boots', 'rare', '10'),
  equip('Ember Boots Lv 10 (Rare)', 1, 289, 'ember', 'boots', 'rare', '10'),
  equip('Ember Chestplate (Rare)', 1, 584, 'ember', 'armor', 'rare', '10'),
  equip('Ember Chestplate Lv 10 (Rare)', 1, 371, 'ember', 'armor', 'rare', '10'),
  equip('Ember Gloves (Rare)', 3, 1107, 'ember', 'gloves', 'rare', '10'),
  equip('Ember Gloves Lv 10 (Rare)', 1, 192, 'ember', 'gloves', 'rare', '10'),
  equip('Ember Helmet Lv 10 (Epic)', 1, 1925, 'ember', 'helmet', 'epic', '10'),
  equip('Ember Helmet Lv 10 (Rare)', 1, 289, 'ember', 'helmet', 'rare', '10'),
  equip('Ember Leggings (Rare)', 4, 221, 'ember', 'legs', 'rare', '10'),
  equip('Ember Leggings Lv 10 (Rare)', 3, 110, 'ember', 'legs', 'rare', '10'),
  equip('Ember Ring (Rare)', 2, 59, 'ember', 'ring', 'rare', '10'),
  equip('Ember Ring Lv 10 (Epic)', 1, 192, 'ember', 'ring', 'epic', '10'),
  equip('Ember Weapon Lv 10 (Legendary)', 1, 463, 'ember', 'weapon', 'legendary', '10'),
  equip('Gold Amulet (Rare)', 2, 384, 'gold', 'amulet', 'rare', '20'),
  equip('Gold Amulet Lv 20 (Rare)', 2, 221, 'gold', 'amulet', 'rare', '20'),
  equip('Gold Boots (Rare)', 1, 568, 'gold', 'boots', 'rare', '20'),
  equip('Gold Gloves (Legendary)', 1, 1499, 'gold', 'gloves', 'legendary', '20'),
  equip('Gold Gloves Lv 20 (Legendary)', 1, 500, 'gold', 'gloves', 'legendary', '20'),
  equip('Gold Helmet (Rare)', 1, 443, 'gold', 'helmet', 'rare', '20'),
  equip('Gold Helmet Lv 20 (Rare)', 1, 327, 'gold', 'helmet', 'rare', '20'),

  row('Gate Key (Rare)', 13, 77, { category: 'key', rarity: 'rare' }),
  row('Gate Key (Uncommon)', 79, 16, { category: 'key', rarity: 'uncommon' }),
  row('Time Part (Epic)', 1, 578, { category: 'time', rarity: 'epic' }),
  row('Time Part (Rare)', 7, 249, { category: 'time', rarity: 'rare' }),
  row('Time Part (Uncommon)', 9, 212, { category: 'time', rarity: 'uncommon' }),
  row('Emerald Gem', 2, 962, { category: 'gem', rarity: 'rare' }),
  row('Sapphire Gem', 4, 365, { category: 'gem', rarity: 'rare' }),
  row('Skill Stone (Uncommon)', 10, 144, { category: 'stone', rarity: 'uncommon' }),
  row('Item Chest (Lv 10)', 19, 19, { category: 'chest', level: '10' }),
  row('Item Chest (Lv 20)', 7, 154, { category: 'chest', level: '20' }),
  row('Hero Cage (Act 1)', 15, 289, { category: 'chest', act: '1' }),
  row('Skill Stone Chest (Act 1)', 5, 129, { category: 'chest', act: '1' }),
  row('Royal Sentinel Skin', 1, 4814, { category: 'skin' }),
];
