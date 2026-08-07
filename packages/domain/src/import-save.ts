// Parses a BombFarm game save-file export (account/heroes/items JSON dump)
// into importable HeroRecord candidates. Defensive by design: unknown/missing
// fields degrade gracefully (skip the hero or the affected part, never throw)
// so a save file from any account — not just the one used to build this — works.

import catalog from './data/catalog.json';
import { resolveCasaSlots } from './casa-slots';
import { mapInventoryItem, type InventoryItem } from './inventory';
import { ABILITIES, RarityKey, abilityMods } from './model';
import { EquippedItem, Loadout, emptyLoadout, emptySheetOther } from './gear';
import { ZERO_PTS, type SheetKey } from './planner-constants';
import { HeroRecord } from './shims/storage';
import { isKnownSkin } from './wiki-assets';
import { birthFromSave, hasUsableBirthStats, saveSheetUnits, treeTotalsFromSave } from './save-units';
import { composeSheetFromBirth, nakedFromBirth, type BirthStats, type TreeSheetTotals } from './birth-sheet';
import { inferSpentPoints, type PointInferenceIssue } from './point-inference';
import { unmodelledTreeFindings } from './tree-guards';

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
    glassCannon: boolean;
    tempoDobrado: boolean;
    teamCoinPct?: number;
    /** `luck_add × 100` — flat percentage points (AD-BSP-22, ASM-01, BSPW5-03). */
    luckFlatPct: number;
  } | null;
  houseIdx: number | null;
  houseLevel: number | null;
  /** Casa field slots from the save (`casa.slots` ladder) when `casa` is present. */
  slots?: number | null;
};

/**
 * `AD-BSP-05` — a whole-file reject. `notASaveFile` is today's shape-check behaviour,
 * now typed; `missingBirthStats` is BSPW5-01: any hero object in `heroes[]` lacking a
 * usable `birth_stats` block rejects the whole file, not just that hero.
 */
export type ParseRejection = {
  reason: 'notASaveFile' | 'missingBirthStats';
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
 * `danoTotal` and the two keystone flags are best-effort: `dmg_static` matches
 * `(1 + team_dmg_add) * geo_mult` almost exactly in every save sampled so far,
 * which is why it's used directly as the in-game "Total damage x" figure —
 * worth double-checking against the tree screen once. Glass Cannon is detected
 * from `crit_dmg_mult` (a direct mechanical signal); Tempo Dobrado has no such
 * signal and only lights up if `keystones` contains an id we recognize, so it
 * defaults to off (safe: the user can still tick it manually).
 */
function mapAccountData(raw: Record<string, unknown>): AccountImportData {
  const skills = isObject(raw.skills) ? raw.skills : null;
  const totals = skills && isObject(skills.totals) ? skills.totals : null;
  const casa = isObject(raw.casa) ? raw.casa : null;

  // MOD-36: single-pass optional-field parse — stays null unless the save carries `totals`.
  let tree: AccountImportData['tree'] = null;
  if (totals) {
    const keystones = Array.isArray(totals.keystones) ? totals.keystones.map((keystone) => String(keystone).toLowerCase()) : [];
    tree = {
      danoTotal: asNumber(totals.dmg_static, 1) || 1,
      critChance: asNumber(totals.crit_chance_add) * 100,
      critDmg: asNumber(totals.crit_dmg_add) * 100,
      speed: asNumber(totals.speed_add) * 100,
      energy: asNumber(totals.energia_add) * 100,
      glassCannon: asNumber(totals.crit_dmg_mult, 1) >= 1.5,
      tempoDobrado: keystones.some((keystone) => keystone.includes('tempo') || keystone === 'v15'),
      teamCoinPct: asNumber(totals.coin_add ?? totals.team_coin_add) * 100,
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
    };
  }

  return { tree, houseIdx, houseLevel };
}

const EMPTY_ACCOUNT_DATA: AccountImportData = { tree: null, houseIdx: null, houseLevel: null };

export function parseSaveFile(raw: unknown, existing: HeroRecord[]): ParseResult {
  const warnings: string[] = [];
  if (!isObject(raw) || !Array.isArray(raw.heroes)) {
    return {
      candidates: [],
      warnings: ['This does not look like a BombFarm save file (missing a "heroes" list).'],
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
  // (danoStatic 1, critDmgMult 1, everything else 0) when `skills.totals` is absent.
  const skillsRaw = isObject(raw.skills) ? raw.skills : null;
  const totalsRaw = skillsRaw && isObject(skillsRaw.totals) ? skillsRaw.totals : null;
  const tree: TreeSheetTotals = treeTotalsFromSave(totalsRaw ?? {});

  // BSPW5-06 (BSP-61, DEC-07/DEC-08): surface every deliberately-unmodelled skill-tree
  // clause live in this save, so a maintainer decides with real data instead of the
  // deferral silently drifting into a bug.
  warnings.push(...unmodelledTreeFindings(totalsRaw ?? {}));

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
      critChance: mods.sheetCritChancePctOfBase / 100,
      penetration: mods.sheetPenetrationRaw,
      critDmg: mods.sheetCritDmgPctOfBase,
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
    let pts: Record<SheetKey, number>;
    let pointIssues: PointInferenceIssue[] = [];
    let power = 0;
    if (statsRaw) {
      const sheet = saveSheetUnits(statsRaw);
      const statPointsAvailable = asNumber(rawHero.stat_points_available, 0);
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
