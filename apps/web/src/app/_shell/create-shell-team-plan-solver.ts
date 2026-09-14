import {
  createTeamPlanRunner,
  type TeamPlanRunnerHandle,
  type TeamPlanWorkerFactory,
} from '@bombfarm/team-plan/runner';
import { buildTeamPlanInputFromStore } from '@/features/team-plan';
import { usePlannerStore, type TeamPlanSolver, type TeamPlanSolverSnapshot } from '@/shared/stores';

function readSnapshot(runner: TeamPlanRunnerHandle): TeamPlanSolverSnapshot {
  return {
    status: runner.status,
    plan: runner.plan,
    blockedHeroNames: runner.blockedHeroNames,
    errorMessage: runner.errorMessage,
    ranOnMainThread: runner.ranOnMainThread,
    runId: runner.runId,
  };
}

export function createShellTeamPlanSolver(options?: {
  createWorker?: TeamPlanWorkerFactory;
}): TeamPlanSolver {
  const runner = createTeamPlanRunner(options);
  let snapshot = readSnapshot(runner);
  runner.subscribe(() => {
    snapshot = readSnapshot(runner);
  });

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => runner.subscribe(listener),
    solve: () => runner.run(buildTeamPlanInputFromStore(usePlannerStore.getState())),
    cancel: () => runner.cancel(),
    runner,
  };
}
