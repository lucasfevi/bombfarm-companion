import {
  POINT_GAIN,
  attackPointGain,
  activeDps,
  predictHitDamage,
  sustainedDps,
  type AbilityMods,
  type Context,
  type HeroSheet,
  type RarityKey,
} from './model';
import type { TreeSheetTotals } from './birth-sheet';
import { starsMult, type SheetOtherPct, type SheetStats } from './gear';
import { SHEET_KEYS, type SheetKey } from './planner-constants';
import { TEAM_BUFF_CAP, type TeamBuffId } from './team-buffs';

export type CombatMults = {
  teamDrainMult: number;
  /** The roster-wide Presságio total in FLAT crit points, already clamped at
   *  `TEAM_BUFF_CAP.pressagio_mortal` — the single value `derive()` adds to the sheet. */
  teamCritFlat: number;
  attackMult: number;
  speedMult: number;
  gateAttackMult: number;
  energyMult: number;
  critDmgMult: number;
  dmgMult: number;
};

/**
 * `treeEnergy` and `treeDanoTotal` are GONE — both now live on the sheet
 * only (`applySkillTree`), never in a combat multiplier.
 */
export type ComputeCombatMultsInput = {
  mods: AbilityMods;
  teamBuffs: Record<TeamBuffId, number>;
  extraDmgPct: number;
};

/**
 * Team auras are a property of the FIELD (confirmed 2026-08-19): every deployed hero — carrier
 * or not — experiences the SAME `min(cap, roster total)`, never an "own share" added on top of
 * an others-only figure. `ownPct` stays as a parameter (rather than deleting it and inlining
 * `Math.min`) so every call site names what it is doing: `computeCombatMults` below always
 * passes `0`, because `teamBuffs` already carries every carrier including this hero (see
 * `computeTeamBuffsFromDeployed` / `substituteHeroAbilities`, `team-buffs.ts`) — there is no
 * separate "own" term left to add. The cap is per ability ({@link TEAM_BUFF_CAP}), not a single
 * global figure — an earlier version of this comment cited `combate.team_mult_bonus_cap` as the
 * source of a single +100% cap, but that key does not exist in the live wiki payload or in this
 * repo's own drift capture; it was never a published constant.
 */
export function combineTeamAuraPct(ownPct: number, othersPct: number, cap: number): number {
  return Math.min(cap, Math.max(0, ownPct) + Math.max(0, othersPct));
}

/**
 * The Fôlego de Mineiro half of {@link computeCombatMults}, factored out so the live field
 * countdown (`resolveFieldDrainMultipliers`) can derive the same capped team drain multiplier
 * from a live on-field set without reimplementing the cap/floor arithmetic.
 */
export function teamDrainMultFromTeamBuffs(teamBuffs: Record<TeamBuffId, number>): number {
  const folegoPct = combineTeamAuraPct(0, teamBuffs.folego_mineiro || 0, TEAM_BUFF_CAP.folego_mineiro);
  return Math.max(0.01, 1 - folegoPct / 100);
}

/**
 * Team / combat multipliers used by the advisor pipeline. The skill tree no longer
 * contributes anything here — `dmg_static` and `energia_add` are sheet-level
 * factors applied once by `applySkillTree`, not a second time on top of the combat sheet.
 *
 * `teamBuffs` must be the FULL roster total for every aura, including whichever hero `mods`
 * belongs to — `abilityMods` never folds a team aura into a hero's own mods (issue #132), so
 * there is nothing left for this function to add back on top. Contra o Relógio ("gate power")
 * is a self ability, not a team aura (its wiki `kind` is `gate_power`, not `team_*`) —
 * `gateAttackMult` reads `mods` alone, same as before.
 */
export function computeCombatMults(input: ComputeCombatMultsInput): CombatMults {
  const { mods, teamBuffs, extraDmgPct } = input;
  const gritoPct = combineTeamAuraPct(0, teamBuffs.grito_guerra || 0, TEAM_BUFF_CAP.grito_guerra);
  const marchaPct = combineTeamAuraPct(0, teamBuffs.marcha_acelerada || 0, TEAM_BUFF_CAP.marcha_acelerada);
  const teamCritFlat = combineTeamAuraPct(0, teamBuffs.pressagio_mortal || 0, TEAM_BUFF_CAP.pressagio_mortal);
  return {
    teamDrainMult: teamDrainMultFromTeamBuffs(teamBuffs),
    teamCritFlat,
    attackMult: 1 + gritoPct / 100,
    speedMult: 1 + marchaPct / 100,
    gateAttackMult: mods.gateAttackMult,
    energyMult: 1,
    critDmgMult: 1,
    dmgMult: mods.dmgMult * (1 + extraDmgPct / 100),
  };
}

export type DeriveInput = {
  geared: SheetStats;
  naked: SheetStats;
  sheetOther: SheetOtherPct;
  pts: Record<SheetKey, number>;
  rarity: RarityKey;
  /** Hero level — scales attack point gain via levelPowerMult. */
  level: number;
  /** Gems→stars — scales flat attack/energy point gains (same mult as naked intrinsic). */
  stars: number;
  attackMult: number;
  energyMult: number;
  speedMult: number;
  critDmgMult: number;
  /** The hero's own Presságio rank already folded in and capped, one resolved value in FLAT
   *  crit points — see `CombatMults.teamCritFlat`. There is no separate "own" input here,
   *  matching `attackMult`/`speedMult`: the combination happens once, in `computeCombatMults`. */
  teamCritFlat: number;
  /** The whole skill tree, once — replaces the four scattered tree inputs. */
  treeSheet: TreeSheetTotals;
  penetrationPp: number;
  context: Context;
  dmgMult: number;
  mitigationPct: number;
};

export type DeriveResult = {
  delta: Record<SheetKey, number>;
  /** Marginal +1 pt on the effective combat sheet (for next-point ranking). */
  effectiveDelta: Record<SheetKey, number>;
  adjusted: SheetStats;
  effective: HeroSheet;
  dps: number;
  active: number;
  hit: number;
};

/**
 * Full pipeline from a geared sheet to effective stats and DPS numbers.
 *
 * The skill tree is applied exactly ONCE, at the sheet level (`applySkillTree`, called
 * upstream to produce `geared`/`naked`) — never again here. Exactly one
 * tree factor genuinely belongs to a per-point delta rather than the sheet:
 * `treeSheet.danoStatic` scales `delta.attack` because the sheet the delta is added to is
 * already post-`dmg_static` and attack has no ratio-based analogue to cancel it.
 * `delta.energy` needs no explicit tree factor — `gem = geared.energy /
 * naked.energy` already carries `energia_add` once `naked` is `nakedFromBirth`'s tree-free
 * output; an explicit `(1 + energyPct/100)` on top would double it.
 */
export function derive(input: DeriveInput): DeriveResult {
  const {
    geared: gearedX,
    naked,
    sheetOther,
    pts,
    rarity,
    level,
    stars,
    attackMult,
    energyMult,
    speedMult,
    critDmgMult,
    teamCritFlat,
    treeSheet,
    penetrationPp,
    context,
    dmgMult,
    mitigationPct,
  } = input;

  const gem = naked.energy > 0 ? gearedX.energy / naked.energy : 1;
  // Shared pool: +1 pt adds naked×perPt/(1+O), not naked×perPt.
  const oSpeed = 1 + sheetOther.speed;
  const oPen = 1 + sheetOther.penetration;
  const oCdr = 1 + sheetOther.cdr;
  // The birth roll everything crit-chance scales off: gear, the stat point and the skill tree
  // all read it, and Olho Clínico's flat points — which none of them multiply — come back off.
  // Presságio Mortal no longer reads it at all: it is flat points now, added straight to the
  // sheet below (already capped at TEAM_BUFF_CAP.pressagio_mortal by computeCombatMults).
  const baseCrit = naked.critChance - Math.max(0, sheetOther.critChanceFlat);
  const star = starsMult(stars);
  const atkPt = attackPointGain(level) * star;
  // GAP-W4-01 (resolved): the six pooled shared-divisor deltas below
  // (speed/critChance/critDmg/penetration/cdr/luck) needed no Wave 5 change — dividing by
  // (1 + sheetOther[key]) only was already exact once `naked` became `nakedFromBirth`'s
  // tree-free output. Energy was the ONE exception the W4 comment got wrong: `gem =
  // gearedX.energy / naked.energy` already carries `(1 + energia_add)` once `naked` is
  // tree-free, so the explicit `(1 + treeSheet.energyPct / 100)` factor that was correct
  // when `naked` was still tree-contaminated (it cancelled inside `gem` then) became a
  // second application once Wave 5 shipped a genuinely tree-free `naked` — a 1.81x
  // overstatement of every energy point on `save-20260801-crit-dmg-tree.json`
  // (`energia_add = 0.812711865`). Removed below.
  const delta: Record<SheetKey, number> = {
    // The sheet the delta is added to already carries dmg_static once — scale
    // the per-point gain by it too, or attack points would under-count against the sheet.
    // `delta.attack` has no `gem` analogue (energy's own ratio-based factor), so this
    // explicit `danoStatic` factor is NOT redundant and stays exactly as-is.
    attack: atkPt * treeSheet.danoStatic,
    energy: POINT_GAIN.energyNative * gem * star,
    speed: (POINT_GAIN.speedPctOfBase * naked.speed) / oSpeed,
    critChance: POINT_GAIN.critChancePctOfBase * baseCrit,
    // Flat — no `naked.critDmg` factor and no shared-pool divisor (POINT_GAIN.critDmgFlat).
    critDmg: POINT_GAIN.critDmgFlat,
    penetration: (POINT_GAIN.penetrationPctOfBase * naked.penetration) / oPen,
    cdr: (POINT_GAIN.cdrPctOfBase * naked.cdr) / oCdr,
    // Luck has no `other` term — no divisor, unlike the shared-pool stats above.
    luck: POINT_GAIN.luckPctOfBase * naked.luck,
  };
  const adjusted: SheetStats = { ...gearedX };
  for (const key of SHEET_KEYS) adjusted[key] = gearedX[key] + pts[key] * delta[key];
  const effective: HeroSheet = {
    rarity,
    attack: adjusted.attack * attackMult,
    energy: adjusted.energy * energyMult,
    speed: adjusted.speed * speedMult,
    critChance: adjusted.critChance + teamCritFlat,
    critDmg: adjusted.critDmg * critDmgMult,
    penetration: adjusted.penetration + penetrationPp,
    cdr: adjusted.cdr,
    attackPerPoint: atkPt * treeSheet.danoStatic * attackMult,
    energyPerPoint: POINT_GAIN.energyNative * gem * star * energyMult,
  };
  const effectiveDelta: Record<SheetKey, number> = {
    attack: effective.attackPerPoint,
    energy: effective.energyPerPoint,
    speed: delta.speed * speedMult,
    critChance: delta.critChance,
    critDmg: delta.critDmg * critDmgMult,
    penetration: delta.penetration,
    cdr: delta.cdr,
    // No combat multiplier — Luck never reaches DPS scoring.
    luck: delta.luck,
  };
  return {
    delta,
    effectiveDelta,
    adjusted,
    effective,
    dps: sustainedDps(effective, context) * dmgMult,
    active: activeDps(effective, context) * dmgMult,
    // No dmg_static anywhere here — effective.attack already carries it once, at the sheet.
    hit: predictHitDamage(effective.attack, mitigationPct / 100, effective.penetration, dmgMult),
  };
}
