import { TEAM_PLAN_WORKER_MARKER, runTeamPlan } from '@bombfarm/domain/team-plan';
import type { TeamPlanInput, TeamPlanResult } from '@bombfarm/domain/team-plan/types';

export type TeamPlanWorkerRequest = {
  kind: 'run';
  runId: string;
  input: TeamPlanInput;
  /** E2E-only: read from `localStorage['bf-e2e-team-plan-max-eval']` when set. */
  maxEvaluations?: number;
  /** E2E-only: force a worker error response. */
  forceError?: boolean;
};

export type TeamPlanWorkerResponse =
  | { kind: 'done'; runId: string; result: TeamPlanResult }
  | { kind: 'blocked'; runId: string; heroNames: string[] }
  | { kind: 'error'; runId: string; message: string };

type WorkerSelf = {
  onmessage: ((event: MessageEvent<TeamPlanWorkerRequest>) => void) | null;
  postMessage: (message: TeamPlanWorkerResponse) => void;
};

const workerScope = self as unknown as WorkerSelf;

if (TEAM_PLAN_WORKER_MARKER !== 'runTeamPlan') {
  throw new Error('team-plan worker marker mismatch');
}

workerScope.onmessage = (event: MessageEvent<TeamPlanWorkerRequest>) => {
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
    const result = runTeamPlan(
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
