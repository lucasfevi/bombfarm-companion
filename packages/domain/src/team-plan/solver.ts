import type { Loadout } from '../gear/types';
import type { InventoryItem } from '../inventory';
import { unmodelledAbilitiesInScope } from './ability-extras';
import { buildHeroPlanContexts } from './hero-context';
import { buildPool } from './pool';
import { createScoreMemo } from './score';
import {
  buildInitialAssignment,
  buildSeedAssignments,
  evaluateAssignment,
  TEAM_PLAN_BEAM_WIDTH,
  TEAM_PLAN_MAX_EVALUATIONS,
  runSeedSearch,
  type SolverBudget,
} from './solver-search';
import { loadoutsFromAssignment } from './solver-assignment';
import { buildWaterfall } from './waterfall';
import type {
  RosterEvaluation,
  TeamPlan,
  TeamPlanInput,
  TeamPlanResult,
  HeroPlanContext,
} from './types';

export {
  TEAM_PLAN_BEAM_WIDTH,
  TEAM_PLAN_MAX_EVALUATIONS,
  TEAM_PLAN_WORKER_MARKER,
  MAX_ROUNDS,
  IMPROVEMENT_EPSILON,
} from './solver-search';

function loadoutDriftHeroNames(input: TeamPlanInput): string[] {
  const itemByHeroSlot = new Map<string, InventoryItem>();
  for (const item of input.inventory) {
    if (!item.equippedBy || !item.slot) continue;
    itemByHeroSlot.set(`${item.equippedBy}|${item.slot}`, item);
  }
  const drifted: string[] = [];
  for (const hero of input.heroes) {
    let differs = false;
    for (const [slot, equipped] of Object.entries(hero.loadout)) {
      const inv = itemByHeroSlot.get(`${hero.heroId}|${slot}`);
      if (!equipped && !inv) continue;
      if (!equipped || !inv) {
        differs = true;
        break;
      }
      if (
        equipped.defId !== inv.defId ||
        equipped.rarityIdx !== inv.rarityIdx ||
        equipped.level !== inv.level ||
        equipped.upgrade !== inv.upgrade
      ) {
        differs = true;
        break;
      }
    }
    if (differs) drifted.push(hero.name);
  }
  return drifted;
}

function currentPtsByHeroId(input: TeamPlanInput): Record<string, import('../gear/types').PointAlloc> {
  return Object.fromEntries(input.heroes.map((hero) => [hero.heroId, hero.pts]));
}

/**
 * The contested-field disclosure (`TeamPlan.disclosures.fieldContention`). Reads the FINAL
 * evaluation, so it describes the roster the player is being shown, not an intermediate one.
 */
function fieldContention(
  finalEvaluation: RosterEvaluation,
  contexts: HeroPlanContext[],
): TeamPlan['disclosures']['fieldContention'] {
  if (finalEvaluation.regime !== 'saturated') return null;
  const meanActiveDps =
    finalEvaluation.slots > 0 ? finalEvaluation.objective / finalEvaluation.slots : 0;
  const dilutingHeroNames = contexts
    .filter((ctx) => ctx.scope === 'optimize')
    .map((ctx) => ({ name: ctx.name, active: finalEvaluation.perHero[ctx.heroId]?.active ?? 0 }))
    .filter((row) => row.active < meanActiveDps)
    .sort((a, b) => a.active - b.active || a.name.localeCompare(b.name))
    .map((row) => row.name);
  return {
    sumDuty: finalEvaluation.sumDuty,
    slots: finalEvaluation.slots,
    meanActiveDps,
    dilutingHeroNames,
  };
}

function evaluateCurrentAssignment(
  input: TeamPlanInput,
  contexts: HeroPlanContext[],
  assignment: ReturnType<typeof buildInitialAssignment>,
  itemById: ReadonlyMap<string, InventoryItem>,
  budget: SolverBudget,
) {
  const ptsByHeroId = currentPtsByHeroId(input);
  return evaluateAssignment(assignment, contexts, ptsByHeroId, input, itemById, budget);
}

export function runTeamPlan(
  input: TeamPlanInput,
  options?: { maxEvaluations?: number; beamWidth?: number },
): TeamPlanResult {
  const started = performance.now();
  const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
  if (built.blocked) {
    return { blocked: true, heroNames: built.heroNames };
  }

  const contexts = built.contexts;
  const optimizeContexts = contexts.filter((ctx) => ctx.scope === 'optimize');
  const rosterIds = new Set(input.heroes.map((hero) => hero.heroId));
  const gearPool = buildPool({
    inventory: input.inventory,
    scopeByHeroId: input.scopeByHeroId,
    forgeFloor: input.forgeFloor,
    rosterHeroIds: rosterIds,
  });
  const itemById = new Map(input.inventory.map((item) => [item.id, item]));
  const baseAssignment = buildInitialAssignment(
    input.inventory,
    gearPool,
    optimizeContexts,
    input.forgeFloor,
  );
  const budget: SolverBudget = {
    maxEvaluations: options?.maxEvaluations ?? TEAM_PLAN_MAX_EVALUATIONS,
    evaluations: 0,
    exhausted: false,
    cache: new Map(),
    scoreMemo: createScoreMemo(),
    beamWidth: options?.beamWidth ?? TEAM_PLAN_BEAM_WIDTH,
  };

  const currentEval = evaluateCurrentAssignment(
    input,
    contexts,
    baseAssignment,
    itemById,
    budget,
  );
  const seeds = buildSeedAssignments(
    baseAssignment,
    contexts,
    input,
    itemById,
    currentEval,
  );

  let best = runSeedSearch({
    name: seeds[0].name,
    assignment: seeds[0].assignment,
    contexts,
    ptsByHeroId: currentPtsByHeroId(input),
    gearInput: input,
    itemById,
    budget,
  });

  for (let i = 1; i < seeds.length && !budget.exhausted; i++) {
    const seed = seeds[i];
    const candidate = runSeedSearch({
      name: seed.name,
      assignment: seed.assignment,
      contexts,
      ptsByHeroId: currentPtsByHeroId(input),
      gearInput: input,
      itemById,
      budget,
    });
    if (candidate.evaluation.objective > best.evaluation.objective + 1e-9) {
      best = candidate;
    }
  }

  const waterfall = buildWaterfall({
    gearInput: input,
    contexts,
    currentAssignment: baseAssignment,
    planAssignment: best.assignment,
    finalPtsByHeroId: best.ptsByHeroId,
    itemById,
  });

  // The waterfall is the decision point (AC-RGO monotonicity fix) — it may reject the search's
  // assignment/points in favor of the baseline, so `regime`/`sumDuty`/`slots`/`proposedLoadouts`
  // must describe the winning state, not `best.evaluation` / `best.assignment` directly.
  const proposedLoadouts: Record<string, Loadout> = loadoutsFromAssignment(
    waterfall.assignment,
    itemById,
  );

  const plan: TeamPlan = {
    steps: waterfall.steps,
    forgeList: waterfall.forgeList,
    moveList: waterfall.moveList,
    pointResets: waterfall.pointResets,
    perHero: waterfall.perHero,
    proposedLoadouts,
    regime: waterfall.finalEvaluation.regime,
    sumDuty: waterfall.finalEvaluation.sumDuty,
    slots: waterfall.finalEvaluation.slots,
    currentDps: waterfall.steps[0]?.objective ?? 0,
    planDps: waterfall.steps[2]?.objective ?? 0,
    forgeFloorApplied: waterfall.forgeFloorApplied,
    gearBreakdown: waterfall.gearBreakdown,
    requiresFullPlan: waterfall.requiresFullPlan,
    gearDipDps: waterfall.gearDipDps,
    disclosures: {
      unmodelledAbilities: unmodelledAbilitiesInScope(contexts),
      loadoutDriftHeroNames: loadoutDriftHeroNames(input),
      foreignOwnedItemCount: gearPool.excluded.foreignOwner,
      marketBlockedItemCount: gearPool.excluded.marketBlocked,
      unresolvedDefItemCount: gearPool.excluded.unresolvedDef,
      fieldContention: fieldContention(waterfall.finalEvaluation, contexts),
    },
    run: {
      rounds: best.rounds,
      evaluations: budget.evaluations,
      budgetExhausted: budget.exhausted,
      elapsedMs: Math.round(performance.now() - started),
      seedUsed: best.name,
    },
  };

  return { blocked: false, plan };
}
