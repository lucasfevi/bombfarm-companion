import { shallow } from 'zustand/shallow';
import { saveInventory } from '@/shared/lib/inventory-storage';
import { usePlannerStore } from '@/shared/stores/planner-store';
import { AUTOSAVE_MS, createDebouncedWriter } from '@/shared/stores/persistence/debounced-writer';

type Store = typeof usePlannerStore;

export function attachInventoryPersistence(store: Store): () => void {
  const writer = createDebouncedWriter(AUTOSAVE_MS, () => {
    const state = store.getState();
    if (!state.booted) return;
    saveInventory(state.inventory);
  });

  const unsub = store.subscribe(
    (state) => [state.inventory, state.booted] as const,
    ([, booted]) => {
      if (!booted) return;
      writer.schedule();
    },
    { equalityFn: shallow },
  );

  return () => {
    unsub();
    writer.cancel();
  };
}
