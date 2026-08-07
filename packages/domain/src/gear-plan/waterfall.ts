import { SLOTS } from '../gear/catalog';
import type { PointAlloc } from '../gear/types';
import type { InventoryItem } from '../inventory';
import { evaluateRoster } from './evaluate';
import { optimizeBuild } from '../points-reopt';
import {
  buildInitialAssignment,
  type AssignmentState,
} from './solver-assignment';
import { chooseGearCandidate, evaluateAt } from './waterfall-guards';
import type {
  ForgeAction,
  GearPlanInput,
  HeroPlanContext,
  MoveAction,
  RosterEvaluation,
  WaterfallStep,
} from './types';

const EPS = 1e-9;

export type WaterfallResult = {
  steps: WaterfallStep[];
  forgeList: ForgeAction[];
  moveList: MoveAction[];
  pointResets: {
    heroId: string;
    pts: Record<string, number>;
    gainPct: number;
    rosterGainDps: number;
    resetCostGold: number;
  }[];
  perHero: {
    heroId: string;
    heroName: string;
    level: number;
    before: number;
    after: number;
    delta: number;
  }[];
  /** The winning candidate's assignment/points — what `runGearPlan` should actually propose. */
  assignment: AssignmentState;
  ptsByHeroId: Record<string, PointAlloc>;
  /** The respec-step evaluation — source of truth for `regime` / `sumDuty` / `slots` on screen. */
  finalEvaluation: RosterEvaluation;
  forgeFloorApplied: number;
  gearBreakdown: { forgeDelta: number; moveDelta: number };
  /** True when the gear step sits below today — transient until the respec resets land. */
  requiresFullPlan: boolean;
  /** How far below today the gear step sits, as a POSITIVE number. 0 when requiresFullPlan is false. */
  gearDipDps: number;
};

export type BuildWaterfallInput = {
  gearInput: GearPlanInput;
  contexts: HeroPlanContext[];
  currentAssignment: AssignmentState;
  planAssignment: AssignmentState;
  finalPtsByHeroId: Record<string, PointAlloc>;
  itemById: ReadonlyMap<string, InventoryItem>;
};

function currentPtsByHeroId(input: GearPlanInput): Record<string, PointAlloc> {
  return Object.fromEntries(input.heroes.map((hero) => [hero.heroId, hero.pts]));
}

function itemLocation(assignment: AssignmentState): Map<string, { heroId: string | null; slot: string | null }> {
  const out = new Map<string, { heroId: string | null; slot: string | null }>();
  for (const itemId of assignment.pool) {
    out.set(itemId, { heroId: null, slot: null });
  }
  for (const [heroId, slots] of Object.entries(assignment.slots)) {
    for (const slot of SLOTS) {
      const itemId = slots[slot];
      if (itemId) out.set(itemId, { heroId, slot });
    }
  }
  return out;
}

function heroNameById(contexts: HeroPlanContext[]): Map<string, string> {
  return new Map(contexts.map((ctx) => [ctx.heroId, ctx.name]));
}

function buildMoveList(
  current: AssignmentState,
  plan: AssignmentState,
  itemById: ReadonlyMap<string, InventoryItem>,
  contexts: HeroPlanContext[],
): MoveAction[] {
  const before = itemLocation(current);
  const after = itemLocation(plan);
  const names = heroNameById(contexts);
  const itemIds = new Set([...before.keys(), ...after.keys()]);
  const unequips: MoveAction[] = [];
  const equips: MoveAction[] = [];

  for (const itemId of itemIds) {
    const item = itemById.get(itemId);
    if (!item?.slot) continue;
    const from = before.get(itemId) ?? { heroId: null, slot: null };
    const to = after.get(itemId) ?? { heroId: null, slot: null };
    if (from.heroId === to.heroId && from.slot === to.slot) continue;
    if (from.heroId) {
      unequips.push({
        phase: 'unequip',
        itemId,
        defId: item.defId,
        slot: item.slot,
        fromHeroId: from.heroId,
        toHeroId: null,
      });
    }
    if (to.heroId) {
      equips.push({
        phase: 'equip',
        itemId,
        defId: item.defId,
        slot: item.slot,
        fromHeroId: from.heroId,
        toHeroId: to.heroId,
      });
    }
  }

  const sortMoves = (left: MoveAction, right: MoveAction) => {
    const leftHero = left.fromHeroId ?? left.toHeroId ?? '';
    const rightHero = right.fromHeroId ?? right.toHeroId ?? '';
    const nameDiff = (names.get(leftHero) ?? leftHero).localeCompare(names.get(rightHero) ?? rightHero);
    if (nameDiff !== 0) return nameDiff;
    return SLOTS.indexOf(left.slot) - SLOTS.indexOf(right.slot);
  };

  unequips.sort(sortMoves);
  equips.sort(sortMoves);
  return [...unequips, ...equips];
}

function buildForgeList(
  inventory: InventoryItem[],
  forgeFloor: number,
  rosterHeroIds: ReadonlySet<string>,
): ForgeAction[] {
  if (forgeFloor <= 0) return [];
  const list: ForgeAction[] = [];
  for (const item of inventory) {
    if (!item.defResolved || item.marketBlocked) continue;
    if (item.equippedBy && !rosterHeroIds.has(item.equippedBy)) continue;
    if (item.upgrade >= forgeFloor) continue;
    list.push({ itemId: item.id, defId: item.defId, from: item.upgrade, to: forgeFloor });
  }
  list.sort((a, b) => a.itemId.localeCompare(b.itemId));
  return list;
}

function buildPointResets(
  acceptedHeroIds: string[],
  finalPtsByHeroId: Record<string, PointAlloc>,
  gearStateEval: RosterEvaluation,
  respecStateEval: RosterEvaluation,
  gainByHeroId: Record<string, number>,
  heroLevelById: ReadonlyMap<string, number>,
): WaterfallResult['pointResets'] {
  // A listed reset MAY show a negative gainPct: acceptPointResets accepts against the ROSTER
  // objective, so a hero can be kept even when it personally loses sustained DPS. Do not floor
  // this at 0 and do not filter on it — that filter is what caused the original bug.
  //
  // Emitted in ACCEPTANCE order (acceptedHeroIds, as produced by the greedy loop in
  // acceptPointResets) — NOT sorted by heroId. Acceptance order is a real priority ranking: it
  // lets a player who stops partway through the resets still have taken the best value first.
  return acceptedHeroIds.map((heroId) => {
    const before = gearStateEval.perHero[heroId]?.sustained ?? 0;
    const after = respecStateEval.perHero[heroId]?.sustained ?? 0;
    const gainPct = before > 0 ? (after / before - 1) * 100 : 0;
    const level = heroLevelById.get(heroId) ?? 0;
    return {
      heroId,
      pts: finalPtsByHeroId[heroId] ?? {},
      gainPct,
      rosterGainDps: gainByHeroId[heroId] ?? 0,
      // Confirmed real in-game cost. Ability resets cost the same again, separately, but we never
      // recommend ability resets here. Display-only — never enters the objective or any filter.
      resetCostGold: level * 1000,
    };
  });
}

function buildPerHeroTable(
  contexts: HeroPlanContext[],
  todayEval: ReturnType<typeof evaluateRoster>,
  respecEval: ReturnType<typeof evaluateRoster>,
): WaterfallResult['perHero'] {
  return contexts
    .filter((ctx) => ctx.scope === 'optimize')
    .map((ctx) => {
      const before = todayEval.perHero[ctx.heroId]?.sustained ?? 0;
      const after = respecEval.perHero[ctx.heroId]?.sustained ?? 0;
      return {
        heroId: ctx.heroId,
        heroName: ctx.name,
        level: ctx.level,
        before,
        after,
        delta: after - before,
      };
    })
    .sort((a, b) => a.heroName.localeCompare(b.heroName) || a.heroId.localeCompare(b.heroId));
}

export function buildWaterfall(input: BuildWaterfallInput): WaterfallResult {
  const { gearInput, contexts, currentAssignment, planAssignment, finalPtsByHeroId, itemById } =
    input;
  const pts = currentPtsByHeroId(gearInput);
  const rosterIds = new Set(gearInput.heroes.map((h) => h.heroId));

  const chosen = chooseGearCandidate({
    contexts,
    gearInput,
    itemById,
    baselineAssignment: currentAssignment,
    planAssignment,
    currentPts: pts,
    finalPtsByHeroId,
    rosterHeroIds: rosterIds,
  });
  const { candidate, gearEvaluation, respec, todayEvaluation } = chosen;
  const todayObjective = todayEvaluation.objective;
  const gearObjective = gearEvaluation.objective;

  const steps: WaterfallStep[] = [
    { id: 'today', objective: todayObjective, delta: 0 },
    { id: 'gear', objective: gearObjective, delta: gearObjective - todayObjective },
    { id: 'respec', objective: respec.objective, delta: respec.objective - gearObjective },
  ];

  // Measured along the winning composition — individually these may be negative (disclosure
  // only); the roster-level guarantee lives in `steps`, not in this split. `forgeOnly` and
  // `movesOnly` need no extra evaluation: the whole `gear` step delta IS that one component.
  // Only `forgeMoves` needs one extra evaluation (baseline assignment at the forge floor) to
  // split the joint gear delta into its forge and move parts.
  let forgeDelta = 0;
  let moveDelta = 0;
  if (candidate.key === 'forgeOnly') {
    forgeDelta = gearObjective - todayObjective;
  } else if (candidate.key === 'movesOnly') {
    moveDelta = gearObjective - todayObjective;
  } else if (candidate.key === 'forgeMoves') {
    const baselineAtFloor = evaluateAt(
      contexts,
      currentAssignment,
      pts,
      gearInput,
      itemById,
      gearInput.forgeFloor,
    ).objective;
    forgeDelta = baselineAtFloor - todayObjective;
    moveDelta = gearObjective - baselineAtFloor;
  }

  // Option B: the gear step MAY sit below today — it is transient, climbed back out once the
  // resets land. Disclose it rather than hide it; the final (respec) objective is still
  // guaranteed >= today by `chooseGearCandidate` (the 'none' candidate is always in the running).
  const requiresFullPlan = gearObjective < todayObjective - EPS;
  const gearDipDps = requiresFullPlan ? todayObjective - gearObjective : 0;

  const heroLevelById = new Map(contexts.map((ctx) => [ctx.heroId, ctx.level]));

  return {
    steps,
    forgeList: buildForgeList(gearInput.inventory, candidate.floor, rosterIds),
    moveList: buildMoveList(currentAssignment, candidate.assignment, itemById, contexts),
    pointResets: buildPointResets(
      respec.acceptedHeroIds,
      finalPtsByHeroId,
      gearEvaluation,
      respec.evaluation,
      respec.gainByHeroId,
      heroLevelById,
    ),
    perHero: buildPerHeroTable(contexts, todayEvaluation, respec.evaluation),
    assignment: candidate.assignment,
    ptsByHeroId: respec.ptsByHeroId,
    finalEvaluation: respec.evaluation,
    forgeFloorApplied: candidate.floor,
    gearBreakdown: { forgeDelta, moveDelta },
    requiresFullPlan,
    gearDipDps,
  };
}

/** Test helper — builds the baseline assignment from the live save snapshot. */
export function baselineAssignmentFromInput(
  gearInput: GearPlanInput,
  contexts: HeroPlanContext[],
  pool: import('./types').GearPool,
): AssignmentState {
  return buildInitialAssignment(
    gearInput.inventory,
    pool,
    contexts.filter((ctx) => ctx.scope === 'optimize'),
    gearInput.forgeFloor,
  );
}

/** Synthetic regression case for per-hero negative delta assertions. */
export function syntheticRegressionPerHero(): WaterfallResult['perHero'][number] {
  return {
    heroId: 'synthetic',
    heroName: 'Synthetic',
    level: 50,
    before: 1000,
    after: 900,
    delta: -100,
  };
}

export function finalPtsFromOptimizeBuild(
  contexts: HeroPlanContext[],
  evaluation: ReturnType<typeof evaluateRoster>,
  ptsByHeroId: Record<string, PointAlloc>,
): Record<string, PointAlloc> {
  const out = { ...ptsByHeroId };
  for (const ctx of contexts) {
    if (ctx.scope !== 'optimize') continue;
    const score = evaluation.perHero[ctx.heroId];
    if (!score) continue;
    out[ctx.heroId] = optimizeBuild({
      pts: out[ctx.heroId] ?? ctx.pts,
      effective: score.effective,
      effectiveDelta: score.effectiveDelta,
      context: score.context,
    }).pts;
  }
  return out;
}
