import type { InventoryItem } from '../inventory';
import type { Loadout } from '../gear/types';
import { SLOTS } from '../gear/catalog';
import { findGateCandidate, optimizeBuild } from '../points-reopt';
import { evaluateRoster, screenRosterObjective } from './evaluate';
import {
  applyMove,
  cloneAssignment,
  heroLoadoutFromAssignment,
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
  ScoreMemo,
} from './types';

/**
 * Lowered 500,000 -> 250,000 once dominance pruning and interchangeable-item dedup landed.
 * Measured on a real 441-item, 15-hero save: 250,000 reaches 99.96% of the converged optimum
 * in 168s where 500,000 takes 238s for the last 0.04%. The same save under the old candidate
 * set scored 4.489e+11 at 500,000 evaluations; it now scores 4.952e+11 at 250,000 -- 10% better
 * in a third less time. 100,000 already reaches 99.73% in 62s if responsiveness matters more.
 */
export const TEAM_PLAN_MAX_EVALUATIONS = 250_000;
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

/**
 * Default beam width for the gear climb (see {@link SolverBudget.beamWidth}).
 *
 * Measured across six real saves (10-16 heroes, 348-400 pooled items, phases 151-600), beam +
 * exact-fallback against the exact search at a 250,000 evaluation budget:
 *
 * | save                | exact        | beam k=20   | planDps                    |
 * | ------------------- | ------------ | ----------- | -------------------------- |
 * | SaveFile_BombFarm   | 86.5s        | 21.5s       | identical, plan differs (below) |
 * | bellatrix-0-points  | 39.6s        | 7.8s        | identical, whole plan       |
 * | optimized           | 46.0s        | 13.9s       | identical, whole plan       |
 * | phase-151           | 60.2s        | 7.8s        | identical, whole plan       |
 * | phase-600           | 63.3s        | 8.6s        | identical, whole plan       |
 * | save-08.08.2026     | 40.6s        | 6.9s        | identical, whole plan       |
 *
 * 3-8x faster for the same `planDps` everywhere, and 5 of the 6 produced a byte-identical plan.
 * The exception was SaveFile_BombFarm, where the plan is DPS-neutral but not identical: two heroes
 * end up with a rarityIdx 3 and a rarityIdx 4 `platinum_anel` swapped, scoring exactly the same.
 * That is the honest cost of this change — the search reaches an equal-value optimum by a
 * different route, so a re-run can propose a different (never worse) assignment.
 *
 * 20 sits on a plateau rather than a peak: k=10, 20 and 50 all reproduced the exact search's
 * `planDps` on all six saves. k=5 is both slower (a narrower beam needs more iterations and more
 * fallback work: 62.8s vs 21.5s) and less stable — it diverged on two saves, though notably it
 * landed 0.12% ABOVE the exact search on one of them rather than below.
 *
 * Note what the exact search was actually doing in that comparison: on 3 of the 6 saves it hit
 * the 250,000 cap without converging, so it returned a cut-off climb. The beam converged on all
 * six (11,242-51,903 evaluations), which makes the budget a safety net rather than the limiter.
 */
export const TEAM_PLAN_BEAM_WIDTH = 20;

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
  /**
   * Per-hero score memo, shared across every roster evaluation of one run. A gear move changes
   * one hero's loadout, so the other 14 heroes rescore to bit-identical values; keyed on
   * `heroId | loadout | pts | auras`, those lookups hit exactly. Measured on a real 348-item,
   * 15-hero save: 97.1% of `scoreHeroLoadout` calls are repeats of a key seen earlier in the run,
   * against 0.0% for the per-`evaluateRoster` memo it replaces.
   *
   * Valid only for a single `runTeamPlan`: the key omits the `HeroPlanContext` and `FarmContext`,
   * which are fixed within a run and different between runs.
   */
  scoreMemo?: ScoreMemo;
  /**
   * Beam width for the gear climb. 0 (the default) is the exact search: every move in the
   * neighbourhood is fully evaluated and the best is applied. Above 0, each iteration ranks the
   * whole neighbourhood with {@link screenRosterObjective} and fully evaluates only the top
   * `beamWidth` — and when the beam stops finding an improving move, the climb falls back to the
   * exact search from wherever the beam left it, so the local optimum reached is a local optimum
   * of the FULL neighbourhood, not of the beam.
   *
   * The fallback is what makes this safe to consider: without it a plain beam stalls early and
   * low (measured: K=20..100 all stall at 99.85% of the exact result).
   */
  beamWidth?: number;
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
    cycleSecs: input.account.cycleSecs,
    cycleSecsHouseIdx: input.account.cycleSecsHouseIdx,
    cycleSecsLevel: input.account.cycleSecsLevel,
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
    slots: input.account.fieldSlots,
    farm: farmFromAccount(input),
    forgeFloor: input.forgeFloor,
    scoreMemo: budget.scoreMemo,
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

type MoveCandidate = { move: GearMove; assignment: AssignmentState };

/**
 * The `beamWidth` best moves by {@link screenRosterObjective}, in screen order.
 *
 * Ties keep `generateMoves`' order — `Array.prototype.sort` is stable — so the beam is as
 * deterministic as the exact search it stands in for.
 */
function beamCandidates(
  moves: GearMove[],
  currentAssignment: AssignmentState,
  currentEval: RosterEvaluation,
  contexts: HeroPlanContext[],
  ptsByHeroId: Record<string, import('../gear/types').PointAlloc>,
  input: TeamPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  budget: SolverBudget,
): MoveCandidate[] {
  const farm = farmFromAccount(input);
  const screened = moves.map((move) => {
    const assignment = applyMove(currentAssignment, move);
    const changed = move.kind === 'swap' ? [move.heroA, move.heroB] : [move.heroId];
    const loadoutsByHeroId: Record<string, Loadout> = {};
    for (const heroId of changed) {
      loadoutsByHeroId[heroId] = heroLoadoutFromAssignment(assignment, heroId, itemById);
    }
    const screen = screenRosterObjective(
      {
        contexts,
        loadoutsByHeroId,
        ptsByHeroId,
        slots: input.account.fieldSlots,
        farm,
        forgeFloor: input.forgeFloor,
        scoreMemo: budget.scoreMemo,
      },
      currentEval,
      changed,
    );
    return { move, assignment, screen };
  });

  screened.sort((a, b) => b.screen - a.screen);
  return screened.slice(0, budget.beamWidth ?? 0);
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
  // Cleared for good the first time the beam fails to find an improving move (see `beamWidth`).
  let beamActive = (budget.beamWidth ?? 0) > 0;

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

    const candidates = beamActive
      ? beamCandidates(moves, currentAssignment, currentEval, contexts, ptsByHeroId, input, itemById, budget)
      : moves.map((move) => ({ move, assignment: applyMove(currentAssignment, move) }));

    for (const candidate of candidates) {
      if (budget.exhausted) break;
      const candidateEval = evaluateAssignment(
        candidate.assignment,
        contexts,
        ptsByHeroId,
        input,
        itemById,
        budget,
      );
      if (candidateEval.objective > bestEval.objective + EPS) {
        bestEval = candidateEval;
        bestMove = candidate.move;
        bestAssignment = candidate.assignment;
      }
    }

    if (!bestMove) {
      // The beam is out of ideas, which says nothing about the full neighbourhood — hand the
      // climb back to the exact search from here rather than calling this a local optimum.
      if (beamActive) {
        beamActive = false;
        continue;
      }
      break;
    }
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
          level: ctx.level,
        })
      : findGateCandidate({
          pts: nextPts[ctx.heroId] ?? basePts,
          effective: score.effective,
          effectiveDelta: score.effectiveDelta,
          context: score.context,
          level: ctx.level,
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
