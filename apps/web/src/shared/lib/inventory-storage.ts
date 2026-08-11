import {
  normalizeInventorySnapshot,
  type InventoryItem,
  type InventorySnapshot,
} from '@bombfarm/domain/inventory';
import { readJson, writeJson } from '@/shared/lib/storage';

export const INVENTORY_KEY = 'bf-hp-inventory-v1';

export { normalizeInventorySnapshot };

export function normalizeInventory(raw: unknown): InventorySnapshot {
  return normalizeInventorySnapshot(raw);
}

export function loadInventory(): InventorySnapshot {
  return normalizeInventory(readJson(INVENTORY_KEY, null));
}

export function saveInventory(snapshot: InventorySnapshot): boolean {
  return writeJson(INVENTORY_KEY, normalizeInventory(snapshot));
}

export function replaceInventory(items: InventoryItem[], importedAt = Date.now()): boolean {
  return saveInventory({ version: 1, importedAt, items });
}
