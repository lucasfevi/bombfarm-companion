import { useCallback, useRef, useState } from 'react';
import type { TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import {
  createTeamPlanRunner,
  type TeamPlanRunner,
  type TeamPlanWorkerFactory,
} from '@/features/team-plan/hooks/team-plan-runner-core';

export type {
  TeamPlanRunner,
  TeamPlanRunStatus,
  TeamPlanWorkerFactory,
  TeamPlanWorkerLike,
} from '@/features/team-plan/hooks/team-plan-runner-core';

export { createTeamPlanRunner };

export function useTeamPlanRunner(options?: { createWorker?: TeamPlanWorkerFactory }) {
  const runnerRef = useRef<
    (TeamPlanRunner & { subscribe(listener: () => void): () => void }) | undefined
  >(undefined);
  if (!runnerRef.current) {
    runnerRef.current = createTeamPlanRunner(options);
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

  const runner = runnerRef.current;
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
