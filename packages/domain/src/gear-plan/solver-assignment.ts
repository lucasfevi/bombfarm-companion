import { SLOTS } from '../gear/catalog';
import type { EquippedItem, Loadout } from '../gear/types';
import type { InventoryItem } from '../inventory';
import { eligibleForHero, effectiveUpgrade } from './pool';
import type { GearPool, HeroPlanContext, PoolEntry } from './types';

export type AssignmentState = {
  /** optimize-hero slot → equipped item id (or empty). */
  slots: Record<string, Record<string, string | null>>;
  /** spare / donate-sourced item ids available to equip. */
  pool: Set<string>;
};

export type GearMove =
  | { kind: 'assign'; itemId: string; heroId: string; slot: string }
  | { kind: 'swap'; heroA: string; heroB: string; slot: string; itemA: string; itemB: string }
  | { kind: 'unassign'; itemId: string; heroId: string; slot: string };

function poolEntryForItem(item: InventoryItem, forgeFloor: number): PoolEntry {
  const eff = effectiveUpgrade(item.upgrade, forgeFloor);
  return {
    key: `${item.defId}|${item.rarityIdx}|${item.level}|${eff}`,
    defId: item.defId,
    rarityIdx: item.rarityIdx,
    level: item.level,
    upgrade: item.upgrade,
    effectiveUpgrade: eff,
    slot: item.slot ?? '',
    count: 1,
    itemIds: [item.id],
  };
}

export function itemToEquipped(item: InventoryItem): EquippedItem {
  return {
    defId: item.defId,
    rarityIdx: item.rarityIdx,
    level: item.level,
    upgrade: item.upgrade,
  };
}

export function loadoutsFromAssignment(
  state: AssignmentState,
  itemById: ReadonlyMap<string, InventoryItem>,
): Record<string, Loadout> {
  const out: Record<string, Loadout> = {};
  for (const [heroId, heroSlots] of Object.entries(state.slots)) {
    const loadout: Loadout = {};
    for (const slot of SLOTS) {
      const itemId = heroSlots[slot] ?? null;
      if (!itemId) {
        loadout[slot] = null;
        continue;
      }
      const item = itemById.get(itemId);
      loadout[slot] = item ? itemToEquipped(item) : null;
    }
    out[heroId] = loadout;
  }
  return out;
}

export function cloneAssignment(state: AssignmentState): AssignmentState {
  const slots: AssignmentState['slots'] = {};
  for (const [heroId, heroSlots] of Object.entries(state.slots)) {
    slots[heroId] = { ...heroSlots };
  }
  return { slots, pool: new Set(state.pool) };
}

export function applyMove(state: AssignmentState, move: GearMove): AssignmentState {
  const next = cloneAssignment(state);
  if (move.kind === 'assign') {
    const displaced = next.slots[move.heroId]?.[move.slot] ?? null;
    next.pool.delete(move.itemId);
    if (displaced) next.pool.add(displaced);
    next.slots[move.heroId]![move.slot] = move.itemId;
    return next;
  }
  if (move.kind === 'unassign') {
    next.slots[move.heroId]![move.slot] = null;
    next.pool.add(move.itemId);
    return next;
  }
  next.slots[move.heroA]![move.slot] = move.itemB;
  next.slots[move.heroB]![move.slot] = move.itemA;
  return next;
}

export function buildInitialAssignment(
  inventory: InventoryItem[],
  pool: GearPool,
  optimizeContexts: HeroPlanContext[],
  forgeFloor: number,
): AssignmentState {
  const itemById = new Map(inventory.map((item) => [item.id, item]));
  const poolItemIds = new Set(pool.entries.flatMap((entry) => entry.itemIds));
  const optimizeIds = new Set(optimizeContexts.map((ctx) => ctx.heroId));

  const slots: AssignmentState['slots'] = {};
  for (const ctx of optimizeContexts) {
    slots[ctx.heroId] = Object.fromEntries(SLOTS.map((slot) => [slot, null])) as Record<
      string,
      string | null
    >;
  }

  const spare = new Set<string>();

  for (const itemId of poolItemIds) {
    const item = itemById.get(itemId);
    if (!item?.slot) {
      spare.add(itemId);
      continue;
    }
    const owner = item.equippedBy;
    if (owner && optimizeIds.has(owner)) {
      const ctx = optimizeContexts.find((c) => c.heroId === owner);
      if (!ctx) {
        spare.add(itemId);
        continue;
      }
      const entry = poolEntryForItem(item, forgeFloor);
      if (!eligibleForHero(entry, ctx, item.slot)) {
        spare.add(itemId);
        continue;
      }
      const current = slots[owner]![item.slot];
      if (!current) {
        slots[owner]![item.slot] = itemId;
      } else {
        spare.add(itemId);
      }
    } else {
      spare.add(itemId);
    }
  }

  return { slots, pool: spare };
}
