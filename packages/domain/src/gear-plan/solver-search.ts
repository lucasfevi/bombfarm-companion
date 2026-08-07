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

export const GEAR_PLAN_MAX_EVALUATIONS = 150_000;
export const MAX_ROUNDS = 6;
export const IMPROVEMENT_EPSILON = 1e-4;
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

function gearPass(
  assignment: AssignmentState,
  contexts: HeroPlanContext[],
  ptsByHeroId: Record<string, import('../gear/types').PointAlloc>,
  input: GearPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  budget: SolverBudget,
  startEval: RosterEvaluation,
): { assignment: AssignmentState; evaluation: RosterEvaluation } {
  let bestMove: GearMove | null = null;
  let bestAssignment = assignment;
  let bestEval = startEval;
  const moves = generateMoves({
    contexts,
    slots: assignment.slots,
    pool: assignment.pool,
    itemById,
    heroDpsById: heroDpsMap(startEval),
    forgeFloor: input.forgeFloor,
  });
  for (const move of moves) {
    if (budget.exhausted) break;
    const candidateAssignment = applyMove(assignment, move);
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
  if (bestMove) {
    return { assignment: bestAssignment, evaluation: bestEval };
  }
  return { assignment, evaluation: startEval };
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
    ptsByHeroId = pointsPass(evaluation, input.contexts, ptsByHeroId, false);
    evaluation = evaluateAssignment(
      assignment,
      input.contexts,
      ptsByHeroId,
      input.gearInput,
      input.itemById,
      input.budget,
    );
    rounds += 1;
    const improvement =
      prevObjective > 0 ? (evaluation.objective - prevObjective) / prevObjective : evaluation.objective;
    if (improvement < IMPROVEMENT_EPSILON) break;
    prevObjective = evaluation.objective;
  }

  ptsByHeroId = pointsPass(evaluation, input.contexts, ptsByHeroId, true);
  evaluation = evaluateAssignment(
    assignment,
    input.contexts,
    ptsByHeroId,
    input.gearInput,
    input.itemById,
    input.budget,
  );

  return { name: input.name, assignment, evaluation, ptsByHeroId, rounds };
}

export { buildInitialAssignment } from './solver-assignment';
export { buildSeedAssignments } from './solver-seeds';
