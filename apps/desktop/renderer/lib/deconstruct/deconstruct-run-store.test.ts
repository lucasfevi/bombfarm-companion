import { describe, expect, it, vi } from 'vitest';
import type { DeconstructEvent, DeconstructStartResult } from '@bombfarm/contracts';
import type { ForgeQueuePort } from '../forge/forge-queue-store';
import { EMPTY_FORGE_QUEUE, type ForgeQueueState } from '../forge/forge-queue-reducer';
import { createDeconstructRunStore } from './deconstruct-run-store';

type Bridge = NonNullable<Window['bfc']>;

function fakeBridge(reply: () => Promise<DeconstructStartResult>) {
  const handlers: ((event: DeconstructEvent) => void)[] = [];
  const invoke = vi.fn((_channel: string, _request: unknown) => reply());
  return {
    invoke,
    push: (event: DeconstructEvent) => {
      for (const handler of handlers) handler(event);
    },
    subscriptions: () => handlers.length,
    bridge: {
      invoke,
      on: (_channel: string, handler: (event: DeconstructEvent) => void) => {
        handlers.push(handler);
        return () => undefined;
      },
    } as unknown as Bridge,
  };
}

function fakeQueue(initial: ForgeQueueState = EMPTY_FORGE_QUEUE) {
  let state = initial;
  const listeners = new Set<(state: ForgeQueueState) => void>();
  const port: ForgeQueuePort = {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    pause: vi.fn(() => {
      set({ ...state, status: 'paused' });
    }),
    resume: vi.fn(() => {
      set({ ...state, status: 'running' });
    }),
  };
  function set(next: ForgeQueueState) {
    state = next;
    for (const listener of [...listeners]) listener(state);
  }
  return { port, set };
}

const RUNNING_QUEUE: ForgeQueueState = { ...EMPTY_FORGE_QUEUE, status: 'running', pieces: [{ itemId: 'g', target: 9 }] };

const ACCEPTED = () => Promise.resolve<DeconstructStartResult>({ ok: true, runId: 'r1' });

function burnedEvent(itemIds: string[] = ['1', '2']): DeconstructEvent {
  return { type: 'done', runId: 'r1', itemIds, result: { status: 'burned', burned: itemIds.length, gained: 70, essence: 770 } };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function build(options: { reply?: () => Promise<DeconstructStartResult>; queue?: ForgeQueueState } = {}) {
  const bridge = fakeBridge(options.reply ?? ACCEPTED);
  const queue = fakeQueue(options.queue);
  const onBurned = vi.fn();
  const store = createDeconstructRunStore({ bridge: bridge.bridge, queue: queue.port, onBurned });
  store.start();
  return { store, bridge, queue, onBurned };
}

describe('the deconstruct run store', () => {
  it('sends exactly the ids it was given through deconstruct:start, once', async () => {
    const { store, bridge } = build();
    store.burn(['11', '22', '33']);
    await settle();
    expect(bridge.invoke).toHaveBeenCalledTimes(1);
    expect(bridge.invoke).toHaveBeenCalledWith('deconstruct:start', { itemIds: ['11', '22', '33'] });
    expect(store.getState()).toEqual({ status: 'running', runId: 'r1', itemIds: ['11', '22', '33'] });
  });

  it('subscribes to the event channel once, however often it is started', () => {
    const { store, bridge } = build();
    store.start();
    store.start();
    expect(bridge.subscriptions()).toBe(1);
  });

  it('ignores a second burn while the first is still in flight', async () => {
    const { store, bridge } = build();
    store.burn(['1']);
    store.burn(['2']);
    await settle();
    store.burn(['3']);
    expect(bridge.invoke).toHaveBeenCalledTimes(1);
  });

  it('keeps folding the answer while no screen is subscribed, which is what surviving a tab change means', async () => {
    const { store, bridge } = build();
    store.burn(['1', '2']);
    await settle();
    bridge.push(burnedEvent());
    const seen: string[] = [];
    store.subscribe((state) => seen.push(state.status));
    expect(store.getState()).toMatchObject({ status: 'result', outcome: { kind: 'burned', gained: 70, essence: 770 } });
  });

  it('drops the burned ids from the selection, and only when something was burned', async () => {
    const { store, bridge, onBurned } = build();
    store.burn(['1', '2']);
    await settle();
    bridge.push({ type: 'done', runId: 'r1', itemIds: ['1', '2'], result: { status: 'refused', code: 'ITEM_LOCKED' } });
    expect(onBurned).not.toHaveBeenCalled();

    store.dismiss();
    store.burn(['1', '2']);
    await settle();
    bridge.push({ type: 'done', runId: 'r1', itemIds: ['1', '2'], result: { status: 'failed', reason: 'network' } });
    expect(onBurned).not.toHaveBeenCalled();

    store.dismiss();
    store.burn(['1', '2']);
    await settle();
    bridge.push(burnedEvent(['1', '2']));
    expect(onBurned).toHaveBeenCalledTimes(1);
    expect(onBurned).toHaveBeenCalledWith(['1', '2']);
  });

  it('ignores an event that is not a deconstruct answer', async () => {
    const { store, bridge } = build();
    store.burn(['1']);
    await settle();
    bridge.push({ type: 'done', runId: '', itemIds: [], result: { status: 'burned', burned: 0, gained: 0, essence: 0 } });
    expect(store.getState().status).toBe('running');
  });

  it('shows a refused start as a result and lets a new burn follow it', async () => {
    const { store, bridge } = build({ reply: () => Promise.resolve({ ok: false, reason: 'writes_disabled' }) });
    store.burn(['1']);
    await settle();
    expect(store.getState()).toMatchObject({ status: 'result', outcome: { kind: 'start-refused', reason: 'writes_disabled' } });
    store.burn(['1']);
    await settle();
    expect(bridge.invoke).toHaveBeenCalledTimes(2);
  });

  it('reports a start that threw as the app still starting', async () => {
    const { store } = build({ reply: () => Promise.reject(new Error('ipc')) });
    store.burn(['1']);
    await settle();
    expect(store.getState()).toMatchObject({ status: 'result', outcome: { kind: 'start-refused', reason: 'unavailable' } });
  });

  it('refuses without a bridge instead of hanging in starting', () => {
    const store = createDeconstructRunStore({ bridge: null, queue: fakeQueue().port, onBurned: vi.fn() });
    store.start();
    store.burn(['1']);
    expect(store.getState()).toMatchObject({ status: 'result', outcome: { kind: 'start-refused', reason: 'unavailable' } });
  });

  describe('beside the forge queue', () => {
    it('leaves an idle queue alone', async () => {
      const { store, queue, bridge } = build();
      store.burn(['1']);
      await settle();
      bridge.push(burnedEvent(['1']));
      expect(queue.port.pause).not.toHaveBeenCalled();
      expect(queue.port.resume).not.toHaveBeenCalled();
    });

    it('stands a running queue aside for the burn and returns it once the answer is in', async () => {
      const { store, queue, bridge } = build({ queue: RUNNING_QUEUE });
      store.burn(['1']);
      expect(queue.port.pause).toHaveBeenCalledTimes(1);
      await settle();
      expect(bridge.invoke).toHaveBeenCalledTimes(1);
      expect(queue.port.resume).not.toHaveBeenCalled();
      bridge.push(burnedEvent(['1']));
      expect(queue.port.resume).toHaveBeenCalledTimes(1);
    });

    it('holds the burn until the piece the queue has in flight lets go of the write lock', async () => {
      const inFlight: ForgeQueueState = { ...RUNNING_QUEUE, active: { itemId: 'g', runId: 'f1' } };
      const { store, queue, bridge } = build({ queue: inFlight });
      store.burn(['1']);
      await settle();
      expect(queue.port.pause).toHaveBeenCalledTimes(1);
      expect(bridge.invoke).not.toHaveBeenCalled();

      queue.set({ ...inFlight, status: 'paused', active: null });
      await settle();
      expect(bridge.invoke).toHaveBeenCalledTimes(1);
    });

    it('returns the queue when the start is refused, since no answer event will come', async () => {
      const { store, queue } = build({ queue: RUNNING_QUEUE, reply: () => Promise.resolve({ ok: false, reason: 'busy' }) });
      store.burn(['1']);
      await settle();
      expect(queue.port.resume).toHaveBeenCalledTimes(1);
    });

    it('returns the queue when the start throws', async () => {
      const { store, queue } = build({ queue: RUNNING_QUEUE, reply: () => Promise.reject(new Error('ipc')) });
      store.burn(['1']);
      await settle();
      expect(queue.port.resume).toHaveBeenCalledTimes(1);
    });

    it('does not resume a queue it never paused when an answer arrives', async () => {
      const { store, queue, bridge } = build({ queue: { ...EMPTY_FORGE_QUEUE, status: 'paused' } });
      store.burn(['1']);
      await settle();
      bridge.push(burnedEvent(['1']));
      expect(queue.port.resume).not.toHaveBeenCalled();
    });
  });
});
