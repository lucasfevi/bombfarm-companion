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
  GearPlanInput,
  HeroPlanContext,
  RosterEvaluation,
} from './types';

export const GEAR_PLAN_MAX_EVALUATIONS = 500_000;
// Counts gear<->points alternations, not moves, now that gearPass climbs to local optimality
// (Change 2a) — the convergence break below normally exits well before this cap.
export const MAX_ROUNDS = 30;
// The old 1e-4 was ~148,000 DPS on a 1.48B roster — larger than the steps it was meant to
// arbitrate, so it broke the round loop long before the search actually converged.
export const IMPROVEMENT_EPSILON = 1e-7;
export const GEAR_PLAN_WORKER_MARKER = 'runGearPlan';

const EPS = 1e-9;

export type SolverBudget = {
  maxEvaluations: number;
  evaluations: number;
  exhausted: boolean;
  cache?: Map<string, RosterEvaluation>;
};

function assignmentCacheKey(
  assignment: AssignmentState,
  ptsByHeroId: Record<string, import('../gear/types').PointAlloc>,
  forgeFloor: number,
): string {
  const slotPart = Object.entries(assignment.slots)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([heroId, slots]) => `${heroId}:${SLOTS.map((s) => slots[s] ?? '').join(',')}`)
    .join('|');
  const poolPart = [...assignment.pool].sort().join(',');
  const ptsPart = Object.entries(ptsByHeroId)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, pts]) => `${id}:${JSON.stringify(pts)}`)
    .join('|');
  return `${slotPart}#${poolPart}#${ptsPart}#${forgeFloor}`;
}

function farmFromAccount(input: GearPlanInput): FarmContext {
  return {
    houseIdx: input.account.houseIdx,
    houseLevel: input.account.houseLevel,
    phase: input.account.phase,
    mitigationPct: input.account.mitigationPct,
    treeGlassCannon: input.account.treeGlassCannon,
    treeTempoDobrado: input.account.treeTempoDobrado,
  };
}

export function evaluateAssignment(
  assignment: AssignmentState,
  contexts: HeroPlanContext[],
  ptsByHeroId: Record<string, import('../gear/types').PointAlloc>,
  input: GearPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  budget: SolverBudget,
): RosterEvaluation {
  const cacheKey = assignmentCacheKey(assignment, ptsByHeroId, input.forgeFloor);
  const cached = budget.cache?.get(cacheKey);
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
  budget.cache?.set(cacheKey, result);
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
  input: GearPlanInput,
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
  gearInput: GearPlanInput;
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
