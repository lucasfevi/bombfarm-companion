/**
 * Collections: permanent account-wide buffs unlocked by sacrificing a whole equipment set. The
 * account read carries them as `skills.totals.colecao`, one percentage per axis.
 *
 * The game does not apply them all in one place, and reading one twice is as wrong as missing it:
 * - `dano` and `xp` are already inside `dmg_static` and `xp_mult` — the server folds them in
 *   (`dmg_static = (1 + team_dmg_add) × geo_mult × (1 + dano/100)` to the bit) — so nothing
 *   here applies them again.
 * - `energia`, `critc`, `recarga` and `critd` sit on each hero's `stats` sheet. The first three
 *   multiply the whole tree-inclusive value; `critd` multiplies the excess crit damage BELOW the
 *   tree's flat add, the same part a rune scales (`runes.ts`). Measured on 22 heroes, exact.
 * - `ouro` and `sorte` touch neither the totals nor the sheet; they act on the farm economy. `ouro`
 *   multiplies on top of Team Coin — every prop's paid gold reproduces to the integer that way,
 *   and never with the two added (`collection.test.ts`).
 * - `jaula` and `forja` have not been seen non-zero, so their shape is unknown and nothing
 *   applies them.
 */
import type { SheetStats } from './gear/types';

export type Collection = {
  damagePct: number;
  critDmgPct: number;
  critChancePct: number;
  cdrPct: number;
  cagePct: number;
  energyPct: number;
  goldPct: number;
  xpPct: number;
  luckPct: number;
  forgePct: number;
};

/** The axes that land on a hero's displayed sheet. */
export type CollectionSheetPct = Pick<Collection, 'energyPct' | 'critChancePct' | 'critDmgPct' | 'cdrPct'>;

export const NO_COLLECTION: Collection = {
  damagePct: 0,
  critDmgPct: 0,
  critChancePct: 0,
  cdrPct: 0,
  cagePct: 0,
  energyPct: 0,
  goldPct: 0,
  xpPct: 0,
  luckPct: 0,
  forgePct: 0,
};

const WIRE_KEYS: Readonly<Record<keyof Collection, string>> = {
  damagePct: 'dano',
  critDmgPct: 'critd',
  critChancePct: 'critc',
  cdrPct: 'recarga',
  cagePct: 'jaula',
  energyPct: 'energia',
  goldPct: 'ouro',
  xpPct: 'xp',
  luckPct: 'sorte',
  forgePct: 'forja',
};

function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** `skills.totals.colecao` → {@link Collection}; an absent block or axis reads as no bonus. */
export function collectionFromSave(totalsRaw: Record<string, unknown>): Collection {
  const raw = totalsRaw.colecao;
  if (typeof raw !== 'object' || raw === null) return NO_COLLECTION;
  const block = raw as Record<string, unknown>;
  const out = { ...NO_COLLECTION };
  for (const key of Object.keys(WIRE_KEYS) as (keyof Collection)[]) {
    out[key] = finiteOrZero(block[WIRE_KEYS[key]]);
  }
  return out;
}

/** `ouro` multiplies on top of the tree's Team Coin bonus; neither `coin_add` nor the sheet moves with it. */
export function collectionGoldMult(collection: Pick<Collection, 'goldPct'> | null | undefined): number {
  return 1 + Math.max(0, collection?.goldPct ?? 0) / 100;
}

/**
 * PROVISIONAL — not measured yet: `sorte` is assumed to add flat percentage points to the squad's
 * drop luck, the way the tree's `luck_add` does. It is absent from both `luck_add` and the sheet.
 */
export function collectionLuckPct(collection: Pick<Collection, 'luckPct'> | null | undefined): number {
  return Math.max(0, collection?.luckPct ?? 0);
}

/** A stored {@link Collection} read back; anything that is not an object is no record at all. */
export function normalizeCollection(raw: unknown): Collection | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const out = { ...NO_COLLECTION };
  for (const key of Object.keys(NO_COLLECTION) as (keyof Collection)[]) out[key] = finiteOrZero(record[key]);
  return out;
}

/** A value identity for memo dependency lists, which compare by reference. */
export function collectionKey(collection: Collection | null | undefined): string {
  const c = collection ?? NO_COLLECTION;
  return (Object.keys(WIRE_KEYS) as (keyof Collection)[]).map((key) => c[key]).join('|');
}

export function collectionSheetPct(collection: CollectionSheetPct | undefined): CollectionSheetPct {
  const c = collection ?? NO_COLLECTION;
  return { energyPct: c.energyPct, critChancePct: c.critChancePct, critDmgPct: c.critDmgPct, cdrPct: c.cdrPct };
}

/**
 * Applies the sheet axes to a tree-inclusive sheet. `treeCritDmgPct` is the tree's flat crit-damage add;
 * `cdrFlat` is Short Fuse's, which the wiki adds after everything else, so `recarga` does not scale it.
 */
export function applyCollection(
  sheet: SheetStats,
  collection: CollectionSheetPct,
  treeCritDmgPct: number,
  cdrFlat = 0,
): SheetStats {
  return {
    ...sheet,
    energy: sheet.energy * (1 + collection.energyPct / 100),
    critChance: sheet.critChance * (1 + collection.critChancePct / 100),
    critDmg: (sheet.critDmg - treeCritDmgPct) * (1 + collection.critDmgPct / 100) + treeCritDmgPct,
    cdr: (sheet.cdr - cdrFlat) * (1 + collection.cdrPct / 100) + cdrFlat,
  };
}

/** Exact inverse of {@link applyCollection}. */
export function stripCollection(
  sheet: SheetStats,
  collection: CollectionSheetPct,
  treeCritDmgPct: number,
  cdrFlat = 0,
): SheetStats {
  return {
    ...sheet,
    energy: sheet.energy / (1 + collection.energyPct / 100),
    critChance: sheet.critChance / (1 + collection.critChancePct / 100),
    critDmg: (sheet.critDmg - treeCritDmgPct) / (1 + collection.critDmgPct / 100) + treeCritDmgPct,
    cdr: (sheet.cdr - cdrFlat) / (1 + collection.cdrPct / 100) + cdrFlat,
  };
}
