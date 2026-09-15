import { shallow } from 'zustand/shallow';
import { removeTeamPlanEnvelope, saveTeamPlanEnvelope } from '@/shared/lib/team-plan-storage';
import { usePlannerStore } from '@/shared/stores/planner-store';
import { selectTeamPlanTargetPhase } from '@/shared/stores/selectors/team-plan-selectors';
import { AUTOSAVE_MS, createDebouncedWriter } from '@/shared/stores/persistence/debounced-writer';

type Store = typeof usePlannerStore;

export function attachTeamPlanPersistence(store: Store): () => void {
  const writer = createDebouncedWriter(AUTOSAVE_MS, () => {
    const state = store.getState();
    if (!state.booted) return;
    if (state.plan === null || state.planInputSignature === null) {
      removeTeamPlanEnvelope();
      return;
    }
    saveTeamPlanEnvelope({
      version: 1,
      signature: state.planInputSignature,
      objective: state.objective,
      allowedChanges: state.allowedChanges,
      ignoreFieldCrowding: state.ignoreFieldCrowding,
      targetPhase: selectTeamPlanTargetPhase(state),
      plan: state.plan,
    });
  });

  const unsub = store.subscribe(
    (state) =>
      [
        state.plan,
        state.planInputSignature,
        state.objective,
        state.allowedChanges,
        state.ignoreFieldCrowding,
        selectTeamPlanTargetPhase(state),
        state.booted,
      ] as const,
    ([, , , , , , booted]) => {
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
