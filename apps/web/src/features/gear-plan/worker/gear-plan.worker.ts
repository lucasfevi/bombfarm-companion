import { GEAR_PLAN_WORKER_MARKER, runGearPlan } from '@bombfarm/domain/gear-plan';
import type { GearPlanInput, GearPlanResult } from '@bombfarm/domain/gear-plan/types';

export type GearPlanWorkerRequest = {
  kind: 'run';
  runId: string;
  input: GearPlanInput;
  /** E2E-only: read from `localStorage['bf-e2e-gear-plan-max-eval']` when set. */
  maxEvaluations?: number;
  /** E2E-only: force a worker error response. */
  forceError?: boolean;
};

export type GearPlanWorkerResponse =
  | { kind: 'done'; runId: string; result: GearPlanResult }
  | { kind: 'blocked'; runId: string; heroNames: string[] }
  | { kind: 'error'; runId: string; message: string };

type WorkerSelf = {
  onmessage: ((event: MessageEvent<GearPlanWorkerRequest>) => void) | null;
  postMessage: (message: GearPlanWorkerResponse) => void;
};

const workerScope = self as unknown as WorkerSelf;

if (GEAR_PLAN_WORKER_MARKER !== 'runGearPlan') {
  throw new Error('gear-plan worker marker mismatch');
}

workerScope.onmessage = (event: MessageEvent<GearPlanWorkerRequest>) => {
  const message = event.data;
  if (!message || message.kind !== 'run') return;
  if (message.forceError) {
    workerScope.postMessage({
      kind: 'error',
      runId: message.runId,
      message: 'forced e2e error',
    });
    return;
  }
  try {
    const result = runGearPlan(
      message.input,
      message.maxEvaluations ? { maxEvaluations: message.maxEvaluations } : undefined,
    );
    if (result.blocked) {
      workerScope.postMessage({ kind: 'blocked', runId: message.runId, heroNames: result.heroNames });
      return;
    }
    workerScope.postMessage({ kind: 'done', runId: message.runId, result });
  } catch (error) {
    workerScope.postMessage({
      kind: 'error',
      runId: message.runId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
