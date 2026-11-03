import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostToWorker } from '@bombfarm/contracts';
import {
  CapabilityError,
  withOrigin,
  createCapabilityChannel,
  type CapabilityChannelDeps,
  type CapabilityHandler,
  type CapabilityPort,
} from './capability-channel.js';

class FakePort implements CapabilityPort {
  readonly posted: HostToWorker[] = [];
  private listener: ((event: { data: unknown }) => void) | null = null;

  on(_event: 'message', listener: (event: { data: unknown }) => void): this {
    this.listener = listener;
    return this;
  }

  postMessage(message: HostToWorker): void {
    this.posted.push(message);
  }

  start(): void {}

  close(): void {}

  send(data: unknown): void {
    this.listener?.({ data });
  }
}

function setup(
  handlers: Record<string, CapabilityHandler>,
  over: Partial<CapabilityChannelDeps> = {}
) {
  const port = new FakePort();
  const clock = { ms: 1_000 };
  const channel = createCapabilityChannel({
    port,
    requested: Object.keys(handlers),
    allowlist: new Map(Object.entries(handlers)),
    sequence: 1,
    now: () => clock.ms,
    log: { info: () => {}, warn: () => {}, error: () => {} },
    ...over,
  });
  return { port, clock, channel };
}

const call = (id: number, capability: string, args: unknown = null) => ({
  id,
  capability,
  args,
});
const errors = (port: FakePort) =>
  port.posted
    .filter((m) => 'ok' in m && !m.ok)
    .map((m) => (m as { error: string }).error);

describe('capability channel: budgets per origin', () => {
  it('lets 600 db calls from the worker and 600 from the screen through in a minute, then refuses the 601st of each', async () => {
    const { port, channel } = setup({ db: () => 'ok', alpha: () => 'ok' });
    for (let i = 0; i < 600; i++) port.send(call(i, 'db'));
    expect(port.posted).toHaveLength(600);
    expect(errors(port)).toEqual([]);
    for (let i = 0; i < 600; i++) {
      await expect(channel.callFromUi(call(i, 'db'))).resolves.toMatchObject({
        ok: true,
      });
    }
    port.send(call(600, 'db'));
    expect(errors(port)).toEqual(['rate_limited']);
    await expect(channel.callFromUi(call(600, 'db'))).resolves.toMatchObject({
      ok: false,
      error: 'rate_limited',
    });
  });

  it('keeps one origin\'s exhaustion from refusing the other', async () => {
    const { port, channel } = setup({ db: () => 'ok' });
    for (let i = 0; i < 601; i++) port.send(call(i, 'db'));
    await expect(channel.callFromUi(call(1, 'db'))).resolves.toMatchObject({
      ok: true,
    });
  });

  it('budgets premium.worker from the screen at 600 a minute without touching the worker db budget', async () => {
    const { port, channel } = setup({ 'premium.worker': () => 'ok', db: () => 'ok' });
    for (let i = 0; i < 600; i++) {
      await expect(channel.callFromUi(call(i, 'premium.worker'))).resolves.toMatchObject({ ok: true });
    }
    await expect(channel.callFromUi(call(600, 'premium.worker'))).resolves.toMatchObject({
      ok: false,
      error: 'rate_limited',
    });
    port.send(call(1, 'db'));
    await expect(channel.callFromUi(call(2, 'db'))).resolves.toMatchObject({ ok: true });
    expect(port.posted).toEqual([{ id: 1, ok: true, value: 'ok' }]);
  });

  it('keeps the shipped capabilities on one shared bucket of 60', async () => {
    const { port, channel } = setup({ alpha: () => 1 });
    for (let i = 0; i < 30; i++) port.send(call(i, 'alpha'));
    for (let i = 0; i < 30; i++) await channel.callFromUi(call(i, 'alpha'));
    port.send(call(99, 'alpha'));
    await expect(channel.callFromUi(call(99, 'alpha'))).resolves.toMatchObject({
      error: 'rate_limited',
    });
    expect(errors(port)).toEqual(['rate_limited']);
  });

  it('tells the handler where the call came from', async () => {
    const seen: string[] = [];
    const { port, channel } = setup({
      alpha: withOrigin((_args, ctx) => {
        seen.push(ctx.origin);
        return null;
      }),
    });
    port.send(call(1, 'alpha'));
    await channel.callFromUi(call(2, 'alpha'));
    expect(seen).toEqual(['worker', 'ui']);
  });
});

describe('capability channel: refusal reasons', () => {
  it('copies a handler\'s code and reason into the reply, and omits the reason when there is none', async () => {
    const { port, channel } = setup({
      alpha: (args) => {
        if (args === 'a') throw new CapabilityError('failed', 'disk_full');
        if (args === 'b') throw new CapabilityError('timeout');
        return Promise.reject(new CapabilityError('too_large', 'rows'));
      },
    });
    port.send(call(1, 'alpha', 'a'));
    await expect(
      channel.callFromUi(call(2, 'alpha', 'b'))
    ).resolves.toStrictEqual({
      id: 2,
      ok: false,
      error: 'timeout',
    });
    await expect(
      channel.callFromUi(call(3, 'alpha', 'c'))
    ).resolves.toStrictEqual({
      id: 3,
      ok: false,
      error: 'too_large',
      reason: 'rows',
    });
    expect(port.posted[0]).toStrictEqual({
      id: 1,
      ok: false,
      error: 'failed',
      reason: 'disk_full',
    });
  });
});

describe('capability channel: events', () => {
  it('posts a batch with an increasing seq and counts it in flight until its ack', () => {
    const { port, channel } = setup({});
    const acked: number[] = [];
    channel.onAck((seq) => acked.push(seq));
    const items = [{ atMs: 1 }];
    expect(channel.emit('db.cleared', items)).toBe(1);
    expect(channel.emit('db.cleared', items)).toBe(2);
    expect(port.posted).toEqual([
      { t: 'events', seq: 1, name: 'db.cleared', items },
      { t: 'events', seq: 2, name: 'db.cleared', items },
    ]);
    expect(channel.inFlight).toBe(2);
    port.send({ t: 'ack', seq: 1 });
    expect(channel.inFlight).toBe(1);
    port.send({ t: 'ack', seq: 1 });
    port.send({ t: 'ack', seq: 42 });
    expect(acked).toEqual([1]);
    port.send({ t: 'ack', seq: 2 });
    expect(channel.inFlight).toBe(0);
    expect(errors(port)).toEqual([]);
    expect(port.posted).toHaveLength(2);
  });

  it('drops an emit while paused: nothing posted, nothing kept, none replayed on resume', () => {
    const { port, channel } = setup({});
    channel.pause();
    port.posted.length = 0;
    expect(channel.emit('db.cleared', [{ atMs: 1 }])).toBeNull();
    expect(channel.inFlight).toBe(0);
    channel.resume();
    expect(port.posted).toEqual([{ t: 'resumed' }]);
  });

  it('drops an emit once closed', () => {
    const { port, channel } = setup({});
    channel.close();
    expect(channel.emit('db.cleared', [{ atMs: 1 }])).toBeNull();
    expect(port.posted).toEqual([]);
    expect(channel.inFlight).toBe(0);
  });
});

describe('capability channel: asking the worker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts the question and settles with the matching reply', async () => {
    const { port, channel } = setup({});
    const first = channel.askWorker('premium.tab', { q: 1 });
    const second = channel.askWorker('live.section', 'x');
    expect(port.posted).toEqual([
      { t: 'ui', id: 1, slot: 'premium.tab', msg: { q: 1 } },
      { t: 'ui', id: 2, slot: 'live.section', msg: 'x' },
    ]);
    port.send({ t: 'uiReply', id: 2, ok: true, value: 'two' });
    port.send({ t: 'uiReply', id: 1, ok: true, value: { a: 1 } });
    await expect(second).resolves.toBe('two');
    await expect(first).resolves.toEqual({ a: 1 });
  });

  it('rejects unavailable/no_handler when the worker answers ok:false', async () => {
    const { port, channel } = setup({});
    const asked = channel.askWorker('premium.tab', null);
    port.send({ t: 'uiReply', id: 1, ok: false });
    await expect(asked).rejects.toMatchObject({
      code: 'unavailable',
      reason: 'no_handler',
    });
  });

  it('times out after 5 s, not before, and ignores a late reply', async () => {
    const { port, channel } = setup({});
    let outcome: unknown = 'pending';
    channel.askWorker('premium.tab', null).catch((e: unknown) => {
      outcome = e;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(outcome).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toMatchObject({ code: 'timeout' });
    port.send({ t: 'uiReply', id: 1, ok: true, value: 1 });
    expect(outcome).toMatchObject({ code: 'timeout' });
  });

  it('answers every pending question stopped on close, and stops the timers', async () => {
    const { channel } = setup({});
    const a = channel.askWorker('premium.tab', 1).catch((e: unknown) => e);
    const b = channel.askWorker('premium.tab', 2).catch((e: unknown) => e);
    channel.close();
    expect(await a).toMatchObject({ code: 'stopped' });
    expect(await b).toMatchObject({ code: 'stopped' });
    expect(vi.getTimerCount()).toBe(0);
    await expect(channel.askWorker('premium.tab', 3)).rejects.toMatchObject({
      code: 'stopped',
    });
  });

  it('answers a premium.worker screen call stopped when closed mid-question', async () => {
    const holder: { channel?: ReturnType<typeof setup>['channel'] } = {};
    const { channel } = setup({
      'premium.worker': () => holder.channel?.askWorker('premium.tab', 'hi'),
    });
    holder.channel = channel;
    const reply = channel.callFromUi(call(1, 'premium.worker'));
    channel.close();
    await expect(reply).resolves.toStrictEqual({
      id: 1,
      ok: false,
      error: 'stopped',
    });
  });
});
