import { describe, expect, it } from 'vitest';
import type { ForgeDoneEvent, ForgeStepEvent } from '@bombfarm/contracts';
import {
  FORGE_PAUSE_WORTH_SAYING_MS,
  forgeRunReducer,
  IDLE_FORGE_RUN,
  rungTally,
  shouldAdoptLiveAfter,
  type ForgeRunState,
} from './forge-run-reducer';

function step(overrides: Partial<ForgeStepEvent>): ForgeStepEvent {
  return {
    runId: 'r1',
    itemId: 'g1',
    attempt: 1,
    kind: 'roll',
    target: 9,
    from: 8,
    to: 9,
    outcome: 'success',
    cost: 100,
    spent: 100,
    wallet: 900,
    ...overrides,
  };
}

/** A climb from +8 toward +12: three landings, a miss back to the floor, three landings, the top. */
function climb(): ForgeStepEvent[] {
  const path: [number, number, ForgeStepEvent['outcome']][] = [
    [8, 9, 'success'],
    [9, 10, 'success'],
    [10, 11, 'success'],
    [11, 8, 'fail'],
    [8, 9, 'success'],
    [9, 10, 'success'],
    [10, 11, 'success'],
    [11, 12, 'success'],
  ];
  return path.map(([from, to, outcome], index) =>
    step({ attempt: index + 1, target: outcome === 'fail' ? from + 1 : to, from, to, outcome, spent: 100 * (index + 1) }),
  );
}

const DONE: ForgeDoneEvent = {
  runId: 'r1',
  result: {
    itemId: 'g1',
    from: 8,
    to: 12,
    target: 12,
    stop: 'target',
    reached: true,
    rolls: 8,
    fails: 1,
    crits: 0,
    safeJumps: 0,
    spent: 800,
    walletAfter: 200,
    durationMs: 12_000,
  },
};

const PLAN = { forecast: { rolls: 6.5, safeJumps: 0, gold: 650, badRunGold: 1_200 } };

function started(): ForgeRunState {
  return forgeRunReducer(IDLE_FORGE_RUN, { kind: 'start', runId: 'r1', itemId: 'g1', target: 12, from: 8, plan: PLAN });
}

describe('forgeRunReducer', () => {
  it('walks idle → running → done → dismissed → idle', () => {
    let state = started();
    expect(state.status).toBe('running');
    for (const event of climb()) state = forgeRunReducer(state, { kind: 'step', event, adopt: null });
    state = forgeRunReducer(state, { kind: 'done', event: DONE });
    expect(state.status).toBe('done');
    state = forgeRunReducer(state, { kind: 'dismiss' });
    expect(state.status).toBe('dismissed');
    state = forgeRunReducer(state, { kind: 'settle' });
    expect(state).toBe(IDLE_FORGE_RUN);
  });

  it('folds each step into the tally, the level and the wallet, and keeps the plan it started with', () => {
    let state = started();
    for (const event of climb()) state = forgeRunReducer(state, { kind: 'step', event, adopt: null });
    if (state.status !== 'running') throw new Error('expected a running state');
    expect(state.run.tally).toEqual({ rolls: 8, fails: 1, crits: 0, safeJumps: 0, spent: 800 });
    expect(state.run.upgrade).toBe(12);
    expect(state.run.wallet).toBe(900);
    expect(state.run.steps).toHaveLength(8);
    expect(state.run.plan).toBe(PLAN);
    expect(state.run.target).toBe(12);
  });

  it('adopts a step for a run it did not start, learning the target as the climb goes', () => {
    let state = forgeRunReducer(IDLE_FORGE_RUN, { kind: 'step', event: climb()[0] ?? step({}), adopt: null });
    if (state.status !== 'running') throw new Error('expected a running state');
    expect(state.run).toMatchObject({ runId: 'r1', itemId: 'g1', from: 8, upgrade: 9, target: 9, plan: null });
    state = forgeRunReducer(state, { kind: 'step', event: step({ attempt: 2, target: 10, from: 9, to: 10 }), adopt: null });
    if (state.status !== 'running') throw new Error('expected a running state');
    expect(state.run.target).toBe(10);
    expect(state.run.steps).toHaveLength(2);
  });

  it('adopts once for a whole batch of steps, carrying the plan of the piece on screen when it is that piece', () => {
    const adopt = { itemId: 'g1', plan: PLAN };
    let state: ForgeRunState = IDLE_FORGE_RUN;
    for (const event of climb()) state = forgeRunReducer(state, { kind: 'step', event, adopt });
    if (state.status !== 'running') throw new Error('expected a running state');
    expect(state.run.steps).toHaveLength(8);
    expect(state.run.plan).toBe(PLAN);
    expect(state.run.from).toBe(8);
    expect(state.run.target).toBe(12);

    const other = forgeRunReducer(IDLE_FORGE_RUN, { kind: 'step', event: climb()[0] ?? step({}), adopt: { itemId: 'g2', plan: PLAN } });
    if (other.status !== 'running') throw new Error('expected a running state');
    expect(other.run.plan).toBeNull();
  });

  it('remembers that the cancel was asked for, so the button can say the press landed', () => {
    const asked = forgeRunReducer(started(), { kind: 'cancel' });
    if (asked.status !== 'running') throw new Error('expected a running state');
    expect(asked.run.cancelRequested).toBe(true);
    expect(forgeRunReducer(asked, { kind: 'cancel' })).toBe(asked);
  });

  it('keeps the cancel pending through the rolls that land before main stops', () => {
    let state = forgeRunReducer(started(), { kind: 'cancel' });
    for (const event of climb()) state = forgeRunReducer(state, { kind: 'step', event, adopt: null });
    if (state.status !== 'running') throw new Error('expected a running state');
    expect(state.run.cancelRequested).toBe(true);
    expect(state.run.steps).toHaveLength(8);
  });

  it('opens every run with no cancel asked for, however the screen came by it', () => {
    const own = started();
    if (own.status !== 'running') throw new Error('expected a running state');
    expect(own.run.cancelRequested).toBe(false);
    const adopted = forgeRunReducer(IDLE_FORGE_RUN, { kind: 'step', event: step({}), adopt: null });
    if (adopted.status !== 'running') throw new Error('expected a running state');
    expect(adopted.run.cancelRequested).toBe(false);
  });

  it('says nothing about a gap short enough to pass for the roll itself', () => {
    const state = forgeRunReducer(started(), { kind: 'pause', event: { runId: 'r1', ms: FORGE_PAUSE_WORTH_SAYING_MS - 1 } });
    if (state.status !== 'running') throw new Error('expected a running state');
    expect(state.run.pausingMs).toBeNull();
    expect(state).toEqual(started());
  });

  it('holds a gap long enough to look like nothing is happening, and the next step clears it', () => {
    const paused = forgeRunReducer(started(), { kind: 'pause', event: { runId: 'r1', ms: 9_000 } });
    if (paused.status !== 'running') throw new Error('expected a running state');
    expect(paused.run.pausingMs).toBe(9_000);

    const rolled = forgeRunReducer(paused, { kind: 'step', event: step({}), adopt: null });
    if (rolled.status !== 'running') throw new Error('expected a running state');
    expect(rolled.run.pausingMs).toBeNull();
    expect(rolled.run.steps).toHaveLength(1);
  });

  it('clears the gap when the run finishes, so a rail redrawn from the finished run says nothing', () => {
    const paused = forgeRunReducer(started(), { kind: 'pause', event: { runId: 'r1', ms: 9_000 } });
    const finished = forgeRunReducer(paused, { kind: 'done', event: DONE });
    if (finished.status !== 'done') throw new Error('expected a done state');
    expect(finished.run.pausingMs).toBeNull();
  });

  it('ignores a gap belonging to another run, and one with nothing rolling', () => {
    const running = started();
    expect(forgeRunReducer(running, { kind: 'pause', event: { runId: 'other', ms: 9_000 } })).toBe(running);
    expect(forgeRunReducer(IDLE_FORGE_RUN, { kind: 'pause', event: { runId: 'r1', ms: 9_000 } })).toBe(IDLE_FORGE_RUN);
  });

  it('ignores a cancel with nothing rolling', () => {
    expect(forgeRunReducer(IDLE_FORGE_RUN, { kind: 'cancel' })).toBe(IDLE_FORGE_RUN);
    expect(forgeRunReducer({ status: 'dismissed' }, { kind: 'cancel' })).toEqual({ status: 'dismissed' });
  });

  it('ignores a done for a run it is not showing, and a dismiss before done', () => {
    const running = started();
    expect(forgeRunReducer(running, { kind: 'done', event: { ...DONE, runId: 'other' } })).toBe(running);
    expect(forgeRunReducer(running, { kind: 'dismiss' })).toBe(running);
    expect(forgeRunReducer(IDLE_FORGE_RUN, { kind: 'done', event: DONE })).toBe(IDLE_FORGE_RUN);
    expect(forgeRunReducer(IDLE_FORGE_RUN, { kind: 'settle' })).toBe(IDLE_FORGE_RUN);
  });
});

describe('shouldAdoptLiveAfter', () => {
  it('is the one transition where the pinned read stops describing the piece', () => {
    expect(shouldAdoptLiveAfter('running', 'done')).toBe(true);
    expect(shouldAdoptLiveAfter('idle', 'running')).toBe(false);
    expect(shouldAdoptLiveAfter('done', 'dismissed')).toBe(false);
    expect(shouldAdoptLiveAfter('done', 'done')).toBe(false);
  });
});

describe('rungTally', () => {
  it('merges consecutive quiet rungs into one row and leaves the rung that missed on its own', () => {
    expect(rungTally(climb())).toEqual([
      { from: 9, to: 11, rolls: 6, fails: 0, gold: 600 },
      { from: 12, to: 12, rolls: 2, fails: 1, gold: 200 },
    ]);
  });

  it('starts a new quiet row after a rung with a miss, and counts a safe jump as gold without a roll', () => {
    const steps = [
      step({ attempt: 1, kind: 'safe', target: 8, from: 3, to: 8, cost: 50 }),
      step({ attempt: 2, target: 9, from: 8, to: 8, outcome: 'fail' }),
      step({ attempt: 3, target: 9, from: 8, to: 9 }),
      step({ attempt: 4, target: 10, from: 9, to: 10 }),
      step({ attempt: 5, target: 11, from: 10, to: 11 }),
    ];
    expect(rungTally(steps)).toEqual([
      { from: 8, to: 8, rolls: 0, fails: 0, gold: 50 },
      { from: 9, to: 9, rolls: 2, fails: 1, gold: 200 },
      { from: 10, to: 11, rolls: 2, fails: 0, gold: 200 },
    ]);
  });

  it('is empty before the first call', () => {
    expect(rungTally([])).toEqual([]);
  });
});
