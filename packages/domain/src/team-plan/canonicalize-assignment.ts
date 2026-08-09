/**
 * Re-binds concrete item ids inside an assignment so that interchangeable items stay where they
 * already are.
 *
 * The solver reasons over pool GROUPS (`defId|rarityIdx|level|effectiveUpgrade`, see `pool.ts`) —
 * inside a group every member is an equally good choice, so the search picks one arbitrarily. But
 * `buildMoveList` (`waterfall.ts`) diffs concrete item ids between the baseline and the final
 * assignment, so an arbitrary within-group pick turns into a real "unequip from A, equip on B"
 * chore that changes nothing (observed: two heroes wearing the same `dune_calca` rar3 lv90 +12
 * being told to trade them).
 *
 * Every member of a group shares `defId`/`rarityIdx`/`level`, so `eligibleForHero` is identical
 * across the group — re-binding can never make an assignment illegal — and all members produce
 * identical `EquippedItem` values at the floor they were grouped under, so the roster objective is
 * unchanged by construction. Because they are fully interchangeable, greedily fixing the items
 * that are already in place is optimal for minimising moves; no general matching is needed.
 *
 * Runs only on the FINAL assignment, never inside the search — see `buildWaterfall`.
 */
import { SLOTS } from '../gear/catalog';
import type { InventoryItem } from '../inventory';
import { poolEntryForItem } from './pool';
import { cloneAssignment, type AssignmentState } from './solver-assignment';

type Destination = { heroId: string; slot: string };

type Group = {
  destinations: Destination[];
  itemIds: string[];
};

function groupsByPoolKey(
  planned: AssignmentState,
  itemById: ReadonlyMap<string, InventoryItem>,
  forgeFloor: number,
): Map<string, Group> {
  const groups = new Map<string, Group>();

  const groupFor = (key: string): Group => {
    const existing = groups.get(key);
    if (existing) return existing;
    const created: Group = { destinations: [], itemIds: [] };
    groups.set(key, created);
    return created;
  };

  const keyOf = (itemId: string): string | null => {
    const item = itemById.get(itemId);
    // An item the caller cannot resolve has no key, so it belongs to no group and is left exactly
    // where `planned` put it.
    if (!item) return null;
    return poolEntryForItem(item, forgeFloor).key;
  };

  // Iterated in a fixed order (heroes sorted, then catalog slot order) so the binding below is
  // deterministic for a given input.
  for (const heroId of Object.keys(planned.slots).sort()) {
    const heroSlots = planned.slots[heroId];
    for (const slot of SLOTS) {
      const itemId = heroSlots[slot] ?? null;
      if (!itemId) continue;
      const key = keyOf(itemId);
      if (key === null) continue;
      const group = groupFor(key);
      group.destinations.push({ heroId, slot });
      group.itemIds.push(itemId);
    }
  }

  for (const itemId of [...planned.pool].sort()) {
    const key = keyOf(itemId);
    if (key === null) continue;
    groupFor(key).itemIds.push(itemId);
  }

  return groups;
}

export function canonicalizeAssignment(
  planned: AssignmentState,
  baseline: AssignmentState,
  itemById: ReadonlyMap<string, InventoryItem>,
  forgeFloor: number,
): AssignmentState {
  const next = cloneAssignment(planned);
  const groups = groupsByPoolKey(planned, itemById, forgeFloor);

  for (const group of groups.values()) {
    if (group.destinations.length === 0) continue;

    const unbound = new Set(group.itemIds);
    const bound = new Map<number, string>();

    // Pass 1 — fixed points. An item of this group already sitting at exactly this destination in
    // the baseline stays put, which is what removes the churn.
    group.destinations.forEach((destination, index) => {
      const baselineItemId = baseline.slots[destination.heroId]?.[destination.slot] ?? null;
      if (!baselineItemId || !unbound.has(baselineItemId)) return;
      unbound.delete(baselineItemId);
      bound.set(index, baselineItemId);
    });

    // Pass 2 — remainder. Highest stored `upgrade` first, so items already at or above the forge
    // floor get equipped and the ones that would need forging are the ones left in the pool. This
    // is subordinate to pass 1, not a guarantee: when the baseline occupant of a destination is
    // the lower-upgrade member it stays pinned there and the forge list can end up one longer.
    // Fewer moves is the guarantee; a shorter forge list is the common case, not the invariant.
    // Ties break on item id to keep the result deterministic.
    const remaining = [...unbound].sort((left, right) => {
      const leftUpgrade = itemById.get(left)?.upgrade ?? 0;
      const rightUpgrade = itemById.get(right)?.upgrade ?? 0;
      if (leftUpgrade !== rightUpgrade) return rightUpgrade - leftUpgrade;
      return left.localeCompare(right);
    });

    let cursor = 0;
    group.destinations.forEach((_destination, index) => {
      if (bound.has(index)) return;
      const itemId = remaining[cursor];
      // `planned` equips one distinct item per destination, so the group always holds at least as
      // many items as it has destinations — this guard is belt-and-braces only.
      if (itemId === undefined) return;
      cursor++;
      unbound.delete(itemId);
      bound.set(index, itemId);
    });

    group.destinations.forEach((destination, index) => {
      next.slots[destination.heroId][destination.slot] = bound.get(index) ?? null;
    });

    // Whatever the group could not place goes back to the shared pool.
    for (const itemId of group.itemIds) {
      if (unbound.has(itemId)) next.pool.add(itemId);
      else next.pool.delete(itemId);
    }
  }

  return next;
}
