'use client';

import { useEffect, useState } from 'react';
import type { InventoryView } from '@bombfarm/domain/inventory-view';
import {
  inventoryViewFromStorage,
  loadInventoryView,
  type StoredInventoryView,
} from '@/shared/lib/inventory-view-storage';
import { usePlannerStore } from '@/shared/stores';

/** `null` until a save has written a view; an empty list is an empty inventory only after one has. */
export function inventoryViewSnapshotFrom(loaded: StoredInventoryView): InventoryView | null {
  return loaded.importedAt === 0 ? null : inventoryViewFromStorage(loaded);
}

export function hasInventoryRows(view: InventoryView | null): boolean {
  return view != null && view.items.length > 0;
}

export function useInventoryViewSnapshot(): InventoryView | null {
  const importedAt = usePlannerStore((state) => state.inventory.importedAt);
  const [view, setView] = useState<InventoryView | null>(null);

  useEffect(() => {
    setView(inventoryViewSnapshotFrom(loadInventoryView()));
  }, [importedAt]);

  return view;
}
