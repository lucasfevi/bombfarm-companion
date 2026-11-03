import {
  type CapabilityCall,
  type CapabilityReply,
  type DbRefusalReason,
  type HostEventsMessage,
  type HostToWorker,
  PREMIUM_CAPABILITIES,
  type PremiumPauseReason,
  type PremiumSlot,
  type PremiumWorkerRefusalReason,
} from '@bombfarm/contracts';
import type { LogPort } from '../../storage/index.js';

/**
 * The only way a Premium worker asks the host for anything: typed calls over one port, each
 * answered `{id, ok, value | error}`. Checks run in this order: shape (`bad_call`), paused (`paused`,
 * for every capability, granted or not), granted (`not_granted`: the bundle declared it AND the host
 * allowlist has it), then the per-capability budget (`rate_limited`). Every call writes one log record; arguments are never logged.
 * The Premium screen's calls take the same road through `callFromUi`: one grant, one pause, one
 * budget and one audit stream for the worker and the screen.
 */

export type CapabilityHandler = (args: unknown) => unknown;

/** Who made the call: the Premium worker over its port, or the Premium screen through `callFromUi`. */
export type CallOrigin = 'worker' | 'ui';

export interface CapabilityContext {
  readonly origin: CallOrigin;
}

/** A handler that wants to know who is calling; wrap it with `withOrigin` to put it in the allowlist. */
export type OriginHandler = (args: unknown, ctx: CapabilityContext) => unknown;

const originAware = new WeakSet<CapabilityHandler>();

/** Mark a handler to receive `{ origin }` as its second argument; every other handler sees only its arguments. */
export function withOrigin(handler: OriginHandler): CapabilityHandler {
  const wrapped = ((args: unknown, ctx?: CapabilityContext) =>
    handler(args, ctx ?? { origin: 'worker' })) as CapabilityHandler;
  originAware.add(wrapped);
  return wrapped;
}

/** What a handler throws (or rejects with) to refuse a call with a named code and, optionally, a reason. */
export class CapabilityError extends Error {
  constructor(
    readonly code:
      | 'bad_args'
      | 'too_large'
      | 'unavailable'
      | 'rate_limited'
      | 'timeout'
      | 'failed'
      | 'stopped'
      | 'paused'
      | 'not_granted',
    readonly reason?: DbRefusalReason | PremiumWorkerRefusalReason,
  ) {
    super(code);
    this.name = 'CapabilityError';
  }
}

/** A capability's own bucket; with `perOrigin` the worker and the screen each get one. */
export interface CapabilityBudget {
  readonly perMinute: number;
  readonly perOrigin?: boolean;
}

/** `db` and `premium.worker` count per origin; every other capability shares `ratePerMinute`. */
export const DEFAULT_BUDGETS: Readonly<Record<string, CapabilityBudget>> = Object.freeze({
  db: { perMinute: 600, perOrigin: true },
  'premium.worker': { perMinute: 600, perOrigin: true },
});

/** How long the screen's question waits for the worker's answer. */
export const ASK_WORKER_TIMEOUT_MS = 5_000;

type EventName = HostEventsMessage['name'];
type EventItems<N extends EventName> = Extract<HostEventsMessage, { name: N }>['items'];

/** What the channel needs from a message port; `MessagePortMain` satisfies it. */
export interface CapabilityPort {
  on(event: 'message', listener: (event: { data: unknown }) => void): unknown;
  postMessage(message: HostToWorker): void;
  start(): void;
  close(): void;
}

export interface CapabilityChannelDeps {
  readonly port: CapabilityPort;
  /** The capabilities the bundle's manifest declares. */
  readonly requested: readonly string[];
  /** The capabilities the host offers; empty until one is designed. */
  readonly allowlist: ReadonlyMap<string, CapabilityHandler>;
  /** The bundle's sequence, for the audit record. */
  readonly sequence: number;
  /** Milliseconds from any steady clock. */
  readonly now: () => number;
  readonly log: LogPort;
  /** Calls per capability per minute; 60 unless a test says otherwise. */
  readonly ratePerMinute?: number;
  /** Capabilities with their own budget; `DEFAULT_BUDGETS` unless a test says otherwise. */
  readonly budgets?: Readonly<Record<string, CapabilityBudget>>;
  /** The names that may appear in the audit record; any other name is logged as `unknown`. */
  readonly knownCapabilities?: readonly string[];
}

export interface CapabilityChannel {
  /** The capabilities this worker may call: the declared ones the host offers. */
  readonly granted: readonly string[];
  /** Refuse every call from now on and tell the worker why, when the host knows. */
  pause(reason?: PremiumPauseReason): void;
  resume(): void;
  /** A call from the Premium screen: the same checks, budget and audit as a call from the worker. */
  callFromUi(call: CapabilityCall): Promise<CapabilityReply>;
  /**
   * Post one batch of feed items and count it in flight until the worker acks it. Returns its `seq`,
   * or `null` when the channel is paused or closed: then nothing is posted and nothing is kept.
   */
  emit<N extends EventName>(name: N, items: EventItems<N>): number | null;
  /** Batches posted and not yet acknowledged. */
  readonly inFlight: number;
  /** Called with each acknowledged `seq`, after it leaves the in-flight count. Returns the way to stop. */
  onAck(listener: (seq: number) => void): () => void;
  /**
   * Ask the worker's `onUiMessage` handler for the screen. Resolves with its value; rejects with a
   * `CapabilityError`: `unavailable`/`no_handler` when the worker has none, `timeout` after 5 s,
   * `stopped` on `close()`, `paused` while paused.
   */
  askWorker(slot: PremiumSlot, msg: unknown): Promise<unknown>;
  /** Answer every pending call `stopped`, then close the port. */
  close(): void;
}

export const DEFAULT_RATE_PER_MINUTE = 60;

type ErrorCode = Extract<CapabilityReply, { ok: false }>['error'];

/** Where an answer goes: the worker's port, or the promise of a call from the screen. */
type Reply = (reply: CapabilityReply) => void;

interface ParsedCall {
  readonly id: number;
  readonly capability: string;
  readonly args: unknown;
}

function parseCall(data: unknown): ParsedCall | { readonly id: number } {
  if (typeof data !== 'object' || data === null) return { id: -1 };
  const { id, capability, args } = data as Record<string, unknown>;
  const safeId = typeof id === 'number' && Number.isSafeInteger(id) ? id : -1;
  if (safeId === -1 || typeof capability !== 'string') return { id: safeId };
  return { id: safeId, capability, args };
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown } | null)?.then === 'function';
}

export function createCapabilityChannel(deps: CapabilityChannelDeps): CapabilityChannel {
  const { port, allowlist, sequence, now, log } = deps;
  const perMinute = deps.ratePerMinute ?? DEFAULT_RATE_PER_MINUTE;
  const known = new Set<string>(deps.knownCapabilities ?? PREMIUM_CAPABILITIES);
  const granted = [...new Set(deps.requested)].filter((name) => allowlist.has(name));
  const grantedSet = new Set(granted);
  const budgets = deps.budgets ?? DEFAULT_BUDGETS;
  const buckets = new Map<string, { tokens: number; at: number }>();
  /** Calls still waiting on their handler, each with the way to answer it. */
  const pending = new Map<number, { id: number; capability: string; reply: Reply }>();
  let nextKey = 0;
  let nextSeq = 1;
  let nextAskId = 1;
  const unacked = new Set<number>();
  const ackListeners = new Set<(seq: number) => void>();
  const asking = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: CapabilityError) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let paused = false;
  let closed = false;

  function audit(capability: string | null, outcome: string): void {
    log.info({
      scope: 'premium',
      event: 'premium.capability',
      capability: capability !== null && known.has(capability) ? capability : 'unknown',
      outcome,
      sequence,
    });
  }

  function post(message: HostToWorker): void {
    try {
      port.postMessage(message);
    } catch {
      // The worker is gone; there is nobody to tell.
    }
  }

  function refuse(
    reply: Reply,
    id: number,
    capability: string | null,
    error: ErrorCode,
    outcome: string = error,
  ): void {
    audit(capability, outcome);
    reply({ id, ok: false, error });
  }

  /** A handler's refusal keeps its reason; any other failure is a `bad_call` audited as `error`. */
  function refuseThrown(reply: Reply, id: number, capability: string, thrown: unknown): void {
    if (thrown instanceof CapabilityError) {
      audit(capability, thrown.code);
      reply(
        thrown.reason === undefined
          ? { id, ok: false, error: thrown.code }
          : { id, ok: false, error: thrown.code, reason: thrown.reason },
      );
    } else refuse(reply, id, capability, 'bad_call', 'error');
  }

  function takeToken(capability: string, origin: CallOrigin): boolean {
    const budget = budgets[capability];
    const limit = budget?.perMinute ?? perMinute;
    const key = budget?.perOrigin === true ? `${origin}:${capability}` : capability;
    const at = now();
    const bucket = buckets.get(key) ?? { tokens: limit, at };
    const tokens = Math.min(limit, bucket.tokens + ((at - bucket.at) * limit) / 60_000);
    if (tokens < 1) {
      buckets.set(key, { tokens, at });
      return false;
    }
    buckets.set(key, { tokens: tokens - 1, at });
    return true;
  }

  function handle(data: unknown, reply: Reply, origin: CallOrigin): void {
    const call = parseCall(data);
    if (!('capability' in call)) {
      refuse(reply, call.id, null, 'bad_call');
      return;
    }
    const { id, capability, args } = call;
    if (paused) {
      refuse(reply, id, capability, 'paused');
      return;
    }
    if (!grantedSet.has(capability)) {
      refuse(reply, id, capability, 'not_granted');
      return;
    }
    if (!takeToken(capability, origin)) {
      refuse(reply, id, capability, 'rate_limited');
      return;
    }

    const handler = allowlist.get(capability) as CapabilityHandler;
    let result: unknown;
    try {
      result = originAware.has(handler)
        ? (handler as OriginHandler)(args, { origin })
        : handler(args);
    } catch (thrown) {
      refuseThrown(reply, id, capability, thrown);
      return;
    }
    if (!isPromiseLike(result)) {
      audit(capability, 'ok');
      reply({ id, ok: true, value: result });
      return;
    }
    const key = nextKey++;
    pending.set(key, { id, capability, reply });
    result.then(
      (value) => {
        if (!pending.delete(key)) return;
        audit(capability, 'ok');
        reply({ id, ok: true, value });
      },
      (thrown: unknown) => {
        if (!pending.delete(key)) return;
        refuseThrown(reply, id, capability, thrown);
      },
    );
  }

  function safeInt(value: unknown): number | null {
    return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
  }

  /** The worker's acknowledgement of a batch or its answer to a question; anything else is a call. */
  function takeWorkerAnswer(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) return false;
    const message = data as Record<string, unknown>;
    if (message.t === 'ack') {
      const seq = safeInt(message.seq);
      if (seq === null) return false;
      if (unacked.delete(seq)) for (const listener of [...ackListeners]) listener(seq);
      return true;
    }
    if (message.t === 'uiReply') {
      const id = safeInt(message.id);
      if (id === null) return false;
      const waiting = asking.get(id);
      if (waiting === undefined) return true;
      asking.delete(id);
      clearTimeout(waiting.timer);
      if (message.ok === true) waiting.resolve(message.value);
      else if (message.reason === 'other') waiting.reject(new CapabilityError('failed', 'other'));
      else waiting.reject(new CapabilityError('unavailable', 'no_handler'));
      return true;
    }
    return false;
  }

  function onMessage(data: unknown): void {
    if (closed) return;
    if (takeWorkerAnswer(data)) return;
    handle(data, post, 'worker');
  }

  port.on('message', (event) => {
    onMessage(event.data);
  });
  port.start();

  return {
    granted,
    pause(reason) {
      if (closed || paused) return;
      paused = true;
      post(reason === undefined ? { t: 'paused' } : { t: 'paused', reason });
    },
    resume() {
      if (closed || !paused) return;
      paused = false;
      post({ t: 'resumed' });
    },
    emit(name, items) {
      if (closed || paused) return null;
      const seq = nextSeq++;
      unacked.add(seq);
      post({ t: 'events', seq, name, items } as HostEventsMessage);
      return seq;
    },
    get inFlight() {
      return unacked.size;
    },
    onAck(listener) {
      ackListeners.add(listener);
      return () => {
        ackListeners.delete(listener);
      };
    },
    askWorker(slot, msg) {
      if (closed) return Promise.reject(new CapabilityError('stopped'));
      if (paused) return Promise.reject(new CapabilityError('paused'));
      return new Promise((resolve, reject) => {
        const id = nextAskId++;
        const timer = setTimeout(() => {
          if (asking.delete(id)) reject(new CapabilityError('timeout'));
        }, ASK_WORKER_TIMEOUT_MS);
        asking.set(id, { resolve, reject, timer });
        post({ t: 'ui', id, slot, msg });
      });
    },
    callFromUi(call) {
      return new Promise((resolve) => {
        if (closed) {
          resolve({ id: typeof call.id === 'number' ? call.id : -1, ok: false, error: 'stopped' });
          return;
        }
        handle(call, resolve, 'ui');
      });
    },
    close() {
      if (closed) return;
      closed = true;
      const waiting = [...pending.values()];
      pending.clear();
      for (const { id, capability, reply } of waiting) refuse(reply, id, capability, 'stopped');
      const questions = [...asking.values()];
      asking.clear();
      unacked.clear();
      for (const { reject, timer } of questions) {
        clearTimeout(timer);
        reject(new CapabilityError('stopped'));
      }
      port.close();
    },
  };
}
