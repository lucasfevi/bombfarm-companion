import type { MessagePortMain } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type { HostToWorker } from '@bombfarm/contracts';
import {
  createCapabilityChannel,
  type CapabilityChannelDeps,
  type CapabilityHandler,
  type CapabilityPort,
} from './capability-channel.js';

/** `MessagePortMain` is what production passes in; this fails to compile if it stops fitting. */
export const portMainFits = (port: MessagePortMain): CapabilityPort => port;

class FakePort implements CapabilityPort {
  readonly posted: HostToWorker[] = [];
  started = 0;
  closed = 0;
  private listener: ((event: { data: unknown }) => void) | null = null;

  on(_event: 'message', listener: (event: { data: unknown }) => void): this {
    this.listener = listener;
    return this;
  }

  postMessage(message: HostToWorker): void {
    this.posted.push(message);
  }

  start(): void {
    this.started += 1;
  }

  close(): void {
    this.closed += 1;
  }

  /** What the worker sends. */
  send(data: unknown): void {
    this.listener?.({ data });
  }
}

interface Setup {
  readonly port: FakePort;
  readonly logs: Record<string, unknown>[];
  readonly clock: { ms: number };
  readonly channel: ReturnType<typeof createCapabilityChannel>;
}

function setup(over: Partial<CapabilityChannelDeps> = {}): Setup {
  const port = new FakePort();
  const logs: Record<string, unknown>[] = [];
  const clock = { ms: 1_000 };
  const channel = createCapabilityChannel({
    port,
    requested: ['alpha'],
    allowlist: new Map<string, CapabilityHandler>([['alpha', () => 'done']]),
    sequence: 7,
    now: () => clock.ms,
    log: { info: (r) => logs.push(r), warn: (r) => logs.push(r), error: (r) => logs.push(r) },
    knownCapabilities: ['alpha', 'beta'],
    ...over,
  });
  return { port, logs, clock, channel };
}

const call = (id: number, capability: string, args: unknown = null) => ({ id, capability, args });
const errorOf = (n: number) => (s: Setup) => (s.port.posted[n] as { error?: string }).error;

describe('capability channel: what is granted', () => {
  it('is the declared capabilities the host offers', () => {
    const { channel } = setup({
      requested: ['alpha', 'gamma', 'alpha'],
      allowlist: new Map([['alpha', () => 1], ['beta', () => 2]]),
    });
    expect(channel.granted).toEqual(['alpha']);
  });

  it('is always empty with the shipped empty allowlist', () => {
    const { channel } = setup({ requested: ['alpha', 'beta'], allowlist: new Map() });
    expect(channel.granted).toEqual([]);
  });

  it('starts listening on the port', () => {
    const { port } = setup();
    expect(port.started).toBe(1);
  });
});

describe('capability channel: refusals', () => {
  it('refuses a capability the bundle never declared', () => {
    const s = setup({ requested: [], allowlist: new Map([['alpha', () => 1]]) });
    s.port.send(call(1, 'alpha'));
    expect(s.port.posted).toEqual([{ id: 1, ok: false, error: 'not_granted' }]);
  });

  it('refuses a capability the bundle declared but the host does not offer', () => {
    const s = setup({ requested: ['beta'] });
    s.port.send(call(2, 'beta'));
    expect(s.port.posted).toEqual([{ id: 2, ok: false, error: 'not_granted' }]);
  });

  it('refuses everything with the shipped empty allowlist', () => {
    const s = setup({ requested: ['alpha'], allowlist: new Map() });
    s.port.send(call(3, 'alpha'));
    expect(s.port.posted).toEqual([{ id: 3, ok: false, error: 'not_granted' }]);
  });

  it('refuses while paused, and serves again after resume', () => {
    const s = setup();
    s.channel.pause();
    s.port.send(call(4, 'alpha'));
    s.channel.resume();
    s.port.send(call(5, 'alpha'));
    expect(s.port.posted).toEqual([
      { t: 'paused' },
      { id: 4, ok: false, error: 'paused' },
      { t: 'resumed' },
      { id: 5, ok: true, value: 'done' },
    ]);
  });

  it('tells the worker about a pause or resume once, however often it is asked', () => {
    const s = setup();
    s.channel.resume();
    s.channel.pause();
    s.channel.pause();
    s.channel.resume();
    s.channel.resume();
    expect(s.port.posted).toEqual([{ t: 'paused' }, { t: 'resumed' }]);
  });

  it.each([
    ['null', null],
    ['a string', 'alpha'],
    ['a number', 7],
    ['an array', [1, 'alpha']],
    ['no id', { capability: 'alpha', args: null }],
    ['a fractional id', { id: 1.5, capability: 'alpha', args: null }],
    ['a string id', { id: '1', capability: 'alpha', args: null }],
    ['no capability', { id: 1, args: null }],
    ['a non-string capability', { id: 1, capability: 4, args: null }],
  ])('answers %s with bad_call', (_name, data) => {
    const s = setup();
    s.port.send(data);
    expect(s.port.posted).toHaveLength(1);
    expect(s.port.posted[0]).toMatchObject({ ok: false, error: 'bad_call' });
  });

  it('keeps the id of a malformed call when it has one', () => {
    const s = setup();
    s.port.send({ id: 9, capability: 4 });
    expect(s.port.posted).toEqual([{ id: 9, ok: false, error: 'bad_call' }]);
  });

  it('answers a handler that throws or rejects with bad_call', async () => {
    const s = setup({
      requested: ['alpha', 'beta'],
      allowlist: new Map<string, CapabilityHandler>([
        [
          'alpha',
          () => {
            throw new Error('boom');
          },
        ],
        ['beta', () => Promise.reject(new Error('later'))],
      ]),
    });
    s.port.send(call(1, 'alpha'));
    s.port.send(call(2, 'beta'));
    await Promise.resolve();
    await Promise.resolve();
    expect(s.port.posted).toEqual([
      { id: 1, ok: false, error: 'bad_call' },
      { id: 2, ok: false, error: 'bad_call' },
    ]);
  });
});

describe('capability channel: the order of the checks', () => {
  it('reports a malformed call before anything else', () => {
    const s = setup({ allowlist: new Map() });
    s.channel.pause();
    s.port.send({ id: 1, capability: 4 });
    expect(errorOf(1)(s)).toBe('bad_call');
  });

  it('reports paused before not granted, for a capability that was never granted', () => {
    const s = setup({ requested: [], allowlist: new Map() });
    s.channel.pause();
    s.port.send(call(1, 'alpha'));
    expect(errorOf(1)(s)).toBe('paused');
  });

  it('reports a malformed call as bad_call even while paused', () => {
    const s = setup({ requested: [], allowlist: new Map() });
    s.channel.pause();
    s.port.send({ id: 1, capability: 4 });
    expect(errorOf(1)(s)).toBe('bad_call');
  });

  it('reports not granted again once resumed', () => {
    const s = setup({ requested: [], allowlist: new Map() });
    s.channel.pause();
    s.port.send(call(1, 'alpha'));
    s.channel.resume();
    s.port.send(call(2, 'alpha'));
    expect(errorOf(1)(s)).toBe('paused');
    expect(errorOf(3)(s)).toBe('not_granted');
  });

  it('reports paused before rate limited, and a paused call does not spend a token', () => {
    const s = setup({ ratePerMinute: 1 });
    s.port.send(call(1, 'alpha'));
    s.channel.pause();
    s.port.send(call(2, 'alpha'));
    expect(errorOf(2)(s)).toBe('paused');
    s.clock.ms += 60_000;
    s.channel.resume();
    s.port.send(call(3, 'alpha'));
    expect(s.port.posted.at(-1)).toEqual({ id: 3, ok: true, value: 'done' });
  });
});

describe('capability channel: the rate limit', () => {
  it('serves 60 calls in a minute and refuses the 61st', () => {
    const s = setup();
    for (let id = 1; id <= 61; id += 1) s.port.send(call(id, 'alpha'));
    expect(s.port.posted.slice(0, 60).every((m) => (m as { ok: boolean }).ok)).toBe(true);
    expect(s.port.posted[60]).toEqual({ id: 61, ok: false, error: 'rate_limited' });
  });

  it('gives a token back every second', () => {
    const s = setup();
    for (let id = 1; id <= 61; id += 1) s.port.send(call(id, 'alpha'));
    s.clock.ms += 999;
    s.port.send(call(62, 'alpha'));
    expect(s.port.posted.at(-1)).toEqual({ id: 62, ok: false, error: 'rate_limited' });
    s.clock.ms += 1;
    s.port.send(call(63, 'alpha'));
    expect(s.port.posted.at(-1)).toEqual({ id: 63, ok: true, value: 'done' });
  });

  it('never banks more than a minute of calls', () => {
    const s = setup();
    s.clock.ms += 10 * 60_000;
    for (let id = 1; id <= 61; id += 1) s.port.send(call(id, 'alpha'));
    expect(s.port.posted.filter((m) => (m as { ok: boolean }).ok)).toHaveLength(60);
  });

  it('counts each capability on its own', () => {
    const s = setup({
      requested: ['alpha', 'beta'],
      allowlist: new Map<string, CapabilityHandler>([['alpha', () => 'a'], ['beta', () => 'b']]),
      ratePerMinute: 2,
    });
    for (const id of [1, 2, 3]) s.port.send(call(id, 'alpha'));
    s.port.send(call(4, 'beta'));
    expect(s.port.posted.map((m) => (m as { ok: boolean }).ok)).toEqual([true, true, false, true]);
  });
});

describe('capability channel: answers', () => {
  it('hands the handler the arguments and returns its value', () => {
    const handler = vi.fn((args: unknown) => ({ echoed: args }));
    const s = setup({ allowlist: new Map([['alpha', handler]]) });
    s.port.send(call(1, 'alpha', { n: 1 }));
    expect(handler).toHaveBeenCalledWith({ n: 1 });
    expect(s.port.posted).toEqual([{ id: 1, ok: true, value: { echoed: { n: 1 } } }]);
  });

  it('answers an asynchronous handler when it settles', async () => {
    let finish: (v: string) => void = () => undefined;
    const s = setup({ allowlist: new Map([['alpha', () => new Promise<string>((r) => (finish = r))]]) });
    s.port.send(call(1, 'alpha'));
    expect(s.port.posted).toEqual([]);
    finish('later');
    await Promise.resolve();
    expect(s.port.posted).toEqual([{ id: 1, ok: true, value: 'later' }]);
  });
});

describe('capability channel: the audit log', () => {
  it('writes one record per call with the capability, the outcome and the sequence', () => {
    const s = setup({ ratePerMinute: 1 });
    s.port.send(call(1, 'alpha'));
    s.port.send(call(2, 'alpha'));
    s.channel.pause();
    s.port.send(call(3, 'alpha'));
    s.port.send(call(4, 'beta'));
    s.port.send({ id: 5 });
    expect(s.logs).toEqual([
      { scope: 'premium', event: 'premium.capability', capability: 'alpha', outcome: 'ok', sequence: 7 },
      { scope: 'premium', event: 'premium.capability', capability: 'alpha', outcome: 'rate_limited', sequence: 7 },
      { scope: 'premium', event: 'premium.capability', capability: 'alpha', outcome: 'paused', sequence: 7 },
      { scope: 'premium', event: 'premium.capability', capability: 'beta', outcome: 'paused', sequence: 7 },
      { scope: 'premium', event: 'premium.capability', capability: 'unknown', outcome: 'bad_call', sequence: 7 },
    ]);
  });

  it('logs a name the host does not know as unknown, so a bundle cannot write its own text', () => {
    const s = setup({ requested: ['SECRET-TEXT'] });
    s.port.send(call(1, 'SECRET-TEXT'));
    expect(s.logs).toHaveLength(1);
    expect(s.logs[0]).toMatchObject({ capability: 'unknown', outcome: 'not_granted' });
    expect(JSON.stringify(s.logs)).not.toContain('SECRET-TEXT');
  });

  it('defaults the known names to the shipped capability list, which is empty', () => {
    const port = new FakePort();
    const logs: Record<string, unknown>[] = [];
    createCapabilityChannel({
      port,
      requested: ['alpha'],
      allowlist: new Map([['alpha', () => 1]]),
      sequence: 1,
      now: () => 0,
      log: { info: (r) => logs.push(r), warn: () => undefined, error: () => undefined },
    });
    port.send(call(1, 'alpha'));
    expect(logs[0]).toMatchObject({ capability: 'unknown', outcome: 'ok' });
  });

  it('never writes arguments to any log record or any answer', () => {
    const s = setup({
      requested: ['alpha', 'beta'],
      allowlist: new Map<string, CapabilityHandler>([
        ['alpha', () => 1],
        [
          'beta',
          () => {
            throw new Error('ARG_SECRET');
          },
        ],
      ]),
      ratePerMinute: 1,
    });
    const secret = { token: 'ARG_SECRET-one' };
    s.port.send(call(1, 'alpha', secret));
    s.port.send(call(2, 'alpha', secret));
    s.channel.pause();
    s.port.send(call(3, 'alpha', secret));
    s.port.send(call(4, 'beta', secret));
    s.port.send(call(5, 'nope', secret));
    s.port.send({ id: 6, capability: 4, args: secret });
    expect(JSON.stringify(s.logs)).not.toContain('ARG_SECRET');
    expect(JSON.stringify(s.port.posted)).not.toContain('ARG_SECRET');
  });
});

describe('capability channel: close', () => {
  it('answers every pending call stopped, logs it, and closes the port', () => {
    const s = setup({ allowlist: new Map([['alpha', () => new Promise(() => undefined)]]) });
    s.port.send(call(1, 'alpha'));
    s.port.send(call(2, 'alpha'));
    s.channel.close();
    expect(s.port.posted).toEqual([
      { id: 1, ok: false, error: 'stopped' },
      { id: 2, ok: false, error: 'stopped' },
    ]);
    expect(s.logs.map((l) => l['outcome'])).toEqual(['stopped', 'stopped']);
    expect(s.port.closed).toBe(1);
  });

  it('drops a handler result that arrives after close', async () => {
    let finish: (v: string) => void = () => undefined;
    const s = setup({ allowlist: new Map([['alpha', () => new Promise<string>((r) => (finish = r))]]) });
    s.port.send(call(1, 'alpha'));
    s.channel.close();
    finish('late');
    await Promise.resolve();
    expect(s.port.posted).toEqual([{ id: 1, ok: false, error: 'stopped' }]);
  });

  it('ignores calls after close, and closing twice', () => {
    const s = setup();
    s.channel.close();
    s.channel.close();
    s.port.send(call(1, 'alpha'));
    s.channel.pause();
    expect(s.port.posted).toEqual([]);
    expect(s.logs).toEqual([]);
    expect(s.port.closed).toBe(1);
  });
});
