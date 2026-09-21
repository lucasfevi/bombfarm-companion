/**
 * The apply store's own state and every transition — the store body (`apply-store.ts`) is glue
 * over this reducer and the bridge. Three step records (equip, forge, points), which confirm is
 * open, the blocking modal's state, and whether this store paused the forge queue.
 */
import type { ApplyEvent, ApplySkip, ApplyStartReason, ApplyStep, ApplyStopReason } from '@bombfarm/contracts';
import { applyRunReducer, beginRun, type ApplyRunView, type SkipRecord } from './apply-run-reducer';
import { nextUndoneStep, type ApplyStepId } from './apply-panel-model';
import type { ApplyUnitLabel } from './apply-labels';

export type StopView =
  | { readonly kind: 'start'; readonly reason: ApplyStartReason }
  | { readonly kind: 'run'; readonly stop: ApplyStopReason; readonly code?: string };

export type StepRecord =
  | { readonly status: 'idle' }
  | { readonly status: 'running' }
  | { readonly status: 'done'; readonly made: number; readonly skipped: number; readonly total: number; readonly skips: readonly SkipRecord[] }
  | {
      readonly status: 'stopped';
      readonly reason: StopView;
      readonly made: number;
      readonly skipped: number;
      readonly total: number;
      readonly skips: readonly SkipRecord[];
    };

export type ApplyModalState = {
  readonly step: ApplyStep;
  readonly phase: 'waitingQueue' | 'starting' | 'running' | 'done';
  readonly run: ApplyRunView | null;
  readonly stopRequested: boolean;
  /** The plan run id this modal was opened under — so a later `bind` to a new plan can tell this
   *  run apart from the new plan's own steps and never credit (or blame) the new plan with an
   *  outcome that belongs to the old one. */
  readonly planRunId: string | null;
};

export type ApplyProgressState = {
  readonly planRunId: string | null;
  readonly steps: Readonly<Record<ApplyStepId, StepRecord>>;
  readonly confirming: ApplyStepId | null;
  readonly modal: ApplyModalState | null;
  readonly queuePausedByApply: boolean;
};

export type ApplyProgressAction =
  | { readonly kind: 'bind'; readonly planRunId: string }
  | { readonly kind: 'openConfirm'; readonly step: ApplyStepId }
  | { readonly kind: 'cancelConfirm' }
  | { readonly kind: 'waitQueue'; readonly step: ApplyStep }
  | { readonly kind: 'starting'; readonly step: ApplyStep }
  | { readonly kind: 'began'; readonly step: ApplyStep; readonly runId: string; readonly units: readonly ApplyUnitLabel[]; readonly startedAtMs: number }
  | { readonly kind: 'refused'; readonly step: ApplyStep; readonly reason: ApplyStartReason }
  | { readonly kind: 'event'; readonly event: ApplyEvent }
  | { readonly kind: 'stopRequested' }
  | { readonly kind: 'queueWaitAborted' }
  | { readonly kind: 'closeModal' }
  | { readonly kind: 'continueNext' }
  | { readonly kind: 'forgeDone'; readonly made: number; readonly skipped: number }
  | { readonly kind: 'queuePaused'; readonly by: 'apply' }
  | { readonly kind: 'queueResumed' };

const IDLE_RECORD: StepRecord = { status: 'idle' };

export const initialApplyProgress: ApplyProgressState = {
  planRunId: null,
  steps: { equip: IDLE_RECORD, forge: IDLE_RECORD, points: IDLE_RECORD },
  confirming: null,
  modal: null,
  queuePausedByApply: false,
};

function withStep(steps: Readonly<Record<ApplyStepId, StepRecord>>, step: ApplyStepId, record: StepRecord): Readonly<Record<ApplyStepId, StepRecord>> {
  return { ...steps, [step]: record };
}

function toSkipRecord(skip: ApplySkip): SkipRecord {
  return skip.code === undefined ? { index: skip.index, reason: skip.reason } : { index: skip.index, reason: skip.reason, code: skip.code };
}

export function applyProgressReducer(state: ApplyProgressState, action: ApplyProgressAction): ApplyProgressState {
  switch (action.kind) {
    case 'bind': {
      if (state.planRunId === action.planRunId) return state;
      return { ...state, planRunId: action.planRunId, steps: { equip: IDLE_RECORD, forge: IDLE_RECORD, points: IDLE_RECORD }, confirming: null };
    }
    case 'openConfirm':
      return { ...state, confirming: action.step };
    case 'cancelConfirm':
      return state.confirming === null ? state : { ...state, confirming: null };
    case 'waitQueue':
      return {
        ...state,
        confirming: null,
        modal: { step: action.step, phase: 'waitingQueue', run: null, stopRequested: false, planRunId: state.planRunId },
        steps: withStep(state.steps, action.step, { status: 'running' }),
      };
    case 'starting':
      return {
        ...state,
        confirming: null,
        modal: { step: action.step, phase: 'starting', run: state.modal?.run ?? null, stopRequested: false, planRunId: state.planRunId },
        steps: withStep(state.steps, action.step, { status: 'running' }),
      };
    case 'began':
      return {
        ...state,
        modal: {
          step: action.step,
          phase: 'running',
          run: beginRun(action.step, action.runId, action.units, action.startedAtMs),
          stopRequested: false,
          planRunId: state.modal?.planRunId ?? state.planRunId,
        },
      };
    case 'refused':
      return {
        ...state,
        modal: null,
        steps: withStep(state.steps, action.step, {
          status: 'stopped',
          reason: { kind: 'start', reason: action.reason },
          made: 0,
          skipped: 0,
          total: 0,
          skips: [],
        }),
      };
    case 'event': {
      if (state.modal === null || state.modal.run === null) return state;
      const run = applyRunReducer(state.modal.run, action.event);
      if (run === state.modal.run) return state;
      if (action.event.type !== 'done') return { ...state, modal: { ...state.modal, run } };
      const { result } = action.event;
      const skips = result.skipped.map(toSkipRecord);
      const record: StepRecord =
        result.stop === 'finished'
          ? { status: 'done', made: result.made, skipped: result.skipped.length, total: result.total, skips }
          : {
              status: 'stopped',
              reason: { kind: 'run', stop: result.stop, ...(result.stopCode === null ? {} : { code: result.stopCode }) },
              made: result.made,
              skipped: result.skipped.length,
              total: result.total,
              skips,
            };
      const belongsToCurrentPlan = state.modal.planRunId === state.planRunId;
      return {
        ...state,
        modal: { ...state.modal, run, phase: 'done' },
        steps: belongsToCurrentPlan ? withStep(state.steps, state.modal.step, record) : state.steps,
      };
    }
    case 'stopRequested':
      return state.modal === null || state.modal.stopRequested ? state : { ...state, modal: { ...state.modal, stopRequested: true } };
    case 'queueWaitAborted': {
      if (state.modal === null) return state;
      return { ...state, modal: null, steps: withStep(state.steps, state.modal.step, IDLE_RECORD) };
    }
    case 'closeModal':
      return state.modal === null ? state : { ...state, modal: null };
    case 'continueNext':
      return { ...state, modal: null, confirming: nextUndoneStep(state.steps, state.modal?.step ?? null) };
    case 'forgeDone':
      return {
        ...state,
        steps: withStep(state.steps, 'forge', { status: 'done', made: action.made, skipped: action.skipped, total: action.made + action.skipped, skips: [] }),
      };
    case 'queuePaused':
      return state.queuePausedByApply ? state : { ...state, queuePausedByApply: true };
    case 'queueResumed':
      return state.queuePausedByApply ? { ...state, queuePausedByApply: false } : state;
  }
}
