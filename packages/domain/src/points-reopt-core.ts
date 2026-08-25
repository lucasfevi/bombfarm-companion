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

/**
 * Tier 2's budget over `REOPT_KEYS`: `max(level - pts.luck, budgetOf(pts))`.
 *
 * Tier 2 only. Tier 1 budgets on `budgetOf(pts)` alone, because it answers "is a reset worth
 * buying" rather than "what is the best build" — see `findGateCandidate`.
 *
 * Two lower bounds, and the search gets the larger:
 *
 * - **The level pool.** A hero's total is its level — `clampPointStep`'s ceiling for the manual
 *   steppers and the denominator of the Points panel's `spent / level` counter — and Luck is
 *   outside the search's reach (`AD-BSP-21`), so the seven DPS keys may hold at most
 *   `level - pts.luck` between them. This term does not depend on how `pts` currently splits,
 *   which is what makes re-optimizing the same hero a fixed point.
 * - **What is already placed.** An over-spent hero (the one reachable overspend, per
 *   `clampPointStep`: lowering a level while points are spent) really does hold those points and
 *   really can reallocate them in game. Without this floor, `level - pts.luck` could fall below
 *   `budgetOf(pts)` — or to 0 outright once Luck alone covers the level — and the search would
 *   refuse to touch points the player demonstrably has.
 *
 * NOT `budgetOf(pts) + statPointsAvailable`, which is what this used to be. A save's banked
 * count is a snapshot of `level - spent` taken at import; it goes stale the instant the planner
 * reallocates, so adding it to a `pts` that already absorbed those points counts them twice.
 * Every Optimize -> Apply round then handed the search another full banked allowance
 * (46 -> 92 -> 138 -> ...), walking the hero straight past its level cap while the manual +/-
 * steppers, which have always clamped to `level`, refused the very same spend.
 *
 * The `budgetOf(pts)` floor cannot bring that compounding back: the search never places more
 * than the budget it was given, so feeding a result back yields `budgetOf(pts) <= previous
 * budget` and the sequence is non-increasing, settling immediately rather than growing.
 *
 * **CLAMPED to `level`, no matter what** (reversed from the earlier "not clamped, deliberately"
 * stance reviewed at the flat-crit-damage fix). The floor above is still real — an over-spent
 * hero really does hold those points — but leaving the result un-clamped let a single bad
 * `pts` (from `inferSpentPoints` or anywhere else upstream) turn into a proposal the hero cannot
 * actually hold, and the advisor cannot tell the difference between "this budget is real" and
 * "this budget is a bug" once it has a number in hand. Concretely, on a level-69 hero the
 * un-clamped floor produced a 210-point respec budget; the advisor sold a +18.9% gold/hr
 * proposal for 429,000 gold, of which the achievable gain was 0% — 101% of the advertised gain
 * was phantom, because the search had ~3× the points the hero can ever hold. Clamping here does
 * not remove the need to fix an upstream bug that overshoots `level` —
 * `tests/points-within-level-budget.test.ts` still asserts `Σ pts ≤ level` over every committed
 * capture and is still the guard that should go red first if `inferSpentPoints` regresses — but
 * it does mean this function can no longer amplify that bug into a proposal, which is worth more
 * than the theoretical case for staying unclamped.
 */
export function reoptBudget(pts: Record<SheetKey, number>, level: number): number {
  return Math.max(0, Math.min(level, Math.max(level - pts.luck, budgetOf(pts))));
}

/**
 * Tier 1's budget: `budgetOf(pts)`, under the same level ceiling Tier 2 carries.
 *
 * The floor is deliberately absent — a reset only redistributes points that are already spent,
 * so unplaced pool is not this tier's budget (see `findGateCandidate`). The ceiling is the same
 * `level` Tier 2 already carries, and for the same reason: a hero is granted exactly one point
 * per level, so a budget above its level is an upstream `pts` bug and never a real hero.
 *
 * `level`, not the tighter `level - pts.luck` the seven non-Luck keys can actually hold: an
 * over-spent hero (`clampPointStep`'s one reachable overspend — a level lowered while points are
 * spent) can hold Luck alone worth its whole level, and the tighter bound would drop such a hero
 * to a 0 budget and the `budget <= 0` fast path, refusing to reallocate points it demonstrably
 * has. The looser ceiling still satisfies the display rule in full.
 *
 * The point-reset panel prints this number as points the player would have to re-place. Showing
 * more of them than the hero's level advertises a build the game will not let anyone buy — a
 * level-97 hero was offered 98, one crit-damage point of it phantom, because the skill tree's
 * `crit_dmg_add` was being charged percent-of-base and the unexplained residual landed in
 * `critDmg`. That specific bug is fixed (`applySkillTree`), and
 * `tests/points-within-level-budget.test.ts` is still the guard that should go red first if
 * inference regresses again; this ceiling only stops the next one reaching the panel.
 */
export function resetBudget(pts: Record<SheetKey, number>, level: number): number {
  return Math.max(0, Math.min(budgetOf(pts), level));
}

/**
 * `pts` with its reallocatable spend brought down to `budget`, shedding from the LAST
 * {@link REOPT_KEYS} first. Luck is untouched — it is outside the reallocatable budget
 * (`AD-BSP-21`).
 *
 * WHY THIS EXISTS. A search seeded from a hero's CURRENT build inherits that build's total, and
 * every move the local search makes is a transfer, so the total never changes again. Seeds built
 * from the budget are therefore safe by construction and the current-build seed is not: a hero
 * spending more than {@link reoptBudget} allows carries the excess all the way into the proposal,
 * and the advisor recommends a build the game will not sell. That went unnoticed because a
 * budget-built seed happened to win; a change to the objective moved the winner and it surfaced.
 *
 * The state is UNREACHABLE in real play — the game grants one point per level and a level never
 * goes down, owner-confirmed, and the 13-hero 2026-08-23 capture spends exactly its level on all
 * thirteen. So this is a guard against malformed input, not a rule with gameplay meaning, and the
 * shed ORDER only has to be deterministic rather than clever: no real roster reaches it, and a
 * roster that does is already describing a hero that cannot exist.
 */
export function clampPtsToBudget(
  pts: Record<SheetKey, number>,
  budget: number,
): Record<SheetKey, number> {
  let excess = budgetOf(pts) - Math.max(0, budget);
  if (excess <= 0) return pts;
  const out = { ...pts };
  for (let index = REOPT_KEYS.length - 1; index >= 0 && excess > 0; index--) {
    const key = REOPT_KEYS[index];
    const shed = Math.min(out[key], excess);
    out[key] -= shed;
    excess -= shed;
  }
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
 * `AD-BSP-08` verbatim: repeated best `rankNextPoint`. `rankNextPoint` itself has no mode
 * parameter any more — it always scores sustained DPS (`AC-70`) — so this module never exposes
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
  const STEP_COST = 10; // AC-57d: 1 baseline + 7 candidates + 2 CDR marginal-fuse calls.

  while (remaining > 0) {
    if (evaluations + STEP_COST > evaluationBudget) {
      budgetExhausted = true;
      break;
    }
    const sheet = buildCandidateSheet(effective, basePts, effectiveDelta, current);
    const ranking = rankNextPoint(sheet, context, { effectiveDeltas: effectiveDelta });
    evaluations += STEP_COST;
    const best = ranking[0];
    if (!best || best.gainPct <= 0) break; // AC-51/AC-52: never spend into a zero-gain stat.
    score *= 1 + best.gainPct / 100;
    current = { ...current, [best.stat]: current[best.stat] + 1 };
    remaining -= 1;
  }

  return { pts: current, score, unallocated: remaining, evaluations, budgetExhausted };
}
