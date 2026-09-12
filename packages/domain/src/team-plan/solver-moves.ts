import { SLOTS } from '../gear/catalog';
import type { InventoryItem } from '../inventory';
import { dominates, statsForEntry, statSignature } from './dominance';
import { eligibleForHero, poolEntryForItem } from './pool';
import type { GearMove } from './solver-assignment';
import type { HeroPlanContext, PoolEntry } from './types';

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

type PoolCandidate = { itemId: string; entry: PoolEntry; stats: ReadonlyMap<string, number> };

/**
 * Three move families in deterministic order:
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

  // Hoisted: this was rebuilt and re-sorted inside the slot loop, i.e. heroes x SLOTS times per
  // call (120 on a 15-hero roster) over a ~300-item pool, for a list that never varies.
  const poolIds = [...input.pool].sort();
  // One representative per interchangeable group. Two entries are interchangeable when they roll
  // the same numbers at the same item level: `loadoutForScoring` clamps upgrade to exactly the
  // effective value `statsForEntry` reads, so identical stat vectors yield an identical roster
  // objective, and evaluating the rest is pure duplicated work. Level joins the signature because
  // stats alone do not decide `eligibleForHero` — two entries that roll alike from different
  // levels are NOT interchangeable to a hero who can equip only the lower one. Deterministic
  // because `poolIds` is sorted, so the surviving representative is always the lowest id.
  const bySignature = new Map<string, PoolCandidate>();
  for (const itemId of poolIds) {
    const item = input.itemById.get(itemId);
    if (!item?.slot) continue;
    const entry = poolEntryForItem(item, input.forgeFloor);
    const stats = statsForEntry(entry);
    const signature = `${entry.slot}|${entry.level}|${statSignature(stats)}`;
    if (!bySignature.has(signature)) bySignature.set(signature, { itemId, entry, stats });
  }

  /**
   * Dominance pruning, on top of the dedup above: an entry another entry beats outright can never
   * win, so it costs an evaluation for nothing. See `dominance.ts` for why the comparison crosses
   * sets and why it is read off the catalog.
   *
   * PRUNED PER HERO LEVEL, NOT ONCE. A dominator sits at a level at or above what it dominates,
   * so a hero who can equip the dominator can always equip the dominated — but the reverse fails,
   * and pruning globally would discard the only piece an under-levelled hero can wear. Survivors
   * are therefore computed against the entries that hero could equip, memoised per (slot, level)
   * because a roster holds far fewer distinct levels than heroes.
   */
  const candidatesBySlot = new Map<string, PoolCandidate[]>();
  for (const candidate of bySignature.values()) {
    const bucket = candidatesBySlot.get(candidate.entry.slot);
    if (bucket) bucket.push(candidate);
    else candidatesBySlot.set(candidate.entry.slot, [candidate]);
  }

  const survivorsCache = new Map<string, PoolCandidate[]>();
  const survivorsFor = (slot: string, heroLevel: number): PoolCandidate[] => {
    const cacheKey = `${slot}|${heroLevel}`;
    const cached = survivorsCache.get(cacheKey);
    if (cached) return cached;
    const equippable = (candidatesBySlot.get(slot) ?? []).filter((c) => c.entry.level <= heroLevel);
    const survivors = equippable.filter(
      (candidate) =>
        !equippable.some((other) => other !== candidate && dominates(other.stats, candidate.stats)),
    );
    survivorsCache.set(cacheKey, survivors);
    return survivors;
  };

  for (const ctx of heroOrder) {
    for (const slot of SLOTS) {
      for (const { itemId, entry } of survivorsFor(slot, ctx.level)) {
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
