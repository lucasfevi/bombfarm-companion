import {
  abilityMods,
  rankNextPoint,
  energySwitchPoint,
  mitigationFactor,
  critFactor,
  fieldSeconds,
  type AbilityMods,
  type Context,
  type HeroSheet,
  type PointValue,
  type RankMode,
  type RarityKey,
} from './model';
import { applyPoints, emptySheetOther, type Loadout, type SheetOtherPct, type SheetStats } from './gear';
import { spentPointsOf } from './point-inference';
import type { SheetKey } from './planner-constants';
import { computeCombatMults, derive, type DeriveResult } from './derive';
import { applySkillTree, type BirthStats, type TreeSheetTotals } from './birth-sheet';
import { resolveCloneGeared, resolveDeriveSheets } from './advisor-pipeline-sheets';
import {
  effectiveFarmPhase,
  effectiveMitigationPct,
  effectiveTargetProp,
  farmContextForHero,
} from './farm-context';
import { PROPS, BOSS_HP_MULT, phaseLine, propHp, hitsToKill, weightedAvgPropHp } from './phases';
import {
  propHtkRows,
  gateRows as buildGateRows,
  buildResetAdvice,
  type PropHtkRow,
  type GateRow,
  type ResetAdvice,
} from './advisor-tables';
import { findGateCandidate } from './points-reopt';
import type { TeamBuffId } from './team-buffs';

/** Increments each time the pipeline invokes `energySwitchPoint` (tests / DEBUG). */
// MOD-36: mutable by design — Vitest imports and reassigns/reads this counter directly
// (memoization-invariant assertions); a const/closure cell would break that test API.
export let energySwitchPointCallCount = 0;

export function resetEnergySwitchPointCallCount(): void {
  energySwitchPointCallCount = 0;
}

export type AdvisorPipelineInput = {
  naked: SheetStats;
  geared: SheetStats;
  loadout: Loadout;
  altLoadout: Loadout | null;
  pts: Record<SheetKey, number>;
  abilities: Record<string, number>;
  rarity: RarityKey;
  level: number;
  stars: number;
  treeDanoTotal: number;
  treeCritChance: number;
  treeCritDmg: number;
  treeSpeed: number;
  treeEnergy: number;
  /** `skills.totals.luck_add × 100` — flat Luck percentage points (BSPW5-03, ASM-01). */
  treeLuckFlatPct: number;
  teamBuffs: Record<TeamBuffId, number>;
  houseIdx: number;
  houseLevel: number;
  /**
   * `casa.cycle_secs` when the save carried it — the House's measured full-fill countdown.
   * Omitted/`null` falls back to the `HOUSES` interpolation, which is this pipeline's historical
   * behaviour and still the right answer for a hand-built account with no capture behind it.
   */
  houseCycleSecs?: number | null;
  /**
   * The (house, level) `houseCycleSecs` above was captured at — see
   * `FarmContextForHeroInput.cycleSecsHouseIdx`/`cycleSecsLevel` (`farm-context.ts`). Omitted,
   * `houseCycleSecs` is trusted unconditionally regardless of `houseIdx`/`houseLevel` (this
   * pipeline's historical behaviour). The web planner's account store supplies these so its House
   * picker actually changes DPS once it has moved off the account's own imported house/level.
   */
  houseCycleSecsHouseIdx?: number | null;
  houseCycleSecsLevel?: number | null;
  phase: number | null;
  mitigationPct: number;
  /**
   * The persisted UI setting (dps/farm). NOT read by this pipeline: farm-mode ranking needs
   * the whole rotation and this call computes one hero's advice, so the two cannot be the same
   * call — a farm ranker composes above this pipeline instead, in the web layer, from
   * already-extracted per-hero bases. Kept on this input so the type still names the setting
   * that gates which ranker the web layer calls.
   */
  rankMode: RankMode;
  targetProp: string | null;
  /**
   * When set, naked/geared for derive are recomposed from birth (tree-inclusive zero-pts
   * geared) so Points After / DPS stay aligned with Stats Total after level/stars/tree edits.
   */
  birth?: BirthStats | null;
};

export type AdvisorPipelineResult = {
  mods: AbilityMods;
  sheetOther: SheetOtherPct;
  rest: number;
  context: Context;
  gateAttackMult: number;
  dmgMult: number;
  /** Combat mults already computed by `computeCombatMults` — surfaced for breakdown (additive). */
  attackMult: number;
  energyMult: number;
  speedMult: number;
  critDmgMult: number;
  teamCritPctOfBase: number;
  /** The whole skill tree, once (BSP-23c) — surfaced for Wave 6's breakdown. */
  treeSheet: TreeSheetTotals;
  A: DeriveResult;
  B: DeriveResult | null;
  dps: number;
  active: number;
  predHit: number;
  pointDelta: Record<SheetKey, number>;
  adjusted: SheetStats;
  effective: HeroSheet;
  bDiff: number;
  bHitDiff: number;
  ranking: PointValue[];
  best: PointValue;
  eSwitch: number;
  spentDelta: number;
  /** Seconds on field per deployment — `uptime`'s numerator, surfaced for callers that print
   *  the deployment length rather than the duty-cycle ratio derived from it. */
  fieldSecs: number;
  uptime: number;
  mitF: number;
  predCrit: number;
  avgHit: number;
  expectedSheet: SheetStats;
  stoneHp: number;
  targetPropDefName: string;
  targetHp: number;
  propRows: PropHtkRow[];
  bossHp: number;
  bossHits: number;
  avgPropHp: number;
  gateRows: GateRow[];
  resetAdvice: ResetAdvice;
};

/**
 * Pure advisor math: derive A/B, expected sheet, point ranking, energy switch,
 * prop HTK table, and gate rows. Call from `useMemo` with primitive/stable deps only.
 */
export function computeAdvisorPipeline(input: AdvisorPipelineInput): AdvisorPipelineResult {
  const {
    naked,
    geared,
    loadout,
    altLoadout,
    pts,
    abilities,
    rarity,
    level,
    stars,
    treeDanoTotal,
    treeCritChance,
    treeCritDmg,
    treeSpeed,
    treeEnergy,
    treeLuckFlatPct,
    teamBuffs,
    houseIdx,
    houseLevel,
    houseCycleSecs,
    houseCycleSecsHouseIdx,
    houseCycleSecsLevel,
    phase,
    mitigationPct,
    // input.rankMode is intentionally not destructured — see its doc comment above.
    targetProp,
    birth,
  } = input;

  const farmPhase = effectiveFarmPhase(phase);
  const mitPct = effectiveMitigationPct({ phase, mitigationPct });
  const propName = effectiveTargetProp(targetProp);

  const mods = abilityMods(abilities);
  const sheetOther: SheetOtherPct = {
    ...emptySheetOther(),
    critChance: mods.sheetCritChancePctOfBase / 100,
    penetration: mods.sheetPenetrationRaw,
    critDmgFlat: mods.sheetCritDmgFlat,
  };

  const { treeSheet, nakedForDerive, gearedForDerive } = resolveDeriveSheets({
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
    birth,
  });

  const mults = computeCombatMults({
    mods,
    teamBuffs,
    extraDmgPct: 0,
  });
  const {
    attackMult,
    speedMult,
    gateAttackMult,
    energyMult,
    critDmgMult,
    teamCritPctOfBase,
    teamDrainMult,
    dmgMult,
  } = mults;

  const context = farmContextForHero({
    mods,
    teamDrainMult,
    houseIdx,
    houseLevel,
    mitigationPct: mitPct,
    phase,
    cycleSecs: houseCycleSecs,
    cycleSecsHouseIdx: houseCycleSecsHouseIdx,
    cycleSecsLevel: houseCycleSecsLevel,
  });
  const rest = context.restSeconds;

  const deriveArgs = {
    naked: nakedForDerive,
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
    penetrationPp: mods.penetrationPp,
    context,
    dmgMult,
    mitigationPct: mitPct,
  } as const;

  const equippedResult = derive({ ...deriveArgs, geared: gearedForDerive });
  const { delta: pointDelta, adjusted, effective } = equippedResult;
  const dps = equippedResult.dps;
  const active = equippedResult.active;
  const predHit = equippedResult.hit;
  // Birth-backed: recompose clone from birth (same path as Apply to current).
  // Without birth: project the observed sheet so typed drift stays a 0% delta
  // when clone === current.
  const cloneResult = altLoadout
    ? derive({
        ...deriveArgs,
        geared: resolveCloneGeared({
          birth,
          gearedForDerive,
          loadout,
          altLoadout,
          sheetOther,
          level,
          stars,
          treeSheet,
        }),
      })
    : null;
  const bDiff = cloneResult ? (cloneResult.dps / dps - 1) * 100 || 0 : 0;
  const bHitDiff = cloneResult ? (cloneResult.hit / predHit - 1) * 100 || 0 : 0;

  const line = phaseLine(farmPhase);
  const stoneHp = line?.hp ?? 0;
  const targetPropDef = PROPS.find((prop) => prop.name === propName) ?? PROPS[1];
  const targetHp = propHp(stoneHp, targetPropDef.hpMult);

  // The one-shot heuristic that used to read targetHp/dmgMult/mitPct here is gone —
  // rankNextPoint only scores sustained DPS now, unconditionally.
  const ranking = rankNextPoint(effective, context, {
    effectiveDeltas: equippedResult.effectiveDelta,
  });

  // DEBUG: name/toast/guide/roster edits must not bump this when deps are stable.
  energySwitchPointCallCount += 1;
  const eSwitch = energySwitchPoint(effective, context);
  const best = ranking[0];
  const spentDelta = spentPointsOf(pts);
  const field = fieldSeconds(effective, context);
  const uptime = (100 * field) / (field + rest);

  const mitF = mitigationFactor(mitPct / 100, effective.penetration);
  const predCrit = predHit * (1 + effective.critDmg / 100);
  const avgHit = predHit * critFactor(effective.critChance, effective.critDmg);
  // The tree must apply here too, exactly once (BSP-23c) — `adjusted`/`geared` are already
  // tree-inclusive (AD-BSP-12), and AC-33/AC-34 now scale `delta.attack`/`delta.energy` by
  // the same tree factors. Without this, `expectedSheet` (the pure gear+points catalog
  // projection used by the Gear tab's sheet-mismatch check) would silently diverge from
  // `adjusted` by exactly the tree's factor for every hero with any spent attack/energy
  // point, false-triggering a "sheet mismatch" warning that has nothing to do with gear.
  const expectedSheet = applySkillTree(
    applyPoints(nakedForDerive, loadout, pts, sheetOther, level, stars),
    nakedForDerive,
    sheetOther,
    treeSheet,
  );

  const propRows: PropHtkRow[] = propHtkRows(stoneHp, avgHit, targetProp);
  const bossHp = propHp(stoneHp, BOSS_HP_MULT);
  const bossHits = hitsToKill(avgHit, bossHp);
  const avgPropHp = weightedAvgPropHp(stoneHp);

  const gateRows: GateRow[] = buildGateRows(effective, context, field, dmgMult, gateAttackMult);

  // AC-64l/AC-69/AC-70: Tier 1 only, reusing this call's own effective/effectiveDelta (no
  // extra derive pass); always scored sustainedDps — findGateCandidate has no rankMode input
  // for a caller to set, so this is unaffected by the UI's rankMode regardless.
  const gate = findGateCandidate({
    pts,
    effective,
    effectiveDelta: equippedResult.effectiveDelta,
    context,
    level,
  });
  const resetAdvice = buildResetAdvice(gate);

  return {
    mods,
    sheetOther,
    rest,
    context,
    gateAttackMult,
    dmgMult,
    attackMult,
    energyMult,
    speedMult,
    critDmgMult,
    teamCritPctOfBase,
    treeSheet,
    A: equippedResult,
    B: cloneResult,
    dps,
    active,
    predHit,
    pointDelta,
    adjusted,
    effective,
    bDiff,
    bHitDiff,
    ranking,
    best,
    eSwitch,
    spentDelta,
    fieldSecs: field,
    uptime,
    mitF,
    predCrit,
    avgHit,
    expectedSheet,
    stoneHp,
    targetPropDefName: targetPropDef.name,
    targetHp,
    propRows,
    bossHp,
    bossHits,
    avgPropHp,
    gateRows,
    resetAdvice,
  };
}
