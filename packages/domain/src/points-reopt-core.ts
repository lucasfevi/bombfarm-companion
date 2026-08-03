/**
 * BSPW4-10 — primitives shared by both tiers: the affine scorer, the DPS-key set, and the
 * bounded greedy walk (`AD-BSP-08`'s algorithm, reused as Tier 2's `S2`/`S5` seed generator).
 * Split out so `points-reopt.ts` (Tier 1 + orchestration) and `points-reopt-search.ts`
 * (Tier 2 internals) can both depend on it without a cycle between them.
 */
import { rankNextPoint, STAT_CAPS, type Context, type EffectiveDeltas, type HeroSheet } from './model';
import type { SheetKey } from './planner-constants';

/**
 * `AD-BSP-21` — Luck is excluded from the reallocatable budget and from both sides of the
 * search: it is not part of `HeroSheet`/`StatKey` at all (`AD-BSP-20`), so a search built on
 * `HeroSheet` structurally cannot touch it. The seven literal keys below are `SHEET_KEYS` minus
 * `luck` — matches `points-rank.ts`'s hand-written `stats` array as a SET (`AC-72`'s own test
 * asserts the set equality against a `SHEET_KEYS.filter` at runtime, in a test file, where
 * there is no risk of the cycle below).
 *
 * Deliberately NOT computed as `SHEET_KEYS.filter(...)` at module load time: `planner-constants
 * .ts` imports `BASE_ROLLS`/`RarityKey` from this barrel (`@/shared/domain/model`), and this
 * module is re-exported from that same barrel — a top-level `SHEET_KEYS.filter` here can
 * observe `SHEET_KEYS` as `undefined` depending on which module a test happens to import
 * first, because the two modules import each other. Every other consumer of `SHEET_KEYS` in
 * this wave's new modules only reads it inside a function body (deferred past module-init
 * time), which is safe; this is the one place a bare top-level array literal is required.
 */
export const REOPT_KEYS: readonly Exclude<SheetKey, 'luck'>[] = [
  'attack',
  'energy',
  'speed',
  'critChance',
  'critDmg',
  'penetration',
  'cdr',
];

/** `AD-BSP-08` verbatim: bounded, automatic, drives the `HeroStrip` warn badge. */
export const REOPT_GATE_MAX_EVALUATIONS = 1024;

/**
 * Reconstruct the affine combat sheet for a candidate point vector from the pipeline's
 * already-computed `effective` sheet and per-point `effectiveDelta` (`AC-64j`/`AC-64k`):
 * `sheet[key] = effective[key] + (candidatePts[key] - basePts[key]) x effectiveDelta[key]`.
 * `effectiveDelta` is independent of `pts` (derived from `naked`/`sheetOther`/`level`/`stars`/
 * `gem` only), which is what makes this affine reconstruction exact rather than approximate.
 * Caps are NOT applied here: `sustainedDps`'s own `critFactor`/`mitigationFactor`/`fuseSeconds`
 * already clamp crit chance / penetration / cdr internally, so a candidate that over-allocates
 * past a cap simply scores its excess at zero (`AC-61b`, `BSPW4-09`'s finding).
 */
export function buildCandidateSheet(
  effective: HeroSheet,
  basePts: Record<SheetKey, number>,
  effectiveDelta: EffectiveDeltas,
  candidatePts: Record<SheetKey, number>,
): HeroSheet {
  const sheet: HeroSheet = { ...effective };
  for (const key of REOPT_KEYS) {
    sheet[key] = effective[key] + (candidatePts[key] - basePts[key]) * effectiveDelta[key];
  }
  return sheet;
}

export function cappedStatsOf(sheet: HeroSheet): ('critChance' | 'cdr')[] {
  const out: ('critChance' | 'cdr')[] = [];
  if (sheet.critChance >= STAT_CAPS.critChance - 1e-9) out.push('critChance');
  if (sheet.cdr >= STAT_CAPS.cdr - 1e-9) out.push('cdr');
  return out;
}

export function budgetOf(pts: Record<SheetKey, number>): number {
  return REOPT_KEYS.reduce((sum, key) => sum + pts[key], 0);
}

export type GreedyWalkResult = {
  pts: Record<SheetKey, number>;
  score: number;
  unallocated: number;
  evaluations: number;
  budgetExhausted: boolean;
};

/**
 * `AD-BSP-08` verbatim: repeated best `rankNextPoint`, always scored `mode: 'dps'` regardless
 * of any caller rankMode (`AC-70`) — this module never exposes a rankMode parameter, so there
 * is nothing for a caller to set incorrectly. `startScore` seeds the exact incremental product
 * chain (`dpsGainPct` is defined as `(sustainedDps(next)/sustainedDps(current) - 1) x 100`, so
 * chaining it through accepted steps reproduces the true final DPS with no extra scoring call).
 */
export function greedyWalk(
  startPts: Record<SheetKey, number>,
  startScore: number,
  budget: number,
  effective: HeroSheet,
  basePts: Record<SheetKey, number>,
  effectiveDelta: EffectiveDeltas,
  context: Context,
  evaluationBudget: number,
): GreedyWalkResult {
  let current = { ...startPts };
  let score = startScore;
  let evaluations = 0;
  let remaining = budget;
  let budgetExhausted = false;
  const STEP_COST = 10; // AC-57d: 1 baseline + 7 candidates + 2 CDR marginal-fuse calls.

  while (remaining > 0) {
    if (evaluations + STEP_COST > evaluationBudget) {
      budgetExhausted = true;
      break;
    }
    const sheet = buildCandidateSheet(effective, basePts, effectiveDelta, current);
    const ranking = rankNextPoint(sheet, context, { effectiveDeltas: effectiveDelta, mode: 'dps' });
    evaluations += STEP_COST;
    const best = ranking[0];
    if (!best || best.dpsGainPct <= 0) break; // AC-51/AC-52: never spend into a zero-gain stat.
    score *= 1 + best.dpsGainPct / 100;
    current = { ...current, [best.stat]: current[best.stat] + 1 };
    remaining -= 1;
  }

  return { pts: current, score, unallocated: remaining, evaluations, budgetExhausted };
}
