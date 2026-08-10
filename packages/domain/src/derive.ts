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
import { effectiveFarmPhase } from './farm-context';
import { starsMult, type SheetOtherPct, type SheetStats } from './gear';
import { SHEET_KEYS, type SheetKey } from './planner-constants';
import type { TeamBuffId } from './team-buffs';

export type CombatMults = {
  teamAtkMult: number;
  teamSpeedMult: number;
  teamDrainMult: number;
  teamGateMult: number;
  teamCritPctOfBase: number;
  attackMult: number;
  speedMult: number;
  gateAttackMult: number;
  energyMult: number;
  critDmgMult: number;
  /** Abisso's `abissoBase^currentPhase` factor — 1 when Abisso is not owned. Folds into `dmgMult`. */
  abissoMult: number;
  dmgMult: number;
};

/**
 * `treeEnergy` and `treeDanoTotal` are GONE (BSP-23c, DEC-01) — both now live on the sheet
 * only (`applySkillTree`), never in a combat multiplier. `treeGlassCannon` / `treeTempoDobrado`
 * are boolean account keystones sniffed off the save (not `skills.totals` percentage fields);
 * they are accepted here for call-site compatibility (`team-plan`, `advisor-pipeline.ts`,
 * `farm-context.ts`'s drain-rate use) but are no longer read by this function — Glass Cannon's
 * energy ×0.5 / crit-damage ×2 and Tempo Dobrado's speed ×1.33333 are all sheet-layer effects
 * now (`TreeSheetTotals.glassCannon` / `.tempoDobrado` / `.critDmgMult`, applied once in
 * `applySkillTree`). Applying them here too would double them.
 *
 * `treeAbisso` is DIFFERENT from the other two keystones above: unlike Glass Cannon / Tempo
 * Dobrado, Abisso's damage multiplier is NOT a sheet effect — two save exports of the same
 * account at different phases have byte-identical hero `stats` blocks, so whatever Abisso does
 * cannot live on the sheet. It multiplies pre-crit hit damage by `abissoBase^currentPhase`
 * (verified empirically: 1.008^phase reproduces observed hits within 0.04% across multiple
 * phases and heroes), fully reversible with the phase being farmed right now — this is the one
 * keystone genuinely modeled here, in `dmgMult`, gated on `treeAbisso` so an unowned account
 * (or a save with `abissoBase` absent/0) always gets an identity multiplier.
 */
export type ComputeCombatMultsInput = {
  mods: AbilityMods;
  teamBuffs: Record<TeamBuffId, number>;
  treeGlassCannon: boolean;
  treeTempoDobrado: boolean;
  /** Gates the Abisso damage multiplier below — no sheet effect (see the type doc above). */
  treeAbisso?: boolean;
  /** `skills.totals.abisso_base` from the save — 0 (identity) when Abisso is not owned. */
  treeAbissoBase?: number;
  /** The phase currently being farmed — Abisso's exponent. Clamped via `effectiveFarmPhase`. */
  phase?: number | null;
  extraDmgPct: number;
};

/**
 * Team ability % bonuses (Grito / Marcha / Contra o Relógio) stack **additively**
 * across the hero’s own copy and other fielded heroes, capped at +100%
 * (`combate.team_mult_bonus_cap`). Do not multiply own `abilityMods` × teamBuffs —
 * that overstates by the cross term (e.g. 1.2×1.2=1.44 vs correct 1.4).
 */
export const TEAM_MULT_BONUS_CAP = 1;

/** Combine own ability mult (e.g. 1.2) with other heroes’ team-buff % additively. */
export function stackTeamBonusMult(ownMult: number, otherHeroesBuffPct: number): number {
  const ownBonus = Math.max(0, ownMult - 1);
  const othersBonus = Math.max(0, otherHeroesBuffPct) / 100;
  return 1 + Math.min(TEAM_MULT_BONUS_CAP, ownBonus + othersBonus);
}

/**
 * Team / combat multipliers used by the advisor pipeline. The skill tree no longer
 * contributes anything here (BSP-23c) — `dmg_static` and `energia_add` are sheet-level
 * factors applied once by `applySkillTree`, not a second time on top of the combat sheet.
 *
 * Glass Cannon (C15) and Tempo Dobrado (V15) contribute nothing here as of the keystone
 * sheet-math correction: energy ×0.5, crit-damage ×2 (`crit_dmg_mult`), and speed ×1.33333 are
 * all sheet-layer factors now (`applySkillTree` via `TreeSheetTotals.glassCannon` /
 * `.tempoDobrado` / `.critDmgMult`), applied once when the sheet is composed. Applying them
 * again here — the previous design — double-counted them and, worse, scaled the WHOLE
 * running total (ability/tree/point contributions included) instead of only the birth base,
 * which is not what the game does (verified against real save exports). Abisso does NOT
 * suppress Glass Cannon's crit-damage ×2 either way.
 *
 * Abisso (D15) is the one keystone genuinely modeled here: `abissoMult = abissoBase^phase`,
 * folded into `dmgMult`. Unlike Glass Cannon/Tempo Dobrado it is not a sheet effect (two save
 * exports of the same account at different phases carry byte-identical hero `stats` blocks),
 * it scales pre-crit damage (not entangled with `critDmgMult`), and it is fully reversible —
 * it tracks whatever phase is passed in, not a snapshot from import time. Guarded on
 * `treeAbisso` so `treeAbissoBase` being `0` (accounts without the keystone) never zeroes
 * damage via `0 ** phase`.
 */
export function computeCombatMults(input: ComputeCombatMultsInput): CombatMults {
  const { mods, teamBuffs, extraDmgPct, treeAbisso = false, treeAbissoBase = 0, phase = null } = input;
  const teamAtkMult = stackTeamBonusMult(1, teamBuffs.grito_guerra || 0);
  const teamSpeedMult = stackTeamBonusMult(1, teamBuffs.marcha_acelerada || 0);
  const teamDrainMult = Math.max(0.01, 1 - (teamBuffs.folego_mineiro || 0) / 100);
  const teamGateMult = stackTeamBonusMult(1, teamBuffs.contra_relogio || 0);
  const teamCritPctOfBase = teamBuffs.pressagio_mortal || 0;
  const abissoMult = treeAbisso && treeAbissoBase > 0 ? treeAbissoBase ** effectiveFarmPhase(phase) : 1;
  return {
    teamAtkMult,
    teamSpeedMult,
    teamDrainMult,
    teamGateMult,
    teamCritPctOfBase,
    attackMult: stackTeamBonusMult(mods.attackMult, teamBuffs.grito_guerra || 0),
    speedMult: stackTeamBonusMult(mods.speedMult, teamBuffs.marcha_acelerada || 0),
    gateAttackMult: stackTeamBonusMult(mods.gateAttackMult, teamBuffs.contra_relogio || 0),
    energyMult: 1,
    critDmgMult: 1,
    abissoMult,
    // extraDmgPct (Math-check) stays a separate, independent factor from abissoMult — do not
    // fold Abisso into it (it is a manual knob the user drives, not a save-derived one).
    dmgMult: mods.dmgMult * (1 + extraDmgPct / 100) * abissoMult,
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
  teamCritPctOfBase: number;
  /** The whole skill tree, once (BSP-23c) — replaces the four scattered tree inputs. */
  treeSheet: TreeSheetTotals;
  combatCritChancePctOfBase: number;
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
 * upstream to produce `geared`/`naked`) — never again here (BSP-22, BSP-23c). Exactly one
 * tree factor genuinely belongs to a per-point delta rather than the sheet:
 * `treeSheet.danoStatic` scales `delta.attack` because the sheet the delta is added to is
 * already post-`dmg_static` (AD-BSP-12) and attack has no ratio-based analogue to cancel it.
 * `delta.energy` needs no explicit tree factor (BSPW5-11/DISC-01) — `gem = geared.energy /
 * naked.energy` already carries `energia_add` once `naked` is `nakedFromBirth`'s tree-free
 * output; an explicit `(1 + energyPct/100)` on top would double it. Glass Cannon's energy
 * ×0.5 rides along in the same ratio for free (`naked` is keystone-free too, `geared` carries
 * it via `applySkillTree`) — this is also why `energyMult` here must stay `1` for Glass
 * Cannon (`computeCombatMults` no longer sets it otherwise). Similarly, `naked.critDmg` /
 * `naked.speed` stay `critDmgMult`/Tempo-Dobrado-free by construction, so `delta.critDmg` /
 * `delta.speed` below are already the correct un-multiplied per-point gain — no change needed
 * for either correction.
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
    teamCritPctOfBase,
    treeSheet,
    combatCritChancePctOfBase,
    penetrationPp,
    context,
    dmgMult,
    mitigationPct,
  } = input;

  const gem = naked.energy > 0 ? gearedX.energy / naked.energy : 1;
  // Shared pool: +1 pt adds naked×perPt/(1+O), not naked×perPt.
  const oSpeed = 1 + sheetOther.speed;
  const oCrit = 1 + sheetOther.critChance;
  const oCritDmg = 1 + sheetOther.critDmg;
  const oPen = 1 + sheetOther.penetration;
  const oCdr = 1 + sheetOther.cdr;
  const star = starsMult(stars);
  const atkPt = attackPointGain(level) * star;
  // GAP-W4-01 (resolved, BSPW5-11/DISC-01): the six pooled shared-divisor deltas below
  // (speed/critChance/critDmg/penetration/cdr/luck) needed no Wave 5 change — dividing by
  // (1 + sheetOther[key]) only was already exact once `naked` became `nakedFromBirth`'s
  // tree-free output. Energy was the ONE exception the W4 comment got wrong: `gem =
  // gearedX.energy / naked.energy` already carries `(1 + energia_add)` once `naked` is
  // tree-free, so the explicit `(1 + treeSheet.energyPct / 100)` factor that was correct
  // when `naked` was still tree-contaminated (it cancelled inside `gem` then) became a
  // second application once Wave 5 shipped a genuinely tree-free `naked` — a 1.81x
  // overstatement of every energy point on `save-20260801-crit-dmg-tree.json`
  // (`energia_add = 0.812711865`). Removed below; AC-33 is the end-to-end proof.
  const delta: Record<SheetKey, number> = {
    // AD-BSP-12: the sheet the delta is added to already carries dmg_static once — scale
    // the per-point gain by it too, or attack points would under-count against the sheet.
    // `delta.attack` has no `gem` analogue (energy's own ratio-based factor), so this
    // explicit `danoStatic` factor is NOT redundant and stays exactly as-is.
    attack: atkPt * treeSheet.danoStatic,
    energy: POINT_GAIN.energyNative * gem * star,
    speed: (POINT_GAIN.speedPctOfBase * naked.speed) / oSpeed,
    critChance: (POINT_GAIN.critChancePctOfBase * naked.critChance) / oCrit,
    critDmg: (POINT_GAIN.critDmgPctOfBase * naked.critDmg) / oCritDmg,
    penetration: (POINT_GAIN.penetrationPctOfBase * naked.penetration) / oPen,
    cdr: (POINT_GAIN.cdrPctOfBase * naked.cdr) / oCdr,
    // Luck has no `other` term (ASM-02) — no divisor, unlike the shared-pool stats above.
    luck: POINT_GAIN.luckPctOfBase * naked.luck,
  };
  const adjusted: SheetStats = { ...gearedX };
  for (const key of SHEET_KEYS) adjusted[key] = gearedX[key] + pts[key] * delta[key];
  // Combat-only ability/team crit-chance additions (e.g. Presságio Mortal) use the rolled
  // base ≈ naked / (1+sheetO) — unrelated to the skill tree, which the sheet already carries.
  const baseCrit = naked.critChance / oCrit;
  const effective: HeroSheet = {
    rarity,
    attack: adjusted.attack * attackMult,
    energy: adjusted.energy * energyMult,
    speed: adjusted.speed * speedMult,
    critChance: adjusted.critChance + ((combatCritChancePctOfBase + teamCritPctOfBase) / 100) * baseCrit,
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
    // No combat multiplier — Luck never reaches DPS scoring (BSP-42, AD-BSP-20).
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
