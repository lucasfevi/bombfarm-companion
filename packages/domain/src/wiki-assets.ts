import catalog from './data/catalog.json';
import type { Slot } from './gear';
import type { DropRateId } from './phase-wiki';

/** Bundled mirror of Grimório static assets under `public/wiki-assets/`. */
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
 * Drop-row art, keyed by `DropRateId` — one fixed sprite per drop type.
 *
 * Four of the five show what the drop YIELDS rather than its container, which is how the
 * Grimório's own drop table pairs them: the ready key, the time piece (the game indexes the
 * same `houseparts` art as its time-part icon), a gem, and the skill stone. Only `chest` shows
 * a chest, because it yields equipment of a rolled rarity and so has no single item sprite.
 *
 * `stone` is the one deliberate divergence from the Grimório table, which reuses a chest there.
 * At the 16px this renders at, two chests differing only in tint are indistinguishable, which
 * defeats the point of an icon; the skill stone reads instantly and matches the other four
 * rows' contents-not-container scheme.
 *
 * Deliberately NOT rarity- or ato-indexed. Every one of these has a per-rarity family
 * (`key_uncommon`…`key_mythic`, `houseparts_*`, `chest_0`…`chest_5`), and the game does pick
 * within it — but a drop CHANCE row is about whether the drop lands at all, not which grade
 * lands, so a single representative keeps the panel honest about what it is measuring.
 */
const DROP_ART: Record<DropRateId, string> = {
  chest: 'icons/chest_2.png',
  key: 'key/key_uncommon.png',
  time: 'houseparts/houseparts_rare.png',
  gem: 'icons/gem_emerald_icon.png',
  stone: 'steam/stone_rare.png',
};

/** Wiki drop art for one drop-chance row — `null` for an id with no mapping. */
export function dropIconSrc(dropId: DropRateId): string | null {
  const file = DROP_ART[dropId];
  if (!file) return null;
  return `${WIKI_ASSETS_BASE}/${file}`;
}

/** Wiki gold coin chrome (nav footer icon). */
export function goldIconSrc(): string {
  return `${WIKI_ASSETS_BASE}/nav/icon_gold.png`;
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
