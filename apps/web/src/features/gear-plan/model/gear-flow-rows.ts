import { SLOTS } from '@bombfarm/domain/gear';
import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import type { InventoryItem } from '@bombfarm/domain/inventory';

/** One item's full journey: where it sits today, what forging happens, where it ends up. */
export type GearFlowRow = {
  itemId: string;
  defId: string;
  slot: string | null;
  rarityIdx: number;
  level: number;
  /** The item's current stored forge level (pre-plan). */
  upgrade: number;
  forge: { from: number; to: number } | null;
  /** `null` means the item starts in the shared inventory pool. */
  originHeroId: string | null;
  /** `null` means the item ends up back in the shared inventory pool. */
  destHeroId: string | null;
};

export type GearFlowGroup = {
  /** `null` is the "returns to inventory" bucket. */
  heroId: string | null;
  rows: GearFlowRow[];
};

/** Merges `forgeList` and `moveList` into one row per item — the union of both plans (RGO). */
export function buildGearFlowRows(plan: GearPlan, inventory: InventoryItem[]): GearFlowRow[] {
  const itemById = new Map(inventory.map((item) => [item.id, item]));
  const forgeByItemId = new Map(plan.forgeList.map((row) => [row.itemId, row]));
  const unequipByItemId = new Map(
    plan.moveList.filter((row) => row.phase === 'unequip').map((row) => [row.itemId, row]),
  );
  const equipByItemId = new Map(
    plan.moveList.filter((row) => row.phase === 'equip').map((row) => [row.itemId, row]),
  );

  const itemIds = new Set<string>([
    ...plan.forgeList.map((row) => row.itemId),
    ...plan.moveList.map((row) => row.itemId),
  ]);

  const rows: GearFlowRow[] = [];
  for (const itemId of itemIds) {
    const forgeAction = forgeByItemId.get(itemId);
    const unequip = unequipByItemId.get(itemId);
    const equip = equipByItemId.get(itemId);
    const item = itemById.get(itemId);

    // An `equip` entry carries both ends of the move — prefer it. A lone `unequip` means the
    // item lands back in the pool (no equip entry was generated for it). Neither present means
    // the item isn't moving at all — only its forge level changes.
    let originHeroId: string | null;
    let destHeroId: string | null;
    let slot: string | null;
    let defId: string;
    if (equip) {
      originHeroId = equip.fromHeroId;
      destHeroId = equip.toHeroId;
      slot = equip.slot;
      defId = equip.defId;
    } else if (unequip) {
      originHeroId = unequip.fromHeroId;
      destHeroId = null;
      slot = unequip.slot;
      defId = unequip.defId;
    } else {
      originHeroId = item?.equippedBy ?? null;
      destHeroId = item?.equippedBy ?? null;
      slot = item?.slot ?? null;
      defId = item?.defId ?? forgeAction?.defId ?? '';
    }

    rows.push({
      itemId,
      defId,
      slot,
      rarityIdx: item?.rarityIdx ?? 0,
      level: item?.level ?? 10,
      upgrade: item?.upgrade ?? 0,
      forge: forgeAction ? { from: forgeAction.from, to: forgeAction.to } : null,
      originHeroId,
      destHeroId,
    });
  }
  return rows;
}

function slotRank(slot: string | null): number {
  const slotIndex = slot ? SLOTS.indexOf(slot) : -1;
  return slotIndex >= 0 ? slotIndex : SLOTS.length;
}

function sortRows(left: GearFlowRow, right: GearFlowRow): number {
  const slotDiff = slotRank(left.slot) - slotRank(right.slot);
  if (slotDiff !== 0) return slotDiff;
  return left.itemId.localeCompare(right.itemId);
}

/**
 * Groups rows by the hero who ends up with the item — `heroOrder` should be `plan.perHero`'s
 * heroIds so groups read in the same order as the rest of the results. Items with no destination
 * hero (returned to the pool) land in a trailing `heroId: null` group.
 */
export function groupGearFlowRows(rows: GearFlowRow[], heroOrder: string[]): GearFlowGroup[] {
  const byHero = new Map<string, GearFlowRow[]>();
  const toInventory: GearFlowRow[] = [];
  for (const row of rows) {
    if (row.destHeroId) {
      const list = byHero.get(row.destHeroId);
      if (list) list.push(row);
      else byHero.set(row.destHeroId, [row]);
    } else {
      toInventory.push(row);
    }
  }

  const groups: GearFlowGroup[] = [];
  for (const heroId of heroOrder) {
    const heroRows = byHero.get(heroId);
    if (!heroRows || heroRows.length === 0) continue;
    groups.push({ heroId, rows: [...heroRows].sort(sortRows) });
    byHero.delete(heroId);
  }
  // Any destination hero missing from heroOrder still gets shown — belt and suspenders.
  for (const [heroId, heroRows] of byHero) {
    groups.push({ heroId, rows: [...heroRows].sort(sortRows) });
  }
  if (toInventory.length > 0) {
    groups.push({ heroId: null, rows: [...toInventory].sort(sortRows) });
  }
  return groups;
}
