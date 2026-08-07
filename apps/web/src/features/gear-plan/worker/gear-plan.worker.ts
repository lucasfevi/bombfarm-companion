import { GEAR_PLAN_WORKER_MARKER, runGearPlan } from '@bombfarm/domain/gear-plan';
import type { GearPlanInput, GearPlanResult } from '@bombfarm/domain/gear-plan/types';

export type GearPlanWorkerRequest = {
  kind: 'run';
  runId: string;
  input: GearPlanInput;
};

export type GearPlanWorkerResponse =
  | { kind: 'done'; runId: string; result: GearPlanResult }
  | { kind: 'blocked'; runId: string; heroNames: string[] }
  | { kind: 'error'; runId: string; message: string };

type WorkerSelf = {
  onmessage: ((event: MessageEvent<GearPlanWorkerRequest>) => void) | null;
  postMessage: (message: GearPlanWorkerResponse) => void;
};

const ctx = self as unknown as WorkerSelf;

// Bundler smoke marker — referenced by gear-plan-worker-bundle.test.ts (T22).
void GEAR_PLAN_WORKER_MARKER;

ctx.onmessage = (event: MessageEvent<GearPlanWorkerRequest>) => {
  const message = event.data;
  if (!message || message.kind !== 'run') return;
  try {
    const result = runGearPlan(message.input);
    if (result.blocked) {
      ctx.postMessage({ kind: 'blocked', runId: message.runId, heroNames: result.heroNames });
      return;
    }
    ctx.postMessage({ kind: 'done', runId: message.runId, result });
  } catch (error) {
    ctx.postMessage({
      kind: 'error',
      runId: message.runId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
