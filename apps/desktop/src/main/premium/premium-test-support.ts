import type { AppLocale, PremiumView } from '@bombfarm/contracts';
import type { LogPort } from '../storage/index.js';
import type { LoopbackListener, LoopbackResult, startLoopbackListener } from './loopback-listener.js';
import { createPremiumApi, type PremiumApi } from './premium-api.js';
import type { PremiumHttp, PremiumHttpRequest, PremiumHttpResponse, PremiumPath } from './premium-transport.js';
import { createPremiumService, type GameIdentity, type PremiumService } from './premium-service.js';
import { createPremiumCache, type PremiumCache, type PremiumCacheEntry } from './premium-cache.js';
import type { StoredSession, TokenVault } from './token-vault.js';

export const SECRETS = {
  token: 'desktop-token-0f3a9c11',
  rotatedToken: 'desktop-token-7be21459',
  verifier: 'verifier-fixture-52d1e8aa',
  state: 'state-fixture-91ac4733',
  code: 'code-fixture-c3380b64',
  approvalUrl: 'https://approve.invalid/start/approval-fixture-6e21d0',
  handOffUrl: 'https://manage.invalid/enter/handoff-fixture-84fd19',
  accountId: 'account-fixture-4410',
  steamId64: '76561198012345678',
  gameToken: 'game-session-token-fixture-d00d5e',
} as const;

export const REDIRECT_URI = 'http://127.0.0.1:41999/callback';
export const START_MS = Date.parse('2026-10-20T12:00:00.000Z');

export function session(token: string, rotateAfterMs: number = START_MS + 86_400_000): StoredSession {
  return {
    token,
    expiresAt: new Date(START_MS + 30 * 86_400_000).toISOString(),
    rotateAfter: new Date(rotateAfterMs).toISOString(),
  };
}

export interface StubReply {
  status: number;
  body?: unknown;
  retryAfterSec?: number;
}

export interface RecordedRequest {
  path: PremiumPath;
  token: string | undefined;
  body: unknown;
  raw: string;
}

type Handler = (request: RecordedRequest, count: number) => StubReply | Promise<StubReply>;

const IDLE_STATES = {
  awaitingPayment: null,
  grace: null,
  cancellationScheduled: null,
  paymentFailed: false,
  pendingFirstPayment: false,
  disputeHold: false,
};

export const INACTIVE_STATUS_BODY = { active: false, kinds: [], until: null, entitlements: [], states: IDLE_STATES };
export const ACTIVE_STATUS_BODY = {
  active: true,
  kinds: ['subscription'],
  until: '2026-12-01T00:00:00.000Z',
  entitlements: [],
  states: IDLE_STATES,
};
export const ME_BODY = {
  v: 1,
  signInMethods: ['discord'],
  steamVerified: true,
  gameAccountLinked: false,
  admitted: false,
};

export function tokenBody(token: string, rotateAfterMs: number = START_MS + 86_400_000): unknown {
  const stored = session(token, rotateAfterMs);
  return { token, expiresAt: stored.expiresAt, rotateAfter: stored.rotateAfter };
}

function defaultHandlers(): Record<PremiumPath, Handler> {
  return {
    signInRequest: () => ({ status: 201, body: { approvalUrl: SECRETS.approvalUrl, expiresAt: '2026-10-20T12:10:00.000Z' } }),
    token: () => ({ status: 200, body: tokenBody(SECRETS.token) }),
    rotate: () => ({ status: 200, body: tokenBody(SECRETS.rotatedToken, START_MS + 2 * 86_400_000) }),
    signOut: () => ({ status: 204 }),
    me: () => ({ status: 200, body: ME_BODY }),
    report: () => ({ status: 200, body: { outcome: 'linked' } }),
    handOff: () => ({ status: 200, body: { url: SECRETS.handOffUrl, expiresAt: '2026-10-20T12:05:00.000Z' } }),
    status: () => ({ status: 200, body: INACTIVE_STATUS_BODY }),
    visibility: () => ({ status: 200, body: { visible: false } }),
  };
}

export interface StubApi {
  http: PremiumHttp;
  requests: RecordedRequest[];
  on(path: PremiumPath, handler: Handler | StubReply): void;
  calls(path: PremiumPath): RecordedRequest[];
}

export function createStubApi(): StubApi {
  const handlers = defaultHandlers();
  const requests: RecordedRequest[] = [];
  const counts = new Map<PremiumPath, number>();
  return {
    requests,
    on(path, handler) {
      handlers[path] = typeof handler === 'function' ? handler : () => handler;
    },
    calls: (path) => requests.filter((request) => request.path === path),
    http: async (req: PremiumHttpRequest): Promise<PremiumHttpResponse> => {
      const request: RecordedRequest = {
        path: req.path,
        token: req.token,
        body: req.body,
        raw: req.body === undefined ? '' : JSON.stringify(req.body),
      };
      requests.push(request);
      const count = (counts.get(req.path) ?? 0) + 1;
      counts.set(req.path, count);
      const reply = await handlers[req.path](request, count);
      return {
        status: reply.status,
        body: reply.body === undefined ? '' : JSON.stringify(reply.body),
        retryAfterSec: reply.retryAfterSec ?? null,
      };
    },
  };
}

export function unreachable(): Promise<StubReply> {
  return Promise.reject(new Error('stub network is down'));
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export function settle(): Promise<void> {
  return new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

export interface FakeClock {
  now(): number;
  advance(ms: number): Promise<void>;
  pending(): number;
  scheduler: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };
}

export function createFakeClock(start: number = START_MS): FakeClock {
  let current = start;
  let nextId = 1;
  const timers = new Map<number, { at: number; run: () => void }>();

  function earliest(limit: number): [number, { at: number; run: () => void }] | null {
    let found: [number, { at: number; run: () => void }] | null = null;
    for (const entry of timers) {
      if (entry[1].at <= limit && (found === null || entry[1].at < found[1].at)) found = entry;
    }
    return found;
  }

  return {
    now: () => current,
    pending: () => timers.size,
    async advance(ms) {
      const target = current + ms;
      for (let due = earliest(target); due !== null; due = earliest(target)) {
        timers.delete(due[0]);
        current = Math.max(current, due[1].at);
        due[1].run();
        await settle();
      }
      current = target;
      await settle();
    },
    scheduler: {
      setTimeout: ((callback: () => void, delay: number) => {
        const id = nextId++;
        timers.set(id, { at: current + delay, run: callback });
        return id as unknown as ReturnType<typeof setTimeout>;
      }) as unknown as typeof setTimeout,
      clearTimeout: (handle: unknown) => {
        timers.delete(Number(handle));
      },
    },
  };
}

export interface FakeVault extends TokenVault {
  stores: StoredSession[];
  clears: number;
  held(): StoredSession | null;
}

export function createFakeVault(
  initial: StoredSession | null = null,
  outcome: 'persisted' | 'memory-only' = 'persisted',
): FakeVault {
  let held = initial;
  const vault: FakeVault = {
    stores: [],
    clears: 0,
    held: () => held,
    load: () => held,
    store(next) {
      vault.stores.push(next);
      held = next;
      return outcome;
    },
    clear() {
      vault.clears += 1;
      held = null;
    },
  };
  return vault;
}

export interface SpiedCache extends PremiumCache {
  writes: PremiumCacheEntry[];
  clears: number;
}

export function createSpiedCache(seed: PremiumCacheEntry | null = null): SpiedCache {
  const inner = createPremiumCache(null);
  if (seed !== null) inner.write(seed);
  const cache: SpiedCache = {
    writes: [],
    clears: 0,
    read: () => inner.read(),
    write(entry) {
      cache.writes.push(entry);
      inner.write(entry);
    },
    clear() {
      cache.clears += 1;
      inner.clear();
    },
  };
  return cache;
}

export interface FakeListener {
  listener: LoopbackListener;
  closed: number;
  finish(result: LoopbackResult): void;
}

export function createFakeListener(redirectUri: string = REDIRECT_URI): FakeListener {
  const result = deferred<LoopbackResult>();
  const fake: FakeListener = {
    closed: 0,
    finish: (outcome) => {
      result.resolve(outcome);
    },
    listener: {
      redirectUri,
      result: result.promise,
      close() {
        fake.closed += 1;
        result.resolve({ kind: 'closed' });
      },
    },
  };
  return fake;
}

export interface ListenerStarts {
  start: typeof startLoopbackListener;
  options: Parameters<typeof startLoopbackListener>[0][];
  made: FakeListener[];
  failNext(): void;
}

export function createListenerFactory(): ListenerStarts {
  let failing = false;
  const starts: ListenerStarts = {
    options: [],
    made: [],
    failNext: () => {
      failing = true;
    },
    start: (options) => {
      starts.options.push(options);
      if (failing) {
        failing = false;
        return Promise.reject(new Error('address in use'));
      }
      const fake = createFakeListener();
      starts.made.push(fake);
      return Promise.resolve(fake.listener);
    },
  };
  return starts;
}

export interface LogSink extends LogPort {
  records: Record<string, unknown>[];
  events(): string[];
}

export function createLogSink(): LogSink {
  const records: Record<string, unknown>[] = [];
  const keep = (record: Record<string, unknown>): void => {
    records.push(record);
  };
  return { records, info: keep, warn: keep, error: keep, events: () => records.map((record) => String(record['event'])) };
}

export interface Harness {
  service: PremiumService;
  api: PremiumApi;
  stub: StubApi;
  clock: FakeClock;
  vault: FakeVault;
  cache: SpiedCache;
  log: LogSink;
  listeners: ListenerStarts;
  opened: string[];
  views: PremiumView[];
  identity: { current: GameIdentity | null };
  failOpening(): void;
  signedIn(): Promise<void>;
}

export interface HarnessOptions {
  vault?: FakeVault;
  cache?: SpiedCache;
  listener?: (clock: FakeClock) => typeof startLoopbackListener;
  api?: (real: PremiumApi) => PremiumApi;
  locale?: () => AppLocale;
}

export function createHarness(options: HarnessOptions = {}): Harness {
  const stub = createStubApi();
  const clock = createFakeClock();
  const vault = options.vault ?? createFakeVault();
  const cache = options.cache ?? createSpiedCache();
  const log = createLogSink();
  const listeners = createListenerFactory();
  const opened: string[] = [];
  const views: PremiumView[] = [];
  const identity: { current: GameIdentity | null } = {
    current: { accountId: SECRETS.accountId, steamId64: SECRETS.steamId64 },
  };
  let openingFails = false;
  const realApi = createPremiumApi(stub.http);
  const api = options.api === undefined ? realApi : options.api(realApi);

  const service = createPremiumService({
    api,
    vault,
    cache,
    openExternal: (url) => {
      if (openingFails) return Promise.reject(new Error('no browser'));
      opened.push(url);
      return Promise.resolve();
    },
    readGameIdentity: () => identity.current,
    startListener: options.listener === undefined ? listeners.start : options.listener(clock),
    locale: options.locale ?? (() => 'en'),
    pkce: {
      createPkce: () => ({ verifier: SECRETS.verifier, challenge: 'challenge-fixture' }),
      createState: () => SECRETS.state,
    },
    now: () => clock.now(),
    scheduler: clock.scheduler,
    log,
    onChanged: (view) => {
      views.push(view);
    },
  });

  return {
    service,
    api,
    stub,
    clock,
    vault,
    cache,
    log,
    listeners,
    opened,
    views,
    identity,
    failOpening: () => {
      openingFails = true;
    },
    async signedIn() {
      await service.signIn();
      listeners.made.at(-1)?.finish({ kind: 'code', code: SECRETS.code });
      await settle();
    },
  };
}
