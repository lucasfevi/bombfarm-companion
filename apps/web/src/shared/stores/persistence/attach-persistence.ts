import {
  clearStorageWriteErrorListenersForTests,
  onStorageWriteError,
} from '@/shared/lib/storage';
import {
  registerPlannerStoreTestCleanup,
  usePlannerStore,
} from '@/shared/stores/planner-store';
import { selectStrings } from '@/shared/stores/selectors/session-selectors';
import { clearSessionTimersForTests } from '@/shared/stores/slices/session-slice';
import { attachAccountPersistence } from '@/shared/stores/persistence/persist-account';
import { attachHeroDraftPersistence } from '@/shared/stores/persistence/persist-hero-draft';
import { attachInventoryPersistence } from '@/shared/stores/persistence/persist-inventory';
import { attachTeamPlanScopePersistence } from '@/shared/stores/persistence/persist-team-plan-scope';

type Store = typeof usePlannerStore;

let attached = false;

export function attachPlannerPersistence(store: Store): () => void {
  if (attached) {
    return () => undefined;
  }
  attached = true;

  const detachAccount = attachAccountPersistence(store);
  const detachHero = attachHeroDraftPersistence(store);
  const detachInventory = attachInventoryPersistence(store);
  const detachTeamPlanScope = attachTeamPlanScopePersistence(store);

  const unsubWriteError = onStorageWriteError(() => {
    const state = store.getState();
    state.flashToast(selectStrings(state).toastSaveFailed);
  });

  const detach = () => {
    detachAccount();
    detachHero();
    detachInventory();
    detachTeamPlanScope();
    unsubWriteError();
    clearSessionTimersForTests();
    attached = false;
  };

  registerPlannerStoreTestCleanup('persistence', detach);
  registerPlannerStoreTestCleanup('storageListeners', clearStorageWriteErrorListenersForTests);

  return detach;
}
