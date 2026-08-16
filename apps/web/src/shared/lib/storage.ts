import type { RarityKey } from '@bombfarm/domain/model';
import { abilityMods } from '@bombfarm/domain/model';
import type { Loadout, SheetStats } from '@bombfarm/domain/gear';
import { applyGear, emptyLoadout, emptySheet, emptySheetOther } from '@bombfarm/domain/gear';
import { mergeImportedHero } from '@bombfarm/domain/import-merge';
import { normalizePointAlloc, normalizeSheetStats } from '@bombfarm/domain/sheet-normalize';
import { normalizeSkin } from '@bombfarm/domain/wiki-assets';
import {
  normalizeAccount,
  type AccountShared,
  type HeroContext,
  type TreeState,
} from './account-shared';
import { readJson, writeJson } from './storage-json';
import { migrateCritDmgFlatBakeOnce } from './storage-critdmg-migration';
import { migrateCritChanceFlatBakeOnce } from './storage-critchance-migration';

export {
  DEFAULT_ACCOUNT,
  DEFAULT_CONTEXT,
  DEFAULT_TREE,
  normalizeAccount,
} from './account-shared';
export type { AccountShared, HeroContext, TreeState } from './account-shared';

// The localStorage primitives live in `./storage-json` so this module and the one-shot
// migrations can share them without importing each other. Re-exported here so
// `@/shared/lib/storage` stays the single import site for the rest of the app.
export {
  clearStorageWriteErrorListenersForTests,
  onStorageWriteError,
  readJson,
  writeJson,
} from './storage-json';
export type { StorageWriteErrorListener } from './storage-json';

const HEROES_KEY = 'bf-hp-heroes-v1';
const ACTIVE_KEY = 'bf-hp-active-hero-v1';
const ACCOUNT_KEY = 'bf-hp-account-v1';

/** Older point-advisor keys — read once to migrate. */
const LEGACY_HEROES_KEYS = ['bf-pa-heroes-v2', 'bf-pa-heroes-v1'] as const;
const LEGACY_ACTIVE_KEYS = ['bf-pa-active-hero-v2', 'bf-pa-active-hero-v1'] as const;
const LEGACY_ACCOUNT_KEYS = ['bf-pa-account-v1'] as const;

export type HeroRecord = {
  id: string;
  name: string;
  updatedAt: number;
  rarity: RarityKey;
  level: number;
  /** Gems→stars ritual (0-3) — multiplies naked sheet by 1 + 0.5×★ except Speed (wiki + in-game capture). */
  stars: number;
  naked: SheetStats;
  loadout: Loadout;
  altLoadout: Loadout | null;
  /**
   * Geared / composed sheet snapshot (import fills via composeSheetFromBirth).
   * Stats panel display is read-only birth→Total; this field remains for roster/power
   * and level/stars residual rescale until a dedicated cleanup.
   */
  gearedOverride: SheetStats;
  abilities: Record<string, number>;
  pts: Record<keyof SheetStats, number>;
  /**
   * Banked stat points from the save (`stat_points_available`) not reflected in `pts` —
   * points the player earned but has not yet spent in-game. Additive on `HeroRecord`
   * (defaults to 0 for pre-existing records, same back-compat pattern as `luckFlatPct`
   * before it). Feeds `ReoptInput.statPointsAvailable` so both reopt tiers
   * can allocate a hero's banked points instead of silently ignoring them.
   */
  statPointsAvailable?: number;
  /** Game save export hero id — required for roster membership (see docs/import-only-heroes.md). */
  sourceId?: string;
  /** Display-only rank letter (S/A/B/C/D/E) from an imported save file. Not used in any DPS math. */
  rank?: string;
  /** Display-only power number from an imported save file. Not used in any DPS math or sorting. */
  power?: number;
  /** Whether this hero is currently deployed in the squad (from save `in_field` or roster toggle). */
  deployed?: boolean;
  /**
   * Whether this hero is enabled in the planner. Save `battle_allowed` is always
   * authoritative — a local strip/picker toggle persists until the next import, which
   * overwrites this field. Disabled heroes are excluded from roster respec
   * recommendations. Defaults to `true` when absent.
   */
  battleAllowed?: boolean;
  /** Cosmetic avatar skin from save `skin` (0–6; see `HERO_SKIN_COUNT`). Display-only. */
  skin?: number;
  /**
   * Birth roll in planner units (from save `birth_stats`). Additive — missing on pre-persist
   * records until re-import. Required to recompose the read-only Stats Total from source.
   */
  birth?: SheetStats;
  /** @deprecated migrated into AccountShared — kept only for old saves. */
  tree?: TreeState;
  /** @deprecated migrated into AccountShared — kept only for old saves. */
  teamBuffs?: Record<string, number>;
  /** @deprecated migrated into AccountShared — kept only for old saves. */
  context?: HeroContext;
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}



/**
 * Older saves computed Geared live from naked + equipped items (`manualGeared: false`)
 * instead of storing it directly. Reconstruct that once so those heroes keep their sheet.
 */
function migrateGearedOverride(raw: Partial<HeroRecord>): SheetStats {
  if (raw.gearedOverride && raw.gearedOverride.attack > 0) return raw.gearedOverride;
  const naked = raw.naked ?? emptySheet();
  const loadout = raw.loadout ?? emptyLoadout();
  const mods = abilityMods(raw.abilities ?? {});
  const sheetOther = {
    ...emptySheetOther(),
    critChanceFlat: mods.sheetCritChanceFlat,
    penetration: mods.sheetPenetrationRaw,
    critDmgFlat: mods.sheetCritDmgFlat,
  };
  return applyGear(naked, loadout, sheetOther);
}

/** Normalize older / partial saves so load never drops fields. */
export function normalizeHero(raw: Partial<HeroRecord> & Pick<HeroRecord, 'id' | 'name'>): HeroRecord {
  return {
    id: raw.id,
    name: raw.name,
    updatedAt: raw.updatedAt ?? Date.now(),
    rarity: raw.rarity ?? 'Raro',
    level: raw.level ?? 1,
    stars: raw.stars ?? 0,
    naked: normalizeSheetStats(raw.naked),
    loadout: raw.loadout ?? emptyLoadout(),
    altLoadout: raw.altLoadout ?? null,
    gearedOverride: normalizeSheetStats(migrateGearedOverride(raw)),
    abilities: raw.abilities ?? {},
    pts: normalizePointAlloc(raw.pts),
    statPointsAvailable: raw.statPointsAvailable ?? 0,
    sourceId: raw.sourceId,
    rank: raw.rank,
    power: raw.power,
    deployed: raw.deployed ?? false,
    battleAllowed: raw.battleAllowed ?? true,
    skin: normalizeSkin(raw.skin),
    birth: raw.birth ? normalizeSheetStats(raw.birth) : undefined,
  };
}

function hasSourceId(raw: Partial<HeroRecord>): raw is Partial<HeroRecord> & { sourceId: string } {
  return typeof raw.sourceId === 'string' && raw.sourceId.length > 0;
}

function reconcileActiveHero(heroes: HeroRecord[]) {
  const activeId = readJson<string | null>(ACTIVE_KEY, null);
  if (!activeId) return;
  if (heroes.some((hero) => hero.id === activeId)) return;
  if (heroes[0]) writeJson(ACTIVE_KEY, heroes[0].id);
  else localStorage.removeItem(ACTIVE_KEY);
}


export function loadHeroes(): HeroRecord[] {
  let list = readJson<Partial<HeroRecord>[]>(HEROES_KEY, []);
  let fromLegacy = false;
  if (list.length === 0) {
    for (const key of LEGACY_HEROES_KEYS) {
      list = readJson<Partial<HeroRecord>[]>(key, []);
      if (list.length > 0) {
        fromLegacy = true;
        break;
      }
    }
  }

  const { list: critDmgMigratedList, changed: critDmgMigrationChanged } = migrateCritDmgFlatBakeOnce(list);
  list = critDmgMigratedList;

  const { list: critChanceMigratedList, changed: critChanceMigrationChanged } =
    migrateCritChanceFlatBakeOnce(list);
  list = critChanceMigratedList;

  const imported = list.filter(hasSourceId);
  const normalized = imported.map((hero) =>
    normalizeHero({ ...hero, id: hero.id ?? uid(), name: hero.name ?? 'Hero' }),
  );

  if (
    imported.length !== list.length ||
    fromLegacy ||
    critDmgMigrationChanged ||
    critChanceMigrationChanged
  ) {
    saveHeroes(normalized);
    reconcileActiveHero(normalized);
  }

  return normalized;
}

export function saveHeroes(heroes: HeroRecord[]): boolean {
  return writeJson(HEROES_KEY, heroes);
}

/**
 * Account-wide tree / team buffs / context. Seeds once from the active (or first)
 * hero if an older per-hero save still has those fields.
 */
export function loadAccountShared(): AccountShared {
  const existing = readJson<Partial<AccountShared> | null>(ACCOUNT_KEY, null);
  if (existing) return normalizeAccount(existing);

  for (const key of LEGACY_ACCOUNT_KEYS) {
    const legacy = readJson<Partial<AccountShared> | null>(key, null);
    if (legacy) {
      const migrated = normalizeAccount(legacy);
      saveAccountShared(migrated);
      return migrated;
    }
  }

  const heroes = readJson<Partial<HeroRecord>[]>(HEROES_KEY, []);
  const activeId = getActiveHeroId();
  const donor =
    (activeId ? heroes.find((hero) => hero.id === activeId) : undefined) ?? heroes[0] ?? null;
  const seeded = normalizeAccount({
    tree: donor?.tree,
    teamBuffs: donor?.teamBuffs,
    context: donor?.context,
  });
  saveAccountShared(seeded);
  return seeded;
}

export function saveAccountShared(shared: AccountShared): boolean {
  return writeJson(ACCOUNT_KEY, normalizeAccount(shared));
}

export function upsertHero(
  heroes: HeroRecord[],
  hero: Omit<HeroRecord, 'id' | 'updatedAt'> & { id?: string },
): { heroes: HeroRecord[]; saved: HeroRecord; wrote: boolean } {
  if (!hasSourceId(hero)) {
    throw new Error('upsertHero requires sourceId — use importHeroes to add roster entries');
  }
  const heroId = hero.id ?? uid();
  const saved = normalizeHero({ ...hero, id: heroId, updatedAt: Date.now() });
  const next = [...heroes];
  const existingIndex = next.findIndex((existing) => existing.id === heroId);
  if (existingIndex >= 0) next[existingIndex] = saved;
  else next.push(saved);
  const wroteHeroes = saveHeroes(next);
  const wroteActive = writeJson(ACTIVE_KEY, heroId);
  return { heroes: next, saved, wrote: wroteHeroes && wroteActive };
}

/**
 * Structural equality over the JSON-shaped value tree a `HeroRecord` is made of (nested plain
 * objects — `naked`, `pts`, `abilities`, `loadout`, `altLoadout`, `birth`, `gearedOverride` — plus
 * primitives and `null`). Recursive by construction, so it can never MISS a nested edit the way a
 * shallow compare would: an unequal leaf anywhere propagates a `false` all the way up.
 *
 * Deliberate choices:
 * - key UNION, not just `Object.keys(left)`, so a key present on one side and absent on the other
 *   is unequal — and `{ sourceId: undefined }` vs `{}` (the shape `normalizeHero` can produce for
 *   optional fields) is equal, matching what a localStorage round-trip does to them.
 * - `left === right` first, so `0`/`-0` compare EQUAL. `-0` is a known escapee into stored records
 *   (see `point-inference.ts`), and `JSON.stringify(-0)` is `"0"` — a saved record can differ from
 *   its in-memory twin by sign of zero alone, which is not an edit.
 * - `NaN === NaN` is treated as equal for the same reason: it is not a change.
 *
 * Not `JSON.stringify` on both sides: that is key-ORDER sensitive (two records with identical
 * values but different insertion order would read as different) and it silently erases `undefined`
 * asymmetries instead of deciding them.
 */
function jsonValueEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  // `Number.isNaN` narrows to the number NaN on its own — no `typeof` guard needed.
  if (Number.isNaN(left) && Number.isNaN(right)) return true;
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
    return false;
  }
  const leftIsArray = Array.isArray(left);
  if (leftIsArray !== Array.isArray(right)) return false;
  if (leftIsArray) {
    const leftArray = left as unknown[];
    const rightArray = right as unknown[];
    if (leftArray.length !== rightArray.length) return false;
    return leftArray.every((item, index) => jsonValueEqual(item, rightArray[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  for (const key of new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])) {
    if (!jsonValueEqual(leftRecord[key], rightRecord[key])) return false;
  }
  return true;
}

/**
 * `updatedAt` is a SAVE stamp, not hero data: `upsertHero` re-stamps it with `Date.now()` on every
 * autosave fire whether or not anything changed, so including it here would make this comparison
 * unsatisfiable and the identity guard below inert. Every consumer of `updatedAt`
 * (`roster-compare`'s `updated` sort key, the team-plan cache key in `stores/team-plan/types.ts`)
 * wants "when did this hero's data last change" — which a no-op autosave is not. localStorage
 * still receives the fresh stamp from `upsertHero`; only the in-memory copy declines to churn for
 * it, and the next real edit advances it in both places.
 */
function heroRecordsValueEqual(left: HeroRecord, right: HeroRecord): boolean {
  const { updatedAt: _leftStamp, ...leftData } = left;
  const { updatedAt: _rightStamp, ...rightData } = right;
  return jsonValueEqual(leftData, rightData);
}

/**
 * Apply an `upsertHero` result into React state without a full `loadHeroes()` reload.
 * Updates the matching id in place; appends when the saved hero is new to the list.
 *
 * Returns the SAME array reference when `saved` is value-equal to the record already at that
 * index. This is load-bearing, not a micro-optimisation: `state.heroes` is member 0 of
 * `readFarmDepTuple` (`stores/selectors/farm-ranking-selectors.ts`), whose members are compared
 * with `Object.is`. A fresh array identity therefore invalidates every memo keyed on that tuple
 * AND makes `selectFarmRespecView` judge a still-valid respec proposal stale — silently, since
 * `selectFarmRespecStatus` then collapses to `'idle'` and no error surfaces. The 700ms debounced
 * hero autosave (`persistence/persist-hero-draft.ts`) round-trips the roster and calls this after
 * any interaction, so `.map()`'s unconditional new array dropped live proposals on a timer.
 * Reference equality cannot serve here: `saved` is rebuilt by `normalizeHero`, so `===` never
 * hits — see {@link heroRecordsValueEqual} for the comparison and why `updatedAt` is excluded.
 *
 * Scope: this guards STATE identity only. `upsertHero` above still runs its `saveHeroes` /
 * `writeJson` on a no-op fire, and `patchHero` (`roster-slice.ts`) still calls `set` with the
 * (now identical) array. `writeHeroBattleAllowed` in `persistence/persist-roster.ts` holds the
 * same return-the-same-array contract but guards one level earlier — its compare sits BEFORE
 * `saveHeroes`, and `roster-slice.ts` early-returns on `next === state.heroes` so `set` is never
 * called at all. Skipping the redundant write here would change `upsertHero`'s save semantics and
 * is deliberately left alone.
 */
export function patchHeroInList(heroes: HeroRecord[], saved: HeroRecord): HeroRecord[] {
  const existingIndex = heroes.findIndex((hero) => hero.id === saved.id);
  if (existingIndex < 0) return [...heroes, saved];
  if (heroRecordsValueEqual(heroes[existingIndex], saved)) return heroes;
  return heroes.map((hero, index) => (index === existingIndex ? saved : hero));
}

/**
 * Bulk-merge imported heroes, matching by `sourceId` (the save file's own hero id)
 * so re-importing the same account updates existing records instead of duplicating
 * them. Unlike `upsertHero`, this writes once and never touches the active hero.
 */
/**
 * BSPW5-08 (BSP-48/50/52, AD-BSP-25): a full roster sync, not just create/update.
 *
 * `saveSourceIds` — when supplied — is the save's OWN complete hero-id set (never derived
 * from `records`, DEC-06): any existing hero whose `sourceId` is absent from it is removed
 * in the same write. A blocked candidate contributes its `sourceId` to that set but no
 * `record`, so it is kept-but-not-updated (AC-28), never removed for merely failing to
 * parse. `reconcileActiveHero` re-points (or clears, if the roster empties) the active id
 * only when a removal actually happened — it is already the exact function `loadHeroes`
 * uses, so no new re-pointing policy is introduced.
 *
 * `saveSourceIds` is optional and defaults to the CURRENT roster's own sourceIds — a
 * guaranteed removal no-op — so every existing caller that does not pass it (today's
 * `use-import-candidates.ts`, a feature file this wave does not touch) keeps today's exact
 * create/update-only behavior; `removed` is always `0` in that case. AC-27: this sync takes
 * only heroes/records/sourceIds — no account identifier or save-generation timestamp field
 * is part of its input shape at all, so none can gate a removal.
 */
export function importHeroes(
  heroes: HeroRecord[],
  records: (Omit<HeroRecord, 'id' | 'updatedAt'> & { sourceId: string })[],
  saveSourceIds?: ReadonlySet<string>,
): { heroes: HeroRecord[]; created: number; updated: number; removed: number } {
  let next = [...heroes];
  let created = 0;
  let updated = 0;
  for (const record of records) {
    const existingIndex = next.findIndex((hero) => hero.sourceId === record.sourceId);
    if (existingIndex >= 0) {
      next[existingIndex] = normalizeHero(mergeImportedHero(next[existingIndex], record));
      updated++;
    } else {
      next.push(normalizeHero({ ...record, id: uid(), updatedAt: Date.now() }));
      created++;
    }
  }

  // No-op default: the union of the roster's own sourceIds and every record just
  // created/updated above — covers 100% of `next`, so nothing is ever removed.
  const keepSourceIds =
    saveSourceIds ??
    new Set([...heroes.filter(hasSourceId).map((hero) => hero.sourceId), ...records.map((record) => record.sourceId)]);
  const beforeRemoval = next.length;
  next = next.filter((hero) => !!hero.sourceId && keepSourceIds.has(hero.sourceId));
  const removed = beforeRemoval - next.length;

  saveHeroes(next);
  if (removed > 0) reconcileActiveHero(next);
  return { heroes: next, created, updated, removed };
}

export function deleteHero(heroes: HeroRecord[], heroId: string): HeroRecord[] {
  const next = heroes.filter((hero) => hero.id !== heroId);
  saveHeroes(next);
  if (readJson<string | null>(ACTIVE_KEY, null) === heroId) localStorage.removeItem(ACTIVE_KEY);
  return next;
}

export function getActiveHeroId(): string | null {
  const current = readJson<string | null>(ACTIVE_KEY, null);
  if (current) return current;
  for (const key of LEGACY_ACTIVE_KEYS) {
    const legacy = readJson<string | null>(key, null);
    if (legacy) {
      writeJson(ACTIVE_KEY, legacy);
      return legacy;
    }
  }
  return null;
}

export function setActiveHeroId(heroId: string | null) {
  if (heroId) writeJson(ACTIVE_KEY, heroId);
  else localStorage.removeItem(ACTIVE_KEY);
}

/**
 * True when the hero-edit sections should show the "no heroes" overlay instead
 * of an editable draft — i.e. the roster is empty and no import has landed yet.
 */
export function shouldShowEmptyState(heroCount: number): boolean {
  return heroCount === 0;
}
