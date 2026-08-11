/**
 * BSPW4-03 — recover the integer spent-point vector from a hero's sheet, inverting the
 * `AD-BSP-19` block. `BSP-04a`: every failure mode is a typed issue, never a throw, a
 * silent scale, or a redistributed residual.
 */
import { nakedFromBirth, type BirthStats, type TreeSheetTotals } from './birth-sheet';
import { attackPointGain } from './model/combat';
import { POINT_GAIN, STAT_CAPS } from './model/rarity-constants';
import { starsMult, sumGearBonuses } from './gear/catalog';
import type { Loadout, SheetOtherPct, SheetStats } from './gear/types';
import { SHEET_KEYS, type SheetKey } from './planner-constants';

/**
 * `DEC-04` — six orders of magnitude above the measured worst residual (8.9e-13) and six
 * orders below a half-point, so a real solved value never gets mistaken for non-integer.
 */
export const POINT_INFERENCE_EPS = 1e-6;

export type PointInferenceIssue =
  | { kind: 'nonIntegerPoints'; key: SheetKey; raw: number; residual: number }
  | { kind: 'negativePoints'; key: SheetKey; raw: number }
  | {
      kind: 'budgetMismatch';
      recovered: number;
      budget: number;
      difference: number;
      /** Cap-saturated stats, for Wave 5's BSP-04b copy. Empty when none. */
      saturatedStats: ('critChance' | 'cdr')[];
    };

export type PointInferenceResult = {
  pts: Record<SheetKey, number>;
  issues: PointInferenceIssue[];
};

export type InferSpentPointsInput = {
  birth: BirthStats;
  level: number;
  stars: number;
  sheetOther: SheetOtherPct;
  loadout: Loadout;
  tree: TreeSheetTotals;
  /** The observed, tree-inclusive sheet (post gear + points + tree) to solve `pts` from. */
  sheet: SheetStats;
  statPointsAvailable: number;
};

function poolFactor(percent: number): number {
  return 1 + Math.max(0, percent);
}

/** Cap-adjacency epsilon for `saturatedStats` — well above float noise, well below 1%. */
const CAP_EPS = 1e-6;

export function inferSpentPoints(input: InferSpentPointsInput): PointInferenceResult {
  const { birth, level, stars, sheetOther, loadout, tree, sheet, statPointsAvailable } = input;

  const naked = nakedFromBirth(birth, level, stars, sheetOther);
  const baseSpeed = naked.speed / poolFactor(sheetOther.speed);
  const baseCritChance = naked.critChance / poolFactor(sheetOther.critChance);
  const baseCritDmg = naked.critDmg / poolFactor(sheetOther.critDmg);
  const speedBaseMult = tree.tempoDobrado ? 1.33333 : 1;
  const energyGlassCannonFactor = tree.glassCannon ? 0.5 : 1;

  // Invert applySkillTree to recover the pre-tree (gear + points) pool subtotal. critDmgMult
  // and Tempo Dobrado's speed factor are additive replacements of the pool's implicit `1`
  // (correction 1/3) — subtract the same `base × (mult − 1)` term applySkillTree added.
  // Glass Cannon's energy ×0.5 (correction 2) is a whole-subtotal multiplier — divide it out
  // alongside `energia_add` before dividing by `gem` below.
  const pool = {
    attack: sheet.attack / tree.danoStatic,
    energy: sheet.energy / ((1 + tree.energyPct / 100) * energyGlassCannonFactor),
    speed: sheet.speed - baseSpeed * (speedBaseMult - 1) - baseSpeed * (tree.speedPct / 100),
    critChance: sheet.critChance - baseCritChance * (tree.critChancePct / 100),
    critDmg: sheet.critDmg - baseCritDmg * (tree.critDmgMult - 1) - baseCritDmg * (tree.critDmgPct / 100),
    penetration: sheet.penetration,
    cdr: sheet.cdr,
    luck: sheet.luck - tree.luckFlatPct,
  };

  const bonuses = sumGearBonuses(loadout);
  const gem = 1 + bonuses.energyPct;
  const star = starsMult(stars);
  const atkPt = attackPointGain(level) * star;

  // Invert sharedForward (gear/apply.ts) for the pooled % keys.
  const solveShared = (poolVal: number, nakedVal: number, gearPct: number, otherPct: number, rate: number): number => {
    if (Math.abs(nakedVal) < 1e-12) return 0;
    const other = Math.max(0, otherPct);
    const ptsPct = (poolVal * (1 + other)) / nakedVal - (1 + other) - gearPct;
    return ptsPct / rate;
  };

  const raw: Record<SheetKey, number> = {
    attack: (pool.attack - naked.attack - bonuses.dmgFlat) / atkPt,
    energy: (pool.energy / gem - naked.energy) / (POINT_GAIN.energyNative * star),
    speed: solveShared(pool.speed, naked.speed, bonuses.speedPct, sheetOther.speed, POINT_GAIN.speedPctOfBase),
    critChance: solveShared(
      pool.critChance,
      naked.critChance,
      bonuses.critPct,
      sheetOther.critChance,
      POINT_GAIN.critChancePctOfBase,
    ),
    critDmg: solveShared(pool.critDmg, naked.critDmg, 0, sheetOther.critDmg, POINT_GAIN.critDmgPctOfBase),
    penetration: solveShared(
      pool.penetration,
      naked.penetration,
      bonuses.penPct,
      sheetOther.penetration,
      POINT_GAIN.penetrationPctOfBase,
    ),
    cdr: solveShared(pool.cdr, naked.cdr, bonuses.cdrPct, sheetOther.cdr, POINT_GAIN.cdrPctOfBase),
    luck: solveShared(pool.luck, naked.luck, bonuses.luckPct, 0, POINT_GAIN.luckPctOfBase),
  };

  // A capped sheet value (critChance/cdr — BSPW4-09: NOT penetration, which the game never
  // clamps on the sheet) destroys the information needed to solve backward exactly once
  // ability+gear alone already reach the cap: `sheet.critChance`/`sheet.cdr` (hence `pool.*`
  // above) is the CLAMPED observed value, not the true (higher) uncapped pool subtotal, so
  // `solveShared` asks a spurious question ("how many points below the naked+gear-implied
  // total is the capped value") and goes sharply negative. Floor to 0 rather than raising a
  // spurious `negativePoints` issue for what is really cap saturation, not a data problem —
  // `saturatedStats` (below) is the existing channel for surfacing "this stat sits at its cap"
  // whenever the recovered budget doesn't reconcile.
  if (sheet.critChance >= STAT_CAPS.critChance - CAP_EPS && raw.critChance < 0) raw.critChance = 0;
  if (sheet.cdr >= STAT_CAPS.cdr - CAP_EPS && raw.cdr < 0) raw.cdr = 0;

  const issues: PointInferenceIssue[] = [];
  const pts = {} as Record<SheetKey, number>;
  for (const key of SHEET_KEYS) {
    const value = raw[key];
    const rounded = Math.round(value);
    const residual = Math.abs(value - rounded);
    if (residual > POINT_INFERENCE_EPS) {
      issues.push({ kind: 'nonIntegerPoints', key, raw: value, residual });
    }
    if (rounded < 0) {
      issues.push({ kind: 'negativePoints', key, raw: value });
      pts[key] = 0;
    } else {
      pts[key] = rounded;
    }
  }

  const recovered = SHEET_KEYS.reduce((sum, key) => sum + pts[key], 0);
  const budget = Math.max(0, level - statPointsAvailable);
  if (recovered !== budget) {
    const saturatedStats: ('critChance' | 'cdr')[] = [];
    if (sheet.critChance >= STAT_CAPS.critChance - CAP_EPS) saturatedStats.push('critChance');
    if (sheet.cdr >= STAT_CAPS.cdr - CAP_EPS) saturatedStats.push('cdr');
    issues.push({
      kind: 'budgetMismatch',
      recovered,
      budget,
      difference: recovered - budget,
      saturatedStats,
    });
  }

  return { pts, issues };
}
