import {
  buildInventoryView,
  groupInventoryByKind,
  type InventoryView,
  type InventoryViewItem,
} from '@bombfarm/domain/inventory-view';
import { readJson, writeJson } from '@/shared/lib/storage';

/**
 * Its own key, deliberately not an added field on `bf-hp-inventory-v1`: that snapshot is the
 * optimizer's gear-only pool and the team-plan solver reads it on every run. Keeping the display
 * list separate means the inventory surface can carry every row the save has — keys, materials,
 * whatever a patch adds — without widening the type the solver iterates.
 */
export const INVENTORY_VIEW_KEY = 'bf-hp-inventory-view-v1';

export type StoredInventoryView = {
  version: 1;
  importedAt: number;
  items: InventoryViewItem[];
};

const EMPTY: StoredInventoryView = { version: 1, importedAt: 0, items: [] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Re-maps through the domain mapper rather than trusting persisted shape: a stored list written
 *  by an older build is raw-shaped enough for `mapInventoryViewItem` to re-read, and a row it
 *  cannot read is dropped instead of reaching the UI half-formed. */
export function normalizeStoredInventoryView(raw: unknown): StoredInventoryView {
  if (!isObject(raw) || !Array.isArray(raw.items)) return { ...EMPTY, items: [] };

  const items = buildInventoryView(raw.items).items;
  const importedAt = typeof raw.importedAt === 'number' && Number.isFinite(raw.importedAt) ? raw.importedAt : 0;

  return { version: 1, importedAt: importedAt > 0 ? importedAt : 0, items };
}

export function loadInventoryView(): StoredInventoryView {
  return normalizeStoredInventoryView(readJson(INVENTORY_VIEW_KEY, null));
}

export function saveInventoryView(items: InventoryViewItem[], importedAt = Date.now()): boolean {
  return writeJson(INVENTORY_VIEW_KEY, { version: 1, importedAt, items } satisfies StoredInventoryView);
}

/** The grouped shape `InventoryGrid` renders. Groups the already-mapped list rather than sending
 *  it back through the mapper — `loadInventoryView` has mapped it once already, and mapping twice
 *  is what this module is careful not to do. */
export function inventoryViewFromStorage(stored: StoredInventoryView): InventoryView {
  return { items: stored.items, groups: groupInventoryByKind(stored.items), skipped: 0 };
}
