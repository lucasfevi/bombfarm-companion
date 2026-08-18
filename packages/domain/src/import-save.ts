// Parses a BombFarm game save-file export (account/heroes/items JSON dump)
// into importable HeroRecord candidates. Defensive by design: unknown/missing
// fields degrade gracefully (skip the hero or the affected part, never throw)
// so a save file from any account — not just the one used to build this — works.

import catalog from './data/catalog.json';
import { resolveCasaSlots, resolveFieldSlots } from './casa-slots';
import { mapInventoryItem, type InventoryItem } from './inventory';
import { ABILITIES, RarityKey, abilityMods } from './model';
import { EquippedItem, Loadout, emptyLoadout, emptySheetOther } from './gear';
import { ZERO_PTS, type SheetKey } from './planner-constants';
import { HeroRecord } from './shims/storage';
import { isKnownSkin } from './wiki-assets';
import {
  birthFromSave,
  hasUsableBirthStats,
  saveSheetUnits,
  treeTotalsFromSave,
} from './save-units';
import { composeSheetFromBirth, nakedFromBirth, type BirthStats, type TreeSheetTotals } from './birth-sheet';
import { inferSpentPoints, type PointInferenceIssue } from './point-inference';
import { ACCOUNT_SECTIONS, sectionHasData } from './account-fidelity';
import { missingPostUpdateKeys } from './save-schema';
import { WIKI_PHASE_LINES } from './phase-wiki';
import type { AccountPayload } from '@bombfarm/contracts';

const RARITY_BY_IDX: RarityKey[] = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendária', 'Mítico'];

const defById = new Map(catalog.defs.map((definition) => [definition.id, definition]));

export type ImportCandidate = {
  sourceId: string;
  name: string;
  level: number;
  rarity: RarityKey;
  rank: string | null;
  power: number;
  abilityCount: number;
  gearCount: number;
  record: Omit<HeroRecord, 'id' | 'updatedAt'>;
  matchedExistingId: string | null;
  matchedExistingName: string | null;
  /** True when this hero already exists — import will refresh gear only. */
  isGearRefresh: boolean;
  issues: string[];
  /** Typed `inferSpentPoints` issues, structurally unflattened (DEC-04, BSP-04b copy home). */
  pointIssues: PointInferenceIssue[];
  /**
   * BSPW5-05 (AC-11): an unresolvable gear reference or a missing `stats` block — never an
   * unknown ability (`AC-14`, non-blocking). `importHeroes` MUST NOT create or update a
   * blocked hero; other heroes in the same file import normally.
   */
  blocked: boolean;
};

/** Account-wide skill-tree bonuses and current house, read from `skills.totals` / `casa`. */
export type AccountImportData = {
  tree: {
    danoTotal: number;
    critChance: number;
    critDmg: number;
    speed: number;
    energy: number;
    teamCoinPct?: number;
    /** `skills.totals.xp_mult` verbatim (not a percentage). Absent/non-finite/zero → 1 (no XP boost). */
    xpMult?: number;
    /** `luck_add × 100` — flat percentage points (AD-BSP-22, ASM-01, BSPW5-03). */
    luckFlatPct: number;
  } | null;
  houseIdx: number | null;
  houseLevel: number | null;
  /**
   * HOUSE RECOVERY slots from the save (`casa.slots` ladder) when `casa` is present — how many
   * heroes the House refills at a time, NOT the field concurrency cap. See {@link fieldSlots}
   * for that. The name is kept (`slots`) because it is the persisted key on every stored
   * account and on `AccountShared`; the meaning was always `casa.slots`, only its downstream
   * READING as a field cap was wrong.
   */
  slots?: number | null;
  /**
   * `skills.field_slots` — how many heroes may stand on the field at once. `null` when the save
   * does not carry the key. Deliberately separate from {@link slots}: 6 vs 3 on account 486.
   */
  fieldSlots?: number | null;
  /**
   * `casa.cycle_secs` — a full 0 → 100% House fill in seconds, straight off the save. `null` when
   * absent, which sends every consumer back to the `HOUSES` table interpolation
   * (`resolveHouseRestSeconds`). Preferred over the table because the table is a whole-minute
   * reconstruction that runs ~7.8% fast (1077s vs a measured 1168.42s at Casa I level 11).
   */
  houseCycleSecs?: number | null;
  /** `account.phase` — the phase the player is currently farming. Null when absent. */
  phase: number | null;
  /**
   * `account.max_phase` — the furthest phase this account has reached. Falls back to
   * `skills.max_phase` when `account.max_phase` is not a finite number; `null` when neither is.
   * Normalized to an integer in `[1, WIKI_PHASE_LINES.length]`.
   *
   * SPEC_DEVIATION (design.md §5.1 specifies this field as *required*, precisely so every
   * construction site is a forced compile error). Kept optional instead: `apps/web/src/tests/
   * {account-slice,persist-account}.test.ts` construct `AccountImportData` literals without this
   * field, and both `spec.md` P2-3 AC-5 and `tasks.md` §0.5 forbid touching any file under
   * `apps/web/src` in this item ("zero web source files in the diff"). A required field would
   * force edits there to keep `pnpm typecheck` green, which the two constraints together rule
   * out. `mapAccountData`'s both return paths and `EMPTY_ACCOUNT_DATA` still set it explicitly on
   * every branch, so real production data always carries a concrete value — the optionality only
   * relaxes what *test fixtures elsewhere* are forced to supply.
   */
  maxPhase?: number | null;
};

/**
 * `AD-BSP-05` — a whole-file reject. `notASaveFile` is today's shape-check behaviour,
 * now typed; `missingBirthStats` is BSPW5-01: any hero object in `heroes[]` lacking a
 * usable `birth_stats` block rejects the whole file, not just that hero.
 *
 * MP5 F4 (`AD-088`): `unsupportedSaveShape` — a save file lacking the current game version's
 * post-update keys (`skills.refunds`, `skills.totals.vagas_campo`, `skills.totals.bag_tabs_bonus`)
 * is rejected before any hero/item/account value is read. Web-only: the gate lives in
 * {@link parseSaveFile} alone, never in {@link parseAccountPayload} — `apps/desktop` imports only
 * the latter (measured; enforced by `tools/save-acceptance-guards.test.mjs`), so this member is
 * structurally unreachable from the desktop and needs no desktop copy.
 */
export type ParseRejection = {
  reason: 'notASaveFile' | 'missingBirthStats' | 'unsupportedSaveShape';
  heroNames: string[];
};

export type ParseResult = {
  candidates: ImportCandidate[];
  warnings: string[];
  account: AccountImportData;
  inventory: InventoryItem[];
  rejected: ParseRejection | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Maps `skills.totals` (skill-tree aggregate bonuses) and `casa` (current house)
 * into the app's account-wide TreeState/HeroContext shape.
 *
 * `danoTotal` is `dmg_static` taken as an OPAQUE, already-computed total — do not try to
 * reconstruct it from `(1 + team_dmg_add) * geo_mult`. That product does not match: measured
 * `2.797` predicted vs `3624.70` actual on a real save.
 */
function mapAccountPhase(raw: Record<string, unknown>): number | null {
  const account = isObject(raw.account) ? raw.account : null;
  if (!account) return null;
  const phase = account.phase;
  return typeof phase === 'number' && Number.isFinite(phase) ? phase : null;
}

/**
 * `account.max_phase` — the furthest phase this account has reached. Falls back to
 * `skills.max_phase`; the 2026-08-13 export carries both and they agree (42 / 42). Preferring
 * `account` follows the design; the fallback covers a payload that carries `skills` without
 * `account`, which `AD-036`'s per-section fidelity model makes a real shape.
 *
 * Same latent-divergence family as `field_slots` vs `skills.totals.vagas_campo` (`AD-063`) —
 * this reader RECORDS the two sources and does not reconcile them.
 */
function mapAccountMaxPhase(raw: Record<string, unknown>): number | null {
  const account = isObject(raw.account) ? raw.account : null;
  const accountValue = account?.max_phase;
  const skills = isObject(raw.skills) ? raw.skills : null;
  const skillsValue = skills?.max_phase;

  const rawValue =
    typeof accountValue === 'number' && Number.isFinite(accountValue)
      ? accountValue
      : typeof skillsValue === 'number' && Number.isFinite(skillsValue)
        ? skillsValue
        : null;
  if (rawValue === null) return null;

  const rounded = Math.round(rawValue);
  if (rounded < 1) return null;
  return Math.min(rounded, WIKI_PHASE_LINES.length);
}

/**
 * `casa.cycle_secs` — the House's own full-fill countdown. Positive-finite or `null`; never a
 * substituted table value, so the caller can tell "the save said 1168.42" from "the save said
 * nothing and the HOUSES interpolation was used".
 */
function mapHouseCycleSecs(casa: Record<string, unknown> | null): number | null {
  if (!casa) return null;
  const raw = casa.cycle_secs;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

function mapAccountData(raw: Record<string, unknown>): AccountImportData {
  const skills = isObject(raw.skills) ? raw.skills : null;
  const totals = skills && isObject(skills.totals) ? skills.totals : null;
  const casa = isObject(raw.casa) ? raw.casa : null;
  const phase = mapAccountPhase(raw);
  const maxPhase = mapAccountMaxPhase(raw);
  // Read off `skills`, not `casa` — the field cap is a skill-tree quantity and is present even on
  // a payload that omits `casa` entirely (`AD-036` per-section fidelity).
  const fieldSlots = resolveFieldSlots(skills);

  // MOD-36: single-pass optional-field parse — stays null unless the save carries `totals`.
  let tree: AccountImportData['tree'] = null;
  if (totals) {
    tree = {
      danoTotal: asNumber(totals.dmg_static, 1) || 1,
      critChance: asNumber(totals.crit_chance_add) * 100,
      critDmg: asNumber(totals.crit_dmg_add) * 100,
      speed: asNumber(totals.speed_add) * 100,
      energy: asNumber(totals.energia_add) * 100,
      teamCoinPct: asNumber(totals.coin_add ?? totals.team_coin_add) * 100,
      xpMult: asNumber(totals.xp_mult, 1) || 1,
      // BSPW5-03 (ASM-01): flat Luck percentage points — absent key defaults to 0.
      luckFlatPct: asNumber(totals.luck_add) * 100,
    };
  }

  // MOD-36: single-pass optional-field parse — both stay null unless the save carries `casa`.
  let houseIdx: number | null = null;
  let houseLevel: number | null = null;
  if (casa) {
    const activeCasa = Math.round(asNumber(casa.active_casa, 0));
    if (activeCasa > 0) {
      houseIdx = activeCasa - 1;
      const levels = Array.isArray(casa.levels) ? casa.levels : [];
      houseLevel = Math.max(1, Math.round(asNumber(levels[houseIdx], 1)));
    }
    return {
      tree,
      houseIdx,
      houseLevel,
      slots: resolveCasaSlots(casa, houseIdx),
      fieldSlots,
      houseCycleSecs: mapHouseCycleSecs(casa),
      phase,
      maxPhase,
    };
  }

  // No `casa` block: `slots` and `houseCycleSecs` stay absent (both are casa-sourced), but
  // `fieldSlots` still comes through — it lives on `skills`, a section a payload can carry alone.
  return { tree, houseIdx, houseLevel, fieldSlots, houseCycleSecs: null, phase, maxPhase };
}

const EMPTY_ACCOUNT_DATA: AccountImportData = {
  tree: null,
  houseIdx: null,
  houseLevel: null,
  fieldSlots: null,
  houseCycleSecs: null,
  phase: null,
  maxPhase: null,
};

/**
 * Normalises a raw file object into an `AccountPayload` with no projection, validation, or
 * key-stripping (design TD-2) — `parseAccountPayload` below re-validates every field itself.
 * File-only keys (`export_version`, `generated_at`) ride along at runtime; the shared *type*
 * simply never declares them (ACS-06).
 */
function toAccountPayload(raw: unknown): AccountPayload {
  return isObject(raw) ? raw : {};
}

/**
 * MSG-11 positive discriminator, order-preserved: this mirrors — never imports — the exact
 * `notASaveFile` predicate `parseAccountPayload` runs internally, so the gate below can run
 * strictly BEFORE that function without touching its body at all (`parseAccountPayload` is
 * byte-unchanged by this feature — `AD-088`, proven by a source guard, not by argument).
 */
function looksLikeASaveFile(payload: AccountPayload): boolean {
  const raw: unknown = payload;
  return isObject(raw) && Array.isArray(raw.heroes);
}

/**
 * The file adapter over {@link parseAccountPayload} (ACS-02: unchanged name, signature,
 * observable output for every input this gate accepts).
 *
 * MP5 F4 (`MSG-11`…`MSG-13`, `AD-088`) adds ONE gate here, and only here: a value that claims to
 * be a complete save export but lacks the keys the current game version writes
 * (`POST_UPDATE_SAVE_KEYS`) is rejected before any hero, item or account value is read — never
 * migrated, never partially parsed. The gate is positive-only (asks `has(newKey)`, never
 * `!has(oldKey)`) and runs strictly between the two existing whole-file rejects: AFTER
 * `notASaveFile` (a value that does not even look like a save keeps today's exact rejection,
 * unchanged) and BEFORE `missingBirthStats` (a pre-patch or truncated file is never misdiagnosed
 * as a birth-stats problem). `parseAccountPayload` — the payload entry point `apps/desktop`
 * actually imports — is untouched: a payload legitimately omits sections per-poll (`AD-036`),
 * and gating it there would reject every degraded desktop cycle.
 */
export function parseSaveFile(raw: unknown, existing: HeroRecord[]): ParseResult {
  const payload = toAccountPayload(raw);

  if (looksLikeASaveFile(payload)) {
    const missingKeys = missingPostUpdateKeys(payload);
    if (missingKeys.length > 0) {
      return {
        candidates: [],
        // MSG-15: the diagnosis is not lost to the generic player-facing copy (T8) — it lives
        // here, in `warnings` (data, never rendered by the desktop, `AD-040`), naming exactly
        // which path-qualified keys were absent.
        warnings: [
          `This save is missing key(s) the current game version writes (${missingKeys.join(', ')}) ` +
            '— export a fresh save from the game to use the planner.',
        ],
        account: EMPTY_ACCOUNT_DATA,
        inventory: [],
        rejected: { reason: 'unsupportedSaveShape', heroNames: [] },
      };
    }
  }

  return parseAccountPayload(payload, existing);
}

/**
 * A section the payload's `fidelity` block calls `resolved` but that carries no data at all is
 * treated as a programming error, not a silent downgrade (spec.md edge cases, design TD-6):
 * surfaced as a warning, never thrown, never changing the derived grade (which stays a pure
 * function of `fidelity` alone in `deriveAccountFidelity`). The file adapter above never sets
 * `fidelity`, so this is provably empty on the file path.
 */
function resolvedButAbsentWarnings(payload: AccountPayload): string[] {
  // Defensive by design (file header): a caller handing the typed entry point a malformed
  // payload (null, a primitive) degrades to "no fidelity asserted" rather than throwing,
  // matching spec.md's edge case for `parseAccountPayload` too, not just the file adapter.
  if (payload === null || typeof payload !== 'object') return [];
  const fidelity = payload.fidelity;
  if (!fidelity) return [];
  const warnings: string[] = [];
  for (const section of ACCOUNT_SECTIONS) {
    if (fidelity[section]?.status === 'resolved' && !sectionHasData(payload, section)) {
      warnings.push(`Fidelity reports "${section}" as resolved but the payload carries no "${section}" data.`);
    }
  }
  return warnings;
}

export function parseAccountPayload(payload: AccountPayload, existing: HeroRecord[]): ParseResult {
  const raw: unknown = payload;
  const warnings: string[] = [];
  warnings.push(...resolvedButAbsentWarnings(payload));
  if (!isObject(raw) || !Array.isArray(raw.heroes)) {
    return {
      candidates: [],
      warnings: [...warnings, 'This does not look like a BombFarm save file (missing a "heroes" list).'],
      account: EMPTY_ACCOUNT_DATA,
      inventory: [],
      rejected: { reason: 'notASaveFile', heroNames: [] },
    };
  }

  // AD-BSP-05: whole-file birth scan BEFORE any per-hero work — a partial birth block on
  // even one hero rejects the whole file rather than composing a sheet from an invented
  // default (spec.md edge cases). "Any hero missing" (not "every hero missing") is the
  // correct gate — a mixed save (some heroes with birth_stats, some without) still rejects.
  const missingBirthHeroNames: string[] = [];
  for (const rawHero of raw.heroes) {
    if (!isObject(rawHero)) continue;
    if (!hasUsableBirthStats(rawHero)) {
      missingBirthHeroNames.push(asString(rawHero.name, 'Hero'));
    }
  }
  if (missingBirthHeroNames.length > 0) {
    warnings.push(
      `This save is missing birth stats on ${missingBirthHeroNames.length} hero(es) ` +
        `(${missingBirthHeroNames.join(', ')}) — re-export your save from a newer BombFarm ` +
        `build to use the planner.`,
    );
    return {
      candidates: [],
      warnings,
      account: EMPTY_ACCOUNT_DATA,
      inventory: [],
      rejected: { reason: 'missingBirthStats', heroNames: missingBirthHeroNames },
    };
  }

  const items: Record<string, unknown>[] = Array.isArray(raw.items) ? raw.items.filter(isObject) : [];
  if (!Array.isArray(raw.items)) {
    warnings.push('Save file has no "items" list — imported heroes will have no gear equipped.');
  }

  const inventory: InventoryItem[] = [];
  let unresolvedUnequipped = 0;
  let marketBlockedCount = 0;
  for (const item of items) {
    const mapped = mapInventoryItem(item);
    if (!mapped) continue;
    if (!mapped.defResolved && !mapped.equipped) unresolvedUnequipped++;
    if (mapped.marketBlocked) marketBlockedCount++;
    inventory.push(mapped);
  }
  if (unresolvedUnequipped > 0) {
    warnings.push(
      `${unresolvedUnequipped} unequipped gear item(s) could not be resolved in the catalog — they are excluded from the pool.`,
    );
  }
  if (marketBlockedCount > 0) {
    warnings.push(
      `${marketBlockedCount} gear item(s) are market-blocked and will be excluded from the optimizer pool.`,
    );
  }

  const existingBySourceId = new Map(
    existing.filter((hero): hero is HeroRecord & { sourceId: string } => !!hero.sourceId).map((hero) => [hero.sourceId, hero]),
  );

  // BSPW5-04: map the skill tree once, up front — inferSpentPoints (per hero, below) needs
  // TreeSheetTotals, so it can no longer be mapped lazily at the end via mapAccountData.
  // treeTotalsFromSave(totals ?? {}) already yields the correct identity defaults
  // (danoStatic 1, everything else 0) when `skills.totals` is absent.
  const skillsRaw = isObject(raw.skills) ? raw.skills : null;
  const totalsRaw = skillsRaw && isObject(skillsRaw.totals) ? skillsRaw.totals : null;
  const tree: TreeSheetTotals = treeTotalsFromSave(totalsRaw ?? {});

  const candidates: ImportCandidate[] = [];
  for (const rawHero of raw.heroes) {
    if (!isObject(rawHero)) continue;
    const sourceId = asString(rawHero.id);
    const name = asString(rawHero.name, 'Hero');
    if (!sourceId) {
      warnings.push(`Skipped a hero entry with no id (name: "${name}").`);
      continue;
    }

    const issues: string[] = [];
    const level = asNumber(rawHero.level, 1);
    const rarityIdx = Math.round(asNumber(rawHero.rarity, -1));
    const rarity = RARITY_BY_IDX[rarityIdx];
    if (!rarity) issues.push(`Unknown rarity index ${rarityIdx} — defaulted to Raro.`);
    const resolvedRarity = rarity ?? 'Raro';
    const rank = typeof rawHero.rank === 'string' ? rawHero.rank : null;
    const deployed = bool(rawHero.in_field);
    const battleAllowed = bool(rawHero.battle_allowed, true);
    const stars = asNumber(rawHero.stars, 0);
    // BSPW5-06 (BSP-55, DEC-05): an out-of-range skin degrades to the neutral placeholder
    // (0), never a nearest-index clamp (AD-BSP-29) — absence (undefined/null) is normal
    // and stays silent; only a genuinely present, unusable value raises an issue.
    const rawSkin = rawHero.skin;
    const skinProvided = rawSkin !== undefined && rawSkin !== null;
    const skin = isKnownSkin(rawSkin) ? Math.round(rawSkin as number) : 0;
    if (skinProvided && !isKnownSkin(rawSkin)) {
      issues.push(`Unknown skin ${JSON.stringify(rawSkin)} — defaulted to the neutral placeholder.`);
    }

    // Abilities: carry the hero's fixed pool (level 0 = unspent slot).
    const abilities: Record<string, number> = {};
    const rawAbilities = Array.isArray(rawHero.abilities) ? rawHero.abilities : [];
    for (const ability of rawAbilities) {
      if (!isObject(ability)) continue;
      const code = asString(ability.code);
      const lvl = Math.max(0, Math.round(asNumber(ability.level, 0)));
      if (!ABILITIES.some((definition) => definition.id === code)) {
        // BSP-33/-32a: warn regardless of level — a level-0 unknown slot (e.g. a new
        // ability the planner hasn't caught up with yet) is exactly how slots 17/18
        // stayed invisible before this fix. Degrades gracefully when `slot` is absent
        // or not a finite number — never throws.
        const rawSlot = ability.slot;
        const slotText = typeof rawSlot === 'number' && Number.isFinite(rawSlot) ? ` (slot ${rawSlot})` : '';
        issues.push(`Unknown ability "${code}"${slotText} skipped.`);
        continue;
      }
      abilities[code] = lvl;
    }

    // Gear: match items by equipped_on, resolve slot from the catalog definition (not
    // the save's own numeric equip_slot, which uses a different ordering).
    let blocked = false;
    const loadout: Loadout = emptyLoadout();
    // MOD-36: genuine accumulator — counts equipped slots filled while looping `items`.
    let gearCount = 0;
    for (const item of items) {
      if (asString(item.equipped_on) !== sourceId) continue;
      const defId = asString(item.def_id);
      const definition = defById.get(defId);
      if (!definition) {
        // BSPW5-05 (AC-11): unresolvable gear blocks the hero — never invent an empty slot
        // and silently feed a wrong sheet into point inference (AD-BSP-24).
        issues.push(`Unrecognized item "${defId}" — hero blocked from import.`);
        blocked = true;
        continue;
      }
      const equippedItem: EquippedItem = {
        defId,
        rarityIdx: Math.round(asNumber(item.rarity, 0)),
        level: asNumber(item.level, 10),
        upgrade: Math.round(asNumber(item.upgrade, 0)),
      };
      loadout[definition.slot] = equippedItem;
      gearCount++;
    }

    const mods = abilityMods(abilities);
    const sheetOther = {
      ...emptySheetOther(),
      critChanceFlat: mods.sheetCritChanceFlat,
      penetration: mods.sheetPenetrationRaw,
      critDmgFlat: mods.sheetCritDmgFlat,
    };

    // BSPW5-04 (ASM-02): birth-backed composition — birth_stats is guaranteed usable here,
    // the whole-file gate above already rejected any save where it was not. naked and the
    // tree-inclusive, zero-points gearedOverride are pure functions of birth/level/stars/
    // sheetOther/loadout/tree — neither needs the save's `stats` block at all; only the
    // spent-points inversion below does.
    const birth: BirthStats = birthFromSave(rawHero.birth_stats as Record<string, unknown>);
    const naked = nakedFromBirth(birth, level, stars, sheetOther);
    const gearedOverride = composeSheetFromBirth({
      birth,
      level,
      stars,
      sheetOther,
      loadout,
      pts: ZERO_PTS(),
      tree,
    });

    // Stats: the save's `stats` block is the hero's final (geared + spent-points, tree-
    // inclusive) sheet — invert it against the birth-backed naked/gearedOverride above to
    // recover the integer spent-points vector (BSPW5-05, DEC-04). A hero with no `stats`
    // block cannot be point-inferred (T5 turns this into a blocking candidate).
    const statsRaw = isObject(rawHero.stats) ? rawHero.stats : null;
    // Read regardless of whether `stats` is present — a blocked (no-`stats`) hero still carries
    // this through to `record` below, so a later re-import that recovers `stats` isn't the first
    // time the app has ever seen the player's banked points.
    const statPointsAvailable = asNumber(rawHero.stat_points_available, 0);
    let pts: Record<SheetKey, number>;
    let pointIssues: PointInferenceIssue[] = [];
    let power = 0;
    if (statsRaw) {
      const sheet = saveSheetUnits(statsRaw);
      const inferred = inferSpentPoints({ birth, level, stars, sheetOther, loadout, tree, sheet, statPointsAvailable });
      pts = inferred.pts;
      pointIssues = inferred.issues;
      if (inferred.issues.length > 0) {
        // DEC-04: one neutral English string on issues[]; the typed pointIssues[] above is
        // what Wave 6's BSP-04b copy actually names a saturated stat from.
        issues.push('Spent stat points could not be exactly matched to this save — the closest integer allocation was used.');
      }
      power = asNumber(statsRaw.power);
    } else {
      // BSPW5-05 (AC-11): a hero with birth_stats but no `stats` cannot be point-inferred —
      // block rather than guess with an invented sheet (never an unknown-ability-style warn).
      issues.push('Missing stats block — hero blocked from import (cannot infer spent points).');
      pts = ZERO_PTS();
      blocked = true;
    }

    const match = existingBySourceId.get(sourceId);

    const record: Omit<HeroRecord, 'id' | 'updatedAt'> = {
      name,
      rarity: resolvedRarity,
      level,
      stars,
      naked,
      loadout,
      altLoadout: null,
      gearedOverride,
      abilities,
      pts,
      statPointsAvailable,
      sourceId,
      rank: rank ?? undefined,
      power: power || undefined,
      deployed,
      battleAllowed,
      skin,
      birth,
    };

    candidates.push({
      sourceId,
      name,
      level,
      rarity: resolvedRarity,
      rank,
      power,
      abilityCount: Object.keys(abilities).length,
      gearCount,
      record,
      matchedExistingId: match?.id ?? null,
      matchedExistingName: match?.name ?? null,
      isGearRefresh: Boolean(match),
      issues,
      pointIssues,
      blocked,
    });
  }

  return { candidates, warnings, account: mapAccountData(raw), inventory, rejected: null };
}
