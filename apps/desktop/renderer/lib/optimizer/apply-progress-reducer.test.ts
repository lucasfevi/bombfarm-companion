import { describe, expect, it } from 'vitest';
import type { ApplyEvent } from '@bombfarm/contracts';
import {
  applyProgressReducer,
  initialApplyProgress,
  type ApplyProgressAction,
  type ApplyProgressState,
} from './apply-progress-reducer';
import type { ApplyUnitLabel } from './apply-labels';

function bound(planRunId = 'run-1'): ApplyProgressState {
  return applyProgressReducer(initialApplyProgress, { kind: 'bind', planRunId });
}

function unit(index: number): ApplyUnitLabel {
  return { index, call: 'equip', subject: `item ${String(index)}`, from: null, to: 'h1', points: null, gold: 0 };
}

describe('bind', () => {
  it('a new plan run id resets every step to idle', () => {
    const withHistory: ApplyProgressState = {
      ...bound('run-1'),
      steps: { equip: { status: 'done', made: 1, skipped: 0, total: 1, skips: [] }, forge: { status: 'idle' }, points: { status: 'idle' } },
    };
    const next = applyProgressReducer(withHistory, { kind: 'bind', planRunId: 'run-2' });
    expect(next.planRunId).toBe('run-2');
    expect(next.steps).toEqual({ equip: { status: 'idle' }, forge: { status: 'idle' }, points: { status: 'idle' } });
  });

  it('the same plan run id returns the same reference', () => {
    const state = bound('run-1');
    expect(applyProgressReducer(state, { kind: 'bind', planRunId: 'run-1' })).toBe(state);
  });

  it('a new plan run id with a modal run in flight keeps the modal, and its later done writes nothing to the new steps', () => {
    const running = applyProgressReducer(bound('run-1'), {
      kind: 'began',
      step: 'equip',
      runId: 'r1',
      units: [unit(0)],
      startedAtMs: 0,
    });
    const rebound = applyProgressReducer(running, { kind: 'bind', planRunId: 'run-2' });
    expect(rebound.modal).toBe(running.modal);
    const doneEvent: ApplyEvent = {
      type: 'done',
      runId: 'r1',
      step: 'equip',
      result: { step: 'equip', total: 1, made: 1, skipped: [], failed: null, stop: 'finished', stopCode: null, goldSpent: 0, durationMs: 0 },
    };
    const afterDone = applyProgressReducer(rebound, { kind: 'event', event: doneEvent });
    expect(afterDone.steps).toEqual(rebound.steps);
  });
});

describe('confirms', () => {
  it('openConfirm opens one step; cancelConfirm returns to none', () => {
    const opened = applyProgressReducer(bound(), { kind: 'openConfirm', step: 'points' });
    expect(opened.confirming).toBe('points');
    const cancelled = applyProgressReducer(opened, { kind: 'cancelConfirm' });
    expect(cancelled.confirming).toBeNull();
  });
});

describe('starting a run', () => {
  it('waitQueue opens the modal waiting on the queue and marks the step running', () => {
    const next = applyProgressReducer(bound(), { kind: 'waitQueue', step: 'equip' });
    expect(next.modal).toEqual({ step: 'equip', phase: 'waitingQueue', run: null, stopRequested: false, planRunId: 'run-1' });
    expect(next.steps.equip).toEqual({ status: 'running' });
    expect(next.confirming).toBeNull();
  });

  it('starting moves the modal to its starting phase and marks the step running', () => {
    const next = applyProgressReducer(bound(), { kind: 'starting', step: 'points' });
    expect(next.modal).toEqual({ step: 'points', phase: 'starting', run: null, stopRequested: false, planRunId: 'run-1' });
    expect(next.steps.points).toEqual({ status: 'running' });
  });

  it('began moves the modal to running, carrying the frozen run view', () => {
    const next = applyProgressReducer(bound(), { kind: 'began', step: 'equip', runId: 'r1', units: [unit(0)], startedAtMs: 5_000 });
    expect(next.modal?.phase).toBe('running');
    expect(next.modal?.run).toMatchObject({ runId: 'r1', startedAtMs: 5_000, status: ['next'] });
  });

  it('a start refusal closes the modal and stops the step with the refusal reason', () => {
    const next = applyProgressReducer(bound(), { kind: 'refused', step: 'equip', reason: 'offline' });
    expect(next.modal).toBeNull();
    expect(next.steps.equip).toEqual({ status: 'stopped', reason: { kind: 'start', reason: 'offline' }, made: 0, skipped: 0, total: 0, skips: [] });
  });
});

describe('folding run events', () => {
  const running = () => applyProgressReducer(bound(), { kind: 'began', step: 'equip', runId: 'r1', units: [unit(0), unit(1)], startedAtMs: 0 });

  it('a done event that finished moves the modal to done and writes a done step record', () => {
    const event: ApplyEvent = {
      type: 'done',
      runId: 'r1',
      step: 'equip',
      result: { step: 'equip', total: 2, made: 2, skipped: [], failed: null, stop: 'finished', stopCode: null, goldSpent: 0, durationMs: 0 },
    };
    const next = applyProgressReducer(running(), { kind: 'event', event });
    expect(next.modal?.phase).toBe('done');
    expect(next.steps.equip).toEqual({ status: 'done', made: 2, skipped: 0, total: 2, skips: [] });
  });

  it('a done event that stopped short writes a stopped step record with the run-stop reason', () => {
    const event: ApplyEvent = {
      type: 'done',
      runId: 'r1',
      step: 'equip',
      result: {
        step: 'equip',
        total: 2,
        made: 1,
        skipped: [{ index: 1, reason: 'heroLevel' }],
        failed: null,
        stop: 'network',
        stopCode: null,
        goldSpent: 0,
        durationMs: 0,
      },
    };
    const next = applyProgressReducer(running(), { kind: 'event', event });
    expect(next.steps.equip).toEqual({
      status: 'stopped',
      reason: { kind: 'run', stop: 'network' },
      made: 1,
      skipped: 1,
      total: 2,
      skips: [{ index: 1, reason: 'heroLevel' }],
    });
  });
});

describe('stopping and closing', () => {
  it('stopRequested marks the modal as stopping', () => {
    const running = applyProgressReducer(bound(), { kind: 'began', step: 'equip', runId: 'r1', units: [unit(0)], startedAtMs: 0 });
    const next = applyProgressReducer(running, { kind: 'stopRequested' });
    expect(next.modal?.stopRequested).toBe(true);
  });

  it('queueWaitAborted closes the modal and returns the step to idle', () => {
    const waiting = applyProgressReducer(bound(), { kind: 'waitQueue', step: 'equip' });
    const next = applyProgressReducer(waiting, { kind: 'queueWaitAborted' });
    expect(next.modal).toBeNull();
    expect(next.steps.equip).toEqual({ status: 'idle' });
  });

  it('closeModal clears the modal and keeps whatever the step record already says', () => {
    const running = applyProgressReducer(bound(), { kind: 'began', step: 'equip', runId: 'r1', units: [unit(0)], startedAtMs: 0 });
    const doneEvent: ApplyEvent = {
      type: 'done',
      runId: 'r1',
      step: 'equip',
      result: { step: 'equip', total: 1, made: 1, skipped: [], failed: null, stop: 'finished', stopCode: null, goldSpent: 0, durationMs: 0 },
    };
    const done = applyProgressReducer(running, { kind: 'event', event: doneEvent });
    const closed = applyProgressReducer(done, { kind: 'closeModal' });
    expect(closed.modal).toBeNull();
    expect(closed.steps.equip).toEqual(done.steps.equip);
  });

  it('continueNext closes the modal and opens the next undone step’s confirm, or none when everything is done', () => {
    const state: ApplyProgressState = {
      ...bound(),
      modal: { step: 'equip', phase: 'done', run: null, stopRequested: false, planRunId: 'run-1' },
      steps: { equip: { status: 'done', made: 1, skipped: 0, total: 1, skips: [] }, forge: { status: 'idle' }, points: { status: 'idle' } },
    };
    const next = applyProgressReducer(state, { kind: 'continueNext' });
    expect(next.modal).toBeNull();
    expect(next.confirming).toBe('forge');

    const allDone: ApplyProgressState = {
      ...state,
      steps: { equip: { status: 'done', made: 1, skipped: 0, total: 1, skips: [] }, forge: { status: 'done', made: 0, skipped: 0, total: 0, skips: [] }, points: { status: 'done', made: 1, skipped: 0, total: 1, skips: [] } },
    };
    expect(applyProgressReducer(allDone, { kind: 'continueNext' }).confirming).toBeNull();
  });
});

describe('the forge row writes its own record', () => {
  it('forgeDone writes a done record with the count total and no skip list', () => {
    const next = applyProgressReducer(bound(), { kind: 'forgeDone', made: 8, skipped: 2 });
    expect(next.steps.forge).toEqual({ status: 'done', made: 8, skipped: 2, total: 10, skips: [] });
  });
});

describe('the forge queue pause flag', () => {
  it('queuePaused and queueResumed flip queuePausedByApply', () => {
    const paused = applyProgressReducer(bound(), { kind: 'queuePaused', by: 'apply' });
    expect(paused.queuePausedByApply).toBe(true);
    const resumed = applyProgressReducer(paused, { kind: 'queueResumed' });
    expect(resumed.queuePausedByApply).toBe(false);
  });
});

// Compile-time proof, not a runtime test: `waitQueue`/`began` take `step: ApplyStep`
// ('equip' | 'points'), so a 'forge' target is a type error here — the typecheck gate is what
// proves this, not an `it()` block that could only assert a tautology.
function neverForgeAtCompileTime(): void {
  // @ts-expect-error — 'forge' is not assignable to ApplyStep.
  const action: ApplyProgressAction = { kind: 'waitQueue', step: 'forge' };
  void action;
}
void neverForgeAtCompileTime;
