import { describe, expect, it } from 'vitest';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { acceptPlan, initialOptimizerPlanState, type OptimizerPlanState } from './optimizer-plan-store';

const PLAN = { gain: 1 } as unknown as TeamPlan;
const OTHER_PLAN = { gain: 2 } as unknown as TeamPlan;

describe('startRun', () => {
  it('starts a new run, clearing any previous plan and recording the signature it was built from', () => {
    const state = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1' });
    expect(state).toEqual({ runStatus: 'running', runId: 'r1', plan: null, signature: 'sig-1' });
  });

  it('is a no-op for the run already in flight', () => {
    const state = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1' });
    expect(acceptPlan(state, { kind: 'startRun', runId: 'r1', signature: 'sig-1' })).toBe(state);
  });

  it('a new Optimize supersedes — starting run r2 drops the plan and signature r1 left', () => {
    const applied: OptimizerPlanState = { runStatus: 'done', runId: 'r1', plan: PLAN, signature: 'sig-1' };
    const state = acceptPlan(applied, { kind: 'startRun', runId: 'r2', signature: 'sig-2' });
    expect(state).toEqual({ runStatus: 'running', runId: 'r2', plan: null, signature: 'sig-2' });
  });
});

describe('resolveRun', () => {
  it('sets the run status for the run currently in flight', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1' });
    const state = acceptPlan(running, { kind: 'resolveRun', runId: 'r1', status: 'blocked' });
    expect(state.runStatus).toBe('blocked');
    expect(state.runId).toBe('r1');
  });

  it('is ignored for a run that has already been superseded', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r2', signature: 'sig-2' });
    const state = acceptPlan(running, { kind: 'resolveRun', runId: 'r1', status: 'error' });
    expect(state).toBe(running);
  });

  it('is a no-op when the status did not actually move', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1' });
    const blocked = acceptPlan(running, { kind: 'resolveRun', runId: 'r1', status: 'blocked' });
    expect(acceptPlan(blocked, { kind: 'resolveRun', runId: 'r1', status: 'blocked' })).toBe(blocked);
  });
});

describe('applyPlan', () => {
  it('applies the plan for the run currently in flight, keeping the recorded signature', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1' });
    const state = acceptPlan(running, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    expect(state).toEqual({ runStatus: 'done', runId: 'r1', plan: PLAN, signature: 'sig-1' });
  });

  it('a late applyPlan for a superseded runId is discarded — a run finished after Cancel or a control change cannot land', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r2', signature: 'sig-2' });
    const state = acceptPlan(running, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    expect(state).toBe(running);
  });

  it('a re-reported applyPlan for the same run and the same plan reference returns the same state', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1' });
    const applied = acceptPlan(running, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    const reReported = acceptPlan(applied, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    expect(reReported).toBe(applied);
  });

  it('a different plan reference for the same run still applies (the runner resolved a fresh result)', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1' });
    const applied = acceptPlan(running, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    const reapplied = acceptPlan(applied, { kind: 'applyPlan', runId: 'r1', plan: OTHER_PLAN });
    expect(reapplied.plan).toBe(OTHER_PLAN);
  });
});

describe('clearPlan', () => {
  it('resets runStatus, runId, plan and signature to idle/null', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1' });
    const applied = acceptPlan(running, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    expect(acceptPlan(applied, { kind: 'clearPlan' })).toEqual(initialOptimizerPlanState);
  });

  it('is a no-op once already idle with nothing recorded', () => {
    expect(acceptPlan(initialOptimizerPlanState, { kind: 'clearPlan' })).toBe(initialOptimizerPlanState);
  });
});
