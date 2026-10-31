import {
  type CapabilityCall,
  type CapabilityReply,
  type HostToWorker,
  PREMIUM_CAPABILITIES,
  type PremiumPauseReason,
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
  const buckets = new Map<string, { tokens: number; at: number }>();
  /** Calls still waiting on their handler, each with the way to answer it. */
  const pending = new Map<number, { id: number; capability: string; reply: Reply }>();
  let nextKey = 0;
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

  function takeToken(capability: string): boolean {
    const at = now();
    const bucket = buckets.get(capability) ?? { tokens: perMinute, at };
    const tokens = Math.min(perMinute, bucket.tokens + ((at - bucket.at) * perMinute) / 60_000);
    if (tokens < 1) {
      buckets.set(capability, { tokens, at });
      return false;
    }
    buckets.set(capability, { tokens: tokens - 1, at });
    return true;
  }

  function handle(data: unknown, reply: Reply): void {
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
    if (!takeToken(capability)) {
      refuse(reply, id, capability, 'rate_limited');
      return;
    }

    const handler = allowlist.get(capability) as CapabilityHandler;
    let result: unknown;
    try {
      result = handler(args);
    } catch {
      refuse(reply, id, capability, 'bad_call', 'error');
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
      () => {
        if (!pending.delete(key)) return;
        refuse(reply, id, capability, 'bad_call', 'error');
      },
    );
  }

  function onMessage(data: unknown): void {
    if (closed) return;
    handle(data, post);
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
    callFromUi(call) {
      return new Promise((resolve) => {
        if (closed) {
          resolve({ id: typeof call.id === 'number' ? call.id : -1, ok: false, error: 'stopped' });
          return;
        }
        handle(call, resolve);
      });
    },
    close() {
      if (closed) return;
      closed = true;
      const waiting = [...pending.values()];
      pending.clear();
      for (const { id, capability, reply } of waiting) refuse(reply, id, capability, 'stopped');
      port.close();
    },
  };
}
