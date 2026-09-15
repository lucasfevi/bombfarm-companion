import { describe, expect, it } from 'vitest';
import type { ForgeEvent, ForgeStepEvent } from '@bombfarm/contracts';
import { createForgeRunStore } from './forge-run-store';

type Bridge = NonNullable<Window['bfc']>;

function fakeBridge() {
  const handlers: ((event: ForgeEvent) => void)[] = [];
  return {
    push: (event: ForgeEvent) => {
      for (const handler of handlers) handler(event);
    },
    subscriptions: () => handlers.length,
    bridge: {
      invoke: () => Promise.resolve(undefined),
      on: (_channel: string, handler: (event: ForgeEvent) => void) => {
        handlers.push(handler);
        return () => undefined;
      },
    } as unknown as Bridge,
  };
}

function step(overrides: Partial<ForgeStepEvent>): ForgeEvent {
  return {
    type: 'step',
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

const DONE: ForgeEvent = {
  type: 'done',
  runId: 'r1',
  result: {
    itemId: 'g1',
    from: 8,
    to: 10,
    target: 10,
    stop: 'target',
    reached: true,
    rolls: 2,
    fails: 0,
    crits: 0,
    safeJumps: 0,
    spent: 200,
    walletAfter: 800,
    durationMs: 2_000,
  },
};

const PLAN = { forecast: { rolls: 2, safeJumps: 0, gold: 200, badRunGold: 400 } };

describe('the forge run store', () => {
  it('keeps folding steps while no screen is subscribed, which is what surviving a tab change means', () => {
    const { bridge, push } = fakeBridge();
    const store = createForgeRunStore(bridge);
    store.start();

    const unsubscribe = store.subscribe(() => undefined);
    push(step({ attempt: 1, from: 8, to: 9, target: 9 }));
    unsubscribe();

    push(step({ attempt: 2, from: 9, to: 10, target: 10, spent: 200, wallet: 800 }));

    const held = store.getState();
    expect(held.status).toBe('running');
    if (held.status !== 'running') return;
    expect(held.run.steps).toHaveLength(2);
    expect(held.run.upgrade).toBe(10);
    expect(held.run.tally.rolls).toBe(2);
  });

  it('holds a run that finished while nobody was looking, so the result is still there on return', () => {
    const { bridge, push } = fakeBridge();
    const store = createForgeRunStore(bridge);
    store.start();

    push(step({ attempt: 1 }));
    push(step({ attempt: 2, from: 9, to: 10, target: 10, spent: 200, wallet: 800 }));
    push(DONE);

    const held = store.getState();
    expect(held.status).toBe('done');
    if (held.status !== 'done') return;
    expect(held.result.reached).toBe(true);
    expect(held.run.steps).toHaveLength(2);
  });

  it('subscribes to forge:event once for the window, however many times it is started', () => {
    const { bridge, subscriptions } = fakeBridge();
    const store = createForgeRunStore(bridge);
    store.start();
    store.start();
    store.dispatch({ kind: 'dismiss' });
    expect(subscriptions()).toBe(1);
  });

  it('adopts a run it did not start with the plan on screen at the time the step lands', () => {
    const { bridge, push } = fakeBridge();
    const store = createForgeRunStore(bridge);
    store.start();

    store.setAdoption({ itemId: 'g1', plan: PLAN });
    push(step({ attempt: 1 }));

    const held = store.getState();
    expect(held.status).toBe('running');
    if (held.status !== 'running') return;
    expect(held.run.plan).toEqual(PLAN);
  });

  it('leaves the plan off a run adopted for a piece other than the one on screen', () => {
    const { bridge, push } = fakeBridge();
    const store = createForgeRunStore(bridge);
    store.start();

    store.setAdoption({ itemId: 'other', plan: PLAN });
    push(step({ attempt: 1 }));

    const held = store.getState();
    if (held.status !== 'running') throw new Error(held.status);
    expect(held.run.plan).toBeNull();
  });

  it('dispatches through to the reducer, starting itself if the screen has not yet', () => {
    const { bridge } = fakeBridge();
    const store = createForgeRunStore(bridge);
    store.dispatch({ kind: 'start', runId: 'r2', itemId: 'g1', target: 12, from: 8, plan: null });
    expect(store.getState().status).toBe('running');
    store.dispatch({ kind: 'cancel' });
    const held = store.getState();
    if (held.status !== 'running') throw new Error(held.status);
    expect(held.run.cancelRequested).toBe(true);
  });

  it('tells a subscriber about every change and stops once unsubscribed', () => {
    const { bridge, push } = fakeBridge();
    const store = createForgeRunStore(bridge);
    store.start();
    let seen = 0;
    const stop = store.subscribe(() => {
      seen += 1;
    });
    push(step({ attempt: 1 }));
    expect(seen).toBe(1);
    stop();
    push(step({ attempt: 2, from: 9, to: 10, target: 10 }));
    expect(seen).toBe(1);
  });

  it('stays idle without a bridge rather than throwing', () => {
    const store = createForgeRunStore(null);
    store.start();
    expect(store.getState().status).toBe('idle');
  });
});
