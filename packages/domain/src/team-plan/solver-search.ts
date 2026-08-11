import type { InventoryItem } from '../inventory';
import { SLOTS } from '../gear/catalog';
import { findGateCandidate, optimizeBuild } from '../points-reopt';
import { evaluateRoster } from './evaluate';
import {
  applyMove,
  cloneAssignment,
  loadoutsFromAssignment,
  type AssignmentState,
  type GearMove,
} from './solver-assignment';
import { generateMoves } from './solver-moves';
import type {
  EvaluateRosterInput,
  FarmContext,
  TeamPlanInput,
  HeroPlanContext,
  RosterEvaluation,
} from './types';

export const TEAM_PLAN_MAX_EVALUATIONS = 500_000;
// Counts gear<->points alternations, not moves, now that gearPass climbs to local optimality
// (Change 2a) — the convergence break below normally exits well before this cap.
export const MAX_ROUNDS = 30;
// The old 1e-4 was ~148,000 DPS on a 1.48B roster — larger than the steps it was meant to
// arbitrate, so it broke the round loop long before the search actually converged.
export const IMPROVEMENT_EPSILON = 1e-7;
export const TEAM_PLAN_WORKER_MARKER = 'runTeamPlan';

const EPS = 1e-9;

/**
 * Hard ceiling on memoised evaluations. WITHOUT this the cache is bounded only by
 * `TEAM_PLAN_MAX_EVALUATIONS`, i.e. 500,000 entries — measured at ~7.1 KB of key per entry on
 * a real 403-item save (plus a whole `RosterEvaluation` per value, which carries a `HeroScore`
 * with `HeroSheet` / `adjusted` / `effectiveDelta` / `Context` for every hero). That reached
 * multiple GB and killed the browser tab outright. Memory must never scale with the evaluation
 * budget; past the cap the search simply stops memoising and keeps running correctly.
 *
 * Sized from measurement, not intuition: a cached entry costs ~19 KB on a 15-hero roster --
 * the key is small after the split below, but each value is a whole `RosterEvaluation` holding
 * a `HeroScore` per hero. At 25,000 that was still 477 MB, which is not a number a browser tab
 * should ever reach while also holding the app.
 */
export const TEAM_PLAN_MAX_CACHE_ENTRIES = 5_000;

export type SolverBudget = {
  maxEvaluations: number;
  evaluations: number;
  exhausted: boolean;
  /**
   * Two-level so the invariant part of the key is stored ONCE rather than re-serialised into
   * every entry: outer key is `pts + forgeFloor` (constant for a whole search — `runSeedSearch`
   * is handed one `ptsByHeroId` and never varies it), inner key is the slot assignment, which
   * is the only part that actually discriminates. On the save above that is 142 chars per entry
   * against 3,614 for the old flat key.
   */
  cache?: Map<string, Map<string, RosterEvaluation>>;
  /** Total entries across every sub-map, so the cap is global rather than per-pts. */
  cacheEntries?: number;
  /**
   * Overrides {@link TEAM_PLAN_MAX_CACHE_ENTRIES}. Symmetric with `maxEvaluations`: the host
   * decides what it can afford. A browser tab holding the whole app wants the default; a Node
   * or Electron host with a real heap could raise it and trade memory for speed.
   */
  maxCacheEntries?: number;
};

/**
 * The slot assignment — the only discriminating part of the state.
 *
 * `assignment.pool` is deliberately NOT included: the spare pool is exactly the run's fixed
 * item universe minus whatever is equipped, so two assignments with identical slots always
 * have identical pools. Serialising it added 47-68% to every cached key and discriminated
 * nothing.
 */
function slotCacheKey(assignment: AssignmentState): string {
  return Object.entries(assignment.slots)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([heroId, slots]) => `${heroId}:${SLOTS.map((s) => slots[s] ?? '').join(',')}`)
    .join('|');
}

/** The part that is invariant across a search; stored once as the outer cache key. */
function invariantCacheKey(
  ptsByHeroId: Record<string, import('../gear/types').PointAlloc>,
  forgeFloor: number,
): string {
  const ptsPart = Object.entries(ptsByHeroId)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, pts]) => `${id}:${JSON.stringify(pts)}`)
    .join('|');
  return `${ptsPart}#${forgeFloor}`;
}

function farmFromAccount(input: TeamPlanInput): FarmContext {
  return {
    houseIdx: input.account.houseIdx,
    houseLevel: input.account.houseLevel,
    phase: input.account.phase,
    mitigationPct: input.account.mitigationPct,
    treeGlassCannon: input.account.treeGlassCannon,
    treeTempoDobrado: input.account.treeTempoDobrado,
    treeAbisso: input.account.treeAbisso,
    treeAbissoBase: input.account.treeAbissoBase,
  };
}

export function evaluateAssignment(
  assignment: AssignmentState,
  contexts: HeroPlanContext[],
  ptsByHeroId: Record<string, import('../gear/types').PointAlloc>,
  input: TeamPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  budget: SolverBudget,
): RosterEvaluation {
  const invariantKey = invariantCacheKey(ptsByHeroId, input.forgeFloor);
  const slotKey = slotCacheKey(assignment);
  const bucket = budget.cache?.get(invariantKey);
  const cached = bucket?.get(slotKey);
  if (cached) return cached;

  budget.evaluations += 1;
  if (budget.evaluations >= budget.maxEvaluations) budget.exhausted = true;
  const loadouts = loadoutsFromAssignment(assignment, itemById);
  const evalInput: EvaluateRosterInput = {
    contexts,
    loadoutsByHeroId: loadouts,
    ptsByHeroId,
    slots: input.account.slots,
    farm: farmFromAccount(input),
    forgeFloor: input.forgeFloor,
  };
  const result = evaluateRoster(evalInput);
  // Stop memoising once the cap is reached rather than evicting: the search keeps running and
  // stays correct, it just recomputes. Correctness never depends on a cache hit.
  const cacheCap = budget.maxCacheEntries ?? TEAM_PLAN_MAX_CACHE_ENTRIES;
  if (budget.cache && (budget.cacheEntries ?? 0) < cacheCap) {
    let target = bucket;
    if (!target) {
      target = new Map<string, RosterEvaluation>();
      budget.cache.set(invariantKey, target);
    }
    target.set(slotKey, result);
    budget.cacheEntries = (budget.cacheEntries ?? 0) + 1;
  }
  return result;
}

function heroDpsMap(evaluation: RosterEvaluation): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [heroId, score] of Object.entries(evaluation.perHero)) {
    out[heroId] = score.sustained;
  }
  return out;
}

/**
 * Climbs to local optimality: applies the single best move, then regenerates the move list
 * (both `assignment.slots` and `assignment.pool` changed, so a stale list is wrong) and repeats
 * until no improving move exists or the budget runs out. Best-improvement semantics and the
 * deterministic move ordering from `generateMoves` are preserved at every iteration.
 */
function gearPass(
  assignment: AssignmentState,
  contexts: HeroPlanContext[],
  ptsByHeroId: Record<string, import('../gear/types').PointAlloc>,
  input: TeamPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  budget: SolverBudget,
  startEval: RosterEvaluation,
): { assignment: AssignmentState; evaluation: RosterEvaluation } {
  let currentAssignment = assignment;
  let currentEval = startEval;

  for (;;) {
    if (budget.exhausted) break;
    const moves = generateMoves({
      contexts,
      slots: currentAssignment.slots,
      pool: currentAssignment.pool,
      itemById,
      heroDpsById: heroDpsMap(currentEval),
      forgeFloor: input.forgeFloor,
    });

    let bestMove: GearMove | null = null;
    let bestAssignment = currentAssignment;
    let bestEval = currentEval;

    for (const move of moves) {
      if (budget.exhausted) break;
      const candidateAssignment = applyMove(currentAssignment, move);
      const candidateEval = evaluateAssignment(
        candidateAssignment,
        contexts,
        ptsByHeroId,
        input,
        itemById,
        budget,
      );
      if (candidateEval.objective > bestEval.objective + EPS) {
        bestEval = candidateEval;
        bestMove = move;
        bestAssignment = candidateAssignment;
      }
    }

    if (!bestMove) break;
    currentAssignment = bestAssignment;
    currentEval = bestEval;
  }

  return { assignment: currentAssignment, evaluation: currentEval };
}

function pointsPass(
  evaluation: RosterEvaluation,
  contexts: HeroPlanContext[],
  ptsByHeroId: Record<string, import('../gear/types').PointAlloc>,
  finalTier = false,
): Record<string, import('../gear/types').PointAlloc> {
  const nextPts = { ...ptsByHeroId };
  for (const ctx of contexts) {
    if (ctx.scope !== 'optimize') continue;
    const score = evaluation.perHero[ctx.heroId];
    if (!score) continue;
    const basePts = ctx.pts;
    const result = finalTier
      ? optimizeBuild({
          pts: nextPts[ctx.heroId] ?? basePts,
          effective: score.effective,
          effectiveDelta: score.effectiveDelta,
          context: score.context,
        })
      : findGateCandidate({
          pts: nextPts[ctx.heroId] ?? basePts,
          effective: score.effective,
          effectiveDelta: score.effectiveDelta,
          context: score.context,
        });
    nextPts[ctx.heroId] = result.pts;
  }
  return nextPts;
}

export type SeedRunnerInput = {
  name: string;
  assignment: AssignmentState;
  contexts: HeroPlanContext[];
  ptsByHeroId: Record<string, import('../gear/types').PointAlloc>;
  gearInput: TeamPlanInput;
  itemById: ReadonlyMap<string, InventoryItem>;
  budget: SolverBudget;
};

export type SeedResult = {
  name: string;
  assignment: AssignmentState;
  evaluation: RosterEvaluation;
  ptsByHeroId: Record<string, import('../gear/types').PointAlloc>;
  rounds: number;
};

export function runSeedSearch(input: SeedRunnerInput): SeedResult {
  let assignment = cloneAssignment(input.assignment);
  let ptsByHeroId = { ...input.ptsByHeroId };
  let evaluation = evaluateAssignment(
    assignment,
    input.contexts,
    ptsByHeroId,
    input.gearInput,
    input.itemById,
    input.budget,
  );
  let rounds = 0;
  let prevObjective = evaluation.objective;

  for (let round = 0; round < MAX_ROUNDS && !input.budget.exhausted; round++) {
    const gearResult = gearPass(
      assignment,
      input.contexts,
      ptsByHeroId,
      input.gearInput,
      input.itemById,
      input.budget,
      evaluation,
    );
    assignment = gearResult.assignment;
    evaluation = gearResult.evaluation;
    const prePointsObjective = evaluation.objective;
    const prePointsVector = ptsByHeroId;
    const nextPts = pointsPass(evaluation, input.contexts, ptsByHeroId, false);
    const nextEval = evaluateAssignment(
      assignment,
      input.contexts,
      nextPts,
      input.gearInput,
      input.itemById,
      input.budget,
    );
    // Guard: pointsPass is per-hero and can lower the ROSTER objective (saturated fair-share).
    // The old code let this degraded vector survive whenever the round loop broke right after
    // on IMPROVEMENT_EPSILON — revert both the vector and the evaluation when that happens.
    if (nextEval.objective + EPS >= prePointsObjective) {
      ptsByHeroId = nextPts;
      evaluation = nextEval;
    } else {
      ptsByHeroId = prePointsVector;
    }
    rounds += 1;
    const improvement =
      prevObjective > 0 ? (evaluation.objective - prevObjective) / prevObjective : evaluation.objective;
    if (improvement < IMPROVEMENT_EPSILON) break;
    prevObjective = evaluation.objective;
  }

  const ptsBeforeFinal = ptsByHeroId;
  const evalBeforeFinal = evaluation;
  ptsByHeroId = pointsPass(evaluation, input.contexts, ptsByHeroId, true);
  const afterFinalPts = evaluateAssignment(
    assignment,
    input.contexts,
    ptsByHeroId,
    input.gearInput,
    input.itemById,
    input.budget,
  );
  // optimizeBuild is per-hero; reject a final pass that lowers roster objective
  // (e.g. under saturated fair-share) so we never recommend a DPS-down respec.
  if (afterFinalPts.objective + 1e-9 >= evalBeforeFinal.objective) {
    evaluation = afterFinalPts;
  } else {
    ptsByHeroId = ptsBeforeFinal;
    evaluation = evalBeforeFinal;
  }

  return { name: input.name, assignment, evaluation, ptsByHeroId, rounds };
}

export { buildInitialAssignment } from './solver-assignment';
export { buildSeedAssignments } from './solver-seeds';
