import { SLOTS } from '../gear/catalog';
import type { Loadout, PointAlloc } from '../gear/types';
import type { InventoryItem } from '../inventory';
import { hasRuneOnSheet } from '../runes';
import { mayRespendPoints } from './allowed-changes';
import { exhaustiveFarmObjective } from './farm-objective';
import { buildHeroPlanContexts, scopeOfHero } from './hero-context';
import { buildPool } from './pool';
import type { SolvedTeamPlan, TeamPlanSolveOptions } from './solver';
import {
  buildInitialAssignment,
  itemToEquipped,
  loadoutsFromAssignment,
  type AssignmentState,
} from './solver-assignment';
import {
  currentPtsByHeroId,
  farmObjectiveFor,
  planInputFor,
  scoredPhaseClearSecs,
  scoredPhaseReport,
} from './solver-report';
import type {
  RosterEvaluation,
  ScopeState,
  TeamPlan,
  TeamPlanBlockedResult,
  TeamPlanInput,
  TeamPlanResult,
} from './types';
import { buildForgeList, buildMoveList, buildPerHeroTable, buildPointResets } from './waterfall';
import { evaluateAt } from './waterfall-guards';

const EPS = 1e-9;

type SolveStep = (
  input: TeamPlanInput,
  options?: TeamPlanSolveOptions,
) => SolvedTeamPlan | TeamPlanBlockedResult;

/** The Optimize heroes in the order they are geared — see {@link TeamPlanInput.priorityOrder}. */
export function resolvePriorityOrder(input: TeamPlanInput): string[] {
  if (!input.priorityOrder?.length) return [];
  const optimizeIds = input.heroes
    .filter((hero) => scopeOfHero(hero, input.scopeByHeroId) === 'optimize')
    .map((hero) => hero.heroId);
  const optimize = new Set(optimizeIds);
  const listed = [...new Set(input.priorityOrder)].filter((heroId) => optimize.has(heroId));
  const listedIds = new Set(listed);
  return [...listed, ...optimizeIds.filter((heroId) => !listedIds.has(heroId))];
}

/** Where every item sits, and what every hero wears and has spent, as the steps hand gear out. */
type RosterState = {
  ownerByItemId: Map<string, string | null>;
  slotsByHeroId: Map<string, Record<string, string | null>>;
  loadoutByHeroId: Map<string, Loadout>;
  ptsByHeroId: Record<string, PointAlloc>;
};

function initialRosterState(input: TeamPlanInput): RosterState {
  const rosterIds = new Set(input.heroes.map((hero) => hero.heroId));
  const ownerByItemId = new Map<string, string | null>();
  const slotsByHeroId = new Map<string, Record<string, string | null>>();
  for (const hero of input.heroes) {
    slotsByHeroId.set(hero.heroId, Object.fromEntries(SLOTS.map((slot) => [slot, null])));
  }
  for (const item of input.inventory) {
    ownerByItemId.set(item.id, item.equippedBy ?? null);
    if (!item.slot || !item.equippedBy || !rosterIds.has(item.equippedBy)) continue;
    const slots = slotsByHeroId.get(item.equippedBy);
    if (slots && !slots[item.slot]) slots[item.slot] = item.id;
  }
  return {
    ownerByItemId,
    slotsByHeroId,
    loadoutByHeroId: new Map(input.heroes.map((hero) => [hero.heroId, { ...hero.loadout }])),
    ptsByHeroId: currentPtsByHeroId(input),
  };
}

function resolvedScopes(input: TeamPlanInput): Record<string, ScopeState> {
  return Object.fromEntries(
    input.heroes.map((hero) => [hero.heroId, scopeOfHero(hero, input.scopeByHeroId)]),
  );
}

/**
 * The run for one hero: it alone may be re-geared. Heroes already geared are left alone in their
 * new gear. Heroes still waiting stay on the field as they are — so the squad the objective
 * prices is the one the player runs — but their pieces are handed to the pool, which is what lets
 * this hero take them without their loss counting against it.
 */
function stepInput(
  input: TeamPlanInput,
  state: RosterState,
  scopes: Record<string, ScopeState>,
  order: readonly string[],
  index: number,
): TeamPlanInput {
  const heroId = order[index];
  const waiting = new Set(order.slice(index + 1));
  const scopeByHeroId: Record<string, ScopeState> = { ...scopes };
  for (const other of order) scopeByHeroId[other] = other === heroId ? 'optimize' : 'leaveAlone';

  const inventory = input.inventory.map((item) => {
    const owner = state.ownerByItemId.get(item.id) ?? null;
    const equippedBy = owner && waiting.has(owner) ? null : owner;
    return equippedBy === (item.equippedBy ?? null) ? item : { ...item, equippedBy };
  });
  const heroes = input.heroes.map((hero) => ({
    ...hero,
    loadout: state.loadoutByHeroId.get(hero.heroId) ?? hero.loadout,
    pts: state.ptsByHeroId[hero.heroId] ?? hero.pts,
  }));
  return { ...input, heroes, inventory, scopeByHeroId, priorityOrder: null };
}

/** Moves the step's picks onto its hero, stripping each from whoever wore it before. */
function commitStep(
  state: RosterState,
  heroId: string,
  solved: SolvedTeamPlan,
  itemById: ReadonlyMap<string, InventoryItem>,
): void {
  const planned = solved.assignment.slots[heroId] ?? {};
  const slots = state.slotsByHeroId.get(heroId) ?? {};
  const loadout = { ...(state.loadoutByHeroId.get(heroId) ?? {}) };

  for (const slot of SLOTS) {
    const nextId = planned[slot] ?? null;
    const previousId = slots[slot] ?? null;
    if (nextId === previousId) continue;
    // A worn piece the search never saw (market-blocked, unresolved) is not one it took off.
    if (!nextId && previousId && !solved.assignment.pool.has(previousId)) continue;

    if (previousId) state.ownerByItemId.set(previousId, null);
    if (nextId) {
      const formerOwner = state.ownerByItemId.get(nextId) ?? null;
      if (formerOwner && formerOwner !== heroId) {
        const formerSlots = state.slotsByHeroId.get(formerOwner);
        if (formerSlots) formerSlots[slot] = null;
        const formerLoadout = state.loadoutByHeroId.get(formerOwner);
        if (formerLoadout) state.loadoutByHeroId.set(formerOwner, { ...formerLoadout, [slot]: null });
      }
      state.ownerByItemId.set(nextId, heroId);
    }
    slots[slot] = nextId;
    const nextItem = nextId ? itemById.get(nextId) : undefined;
    loadout[slot] = nextItem ? itemToEquipped(nextItem) : null;
  }

  state.slotsByHeroId.set(heroId, slots);
  state.loadoutByHeroId.set(heroId, loadout);
  state.ptsByHeroId[heroId] = solved.ptsByHeroId[heroId] ?? state.ptsByHeroId[heroId];
}

function ptsChanged(a: PointAlloc | undefined, b: PointAlloc | undefined): boolean {
  if (!a || !b) return false;
  return (Object.keys(a) as (keyof PointAlloc)[]).some((key) => a[key] !== b[key]);
}

function assignmentFromState(
  base: AssignmentState,
  state: RosterState,
  optimizeIds: readonly string[],
): AssignmentState {
  const known = new Set([
    ...base.pool,
    ...Object.values(base.slots).flatMap((slots) => Object.values(slots).filter((id): id is string => Boolean(id))),
  ]);
  const slots: AssignmentState['slots'] = {};
  const placed = new Set<string>();
  for (const heroId of optimizeIds) {
    const heroSlots = state.slotsByHeroId.get(heroId) ?? {};
    slots[heroId] = Object.fromEntries(
      SLOTS.map((slot) => {
        const itemId = heroSlots[slot] ?? null;
        if (!itemId || !known.has(itemId)) return [slot, null];
        placed.add(itemId);
        return [slot, itemId];
      }),
    );
  }
  return { slots, pool: new Set([...known].filter((itemId) => !placed.has(itemId))) };
}

/**
 * Gears the Optimize heroes one at a time in priority order, then reports the combined result as
 * one plan.
 *
 * Each step is an ordinary team-plan run with a single Optimize hero, so every rule the team-wide
 * search keeps — the candidate guard, the point-reset accept, what forging is allowed — holds for
 * that hero. The combined result is then REPORTED, not re-judged: the team-wide guard would trade
 * a top-priority hero's gain back for the team total, which is the one thing this mode is for.
 *
 * One forge floor for the whole plan: it applies when any step forged, as the team-wide plan
 * applies one floor to everything it equips.
 */
export function runPriorityPlan(
  rawInput: TeamPlanInput,
  options: TeamPlanSolveOptions | undefined,
  solveStep: SolveStep,
): TeamPlanResult {
  const started = performance.now();
  const order = resolvePriorityOrder(rawInput);
  const scopes = resolvedScopes(rawInput);
  const itemById = new Map(rawInput.inventory.map((item) => [item.id, item]));
  const state = initialRosterState(rawInput);

  let rounds = 0;
  let evaluations = 0;
  let budgetExhausted = false;
  let anyStepForged = false;
  for (let index = 0; index < order.length; index++) {
    const solved = solveStep(stepInput(rawInput, state, scopes, order, index), options);
    if (solved.blocked) return solved;
    commitStep(state, order[index], solved, itemById);
    rounds += solved.plan.run.rounds;
    evaluations += solved.plan.run.evaluations;
    budgetExhausted ||= solved.plan.run.budgetExhausted;
    anyStepForged ||= solved.plan.forgeFloorApplied > 0;
  }

  const allowedChanges = rawInput.allowedChanges ?? 'both';
  const input = planInputFor(rawInput, allowedChanges);
  const built = buildHeroPlanContexts(input.heroes, input.account, input.scopeByHeroId);
  if (built.blocked) return { blocked: true, heroNames: built.heroNames };
  const contexts = built.contexts;
  const rosterIds = new Set(input.heroes.map((hero) => hero.heroId));
  const gearPool = buildPool({
    inventory: input.inventory,
    scopeByHeroId: input.scopeByHeroId,
    forgeFloor: input.forgeFloor,
    rosterHeroIds: rosterIds,
  });
  const optimizeContexts = contexts.filter((ctx) => ctx.scope === 'optimize');
  const baseAssignment = buildInitialAssignment(input.inventory, gearPool, optimizeContexts, input.forgeFloor);
  const planAssignment = assignmentFromState(
    baseAssignment,
    state,
    optimizeContexts.map((ctx) => ctx.heroId),
  );
  const floor = anyStepForged ? input.forgeFloor : 0;

  const farmObjective = farmObjectiveFor(input, contexts);
  const reportedObjective = farmObjective ? exhaustiveFarmObjective(farmObjective) : undefined;
  const evaluate = (assignment: AssignmentState, pts: Record<string, PointAlloc>, atFloor: number) =>
    evaluateAt(contexts, assignment, pts, input, itemById, atFloor, reportedObjective);

  const currentPts = currentPtsByHeroId(input);
  const todayEvaluation = evaluate(baseAssignment, currentPts, 0);
  const gearEvaluation = evaluate(planAssignment, currentPts, floor);

  const finalPts: Record<string, PointAlloc> = { ...currentPts };
  const acceptedHeroIds: string[] = [];
  const gainByHeroId: Record<string, number> = {};
  let respecEvaluation: RosterEvaluation = gearEvaluation;
  for (const heroId of mayRespendPoints(allowedChanges) ? order : []) {
    if (!ptsChanged(state.ptsByHeroId[heroId], currentPts[heroId])) continue;
    finalPts[heroId] = state.ptsByHeroId[heroId];
    const evaluation = evaluate(planAssignment, finalPts, floor);
    gainByHeroId[heroId] = evaluation.objective - respecEvaluation.objective;
    acceptedHeroIds.push(heroId);
    respecEvaluation = evaluation;
  }

  const todayObjective = todayEvaluation.objective;
  const gearObjective = gearEvaluation.objective;
  const baselineAtFloor = floor > 0 ? evaluate(baseAssignment, currentPts, floor).objective : todayObjective;
  const requiresFullPlan = gearObjective < todayObjective - EPS;
  const heroLevelById = new Map(contexts.map((ctx) => [ctx.heroId, ctx.level]));

  const phaseReport = scoredPhaseReport(input, reportedObjective, respecEvaluation);
  const plan: TeamPlan = {
    steps: [
      { id: 'today', objective: todayObjective, delta: 0 },
      { id: 'gear', objective: gearObjective, delta: gearObjective - todayObjective },
      { id: 'respec', objective: respecEvaluation.objective, delta: respecEvaluation.objective - gearObjective },
    ],
    forgeList: buildForgeList(input.inventory, floor, rosterIds, planAssignment),
    moveList: buildMoveList(baseAssignment, planAssignment, itemById, contexts),
    pointResets: buildPointResets(
      acceptedHeroIds,
      currentPts,
      finalPts,
      gearEvaluation,
      respecEvaluation,
      gainByHeroId,
      heroLevelById,
    ),
    perHero: buildPerHeroTable(contexts, todayEvaluation, respecEvaluation),
    proposedLoadouts: loadoutsFromAssignment(planAssignment, itemById),
    regime: respecEvaluation.regime,
    sumDuty: respecEvaluation.sumDuty,
    slots: respecEvaluation.slots,
    currentDps: todayObjective,
    planDps: respecEvaluation.objective,
    forgeFloorApplied: floor,
    allowedChanges,
    ...phaseReport,
    scoredPhaseClearSecs: scoredPhaseClearSecs(phaseReport, reportedObjective, respecEvaluation),
    gearBreakdown: { forgeDelta: baselineAtFloor - todayObjective, moveDelta: gearObjective - baselineAtFloor },
    requiresFullPlan,
    gearDipDps: requiresFullPlan ? todayObjective - gearObjective : 0,
    runedHeroNames: contexts
      .filter((ctx) => ctx.scope !== 'leaveAlone' && hasRuneOnSheet(ctx.runes))
      .map((ctx) => ctx.name),
    run: {
      rounds,
      evaluations,
      budgetExhausted,
      elapsedMs: Math.round(performance.now() - started),
      seedUsed: 'priority',
    },
    priorityOrder: order,
  };
  return { blocked: false, plan };
}
