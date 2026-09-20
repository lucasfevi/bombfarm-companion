import catalog from './data/catalog.json' with { type: 'json' };
import type { Slot } from './gear';
import type { DropRateId } from './phase-wiki';
import type { RuneAxis } from './runes';
import type { SkillEffectKind } from './skill-tree/catalog';

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

/** Rarity index → the game's own slug for per-rarity art. Used by the slot plates, the keys,
 *  the house parts and the crystals — the client files all four under these six words. */
const RARITY_SLUG = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;

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
 * All 9 are mirrored from the wiki CDN, which serves the full set at 192x192.
 * Raise this when adding a new `hero{N}_avatar.png` — the wiki's `skins.total` is the count to
 * match, and a hero wearing a skin past this bound imports with an "Unknown skin" issue and the
 * neutral placeholder (`import-save.ts`), so a new skin has to land here in the same change.
 */
export const HERO_SKIN_COUNT = 9;

/**
 * Save `skin` → bundled `hero{N}_avatar.png` N.
 * Wiki filenames `hero2` / `hero3` are swapped vs in-game skin 1 / 2.
 * Skins 4..8 → files 5..9 were confirmed in game on 2026-09-02 by opening each bundled avatar
 * against the skin a hero was wearing, which is also how the bought skins got their listing names.
 */
const SKIN_AVATAR_FILE = [1, 3, 2, 4, 5, 6, 7, 8, 9] as const;

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

/**
 * The game's own inventory slot plate for a rarity — the lit backdrop an item icon sits on.
 * Carried from the client bundle, where the same six files are also staged under the server's
 * wiki asset tree. These replace the hand-rolled CSS gradients that used to approximate them.
 */
export function raritySlotPlateSrc(rarityIdx: number): string | null {
  const slug = RARITY_SLUG[Math.round(rarityIdx)];
  return slug ? `${WIKI_ASSETS_BASE}/background/slot_background_${slug}.png` : null;
}

/**
 * Icon for a non-gear item, by its `def_id`. Every family the game files art for is here:
 *
 *  - **gems** are named art, one sprite per stone.
 *  - **house parts** are the game's own name for what a save calls `time_part_*`; the wiki
 *    tree files them under the rarity, and the five parts run Incomum..Mítico.
 *  - **keys** are per-rarity, already bundled for the drop table.
 *  - **skill stones** are per-rarity, and are the one family filed under the game's Portuguese
 *    name (`pedra_habilidade`) rather than an English one; they are renamed on the way in, the
 *    same way the per-difficulty drop sprites are.
 *  - **chests** fall back to the neutral item chest, then to the family the id names — a gem
 *    chest and a key chest have their own art, a levelled item chest does not.
 *  - **hero cages** (`chest_hero_*`) are the field cage itself, drawn per act, since the id's
 *    tail is the act the cage was caught in and not a chest tier.
 */
export function itemKindIconSrc(defId: string, rarityIdx: number): string | null {
  if (defId.startsWith('gem_')) return `${WIKI_ASSETS_BASE}/gems/${defId}.png`;

  if (defId.startsWith('time_part_')) {
    const slug = CRYSTAL_SLUG[Math.round(rarityIdx)];
    return slug ? `${WIKI_ASSETS_BASE}/houseparts/houseparts_${slug}.png` : null;
  }

  if (defId.startsWith('map_key_')) {
    const slug = CRYSTAL_SLUG[Math.round(rarityIdx)];
    return slug ? `${WIKI_ASSETS_BASE}/key/key_${slug}.png` : null;
  }

  if (defId.startsWith('skill_stone_')) {
    const slug = RARITY_SLUG[Math.round(rarityIdx)];
    return slug ? `${WIKI_ASSETS_BASE}/stones/skill_stone_${slug}.png` : null;
  }

  if (defId.startsWith('chest_')) {
    // Every family but the item chest is drawn per tier, and `rarityIdx` already carries the tier
    // the id's tail encodes (see `chestRarityIdx`). Band and rarity index are the same number —
    // the relationship `GATE_KEY_RARITY_INDEX` makes explicit — so one slug lookup serves all.
    const band = DIFFICULTY_SLUG[Math.round(rarityIdx) - 1];
    if (defId.startsWith('chest_gem')) {
      return `${WIKI_ASSETS_BASE}/chests/gem_chest_${band ?? 'normal'}.png`;
    }
    if (defId.startsWith('chest_skill')) {
      return `${WIKI_ASSETS_BASE}/chests/skill_stone_chest_${band ?? 'normal'}.png`;
    }
    if (defId.startsWith('chest_key')) {
      const slug = CRYSTAL_SLUG[Math.round(rarityIdx)];
      return slug ? `${WIKI_ASSETS_BASE}/key/key_${slug}.png` : chestIconSrc();
    }
    // A time chest pays out house parts, and the game files its icon as the House itself rather
    // than as a chest — the same reason `dropIconSrc('time', …)` returns a House. Without this
    // branch a `chest_time_*` row fell through to the neutral wooden chest, which is the art for
    // an ITEM chest and says nothing about what is inside.
    if (defId.startsWith('chest_time')) return band ? `${WIKI_ASSETS_BASE}/houses/house_${band}.png` : chestIconSrc();
    if (defId.startsWith('chest_hero')) return heroCageIconSrc(Math.round(rarityIdx));
    return chestIconSrc();
  }

  return null;
}

export function rarityCrystalSrc(rarityIdx: number): string | null {
  const slug = CRYSTAL_SLUG[Math.round(rarityIdx)];
  if (!slug) return null;
  return `${WIKI_ASSETS_BASE}/icons/crystal_${slug}.png`;
}

/** Wiki rune icon — one sprite per axis and rarity, filed under the axis code the account read
 *  uses and the same six rarity words as the keys and the crystals. */
export function runeIconSrc(axis: RuneAxis, rarityIdx: number): string | null {
  const slug = RARITY_SLUG[Math.round(rarityIdx)];
  return slug ? `${WIKI_ASSETS_BASE}/icons/rune_${axis}_${slug}.png` : null;
}

const SKILL_KIND_ART: Readonly<Record<SkillEffectKind, string>> = {
  team_dmg: 'skill_attack_slot',
  g_crit_chance: 'skill_critical_chance_slot',
  g_crit_dmg: 'skill_critical_chance_slot',
  g_speed: 'skill_speed_slot',
  team_coin: 'skill_coin_slot',
  g_luck: 'skill_chest_slot',
  team_energia: 'skill_energy_slot',
  team_geo: 'skill_gem_slot',
  team_xp: 'skill_experience_slot',
  vagas_campo: 'membro',
  bag_tab: 'aba_de_bolsa',
};

/** The notables carry their own art, filed by title rather than by id. */
const SKILL_NOTABLE_ART: Readonly<Record<string, string>> = {
  D07: 'furia_explosiva',
  D12: 'devastacao',
  C07: 'golpe_preciso',
  C12: 'olho_mortal',
  V08: 'impeto',
  V13: 'vendaval',
  O08: 'veio_de_ouro',
  O12: 'febre_do_ouro',
  S07: 'achado_raro',
  S11: 'terouso_oculto',
  E07: 'folego_profundo',
  E11: 'coracao_de_mina',
  T01: 'sangue_ouro',
  T02: 'tempestade_precisa',
  T03: 'fortuna_dobrada',
  T04: 'pulso_da_terra',
  T05: 'cacador_de_reliquias',
  T06: 'geometria_dourada',
};

export const SKILL_HUB_ART = 'skill_map_center2';

/**
 * Wiki skill-tree art — the same medallions the game draws on its skill screen: the hub's own,
 * one per notable, and one per effect kind for the small nodes and unlocks (the first effect
 * names it).
 */
export function skillNodeArtSrc(node: { id: string; tier: string; effects: readonly { kind: SkillEffectKind }[] }): string | null {
  const file =
    node.tier === 'start' ? SKILL_HUB_ART : (SKILL_NOTABLE_ART[node.id] ?? (node.effects[0] ? SKILL_KIND_ART[node.effects[0].kind] : undefined));
  return file ? `${WIKI_ASSETS_BASE}/skills/${file}.png` : null;
}

export function skillKindArtSrc(kind: SkillEffectKind): string {
  return `${WIKI_ASSETS_BASE}/skills/${SKILL_KIND_ART[kind]}.png`;
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

/**
 * The field cage of an act, 1..5 — the sprite the wiki draws for the cage a `chest_hero_{act}`
 * came out of. The generic cage stands in for an act outside that range, so a cage row never
 * falls through to the item chest's wooden box.
 */
export function heroCageIconSrc(ato: number): string {
  return ato >= 1 && ato <= DROP_ART_BANDS ? `${WIKI_ASSETS_BASE}/env/cage_ato${ato}.png` : `${WIKI_ASSETS_BASE}/env/jaula.png`;
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
 * Parse-boundary predicate: is `skin` already a value
 * `0…HERO_SKIN_COUNT-1` that needs no clamping? Detection is deliberately separate from
 * {@link normalizeSkin}'s clamp: clamping an out-of-range import value to the NEAREST
 * valid index (what `normalizeSkin` does for stored records) would silently render a
 * DIFFERENT hero's face — the same failure seen when `normalizeSkin`'s clamp bound was
 * too low and every out-of-range hero collapsed onto the same face; raising the bound
 * alone did not fix it. The import path uses this predicate to fall back to the neutral
 * `0` placeholder instead and raise a per-hero issue naming the unknown value.
 */
export function isKnownSkin(skin: unknown): boolean {
  if (typeof skin !== 'number' || !Number.isFinite(skin)) return false;
  const rounded = Math.round(skin);
  return rounded >= 0 && rounded <= HERO_SKIN_COUNT - 1;
}
