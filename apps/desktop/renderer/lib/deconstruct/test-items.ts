import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';

type RawRow = Record<string, unknown>;

/** A raw inventory row for a plain, burnable piece of gear; every field a test wants to vary is
 *  an override. */
export function rawGear(overrides: RawRow = {}): RawRow {
  return {
    id: '1001',
    def_id: 'glacier_calca',
    set: 'glacier',
    rarity: 1,
    category: 0,
    level: 60,
    stats: [],
    power: 100,
    essence_value: 30,
    upgrade: 0,
    tradable: true,
    market_state: 0,
    locked: false,
    equipped_on: null,
    in_stash: false,
    ...overrides,
  };
}

/** A raw row for a non-gear item; `category` is the wire's own code (2 gem, 7 rune, 8 chance stone). */
export function rawOther(id: string, defId: string, category: number, overrides: RawRow = {}): RawRow {
  return { id, def_id: defId, category, rarity: 1, level: 0, essence_value: 5, ...overrides };
}

export function viewItems(rows: readonly RawRow[]): InventoryViewItem[] {
  return buildInventoryView([...rows]).items;
}

export function viewItem(overrides: RawRow = {}): InventoryViewItem {
  const [item] = viewItems([rawGear(overrides)]);
  if (!item) throw new Error('fixture row did not map');
  return item;
}

/** The raw rows of a small bag that exercises every axis of the filter: four gear pieces across
 *  two sets (one worn, one forged, one in the stash), a gem, a rune, and a chest the server
 *  gives no worth. */
export function sampleRows(): RawRow[] {
  return [
    rawGear({ id: '1', def_id: 'glacier_calca', set: 'glacier', rarity: 1, level: 60, essence_value: 30 }),
    rawGear({ id: '2', def_id: 'glacier_arma', set: 'glacier', rarity: 3, level: 60, upgrade: 5, essence_value: 200 }),
    rawGear({ id: '3', def_id: 'ember_bota', set: 'ember', rarity: 0, level: 10, essence_value: 10, in_stash: true }),
    rawGear({ id: '4', def_id: 'ember_luva', set: 'ember', rarity: 2, level: 10, essence_value: 40, equipped_on: 'h1' }),
    rawOther('5', 'gem_ruby', 2, { rarity: 1, essence_value: 5 }),
    rawOther('6', 'rune_critdmg_comum', 7, { rarity: 0, essence_value: 8 }),
    rawOther('7', 'chest_item_90', 1, { essence_value: 0 }),
  ];
}

export function sampleBag(): InventoryViewItem[] {
  return viewItems(sampleRows());
}
