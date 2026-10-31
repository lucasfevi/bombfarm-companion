import { PLUGIN_API_VERSION, type AppFlavor, type PremiumHostView, type PremiumManifest } from '@bombfarm/contracts';
import type { LogPort } from '../../storage/index.js';
import type { DeviceGetRequest, DeviceGetResult } from '../licence/licence-runner.js';
import type { PremiumRemovalPort, PremiumRemovalReason } from '../licence/removal-port.js';
import type { BundleCache } from './bundle-cache.js';
import { fetchBundle, type FetchOutcome } from './bundle-fetch.js';
import {
  shippedBundleKeys,
  verifyBundle,
  type BundleKeyTable,
  type VerifiedBundle,
  type VerifyContext,
} from './bundle-verify.js';
import {
  hostPhase,
  initialHost,
  step,
  type CachedEntry,
  type FetchSummary,
  type HostEffect,
  type HostEvent,
  type HostState,
} from './host-machine.js';
import { createPremiumRoutes, premiumUiUrl, type PremiumRoutes, type ServedBundle } from './premium-routes.js';
import type { WorkerSupervisor } from './worker-supervisor.js';

/**
 * Runs the Premium host: feeds the licence gate, the licence service's port calls and the worker's
 * exits to the pure host machine, and carries out the effects it returns. The machine decides what
 * happens; this file only does it (downloads, cache writes, the worker, the window reload, the
 * removal retries). It is also the licence service's removal port.
 */

/** The licence gate as the host sees it. The wiring hands in the app's gate. */
export interface HostGate {
  allows(): boolean;
  subscribe(listener: (allows: boolean) => void): () => void;
}

/** What reading the local development bundle answers (the dev-only reader's result, structurally). */
export type LocalBundleReading =
  | { readonly ok: true; readonly bundle: { readonly manifest: PremiumManifest; readonly files: ReadonlyMap<string, Uint8Array> } }
  | { readonly ok: false; readonly reason: string };

export interface HostScheduler {
  readonly setTimeout: typeof setTimeout;
  readonly clearTimeout: typeof clearTimeout;
}

export interface HostRunnerDeps {
  /** The flavour offers Premium; when false the runner does nothing. */
  readonly enabled: boolean;
  readonly flavor: AppFlavor;
  readonly appVersion: string;
  readonly gate: HostGate;
  readonly cache: BundleCache;
  /** The licence service's device-signed GET; it refuses while the gate is closed. */
  readonly deviceGet: (req: DeviceGetRequest) => Promise<DeviceGetResult>;
  readonly supervisor: WorkerSupervisor;
  /** The bundle keys to verify against; the shipped ones unless the wiring adds the test key. */
  readonly keys?: BundleKeyTable;
  /** The export names of the shared modules, as the build wrote them. */
  readonly shims: Readonly<Record<string, readonly string[]>>;
  /** Reads the local development bundle; null when no folder is configured. Dev builds only. */
  readonly localBundle?: () => Promise<LocalBundleReading | null>;
  /** Reloads the main window, if there is one. */
  readonly reloadWindow: () => void;
  /**
   * Whether the window is on the `app://` scheme, where the bundle's UI can be imported. False under
   * the renderer's dev server: the view then carries no address, and a local build says so.
   * Default true.
   */
  readonly uiOnAppScheme?: boolean;
  readonly now: () => number;
  /** A monotonic clock in milliseconds. */
  readonly mono: () => number;
  readonly scheduler?: HostScheduler;
  readonly log: LogPort;
  /** Waits between folder-removal attempts; 1, 4, 16 and 60 seconds unless a test says otherwise. */
  readonly removalRetryMs?: readonly number[];
}

export interface HostRunner extends PremiumRemovalPort {
  /**
   * Starts the host for this signed-in subject (null: nobody). Sweeps tombstones first, then reads
   * the cache, then lets the machine decide. Calling it again re-starts for a new subject.
   */
  start(subject: string | null): Promise<void>;
  /** The user signed out: stop the worker and unmount; the folder stays. */
  signedOut(): void;
  /** The renderer failed to import or mount the UI. */
  mountFailed(): void;
  /** What the Premium tab is told about the host. */
  view(): PremiumHostView;
  /** What the `app://` handler serves under `_premium`. */
  readonly routes: PremiumRoutes;
  /** Called after the view changes. */
  subscribe(listener: () => void): () => void;
  /** Resolves when every queued cache operation has finished; for shutdown and tests. */
  idle(): Promise<void>;
  /** Stops the worker and every timer for good; the cache is left as it is. */
  stop(): void;
}

export const REMOVAL_RETRY_MS: readonly number[] = [1_000, 4_000, 16_000, 60_000];

const WORKER_FILE = 'worker/index.cjs';
const UI_FILE = 'ui/index.js';
const STYLE_FILE = 'ui/index.css';

/** A verified bundle in memory: the only source the host runs and serves from. */
interface Held {
  readonly manifest: PremiumManifest;
  readonly files: ReadonlyMap<string, Uint8Array>;
}

export function createHostRunner(deps: HostRunnerDeps): HostRunner {
  const setTimeoutFn = deps.scheduler?.setTimeout ?? setTimeout;
  const clearTimeoutFn = deps.scheduler?.clearTimeout ?? clearTimeout;
  const keys = deps.keys ?? shippedBundleKeys();
  const retryMs = deps.removalRetryMs ?? REMOVAL_RETRY_MS;

  let state: HostState = initialHost(deps.enabled);
  let subject: string | null = null;
  let noteFolderGone: (() => void) | null = null;
  /** Bundles in memory by sequence; sequence 0 is the local development build. */
  const held = new Map<number, Held>();
  let activeSequence: number | null = null;
  /** The bundle a download just produced, for the effects of the `fetched` step. */
  let arrived: VerifiedBundle | null = null;
  let fetchAbort: AbortController | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let removalTimer: ReturnType<typeof setTimeout> | null = null;
  let removalRun = 0;
  const listeners = new Set<() => void>();
  /** Cache operations run one after another, so a removal never overtakes a write in flight. */
  let ioTail: Promise<unknown> = Promise.resolve();
  const queue: HostEvent[] = [];
  let draining = false;
  let stopped = false;

  const unsubscribeExit = deps.supervisor.onExit((requested) => {
    dispatch({ t: 'workerExit', requested, mono: deps.mono() });
  });
  const unsubscribeGate = deps.gate.subscribe((allows) => {
    dispatch({ t: 'gate', allows });
  });

  function verifyContext(): VerifyContext {
    return {
      keys,
      highest: subject === null ? null : deps.cache.highest.get(subject),
      floor: state.floor,
      nowMs: deps.now(),
      hostApi: PLUGIN_API_VERSION,
      appVersion: deps.appVersion,
      flavor: deps.flavor,
    };
  }

  function activeHeld(): Held | null {
    return activeSequence === null ? null : (held.get(activeSequence) ?? null);
  }

  function served(): ServedBundle | null {
    const bundle = activeHeld();
    return activeSequence === null || bundle === null ? null : { sequence: activeSequence, files: bundle.files };
  }

  const routes = createPremiumRoutes({ shims: deps.shims, active: served });

  function io<T>(task: () => Promise<T>): Promise<T> {
    const run = ioTail.then(task, task);
    ioTail = run.catch(() => undefined);
    return run;
  }

  function clearRestart(): void {
    if (restartTimer !== null) clearTimeoutFn(restartTimer);
    restartTimer = null;
  }

  function clearRemovalTimer(): void {
    if (removalTimer !== null) clearTimeoutFn(removalTimer);
    removalTimer = null;
  }

  function startWorkerNow(): void {
    clearRestart();
    const bundle = activeHeld();
    const bytes = bundle?.files.get(WORKER_FILE);
    if (bundle === null || bytes === undefined) {
      deps.log.warn({ scope: 'premium', event: 'premium.worker_exit', requested: false, code: 'no_bundle' });
      return;
    }
    deps.supervisor.start({
      sequence: bundle.manifest.sequence,
      version: bundle.manifest.version,
      workerBytes: bytes,
      requested: bundle.manifest.capabilities,
    });
  }

  function logFailure(event: string, outcome: string, sequence: number | null): void {
    deps.log.warn({ scope: 'premium', event, outcome, sequence });
  }

  function summary(outcome: FetchOutcome): FetchSummary {
    if (outcome.ok) {
      return { ok: true, sequence: outcome.bundle.manifest.sequence, version: outcome.bundle.manifest.version };
    }
    return { ok: false, reason: outcome.reason, sequence: outcome.sequence };
  }

  function runFetch(): void {
    const abort = new AbortController();
    fetchAbort = abort;
    void fetchBundle({
      deviceGet: deps.deviceGet,
      context: verifyContext,
      signal: abort.signal,
      log: deps.log,
    })
      .then((outcome) => {
        if (fetchAbort !== abort) return;
        fetchAbort = null;
        arrived = outcome.ok ? outcome.bundle : null;
        dispatch({ t: 'fetched', outcome: summary(outcome) });
        // Nothing the machine did kept it: a bundle it ignored is dropped, not remembered.
        arrived = null;
      })
      .catch(() => {
        if (fetchAbort !== abort) return;
        fetchAbort = null;
        dispatch({ t: 'fetched', outcome: { ok: false, reason: 'unreachable', sequence: null } });
      });
  }

  function runPersist(sequence: number): void {
    const bundle = arrived;
    if (bundle === null || bundle.manifest.sequence !== sequence || subject === null) return;
    held.set(sequence, { manifest: bundle.manifest, files: bundle.files });
    deps.cache.highest.set(subject, sequence);
    void io(() => deps.cache.write(bundle)).catch(() => {
      logFailure('premium.bundle_fetch', 'write_failed', sequence);
    });
  }

  function attemptRemoval(run: number, attempt: number): void {
    void io(() => deps.cache.remove())
      .then(
        (result) => result.done,
        () => false,
      )
      .then((done) => {
        if (run !== removalRun || stopped) return;
        deps.log.info({ scope: 'premium', event: 'premium.removal', outcome: done ? 'done' : 'retry', attempt });
        if (done) {
          dispatch({ t: 'removalStep', done: true });
          return;
        }
        const wait = retryMs[attempt];
        if (wait === undefined) return;
        removalTimer = setTimeoutFn(() => {
          removalTimer = null;
          attemptRemoval(run, attempt + 1);
        }, wait);
      });
  }

  function execute(effect: HostEffect): void {
    switch (effect.e) {
      case 'fetch':
        runFetch();
        return;
      case 'persist':
        runPersist(effect.sequence);
        return;
      case 'activate': {
        if (arrived !== null && arrived.manifest.sequence === effect.sequence) {
          held.set(effect.sequence, { manifest: arrived.manifest, files: arrived.files });
        }
        activeSequence = effect.sequence;
        return;
      }
      case 'startWorker': {
        if (effect.delayMs === undefined) {
          startWorkerNow();
          return;
        }
        clearRestart();
        restartTimer = setTimeoutFn(() => {
          restartTimer = null;
          startWorkerNow();
        }, effect.delayMs);
        return;
      }
      case 'stopWorker':
        clearRestart();
        deps.supervisor.stop();
        return;
      case 'pauseWorker':
        clearRestart();
        deps.supervisor.pause();
        return;
      case 'resumeWorker':
        if (deps.supervisor.pid() === null) startWorkerNow();
        else deps.supervisor.resume();
        return;
      case 'reloadWindow':
        deps.reloadWindow();
        return;
      case 'pruneCache':
        for (const sequence of [...held.keys()]) {
          if (sequence !== effect.keep && sequence !== 0) held.delete(sequence);
        }
        void io(() => deps.cache.prune(effect.keep)).catch(() => {
          logFailure('premium.bundle_verify', 'prune_failed', effect.keep);
        });
        return;
      case 'dropCache':
        held.clear();
        activeSequence = null;
        if (subject !== null && deps.cache.highest.owner() !== subject) deps.cache.highest.clear();
        void io(() => deps.cache.drop()).catch(() => {
          logFailure('premium.bundle_verify', 'drop_failed', null);
        });
        return;
      case 'remove':
        held.clear();
        activeSequence = null;
        fetchAbort?.abort();
        fetchAbort = null;
        clearRemovalTimer();
        removalRun += 1;
        attemptRemoval(removalRun, 0);
        return;
      case 'folderGone':
        try {
          noteFolderGone?.();
        } catch {
          // A licence service that fails to take the note changes nothing here.
        }
        return;
      case 'publish':
        for (const listener of [...listeners]) {
          try {
            listener();
          } catch {
            // One listener's fault must not stop the others.
          }
        }
        return;
    }
  }

  function dispatch(event: HostEvent): void {
    if (stopped) return;
    queue.push(event);
    if (draining) return;
    draining = true;
    try {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        const result = step(state, next);
        state = result.state;
        for (const effect of result.effects) execute(effect);
      }
    } finally {
      draining = false;
    }
  }

  /** Re-verifies one cached sequence as the boot does; a failure deletes that folder only. */
  async function checkCached(sequence: number): Promise<CachedEntry | null> {
    const raw = await deps.cache.read(sequence);
    const result = raw === null ? null : verifyBundle(raw, verifyContext());
    if (result === null || !result.ok) {
      deps.log.info({
        scope: 'premium',
        event: 'premium.bundle_verify',
        outcome: result === null ? 'unreadable' : result.reason,
        sequence,
      });
      await deps.cache.discard(sequence).catch(() => undefined);
      return null;
    }
    const { manifest, files } = result.bundle;
    held.set(sequence, { manifest, files });
    return { sequence, version: manifest.version, valid: true };
  }

  async function startAsync(who: string | null): Promise<void> {
    subject = who;
    held.clear();
    activeSequence = null;
    clearRestart();
    await deps.cache.sweepTombstones();

    let dev: { version: string } | null = null;
    const bundles: CachedEntry[] = [];
    if (who !== null) {
      const local = deps.localBundle === undefined ? null : await deps.localBundle();
      if (local?.ok === true) {
        held.set(0, { manifest: local.bundle.manifest, files: local.bundle.files });
        dev = { version: local.bundle.manifest.version };
      } else {
        if (local !== null) {
          deps.log.info({ scope: 'premium', event: 'premium.bundle_verify', outcome: local.reason, sequence: 0 });
        }
        // Newest first: the machine takes the best valid one and prunes the rest.
        for (const sequence of await deps.cache.scan()) {
          const entry = await checkCached(sequence);
          if (entry !== null) bundles.push(entry);
        }
      }
    }
    dispatch({ t: 'gate', allows: deps.gate.allows() });
    dispatch({ t: 'started', subject: who, dev, cache: { owner: deps.cache.highest.owner(), bundles } });
  }

  return {
    start: startAsync,

    signedOut() {
      subject = null;
      fetchAbort?.abort();
      fetchAbort = null;
      held.clear();
      activeSequence = null;
      dispatch({ t: 'signedOut' });
    },

    mountFailed() {
      deps.log.warn({ scope: 'premium', event: 'premium.ui_mount', outcome: 'failed' });
      dispatch({ t: 'mountFailed' });
    },

    view() {
      const phase = hostPhase(state);
      const bundle = activeHeld();
      const sequence = activeSequence;
      const localBuild = state.active?.dev === true;
      if (phase !== 'running' || bundle === null || sequence === null || deps.uiOnAppScheme === false) {
        return { phase, uiUrl: null, styleUrl: null, localBuild };
      }
      return {
        phase,
        uiUrl: premiumUiUrl(sequence, UI_FILE),
        styleUrl: bundle.files.has(STYLE_FILE) ? premiumUiUrl(sequence, STYLE_FILE) : null,
        localBuild,
      };
    },

    routes,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async idle() {
      for (let tail = ioTail; ; tail = ioTail) {
        await tail;
        if (tail === ioTail) return;
      }
    },

    stop() {
      stopped = true;
      unsubscribeGate();
      unsubscribeExit();
      clearRestart();
      clearRemovalTimer();
      fetchAbort?.abort();
      fetchAbort = null;
      deps.supervisor.stop();
    },

    requestPremiumRemoval(reason: PremiumRemovalReason) {
      dispatch({ t: 'removalRequested', reason });
    },

    runningSequence() {
      return state.phase === 'running' && state.active?.dev === false ? state.active.sequence : null;
    },

    noteLatestSequence(sequence) {
      dispatch({ t: 'latest', sequence });
    },

    noteLeaseFloor(minSequence) {
      dispatch({ t: 'floor', minSequence });
    },

    attach(next) {
      noteFolderGone = next;
    },
  };
}
