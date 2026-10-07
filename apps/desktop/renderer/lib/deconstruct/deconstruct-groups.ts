import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';

export type DeconstructGroup = {
  readonly id: string;
  readonly label: string;
  readonly count: number;
};

/** Chests and cages are told apart by the name they print (the item level or the act, or what the
 *  chest holds); everything else by its kind and rarity. */
function groupId(item: InventoryViewItem, label: string): string {
  return item.kind === 'chest' ? `chest:${label}` : `${item.kind}:${String(item.rarityIdx)}`;
}

/** What the batch holds, one row per type, most numerous first and alphabetical among equals. */
export function deconstructGroups(
  items: readonly InventoryViewItem[],
  labelOf: (item: InventoryViewItem) => string,
): DeconstructGroup[] {
  const groups = new Map<string, { label: string; count: number }>();
  for (const item of items) {
    const label = labelOf(item);
    const id = groupId(item, label);
    const group = groups.get(id);
    if (group === undefined) groups.set(id, { label, count: 1 });
    else group.count += 1;
  }
  return [...groups]
    .map(([id, { label, count }]) => ({ id, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}
