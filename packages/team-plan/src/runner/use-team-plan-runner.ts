import { useCallback, useRef, useState } from 'react';
import type { TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import {
  createTeamPlanRunner,
  type TeamPlanRunner,
  type TeamPlanRunnerHandle,
  type TeamPlanWorkerFactory,
} from './team-plan-runner-core';

export type {
  TeamPlanRunner,
  TeamPlanRunnerHandle,
  TeamPlanRunnerState,
  TeamPlanRunStatus,
  TeamPlanWorkerFactory,
  TeamPlanWorkerLike,
} from './team-plan-runner-core';

export { createTeamPlanRunner };

export function useTeamPlanRunner(options?: {
  /** A host-built runner (window-lifetime singleton) — the hook subscribes to it instead of
   *  creating its own, so a solve survives the hook's owner unmounting. Absent: creates one. */
  runner?: TeamPlanRunnerHandle;
  createWorker?: TeamPlanWorkerFactory;
}) {
  const runnerRef = useRef<TeamPlanRunnerHandle | undefined>(undefined);
  if (!runnerRef.current) {
    runnerRef.current =
      options?.runner ??
      createTeamPlanRunner(
        options?.createWorker !== undefined ? { createWorker: options.createWorker } : undefined,
      );
  }
  const [, bumpVersion] = useState(0);
  const subscribeRef = useRef(
    runnerRef.current.subscribe(() => bumpVersion((version) => version + 1)),
  );
  if (!subscribeRef.current) {
    subscribeRef.current = runnerRef.current.subscribe(() =>
      bumpVersion((version) => version + 1),
    );
  }

  const run = useCallback((input: TeamPlanInput) => {
    runnerRef.current?.run(input);
  }, []);
  const cancel = useCallback(() => {
    runnerRef.current?.cancel();
  }, []);

  const runner: TeamPlanRunner = runnerRef.current;
  return {
    run,
    cancel,
    status: runner.status,
    plan: runner.plan,
    ranOnMainThread: runner.ranOnMainThread,
    blockedHeroNames: runner.blockedHeroNames,
    errorMessage: runner.errorMessage,
    runId: runner.runId,
  };
}
