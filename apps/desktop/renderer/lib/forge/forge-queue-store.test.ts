import { describe, expect, it } from 'vitest';
import type { ForgeEvent, ForgeRunResult, ForgeStartRequest, ForgeStartResult } from '@bombfarm/contracts';
import type { ForgeQueuePiece } from './forge-queue-reducer';
import { createForgeQueueStore } from './forge-queue-store';

type Bridge = NonNullable<Window['bfc']>;

function fakeBridge(answer: (request: ForgeStartRequest) => ForgeStartResult) {
  const handlers: ((event: ForgeEvent) => void)[] = [];
  const starts: ForgeStartRequest[] = [];
  const cancels: string[] = [];
  return {
    starts,
    cancels,
    push: (event: ForgeEvent) => {
      for (const handler of handlers) handler(event);
    },
    bridge: {
      invoke: (channel: string, arg: unknown) => {
        if (channel === 'forge:start') {
          const request = arg as ForgeStartRequest;
          starts.push(request);
          return Promise.resolve(answer(request));
        }
        if (channel === 'forge:cancel') {
          cancels.push(arg as string);
          return Promise.resolve(true);
        }
        return Promise.resolve(undefined);
      },
      on: (_channel: string, handler: (event: ForgeEvent) => void) => {
        handlers.push(handler);
        return () => undefined;
      },
    } as unknown as Bridge,
  };
}

function done(runId: string, itemId: string, stop: ForgeRunResult['stop']): ForgeEvent {
  return {
    type: 'done',
    runId,
    result: {
      itemId,
      from: 8,
      to: 12,
      target: 12,
      stop,
      reached: stop === 'target',
      rolls: 3,
      fails: 0,
      crits: 0,
      safeJumps: 0,
      spent: 3_000,
      walletAfter: 100,
      durationMs: 5_000,
    },
  };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function memory(initial: readonly ForgeQueuePiece[] = []) {
  let saved: readonly ForgeQueuePiece[] = initial;
  return { load: () => saved, save: (pieces: readonly ForgeQueuePiece[]) => (saved = pieces), read: () => saved };
}

describe('the forge queue store drives main one piece at a time', () => {
  it('asks for the head piece on Start, and for the next one only once the first run is done', async () => {
    let sequence = 0;
    const { bridge, starts, push } = fakeBridge(() => ({ ok: true, runId: `r${String(++sequence)}` }));
    const store = createForgeQueueStore({ bridge, ...memory() });
    store.add('a', 12);
    store.add('b', 10);
    store.startQueue();
    await flush();

    expect(starts).toEqual([{ itemId: 'a', target: 12, maxGold: null, maxAttempts: null }]);
    expect(store.getState().active).toEqual({ itemId: 'a', runId: 'r1' });

    push(done('r1', 'a', 'target'));
    await flush();
    expect(starts.map((request) => request.itemId)).toEqual(['a', 'b']);
    expect(store.getState().pieces.map((piece) => piece.itemId)).toEqual(['b']);

    push(done('r2', 'b', 'target'));
    await flush();
    expect(store.getState()).toMatchObject({ status: 'idle', active: null, pieces: [] });
    expect(starts).toHaveLength(2);
  });

  it('halts on a stop short of the target and asks for nothing more until Start is pressed again', async () => {
    const { bridge, starts, push } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const store = createForgeQueueStore({ bridge, ...memory() });
    store.add('a', 12);
    store.add('b', 10);
    store.startQueue();
    await flush();
    push(done('r1', 'a', 'budget'));
    await flush();

    expect(starts).toHaveLength(1);
    expect(store.getState()).toMatchObject({ status: 'halted', halt: { kind: 'stop', itemId: 'a', stop: 'budget' } });

    store.startQueue();
    await flush();
    expect(starts.map((request) => request.itemId)).toEqual(['a', 'a']);
  });

  it('a refusal about the piece skips it and asks for the next in the same breath; one about the environment halts', async () => {
    const { bridge, starts } = fakeBridge((request) =>
      request.itemId === 'a' ? { ok: false, reason: 'bad_target' } : { ok: false, reason: 'offline' },
    );
    const store = createForgeQueueStore({ bridge, ...memory() });
    store.add('a', 12);
    store.add('b', 10);
    store.startQueue();
    await flush();

    expect(starts.map((request) => request.itemId)).toEqual(['a', 'b']);
    expect(store.getState()).toMatchObject({
      status: 'halted',
      halt: { kind: 'refused', itemId: 'b', reason: 'offline' },
      pieces: [{ itemId: 'b', target: 10 }],
    });
  });

  it('Cancel stops the queue and cancels the run it has in flight, and only that one', async () => {
    const { bridge, cancels, push } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const store = createForgeQueueStore({ bridge, ...memory() });
    store.add('a', 12);
    store.add('b', 10);
    store.startQueue();
    await flush();
    store.cancel();
    expect(cancels).toEqual(['r1']);
    expect(store.getState().status).toBe('idle');

    push(done('r1', 'a', 'cancelled'));
    await flush();
    expect(store.getState()).toMatchObject({ status: 'idle', active: null });
    expect(store.getState().pieces.map((piece) => piece.itemId)).toEqual(['a', 'b']);
    store.cancel();
    expect(cancels).toEqual(['r1']);
  });

  it('a Cancel that lands while main is still answering the start cancels the run the moment it is known', async () => {
    let answer: (result: ForgeStartResult) => void = () => undefined;
    const { bridge, cancels } = fakeBridge(() => ({ ok: true, runId: 'unused' }));
    const raw = bridge as unknown as { invoke: (channel: string, arg: unknown) => Promise<unknown> };
    const slow = {
      ...bridge,
      invoke: (channel: string, arg: unknown) =>
        channel === 'forge:start'
          ? new Promise<ForgeStartResult>((resolve) => {
              answer = resolve;
            })
          : raw.invoke(channel, arg),
    } as unknown as Bridge;
    const store = createForgeQueueStore({ bridge: slow, ...memory() });
    store.add('a', 12);
    store.startQueue();
    await flush();
    store.cancel();
    expect(cancels).toEqual([]);
    answer({ ok: true, runId: 'r-late' });
    await flush();
    expect(cancels).toEqual(['r-late']);
  });

  it('remembers the waiting pieces and restores them paused, in order', async () => {
    const saved = memory();
    const first = createForgeQueueStore({ bridge: fakeBridge(() => ({ ok: false, reason: 'offline' })).bridge, ...saved });
    first.add('a', 12);
    first.add('b', 10);
    expect(saved.read()).toEqual([
      { itemId: 'a', target: 12 },
      { itemId: 'b', target: 10 },
    ]);

    const { bridge, starts } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const second = createForgeQueueStore({ bridge, ...saved });
    second.start();
    await flush();
    expect(second.getState()).toMatchObject({ status: 'idle', active: null });
    expect(second.getState().pieces).toEqual(saved.read());
    expect(starts).toEqual([]);
  });

  it('a piece forged to its target elsewhere is dropped by the next bag sync and forgotten', () => {
    const saved = memory();
    const store = createForgeQueueStore({ bridge: null, ...saved });
    store.add('a', 12);
    store.add('b', 10);
    store.sync(new Map([['a', 12], ['b', 4]]));
    expect(store.getState().pieces).toEqual([{ itemId: 'b', target: 10 }]);
    expect(saved.read()).toEqual([{ itemId: 'b', target: 10 }]);
  });
});
