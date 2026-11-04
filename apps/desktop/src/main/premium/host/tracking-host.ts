import type { TrackingHistoryView } from '@bombfarm/contracts';
import { createPremiumTapFeed, appPremiumTapFeedSlot, type PremiumTapFeed, type PremiumTapFeedSlot } from '../../live-source/premium-tap-feed.js';
import type { LogPort } from '../../storage/index.js';
import type { KeepingSealedRows } from '../licence/licence-store.js';
import type { BattleLogSource } from '../tracking/battle-log-tailer.js';
import { createTrackingEngine, type EngineProbe, type TrackingEngine } from '../tracking/engine.js';
import { createTrackingStore, type ClearOutcome, type TrackingStore } from '../tracking/tracking-store.js';
import {
  CapabilityError,
  withOrigin,
  type CapabilityChannel,
  type CapabilityHandler,
  type OriginHandler,
} from './capability-channel.js';
import { createDbCapability } from './capabilities/db.js';
import { createPremiumWorkerCapability } from './capabilities/premium-worker.js';
import { createRawBattleLogCapability, type RawBattleLogCapability } from './capabilities/raw-battle-log.js';
import { createRawTapCapability } from './capabilities/raw-tap.js';
import type { HostTracking } from './host-runner.js';

/**
 * The tracking side of the host: the engine, the store, the two feeds and the four handlers that
 * front them. It knows no game file and no credential; every game fact comes in as a plain function
 * the app composed. The feeds belong to the worker running now: each new channel gets its own, and
 * the handlers in the allowlist reach whichever is current.
 */

/** The one probe runs about this long after the app starts, so it is off the start-up path. */
export const TRACKING_PROBE_DELAY_MS = 5_000;
/** How long a read of the secrets set stays good; the tap asks on every event. */
export const SECRETS_TTL_MS = 2_000;

export interface TrackingHostDeps {
  /** The flavour's user-data folder. */
  readonly root: string;
  readonly rows: KeepingSealedRows;
  /** Where the signed extension is shipped. */
  readonly extensionPath: string;
  /** The signed-in user's id. */
  readonly subject: () => string | null;
  /** Whether the licensed game account is the one playing now. */
  readonly playingAccountAllows: () => boolean;
  /** The licensed game account's id (the battle-log suffix form), or null. */
  readonly accountKey: () => string | null;
  /** Values that must never reach a worker; read on every tap event, so cache them. */
  readonly secrets: () => ReadonlySet<string>;
  readonly battleLog: {
    readonly source: BattleLogSource;
    /** Early wake from the game folder; the poll alone is enough when absent. */
    readonly watch?: (wake: () => void) => () => void;
  };
  readonly log: LogPort;
  /** Epoch milliseconds. */
  readonly now: () => number;
  /** A steady clock in milliseconds. */
  readonly mono: () => number;
  /** Test seams. */
  readonly engine?: TrackingEngine;
  readonly feedSlot?: PremiumTapFeedSlot;
  readonly probeDelayMs?: number;
  /** False: nothing arms the probe, so it runs on the first `db` call. Defaults to true. */
  readonly timedProbe?: boolean;
}

export interface TrackingHost extends HostTracking {
  readonly handlers: {
    readonly db: CapabilityHandler;
    readonly rawTap: CapabilityHandler;
    readonly rawBattleLog: CapabilityHandler;
    readonly premiumWorker: CapabilityHandler;
  };
  /** The supervisor's `onChannel`: a worker's channel, or `null` when it is retired. */
  attachChannel(channel: CapabilityChannel | null): void;
  pauseFeeds(): void;
  resumeFeeds(): void;
  history(subject: string): TrackingHistoryView;
  clear(subject: string): Promise<ClearOutcome>;
  armProbe(): void;
  /** Stops the probe timer and detaches the feeds; the runner's own stop already ends the feeds and closes the handle. */
  dispose(): void;
}

/** A getter that reads once per `ttlMs`, so a per-event caller costs one read per window. */
export function cachedSecrets(
  read: () => Iterable<string>,
  now: () => number,
  ttlMs: number = SECRETS_TTL_MS,
): () => ReadonlySet<string> {
  let held: ReadonlySet<string> = new Set();
  let readAt = Number.NEGATIVE_INFINITY;
  return () => {
    const at = now();
    if (at - readAt >= ttlMs || at < readAt) {
      held = new Set([...read()].filter((secret) => secret.length > 0));
      readAt = at;
    }
    return held;
  };
}

/** The engine with its one probe held back until `release`, so building a store never starts it. */
function deferProbe(engine: TrackingEngine): { engine: TrackingEngine; release(): void } {
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const probed: Promise<EngineProbe> = released.then(() => engine.probe());
  return { engine: { probe: () => probed, open: (file, keyHex) => engine.open(file, keyHex) }, release };
}

interface Live {
  readonly channel: CapabilityChannel;
  readonly feed: PremiumTapFeed;
  readonly tap: CapabilityHandler;
  readonly battleLog: RawBattleLogCapability;
}

export function createTrackingHost(deps: TrackingHostDeps): TrackingHost {
  const slot = deps.feedSlot ?? appPremiumTapFeedSlot;
  const probe = deferProbe(deps.engine ?? createTrackingEngine({ extensionPath: deps.extensionPath, log: deps.log }));
  let probeTimer: ReturnType<typeof setTimeout> | null = null;

  const makeStore = (): TrackingStore =>
    createTrackingStore({ root: deps.root, rows: deps.rows, engine: probe.engine });
  let current = makeStore();
  /** The close in progress: a call that arrives meanwhile waits for it, then meets the fresh store. */
  let closing: Promise<void> = Promise.resolve();
  let live: Live | null = null;

  function startProbe(): void {
    if (probeTimer !== null) clearTimeout(probeTimer);
    probeTimer = null;
    probe.release();
  }

  // A closed store stays closed, so a close hands the next call a fresh one on the same engine.
  const store: TrackingStore = {
    status: (subject) => current.status(subject),
    db: async (subject) => {
      startProbe();
      await closing;
      return current.db(subject);
    },
    clear: async (subject) => {
      await closing;
      return current.clear(subject);
    },
    close() {
      const old = current;
      current = makeStore();
      const done = closing.then(() => old.close());
      closing = done.catch(() => undefined);
      return done;
    },
  };

  const licensedAccountId = (): string | null => (deps.playingAccountAllows() ? deps.accountKey() : null);

  function detach(): void {
    const previous = live;
    live = null;
    slot.set(null);
    previous?.feed.dispose();
    previous?.battleLog.stop();
  }

  function attachChannel(channel: CapabilityChannel | null): void {
    detach();
    if (channel === null) return;
    const feed = createPremiumTapFeed({
      channel,
      playingAccountAllows: deps.playingAccountAllows,
      accountKey: deps.accountKey,
      secrets: deps.secrets,
      log: deps.log,
      now: deps.now,
    });
    const battleLog = createRawBattleLogCapability({
      channel,
      tailer: {
        source: deps.battleLog.source,
        licensedAccountId,
        now: deps.now,
        ...(deps.battleLog.watch === undefined ? {} : { watch: deps.battleLog.watch }),
      },
    });
    live = { channel, feed, tap: createRawTapCapability({ feed }), battleLog };
    slot.set(feed);
  }

  /** A handler that reaches the current worker's capability; with no worker there is nobody to serve. */
  function forWorker(pick: (running: Live) => CapabilityHandler): CapabilityHandler {
    return withOrigin((args, ctx) => {
      if (live === null) throw new CapabilityError('unavailable');
      return (pick(live) as OriginHandler)(args, ctx);
    });
  }

  const premiumWorker = createPremiumWorkerCapability({
    channel: {
      askWorker: (askedSlot, msg) =>
        live === null ? Promise.reject(new CapabilityError('stopped')) : live.channel.askWorker(askedSlot, msg),
    },
    now: deps.mono,
    log: deps.log,
  });

  /** A running worker of the same subject that holds `db` hears that its history is gone. */
  function announceCleared(subject: string): void {
    const running = live;
    if (running === null || deps.subject() !== subject || !running.channel.granted.includes('db')) return;
    running.channel.emit('db.cleared', [{ atMs: deps.now() }]);
  }

  return {
    handlers: {
      db: createDbCapability({ subject: deps.subject, store, mono: deps.mono, log: deps.log }),
      rawTap: forWorker((running) => running.tap),
      rawBattleLog: forWorker((running) => running.battleLog.handler),
      premiumWorker,
    },
    attachChannel,
    stopFeeds() {
      live?.feed.unsubscribe();
      live?.battleLog.stop();
    },
    pauseFeeds() {
      live?.feed.pause();
      live?.battleLog.pause();
    },
    resumeFeeds() {
      live?.feed.resume();
      live?.battleLog.resume();
    },
    close: () => store.close(),
    history: (subject) => store.status(subject),
    async clear(subject) {
      const outcome = await store.clear(subject);
      if (outcome === 'cleared') announceCleared(subject);
      return outcome;
    },
    armProbe() {
      if (deps.timedProbe === false || probeTimer !== null) return;
      probeTimer = setTimeout(startProbe, deps.probeDelayMs ?? TRACKING_PROBE_DELAY_MS);
      probeTimer.unref();
    },
    dispose() {
      if (probeTimer !== null) clearTimeout(probeTimer);
      probeTimer = null;
      detach();
    },
  };
}
