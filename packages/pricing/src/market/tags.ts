import type { ItemKind } from '@bombfarm/contracts';

/**
 * The identities the committed catalog cannot supply on its own, and the one mapping between
 * Steam's category vocabulary and the game's item kinds.
 *
 * The market names every item in English; the catalog names slots and rarities in the game's own
 * codes. `names.ts` is where those two vocabularies meet, because that is where a market name is
 * built from a catalog identity. What is left here is what no catalog row contains: which chest
 * family a hash belongs to, which listing a worn skin was bought as, and what kind of item a
 * Steam category is.
 */

/**
 * Each entry matches a rule in the game-data inventory parser's `inferKind`: `gem_*` is a gem,
 * `map_key_*` a key, `time_part_*` a material. Steam's `chest`, `stone`, `hero` and `skin`
 * categories are deliberately absent — `inferKind` has no rule for them either, so there is no
 * answer to copy. Rows in those categories keep their Steam category and carry a null `kind`.
 */
export const STEAM_CATEGORY_TO_KIND: Readonly<Record<string, ItemKind>> = {
  equip: 'equipment',
  gem: 'gem',
  key: 'key',
  time: 'material',
};

/** The Steam category tag for equipment, the one category keyed by catalog def rather than name. */
export const EQUIPMENT_CATEGORY_TAG = 'equip';

/**
 * Item chests key on a LEVEL rather than a rarity — `chest_item_30` against `Item Chest (Lv 30)` —
 * so their name carries the level where the other categories carry the rarity.
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
 * Only the family is tabled, because only the family is arbitrary: the act follows the name form
 * every family shares, and it doubles as the rarity tier, so `Time Chest (Act 3)` is `chest_time_3`
 * at rarity 3. Naming the families is what stops a Hero Cage taking a Time Chest's price — the two
 * are indistinguishable by anything else they carry.
 *
 * `tools/market-item-linking.test.mjs` reconciles each family across the acts the market carries
 * and fails on a family that stops linking; `tools/market-names-catalog-parity.test.mjs` fails if
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

export function itemKindFor(steamCategoryTag: string): ItemKind | null {
  return STEAM_CATEGORY_TO_KIND[steamCategoryTag] ?? null;
}
