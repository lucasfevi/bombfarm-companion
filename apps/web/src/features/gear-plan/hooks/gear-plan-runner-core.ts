import { runGearPlan } from '@bombfarm/domain/gear-plan';
import type { GearPlan, GearPlanInput, GearPlanResult } from '@bombfarm/domain/gear-plan/types';
import type {
  GearPlanWorkerRequest,
  GearPlanWorkerResponse,
} from '@/features/gear-plan/worker/gear-plan.worker';
import { createGearPlanWorkerModule } from '@/features/gear-plan/worker/register-chunk';

export type GearPlanRunStatus = 'idle' | 'running' | 'done' | 'blocked' | 'error';

export type GearPlanWorkerLike = {
  postMessage: (message: GearPlanWorkerRequest) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<GearPlanWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

export type GearPlanWorkerFactory = () => GearPlanWorkerLike;

export type GearPlanRunnerState = {
  status: GearPlanRunStatus;
  plan: GearPlan | null;
  blockedHeroNames: string[];
  errorMessage: string | null;
  ranOnMainThread: boolean;
  runId: string | null;
};

export type GearPlanRunner = GearPlanRunnerState & {
  run: (input: GearPlanInput) => void;
  cancel: () => void;
};

const E2E_MAX_EVAL_KEY = 'bf-e2e-gear-plan-max-eval';
const E2E_FORCE_ERROR_KEY = 'bf-e2e-gear-plan-force-error';

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

function defaultWorkerFactory(): GearPlanWorkerLike {
  return createGearPlanWorkerModule();
}

function applyResult(
  state: GearPlanRunnerState,
  result: GearPlanResult,
): GearPlanRunnerState {
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

export function createGearPlanRunner(options?: {
  createWorker?: GearPlanWorkerFactory;
}): GearPlanRunner & { subscribe(listener: () => void): () => void } {
  let state: GearPlanRunnerState = {
    status: 'idle',
    plan: null,
    blockedHeroNames: [],
    errorMessage: null,
    ranOnMainThread: false,
    runId: null,
  };

  let worker: GearPlanWorkerLike | null = null;
  let nextRunId = 0;
  const listeners = new Set<() => void>();
  const createWorker = options?.createWorker ?? defaultWorkerFactory;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const setState = (next: GearPlanRunnerState) => {
    state = next;
    notify();
  };

  const terminateWorker = () => {
    worker?.terminate();
    worker = null;
  };

  const runOnMainThread = (runId: string, input: GearPlanInput) => {
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
      const result = runGearPlan(
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

  const handleWorkerMessage = (runId: string, data: GearPlanWorkerResponse) => {
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
    run(input: GearPlanInput) {
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
