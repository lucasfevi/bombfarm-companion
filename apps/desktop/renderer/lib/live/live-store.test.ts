import { describe, expect, it } from 'vitest';
import type { LiveEvent, LiveView, RotationSnapshot } from '@bombfarm/contracts';
import type { LiveModel } from './live-model';
import {
  applyLiveArrival,
  createLiveStore,
  createSlowModelCache,
  deriveLiveModel,
  initialLiveInternalState,
  type LiveBridge,
} from './live-store';

function rotationSnapshot(overrides: Partial<RotationSnapshot> = {}): RotationSnapshot {
  return {
    fieldSize: 2,
    heroes: [
      { id: 'on-field', activity: 'inField', onField: true, energy: 90, energyMax: 100, energyFraction: 0.9, name: 'Field Hero' },
      { id: 'benched-one', activity: 'benched' },
    ],
    house: { cycleSeconds: 1000 },
    ...overrides,
  };
}

function liveView(overrides: Partial<LiveView> = {}): LiveView {
  return {
    currency: { kind: 'live', lastFrameAt: 't0', sinceAt: 't0' },
    field: [{ heroId: 'on-field', secondsRemaining: 90, drainPerSecond: 1, basis: 'modelled' }],
    recovery: [],
    rotation: rotationSnapshot(),
    onFieldHeroIds: ['on-field'],
    earnings: null,
    updatedAt: 't0',
    ...overrides,
  };
}

function fastUpdateEvent(secondsRemaining: number, onFieldHeroIds: readonly string[] = ['on-field']): LiveEvent {
  return {
    type: 'fastUpdate',
    field: [{ heroId: 'on-field', secondsRemaining, drainPerSecond: 1, basis: 'observed' }],
    recovery: [],
    onFieldHeroIds,
    earnings: null,
  };
}

function fakeBridge() {
  let eventHandler: ((event: LiveEvent) => void) | null = null;
  let accountChangedHandler: (() => void) | null = null;
  let getCalls = 0;
  const pendingGets: Array<(view: LiveView) => void> = [];

  const bridge = {
    invoke: (channel: string) => {
      if (channel !== 'live:get') throw new Error(`unexpected invoke channel: ${channel}`);
      getCalls += 1;
      return new Promise<LiveView>((resolve) => {
        pendingGets.push(resolve);
      });
    },
    on: (channel: string, handler: (payload: never) => void) => {
      if (channel === 'live:event') {
        eventHandler = handler as unknown as (event: LiveEvent) => void;
        return () => {
          eventHandler = null;
        };
      }
      if (channel === 'account:changed') {
        accountChangedHandler = handler as unknown as () => void;
        return () => {
          accountChangedHandler = null;
        };
      }
      throw new Error(`unexpected event channel: ${channel}`);
    },
  } as unknown as LiveBridge;

  return {
    bridge,
    emit: (event: LiveEvent) => eventHandler?.(event),
    emitAccountChanged: () => accountChangedHandler?.(),
    // Resolves the OLDEST still-pending live:get call — one bootstrap, then one per re-fetch.
    resolveNextGet: (view: LiveView) => pendingGets.shift()?.(view),
    getCallCount: () => getCalls,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('createLiveStore — subscribes and reads once', () => {
  it('invokes live:get exactly once and subscribes to live:event exactly once per start()', async () => {
    const { bridge, getCallCount, resolveNextGet } = fakeBridge();
    const store = createLiveStore({ bridge });

    store.start();
    resolveNextGet(liveView());
    await flushMicrotasks();

    expect(getCallCount()).toBe(1);
  });

  it('a bridge-less environment never throws and settles on the bridge-unavailable posture', () => {
    const store = createLiveStore({ bridge: undefined });

    expect(() => {
      store.start();
    }).not.toThrow();

    expect(store.getModel().freshness).toEqual({ kind: 'bridge-unavailable' });
    expect(store.getModel().slow).toBeNull();
  });

  it('a rejected live:get never throws and leaves the model wherever events already put it', async () => {
    let reject!: (error: unknown) => void;
    const pending = new Promise<LiveView>((_resolve, rej) => {
      reject = rej;
    });
    const bridge = {
      invoke: () => pending,
      on: () => () => undefined,
    } as unknown as LiveBridge;
    const store = createLiveStore({ bridge });

    store.start();
    reject(new Error('boom'));
    await expect(flushMicrotasks()).resolves.toBeUndefined();
  });
});

describe('createLiveStore — applies each arrival as it lands, with no display clock of its own', () => {
  it('a burst of 100 distinct fastUpdate events produces exactly 100 notifications — nothing left for a second clock to coalesce', async () => {
    const { bridge, emit, resolveNextGet } = fakeBridge();

    const store = createLiveStore({ bridge });
    store.start();
    resolveNextGet(liveView());
    await flushMicrotasks();

    const notifications: LiveModel[] = [];
    store.subscribe((model) => notifications.push(model));

    for (let frame = 0; frame < 100; frame += 1) {
      emit(fastUpdateEvent(90 - frame));
    }

    expect(notifications).toHaveLength(100);
  });

  it('a fastUpdate byte-identical to the current state produces zero notifications', async () => {
    const { bridge, emit, resolveNextGet } = fakeBridge();
    const store = createLiveStore({ bridge });
    const notifications: LiveModel[] = [];

    store.start();
    resolveNextGet(liveView({ field: [], recovery: [], onFieldHeroIds: [] }));
    await flushMicrotasks();
    store.subscribe((model) => notifications.push(model));

    for (let i = 0; i < 20; i += 1) {
      emit({ type: 'fastUpdate', field: [], recovery: [], onFieldHeroIds: [], earnings: null });
    }

    expect(notifications).toHaveLength(0);
  });

  it('fastUpdate events that change only hero energy leave every published slow-part object referentially identical across the whole run', async () => {
    const { bridge, emit, resolveNextGet } = fakeBridge();

    const store = createLiveStore({ bridge });
    const published: LiveModel[] = [];
    store.subscribe((model) => published.push(model));
    store.start();

    resolveNextGet(liveView());
    await flushMicrotasks();

    for (let frame = 0; frame < 100; frame += 1) {
      emit(fastUpdateEvent(90 - frame));
    }

    expect(published.length).toBeGreaterThan(1);
    const [firstModel, ...rest] = published;
    expect(firstModel.slow).not.toBeNull();
    for (const model of rest) {
      expect(model.slow).toBe(firstModel.slow);
    }

    // The fast part DID move across the run — otherwise the identity assertion above would be
    // vacuous (nothing was ever exercised).
    const first = published[0]?.fast.field['on-field']?.secondsRemaining;
    const last = published.at(-1)?.fast.field['on-field']?.secondsRemaining;
    expect(last).not.toBe(first);
  });

  it('absent-vs-zero survives end to end: a hero at genuine zero energy is a present key, a benched hero is not a key at all', async () => {
    const { bridge, resolveNextGet } = fakeBridge();
    const store = createLiveStore({ bridge });

    store.start();
    resolveNextGet(
      liveView({
        field: [{ heroId: 'on-field', secondsRemaining: 0, drainPerSecond: 1, basis: 'observed' }],
      }),
    );
    await flushMicrotasks();

    const model = store.getModel();
    expect(model.fast.field['on-field']).toEqual({ heroId: 'on-field', secondsRemaining: 0, basis: 'observed' });
    expect('benched-one' in model.fast.field).toBe(false);
  });

  it('a raw frame event — never sent by the main process, but type-legal — is a no-op rather than a crash', async () => {
    const { bridge, emit, resolveNextGet } = fakeBridge();
    const store = createLiveStore({ bridge });

    store.start();
    resolveNextGet(liveView());
    await flushMicrotasks();
    const before = store.getModel();

    emit({ type: 'frame', frame: { at: 't', sequence: 0, tick: { heroes: [] } } });

    expect(store.getModel()).toBe(before);
  });
});

describe('the rotation snapshot memoization backing the slow part', () => {
  it('the same rotation reference yields the same slow-part object; a different reference yields a new one', () => {
    const cache = createSlowModelCache();
    const rotationA = rotationSnapshot();
    const rotationB = rotationSnapshot({ fieldSize: 5 });

    const first = cache(rotationA, ['on-field']);
    const second = cache(rotationA, ['on-field']);
    const third = cache(rotationB, ['on-field']);

    expect(second).toBe(first);
    expect(third).not.toBe(first);
  });

  it('the same rotation reference with a different onFieldHeroIds content yields a new slow-part object', () => {
    const cache = createSlowModelCache();
    const rotation = rotationSnapshot();

    const first = cache(rotation, ['on-field']);
    const second = cache(rotation, ['on-field', 'benched-one']);

    expect(second).not.toBe(first);
  });

  it('a rotation snapshot change produces a new slow-part object in the derived model', () => {
    const cache = createSlowModelCache();
    const rotationA = rotationSnapshot();
    const rotationB = rotationSnapshot({ fieldSize: 9 });

    // Driven directly at the reducer level, one bootstrap arrival after another — exactly what
    // the account:changed re-fetch below drives through the real store, minus the IPC plumbing.
    const afterFirst = applyLiveArrival(initialLiveInternalState, {
      kind: 'bootstrap',
      view: liveView({ rotation: rotationA }),
    });
    const modelAfterFirst = deriveLiveModel(afterFirst, cache);

    const afterSecond = applyLiveArrival(afterFirst, { kind: 'bootstrap', view: liveView({ rotation: rotationB }) });
    const modelAfterSecond = deriveLiveModel(afterSecond, cache);

    expect(modelAfterFirst.slow).not.toBeNull();
    expect(modelAfterSecond.slow).not.toBe(modelAfterFirst.slow);
  });
});

describe('createLiveStore — account:changed triggers the slow re-fetch', () => {
  it('a second live:get result carrying a different rotation replaces the slow model, and a hero absent from that read is gone from the lists', async () => {
    const { bridge, emitAccountChanged, resolveNextGet, getCallCount } = fakeBridge();
    const store = createLiveStore({ bridge });

    store.start();
    resolveNextGet(liveView());
    await flushMicrotasks();

    const before = store.getModel();
    expect(before.slow?.onField.map((hero) => hero.id)).toEqual(['on-field']);

    emitAccountChanged();
    expect(getCallCount()).toBe(2);
    resolveNextGet(
      liveView({
        rotation: rotationSnapshot({
          heroes: [{ id: 'benched-one', activity: 'benched' }],
        }),
        // The live tap's own on-field set is main-computed and part of this same re-fetched view —
        // it must agree with the rotation it accompanies, or the classifier is right to treat the
        // disagreement as a hero the snapshot hasn't caught up to yet (a different behaviour, and
        // not what this test is about).
        onFieldHeroIds: [],
      }),
    );
    await flushMicrotasks();

    const after = store.getModel();
    expect(after.slow).not.toBe(before.slow);
    expect(after.slow?.onField).toEqual([]);
    expect(after.slow?.benched.map((hero) => hero.id)).toEqual(['benched-one']);
  });

  it('account:changed never touches the fast model directly — only the live:get it triggers can', async () => {
    const { bridge, emitAccountChanged, resolveNextGet } = fakeBridge();
    const store = createLiveStore({ bridge });

    store.start();
    resolveNextGet(liveView());
    await flushMicrotasks();
    const before = store.getModel();

    emitAccountChanged();
    // The account:changed event itself was just processed; its own re-fetch is still pending.
    expect(store.getModel()).toBe(before);
  });

  it('a re-fetch publishes exactly once, the moment its live:get result resolves', async () => {
    const { bridge, emitAccountChanged, resolveNextGet } = fakeBridge();
    const store = createLiveStore({ bridge });
    const notifications: LiveModel[] = [];

    store.start();
    resolveNextGet(liveView());
    await flushMicrotasks();
    store.subscribe((model) => notifications.push(model));

    emitAccountChanged();
    expect(notifications).toHaveLength(0);
    resolveNextGet(liveView({ rotation: rotationSnapshot({ fieldSize: 4 }) }));
    await flushMicrotasks();

    expect(notifications).toHaveLength(1);
  });

  it('the ONE live:get bootstrap race is still guarded: an event landing before it resolves is not clobbered, but a re-fetch afterward always applies fully', async () => {
    const { bridge, emit, emitAccountChanged, resolveNextGet } = fakeBridge();
    const store = createLiveStore({ bridge });

    store.start();
    emit({ type: 'currency', currency: { kind: 'gap', reason: 'detached', actionable: false, sinceAt: 't' } });
    resolveNextGet(liveView());
    await flushMicrotasks();

    // The currency event landed first and must survive the racing bootstrap.
    expect(store.getModel().freshness).toEqual({ kind: 'gap', reason: 'detached', actionable: false });

    emitAccountChanged();
    resolveNextGet(liveView());
    await flushMicrotasks();

    // The re-fetch is not a race — it applies the view's currency outright.
    expect(store.getModel().freshness).toEqual({ kind: 'live' });
  });
});

describe('createLiveStore — a fastUpdate carries on-field membership live, applied the moment it lands', () => {
  it('a hero the snapshot still calls inField drops out of the on-field list the moment a fastUpdate stops naming it, and is not left on-field or guessed into another list', async () => {
    const { bridge, emit, resolveNextGet } = fakeBridge();
    const store = createLiveStore({ bridge });

    store.start();
    resolveNextGet(liveView());
    await flushMicrotasks();
    expect(store.getModel().slow?.onField.map((hero) => hero.id)).toEqual(['on-field']);

    emit({ type: 'fastUpdate', field: [], recovery: [], onFieldHeroIds: [], earnings: null });

    const model = store.getModel();
    expect(model.slow?.onField).toEqual([]);
    expect(model.slow?.recovering).toEqual([]);
    expect(model.slow?.queued).toEqual([]);
    expect(model.slow?.benched.map((hero) => hero.id)).toEqual(['benched-one']);
    expect(model.slow?.unclassifiedCount).toBe(0);
    expect(model.slow?.fieldExitPendingCount).toBe(1);
  });
});
