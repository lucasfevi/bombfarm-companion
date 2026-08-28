/**
 * Helpers for sheet-math integration fixtures (BombFarm save JSON → planner sheet).
 * Mapping mirrors `import-save.ts` so tests exercise the same units as the app.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import catalog from '@bombfarm/domain/data/catalog.json';
import {
  emptyLoadout,
  emptySheetOther,
  type Loadout,
  type SheetOtherPct,
  type SheetStats,
} from '@bombfarm/domain/gear';
import { ABILITIES, abilityMods, type RarityKey } from '@bombfarm/domain/model';
import type { BirthStats } from '@bombfarm/domain/birth-sheet';
import { SHEET_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import {
  birthFromSave,
  saveSheetUnits,
  treeTotalsFromSave as treeTotalsFromSaveUnits,
} from '@bombfarm/domain/save-units';
import { expect } from 'vitest';

// Reads the domain package's own committed captures across the package boundary by relative
// path, rather than keeping a second copy here that could drift from it.
const FIXTURES_DIR = join(__dirname, '../../../../../packages/domain/tests/fixtures/sheet-math');
const defById = new Map(catalog.defs.map((d) => [d.id, d]));
const RARITY_BY_IDX: RarityKey[] = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendária', 'Mítico'];

export type SaveHeroSheet = {
  sourceId: string;
  name: string;
  level: number;
  rarity: RarityKey;
  stars: number;
  /** Remaining unspent points (level − spent). */
  statPointsAvailable: number;
  abilities: Record<string, number>;
  loadout: Loadout;
  sheetOther: SheetOtherPct;
  /** Inventory sheet in planner units (crit/cdr as %, critDmg as +%). */
  sheet: SheetStats;
  /** lv1 ★0 rolls in planner units — undefined on pre-`birth_stats` fixtures. */
  birth: BirthStats | undefined;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/**
 * The save-unit conversion — deduplicated onto the shared `save-units.ts` site (T1). This helper
 * keeps its own names so existing test call sites read the same; `save-units.test.ts` is
 * the discriminating guard on the literal conversions, not this re-export.
 */

/** Map save `stats` → planner `SheetStats` (same as import-save). */
export function mapSaveStats(statsRaw: Record<string, unknown>): SheetStats {
  return saveSheetUnits(statsRaw);
}

/** Map save `birth_stats` → planner `BirthStats` — same table as {@link mapSaveStats}. */
export function birthFromSaveUnits(birthRaw: Record<string, unknown>): BirthStats {
  return birthFromSave(birthRaw);
}

/** Map save `skills.totals` → {@link TreeSheetTotals} in planner units. */
export function treeTotalsFromSave(totalsRaw: Record<string, unknown>) {
  return treeTotalsFromSaveUnits(totalsRaw);
}

export function loadFixtureJson(filename: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, filename), 'utf8')) as Record<string, unknown>;
}

/**
 * Extract one hero from a full save fixture by name (and optional level when
 * duplicates exist, e.g. two Daras).
 */
export function extractHero(
  raw: Record<string, unknown>,
  name: string,
  level?: number,
): SaveHeroSheet {
  if (!Array.isArray(raw.heroes)) throw new Error('fixture missing heroes[]');
  const heroes = raw.heroes as unknown[];
  const rawHero = heroes.find((h) => {
    if (!isObject(h)) return false;
    if (str(h.name) !== name) return false;
    if (level != null && num(h.level) !== level) return false;
    return true;
  });
  if (!isObject(rawHero)) {
    throw new Error(`hero "${name}"${level != null ? ` L${level}` : ''} not found in fixture`);
  }

  const sourceId = str(rawHero.id);
  if (!sourceId) throw new Error(`hero "${name}" has no id`);

  const abilities: Record<string, number> = {};
  const rawAbilities = Array.isArray(rawHero.abilities) ? rawHero.abilities : [];
  for (const a of rawAbilities) {
    if (!isObject(a)) continue;
    const code = str(a.code);
    const lvl = num(a.level, 0);
    if (lvl <= 0) continue;
    if (!ABILITIES.some((definition) => definition.id === code)) continue;
    abilities[code] = lvl;
  }

  const loadout = emptyLoadout();
  const items = Array.isArray(raw.items) ? raw.items.filter(isObject) : [];
  for (const item of items) {
    if (str(item.equipped_on) !== sourceId) continue;
    const defId = str(item.def_id);
    const definition = defById.get(defId);
    if (!definition) continue;
    loadout[definition.slot] = {
      defId,
      rarityIdx: Math.round(num(item.rarity, 0)),
      level: num(item.level, 10),
      upgrade: Math.round(num(item.upgrade, 0)),
    };
  }

  const statsRaw = isObject(rawHero.stats) ? rawHero.stats : null;
  if (!statsRaw) throw new Error(`hero "${name}" missing stats`);

  const mods = abilityMods(abilities);
  const sheetOther: SheetOtherPct = {
    ...emptySheetOther(),
    critChanceFlat: mods.sheetCritChanceFlat,
    penetration: mods.sheetPenetrationRaw,
    critDmgFlat: mods.sheetCritDmgFlat,
  };

  const rarityIdx = Math.round(num(rawHero.rarity, -1));
  const birthRaw = isObject(rawHero.birth_stats) ? rawHero.birth_stats : null;
  return {
    sourceId,
    name,
    level: num(rawHero.level, 1),
    rarity: RARITY_BY_IDX[rarityIdx] ?? 'Raro',
    stars: num(rawHero.stars, 0),
    statPointsAvailable: num(rawHero.stat_points_available, 0),
    abilities,
    loadout,
    sheetOther,
    sheet: mapSaveStats(statsRaw),
    birth: birthRaw ? birthFromSaveUnits(birthRaw) : undefined,
  };
}

export function loadHero(filename: string, name: string, level?: number): SaveHeroSheet {
  return extractHero(loadFixtureJson(filename), name, level);
}

/** Absolute tolerance in planner units (tight — full-precision save stats). */
export const SHEET_ABS_TOL: Record<SheetKey, number> = {
  attack: 1e-6,
  energy: 1e-6,
  speed: 1e-6,
  critChance: 1e-6,
  critDmg: 1e-6,
  penetration: 1e-6,
  cdr: 1e-6,
  luck: 1e-6,
};

export function expectSheetsClose(
  actual: SheetStats,
  expected: SheetStats,
  keys: readonly SheetKey[] = SHEET_KEYS,
  tol: Partial<Record<SheetKey, number>> = {},
): void {
  for (const k of keys) {
    const t = tol[k] ?? SHEET_ABS_TOL[k];
    expect(Math.abs(actual[k] - expected[k]), `${k}: got ${actual[k]} want ${expected[k]}`).toBeLessThanOrEqual(
      t,
    );
  }
}
