import { scaledValores, SLOTS } from '../gear/catalog';
import type { InventoryItem } from '../inventory';
import { eligibleForHero, poolEntryForItem } from './pool';
import {
  applyMove,
  cloneAssignment,
  type AssignmentState,
} from './solver-assignment';
import type { TeamPlanInput, HeroPlanContext, RosterEvaluation } from './types';

function itemValue(item: InventoryItem): number {
  return scaledValores(item.defId, item.rarityIdx, item.level, item.upgrade)
    .filter((roll) => roll.stat === 'dmg')
    .reduce((sum, roll) => sum + roll.valor, 0);
}

function greedyByHeroDpsSeed(
  base: AssignmentState,
  contexts: HeroPlanContext[],
  input: TeamPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  evaluation: RosterEvaluation,
): AssignmentState {
  const optimize = contexts.filter((c) => c.scope === 'optimize');
  const order = [...optimize].sort((a, b) => {
    const dpsDiff = (evaluation.perHero[b.heroId]?.sustained ?? 0) - (evaluation.perHero[a.heroId]?.sustained ?? 0);
    if (dpsDiff !== 0) return dpsDiff;
    return a.heroId.localeCompare(b.heroId);
  });
  let state = cloneAssignment(base);
  const available = new Set(state.pool);
  for (const ctx of order) {
    for (const slot of SLOTS) {
      const candidates = [...available]
        .map((id) => itemById.get(id))
        .filter((item): item is InventoryItem => Boolean(item?.slot))
        .filter((item) => eligibleForHero(poolEntryForItem(item, input.forgeFloor), ctx, slot))
        .sort((a, b) => {
          const diff = itemValue(b) - itemValue(a);
          if (diff !== 0) return diff;
          return a.id.localeCompare(b.id);
        });
      const best = candidates[0];
      if (!best) continue;
      state = applyMove(state, { kind: 'assign', itemId: best.id, heroId: ctx.heroId, slot });
      available.delete(best.id);
      if (state.slots[ctx.heroId]?.[slot]) {
        for (const id of [...state.pool]) {
          if (id !== best.id) available.add(id);
        }
      }
    }
  }
  return state;
}

function greedyBySlotValueSeed(
  base: AssignmentState,
  contexts: HeroPlanContext[],
  input: TeamPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  evaluation: RosterEvaluation,
): AssignmentState {
  const optimize = contexts.filter((c) => c.scope === 'optimize');
  const heroOrder = [...optimize].sort((a, b) => {
    const dpsDiff = (evaluation.perHero[b.heroId]?.sustained ?? 0) - (evaluation.perHero[a.heroId]?.sustained ?? 0);
    if (dpsDiff !== 0) return dpsDiff;
    return a.heroId.localeCompare(b.heroId);
  });
  let state = cloneAssignment(base);
  for (const slot of SLOTS) {
    for (const ctx of heroOrder) {
      const candidates = [...state.pool]
        .map((id) => itemById.get(id))
        .filter((item): item is InventoryItem => Boolean(item?.slot === slot))
        .filter((item) => eligibleForHero(poolEntryForItem(item, input.forgeFloor), ctx, slot))
        .sort((a, b) => {
          const diff = itemValue(b) - itemValue(a);
          if (diff !== 0) return diff;
          return a.id.localeCompare(b.id);
        });
      const best = candidates[0];
      if (!best) continue;
      state = applyMove(state, { kind: 'assign', itemId: best.id, heroId: ctx.heroId, slot });
    }
  }
  return state;
}

function bestItemFirstSeed(
  base: AssignmentState,
  contexts: HeroPlanContext[],
  input: TeamPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  evaluation: RosterEvaluation,
): AssignmentState {
  const optimize = contexts.filter((c) => c.scope === 'optimize');
  const heroOrder = [...optimize].sort((a, b) => {
    const dpsDiff = (evaluation.perHero[b.heroId]?.sustained ?? 0) - (evaluation.perHero[a.heroId]?.sustained ?? 0);
    if (dpsDiff !== 0) return dpsDiff;
    return a.heroId.localeCompare(b.heroId);
  });
  let state = cloneAssignment(base);
  const items = [...state.pool]
    .map((id) => itemById.get(id))
    .filter((item): item is InventoryItem => Boolean(item?.slot))
    .sort((a, b) => {
      const diff = itemValue(b) - itemValue(a);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
  // One placement per hero and slot. `items` is a snapshot taken best-first, so a hero whose slot
  // could be filled twice keeps whichever item came LAST — the weakest — and every better one it
  // displaced sits back in the pool behind the iteration, unreachable. That inverts the seed this
  // function exists to offer, which is the best items on the strongest heroes that can wear them.
  //
  // The snapshot still makes this seed differ from `greedyBySlotValueSeed`, which re-reads the pool
  // per hero and slot: an item displaced here returns to the bag and is not reconsidered. That is
  // what keeps the two starting points distinct, and the climb can recover the difference.
  const filled = new Set<string>();
  for (const item of items) {
    if (!state.pool.has(item.id) || !item.slot) continue;
    let bestHero: HeroPlanContext | null = null;
    for (const ctx of heroOrder) {
      if (filled.has(`${ctx.heroId}\u0000${item.slot}`)) continue;
      if (!eligibleForHero(poolEntryForItem(item, input.forgeFloor), ctx, item.slot)) continue;
      bestHero = ctx;
      break;
    }
    if (!bestHero) continue;
    state = applyMove(state, {
      kind: 'assign',
      itemId: item.id,
      heroId: bestHero.heroId,
      slot: item.slot,
    });
    filled.add(`${bestHero.heroId}\u0000${item.slot}`);
  }
  return state;
}

export function buildSeedAssignments(
  base: AssignmentState,
  contexts: HeroPlanContext[],
  input: TeamPlanInput,
  itemById: ReadonlyMap<string, InventoryItem>,
  currentEval: RosterEvaluation,
): { name: string; assignment: AssignmentState }[] {
  return [
    { name: 'current', assignment: cloneAssignment(base) },
    {
      name: 'greedyHeroDps',
      assignment: greedyByHeroDpsSeed(base, contexts, input, itemById, currentEval),
    },
    {
      name: 'greedySlotValue',
      assignment: greedyBySlotValueSeed(base, contexts, input, itemById, currentEval),
    },
    {
      name: 'bestItemFirst',
      assignment: bestItemFirstSeed(base, contexts, input, itemById, currentEval),
    },
  ];
}
