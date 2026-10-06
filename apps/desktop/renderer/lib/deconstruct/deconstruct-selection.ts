import { deconstructBlockReason, deconstructFillCandidates } from '@bombfarm/domain/deconstruct';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';

export type DeconstructToggle = {
  readonly ids: readonly string[];
  /** The id was not added because the batch is already at the cap. */
  readonly refused: boolean;
};

export function toggleDeconstructSelection(ids: readonly string[], itemId: string, cap: number): DeconstructToggle {
  if (ids.includes(itemId)) return { ids: ids.filter((id) => id !== itemId), refused: false };
  if (ids.length >= cap) return { ids, refused: true };
  return { ids: [...ids, itemId], refused: false };
}

export type DeconstructBulkChange = {
  readonly ids: readonly string[];
  readonly added: number;
  /** Rows that qualified and did not fit under the cap. */
  readonly overflow: number;
};

/** `shown` is the rows as the table lists them, so what the reader sees from the top is taken first. */
export function selectShownDeconstruct(
  shown: readonly InventoryViewItem[],
  ids: readonly string[],
  cap: number,
): DeconstructBulkChange {
  const taken = new Set(ids);
  const eligible = shown.filter((item) => !taken.has(item.id) && deconstructBlockReason(item) === null);
  const room = Math.max(0, cap - ids.length);
  const picked = eligible.slice(0, room).map((item) => item.id);
  return {
    ids: picked.length === 0 ? ids : [...ids, ...picked],
    added: picked.length,
    overflow: eligible.length - picked.length,
  };
}

/** How many shown rows could be burned, and how many of those the batch does not hold yet. */
export function shownAddable(
  shown: readonly InventoryViewItem[],
  ids: readonly string[],
): { readonly burnable: number; readonly addable: number } {
  const taken = new Set(ids);
  const burnable = shown.filter((item) => deconstructBlockReason(item) === null);
  return { burnable: burnable.length, addable: burnable.filter((item) => !taken.has(item.id)).length };
}

export function fillDeconstruct(shown: readonly InventoryViewItem[], ids: readonly string[], cap: number): DeconstructBulkChange {
  const picked = deconstructFillCandidates(shown, ids, cap);
  return { ids: picked.length === 0 ? ids : [...ids, ...picked], added: picked.length, overflow: 0 };
}

export function pruneDeconstructSelection(ids: readonly string[], items: readonly InventoryViewItem[]): readonly string[] {
  if (ids.length === 0) return ids;
  const burnable = new Set(items.filter((item) => deconstructBlockReason(item) === null).map((item) => item.id));
  const kept = ids.filter((id) => burnable.has(id));
  return kept.length === ids.length ? ids : kept;
}

export function selectedDeconstructItems(ids: readonly string[], items: readonly InventoryViewItem[]): InventoryViewItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item === undefined ? [] : [item];
  });
}

export function withoutDeconstructIds(ids: readonly string[], removed: readonly string[]): readonly string[] {
  if (removed.length === 0) return ids;
  const gone = new Set(removed);
  const kept = ids.filter((id) => !gone.has(id));
  return kept.length === ids.length ? ids : kept;
}
