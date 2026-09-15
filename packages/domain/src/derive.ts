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
import { runeSheetMultipliers, type HeroRune } from './runes';
import { matilhaMult } from './model/matilha';
import type { TeamBuffId } from './team-buffs';
import { teamAuraLayer } from './team-aura-layer';

export type CombatMults = {
  teamDrainMult: number;
  /** The roster-wide Presságio total in FLAT crit points, already clamped at
   *  `TEAM_BUFF_CAP.pressagio_mortal` — the single value `derive()` adds to the sheet. */
  teamCritFlat: number;
  /** The roster-wide Brecha total in FLAT penetration points, already clamped at
   *  `TEAM_BUFF_CAP.brecha` — `derive()`'s `penetrationPp`. */
  teamPenFlat: number;
  attackMult: number;
  speedMult: number;
  gateAttackMult: number;
  energyMult: number;
  /** Matilha's capped pack factor at this field size (`matilhaMult`) — a factor of `dmgMult`,
   *  surfaced so a breakdown can print it as its own term. */
  packMult: number;
  /**
   * What every single blast carries: `packMult × (1 + extra)`. The number a damage popup shows
   * is the sheet attack through mitigation times this — Detonação Dupla's second blast is a
   * separate popup, and Misericórdia's execute is a rock destroyed, not a larger hit.
   */
  hitMult: number;
  /**
   * Expected damage per bomb, relative to the sheet attack: `hitMult × abilities`, where
   * `abilities` is `AbilityMods.dmgMult` — the second-blast chance and the execute threshold as
   * expectations. DPS, gate damage and hits-to-kill read this; a printed hit never does.
   */
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
  /** Other heroes on the field beside this one — Matilha's allies. Absent reads as none. */
  fieldAllies?: number;
};

export { combineTeamAuraPct, teamDrainMultFromTeamBuffs } from './team-aura-layer';

/**
 * Team / combat multipliers used by the advisor pipeline. The skill tree no longer
 * contributes anything here — `dmg_static` and `energia_add` are sheet-level
 * factors applied once by `applySkillTree`, not a second time on top of the combat sheet.
 *
 * `teamBuffs` must be the FULL roster total for every aura, including whichever hero `mods`
 * belongs to — `abilityMods` never folds a team aura into a hero's own mods (PR #139), so
 * there is nothing left for this function to add back on top. Contra o Relógio ("gate power")
 * is a self ability, not a team aura (its wiki `kind` is `gate_power`, not `team_*`) —
 * `gateAttackMult` reads `mods` alone, same as before.
 */
export function computeCombatMults(input: ComputeCombatMultsInput): CombatMults {
  const { mods, teamBuffs, extraDmgPct } = input;
  const auras = teamAuraLayer(teamBuffs);
  const packMult = matilhaMult(mods.packDmgPctPerAlly / 100, input.fieldAllies ?? 0);
  const hitMult = packMult * (1 + extraDmgPct / 100);
  return {
    teamDrainMult: auras.teamDrainMult,
    teamCritFlat: auras.teamCritFlat,
    teamPenFlat: auras.teamPenFlat,
    attackMult: auras.attackMult,
    speedMult: auras.speedMult,
    gateAttackMult: mods.gateAttackMult,
    energyMult: 1,
    packMult,
    hitMult,
    dmgMult: mods.dmgMult * hitMult,
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
  /** The hero's own Presságio rank already folded in and capped, one resolved value in FLAT
   *  crit points — see `CombatMults.teamCritFlat`. There is no separate "own" input here,
   *  matching `attackMult`/`speedMult`: the combination happens once, in `computeCombatMults`. */
  teamCritFlat: number;
  /** The whole skill tree, once — replaces the four scattered tree inputs. */
  treeSheet: TreeSheetTotals;
  /** FLAT penetration points added after the sheet — the roster's capped Brecha total
   *  (`CombatMults.teamPenFlat`), the same shape as `teamCritFlat`. */
  penetrationPp: number;
  context: Context;
  /** `CombatMults.hitMult` — what `hit` carries. */
  hitMult: number;
  /** `CombatMults.dmgMult` — what `dps` and `active` carry. */
  dmgMult: number;
  mitigationPct: number;
  /**
   * The runes already folded into `geared`. A rune multiplies the point too (`runes.ts`), so
   * every per-point delta below carries its axis's factor — except energy, whose factor rides
   * in `gem` the same way `energia_add` does.
   */
  runes?: readonly HeroRune[] | undefined;
};

export type DeriveResult = {
  delta: Record<SheetKey, number>;
  /** Marginal +1 pt on the effective combat sheet (for next-point ranking). */
  effectiveDelta: Record<SheetKey, number>;
  adjusted: SheetStats;
  effective: HeroSheet;
  dps: number;
  active: number;
  /** One non-crit blast: sheet attack through mitigation × `hitMult`. */
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
    teamCritFlat,
    treeSheet,
    penetrationPp,
    context,
    hitMult,
    dmgMult,
    mitigationPct,
  } = input;
  const rune = runeSheetMultipliers(input.runes ?? []);

  const gem = naked.energy > 0 ? gearedX.energy / naked.energy : 1;
  // Shared pool: +1 pt adds naked×perPt/(1+O), not naked×perPt.
  const oSpeed = 1 + sheetOther.speed;
  const oCdr = 1 + sheetOther.cdr;
  // The birth roll everything crit-chance scales off: gear, the stat point and the skill tree
  // all read it, and Olho Clínico's flat points — which none of them multiply — come back off.
  // Presságio Mortal no longer reads it at all: it is flat points now, added straight to the
  // sheet below (already capped at TEAM_BUFF_CAP.pressagio_mortal by computeCombatMults).
  const baseCrit = naked.critChance - Math.max(0, sheetOther.critChanceFlat);
  // Same placement for penetration: Ponta de Diamante's points are flat and outside the pool.
  const basePen = naked.penetration - Math.max(0, sheetOther.penetration);
  const star = starsMult(stars);
  const atkPt = attackPointGain(level) * star;
  // Resolved: the six pooled shared-divisor deltas below
  // (speed/critChance/critDmg/penetration/cdr/luck) need no tree divisor — dividing by
  // (1 + sheetOther[key]) only was already exact once `naked` became `nakedFromBirth`'s
  // tree-free output. Energy was the ONE exception: `gem =
  // gearedX.energy / naked.energy` already carries `(1 + energia_add)` once `naked` is
  // tree-free, so the explicit `(1 + treeSheet.energyPct / 100)` factor that was correct
  // when `naked` was still tree-contaminated (it cancelled inside `gem` then) became a
  // second application once `naked` became genuinely tree-free — a 1.81x
  // overstatement of every energy point on `save-20260801-crit-dmg-tree.json`
  // (`energia_add = 0.812711865`). Removed below.
  const delta: Record<SheetKey, number> = {
    // The sheet the delta is added to already carries dmg_static once — scale
    // the per-point gain by it too, or attack points would under-count against the sheet.
    // `delta.attack` has no `gem` analogue (energy's own ratio-based factor), so this
    // explicit `danoStatic` factor is NOT redundant and stays exactly as-is.
    attack: atkPt * treeSheet.danoStatic * rune.attack,
    energy: POINT_GAIN.energyNative * gem * star,
    speed: ((POINT_GAIN.speedPctOfBase * naked.speed) / oSpeed) * rune.speed,
    critChance: POINT_GAIN.critChancePctOfBase * baseCrit * rune.critChance,
    // Flat — no `naked.critDmg` factor and no shared-pool divisor (POINT_GAIN.critDmgFlat).
    critDmg: POINT_GAIN.critDmgFlat * rune.critDmg,
    penetration: POINT_GAIN.penetrationPctOfBase * basePen,
    cdr: ((POINT_GAIN.cdrPctOfBase * naked.cdr) / oCdr) * rune.cdr,
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
    critDmg: adjusted.critDmg,
    penetration: adjusted.penetration + penetrationPp,
    cdr: adjusted.cdr,
    attackPerPoint: delta.attack * attackMult,
    energyPerPoint: delta.energy * energyMult,
  };
  const effectiveDelta: Record<SheetKey, number> = {
    attack: effective.attackPerPoint,
    energy: effective.energyPerPoint,
    speed: delta.speed * speedMult,
    critChance: delta.critChance,
    critDmg: delta.critDmg,
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
    hit: predictHitDamage(effective.attack, mitigationPct / 100, effective.penetration, hitMult),
  };
}
