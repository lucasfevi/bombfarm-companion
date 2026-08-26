import { SLOTS } from '../gear/catalog';
import type { InventoryItem } from '../inventory';
import { eligibleForHero, poolEntryForItem } from './pool';
import { cloneAssignment, type AssignmentState } from './solver-assignment';
import type { HeroPlanContext } from './types';

/**
 * Why this pass exists at all.
 *
 * The saturated roster objective is `slots * sum(duty_i * active_i) / sum(duty_i)` — a
 * duty-weighted MEAN, so its gradient in one hero's duty is proportional to
 * `active_i - meanActive`. For any hero below the roster's mean active DPS, anything that
 * buys uptime without buying enough damage scores NEGATIVE, and the search is rewarded for
 * taking gear off and putting it nowhere. Measured on a real 15-hero save: handing two
 * bare-legged heroes a spare pair of trousers raised total sustained DPS by 1,952 while the
 * objective FELL by 885, and the unconstrained plan emptied six slots into the bag.
 *
 * Trousers and chest pieces take the brunt of it because of where damage sits in each slot's
 * stat order — a `calca` only rolls `dmg` at Lendária and a `peito` only at Mítico, so at
 * ordinary rarities both are pure uptime (energy / speed / cooldown) with no attack at all.
 *
 * The objective's shape is a modelling question that is deliberately NOT settled here. What is
 * settled is the advice: a plan never tells a player to strip a hero and bank the item, because
 * in the game an equipped item is never worse than an empty slot. This pass enforces that as a
 * post-condition on every candidate assignment — no eligible spare may sit in the bag while a
 * hero has that slot bare — and the dilution the player is living with is surfaced instead, via
 * `TeamPlan.disclosures.fieldContention`.
 */

/**
 * Ranking key for "which spare goes in this bare slot", most significant first.
 *
 * Deliberately structural rather than scored. Within one slot a higher `level` def has strictly
 * larger values for every stat it rolls, and a higher `rarityIdx` strictly adds stats on top of
 * the ones below it — so both are real, explainable improvements. Sets differ in WHICH stats
 * they roll, so two same-level defs from different sets are genuinely incomparable here; the
 * incumbent-then-lowest-id rule below breaks that tie deterministically rather than pretending
 * a scalar ordering exists.
 *
 * Scoring each candidate on the hero instead would be circular: the objective that mis-ranks
 * these items is the reason this pass runs.
 */
function rankKey(item: InventoryItem, forgeFloor: number): [number, number, number] {
  const entry = poolEntryForItem(item, forgeFloor);
  return [entry.level, entry.rarityIdx, entry.effectiveUpgrade];
}

function outranks(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export type FillBareSlotsInput = {
  assignment: AssignmentState;
  contexts: HeroPlanContext[];
  itemById: ReadonlyMap<string, InventoryItem>;
  forgeFloor: number;
  /**
   * The player's current assignment. An item already sitting in a hero's slot today wins every
   * tie, so a candidate that merely shuffles interchangeable copies around never reaches the
   * move list as a pointless unequip/equip pair.
   */
  baseline: AssignmentState;
  /**
   * Optimize heroes in the order they may pick, strongest first. Filling is greedy and the pool
   * is finite, so the order decides who gets the better spare; the caller passes descending
   * baseline DPS, matching `generateMoves`' own hero ordering.
   */
  heroOrder: readonly string[];
};

/**
 * Hands every bare slot on an optimize hero the best spare it can legally wear, until no
 * eligible spare is left in the bag. Pure: returns a new assignment, never mutates the input.
 */
export function fillBareSlots(input: FillBareSlotsInput): AssignmentState {
  const { assignment, contexts, itemById, forgeFloor, baseline, heroOrder } = input;
  const next = cloneAssignment(assignment);
  const ctxById = new Map(contexts.map((ctx) => [ctx.heroId, ctx]));

  const bySlot = new Map<string, string[]>();
  for (const itemId of [...next.pool].sort()) {
    const item = itemById.get(itemId);
    if (!item?.slot) continue;
    const bucket = bySlot.get(item.slot);
    if (bucket) bucket.push(itemId);
    else bySlot.set(item.slot, [itemId]);
  }

  for (const heroId of heroOrder) {
    const ctx = ctxById.get(heroId);
    if (!ctx || ctx.scope !== 'optimize') continue;
    const heroSlots = next.slots[heroId];
    if (!heroSlots) continue;

    for (const slot of SLOTS) {
      if (heroSlots[slot]) continue;
      const bucket = bySlot.get(slot);
      if (!bucket || bucket.length === 0) continue;

      const incumbent = baseline.slots[heroId]?.[slot] ?? null;
      let chosenIdx = -1;
      let chosenKey: [number, number, number] | null = null;
      for (let i = 0; i < bucket.length; i++) {
        const item = itemById.get(bucket[i]);
        if (!item) continue;
        if (!eligibleForHero(poolEntryForItem(item, forgeFloor), ctx, slot)) continue;
        const key = rankKey(item, forgeFloor);
        if (chosenKey === null) {
          chosenIdx = i;
          chosenKey = key;
          continue;
        }
        if (outranks(key, chosenKey)) {
          chosenIdx = i;
          chosenKey = key;
          continue;
        }
        // Equal rank: the item the hero is already wearing today wins, so the plan does not
        // emit a churn move between two interchangeable copies.
        if (!outranks(chosenKey, key) && bucket[i] === incumbent) {
          chosenIdx = i;
          chosenKey = key;
        }
      }
      if (chosenIdx < 0) continue;

      const [chosen] = bucket.splice(chosenIdx, 1);
      heroSlots[slot] = chosen;
      next.pool.delete(chosen);
    }
  }

  return next;
}

/**
 * Post-condition of {@link fillBareSlots}, asserted by its tests and cheap enough to call
 * anywhere: no optimize hero has a bare slot that some item still in the bag could fill.
 */
export function hasFillableBareSlot(
  assignment: AssignmentState,
  contexts: HeroPlanContext[],
  itemById: ReadonlyMap<string, InventoryItem>,
  forgeFloor: number,
): boolean {
  for (const ctx of contexts) {
    if (ctx.scope !== 'optimize') continue;
    const heroSlots = assignment.slots[ctx.heroId];
    if (!heroSlots) continue;
    for (const slot of SLOTS) {
      if (heroSlots[slot]) continue;
      for (const itemId of assignment.pool) {
        const item = itemById.get(itemId);
        if (!item?.slot) continue;
        if (eligibleForHero(poolEntryForItem(item, forgeFloor), ctx, slot)) return true;
      }
    }
  }
  return false;
}
