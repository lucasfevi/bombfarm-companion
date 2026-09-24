import type { SearchRow } from '../types.js';

/**
 * Every row the Steam market carried for this app on 2026-08-29, plus five rows the market gained
 * afterwards. Transcribed from a flat `search/render` walk — the one pass the sweep makes — so
 * these are the hashes, prices and types Steam answered with, not an interpretation of them.
 *
 * A shape witness, not a price source: it proves the reconciliation turns real market rows into
 * the right identities. Nothing asserts these prices are current, and it never needs refreshing
 * to stay true.
 *
 * Two things here are worth reading twice. `Ember Amulet (Rare)` and `Ember Amulet Lv 10 (Rare)`
 * are separate live hashes for one item — the game renamed everything after launch and Steam hashes
 * are immutable, so both forms are still listed and both must key. And `Hero Cage (Act 1)` and
 * `Skill Stone Chest (Act 1)` differ in nothing but their family name, which is why the families
 * are named outright rather than deduced.
 */
function row(
  hashName: string,
  listings: number,
  sellPriceCents: number,
  type: string | null = null,
): SearchRow {
  return { hashName, name: hashName, sellPriceCents, listings, iconUrl: null, type };
}

/** Steam types an equipment row with its slot word, the same word the market name carries. */
const equip = (hashName: string, listings: number, cents: number, type: string): SearchRow =>
  row(hashName, listings, cents, type);

export const LIVE_MARKET_ROWS: SearchRow[] = [
  equip('Ember Amulet (Rare)', 1, 578, 'Amulet'),
  equip('Ember Amulet Lv 10 (Rare)', 1, 289, 'Amulet'),
  equip('Ember Boots (Rare)', 2, 347, 'Boots'),
  equip('Ember Boots Lv 10 (Rare)', 1, 289, 'Boots'),
  equip('Ember Chestplate (Rare)', 1, 584, 'Chestplate'),
  equip('Ember Chestplate Lv 10 (Rare)', 1, 371, 'Chestplate'),
  equip('Ember Gloves (Rare)', 3, 1107, 'Gloves'),
  equip('Ember Gloves Lv 10 (Rare)', 1, 192, 'Gloves'),
  equip('Ember Helmet Lv 10 (Epic)', 1, 1925, 'Helmet'),
  equip('Ember Helmet Lv 10 (Rare)', 1, 289, 'Helmet'),
  equip('Ember Leggings (Rare)', 4, 221, 'Leggings'),
  equip('Ember Leggings Lv 10 (Rare)', 3, 110, 'Leggings'),
  equip('Ember Ring (Rare)', 2, 59, 'Ring'),
  equip('Ember Ring Lv 10 (Epic)', 1, 192, 'Ring'),
  equip('Ember Weapon Lv 10 (Legendary)', 1, 463, 'Weapon'),
  equip('Gold Amulet (Rare)', 2, 384, 'Amulet'),
  equip('Gold Amulet Lv 20 (Rare)', 2, 221, 'Amulet'),
  equip('Gold Boots (Rare)', 1, 568, 'Boots'),
  equip('Gold Gloves (Legendary)', 1, 1499, 'Gloves'),
  equip('Gold Gloves Lv 20 (Legendary)', 1, 500, 'Gloves'),
  equip('Gold Helmet (Rare)', 1, 443, 'Helmet'),
  equip('Gold Helmet Lv 20 (Rare)', 1, 327, 'Helmet'),

  row('Gate Key (Rare)', 13, 77, 'Map Key'),
  row('Gate Key (Uncommon)', 79, 16, 'Map Key'),
  row('Time Part (Epic)', 1, 578),
  row('Time Part (Rare)', 7, 249),
  row('Time Part (Uncommon)', 9, 212),
  row('Emerald Gem', 2, 962),
  row('Sapphire Gem', 4, 365),
  row('Skill Stone (Uncommon)', 10, 144),
  row('Item Chest (Lv 10)', 19, 19, 'Chest'),
  row('Item Chest (Lv 20)', 7, 154, 'Chest'),
  row('Hero Cage (Act 1)', 15, 289, 'Chest'),
  row('Skill Stone Chest (Act 1)', 5, 129, 'Chest'),
  row('Royal Sentinel Skin', 1, 4814),

  // Listed after the walk above, and every one of them was priced and unreachable from an
  // inventory until the family and gem lookups were fixed. Kept together so it stays obvious
  // which rows are the regression witnesses.
  row('Gem Chest (Act 2)', 4, 577, 'Chest'),
  row('Skill Stone Chest (Act 2)', 2, 55, 'Chest'),
  row('Skill Stone Chest (Act 3)', 3, 487, 'Chest'),
  row('Time Chest (Act 3)', 1, 1500, 'Chest'),
  row('Topaz Gem', 1, 1772),
];
