import type { InventoryTableColumnId, InventoryTableLabels } from '@bombfarm/game-art';
import type { InventoryHero } from '@bombfarm/domain/inventory-view';
import type { DomainLang } from '@bombfarm/contracts';
import { slotLabel } from '@bombfarm/domain/game-labels';
import { sub, type Copy } from '../../lib/copy';
import { inventoryTableLabels } from '../inventory/inventory-labels';
import { BLANK } from './forge-labels';

/**
 * What the Forge bag shows: what the piece is, where it is worn, and how far it is already
 * forged. No value, no market price and no quantity — a gear row is always one item, and none of
 * the three is what this screen is deciding about.
 */
export const FORGE_TABLE_COLUMNS: readonly InventoryTableColumnId[] = ['name', 'slot', 'forge', 'hero'];

/**
 * The Forge bag's labels, which are the Inventory table's with three words changed. Derived
 * rather than written out: both tables list the same items out of the same account, and a second
 * bag of item names is how the two screens would start naming the same sword differently.
 */
export function forgeTableLabels(
  t: Copy,
  lang: DomainLang,
  heroes: ReadonlyMap<string, InventoryHero>,
): InventoryTableLabels {
  return {
    ...inventoryTableLabels(t, lang, heroes),
    caption: t.forgeTableCaption,
    slotName: (item) => (item.slot === null ? BLANK : slotLabel(item.slot, lang)),
    rowAction: (itemName) => sub(t.forgeRowSelect, { item: itemName }),
  };
}
