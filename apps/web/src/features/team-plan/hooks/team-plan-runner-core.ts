import { runTeamPlan } from '@bombfarm/domain/team-plan';
import type { TeamPlan, TeamPlanInput, TeamPlanResult } from '@bombfarm/domain/team-plan/types';
import type {
  TeamPlanWorkerRequest,
  TeamPlanWorkerResponse,
} from '@/features/team-plan/worker/team-plan.worker';
import { createTeamPlanWorkerModule } from '@/features/team-plan/worker/register-chunk';

export type TeamPlanRunStatus = 'idle' | 'running' | 'done' | 'blocked' | 'error';

export type TeamPlanWorkerLike = {
  postMessage: (message: TeamPlanWorkerRequest) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<TeamPlanWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

export type TeamPlanWorkerFactory = () => TeamPlanWorkerLike;

export type TeamPlanRunnerState = {
  status: TeamPlanRunStatus;
  plan: TeamPlan | null;
  blockedHeroNames: string[];
  errorMessage: string | null;
  ranOnMainThread: boolean;
  runId: string | null;
};

export type TeamPlanRunner = TeamPlanRunnerState & {
  run: (input: TeamPlanInput) => void;
  cancel: () => void;
};

const E2E_MAX_EVAL_KEY = 'bf-e2e-team-plan-max-eval';
const E2E_FORCE_ERROR_KEY = 'bf-e2e-team-plan-force-error';

function readE2eMaxEvaluations(): number | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const raw = localStorage.getItem(E2E_MAX_EVAL_KEY);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function readE2eForceError(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(E2E_FORCE_ERROR_KEY) === '1';
}

function defaultWorkerFactory(): TeamPlanWorkerLike {
  return createTeamPlanWorkerModule();
}

function applyResult(
  state: TeamPlanRunnerState,
  result: TeamPlanResult,
): TeamPlanRunnerState {
  if (result.blocked) {
    return {
      ...state,
      status: 'blocked',
      plan: null,
      blockedHeroNames: result.heroNames,
      errorMessage: null,
    };
  }
  return {
    ...state,
    status: 'done',
    plan: result.plan,
    blockedHeroNames: [],
    errorMessage: null,
  };
}

export function createTeamPlanRunner(options?: {
  createWorker?: TeamPlanWorkerFactory;
}): TeamPlanRunner & { subscribe(listener: () => void): () => void } {
  let state: TeamPlanRunnerState = {
    status: 'idle',
    plan: null,
    blockedHeroNames: [],
    errorMessage: null,
    ranOnMainThread: false,
    runId: null,
  };

  let worker: TeamPlanWorkerLike | null = null;
  let nextRunId = 0;
  const listeners = new Set<() => void>();
  const createWorker = options?.createWorker ?? defaultWorkerFactory;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const setState = (next: TeamPlanRunnerState) => {
    state = next;
    notify();
  };

  const terminateWorker = () => {
    worker?.terminate();
    worker = null;
  };

  const runOnMainThread = (runId: string, input: TeamPlanInput) => {
    if (readE2eForceError()) {
      if (state.runId !== runId) return;
      setState({
        ...state,
        status: 'error',
        plan: null,
        errorMessage: 'forced e2e error',
        ranOnMainThread: true,
        runId,
      });
      return;
    }
    try {
      const result = runTeamPlan(
        input,
        readE2eMaxEvaluations() ? { maxEvaluations: readE2eMaxEvaluations() } : undefined,
      );
      if (state.runId !== runId) return;
      setState({
        ...applyResult(state, result),
        ranOnMainThread: true,
        runId,
      });
    } catch (error) {
      if (state.runId !== runId) return;
      setState({
        ...state,
        status: 'error',
        plan: null,
        errorMessage: error instanceof Error ? error.message : String(error),
        ranOnMainThread: true,
        runId,
      });
    }
  };

  const handleWorkerMessage = (runId: string, data: TeamPlanWorkerResponse) => {
    if (data.runId !== runId || state.runId !== runId) return;
    if (data.kind === 'done') {
      setState({
        ...applyResult(state, data.result),
        ranOnMainThread: false,
        runId,
      });
      return;
    }
    if (data.kind === 'blocked') {
      setState({
        ...state,
        status: 'blocked',
        plan: null,
        blockedHeroNames: data.heroNames,
        errorMessage: null,
        ranOnMainThread: false,
        runId,
      });
      return;
    }
    setState({
      ...state,
      status: 'error',
      plan: null,
      errorMessage: data.message,
      ranOnMainThread: false,
      runId,
    });
  };

  return {
    get status() {
      return state.status;
    },
    get plan() {
      return state.plan;
    },
    get blockedHeroNames() {
      return state.blockedHeroNames;
    },
    get errorMessage() {
      return state.errorMessage;
    },
    get ranOnMainThread() {
      return state.ranOnMainThread;
    },
    get runId() {
      return state.runId;
    },
    run(input: TeamPlanInput) {
      const runId = String(++nextRunId);
      terminateWorker();
      setState({
        status: 'running',
        plan: null,
        blockedHeroNames: [],
        errorMessage: null,
        ranOnMainThread: false,
        runId,
      });

      try {
        worker = createWorker();
      } catch {
        runOnMainThread(runId, input);
        return;
      }

      worker.onerror = () => {
        if (state.runId !== runId) return;
        terminateWorker();
        runOnMainThread(runId, input);
      };
      worker.onmessage = (event) => handleWorkerMessage(runId, event.data);
      worker.postMessage({
        kind: 'run',
        runId,
        input,
        maxEvaluations: readE2eMaxEvaluations(),
        forceError: readE2eForceError(),
      });
    },
    cancel() {
      terminateWorker();
      setState({
        status: 'idle',
        plan: null,
        blockedHeroNames: [],
        errorMessage: null,
        ranOnMainThread: false,
        runId: null,
      });
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
