import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ApplyEvent, ApplyStartRequest, ApplyStartResult, ApplyStopReason } from '@bombfarm/contracts';
import type { ForgeQueueState } from '../forge/forge-queue-reducer';
import type { ForgeQueuePort } from '../forge/forge-queue-store';
import { createApplyStore } from './apply-store';
import type { ApplyUnitLabel } from './apply-labels';

type Bridge = NonNullable<Window['bfc']>;

function fakeBridge(answer: (request: ApplyStartRequest) => ApplyStartResult) {
  const handlers: ((event: ApplyEvent) => void)[] = [];
  const starts: ApplyStartRequest[] = [];
  const stops: string[] = [];
  return {
    starts,
    stops,
    push: (event: ApplyEvent) => {
      for (const handler of handlers) handler(event);
    },
    bridge: {
      invoke: (channel: string, arg: unknown) => {
        if (channel === 'apply:start') {
          const request = arg as ApplyStartRequest;
          starts.push(request);
          return Promise.resolve(answer(request));
        }
        if (channel === 'apply:stop') {
          stops.push(arg as string);
          return Promise.resolve(true);
        }
        return Promise.resolve(undefined);
      },
      on: (_channel: string, handler: (event: ApplyEvent) => void) => {
        handlers.push(handler);
        return () => undefined;
      },
    } as unknown as Bridge,
  };
}

function fakeQueue(initial: ForgeQueueState): ForgeQueuePort & { setState: (next: ForgeQueueState) => void; pauseCalls: number; resumeCalls: number } {
  let state = initial;
  const listeners = new Set<(state: ForgeQueueState) => void>();
  return {
    pauseCalls: 0,
    resumeCalls: 0,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    pause() {
      this.pauseCalls += 1;
    },
    resume() {
      this.resumeCalls += 1;
    },
    setState(next: ForgeQueueState) {
      state = next;
      for (const listener of listeners) listener(state);
    },
  };
}

function unit(index: number): ApplyUnitLabel {
  return { index, call: 'equip', subject: `item ${String(index)}`, from: null, to: 'h1', points: null, gold: 0 };
}

function request(): ApplyStartRequest {
  return { step: 'equip', planRunId: 'plan-1', units: [] as never };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function result(overrides: { made?: number; stop?: ApplyStopReason } = {}) {
  return {
    step: 'equip' as const,
    total: 1,
    made: overrides.made ?? 1,
    skipped: [],
    failed: null,
    stop: overrides.stop ?? 'finished',
    stopCode: null,
    goldSpent: 0,
    durationMs: 0,
  };
}

describe('confirm — pausing the forge queue', () => {
  it('a running queue is paused, apply:start waits for active to clear, then starts with the request as given', async () => {
    const { bridge, starts } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const queue = fakeQueue({ pieces: [{ itemId: 'i1', target: 5 }], status: 'running', active: { itemId: 'i1', runId: 'r1' }, halt: null, forged: 0 });
    const store = createApplyStore({ bridge, queue, now: () => 0 });
    store.bind('plan-1');
    store.confirm('equip', [unit(0)], request());
    await flush();

    expect(queue.pauseCalls).toBe(1);
    expect(starts).toEqual([]);
    expect(store.getState().modal?.phase).toBe('waitingQueue');

    queue.setState({ ...queue.getState(), active: null });
    await flush();
    expect(starts).toEqual([request()]);
    expect(store.getState().modal?.phase).toBe('running');
  });

  it('resumes the queue once the run finishes', async () => {
    const { bridge, push } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const queue = fakeQueue({ pieces: [{ itemId: 'i1', target: 5 }], status: 'running', active: { itemId: 'i1', runId: 'r1' }, halt: null, forged: 0 });
    const store = createApplyStore({ bridge, queue, now: () => 0 });
    store.bind('plan-1');
    store.confirm('equip', [unit(0)], request());
    await flush();
    queue.setState({ ...queue.getState(), active: null });
    await flush();

    push({ type: 'done', runId: 'r1', step: 'equip', result: result() });
    await flush();
    expect(queue.resumeCalls).toBe(1);
    expect(store.getState().queuePausedByApply).toBe(false);
  });

  it('an idle queue is never paused — apply:start fires at once', async () => {
    const { bridge, starts } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const queue = fakeQueue({ pieces: [], status: 'idle', active: null, halt: null, forged: 0 });
    const store = createApplyStore({ bridge, queue, now: () => 0 });
    store.bind('plan-1');
    store.confirm('equip', [unit(0)], request());
    await flush();
    expect(queue.pauseCalls).toBe(0);
    expect(queue.resumeCalls).toBe(0);
    expect(starts).toEqual([request()]);
  });

  it('a halted queue is left alone — no pause, immediate start', async () => {
    const { bridge, starts } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const queue = fakeQueue({ pieces: [{ itemId: 'i1', target: 5 }], status: 'halted', active: null, halt: { kind: 'stop', itemId: 'i1', stop: 'budget' }, forged: 0 });
    const store = createApplyStore({ bridge, queue, now: () => 0 });
    store.bind('plan-1');
    store.confirm('equip', [unit(0)], request());
    await flush();
    expect(queue.pauseCalls).toBe(0);
    expect(starts).toEqual([request()]);
  });
});

describe('stopping during the queue wait', () => {
  it('Stop while waiting resumes the queue, invokes nothing, and returns the step to idle', async () => {
    const { bridge, starts } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const queue = fakeQueue({ pieces: [{ itemId: 'i1', target: 5 }], status: 'running', active: { itemId: 'i1', runId: 'r1' }, halt: null, forged: 0 });
    const store = createApplyStore({ bridge, queue, now: () => 0 });
    store.bind('plan-1');
    store.confirm('equip', [unit(0)], request());
    await flush();

    store.stop();
    expect(queue.resumeCalls).toBe(1);
    expect(store.getState().modal).toBeNull();
    expect(store.getState().steps.equip).toEqual({ status: 'idle' });

    queue.setState({ ...queue.getState(), active: null });
    await flush();
    expect(starts).toEqual([]);
  });
});

describe('a start refusal', () => {
  it('resumes the queue if this store paused it', async () => {
    const { bridge } = fakeBridge(() => ({ ok: false, reason: 'busy' }));
    const queue = fakeQueue({ pieces: [{ itemId: 'i1', target: 5 }], status: 'running', active: { itemId: 'i1', runId: 'r1' }, halt: null, forged: 0 });
    const store = createApplyStore({ bridge, queue, now: () => 0 });
    store.bind('plan-1');
    store.confirm('equip', [unit(0)], request());
    await flush();
    queue.setState({ ...queue.getState(), active: null });
    await flush();

    expect(queue.resumeCalls).toBe(1);
    expect(store.getState().steps.equip).toMatchObject({ status: 'stopped', reason: { kind: 'start', reason: 'busy' } });
  });

  it('a bridge that rejects apply:start lands the step on the unavailable refusal, the same as no bridge at all', async () => {
    const bridge = {
      invoke: () => Promise.reject(new Error('preload channel gone')),
      on: () => () => undefined,
    } as unknown as Bridge;
    const queue = fakeQueue({ pieces: [], status: 'idle', active: null, halt: null, forged: 0 });
    const store = createApplyStore({ bridge, queue, now: () => 0 });
    store.bind('plan-1');
    store.confirm('equip', [unit(0)], request());
    await flush();

    expect(store.getState().modal).toBeNull();
    expect(store.getState().steps.equip).toMatchObject({ status: 'stopped', reason: { kind: 'start', reason: 'unavailable' } });
  });
});

describe('done resumes the queue whatever it stopped on', () => {
  it.each(['finished', 'stopped', 'unauthorized', 'network', 'game_not_running', 'consent_revoked', 'refused'] as const)(
    'stop=%s resumes a queue this store paused',
    async (stop) => {
      const { bridge, push } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
      const queue = fakeQueue({ pieces: [{ itemId: 'i1', target: 5 }], status: 'running', active: { itemId: 'i1', runId: 'r1' }, halt: null, forged: 0 });
      const store = createApplyStore({ bridge, queue, now: () => 0 });
      store.bind('plan-1');
      store.confirm('equip', [unit(0)], request());
      await flush();
      queue.setState({ ...queue.getState(), active: null });
      await flush();

      push({ type: 'done', runId: 'r1', step: 'equip', result: result({ stop }) });
      await flush();
      expect(queue.resumeCalls).toBe(1);
    },
  );
});

describe('stop()', () => {
  it('invokes apply:stop(runId) exactly once while a run is in flight', async () => {
    const { bridge, stops } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const queue = fakeQueue({ pieces: [], status: 'idle', active: null, halt: null, forged: 0 });
    const store = createApplyStore({ bridge, queue, now: () => 0 });
    store.bind('plan-1');
    store.confirm('equip', [unit(0)], request());
    await flush();

    store.stop();
    store.stop();
    expect(stops).toEqual(['r1']);
    expect(store.getState().modal?.stopRequested).toBe(true);
  });
});

describe('event routing', () => {
  it('a unit event for another run id changes nothing', async () => {
    const { bridge, push } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const queue = fakeQueue({ pieces: [], status: 'idle', active: null, halt: null, forged: 0 });
    const store = createApplyStore({ bridge, queue, now: () => 0 });
    store.bind('plan-1');
    store.confirm('equip', [unit(0)], request());
    await flush();
    const before = store.getState();

    push({ type: 'unit', runId: 'foreign-run', step: 'equip', index: 0, status: 'ok' });
    expect(store.getState()).toBe(before);
  });
});

describe('window-lifetime state', () => {
  it('a new plan run id empties every step', () => {
    const { bridge } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const queue = fakeQueue({ pieces: [], status: 'idle', active: null, halt: null, forged: 0 });
    const store = createApplyStore({ bridge, queue, now: () => 0 });
    store.bind('plan-1');
    store.bind('plan-2');
    expect(store.getState().steps).toEqual({ equip: { status: 'idle' }, forge: { status: 'idle' }, points: { status: 'idle' } });
    expect(store.getState().planRunId).toBe('plan-2');
  });

  it('forgeDone writes the forge step record', () => {
    const { bridge } = fakeBridge(() => ({ ok: true, runId: 'r1' }));
    const queue = fakeQueue({ pieces: [], status: 'idle', active: null, halt: null, forged: 0 });
    const store = createApplyStore({ bridge, queue, now: () => 0 });
    store.bind('plan-1');
    store.forgeDone({ made: 8, skipped: 2 });
    expect(store.getState().steps.forge).toEqual({ status: 'done', made: 8, skipped: 2, total: 10, skips: [] });
  });
});

describe('no localStorage/sessionStorage anywhere under renderer/lib/optimizer/apply-*.ts', () => {
  // This guard's own file necessarily spells the two words it forbids.
  const SELF_EXCLUDED_FILE = 'apply-store.test.ts';

  it('every apply-* module is free of browser storage reads', () => {
    const dir = path.join(__dirname);
    const offenders: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (!entry.startsWith('apply-') || !entry.endsWith('.ts') || entry === SELF_EXCLUDED_FILE) continue;
      const source = readFileSync(path.join(dir, entry), 'utf8');
      if (/\blocalStorage\b|\bsessionStorage\b/.test(source)) offenders.push(entry);
    }
    expect(offenders).toEqual([]);
  });
});
