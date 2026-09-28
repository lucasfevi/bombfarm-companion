/**
 * Primitives shared by both tiers: the affine scorer, the DPS-key set, and the
 * bounded greedy walk (repeated-best-rankNextPoint algorithm, reused as Tier 2's `S2`/`S5` seed generator).
 * Split out so `points-reopt.ts` (Tier 1 + orchestration) and `points-reopt-search.ts`
 * (Tier 2 internals) can both depend on it without a cycle between them.
 */
import { rankNextPoint, STAT_CAPS, type Context, type EffectiveDeltas, type HeroSheet } from './model';
import type { SheetKey } from './planner-constants';

/**
 * The seven keys a combat sheet reads — `SHEET_KEYS` minus `luck`, which has no `HeroSheet`
 * field and so never moves DPS. These are the keys the affine reconstruction writes and the only
 * keys a DPS-scored search ever spends INTO; Luck is still refunded by a reset and may be spent
 * OUT of (see {@link RESPEC_KEYS}). Matches `points-rank.ts`'s hand-written `stats` array as a
 * SET (a test asserts the set equality against a `SHEET_KEYS.filter` at runtime).
 *
 * Deliberately NOT computed as `SHEET_KEYS.filter(...)` at module load time: `planner-constants
 * .ts` imports `BASE_ROLLS`/`RarityKey` from this barrel (`@/shared/domain/model`), and this
 * module is re-exported from that same barrel — a top-level `SHEET_KEYS.filter` here can
 * observe `SHEET_KEYS` as `undefined` depending on which module a test happens to import
 * first, because the two modules import each other. The same holds for {@link RESPEC_KEYS}.
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

/**
 * Every key a stat reset refunds and a respec may place — all eight, Luck included. A reset in
 * game buys back Luck with everything else, so a search that left it out held those points
 * hostage: a hero with 20 points in Luck was offered the best build of its other points, never
 * the build a reset actually buys.
 */
export const RESPEC_KEYS: readonly SheetKey[] = [...REOPT_KEYS, 'luck'];

/** Verbatim: bounded, automatic, drives the `HeroStrip` warn badge. */
export const REOPT_GATE_MAX_EVALUATIONS = 1024;

/**
 * Reconstruct the affine combat sheet for a candidate point vector from the pipeline's
 * already-computed `effective` sheet and per-point `effectiveDelta`:
 * `sheet[key] = effective[key] + (candidatePts[key] - basePts[key]) x effectiveDelta[key]`.
 * `effectiveDelta` is independent of `pts` (derived from `naked`/`sheetOther`/`level`/`stars`/
 * `gem` only), which is what makes this affine reconstruction exact rather than approximate.
 * Caps are NOT applied here: `sustainedDps`'s own `critFactor`/`mitigationFactor`/`fuseSeconds`
 * already clamp crit chance / penetration / cdr internally, so a candidate that over-allocates
 * past a cap simply scores its excess at zero.
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

/** Every point the vector holds, Luck included — what a reset would refund. */
export function budgetOf(pts: Record<SheetKey, number>): number {
  return RESPEC_KEYS.reduce((sum, key) => sum + pts[key], 0);
}

/**
 * Tier 2's budget: the hero's whole pool, `level`.
 *
 * Tier 2 only. Tier 1 budgets on what is already placed, because it answers "is a reset worth
 * buying" rather than "what is the best build" — see {@link resetBudget}.
 *
 * A hero is granted exactly one point per level, and every one of them — Luck's too — is back in
 * the pool after a reset. It does not depend on how `pts` currently splits, which is what makes
 * re-optimizing the same hero a fixed point.
 *
 * NOT `budgetOf(pts) + statPointsAvailable`, which is what this once was. A save's banked count
 * is a snapshot of `level - spent` taken at import; it goes stale the instant the planner
 * reallocates, so adding it to a `pts` that already absorbed those points counts them twice.
 * Every Optimize -> Apply round then handed the search another full banked allowance
 * (46 -> 92 -> 138 -> ...), walking the hero straight past its level cap.
 *
 * Never above `level`, even for a hero whose `pts` claim more: a budget above the level is an
 * upstream `pts` bug, never a real hero. On a level-69 hero an unclamped budget of 210 once sold
 * a +18.9% gold/hr proposal for 429,000 gold whose achievable gain was 0% — every point of it
 * phantom. `tests/points-within-level-budget.test.ts` asserts `Σ pts ≤ level` over every
 * committed capture and is the guard that should go red first if inference regresses.
 */
export function reoptBudget(level: number): number {
  return Math.max(0, level);
}

/**
 * Tier 1's budget: every point already placed, Luck included, under the same `level` ceiling
 * Tier 2 carries.
 *
 * A reset only redistributes points that are already spent, so unplaced pool is not this tier's
 * budget (see `findGateCandidate`) — but everything spent is, because the game refunds all eight
 * keys at once.
 *
 * The point-reset panel prints this number as points the player would have to re-place. Showing
 * more of them than the hero's level advertises a build the game will not let anyone buy — a
 * level-97 hero was once offered 98, one crit-damage point of it phantom.
 */
export function resetBudget(pts: Record<SheetKey, number>, level: number): number {
  return Math.max(0, Math.min(budgetOf(pts), level));
}

/**
 * `pts` with its spend brought down to `budget`, shedding from the LAST {@link RESPEC_KEYS}
 * first.
 *
 * WHY THIS EXISTS. A search seeded from a hero's CURRENT build inherits that build's total, and
 * every move the local search makes is a transfer, so the total never changes again. Seeds built
 * from the budget are therefore safe by construction and the current-build seed is not: a hero
 * spending more than {@link reoptBudget} allows carries the excess all the way into the proposal,
 * and the advisor recommends a build the game will not sell.
 *
 * The state is UNREACHABLE in real play — the game grants one point per level and a level never
 * goes down, owner-confirmed. So this is a guard against malformed input, not a rule with
 * gameplay meaning, and the shed ORDER only has to be deterministic rather than clever.
 */
export function clampPtsToBudget(
  pts: Record<SheetKey, number>,
  budget: number,
): Record<SheetKey, number> {
  let excess = budgetOf(pts) - Math.max(0, budget);
  if (excess <= 0) return pts;
  const out = { ...pts };
  for (let index = RESPEC_KEYS.length - 1; index >= 0 && excess > 0; index--) {
    const key = RESPEC_KEYS[index];
    const shed = Math.min(out[key], excess);
    out[key] -= shed;
    excess -= shed;
  }
  return out;
}

/** `pts` with every refundable key at zero — the empty build a reset starts from. */
export function zeroedRespecKeys(pts: Record<SheetKey, number>): Record<SheetKey, number> {
  const out = { ...pts };
  for (const key of RESPEC_KEYS) out[key] = 0;
  return out;
}

export type GreedyWalkResult = {
  pts: Record<SheetKey, number>;
  score: number;
  unallocated: number;
  evaluations: number;
  budgetExhausted: boolean;
};

/**
 * Verbatim: repeated best `rankNextPoint`. `rankNextPoint` itself has no mode
 * parameter any more — it always scores sustained DPS — so this module never exposes
 * a rankMode parameter either, and there is nothing for a caller to set incorrectly.
 * `startScore` seeds the exact incremental product chain (`gainPct` is defined as
 * `(sustainedDps(next)/sustainedDps(current) - 1) x 100`, so chaining it through accepted steps
 * reproduces the true final DPS with no extra scoring call).
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
  const STEP_COST = 10; // 1 baseline + 7 candidates + 2 CDR marginal-fuse calls.

  while (remaining > 0) {
    if (evaluations + STEP_COST > evaluationBudget) {
      budgetExhausted = true;
      break;
    }
    const sheet = buildCandidateSheet(effective, basePts, effectiveDelta, current);
    const ranking = rankNextPoint(sheet, context, { effectiveDeltas: effectiveDelta });
    evaluations += STEP_COST;
    const best = ranking[0];
    if (!best || best.gainPct <= 0) break; // never spend into a zero-gain stat.
    score *= 1 + best.gainPct / 100;
    current = { ...current, [best.stat]: current[best.stat] + 1 };
    remaining -= 1;
  }

  return { pts: current, score, unallocated: remaining, evaluations, budgetExhausted };
}
