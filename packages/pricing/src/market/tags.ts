import type { ItemKind } from '@bombfarm/contracts';

/**
 * Steam publishes this app's market facets in English; the committed catalog names slots and
 * rarities in the game's own Portuguese codes. These tables are the only place the two
 * vocabularies meet.
 *
 * Every slot below was confirmed against the live market on 2026-08-28 by querying each tag and
 * reading back which item it returned — `armor` is the chestplate, `legs` the leggings, and the
 * plurals are Steam's, not ours. Guessing these from English would have got five of the eight
 * wrong.
 *
 * Sets need no table: Steam's set tags are the catalog's own set codes, verbatim.
 */
export const STEAM_SLOT_TO_CATALOG: Readonly<Record<string, string>> = {
  weapon: 'arma',
  helmet: 'elmo',
  ring: 'anel',
  amulet: 'amuleto',
  armor: 'peito',
  legs: 'calca',
  gloves: 'luva',
  boots: 'bota',
};

/**
 * `uncommon`, `rare` and `legendary` are confirmed against live listings. The other three follow
 * the same series and are unconfirmed only because nothing in those rarities has been listed yet;
 * an unmapped rarity is recorded as an anomaly rather than guessed at.
 */
export const STEAM_RARITY_TO_IDX: Readonly<Record<string, number>> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

/**
 * Each entry matches a rule in the game-data inventory parser's `inferKind`: `gem_*` is a gem,
 * `map_key_*` a key, `time_part_*` a material. Steam's `chest` and `stone` categories (Item
 * Chest, Hero Cage, Skill Stone) are deliberately absent — `inferKind` has no rule for them
 * either, so there is no answer to copy. Rows in those categories keep their Steam category,
 * carry a null `kind`, and record an anomaly.
 */
export const STEAM_CATEGORY_TO_KIND: Readonly<Record<string, ItemKind>> = {
  equip: 'equipment',
  gem: 'gem',
  key: 'key',
  time: 'material',
};

/** The Steam category tag for equipment, the one category keyed by catalog def rather than facet. */
export const EQUIPMENT_CATEGORY_TAG = 'equip';

/**
 * Categories whose items carry a catalog `def_id` built from a fixed prefix and the rarity.
 * Witnessed in the account fixtures as `map_key_raro`, `map_key_incomum`, `time_part_incomum`,
 * `time_part_raro` and `time_part_epico` — the same two prefixes the inventory parser's
 * `inferKind` keys off.
 *
 * `gem` is absent on purpose: a gem's `def_id` is not its rarity token, so this shape cannot spell
 * one. The caller supplies gem identity in `CatalogView.defIdByHash`, from the committed game data
 * that names all nine.
 */
export const CATEGORY_DEF_PREFIX: Readonly<Record<string, string>> = {
  key: 'map_key',
  time: 'time_part',
  // Same prefix-plus-rarity-token shape, witnessed in the account fixtures as
  // `skill_stone_comum`, `skill_stone_incomum` and `skill_stone_epico`.
  stone: 'skill_stone',
};

/**
 * Item chests key on a LEVEL rather than a rarity — `chest_item_30` against `Item Chest (Lv 30)` —
 * so they take the level facet where the categories above take the rarity one.
 *
 * Deliberately only `item` chests. The act-scoped ones (`Hero Cage (Act 1)`, `Time Chest (Act 1)`)
 * cannot join them: an owned `chest_time_2` carries a rarity TIER in that tail, not an act, so
 * pairing the two axes would file one chest under another's price.
 */
export const LEVEL_CHEST_DEF_PREFIX = 'chest_item';

/**
 * The act-scoped chests, by the family their def id uses. Four families, owner-confirmed complete;
 * `chest_auto`, `chest_easy` and `chest_inferno` never reach the market.
 *
 * The act is NOT read from the name — it comes off the `act` facet, and it doubles as the rarity
 * tier, so `Time Chest (Act 3)` is `chest_time_3` at rarity 3. Only the family is looked up here,
 * because the facets cannot supply it: every row is `category=chest` plus an act and nothing else.
 * Naming the families is what stops a Hero Cage taking a Time Chest's price.
 *
 * `tools/market-item-linking.test.mjs` reconciles each family across the acts the market carries
 * and fails on a family that stops linking; `tools/market-tags-catalog-parity.test.mjs` fails if
 * an act creeps back into a key here.
 */
export const ACT_CHEST_FAMILY_DEF: Readonly<Record<string, string>> = {
  'Hero Cage': 'chest_hero',
  'Time Chest': 'chest_time',
  'Gem Chest': 'chest_gem',
  'Skill Stone Chest': 'chest_skill',
};

/**
 * The family a chest hash belongs to, or null. Matched as a whole leading segment — the family
 * name exactly, or the family name followed by a space — never by splitting the hash on " (Act".
 * A family this does not name fails closed: the row keeps a category key rather than borrowing a
 * named family's def.
 */
export function actChestFamilyFor(hashName: string): string | null {
  for (const [family, defPrefix] of Object.entries(ACT_CHEST_FAMILY_DEF)) {
    if (hashName === family) return defPrefix;
    if (hashName.startsWith(`${family} `)) return defPrefix;
  }
  return null;
}

/**
 * The lowest `skin` index a hero can only be wearing because someone paid for it. Indices below it
 * are birth skins, free to every account: across an 84-save corpus, 0 through 3 are the only values
 * that have ever appeared as a hero's starting skin.
 */
export const FIRST_BOUGHT_SKIN_INDEX = 4;

/**
 * The Steam listing each bought skin appears under, by the `skin` index a hero record carries.
 * Nothing in a save connects the two — the market keys a skin on its hash and a hero carries a bare
 * integer — so this table is written out by hand, exactly as the act chest families are.
 *
 * `Royal Sentinel Skin` is the one name read off a live listing. The other four are owner-confirmed
 * and their ` Skin` suffix follows that single witness, which is why an index this table does not
 * name must fail closed: it resolves to no price at all rather than borrowing a neighbour's.
 */
export const BOUGHT_SKIN_HASH: Readonly<Record<number, string>> = {
  4: 'Forest Warden Skin',
  5: 'Shadow Hunter Skin',
  6: 'White Oracle Skin',
  7: 'Cobalt Sorcerer Skin',
  8: 'Royal Sentinel Skin',
};

/** The market hash for a worn skin index, or null for a birth skin and for any index unnamed above. */
export function boughtSkinHashFor(skinIndex: number): string | null {
  return BOUGHT_SKIN_HASH[skinIndex] ?? null;
}

export function defPrefixFor(steamCategoryTag: string): string | null {
  return CATEGORY_DEF_PREFIX[steamCategoryTag] ?? null;
}

/**
 * Categories that exist and are priced, but that no `ItemKind` describes. Listing them here is
 * what keeps the unmapped-tag warning meaningful: without it every run would report `chest` and
 * `skin` forever and the one run that meets a genuinely new category would look the same.
 */
export const CATEGORIES_WITHOUT_KIND: readonly string[] = ['chest', 'skin', 'stone', 'hero'];

export function isKnownCategory(steamCategoryTag: string): boolean {
  return (
    steamCategoryTag in STEAM_CATEGORY_TO_KIND || CATEGORIES_WITHOUT_KIND.includes(steamCategoryTag)
  );
}

export function catalogSlotFor(steamSlotTag: string): string | null {
  return STEAM_SLOT_TO_CATALOG[steamSlotTag] ?? null;
}

export function rarityIdxFor(steamRarityTag: string): number | null {
  return STEAM_RARITY_TO_IDX[steamRarityTag] ?? null;
}

export function itemKindFor(steamCategoryTag: string): ItemKind | null {
  return STEAM_CATEGORY_TO_KIND[steamCategoryTag] ?? null;
}

/** The Steam slot tag for a catalog slot code, for turning a catalog gap into a market query. */
export function steamSlotFor(catalogSlot: string): string | null {
  for (const [tag, code] of Object.entries(STEAM_SLOT_TO_CATALOG)) {
    if (code === catalogSlot) return tag;
  }
  return null;
}

/** The Steam rarity tag for a catalog rarity index. */
export function steamRarityFor(rarityIdx: number): string | null {
  for (const [tag, idx] of Object.entries(STEAM_RARITY_TO_IDX)) {
    if (idx === rarityIdx) return tag;
  }
  return null;
}

export function isKnownTag(facet: string, tag: string): boolean {
  if (facet === 'slot') return tag in STEAM_SLOT_TO_CATALOG;
  if (facet === 'rarity') return tag in STEAM_RARITY_TO_IDX;
  if (facet === 'category') return isKnownCategory(tag);
  return true;
}
