import type { Loadout } from '../gear/types';
import type { InventoryItem } from '../inventory';
import { unmodelledAbilitiesInScope } from './ability-extras';
import { buildHeroPlanContexts } from './hero-context';
import { buildPool } from './pool';
import {
  buildInitialAssignment,
  buildSeedAssignments,
  evaluateAssignment,
  GEAR_PLAN_MAX_EVALUATIONS,
  runSeedSearch,
  type SolverBudget,
} from './solver-search';
import { loadoutsFromAssignment } from './solver-assignment';
import type { GearPlan, GearPlanInput, GearPlanResult, HeroPlanContext } from './types';

export {
  GEAR_PLAN_MAX_EVALUATIONS,
  GEAR_PLAN_WORKER_MARKER,
  MAX_ROUNDS,
  IMPROVEMENT_EPSILON,
} from './solver-search';

function loadoutDriftHeroNames(input: GearPlanInput): string[] {
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

function currentPtsByHeroId(input: GearPlanInput): Record<string, import('../gear/types').PointAlloc> {
  return Object.fromEntries(input.heroes.map((hero) => [hero.heroId, hero.pts]));
}

function evaluateCurrentAssignment(
  input: GearPlanInput,
  contexts: HeroPlanContext[],
  assignment: ReturnType<typeof buildInitialAssignment>,
  itemById: ReadonlyMap<string, InventoryItem>,
  budget: SolverBudget,
) {
  const ptsByHeroId = currentPtsByHeroId(input);
  return evaluateAssignment(assignment, contexts, ptsByHeroId, input, itemById, budget);
}

export function runGearPlan(
  input: GearPlanInput,
  options?: { maxEvaluations?: number },
): GearPlanResult {
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
    maxEvaluations: options?.maxEvaluations ?? GEAR_PLAN_MAX_EVALUATIONS,
    evaluations: 0,
    exhausted: false,
    cache: new Map(),
  };

  const currentEval = evaluateCurrentAssignment(
    input,
    contexts,
    baseAssignment,
    itemById,
    budget,
  );
  const currentDps = currentEval.objective;
  const seeds = buildSeedAssignments(
    baseAssignment,
    contexts,
    input,
    itemById,
    currentEval,
  );

  let best = runSeedSearch({
    name: seeds[0]!.name,
    assignment: seeds[0]!.assignment,
    contexts,
    ptsByHeroId: currentPtsByHeroId(input),
    gearInput: input,
    itemById,
    budget,
  });

  for (let i = 1; i < seeds.length && !budget.exhausted; i++) {
    const seed = seeds[i]!;
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

  const planDps = Math.max(best.evaluation.objective, currentDps);
  const proposedLoadouts: Record<string, Loadout> = loadoutsFromAssignment(
    best.assignment,
    itemById,
  );

  const perHero = optimizeContexts.map((ctx) => {
    const before = currentEval.perHero[ctx.heroId]?.sustained ?? 0;
    const after = best.evaluation.perHero[ctx.heroId]?.sustained ?? 0;
    return {
      heroId: ctx.heroId,
      heroName: ctx.name,
      level: ctx.level,
      before,
      after,
      delta: after - before,
    };
  });

  const plan: GearPlan = {
    steps: [],
    forgeList: [],
    moveList: [],
    pointResets: [],
    perHero,
    proposedLoadouts,
    regime: best.evaluation.regime,
    sumDuty: best.evaluation.sumDuty,
    slots: best.evaluation.slots,
    currentDps,
    planDps,
    disclosures: {
      unmodelledAbilities: unmodelledAbilitiesInScope(contexts),
      loadoutDriftHeroNames: loadoutDriftHeroNames(input),
      foreignOwnedItemCount: gearPool.excluded.foreignOwner,
      marketBlockedItemCount: gearPool.excluded.marketBlocked,
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
