import {
  sheetsFromBirth,
  type BirthStats,
  type TreeSheetTotals,
} from './birth-sheet';
import { projectGearedOntoLoadout, type Loadout, type SheetOtherPct, type SheetStats } from './gear';

export type ResolveDeriveSheetsInput = {
  naked: SheetStats;
  geared: SheetStats;
  loadout: Loadout;
  level: number;
  stars: number;
  sheetOther: SheetOtherPct;
  treeDanoTotal: number;
  treeCritChance: number;
  treeCritDmg: number;
  treeSpeed: number;
  treeEnergy: number;
  /** `skills.totals.luck_add × 100` — flat Luck percentage points (BSPW5-03, ASM-01). */
  treeLuckFlatPct: number;
  /**
   * Glass Cannon (C15) / Tempo Dobrado (V15) — same booleans `computeCombatMults` used to take
   * before the keystone sheet-math correction moved their effects to `applySkillTree`. Default
   * `false` for callers that predate this field (identity: no keystone effect).
   */
  treeGlassCannon?: boolean;
  /**
   * `skills.totals.crit_dmg_mult`, carried as the persisted numeric rather than re-derived
   * from {@link treeGlassCannon}. `detectGlassCannon` flags the keystone at `>= 1.5`, so the
   * boolean cannot reconstruct the value: a save carrying `1.7` would compute ×2 here while
   * the store-selector path used `1.7`, and the same account would show two different
   * crit-damage numbers depending on which code path rendered it.
   */
  treeCritDmgMult?: number;
  treeTempoDobrado?: boolean;
  /** Abisso — zeroes Crit tree sheet adds before applySkillTree / birth recompose. */
  treeAbisso?: boolean;
  /**
   * When set, naked/geared for derive are recomposed from birth (tree-inclusive zero-pts
   * geared) so Points After / DPS stay aligned with Stats Total after level/stars/tree edits.
   */
  birth?: BirthStats | null;
};

export type ResolvedDeriveSheets = {
  treeSheet: TreeSheetTotals;
  nakedForDerive: SheetStats;
  gearedForDerive: SheetStats;
};

/**
 * Builds the pipeline's skill-tree sheet and picks which naked/geared sheets `derive` should
 * use — birth-recomposed when `birth` is present, stored naked/gearedOverride otherwise.
 * Extracted from `computeAdvisorPipeline` (advisor-pipeline.ts) to keep that file under the
 * repo's max-lines budget; behavior is unchanged.
 */
export function resolveDeriveSheets(input: ResolveDeriveSheetsInput): ResolvedDeriveSheets {
  const {
    naked,
    geared,
    loadout,
    level,
    stars,
    sheetOther,
    treeDanoTotal,
    treeCritChance,
    treeCritDmg,
    treeSpeed,
    treeEnergy,
    treeLuckFlatPct,
    treeGlassCannon = false,
    treeCritDmgMult,
    treeTempoDobrado = false,
    birth,
  } = input;

  // luckFlatPct from account slice (skills.totals.luck_add × 100). `critDmgMult` is the
  // persisted `skills.totals.crit_dmg_mult`, NOT `treeGlassCannon ? 2 : 1` — `detectGlassCannon`
  // flags the keystone at `>= 1.5`, so the boolean cannot reconstruct a non-2 value and this
  // path would silently disagree with `selectTreeSheetTotals`, which reads the numeric. The
  // boolean is still required on its own: Glass Cannon's energy ×0.5 has no numeric in the save.
  // Falls back to the boolean only when the numeric is absent (pre-persistence callers/state).
  const treeSheet: TreeSheetTotals = {
    danoStatic: treeDanoTotal,
    energyPct: treeEnergy,
    speedPct: treeSpeed,
    critChancePct: treeCritChance,
    critDmgPct: treeCritDmg,
    luckFlatPct: treeLuckFlatPct,
    critDmgMult: treeCritDmgMult ?? (treeGlassCannon ? 2 : 1),
    glassCannon: treeGlassCannon,
    tempoDobrado: treeTempoDobrado,
  };

  // Birth-backed heroes: ignore stored naked/gearedOverride for math — residual level/stars
  // rescale understates multiplicative tree (dmg_static) on the catalog Δ.
  const birthSheets = birth
    ? sheetsFromBirth({
        birth,
        level,
        stars,
        sheetOther,
        loadout,
        tree: treeSheet,
      })
    : null;

  return {
    treeSheet,
    nakedForDerive: birthSheets?.naked ?? naked,
    gearedForDerive: birthSheets?.geared ?? geared,
  };
}

/**
 * Geared sheet for gear-compare clone DPS.
 *
 * Birth-backed heroes must recompose from birth on the alt loadout — the same
 * path Apply to current uses. `projectGearedOntoLoadout` only reverses catalog
 * gear off `gearedForDerive`, which already includes the skill tree, so attack
 * `dmg_static` and pooled tree `_add` terms distort whenever gear deltas are
 * nonzero — clone preview DPS then disagrees with post-apply DPS.
 *
 * Without birth, keep projecting the observed sheet so typed drift still yields
 * a 0% delta when clone === current.
 */
export function resolveCloneGeared(input: {
  birth?: BirthStats | null;
  gearedForDerive: SheetStats;
  loadout: Loadout;
  altLoadout: Loadout;
  sheetOther: SheetOtherPct;
  level: number;
  stars: number;
  treeSheet: TreeSheetTotals;
}): SheetStats {
  if (input.birth) {
    return sheetsFromBirth({
      birth: input.birth,
      level: input.level,
      stars: input.stars,
      sheetOther: input.sheetOther,
      loadout: input.altLoadout,
      tree: input.treeSheet,
    }).geared;
  }
  return projectGearedOntoLoadout(
    input.gearedForDerive,
    input.loadout,
    input.altLoadout,
    input.sheetOther,
  );
}
