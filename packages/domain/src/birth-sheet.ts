/**
 * AD-BSP-19, as code — the game's own birth → naked → displayed-sheet formula block.
 *
 * `P = 1 + 0.04 × (level − 1)` (levelPowerMult) · `S = 1 + 0.5 × ★` (starsMult, ★ exempt for speed).
 * Pooled keys (speed, critChance, critDmg, penetration, cdr) fold gear + points + tree `_add`
 * terms into one shared `sharedForward` pool (already `gear/apply.ts`); attack and energy are
 * multiplicative-subtotal shapes; luck's tree term is a flat percentage-point addend
 * (AD-BSP-22). See `docs/architecture.md` ownership rule 2 — pure math, no React.
 */
import { levelPowerMult } from '@/shared/domain/model/combat';
import { applyPoints } from '@/shared/domain/gear/apply';
import { starsMult } from '@/shared/domain/gear/catalog';
import type { Loadout, PointAlloc, SheetOtherPct, SheetStats } from '@/shared/domain/gear/types';
import { ZERO_PTS } from '@/shared/domain/planner-constants';

/**
 * lv1 ★0 rolls in PLANNER units (AD-BSP-19a already applied — crit chance/luck/CDR are
 * percent, penetration is 1:1, crit dmg is `(x − 1) × 100` excess percentage points).
 * Same shape as {@link SheetStats} deliberately — they are interchangeable at the type
 * level, so unit discipline lives in the save→planner converter and its test, not here.
 */
export type BirthStats = SheetStats;

/**
 * `skills.totals` in the units the planner store already uses. `luckFlatPct` is wired from
 * the account slice as of Wave 5 (`skills.totals.luck_add × 100`, BSPW5-03). `critDmgMult`
 * stays unstored — 1.0 in every fixture repo-wide; callers pass `1` and
 * `unmodelledTreeFindings` (BSPW4-13) fails loudly the day a save disagrees.
 */
export type TreeSheetTotals = {
  /** `dmg_static` — raw multiplier on the attack subtotal. Store: `treeDanoTotal`. */
  danoStatic: number;
  /** `energia_add × 100` — percent, multiplies the energy subtotal. Store: `treeEnergy`. */
  energyPct: number;
  /** `speed_add × 100` — percent of the birth roll, joins the shared pool. Store: `treeSpeed`. */
  speedPct: number;
  /** `crit_chance_add × 100` — percent of base, shared pool. Store: `treeCritChance`. */
  critChancePct: number;
  /** `crit_dmg_add × 100` — percent of the crit-damage base, shared pool. Store: `treeCritDmg`. */
  critDmgPct: number;
  /** `luck_add × 100` — FLAT percentage points, added after gear and points (AD-BSP-22). */
  luckFlatPct: number;
  /**
   * `crit_dmg_mult` — 1.0 in every export today; unexercised. Not consumed by
   * {@link applySkillTree} (DEC-08 keeps the Glass Cannon combat-path multiplier, a
   * different mechanic, exactly as-is in `derive.ts`/`computeCombatMults`). Carried here
   * only so `tree-guards.ts`'s `unmodelledTreeFindings` has a single typed home to check
   * against — see `BSPW4-13`.
   */
  critDmgMult: number;
};

/** `1 + max(0, percent)` — the shared-pool clamp already used by `gear/apply.ts`. */
function poolFactor(percent: number): number {
  return 1 + Math.max(0, percent);
}

/**
 * Hero + Ability sheet: no gear, no points, no skill tree (DEC-03). Attack scales by
 * level and stars; energy/critChance/critDmg/penetration/cdr/luck scale by stars only;
 * speed is never star-scaled (level-stars-sheet.md). Pooled keys (those present on
 * {@link SheetOtherPct}) fold in the on-sheet ability contribution multiplicatively;
 * luck takes no `sheetOther` term (AD-BSP-19).
 */
export function nakedFromBirth(
  birth: BirthStats,
  level: number,
  stars: number,
  sheetOther: SheetOtherPct,
): SheetStats {
  const star = starsMult(stars);
  return {
    attack: birth.attack * levelPowerMult(level) * star,
    energy: birth.energy * star,
    speed: birth.speed * poolFactor(sheetOther.speed),
    critChance: birth.critChance * poolFactor(sheetOther.critChance) * star,
    critDmg: birth.critDmg * poolFactor(sheetOther.critDmg) * star,
    penetration: birth.penetration * poolFactor(sheetOther.penetration) * star,
    cdr: birth.cdr * poolFactor(sheetOther.cdr) * star,
    luck: birth.luck * star,
  };
}

/**
 * Apply the skill tree on top of a sheet that already carries gear + points
 * (`applyPoints`'s output). Exactly the four `AD-BSP-22` shapes: `speed_add` /
 * `crit_chance_add` / `crit_dmg_add` add `base × add` to the shared pool, where
 * `base = naked[key] / (1 + sheetOther[key])` recovers the pre-ability roll (the same
 * base the tree/ability additions already use in `derive.ts`); `energia_add` multiplies
 * the energy subtotal; `dmg_static` multiplies the attack subtotal; `luck_add` is a flat
 * percentage-point addend. Penetration and cdr receive exactly `0` — `skills.totals` has
 * no node for either today (AD-BSP-22's forward-safety clause).
 */
export function applySkillTree(
  sheet: SheetStats,
  naked: SheetStats,
  sheetOther: SheetOtherPct,
  tree: TreeSheetTotals,
): SheetStats {
  const baseSpeed = naked.speed / poolFactor(sheetOther.speed);
  const baseCritChance = naked.critChance / poolFactor(sheetOther.critChance);
  const baseCritDmg = naked.critDmg / poolFactor(sheetOther.critDmg);
  return {
    attack: sheet.attack * tree.danoStatic,
    energy: sheet.energy * (1 + tree.energyPct / 100),
    speed: sheet.speed + baseSpeed * (tree.speedPct / 100),
    critChance: sheet.critChance + baseCritChance * (tree.critChancePct / 100),
    critDmg: sheet.critDmg + baseCritDmg * (tree.critDmgPct / 100),
    penetration: sheet.penetration,
    cdr: sheet.cdr,
    luck: sheet.luck + tree.luckFlatPct,
  };
}

export type ComposeSheetFromBirthInput = {
  birth: BirthStats;
  level: number;
  stars: number;
  sheetOther: SheetOtherPct;
  loadout: Loadout;
  pts: PointAlloc;
  tree: TreeSheetTotals;
};

/**
 * The full birth → displayed-sheet chain: `nakedFromBirth` → `applyPoints` (existing
 * shared pool) → `applySkillTree`. Reuses `applyPoints` rather than reimplementing the
 * pool (DEC-03) — the tree `_add` keys are algebraically additive pool members, so this
 * composition is exact through the existing gear/points machinery.
 */
export function composeSheetFromBirth(input: ComposeSheetFromBirthInput): SheetStats {
  const naked = nakedFromBirth(input.birth, input.level, input.stars, input.sheetOther);
  const pooled = applyPoints(
    naked,
    input.loadout,
    input.pts,
    input.sheetOther,
    input.level,
    input.stars,
  );
  return applySkillTree(pooled, naked, input.sheetOther, input.tree);
}

/**
 * Birth-backed naked + tree-inclusive zero-points sheet for derive / persistence sync.
 * Prefer this over residual rescale when `birth` is present — residual understates
 * multiplicative tree terms (e.g. `dmg_static`) after level/stars changes.
 */
export function sheetsFromBirth(
  input: Omit<ComposeSheetFromBirthInput, 'pts'>,
): { naked: SheetStats; geared: SheetStats } {
  const naked = nakedFromBirth(input.birth, input.level, input.stars, input.sheetOther);
  const geared = composeSheetFromBirth({ ...input, pts: ZERO_PTS() });
  return { naked, geared };
}
