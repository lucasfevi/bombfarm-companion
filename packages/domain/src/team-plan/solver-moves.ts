import { SLOTS } from '../gear/catalog';
import type { InventoryItem } from '../inventory';
import { eligibleForHero, poolEntryForItem } from './pool';
import type { GearMove } from './solver-assignment';
import type { HeroPlanContext } from './types';

export type GenerateMovesInput = {
  contexts: HeroPlanContext[];
  slots: AssignmentSlots;
  pool: ReadonlySet<string>;
  itemById: ReadonlyMap<string, InventoryItem>;
  heroDpsById: Readonly<Record<string, number>>;
  forgeFloor: number;
};

export type AssignmentSlots = Record<string, Record<string, string | null>>;

function slotIndex(slot: string): number {
  const index = SLOTS.indexOf(slot);
  return index >= 0 ? index : SLOTS.length;
}

type MoveSortKey = [number, string, number, string];

function sortKey(
  heroId: string,
  slot: string,
  itemId: string,
  heroDpsById: Readonly<Record<string, number>>,
): MoveSortKey {
  const dps = heroDpsById[heroId] ?? 0;
  return [-dps, heroId, slotIndex(slot), itemId];
}

function compareKeys(a: MoveSortKey, b: MoveSortKey): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function optimizeContexts(contexts: HeroPlanContext[]): HeroPlanContext[] {
  return contexts.filter((ctx) => ctx.scope === 'optimize');
}

/**
 * Three move families in deterministic order (RGO-11, AD-RGO-02):
 * assign spare → slot, swap same slot between two heroes, unassign to pool.
 */
export function generateMoves(input: GenerateMovesInput): GearMove[] {
  const heroes = optimizeContexts(input.contexts);
  const heroOrder = [...heroes].sort((a, b) => {
    const dpsDiff = (input.heroDpsById[b.heroId] ?? 0) - (input.heroDpsById[a.heroId] ?? 0);
    if (dpsDiff !== 0) return dpsDiff;
    return a.heroId.localeCompare(b.heroId);
  });

  const moves: { move: GearMove; key: MoveSortKey }[] = [];

  for (const ctx of heroOrder) {
    for (const slot of SLOTS) {
      const poolIds = [...input.pool].sort();
      for (const itemId of poolIds) {
        const item = input.itemById.get(itemId);
        if (!item?.slot) continue;
        const entry = poolEntryForItem(item, input.forgeFloor);
        if (!eligibleForHero(entry, ctx, slot)) continue;
        moves.push({
          move: { kind: 'assign', itemId, heroId: ctx.heroId, slot },
          key: sortKey(ctx.heroId, slot, itemId, input.heroDpsById),
        });
      }
    }
  }

  for (let i = 0; i < heroOrder.length; i++) {
    for (let j = i + 1; j < heroOrder.length; j++) {
      const heroA = heroOrder[i];
      const heroB = heroOrder[j];
      const slotsA = input.slots[heroA.heroId] ?? {};
      const slotsB = input.slots[heroB.heroId] ?? {};
      for (const slot of SLOTS) {
        const itemA = slotsA[slot];
        const itemB = slotsB[slot];
        if (!itemA || !itemB || itemA === itemB) continue;
        const objA = input.itemById.get(itemA);
        const objB = input.itemById.get(itemB);
        if (!objA || !objB) continue;
        // Swapping crosses ownership — recheck level eligibility for each item on its NEW hero,
        // not just its current one (an item eligible for its owner can be over-level for the peer).
        if (!eligibleForHero(poolEntryForItem(objA, input.forgeFloor), heroB, slot)) continue;
        if (!eligibleForHero(poolEntryForItem(objB, input.forgeFloor), heroA, slot)) continue;
        const primary = heroA;
        moves.push({
          move: { kind: 'swap', heroA: heroA.heroId, heroB: heroB.heroId, slot, itemA, itemB },
          key: sortKey(primary.heroId, slot, itemA, input.heroDpsById),
        });
      }
    }
  }

  for (const ctx of heroOrder) {
    const heroSlots = input.slots[ctx.heroId] ?? {};
    for (const slot of SLOTS) {
      const itemId = heroSlots[slot];
      if (!itemId) continue;
      moves.push({
        move: { kind: 'unassign', itemId, heroId: ctx.heroId, slot },
        key: sortKey(ctx.heroId, slot, itemId, input.heroDpsById),
      });
    }
  }

  moves.sort((left, right) => compareKeys(left.key, right.key));
  return moves.map((entry) => entry.move);
}
