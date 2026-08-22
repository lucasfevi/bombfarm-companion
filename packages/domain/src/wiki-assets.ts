import catalog from './data/catalog.json';
import type { Slot } from './gear';
import type { DropRateId } from './phase-wiki';

/**
 * Bundled game art under `public/wiki-assets/`, sourced from the Grimório's static assets.
 *
 * Most of this tree is a byte-for-byte mirror at the same subpath, and the parts that are not are
 * worth knowing about before refreshing it:
 *
 *  - **Gem-chest sprites are not published by the wiki in any form** and are carried from the game
 *    client instead. A wiki refresh cannot restore them.
 *  - **The per-difficulty drop sprites are renamed on the way in**, so their local names do not
 *    match the upstream paths they came from. Upstream files them as bare indices or as
 *    Portuguese words carrying two misspellings; see {@link DIFFICULTY_SLUG}. The upstream path
 *    for each is recorded in `docs/bundled-art-provenance.md` — that table, not this directory,
 *    is what a refresh has to be driven from.
 *
 * Everything else (`abilities/`, `env/`, `items/`, `hero/`, `icons/`, `key/`, `nav/`) resolves to
 * a file the wiki serves at the same subpath, and those names are upstream's own.
 */
export const WIKI_ASSETS_BASE = '/wiki-assets';

export const WIKI_URL = 'https://wiki.bombfarm.net';

const SLOT_ART: Record<Slot, string> = {
  arma: 'weapon',
  elmo: 'helmet',
  peito: 'armor',
  calca: 'legs',
  bota: 'boots',
  luva: 'gloves',
  anel: 'ring',
  amuleto: 'amulet',
};

/** Rarity index → crystal overlay slug (Comum has no overlay). */
const CRYSTAL_SLUG: Record<number, string | null> = {
  0: null,
  1: 'uncommon',
  2: 'rare',
  3: 'epic',
  4: 'legendary',
  5: 'mythic',
};

const defById = new Map(catalog.defs.map((definition) => [definition.id, definition]));

/**
 * Bundled cosmetic skin count (`hero1`…`heroN` under `public/wiki-assets/hero/`).
 * All 8 are mirrored from the wiki CDN, which serves the full set at 192x192.
 * Raise this when adding a new `hero{N}_avatar.png`.
 */
export const HERO_SKIN_COUNT = 8;

/**
 * Save `skin` → bundled `hero{N}_avatar.png` N.
 * Wiki filenames `hero2` / `hero3` are swapped vs in-game skin 1 / 2.
 * Skin 7 → file 8 is INFERRED from the identity mapping that holds for indices 3..6;
 * it has not been confirmed against an in-game save carrying `skin: 7`.
 */
const SKIN_AVATAR_FILE = [1, 3, 2, 4, 5, 6, 7, 8] as const;

/** Save `skin` 0..(HERO_SKIN_COUNT-1) → bundled avatar path. */
export function heroAvatarSrc(skin: number): string {
  const index = normalizeSkin(skin);
  const file = SKIN_AVATAR_FILE[index] ?? 1;
  return `${WIKI_ASSETS_BASE}/hero/hero${file}_avatar.png`;
}

/** Wiki item icon for a catalog definition — uses native set level, not equipped instance level. */
export function itemIconSrc(defId: string): string | null {
  const definition = defById.get(defId);
  if (!definition) return null;
  const slotEn = SLOT_ART[definition.slot];
  if (!slotEn) return null;
  return `${WIKI_ASSETS_BASE}/items/lvl${definition.nativeLevel}_${slotEn}_${definition.set}.png`;
}

export function rarityCrystalSrc(rarityIdx: number): string | null {
  const slug = CRYSTAL_SLUG[Math.round(rarityIdx)];
  if (!slug) return null;
  return `${WIKI_ASSETS_BASE}/icons/crystal_${slug}.png`;
}

/** Wiki ability icon — filename matches ability id (e.g. `ponta_diamante`). */
export function abilityIconSrc(abilityId: string): string | null {
  if (!abilityId || typeof abilityId !== 'string') return null;
  return `${WIKI_ASSETS_BASE}/abilities/${abilityId}.png`;
}

/** Wiki prop art — filename matches the prop name (e.g. `gold_ore`). */
export function propIconSrc(propName: string): string | null {
  if (!propName || typeof propName !== 'string') return null;
  return `${WIKI_ASSETS_BASE}/env/${propName}.png`;
}

/**
 * Difficulty band (ato) 1..5 → the slug every per-band sprite is filed under.
 *
 * These are the English difficulty names (`GAME_DIFFICULTY_EN`, lowercased and underscored), not
 * the names upstream files carry. Upstream, the same five bands appear as bare indices on some
 * families and as Portuguese words on others — including two misspellings (`dificio`,
 * `muitodificio`, for *difícil* / *muito difícil*). Bundling those names would put another
 * project's typos in this repo's tree and leave `_1`…`_5` for a reader to decode, so the sprites
 * are renamed on the way in and this one table is the only place a band becomes a filename.
 */
const DIFFICULTY_SLUG = ['easy', 'normal', 'hard', 'very_hard', 'inferno'] as const;

/** Number of difficulty bands the per-ato drop art is drawn for. */
const DROP_ART_BANDS = 5;

function clampAto(ato: number): number {
  if (!Number.isFinite(ato)) return 1;
  return Math.max(1, Math.min(DROP_ART_BANDS, Math.round(ato)));
}

/**
 * Drop-row art: the chest the drop actually arrives in, at the difficulty of the phase asked
 * about. The key is the one exception — a ready key is not delivered in a chest, so the row
 * shows the key itself.
 *
 * Four of the five are difficulty-scaled, matching the art the game files per band and the
 * colour language a player already reads (green at Fácil through red at Inferno). The mapping
 * is the game's own, not an invention:
 *
 *  - `key`   → the gate key of that band's rarity. The band→rarity step is the same `1..5` the
 *              planner already applies in `GATE_KEY_RARITY_INDEX`.
 *  - `time`  → the House of that band. A time chest pays out house parts, so the game files its
 *              stash icon as the house itself rather than as a chest.
 *  - `stone` → the skill-stone chest of that band.
 *  - `gem`   → the gem chest of that band.
 *
 * `chest` alone is fixed, and deliberately so: an item chest's grade follows the MAP LEVEL it
 * drops at, not the difficulty, so tinting it by band would assert a relationship the game does
 * not have. It uses the same neutral wooden sprite the game's own item-chest icon constant
 * points at, which reads as "this one is not difficulty-scaled".
 */
export function dropIconSrc(dropId: DropRateId, ato: number): string | null {
  const band = clampAto(ato);
  const difficulty = DIFFICULTY_SLUG[band - 1];
  switch (dropId) {
    case 'chest':
      return chestIconSrc();
    case 'key': {
      // Keys stay filed by RARITY, not difficulty: the art is the rarity's key, and the band is
      // only how this planner picks one. Renaming them `key_easy`…`key_inferno` would assert the
      // sprites are difficulty art and hide the band→rarity step that `GATE_KEY_RARITY_INDEX`
      // makes explicit.
      const slug = CRYSTAL_SLUG[band];
      return slug ? `${WIKI_ASSETS_BASE}/key/key_${slug}.png` : null;
    }
    case 'time':
      return `${WIKI_ASSETS_BASE}/houses/house_${difficulty}.png`;
    case 'stone':
      return `${WIKI_ASSETS_BASE}/chests/skill_stone_chest_${difficulty}.png`;
    case 'gem':
      return `${WIKI_ASSETS_BASE}/chests/gem_chest_${difficulty}.png`;
    default:
      return null;
  }
}

/**
 * The House itself, by 0-based house index (Casa I..V).
 *
 * Same five sprites `dropIconSrc('time', ato)` reaches, and deliberately so: the game files one
 * House per difficulty band, and the five Casas run through the same five rarity tiers in the
 * same order (Incomum → Mítico). So Casa N and band N are the same picture, and a player already
 * reads the colour language — green Casa I through red Casa V.
 *
 * Out-of-range indices clamp rather than return `null`: every caller has a real house in hand,
 * and a missing sprite would silently drop the row's art instead of showing the nearest House.
 */
export function houseIconSrc(houseIndex: number): string {
  const band = clampAto(houseIndex + 1);
  return `${WIKI_ASSETS_BASE}/houses/house_${DIFFICULTY_SLUG[band - 1]}.png`;
}

/** Wiki gold coin chrome (nav footer icon). */
export function goldIconSrc(): string {
  return `${WIKI_ASSETS_BASE}/nav/icon_gold.png`;
}

/** The neutral item-chest sprite — same fixed art `dropIconSrc('chest', ato)` returns. */
export function chestIconSrc(): string {
  return `${WIKI_ASSETS_BASE}/chests/item_chest.png`;
}

/** The game's own gate-timer clock — used to mark a gate phase instead of a generic chip. */
export function clockIconSrc(): string {
  return `${WIKI_ASSETS_BASE}/icons/icon_clock.png`;
}

export function normalizeSkin(skin: unknown): number {
  if (typeof skin !== 'number' || !Number.isFinite(skin)) return 0;
  return Math.max(0, Math.min(HERO_SKIN_COUNT - 1, Math.round(skin)));
}

/**
 * BSPW5-06 (BSP-55, DEC-05) — parse-boundary predicate: is `skin` already a value
 * `0…HERO_SKIN_COUNT-1` that needs no clamping? Detection is deliberately separate from
 * {@link normalizeSkin}'s clamp: clamping an out-of-range import value to the NEAREST
 * valid index (what `normalizeSkin` does for stored records) would silently render a
 * DIFFERENT hero's face — the exact failure `AD-BSP-29` says raising the bound did not
 * fix. The import path uses this predicate to fall back to the neutral `0` placeholder
 * instead and raise a per-hero issue naming the unknown value.
 */
export function isKnownSkin(skin: unknown): boolean {
  if (typeof skin !== 'number' || !Number.isFinite(skin)) return false;
  const rounded = Math.round(skin);
  return rounded >= 0 && rounded <= HERO_SKIN_COUNT - 1;
}
