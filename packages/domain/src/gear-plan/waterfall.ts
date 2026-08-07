import { SLOTS } from '../gear/catalog';
import type { PointAlloc } from '../gear/types';
import type { InventoryItem } from '../inventory';
import { evaluateRoster } from './evaluate';
import { optimizeBuild } from '../points-reopt';
import {
  buildInitialAssignment,
  loadoutsFromAssignment,
  type AssignmentState,
} from './solver-assignment';
import type {
  EvaluateRosterInput,
  FarmContext,
  ForgeAction,
  GearPlanInput,
  HeroPlanContext,
  MoveAction,
  WaterfallStep,
} from './types';

export type WaterfallResult = {
  steps: WaterfallStep[];
  forgeList: ForgeAction[];
  moveList: MoveAction[];
  pointResets: { heroId: string; pts: Record<string, number>; gainPct: number }[];
  perHero: {
    heroId: string;
    heroName: string;
    level: number;
    before: number;
    after: number;
    delta: number;
  }[];
};

export type BuildWaterfallInput = {
  gearInput: GearPlanInput;
  contexts: HeroPlanContext[];
  currentAssignment: AssignmentState;
  planAssignment: AssignmentState;
  finalPtsByHeroId: Record<string, PointAlloc>;
  itemById: ReadonlyMap<string, InventoryItem>;
  currentDps: number;
  planDps: number;
};

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

function evaluateAt(
  contexts: HeroPlanContext[],
  assignment: AssignmentState,
  ptsByHeroId: Record<string, PointAlloc>,
  gearInput: GearPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  forgeFloor: number,
) {
  const evalInput: EvaluateRosterInput = {
    contexts,
    loadoutsByHeroId: loadoutsFromAssignment(assignment, itemById),
    ptsByHeroId,
    slots: gearInput.account.slots,
    farm: farmFromAccount(gearInput),
    forgeFloor,
  };
  return evaluateRoster(evalInput);
}

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
  contexts: HeroPlanContext[],
  finalPtsByHeroId: Record<string, PointAlloc>,
  movedEval: ReturnType<typeof evaluateRoster>,
  respecEval: ReturnType<typeof evaluateRoster>,
  currentPtsByHero: Record<string, PointAlloc>,
): WaterfallResult['pointResets'] {
  const out: WaterfallResult['pointResets'] = [];
  for (const ctx of contexts) {
    if (ctx.scope !== 'optimize') continue;
    const finalPts = finalPtsByHeroId[ctx.heroId] ?? ctx.pts;
    const currentPts = currentPtsByHero[ctx.heroId] ?? ctx.pts;
    const changed = (Object.keys(finalPts) as (keyof PointAlloc)[]).some(
      (key) => finalPts[key] !== currentPts[key],
    );
    if (!changed) continue;
    const before = movedEval.perHero[ctx.heroId]?.sustained ?? 0;
    const after = respecEval.perHero[ctx.heroId]?.sustained ?? 0;
    // Never recommend a reset that does not improve this hero on the plan gear.
    if (after <= before + 1e-9) continue;
    const gainPct = before > 0 ? (after / before - 1) * 100 : 0;
    out.push({ heroId: ctx.heroId, pts: finalPts, gainPct });
  }
  out.sort((a, b) => a.heroId.localeCompare(b.heroId));
  return out;
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

  const todayEval = evaluateAt(contexts, currentAssignment, pts, gearInput, itemById, 0);
  const forgedEval = evaluateAt(contexts, currentAssignment, pts, gearInput, itemById, gearInput.forgeFloor);
  const movedEval = evaluateAt(contexts, planAssignment, pts, gearInput, itemById, gearInput.forgeFloor);
  const respecEval = evaluateAt(
    contexts,
    planAssignment,
    finalPtsByHeroId,
    gearInput,
    itemById,
    gearInput.forgeFloor,
  );

  const steps: WaterfallStep[] = [
    { id: 'today', objective: todayEval.objective, delta: 0 },
    { id: 'forged', objective: forgedEval.objective, delta: forgedEval.objective - todayEval.objective },
    { id: 'moved', objective: movedEval.objective, delta: movedEval.objective - forgedEval.objective },
    { id: 'respec', objective: respecEval.objective, delta: respecEval.objective - movedEval.objective },
  ];

  return {
    steps,
    forgeList: buildForgeList(gearInput.inventory, gearInput.forgeFloor, rosterIds),
    moveList: buildMoveList(currentAssignment, planAssignment, itemById, contexts),
    pointResets: buildPointResets(contexts, finalPtsByHeroId, movedEval, respecEval, pts),
    perHero: buildPerHeroTable(contexts, todayEval, respecEval),
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
