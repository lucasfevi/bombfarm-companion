import { useCallback, useRef, useState } from 'react';
import type { GearPlanInput } from '@bombfarm/domain/gear-plan/types';
import {
  createGearPlanRunner,
  type GearPlanRunner,
  type GearPlanWorkerFactory,
} from '@/features/gear-plan/hooks/gear-plan-runner-core';

export type {
  GearPlanRunner,
  GearPlanRunStatus,
  GearPlanWorkerFactory,
  GearPlanWorkerLike,
} from '@/features/gear-plan/hooks/gear-plan-runner-core';

export { createGearPlanRunner };

export function useGearPlanRunner(options?: { createWorker?: GearPlanWorkerFactory }) {
  const runnerRef = useRef<
    (GearPlanRunner & { subscribe(listener: () => void): () => void }) | undefined
  >(undefined);
  if (!runnerRef.current) {
    runnerRef.current = createGearPlanRunner(options);
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

  const run = useCallback((input: GearPlanInput) => {
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
