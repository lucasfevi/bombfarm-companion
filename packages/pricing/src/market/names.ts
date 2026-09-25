import type { ItemKind } from '@bombfarm/contracts';
import {
  ACT_CHEST_FAMILY_DEF,
  BOUGHT_SKIN_HASH,
  EQUIPMENT_CATEGORY_TAG,
  LEVEL_CHEST_DEF_PREFIX,
  itemKindFor,
} from './tags.js';
import { HERO_CATEGORY, SKIN_CATEGORY } from './types.js';

/** One committed catalog definition, as `catalog.json` records it. */
export interface CatalogDef {
  defId: string;
  set: string;
  slot: string;
  level: number;
}

/**
 * One gem, as the committed wiki bundle records it. A gem's rarity is fixed by which gem it is —
 * Emerald is always Raro, Topaz always Épico — and the market name carries no rarity at all, so
 * the bundle is the only thing that can supply it.
 */
export interface CatalogGem {
  defId: string;
  name: string;
  rarityIdx: number;
}

export interface CatalogView {
  defs: CatalogDef[];
  rarityIdxs: number[];
  /**
   * Rarity index -> the token a `def_id` spells it with. Not the catalog's rarity `code`: the
   * fixtures carry `time_part_epico` where the code for that index is `superraro`, so the token
   * follows the rarity's label instead. The builder derives these from the catalog's own labels
   * rather than hardcoding them here.
   */
  rarityTokens: Record<number, string>;
  /**
   * Every gem the game has, from the committed bundle rather than a table here: pricing is
   * imported by both shipped apps, and pulling the bundle in to answer nine gem names would ship
   * the whole file to the renderer.
   *
   * Required rather than optional on purpose: an optional field silently reproduces an
   * unlinkable row the moment a caller forgets it.
   */
  gems: CatalogGem[];
}

/**
 * The word the market spells each catalog slot with, confirmed against live listings on
 * 2026-08-28 and again on 2026-09-23. Five of the eight are not what translating the catalog code
 * would produce — `peito` is the Chestplate and `calca` the Leggings — and a wrong word here costs
 * a whole slot its price with nothing reported, so they are pinned against a well-meaning tidy-up
 * back to the obvious guesses.
 */
export const MARKET_SLOT_WORD: Readonly<Record<string, string>> = {
  arma: 'Weapon',
  elmo: 'Helmet',
  anel: 'Ring',
  amuleto: 'Amulet',
  peito: 'Chestplate',
  calca: 'Leggings',
  luva: 'Gloves',
  bota: 'Boots',
};

/**
 * The word the market spells each catalog rarity with. `Uncommon`, `Rare`, `Epic` and `Legendary`
 * are confirmed against live listings; `Common` and `Mythic` follow the same series and are
 * unconfirmed only because nothing in those rarities has been listed yet. A word that turns out
 * wrong leaves its rows unmatched rather than mismatched.
 */
export const MARKET_RARITY_WORD: Readonly<Record<number, string>> = {
  0: 'Common',
  1: 'Uncommon',
  2: 'Rare',
  3: 'Epic',
  4: 'Legendary',
  5: 'Mythic',
};

/**
 * The categories whose whole identity is a fixed name plus the rarity, each with the `def_id`
 * prefix an owned copy carries. Witnessed in the account fixtures as `map_key_raro`,
 * `time_part_epico` and `skill_stone_comum` — the same prefixes the inventory parser's `inferKind`
 * keys off — and on the market as `Gate Key (Rare)`, `Time Part (Epic)`, `Skill Stone (Common)`.
 */
export const RARITY_SUFFIXED_CATEGORIES: Readonly<
  Record<string, { marketPrefix: string; defPrefix: string }>
> = {
  key: { marketPrefix: 'Gate Key', defPrefix: 'map_key' },
  time: { marketPrefix: 'Time Part', defPrefix: 'time_part' },
  stone: { marketPrefix: 'Skill Stone', defPrefix: 'skill_stone' },
};

/** The market name an item chest is listed under, which carries a level where the others carry a rarity. */
const LEVEL_CHEST_MARKET_PREFIX = 'Item Chest';

/** The Steam category tag the chests of every family are listed under. */
const CHEST_CATEGORY = 'chest';

/** The identity behind one generated market name: everything a `MarketEntry` is keyed from. */
export interface MarketName {
  category: string;
  defId: string | null;
  set: string | null;
  /** Catalog slot code (`arma`, `elmo`, …). */
  slot: string | null;
  rarityIdx: number | null;
  level: number | null;
  act: number | null;
  kind: ItemKind | null;
  /**
   * The slot noun Steam's own `type` must name for a row with this name, where the name form
   * implies a slot at all. Null means nothing is claimed and nothing is cross-checked.
   *
   * A noun rather than the whole field: measured live, `type` IS the bare slot word, but the check
   * reads it as one word among possibly several so that a qualifier appearing in front of it is not
   * mistaken for the slot having changed.
   */
  slotWord: string | null;
}

const titleCase = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * Every market name the committed data says this app can carry, mapped to the identity behind it.
 *
 * A row is identified by looking its name up here, which is the opposite of parsing one. A parser
 * reads an unknown name and decides what it must mean, so a rename makes it confidently wrong —
 * and the game has renamed every item once already, turning `Ember Amulet (Rare)` into
 * `Ember Amulet Lv 10 (Rare)`. Generating from an identity that is already known inverts the
 * failure: a name form that moves stops being found, the row goes unkeyed, and it is reported.
 * Never wrongly priced.
 *
 * Both known forms are emitted, because both are still listed: ten rows in the pre-`Lv` form were
 * live on 2026-09-23. Two hashes sharing one identity is what `alternates` has always been for.
 */
export function generateMarketNames(catalog: CatalogView): Map<string, MarketName> {
  const names = new Map<string, MarketName>();
  const add = (name: string, identity: MarketName): void => {
    if (!names.has(name)) names.set(name, identity);
  };

  for (const def of catalog.defs) {
    const slotWord = MARKET_SLOT_WORD[def.slot];
    if (slotWord == null) continue;
    const setWord = titleCase(def.set);

    for (const rarityIdx of catalog.rarityIdxs) {
      const rarityWord = MARKET_RARITY_WORD[rarityIdx];
      if (rarityWord == null) continue;
      const identity: MarketName = {
        category: EQUIPMENT_CATEGORY_TAG,
        defId: def.defId,
        set: def.set,
        slot: def.slot,
        rarityIdx,
        level: def.level,
        act: null,
        kind: 'equipment',
        slotWord,
      };
      add(`${setWord} ${slotWord} Lv ${String(def.level)} (${rarityWord})`, identity);
      add(`${setWord} ${slotWord} (${rarityWord})`, identity);
    }
  }

  for (const gem of catalog.gems) {
    add(`${gem.name} Gem`, {
      category: 'gem',
      defId: gem.defId,
      set: null,
      slot: null,
      rarityIdx: gem.rarityIdx,
      level: null,
      act: null,
      kind: itemKindFor('gem'),
      slotWord: null,
    });
  }

  for (const [category, { marketPrefix, defPrefix }] of Object.entries(RARITY_SUFFIXED_CATEGORIES)) {
    for (const rarityIdx of catalog.rarityIdxs) {
      const rarityWord = MARKET_RARITY_WORD[rarityIdx];
      const token = catalog.rarityTokens[rarityIdx];
      if (rarityWord == null || token == null) continue;
      add(`${marketPrefix} (${rarityWord})`, {
        category,
        defId: `${defPrefix}_${token}`,
        set: null,
        slot: null,
        rarityIdx,
        level: null,
        act: null,
        kind: itemKindFor(category),
        slotWord: null,
      });
    }
  }

  // An item chest is listed by level and carries no rarity at all, while an owned one is rarity 0.
  for (const level of [...new Set(catalog.defs.map((def) => def.level))]) {
    add(`${LEVEL_CHEST_MARKET_PREFIX} (Lv ${String(level)})`, {
      category: CHEST_CATEGORY,
      defId: `${LEVEL_CHEST_DEF_PREFIX}_${String(level)}`,
      set: null,
      slot: null,
      rarityIdx: 0,
      level,
      act: null,
      kind: itemKindFor(CHEST_CATEGORY),
      slotWord: null,
    });
  }

  // An act chest's act IS its rarity tier: `Time Chest (Act 3)` is `chest_time_3` at rarity 3. So
  // the acts that can exist are exactly the non-zero rarity tiers, and no act needs tabling.
  for (const [family, defPrefix] of Object.entries(ACT_CHEST_FAMILY_DEF)) {
    for (const act of catalog.rarityIdxs.filter((idx) => idx > 0)) {
      add(`${family} (Act ${String(act)})`, {
        category: CHEST_CATEGORY,
        defId: `${defPrefix}_${String(act)}`,
        set: null,
        slot: null,
        rarityIdx: act,
        level: null,
        act,
        kind: itemKindFor(CHEST_CATEGORY),
        slotWord: null,
      });
    }
  }

  // A hero listing carries no set, slot, level or act: rarity is its whole identity, and it needs
  // no def, because an owned hero the game marks tradable looks its price up by rarity alone.
  for (const rarityIdx of catalog.rarityIdxs) {
    const rarityWord = MARKET_RARITY_WORD[rarityIdx];
    if (rarityWord == null) continue;
    add(`Hero (${rarityWord})`, {
      category: HERO_CATEGORY,
      defId: null,
      set: null,
      slot: null,
      rarityIdx,
      level: null,
      act: null,
      kind: itemKindFor(HERO_CATEGORY),
      slotWord: null,
    });
  }

  // A skin is a field on a hero rather than an inventory row, so it has no owned counterpart and
  // no price key to earn. It is generated anyway, so that a skin the table names is recognised
  // rather than reported as something nothing here understands.
  for (const hashName of Object.values(BOUGHT_SKIN_HASH)) {
    add(hashName, {
      category: SKIN_CATEGORY,
      defId: null,
      set: null,
      slot: null,
      rarityIdx: null,
      level: null,
      act: null,
      kind: itemKindFor(SKIN_CATEGORY),
      slotWord: null,
    });
  }

  return names;
}
