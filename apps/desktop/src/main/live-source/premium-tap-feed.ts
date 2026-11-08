import type { RawGapItem, RawTapItem } from '@bombfarm/contracts';
import { createEventDeduper } from '../boundary-log/dedup.js';
import type { CapabilityChannel } from '../premium/host/capability-channel.js';
import type { LogPort } from '../storage/index.js';
import type { ObservationCapture, ObservationSink } from './observation-capture.js';
import { scrubCredentials } from './scrub.js';

export const TAP_BATCH_MS = 100;
export const TAP_BATCH_ITEMS = 256;
export const TAP_MAX_UNACKED = 4;
export const TAP_RING_ITEMS = 2_000;
export const TAP_RING_BYTES = 8 * 1024 * 1024;

/** The sink the live and replay taps feed, plus the controls the `raw.tap` capability and the host runner use. */
export interface PremiumTapFeed extends ObservationSink {
  /** Start delivering; `seq` begins again at 1. A second call while subscribed changes nothing. */
  subscribe(): void;
  /** Stop delivering and drop whatever is queued. */
  unsubscribe(): void;
  /** Deliver and keep nothing until `resume`; the subscription stays. */
  pause(): void;
  /** Deliver again from now on, with no replay; `seq` continues. */
  resume(): void;
  /** The worker is gone: unsubscribe and stop listening to the channel. */
  dispose(): void;
}

export interface PremiumTapFeedDeps {
  readonly channel: Pick<CapabilityChannel, 'emit' | 'inFlight' | 'onAck'>;
  /** Whether the licensed game account is the one playing right now. Read on every event. */
  playingAccountAllows(): boolean;
  /** The licensed game account's id in the battle-log suffix form, or `null` when there is none. */
  accountKey(): string | null;
  /** Values that must never reach an item: session token, sign-in token, SteamID. Read on every event, so keep it cheap. */
  secrets(): ReadonlySet<string>;
  readonly log: LogPort;
  now(): number;
}

interface Queued {
  readonly item: RawTapItem;
  readonly bytes: number;
}

/** A feed that does nothing, for when Premium is off for the flavour. */
export const noopPremiumTapFeed: ObservationSink = {
  body: () => undefined,
  frame: () => undefined,
  currency: () => undefined,
  mark: () => undefined,
};

function containsSecret(text: string, secrets: ReadonlySet<string>): boolean {
  for (const secret of secrets) {
    if (secret.length > 0 && text.includes(secret)) return true;
  }
  return false;
}

/**
 * Turns what the tap observes into `raw.tap` batches for one Premium worker. Every method catches
 * its own faults: the tap latches its observer off after one throw, and that would take the
 * developer capture down with it. The tap thread only appends to the ring; it never waits on the worker.
 */
export function createPremiumTapFeed(deps: PremiumTapFeedDeps): PremiumTapFeed {
  const { channel } = deps;
  const deduper = createEventDeduper({
    emit: (record) => {
      deps.log.warn(record);
    },
    now: () => deps.now(),
  });

  let subscribed = false;
  let paused = false;
  let nextSeq = 1;
  let queue: Queued[] = [];
  let ringBytes = 0;
  let gap: { dropped: number; fromSeq: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stopTimer(): void {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  /** Forgets everything not yet posted. Those items were never delivered, so `seq` rewinds over
   *  them: a skip in `seq` must always come with a `raw.gap`, and a pause or a refused post sends none. */
  function clearQueued(): void {
    stopTimer();
    const firstUndelivered = gap?.fromSeq ?? queue[0]?.item.seq;
    if (firstUndelivered !== undefined) nextSeq = firstUndelivered;
    queue = [];
    ringBytes = 0;
    gap = null;
  }

  function report(where: string): void {
    deduper.report({ scope: 'premium', event: 'premium.tap_feed_fault', where });
  }

  function flush(): void {
    stopTimer();
    while (queue.length > 0) {
      const slots = gap === null ? 1 : 2;
      if (channel.inFlight + slots > TAP_MAX_UNACKED) return;
      if (gap !== null) {
        const item: RawGapItem = { feed: 'raw.tap', dropped: gap.dropped, fromSeq: gap.fromSeq };
        if (channel.emit('raw.gap', [item]) === null) {
          clearQueued();
          return;
        }
        gap = null;
      }
      const batch = queue.splice(0, TAP_BATCH_ITEMS);
      for (const { bytes } of batch) ringBytes -= bytes;
      if (
        channel.emit(
          'raw.tap',
          batch.map(({ item }) => item),
        ) === null
      ) {
        // Refused, so never delivered: put it back so the rewind covers it too.
        queue.unshift(...batch);
        clearQueued();
        return;
      }
    }
  }

  function enqueue(item: RawTapItem, bytes: number): void {
    queue.push({ item, bytes });
    ringBytes += bytes;
    while (queue.length > TAP_RING_ITEMS || ringBytes > TAP_RING_BYTES) {
      const dropped = queue.shift() as Queued;
      ringBytes -= dropped.bytes;
      if (gap === null) gap = { dropped: 1, fromSeq: dropped.item.seq };
      else gap.dropped += 1;
    }
    if (queue.length >= TAP_BATCH_ITEMS) flush();
    else if (timer === null && queue.length > 0) timer = setTimeout(flush, TAP_BATCH_MS);
  }

  /** The account key when an event may be delivered right now, else `null`. */
  function gate(): string | null {
    if (!subscribed || paused || !deps.playingAccountAllows()) return null;
    return deps.accountKey();
  }

  function deliver(
    accountKey: string,
    atMs: number,
    payload: { kind: 'frame'; wire: Record<string, unknown> } | { kind: 'body'; body: unknown },
  ): void {
    const secrets = deps.secrets();
    const scrubbed = scrubCredentials(payload.kind === 'frame' ? payload.wire : payload.body, secrets);
    const json = JSON.stringify(scrubbed);
    // Last line of defence: a secret surviving the key and string rules (a number, a key name)
    // withholds the whole item rather than delivering it.
    if (containsSecret(json, secrets)) return;
    const seq = nextSeq++;
    const item: RawTapItem =
      payload.kind === 'frame'
        ? { kind: 'frame', seq, atMs, accountKey, wire: scrubbed as Record<string, unknown> }
        : { kind: 'body', seq, atMs, accountKey, body: scrubbed };
    enqueue(item, Buffer.byteLength(json) + 64);
  }

  const stopAck = channel.onAck(() => {
    try {
      if (subscribed && !paused) flush();
    } catch {
      report('ack');
    }
  });

  return {
    frame(wire, atMs) {
      try {
        const accountKey = gate();
        if (accountKey === null) return;
        deliver(accountKey, atMs, { kind: 'frame', wire });
      } catch {
        report('frame');
      }
    },
    body(bytes, atMs) {
      try {
        const accountKey = gate();
        if (accountKey === null) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(bytes.toString('utf8'));
        } catch {
          return;
        }
        deliver(accountKey, atMs, { kind: 'body', body: parsed });
      } catch {
        report('body');
      }
    },
    currency: () => undefined,
    mark: () => undefined,
    subscribe() {
      if (subscribed) return;
      subscribed = true;
      nextSeq = 1;
      clearQueued();
    },
    unsubscribe() {
      subscribed = false;
      clearQueued();
    },
    pause() {
      paused = true;
      clearQueued();
    },
    resume() {
      paused = false;
    },
    dispose() {
      subscribed = false;
      clearQueued();
      stopAck();
    },
  };
}

/** Where the app's one premium feed plugs into the taps; empty until a worker is running. */
export interface PremiumTapFeedSlot {
  readonly sink: ObservationSink;
  set(feed: ObservationSink | null): void;
}

export function createPremiumTapFeedSlot(): PremiumTapFeedSlot {
  let current: ObservationSink = noopPremiumTapFeed;
  return {
    sink: {
      body: (bytes, atMs) => {
        current.body(bytes, atMs);
      },
      frame: (wire, atMs) => {
        current.frame(wire, atMs);
      },
      currency: (currency, atMs) => {
        current.currency(currency, atMs);
      },
      mark: (label, atMs) => {
        current.mark(label, atMs);
      },
    },
    set(feed) {
      current = feed ?? noopPremiumTapFeed;
    },
  };
}

/** The slot the app's taps feed. The host wiring fills it when a worker starts and empties it when it stops. */
export const appPremiumTapFeedSlot: PremiumTapFeedSlot = createPremiumTapFeedSlot();

/**
 * Gives the developer capture and the premium feed the same observations. Each call reaches both
 * even when one of them throws, and neither can throw back into the tap, which would latch its
 * observer off.
 */
export function fanOutObservers(primary: ObservationCapture, secondary: ObservationSink): ObservationCapture {
  function both(call: (sink: ObservationSink) => void): void {
    try {
      call(primary);
    } catch {
      // The other sink still hears it.
    }
    try {
      call(secondary);
    } catch {
      // Same.
    }
  }
  return {
    body: (bytes, atMs) => {
      both((sink) => {
        sink.body(bytes, atMs);
      });
    },
    frame: (wire, atMs) => {
      both((sink) => {
        sink.frame(wire, atMs);
      });
    },
    currency: (currency, atMs) => {
      both((sink) => {
        sink.currency(currency, atMs);
      });
    },
    mark: (label, atMs) => {
      both((sink) => {
        sink.mark(label, atMs);
      });
    },
    setCredentialRedactor: (redact) => {
      primary.setCredentialRedactor(redact);
    },
    close: () => {
      primary.close();
    },
  };
}
