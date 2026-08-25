import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LiveEvent } from '@bombfarm/contracts';
import { describe, expect, it, afterEach } from 'vitest';
import { buildHttpResponse, buildServerTextFrame } from './fixtures/generate-replay-stream.js';
import type { LogPort as HookCacheLogPort } from './hook-cache.js';
import { RuntimePort } from './runtime.js';
import type { TapInterceptor, TapReadEvent, TapRuntime, TapSession } from './runtime.js';
import type { FrameCapture } from './frame-capture.js';
import { createHookCandidateSource, Tap } from './tap.js';
import type {
  Clock,
  HookCandidateResolution,
  HookCandidateSource,
  ProcessImageSource,
  ProcessLister,
  TapTargetProcess,
} from './tap.js';

const PROCESS_NAME = 'BombFarm.exe';

function snapFrameBytes(): Buffer {
  return buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [] }), 'utf8'));
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

interface TimerEntry {
  readonly id: number;
  due: number;
  readonly cb: () => void;
}

class FakeClock implements Clock {
  #now = 0;
  #timers: TimerEntry[] = [];
  #nextId = 1;

  now(): number {
    return this.#now;
  }

  setTimeout(callback: () => void, ms: number): unknown {
    const id = this.#nextId++;
    this.#timers.push({ id, due: this.#now + ms, cb: callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.#timers = this.#timers.filter((timer) => timer.id !== handle);
  }

  /** Fires every timer due at or before `now + ms`, in due order, flushing real microtasks
   *  between each so the async continuations those callbacks kick off (attach, teardown) have
   *  settled before the next timer is considered — otherwise a callback that schedules a new,
   *  earlier-due timer mid-flight could be missed. */
  async advance(ms: number): Promise<void> {
    const target = this.#now + ms;
    for (;;) {
      this.#timers.sort((a, b) => a.due - b.due);
      const next = this.#timers[0];
      if (!next || next.due > target) break;
      this.#now = next.due;
      this.#timers.shift();
      next.cb();
      await flushMicrotasks();
    }
    this.#now = target;
  }
}

class FakeProcessLister implements ProcessLister {
  processes: TapTargetProcess[] = [];
  listCalls = 0;

  list(processName: string): Promise<readonly TapTargetProcess[]> {
    this.listCalls += 1;
    return Promise.resolve(this.processes.filter((p) => p.name === processName));
  }
}

class FakeHookCandidateSource implements HookCandidateSource {
  resolveResult: HookCandidateResolution = { addresses: [], fromCache: false, buildId: null };
  readonly resolveCalls: { pid: number; maxCandidates: number | undefined }[] = [];
  readonly committed: { pid: number; address: number; buildId: string | null }[] = [];
  readonly invalidated: { pid: number; buildId: string | null }[] = [];

  resolve(pid: number, maxCandidates?: number): HookCandidateResolution {
    this.resolveCalls.push({ pid, maxCandidates });
    return this.resolveResult;
  }

  commit(pid: number, address: number, buildId: string | null): void {
    this.committed.push({ pid, address, buildId });
  }

  invalidate(pid: number, buildId: string | null): void {
    this.invalidated.push({ pid, buildId });
  }
}

class FakeInterceptor implements TapInterceptor {
  readonly #listeners: ((event: TapReadEvent) => void)[] = [];
  detachCount = 0;

  onRead(listener: (event: TapReadEvent) => void): void {
    this.#listeners.push(listener);
  }

  detach(): void {
    this.detachCount += 1;
  }

  fire(event: TapReadEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}

class FakeSession implements TapSession {
  readonly pid: number;
  readonly interceptorsByAddress = new Map<number, FakeInterceptor>();
  detachCount = 0;

  constructor(pid: number) {
    this.pid = pid;
  }

  installInterceptor(address: number): TapInterceptor {
    const interceptor = new FakeInterceptor();
    this.interceptorsByAddress.set(address, interceptor);
    return interceptor;
  }

  detach(): void {
    this.detachCount += 1;
  }
}

class FakeRuntime implements TapRuntime {
  readonly sessions: FakeSession[] = [];

  attach(pid: number): Promise<TapSession> {
    const session = new FakeSession(pid);
    this.sessions.push(session);
    return Promise.resolve(session);
  }
}

interface HarnessOptions {
  readonly consent?: boolean;
  readonly pollIntervalMs?: number;
  readonly resolveRuntime?: () => Promise<TapRuntime>;
}

function createHarness(options: HarnessOptions = {}) {
  const clock = new FakeClock();
  const processes = new FakeProcessLister();
  const candidates = new FakeHookCandidateSource();
  const runtime = new FakeRuntime();
  const events: LiveEvent[] = [];
  const infos: Record<string, unknown>[] = [];
  const warnings: Record<string, unknown>[] = [];
  const httpBodies: Array<{ readonly body: Buffer; readonly atMs: number }> = [];
  let consent = options.consent ?? true;

  const sharedLog = { info: (record: Record<string, unknown>) => infos.push(record), warn: (record: Record<string, unknown>) => warnings.push(record) };
  const runtimePort = new RuntimePort({
    resolve: options.resolveRuntime ?? (() => Promise.resolve(runtime)),
    log: sharedLog,
  });

  const tap = new Tap({
    processName: PROCESS_NAME,
    runtime: runtimePort,
    processes,
    candidates,
    consent: () => consent,
    clock,
    onEvent: (event) => events.push(event),
    onHttpBody: (body, atMs) => httpBodies.push({ body, atMs }),
    log: sharedLog,
    pollIntervalMs: options.pollIntervalMs ?? 1_000,
  });

  return {
    tap,
    clock,
    processes,
    candidates,
    runtime,
    runtimePort,
    events,
    infos,
    warnings,
    httpBodies,
    setConsent: (value: boolean) => {
      consent = value;
    },
  };
}

describe('Tap: validation timeout at 20s when the hook never fires', () => {
  it('drops the cached address and rescans on a cache-hit timeout, and never reports live', async () => {
    const { tap, clock, processes, candidates, runtime, events } = createHarness();
    processes.processes = [{ pid: 111, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x1000], fromCache: true, buildId: 'build-cache-hit' };

    tap.start();
    await clock.advance(0);
    expect(runtime.sessions).toHaveLength(1);

    await clock.advance(20_000);

    expect(candidates.invalidated).toEqual([{ pid: 111, buildId: 'build-cache-hit' }]);
    expect(runtime.sessions.length).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => e.type === 'currency' && e.currency.kind === 'live')).toBe(false);
  });

  it('reports an actionable attachFailed gap on a fresh-scan timeout, without touching the cache', async () => {
    const { tap, clock, processes, candidates } = createHarness();
    processes.processes = [{ pid: 222, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x1000, 0x2000, 0x3000, 0x4000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);
    await clock.advance(20_000);

    expect(candidates.invalidated).toHaveLength(0);
    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'attachFailed', actionable: true });
  });
});

describe('Tap: staleness watch', () => {
  it('stays live when frames arrive once per second, well past the 45s staleness threshold', async () => {
    const { tap, clock, processes, candidates, runtime, events } = createHarness();
    processes.processes = [{ pid: 333, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x5000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);
    const interceptor = runtime.sessions[0]?.interceptorsByAddress.get(0x5000);
    if (!interceptor) throw new Error('test setup: interceptor not installed');

    interceptor.fire({ ctx: 'conn', bytes: snapFrameBytes() });
    expect(tap.getCurrency().kind).toBe('live');

    for (let second = 0; second < 70; second += 1) {
      await clock.advance(1_000);
      interceptor.fire({ ctx: 'conn', bytes: snapFrameBytes() });
    }

    expect(tap.getCurrency().kind).toBe('live');
    expect(events.some((e) => e.type === 'currency' && e.currency.kind === 'gap' && e.currency.reason === 'hookSilent')).toBe(
      false,
    );
  });

  it('leaves the trusted state and reports hookSilent after 45s of silence, with the process never exiting', async () => {
    const { tap, clock, processes, candidates, runtime } = createHarness();
    processes.processes = [{ pid: 444, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x6000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);
    const interceptor = runtime.sessions[0]?.interceptorsByAddress.get(0x6000);
    if (!interceptor) throw new Error('test setup: interceptor not installed');

    interceptor.fire({ ctx: 'conn', bytes: snapFrameBytes() });
    expect(tap.getCurrency().kind).toBe('live');

    await clock.advance(62_000);

    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'hookSilent' });
    expect(processes.processes).toHaveLength(1);
  });
});

describe('Tap: ambiguous discovery', () => {
  it('hooks all ranked candidates at once and keeps only the one that produces real bytes', async () => {
    const { tap, clock, processes, candidates, runtime } = createHarness();
    processes.processes = [{ pid: 555, name: PROCESS_NAME }];
    candidates.resolveResult = {
      addresses: [0x1000, 0x2000, 0x3000, 0x4000],
      fromCache: false,
      buildId: 'build-ambiguous',
    };

    tap.start();
    await clock.advance(0);

    const session = runtime.sessions[0];
    if (!session) throw new Error('test setup: no session');
    expect(session.interceptorsByAddress.size).toBe(4);

    const winner = session.interceptorsByAddress.get(0x3000);
    if (!winner) throw new Error('test setup: winner interceptor missing');
    winner.fire({ ctx: 'conn', bytes: snapFrameBytes() });

    for (const [address, interceptor] of session.interceptorsByAddress) {
      if (address === 0x3000) {
        expect(interceptor.detachCount).toBe(0);
      } else {
        expect(interceptor.detachCount).toBeGreaterThan(0);
      }
    }
    expect(tap.getCurrency().kind).toBe('live');
    expect(candidates.committed).toEqual([{ pid: 555, address: 0x3000, buildId: 'build-ambiguous' }]);
  });
});

describe('Tap: frame capture receives only the confirmed winner\'s bytes', () => {
  class FakeCapture implements FrameCapture {
    pushed: { ctx: string | number; bytes: Buffer }[] = [];

    push(ctx: string | number, bytes: Uint8Array): void {
      this.pushed.push({ ctx, bytes: Buffer.from(bytes) });
    }

    close(): void {
      /* not exercised here */
    }
  }

  it("captures the confirming read and later winner reads, with their ctx, never a losing candidate's bytes", async () => {
    const clock = new FakeClock();
    const processes = new FakeProcessLister();
    const candidates = new FakeHookCandidateSource();
    const runtime = new FakeRuntime();
    const runtimePort = new RuntimePort({ resolve: () => Promise.resolve(runtime) });
    const capture = new FakeCapture();

    const tap = new Tap({
      processName: PROCESS_NAME,
      runtime: runtimePort,
      processes,
      candidates,
      consent: () => true,
      clock,
      onEvent: () => undefined,
      pollIntervalMs: 1_000,
      capture,
    });

    processes.processes = [{ pid: 777, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x1000, 0x2000], fromCache: false, buildId: 'build-capture' };

    tap.start();
    await clock.advance(0);

    const session = runtime.sessions[0];
    if (!session) throw new Error('test setup: no session');
    const loser = session.interceptorsByAddress.get(0x1000);
    const winner = session.interceptorsByAddress.get(0x2000);
    if (!loser || !winner) throw new Error('test setup: expected two interceptors');

    const confirmingBytes = snapFrameBytes();
    winner.fire({ ctx: 'winner-conn', bytes: confirmingBytes });
    expect(capture.pushed).toEqual([{ ctx: 'winner-conn', bytes: confirmingBytes }]);

    loser.fire({ ctx: 'loser-conn', bytes: snapFrameBytes() });
    expect(capture.pushed).toEqual([{ ctx: 'winner-conn', bytes: confirmingBytes }]);

    const laterWinningBytes = snapFrameBytes();
    winner.fire({ ctx: 'winner-conn', bytes: laterWinningBytes });
    expect(capture.pushed).toEqual([
      { ctx: 'winner-conn', bytes: confirmingBytes },
      { ctx: 'winner-conn', bytes: laterWinningBytes },
    ]);
  });
});

describe('Tap: fresh-discovery escalation widens the candidate window', () => {
  it('requests the top 4 candidates on the first fresh discovery attempt', async () => {
    const { tap, clock, processes, candidates } = createHarness();
    processes.processes = [{ pid: 7_001, name: PROCESS_NAME }];
    candidates.resolveResult = {
      addresses: [0x1000, 0x2000, 0x3000, 0x4000],
      fromCache: false,
      buildId: 'build-first',
    };

    tap.start();
    await clock.advance(0);

    expect(candidates.resolveCalls).toEqual([{ pid: 7_001, maxCandidates: 4 }]);
  });

  it('widens the requested window on each consecutive fresh-discovery validation failure, then plateaus', async () => {
    const { tap, clock, processes, candidates } = createHarness();
    processes.processes = [{ pid: 7_002, name: PROCESS_NAME }];
    candidates.resolveResult = {
      addresses: [0x1000, 0x2000, 0x3000, 0x4000],
      fromCache: false,
      buildId: 'build-escalate',
    };

    tap.start();
    await clock.advance(0);
    await clock.advance(20_000);
    await clock.advance(20_000);
    await clock.advance(20_000);
    await clock.advance(20_000);

    expect(candidates.resolveCalls.map((call) => call.maxCandidates)).toEqual([4, 8, 16, 32, 32]);
  });

  it('resets the width to 4 for the next fresh discovery once a winner is confirmed', async () => {
    const { tap, clock, processes, candidates, runtime } = createHarness();
    processes.processes = [{ pid: 7_003, name: PROCESS_NAME }];
    candidates.resolveResult = {
      addresses: [0x1000, 0x2000, 0x3000, 0x4000],
      fromCache: false,
      buildId: 'build-reset-on-winner',
    };

    tap.start();
    await clock.advance(0);
    await clock.advance(20_000);

    const session = runtime.sessions[runtime.sessions.length - 1];
    if (!session) throw new Error('test setup: no session');
    const winner = session.interceptorsByAddress.get(0x1000);
    if (!winner) throw new Error('test setup: winner interceptor missing');
    winner.fire({ ctx: 'conn', bytes: snapFrameBytes() });
    expect(tap.getCurrency().kind).toBe('live');

    processes.processes = [];
    await clock.advance(1_000);
    processes.processes = [{ pid: 7_003, name: PROCESS_NAME }];
    await clock.advance(1_000);

    expect(candidates.resolveCalls.map((call) => call.maxCandidates)).toEqual([4, 8, 4]);
  });

  it('restarts escalation once a build id change is observed, instead of continuing to climb', async () => {
    const { tap, clock, processes, candidates } = createHarness();
    processes.processes = [{ pid: 7_004, name: PROCESS_NAME }];
    candidates.resolveResult = {
      addresses: [0x1000, 0x2000, 0x3000, 0x4000],
      fromCache: false,
      buildId: 'build-old',
    };

    tap.start();
    await clock.advance(0);
    await clock.advance(20_000);

    candidates.resolveResult = {
      addresses: [0x9000, 0x9001, 0x9002, 0x9003],
      fromCache: false,
      buildId: 'build-new',
    };
    await clock.advance(20_000);
    await clock.advance(20_000);

    expect(candidates.resolveCalls.map((call) => call.maxCandidates)).toEqual([4, 8, 16, 8]);
  });

  it('leaves the escalation window untouched when a cache-sourced address fails validation', async () => {
    const { tap, clock, processes, candidates } = createHarness();
    processes.processes = [{ pid: 7_005, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x1000], fromCache: true, buildId: 'build-cache' };

    tap.start();
    await clock.advance(0);
    await clock.advance(20_000);

    expect(candidates.invalidated).toEqual([{ pid: 7_005, buildId: 'build-cache' }]);
    expect(candidates.resolveCalls.map((call) => call.maxCandidates)).toEqual([4, 4]);
  });
});

describe('Tap: winner confirmation logging', () => {
  it('logs tap.winner_confirmed exactly once when a candidate stream decodes its first events', async () => {
    const { tap, clock, processes, candidates, runtime, infos } = createHarness();
    processes.processes = [{ pid: 666, name: PROCESS_NAME }];
    candidates.resolveResult = {
      addresses: [0x1000, 0x2000],
      fromCache: true,
      buildId: 'build-winner-log',
    };

    tap.start();
    await clock.advance(0);

    const session = runtime.sessions[0];
    if (!session) throw new Error('test setup: no session');
    const winner = session.interceptorsByAddress.get(0x2000);
    if (!winner) throw new Error('test setup: winner interceptor missing');
    winner.fire({ ctx: 'conn', bytes: snapFrameBytes() });

    const winnerLogs = infos.filter((record) => record.event === 'tap.winner_confirmed');
    expect(winnerLogs).toHaveLength(1);
    expect(winnerLogs[0]).toMatchObject({
      scope: 'live-source',
      event: 'tap.winner_confirmed',
      pid: 666,
      address: 0x2000,
      fromCache: true,
      buildId: 'build-winner-log',
    });

    winner.fire({ ctx: 'conn', bytes: snapFrameBytes() });
    expect(infos.filter((record) => record.event === 'tap.winner_confirmed')).toHaveLength(1);
  });

  it('does not log tap.winner_confirmed when validation times out with no winner', async () => {
    const { tap, clock, processes, candidates, infos } = createHarness();
    processes.processes = [{ pid: 777, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x1000], fromCache: true, buildId: 'build-timeout' };

    tap.start();
    await clock.advance(0);
    await clock.advance(20_000);

    expect(infos.some((record) => record.event === 'tap.winner_confirmed')).toBe(false);
  });
});

describe('Tap: a throwing attach or install does not kill the poll loop', () => {
  it('reports attachFailed, leaks nothing, and keeps polling when runtime.attach throws', async () => {
    class ThrowingAttachRuntime implements TapRuntime {
      attachCalls = 0;
      attach(_pid: number): Promise<TapSession> {
        this.attachCalls += 1;
        return Promise.reject(new Error('attach: access is denied'));
      }
    }
    const throwingRuntime = new ThrowingAttachRuntime();
    const { tap, clock, processes, candidates } = createHarness({
      resolveRuntime: () => Promise.resolve(throwingRuntime),
    });
    processes.processes = [{ pid: 4_001, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x1000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);

    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'attachFailed', actionable: true });
    expect(throwingRuntime.attachCalls).toBe(1);

    await clock.advance(1_000);
    await clock.advance(1_000);
    await clock.advance(1_000);

    expect(throwingRuntime.attachCalls).toBeGreaterThan(1);
    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'attachFailed' });
  });

  it('reports attachFailed, detaches the session, and keeps polling when installInterceptor throws', async () => {
    class ThrowingInstallSession implements TapSession {
      readonly pid: number;
      detachCount = 0;
      constructor(pid: number) {
        this.pid = pid;
      }
      installInterceptor(_address: number): TapInterceptor {
        throw new Error('installInterceptor: address out of range');
      }
      detach(): void {
        this.detachCount += 1;
      }
    }
    const sessions: ThrowingInstallSession[] = [];
    class ThrowingInstallRuntime implements TapRuntime {
      attach(pid: number): Promise<TapSession> {
        const session = new ThrowingInstallSession(pid);
        sessions.push(session);
        return Promise.resolve(session);
      }
    }
    const { tap, clock, processes, candidates } = createHarness({
      resolveRuntime: () => Promise.resolve(new ThrowingInstallRuntime()),
    });
    processes.processes = [{ pid: 4_002, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x1000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);

    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'attachFailed', actionable: true });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.detachCount).toBeGreaterThan(0);

    await clock.advance(1_000);
    await clock.advance(1_000);
    await clock.advance(1_000);

    expect(sessions.length).toBeGreaterThan(1);
    for (const session of sessions) expect(session.detachCount).toBeGreaterThan(0);
  });
});

describe('Tap: observed HTTP bodies reach onHttpBody', () => {
  it('forwards a reassembled HTTP body once the response completes, stamped with the tap clock', async () => {
    const { tap, clock, processes, candidates, runtime, httpBodies } = createHarness();
    processes.processes = [{ pid: 6_001, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0xa000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);
    const interceptor = runtime.sessions[0]?.interceptorsByAddress.get(0xa000);
    if (!interceptor) throw new Error('test setup: interceptor not installed');

    const json = JSON.stringify({ field_size: 3 });
    interceptor.fire({ ctx: 'rest-0', bytes: buildHttpResponse(200, 'OK', json) });

    expect(httpBodies).toHaveLength(1);
    expect(httpBodies[0]?.body.toString('utf8')).toBe(json);
    expect(httpBodies[0]?.atMs).toBe(clock.now());
  });

  it('never calls onHttpBody for a status-only response with no body', async () => {
    const { tap, clock, processes, candidates, runtime, httpBodies } = createHarness();
    processes.processes = [{ pid: 6_002, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0xb000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);
    const interceptor = runtime.sessions[0]?.interceptorsByAddress.get(0xb000);
    if (!interceptor) throw new Error('test setup: interceptor not installed');

    interceptor.fire({ ctx: 'rest-0', bytes: buildHttpResponse(204, 'No Content', '') });

    expect(httpBodies).toEqual([]);
  });
});

describe('Tap: REST-only traffic on a proven hook reports clientNotStreaming, not hookSilent', () => {
  it('stays actionable=false and does not fire hookSilent when only periodic HTTP responses keep arriving', async () => {
    const { tap, clock, processes, candidates, runtime, events } = createHarness();
    processes.processes = [{ pid: 5_001, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x8000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);
    const interceptor = runtime.sessions[0]?.interceptorsByAddress.get(0x8000);
    if (!interceptor) throw new Error('test setup: interceptor not installed');

    interceptor.fire({ ctx: 'rest-0', bytes: buildHttpResponse(200, 'OK', '') });
    expect(tap.getCurrency().kind).toBe('live');

    for (let second = 0; second < 70; second += 1) {
      await clock.advance(1_000);
      interceptor.fire({ ctx: `rest-${String(second)}`, bytes: buildHttpResponse(200, 'OK', '') });
    }

    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'clientNotStreaming', actionable: false });
    expect(
      events.some((e) => e.type === 'currency' && e.currency.kind === 'gap' && e.currency.reason === 'hookSilent'),
    ).toBe(false);
  });

  it('still reports hookSilent (actionable) when a proven hook goes completely silent, no traffic of any kind', async () => {
    const { tap, clock, processes, candidates, runtime } = createHarness();
    processes.processes = [{ pid: 5_002, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x9000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);
    const interceptor = runtime.sessions[0]?.interceptorsByAddress.get(0x9000);
    if (!interceptor) throw new Error('test setup: interceptor not installed');

    interceptor.fire({ ctx: 'conn', bytes: snapFrameBytes() });
    expect(tap.getCurrency().kind).toBe('live');

    await clock.advance(62_000);

    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'hookSilent', actionable: true });
  });
});

describe('Tap: discovery backoff after a failed candidate scan', () => {
  it('does not re-invoke the candidate source every poll once discovery has failed for a pid', async () => {
    let resolveCalls = 0;
    class CountingHookCandidateSource implements HookCandidateSource {
      resolve(_pid: number): HookCandidateResolution {
        resolveCalls += 1;
        return { addresses: [], fromCache: false, buildId: null };
      }
      commit(): void {
        /* not exercised */
      }
      invalidate(): void {
        /* not exercised */
      }
    }
    const clock = new FakeClock();
    const processes = new FakeProcessLister();
    const runtime = new FakeRuntime();
    const runtimePort = new RuntimePort({ resolve: () => Promise.resolve(runtime) });
    const tap = new Tap({
      processName: PROCESS_NAME,
      runtime: runtimePort,
      processes,
      candidates: new CountingHookCandidateSource(),
      consent: () => true,
      clock,
      onEvent: () => undefined,
      pollIntervalMs: 1_000,
    });
    processes.processes = [{ pid: 6_001, name: PROCESS_NAME }];

    tap.start();
    await clock.advance(0);
    expect(resolveCalls).toBe(1);
    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'attachFailed' });

    await clock.advance(1_000);
    await clock.advance(1_000);
    await clock.advance(1_000);
    await clock.advance(1_000);

    expect(resolveCalls).toBe(1);
  });

  it('scans again once a different pid is the attach target', async () => {
    let resolveCalls = 0;
    const seenPids: number[] = [];
    class CountingHookCandidateSource implements HookCandidateSource {
      resolve(pid: number): HookCandidateResolution {
        resolveCalls += 1;
        seenPids.push(pid);
        return { addresses: [], fromCache: false, buildId: null };
      }
      commit(): void {
        /* not exercised */
      }
      invalidate(): void {
        /* not exercised */
      }
    }
    const clock = new FakeClock();
    const processes = new FakeProcessLister();
    const runtime = new FakeRuntime();
    const runtimePort = new RuntimePort({ resolve: () => Promise.resolve(runtime) });
    const tap = new Tap({
      processName: PROCESS_NAME,
      runtime: runtimePort,
      processes,
      candidates: new CountingHookCandidateSource(),
      consent: () => true,
      clock,
      onEvent: () => undefined,
      pollIntervalMs: 1_000,
    });
    processes.processes = [{ pid: 6_101, name: PROCESS_NAME }];

    tap.start();
    await clock.advance(0);
    expect(resolveCalls).toBe(1);

    await clock.advance(1_000);
    expect(resolveCalls).toBe(1);

    processes.processes = [{ pid: 6_102, name: PROCESS_NAME }];
    await clock.advance(1_000);

    expect(resolveCalls).toBe(2);
    expect(seenPids).toEqual([6_101, 6_102]);
  });
});

describe('Tap: consent gate', () => {
  it('does not attach while consent is withheld, and reports consentMissing', async () => {
    const { tap, clock, processes, runtime } = createHarness({ consent: false });
    processes.processes = [{ pid: 666, name: PROCESS_NAME }];

    tap.start();
    await clock.advance(0);

    expect(runtime.sessions).toHaveLength(0);
    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'consentMissing' });
  });

  it('honours a revoke that lands while the process list is still being fetched', async () => {
    const harness = createHarness({ consent: true });
    harness.processes.processes = [{ pid: 666, name: PROCESS_NAME }];

    const realList = harness.processes.list.bind(harness.processes);
    harness.processes.list = (processName: string) => {
      harness.setConsent(false);
      return realList(processName);
    };

    harness.tap.start();
    await harness.clock.advance(0);

    expect(harness.runtime.sessions).toHaveLength(0);
    expect(harness.tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'consentMissing' });
  });

  it('performs zero process-list calls while consent is withheld, even with a matching process running', async () => {
    const { tap, clock, processes } = createHarness({ consent: false });
    processes.processes = [{ pid: 666, name: PROCESS_NAME }];

    tap.start();
    await clock.advance(0);
    await clock.advance(1_000);
    await clock.advance(1_000);

    expect(processes.listCalls).toBe(0);
  });

  it('logs nothing naming a pid or the process while consent is withheld', async () => {
    const { tap, clock, processes, infos } = createHarness({ consent: false });
    processes.processes = [{ pid: 666, name: PROCESS_NAME }];

    tap.start();
    await clock.advance(0);

    expect(infos.some((record) => record.event === 'tap.target_selected')).toBe(false);
    expect(infos.every((record) => !('pid' in record))).toBe(true);
  });

  it('begins probing once consent is granted, without a restart', async () => {
    const { tap, clock, processes, candidates, runtime, setConsent } = createHarness({ consent: false });
    processes.processes = [{ pid: 9_001, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x1000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);
    expect(processes.listCalls).toBe(0);

    setConsent(true);
    tap.pollNow();
    await clock.advance(0);

    expect(processes.listCalls).toBeGreaterThan(0);
    expect(runtime.sessions).toHaveLength(1);
  });

  it('stops probing again once consent is revoked', async () => {
    const { tap, clock, processes, setConsent } = createHarness({ consent: true, pollIntervalMs: 1_000 });
    processes.processes = [];

    tap.start();
    await clock.advance(0);
    await clock.advance(1_000);
    const callsBeforeRevoke = processes.listCalls;
    expect(callsBeforeRevoke).toBeGreaterThan(0);

    setConsent(false);
    await clock.advance(1_000);
    await clock.advance(1_000);

    expect(processes.listCalls).toBe(callsBeforeRevoke);
    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'consentMissing' });
  });
});

describe('Tap: runtime resolution', () => {
  it('reports runtimeUnavailable without throwing when the runtime fails to resolve, logged once', async () => {
    const { tap, clock, processes, infos } = createHarness({
      resolveRuntime: () => Promise.reject(new Error('no prebuild for this platform')),
    });
    processes.processes = [{ pid: 777, name: PROCESS_NAME }];

    tap.start();
    await clock.advance(0);

    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'runtimeUnavailable', likelyQuarantine: false });
    expect(infos.filter((r) => r.event === 'runtime.unavailable')).toHaveLength(1);
  });

  it('propagates likelyQuarantine true once the runtime resolved earlier this session and then fails', async () => {
    let succeeded = false;
    const { tap, clock, processes, runtimePort } = createHarness({
      resolveRuntime: () => {
        if (!succeeded) {
          succeeded = true;
          return Promise.resolve(new FakeRuntime());
        }
        return Promise.reject(new Error('module vanished'));
      },
    });
    await runtimePort.resolve();

    processes.processes = [{ pid: 888, name: PROCESS_NAME }];
    tap.start();
    await clock.advance(0);

    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'runtimeUnavailable', likelyQuarantine: true });
  });
});

describe('Tap: target selection', () => {
  it('chooses the lower pid deterministically when two candidate processes are running, and reports the choice', async () => {
    const { tap, clock, processes, candidates, runtime, infos } = createHarness();
    processes.processes = [
      { pid: 999, name: PROCESS_NAME },
      { pid: 100, name: PROCESS_NAME },
    ];
    candidates.resolveResult = { addresses: [0x1000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);

    expect(runtime.sessions.map((s) => s.pid)).toEqual([100]);
    expect(infos).toContainEqual(
      expect.objectContaining({ event: 'tap.target_selected', pid: 100, candidateCount: 2 }),
    );
  });
});

describe('Tap: process lifecycle', () => {
  it('does not attempt to attach when the game is not running at startup, and reports a non-actionable gap', async () => {
    const { tap, clock, runtime } = createHarness();

    tap.start();
    await clock.advance(0);

    expect(runtime.sessions).toHaveLength(0);
    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'clientNotStreaming', actionable: false });
  });

  it('attaches once the process appears after the tap has already started, without a restart', async () => {
    const { tap, clock, processes, candidates, runtime } = createHarness();
    candidates.resolveResult = { addresses: [0x1000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);
    expect(runtime.sessions).toHaveLength(0);

    processes.processes = [{ pid: 1_010, name: PROCESS_NAME }];
    await clock.advance(1_000);

    expect(runtime.sessions).toHaveLength(1);
  });

  it('tears down cleanly and reports a non-actionable gap when the process exits while attached', async () => {
    const { tap, clock, processes, candidates, runtime } = createHarness();
    processes.processes = [{ pid: 1_111, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x1000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);
    const session = runtime.sessions[0];
    if (!session) throw new Error('test setup: no session');
    const interceptor = session.interceptorsByAddress.get(0x1000);
    if (!interceptor) throw new Error('test setup: no interceptor');
    interceptor.fire({ ctx: 'conn', bytes: snapFrameBytes() });
    expect(tap.getCurrency().kind).toBe('live');

    processes.processes = [];
    await clock.advance(1_000);

    expect(session.detachCount).toBeGreaterThan(0);
    expect(interceptor.detachCount).toBeGreaterThan(0);
    expect(tap.getCurrency()).toMatchObject({ kind: 'gap', reason: 'clientNotStreaming', actionable: false });
  });
});

const tempDirs: string[] = [];

function tempCacheDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-hook-candidates-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createHookCacheLogSpy(): { log: HookCacheLogPort; warnings: Record<string, unknown>[] } {
  const warnings: Record<string, unknown>[] = [];
  return { log: { warn: (record) => warnings.push(record) }, warnings };
}

class FakeImageSource implements ProcessImageSource {
  readonly images = new Map<number, Buffer>();

  read(pid: number): Buffer | null {
    return this.images.get(pid) ?? null;
  }
}

/** Just enough of a PE32+ header for `parsePe` to succeed: no sections, no exception directory.
 *  `discoverHookCandidates` needs `.text`/`.rdata` to find anything, so this always yields zero
 *  candidates — it exists to give `commit`/`invalidate` a real, safely-computed build id. */
function buildMinimalParsablePe(opts: { timeDateStamp: number; sizeOfImage: number; addressOfEntryPoint: number }): Buffer {
  const optOff = 0x58;
  const sizeOfOptionalHeader = 0xf0;
  const image = Buffer.alloc(optOff + sizeOfOptionalHeader + 0x40);

  image.writeUInt16LE(0x5a4d, 0);
  image.writeUInt32LE(0x40, 0x3c);

  image.writeUInt32LE(0x00004550, 0x40);
  image.writeUInt16LE(0, 0x46);
  image.writeUInt32LE(opts.timeDateStamp, 0x48);
  image.writeUInt16LE(sizeOfOptionalHeader, 0x54);

  image.writeUInt16LE(0x20b, optOff);
  image.writeUInt32LE(opts.addressOfEntryPoint, optOff + 16);
  image.writeUInt32LE(opts.sizeOfImage, optOff + 56);

  return image;
}

describe('createHookCandidateSource: resolve()', () => {
  it('degrades to no candidates, without throwing, when the image is readable but not a valid PE — logged once', () => {
    const dir = tempCacheDir();
    const image = new FakeImageSource();
    image.images.set(2_020, Buffer.from('not a pe image at all', 'latin1'));
    const { log, warnings } = createHookCacheLogSpy();
    const source = createHookCandidateSource({ cacheDir: dir, image, log });

    let result: HookCandidateResolution | undefined;
    expect(() => {
      result = source.resolve(2_020);
    }).not.toThrow();

    expect(result).toEqual({ addresses: [], fromCache: false, buildId: null });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      scope: 'live-source',
      event: 'hook_candidates.unparseable_image',
      pid: 2_020,
    });
  });

  it('reports the same shape as a missing image when the buffer parses cleanly but finds nothing', () => {
    const dir = tempCacheDir();
    const image = new FakeImageSource();
    image.images.set(
      2_121,
      buildMinimalParsablePe({ timeDateStamp: 0x11111111, sizeOfImage: 0x2000, addressOfEntryPoint: 0x1000 }),
    );
    const source = createHookCandidateSource({ cacheDir: dir, image });

    expect(source.resolve(2_121)).toEqual({ addresses: [], fromCache: false, buildId: '11111111-2000-1000' });
  });
});

describe('createHookCandidateSource: commit() / invalidate()', () => {
  it('are no-ops for a pid whose image cannot be parsed, since both rely only on the safe build id', () => {
    const dir = tempCacheDir();
    const image = new FakeImageSource();
    image.images.set(3_030, Buffer.from('not a pe image at all', 'latin1'));
    const source = createHookCandidateSource({ cacheDir: dir, image });
    const { buildId } = source.resolve(3_030);

    expect(() => {
      source.commit(3_030, 0x1000, buildId);
    }).not.toThrow();
    expect(() => {
      source.invalidate(3_030, buildId);
    }).not.toThrow();
    expect(fs.existsSync(path.join(dir, 'hook-cache.json'))).toBe(false);
  });

  it('persists a committed record with no hits field at all', () => {
    const dir = tempCacheDir();
    const image = new FakeImageSource();
    image.images.set(
      4_040,
      buildMinimalParsablePe({ timeDateStamp: 0x22222222, sizeOfImage: 0x3000, addressOfEntryPoint: 0x1000 }),
    );
    const source = createHookCandidateSource({ cacheDir: dir, image });
    const { buildId } = source.resolve(4_040);

    source.commit(4_040, 0x9000, buildId);

    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'hook-cache.json'), 'utf8')) as {
      builds: Record<string, Record<string, unknown>>;
    };
    const [record] = Object.values(raw.builds);
    if (!record) throw new Error('test setup: no record committed');
    expect(record).toMatchObject({ rva: 0x9000 });
    expect('hits' in record).toBe(false);
  });
});

describe('Tap: teardown', () => {
  it('resolves only once every interceptor and session is detached, and stops future attach attempts', async () => {
    const { tap, clock, processes, candidates, runtime } = createHarness();
    processes.processes = [{ pid: 1_212, name: PROCESS_NAME }];
    candidates.resolveResult = { addresses: [0x1000], fromCache: false, buildId: null };

    tap.start();
    await clock.advance(0);
    const session = runtime.sessions[0];
    if (!session) throw new Error('test setup: no session');
    const interceptor = session.interceptorsByAddress.get(0x1000);
    if (!interceptor) throw new Error('test setup: no interceptor');
    interceptor.fire({ ctx: 'conn', bytes: snapFrameBytes() });
    expect(tap.getCurrency().kind).toBe('live');

    await tap.teardown();

    expect(session.detachCount).toBeGreaterThan(0);
    expect(interceptor.detachCount).toBeGreaterThan(0);

    const sessionCountAfterTeardown = runtime.sessions.length;
    await clock.advance(100_000);
    expect(runtime.sessions.length).toBe(sessionCountAfterTeardown);
  });
});
