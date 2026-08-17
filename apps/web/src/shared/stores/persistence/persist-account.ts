import { shallow } from 'zustand/shallow';
import { saveAccountShared } from '@/shared/lib/storage';
import { usePlannerStore } from '@/shared/stores/planner-store';
import {
  selectAccountShared,
  selectAccountTuple,
} from '@/shared/stores/selectors/account-selectors';
import { selectStrings } from '@/shared/stores/selectors/session-selectors';
import { AUTOSAVE_MS, createDebouncedWriter } from '@/shared/stores/persistence/debounced-writer';

type Store = typeof usePlannerStore;

export function attachAccountPersistence(store: Store): () => void {
  const writer = createDebouncedWriter(AUTOSAVE_MS, () => {
    const state = store.getState();
    if (!state.booted) return;
    const wrote = saveAccountShared(selectAccountShared(state));
    if (!wrote) return; // write-error listener already toasted toastSaveFailed
    if (state.consumeSkipAccountToast()) return;
    state.flashToast(selectStrings(state).toastAccountSaved);
  });

  const unsub = store.subscribe(
    selectAccountTuple,
    () => {
      if (!store.getState().booted) return;
      writer.schedule();
    },
    { equalityFn: shallow },
  );

  return () => {
    unsub();
    writer.cancel();
  };
}
