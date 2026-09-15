import type { usePlannerStore } from '@/shared/stores/planner-store';
import type { TeamPlanSolver } from '@/shared/stores/team-plan-solver';

export function attachTeamPlanRunnerSync(
  store: typeof usePlannerStore,
  solver: TeamPlanSolver,
): () => void {
  let handledRunId: string | null = null;

  const apply = () => {
    const { runId, status, plan } = solver.getSnapshot();
    if (runId === null) return;
    if (status === 'running') {
      store.getState().startRun(runId);
      return;
    }
    if (handledRunId === runId) return;
    handledRunId = runId;
    if (status === 'done' && plan !== null) {
      store.getState().applyPlan(runId, plan);
      return;
    }
    if (status === 'blocked' || status === 'error') {
      store.getState().resolveRun(runId, status);
    }
  };

  apply();
  return solver.subscribe(apply);
}
