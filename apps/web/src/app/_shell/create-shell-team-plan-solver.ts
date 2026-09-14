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

// The runner outlives the optimizer page, so the page must not see a settled run's id: its
// toolbar would dispatch that run into the store again on every mount, re-stamping a plan the
// shell sync already landed (and that a later edit may have marked stale or cleared).
function withheldOnceSettled(handle: TeamPlanRunnerHandle): TeamPlanRunnerHandle {
  return {
    get status() {
      return handle.status;
    },
    get plan() {
      return handle.plan;
    },
    get blockedHeroNames() {
      return handle.blockedHeroNames;
    },
    get errorMessage() {
      return handle.errorMessage;
    },
    get ranOnMainThread() {
      return handle.ranOnMainThread;
    },
    get runId() {
      return handle.status === 'running' ? handle.runId : null;
    },
    run: (input) => handle.run(input),
    cancel: () => handle.cancel(),
    subscribe: (listener) => handle.subscribe(listener),
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
    runner: withheldOnceSettled(runner),
  };
}
