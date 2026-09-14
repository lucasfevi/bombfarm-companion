import { describe, expect, it } from 'vitest';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { acceptPlan, initialOptimizerPlanState, type OptimizerPlanState } from './optimizer-plan-store';

const PLAN = { gain: 1 } as unknown as TeamPlan;
const OTHER_PLAN = { gain: 2 } as unknown as TeamPlan;
const HEROES = [{ id: 'h1', name: 'Alpha' }] as unknown as readonly HeroRecord[];
const LATER_HEROES = [{ id: 'h2', name: 'Beta' }] as unknown as readonly HeroRecord[];

describe('startRun', () => {
  it('starts a new run, clearing any previous plan and recording the signature it was built from', () => {
    const state = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1', heroes: HEROES });
    expect(state).toEqual({
      runStatus: 'running',
      runId: 'r1',
      plan: null,
      signature: 'sig-1',
      heroes: HEROES,
      openHeroIds: null,
    });
  });

  it('is a no-op for the run already in flight', () => {
    const state = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1', heroes: HEROES });
    expect(acceptPlan(state, { kind: 'startRun', runId: 'r1', signature: 'sig-1', heroes: HEROES })).toBe(state);
  });

  it('a new Optimize supersedes — starting run r2 drops the plan and signature r1 left', () => {
    const applied: OptimizerPlanState = {
      runStatus: 'done',
      runId: 'r1',
      plan: PLAN,
      signature: 'sig-1',
      heroes: HEROES,
      openHeroIds: ['h1'],
    };
    const state = acceptPlan(applied, { kind: 'startRun', runId: 'r2', signature: 'sig-2', heroes: LATER_HEROES });
    expect(state).toEqual({
      runStatus: 'running',
      runId: 'r2',
      plan: null,
      signature: 'sig-2',
      heroes: LATER_HEROES,
      openHeroIds: null,
    });
  });

  it('records the roster the run was solved from, so the result rows outlive a re-taken snapshot', () => {
    const state = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1', heroes: HEROES });
    const applied = acceptPlan(state, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    expect(applied.heroes).toBe(HEROES);
  });
});

describe('resolveRun', () => {
  it('sets the run status for the run currently in flight', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1', heroes: HEROES });
    const state = acceptPlan(running, { kind: 'resolveRun', runId: 'r1', status: 'blocked' });
    expect(state.runStatus).toBe('blocked');
    expect(state.runId).toBe('r1');
  });

  it('is ignored for a run that has already been superseded', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r2', signature: 'sig-2', heroes: HEROES });
    const state = acceptPlan(running, { kind: 'resolveRun', runId: 'r1', status: 'error' });
    expect(state).toBe(running);
  });

  it('is a no-op when the status did not actually move', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1', heroes: HEROES });
    const blocked = acceptPlan(running, { kind: 'resolveRun', runId: 'r1', status: 'blocked' });
    expect(acceptPlan(blocked, { kind: 'resolveRun', runId: 'r1', status: 'blocked' })).toBe(blocked);
  });
});

describe('applyPlan', () => {
  it('applies the plan for the run currently in flight, keeping the recorded signature', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1', heroes: HEROES });
    const state = acceptPlan(running, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    expect(state).toEqual({
      runStatus: 'done',
      runId: 'r1',
      plan: PLAN,
      signature: 'sig-1',
      heroes: HEROES,
      openHeroIds: null,
    });
  });

  it('a new plan opens the default rows again, whatever the previous plan had open', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1', heroes: HEROES });
    const opened = acceptPlan(running, { kind: 'openHeroes', heroIds: ['h1', 'h2'] });
    expect(acceptPlan(opened, { kind: 'applyPlan', runId: 'r1', plan: PLAN }).openHeroIds).toBeNull();
  });

  it('a late applyPlan for a superseded runId is discarded — a run finished after Cancel or a control change cannot land', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r2', signature: 'sig-2', heroes: HEROES });
    const state = acceptPlan(running, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    expect(state).toBe(running);
  });

  it('a re-reported applyPlan for the same run and the same plan reference returns the same state', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1', heroes: HEROES });
    const applied = acceptPlan(running, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    const reReported = acceptPlan(applied, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    expect(reReported).toBe(applied);
  });

  it('a different plan reference for the same run still applies (the runner resolved a fresh result)', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1', heroes: HEROES });
    const applied = acceptPlan(running, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    const reapplied = acceptPlan(applied, { kind: 'applyPlan', runId: 'r1', plan: OTHER_PLAN });
    expect(reapplied.plan).toBe(OTHER_PLAN);
  });
});

describe('clearPlan', () => {
  it('resets runStatus, runId, plan, signature, roster and open rows to idle/null', () => {
    const running = acceptPlan(initialOptimizerPlanState, { kind: 'startRun', runId: 'r1', signature: 'sig-1', heroes: HEROES });
    const applied = acceptPlan(running, { kind: 'applyPlan', runId: 'r1', plan: PLAN });
    const opened = acceptPlan(applied, { kind: 'openHeroes', heroIds: ['h1'] });
    expect(acceptPlan(opened, { kind: 'clearPlan' })).toEqual(initialOptimizerPlanState);
  });

  it('is a no-op once already idle with nothing recorded', () => {
    expect(acceptPlan(initialOptimizerPlanState, { kind: 'clearPlan' })).toBe(initialOptimizerPlanState);
  });

  it('rows left open with no plan behind them are still something to clear', () => {
    const opened = acceptPlan(initialOptimizerPlanState, { kind: 'openHeroes', heroIds: ['h1'] });
    expect(acceptPlan(opened, { kind: 'clearPlan' })).toEqual(initialOptimizerPlanState);
  });
});

describe('openHeroes', () => {
  it('records the rows the player has open, as their own copy', () => {
    const heroIds = ['h1', 'h3'];
    const state = acceptPlan(initialOptimizerPlanState, { kind: 'openHeroes', heroIds });
    expect(state.openHeroIds).toEqual(['h1', 'h3']);
    expect(state.openHeroIds).not.toBe(heroIds);
  });

  it('is a no-op when the same rows are already open', () => {
    const opened = acceptPlan(initialOptimizerPlanState, { kind: 'openHeroes', heroIds: ['h1', 'h3'] });
    expect(acceptPlan(opened, { kind: 'openHeroes', heroIds: ['h1', 'h3'] })).toBe(opened);
  });

  it('closing every row is a different state from the default, which opens the first hero', () => {
    const opened = acceptPlan(initialOptimizerPlanState, { kind: 'openHeroes', heroIds: ['h1'] });
    const closed = acceptPlan(opened, { kind: 'openHeroes', heroIds: [] });
    expect(closed.openHeroIds).toEqual([]);
    expect(acceptPlan(initialOptimizerPlanState, { kind: 'openHeroes', heroIds: [] }).openHeroIds).toEqual([]);
  });
});
