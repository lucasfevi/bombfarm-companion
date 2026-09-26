import type { SearchRow } from '../types.js';

/**
 * Every row the Steam market carried for this app on 2026-08-29, plus five rows the market gained
 * afterwards. Transcribed from a flat `search/render` walk — the one pass the sweep makes — so these
 * are the hashes and the prices Steam answered with, not an interpretation of them.
 *
 * A shape witness, not a price source: it proves the reconciliation turns real market rows into
 * the right identities. Nothing asserts these prices are current, and it never needs refreshing
 * to stay true.
 *
 * **Steam's per-row `type` was not part of that transcription, so every row here leaves it null.**
 * Filling it in from what this repository believes the field looks like would make the drift
 * cross-check agree with itself, which tests nothing — and a `type` written that way did exactly
 * that until `endpoints.test.ts` was found to record a real one (`Uncommon Weapon`) that contradicts
 * it. The cross-check is exercised in `reconcile.test.ts` against that value instead.
 *
 * Two things here are worth reading twice. `Ember Amulet (Rare)` and `Ember Amulet Lv 10 (Rare)`
 * are separate live hashes for one item — the game renamed everything after launch and Steam hashes
 * are immutable, so both forms are still listed and both must key. And `Hero Cage (Act 1)` and
 * `Skill Stone Chest (Act 1)` differ in nothing but their family name, which is why the families
 * are named outright rather than deduced.
 */
function row(hashName: string, listings: number, sellPriceCents: number): SearchRow {
  return { hashName, name: hashName, sellPriceCents, listings, iconUrl: null, type: null };
}

export const LIVE_MARKET_ROWS: SearchRow[] = [
  row('Ember Amulet (Rare)', 1, 578),
  row('Ember Amulet Lv 10 (Rare)', 1, 289),
  row('Ember Boots (Rare)', 2, 347),
  row('Ember Boots Lv 10 (Rare)', 1, 289),
  row('Ember Chestplate (Rare)', 1, 584),
  row('Ember Chestplate Lv 10 (Rare)', 1, 371),
  row('Ember Gloves (Rare)', 3, 1107),
  row('Ember Gloves Lv 10 (Rare)', 1, 192),
  row('Ember Helmet Lv 10 (Epic)', 1, 1925),
  row('Ember Helmet Lv 10 (Rare)', 1, 289),
  row('Ember Leggings (Rare)', 4, 221),
  row('Ember Leggings Lv 10 (Rare)', 3, 110),
  row('Ember Ring (Rare)', 2, 59),
  row('Ember Ring Lv 10 (Epic)', 1, 192),
  row('Ember Weapon Lv 10 (Legendary)', 1, 463),
  row('Gold Amulet (Rare)', 2, 384),
  row('Gold Amulet Lv 20 (Rare)', 2, 221),
  row('Gold Boots (Rare)', 1, 568),
  row('Gold Gloves (Legendary)', 1, 1499),
  row('Gold Gloves Lv 20 (Legendary)', 1, 500),
  row('Gold Helmet (Rare)', 1, 443),
  row('Gold Helmet Lv 20 (Rare)', 1, 327),

  row('Gate Key (Rare)', 13, 77),
  row('Gate Key (Uncommon)', 79, 16),
  row('Time Part (Epic)', 1, 578),
  row('Time Part (Rare)', 7, 249),
  row('Time Part (Uncommon)', 9, 212),
  row('Emerald Gem', 2, 962),
  row('Sapphire Gem', 4, 365),
  row('Skill Stone (Uncommon)', 10, 144),
  row('Item Chest (Lv 10)', 19, 19),
  row('Item Chest (Lv 20)', 7, 154),
  row('Hero Cage (Act 1)', 15, 289),
  row('Skill Stone Chest (Act 1)', 5, 129),
  row('Royal Sentinel Skin', 1, 4814),

  // Listed after the walk above, and every one of them was priced and unreachable from an
  // inventory until the family and gem lookups were fixed. Kept together so it stays obvious
  // which rows are the regression witnesses.
  row('Gem Chest (Act 2)', 4, 577),
  row('Skill Stone Chest (Act 2)', 2, 55),
  row('Skill Stone Chest (Act 3)', 3, 487),
  row('Time Chest (Act 3)', 1, 1500),
  row('Topaz Gem', 1, 1772),
];
