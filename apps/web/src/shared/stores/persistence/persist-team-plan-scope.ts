import { shallow } from 'zustand/shallow';
import { saveTeamPlanScope } from '@/shared/lib/team-plan-scope-storage';
import { usePlannerStore } from '@/shared/stores/planner-store';
import { AUTOSAVE_MS, createDebouncedWriter } from '@/shared/stores/persistence/debounced-writer';

type Store = typeof usePlannerStore;

export function attachTeamPlanScopePersistence(store: Store): () => void {
  const writer = createDebouncedWriter(AUTOSAVE_MS, () => {
    const state = store.getState();
    if (!state.booted) return;
    saveTeamPlanScope(state.scopeByHeroId);
  });

  const unsub = store.subscribe(
    (state) => [state.scopeByHeroId, state.booted] as const,
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
