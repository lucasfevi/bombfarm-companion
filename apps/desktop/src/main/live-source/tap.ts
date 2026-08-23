import type { LiveCurrency, LiveEvent, LiveGapReason } from '@bombfarm/contracts';
import { liveGap } from '@bombfarm/contracts';
import { discoverHookCandidates, parsePe, READ_HOOK_ANCHORS } from './image-scan.js';
import type { ParsedPe } from './image-scan.js';
import { lookupHook, readHookCacheFile, storeHook, writeHookCacheFile } from './hook-cache.js';
import type { LogPort as HookCacheLogPort } from './hook-cache.js';
import type { RuntimePort, TapInterceptor, TapReadEvent, TapSession } from './runtime.js';
import { TlsConnections, type TapEvent } from './tls-stream.js';

/**
 * Attach loop, live-proof validation, silence watch, and the consent gate — the orchestration
 * that sits on top of {@link RuntimePort} (the instrumentation runtime) and the plain candidate
 * discovery it is handed. Nothing here trusts an installed interceptor until real bytes have
 * decoded through it: an interceptor can install cleanly at the wrong address and simply never
 * fire, so "installed without error" is not evidence of anything.
 */

export interface TapTargetProcess {
  readonly pid: number;
  readonly name: string;
}

export interface ProcessLister {
  list(processName: string): Promise<readonly TapTargetProcess[]>;
}

export interface HookCandidateResolution {
  /** Ranked candidate addresses to hook at once — a single cached address, or up to a handful
   *  from a fresh scan. Empty when nothing could be discovered at all. */
  readonly addresses: readonly number[];
  readonly fromCache: boolean;
  /** The build id `resolve` already paid to compute — handed back so `commit`/`invalidate` never
   *  have to re-read and re-parse the image to re-derive it. */
  readonly buildId: string | null;
}

export interface HookCandidateSource {
  resolve(pid: number): HookCandidateResolution;
  /** Persists `address` as the validated hook for `buildId`, the value `resolve` returned for this
   *  same attach attempt. */
  commit(pid: number, address: number, buildId: string | null): void;
  /** Drops whatever cached address `buildId` had, so the next `resolve` rescans. */
  invalidate(pid: number, buildId: string | null): void;
}

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface LogPort {
  info(record: Record<string, unknown>): void;
}

const NOOP_LOG_PORT: LogPort = { info: () => undefined };

/** Once per attach, not once per rescan: a validation timeout only ever fires for the attempt
 *  that is currently in flight. */
export const VALIDATION_WINDOW_MS = 20_000;
/** Checked forever while a hook is trusted — against the idle floor (1 message/second), never
 *  the combat rate (~10/second). A threshold set against the combat rate would fire every time
 *  the player simply stops fighting; only silence, not a slower rate, is the signal this watch
 *  looks for. */
export const STALENESS_CHECK_INTERVAL_MS = 15_000;
export const STALENESS_THRESHOLD_MS = 45_000;

const DEFAULT_POLL_INTERVAL_MS = 5_000;

export interface TapDeps {
  readonly processName: string;
  readonly runtime: RuntimePort;
  readonly processes: ProcessLister;
  readonly candidates: HookCandidateSource;
  /** Constructed with the tap, checked at the attach site — never inferred from bootstrap order. */
  readonly consent: () => boolean;
  readonly clock: Clock;
  readonly onEvent: (event: LiveEvent) => void;
  readonly log?: LogPort;
  readonly pollIntervalMs?: number;
}

function chooseTarget(candidates: readonly TapTargetProcess[]): TapTargetProcess {
  const sorted = [...candidates].sort((a, b) => a.pid - b.pid);
  const first = sorted[0];
  if (!first) throw new Error('tap: chooseTarget called with no candidates');
  return first;
}

export class Tap {
  readonly #deps: TapDeps;
  readonly #log: LogPort;

  #started = false;
  #stopped = false;
  #pollTimer: unknown = null;

  #activePid: number | null = null;
  #session: TapSession | null = null;
  #fromCache = false;
  #activeBuildId: string | null = null;
  #teardownInFlight = false;
  #attachPromise: Promise<void> | null = null;

  #candidates = new Map<number, { readonly interceptor: TapInterceptor; readonly stream: TlsConnections }>();
  #winner: { readonly address: number; readonly stream: TlsConnections } | null = null;

  #validationTimer: unknown = null;
  #stalenessTimer: unknown = null;
  #lastFrameAt: number | null = null;
  /** Last time ANY traffic (a tick or a bare HTTP response) came through the winning stream —
   *  as opposed to {@link #lastFrameAt}, which only ticks move. The staleness watch needs both:
   *  ticks gone stale while this stays fresh means the client simply is not streaming, not that
   *  the hook died. */
  #lastTrafficAt: number | null = null;
  #sequence = 0;
  /** The pid discovery last failed for, so a poll interval does not re-pay a full image read and
   *  candidate scan every 5s while nothing about the target process has changed. Cleared the
   *  moment a different pid is attempted. */
  #lastFailedDiscoveryPid: number | null = null;

  #currency: LiveCurrency;

  constructor(deps: TapDeps) {
    this.#deps = deps;
    this.#log = deps.log ?? NOOP_LOG_PORT;
    this.#currency = liveGap('neverAttached', this.#nowIso());
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#emitCurrency(this.#currency);
    this.#schedulePoll(0);
  }

  async teardown(): Promise<void> {
    if (this.#stopped) return;
    this.#stopped = true;
    if (this.#pollTimer !== null) {
      this.#deps.clock.clearTimeout(this.#pollTimer);
      this.#pollTimer = null;
    }
    if (this.#attachPromise) await this.#attachPromise;
    await this.#teardownSession();
    this.#activePid = null;
  }

  #nowIso(): string {
    return new Date(this.#deps.clock.now()).toISOString();
  }

  /** Reads `#stopped` through a call so TS does not carry a narrowed `false` across the awaits
   *  below — `teardown()` can flip the flag from a wholly separate call while one of these is
   *  suspended mid-await, which a same-function flow analysis cannot see coming. */
  #isStopped(): boolean {
    return this.#stopped;
  }

  #emitCurrency(currency: LiveCurrency): void {
    this.#deps.onEvent({ type: 'currency', currency });
  }

  #reportGap(reason: LiveGapReason, extra?: { readonly likelyQuarantine?: boolean }): void {
    const current = this.#currency;
    if (current.kind === 'gap' && current.reason === reason && current.likelyQuarantine === extra?.likelyQuarantine) {
      return;
    }
    const next = liveGap(reason, this.#nowIso(), extra);
    this.#currency = next;
    this.#emitCurrency(next);
  }

  #reportLive(): void {
    const now = this.#nowIso();
    const next: LiveCurrency = { kind: 'live', lastFrameAt: now, sinceAt: now };
    this.#currency = next;
    this.#emitCurrency(next);
  }

  #schedulePoll(delayMs: number): void {
    this.#pollTimer = this.#deps.clock.setTimeout(() => {
      this.#pollTick().catch((error: unknown) => {
        this.#log.info({ scope: 'live-source', event: 'tap.poll_tick_failed', error: String(error) });
        if (!this.#isStopped()) this.#schedulePoll(this.#deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
      });
    }, delayMs);
  }

  async #pollTick(): Promise<void> {
    if (this.#stopped) return;

    const found = await this.#deps.processes.list(this.#deps.processName);
    if (this.#isStopped()) return;

    if (this.#session && this.#activePid !== null) {
      if (!this.#teardownInFlight && !found.some((p) => p.pid === this.#activePid)) {
        await this.#teardownSession();
        this.#activePid = null;
        this.#reportGap('clientNotStreaming');
      }
    } else if (this.#attachPromise === null) {
      if (found.length === 0) {
        this.#reportGap('clientNotStreaming');
      } else {
        const target = chooseTarget(found);
        this.#log.info({
          scope: 'live-source',
          event: 'tap.target_selected',
          pid: target.pid,
          candidateCount: found.length,
        });
        if (!this.#deps.consent()) {
          this.#reportGap('consentMissing');
        } else {
          await this.#attemptAttach(target.pid);
        }
      }
    }

    if (!this.#isStopped()) {
      this.#schedulePoll(this.#deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
    }
  }

  async #attemptAttach(pid: number): Promise<void> {
    const promise = this.#doAttemptAttach(pid);
    this.#attachPromise = promise;
    try {
      await promise;
    } finally {
      if (this.#attachPromise === promise) this.#attachPromise = null;
    }
  }

  async #doAttemptAttach(pid: number): Promise<void> {
    const resolution = await this.#deps.runtime.resolve();
    if (this.#stopped) return;

    if (resolution.kind === 'unavailable') {
      this.#reportGap('runtimeUnavailable', { likelyQuarantine: resolution.likelyQuarantine });
      return;
    }

    if (this.#lastFailedDiscoveryPid === pid) {
      this.#reportGap('attachFailed');
      return;
    }

    const candidateResolution = this.#deps.candidates.resolve(pid);
    if (candidateResolution.addresses.length === 0) {
      this.#lastFailedDiscoveryPid = pid;
      this.#reportGap('attachFailed');
      return;
    }
    this.#lastFailedDiscoveryPid = null;

    let session: TapSession;
    try {
      session = await resolution.runtime.attach(pid);
    } catch (error) {
      this.#log.info({ scope: 'live-source', event: 'tap.attach_failed', pid, error: String(error) });
      this.#reportGap('attachFailed');
      return;
    }
    if (this.#isStopped()) {
      session.detach();
      return;
    }

    this.#session = session;
    this.#activePid = pid;
    this.#fromCache = candidateResolution.fromCache;
    this.#activeBuildId = candidateResolution.buildId;

    if (!this.#installCandidates(pid, session, candidateResolution.addresses)) {
      await this.#teardownSession();
      this.#activePid = null;
      this.#reportGap('attachFailed');
    }
  }

  /** Returns whether every candidate installed cleanly. A single throwing address leaves the
   *  session with nothing installed rather than half-hooked — the caller tears the whole
   *  attempt down on `false` so no interceptor or session is left dangling. */
  #installCandidates(pid: number, session: TapSession, addresses: readonly number[]): boolean {
    this.#candidates.clear();
    this.#winner = null;

    for (const address of addresses) {
      let interceptor: TapInterceptor;
      try {
        interceptor = session.installInterceptor(address);
      } catch (error) {
        this.#log.info({ scope: 'live-source', event: 'tap.install_interceptor_failed', pid, address, error: String(error) });
        for (const candidate of this.#candidates.values()) candidate.interceptor.detach();
        this.#candidates.clear();
        return false;
      }
      const stream = new TlsConnections({ now: () => this.#deps.clock.now() });
      interceptor.onRead((event) => {
        this.#onCandidateRead(address, event);
      });
      this.#candidates.set(address, { interceptor, stream });
    }

    this.#validationTimer = this.#deps.clock.setTimeout(() => {
      this.#onValidationTimeout(pid).catch((error: unknown) => {
        this.#log.info({ scope: 'live-source', event: 'tap.validation_timeout_failed', pid, error: String(error) });
      });
    }, VALIDATION_WINDOW_MS);
    return true;
  }

  #onCandidateRead(address: number, event: TapReadEvent): void {
    if (this.#winner !== null) {
      if (address !== this.#winner.address) return;
      this.#emitTapEvents(this.#winner.stream.push(event.ctx, event.bytes));
      return;
    }

    const candidate = this.#candidates.get(address);
    if (!candidate) return;

    const events = candidate.stream.push(event.ctx, event.bytes);
    if (events.length === 0) return;

    this.#confirmWinner(address, candidate.stream);
    this.#emitTapEvents(events);
  }

  #confirmWinner(address: number, stream: TlsConnections): void {
    this.#winner = { address, stream };

    if (this.#validationTimer !== null) {
      this.#deps.clock.clearTimeout(this.#validationTimer);
      this.#validationTimer = null;
    }

    for (const [otherAddress, candidate] of this.#candidates) {
      if (otherAddress !== address) candidate.interceptor.detach();
    }
    const winnerCandidate = this.#candidates.get(address);
    this.#candidates.clear();
    if (winnerCandidate) this.#candidates.set(address, winnerCandidate);

    if (this.#activePid !== null) this.#deps.candidates.commit(this.#activePid, address, this.#activeBuildId);

    const now = this.#deps.clock.now();
    this.#lastFrameAt = now;
    this.#lastTrafficAt = now;
    this.#reportLive();
    this.#scheduleStalenessCheck();
  }

  #emitTapEvents(events: readonly TapEvent[]): void {
    for (const event of events) {
      this.#lastTrafficAt = this.#deps.clock.now();
      if (event.kind !== 'tick') continue;
      this.#sequence += 1;
      this.#lastFrameAt = this.#deps.clock.now();
      if (this.#winner !== null && this.#currency.kind === 'gap') this.#reportLive();
      this.#deps.onEvent({
        type: 'frame',
        frame: { at: this.#nowIso(), sequence: this.#sequence, tick: event.tick },
      });
    }
  }

  async #onValidationTimeout(pid: number): Promise<void> {
    if (this.#stopped || this.#winner !== null) return;
    this.#validationTimer = null;

    const fromCache = this.#fromCache;
    const buildId = this.#activeBuildId;
    await this.#teardownSession();
    if (this.#isStopped()) return;

    this.#activePid = null;
    if (fromCache) {
      this.#deps.candidates.invalidate(pid, buildId);
      await this.#attemptAttach(pid);
    } else {
      this.#reportGap('attachFailed');
    }
  }

  #scheduleStalenessCheck(): void {
    this.#stalenessTimer = this.#deps.clock.setTimeout(() => {
      this.#onStalenessTick();
    }, STALENESS_CHECK_INTERVAL_MS);
  }

  #onStalenessTick(): void {
    this.#stalenessTimer = null;
    if (this.#stopped) return;
    if (this.#winner === null || !this.#session || this.#teardownInFlight) return;

    const now = this.#deps.clock.now();
    const ticksStale = this.#lastFrameAt === null || now - this.#lastFrameAt > STALENESS_THRESHOLD_MS;
    if (!ticksStale) {
      this.#scheduleStalenessCheck();
      return;
    }

    const trafficStale = this.#lastTrafficAt === null || now - this.#lastTrafficAt > STALENESS_THRESHOLD_MS;
    if (trafficStale) {
      void this.#handleHookSilent();
      return;
    }

    /** Ticks stopped but the hook is still proven by other traffic (REST while the game sits in
     *  a menu) — the honest report is that the client is not streaming, not that the hook died,
     *  and unlike `hookSilent` this does not tear the session down: ticks can resume any time. */
    this.#reportGap('clientNotStreaming');
    this.#scheduleStalenessCheck();
  }

  async #handleHookSilent(): Promise<void> {
    await this.#teardownSession();
    this.#activePid = null;
    this.#reportGap('hookSilent');
  }

  getCurrency(): LiveCurrency {
    return this.#currency;
  }

  #teardownSession(): Promise<void> {
    this.#teardownInFlight = true;
    try {
      if (this.#validationTimer !== null) {
        this.#deps.clock.clearTimeout(this.#validationTimer);
        this.#validationTimer = null;
      }
      if (this.#stalenessTimer !== null) {
        this.#deps.clock.clearTimeout(this.#stalenessTimer);
        this.#stalenessTimer = null;
      }
      for (const candidate of this.#candidates.values()) candidate.interceptor.detach();
      this.#candidates.clear();
      this.#winner = null;
      this.#lastFrameAt = null;
      this.#lastTrafficAt = null;
      if (this.#session) {
        this.#session.detach();
        this.#session = null;
      }
    } finally {
      this.#teardownInFlight = false;
    }
    return Promise.resolve();
  }
}

export function createSystemClock(): Clock {
  return {
    now: () => Date.now(),
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  };
}

export interface ProcessImageSource {
  /** The running process's own on-disk PE image, or `null` when it cannot be read (permissions,
   *  the process already gone). Getting from a pid to that image is OS-specific and deliberately
   *  kept out of this module, the same way `hook-cache.ts` keeps the cache directory out of
   *  itself. */
  read(pid: number): Buffer | null;
}

export interface HookCandidateSourceDeps {
  readonly cacheDir: string;
  readonly image: ProcessImageSource;
  readonly log?: HookCacheLogPort;
  readonly now?: () => number;
  readonly maxCandidates?: number;
}

/**
 * The real {@link HookCandidateSource}: a cache hit yields the single previously-validated
 * address, a miss falls through to `image-scan.ts`'s anchor ranking and hooks the top few at
 * once.
 */
export function createHookCandidateSource(deps: HookCandidateSourceDeps): HookCandidateSource {
  const maxCandidates = deps.maxCandidates ?? 4;
  const now = deps.now ?? Date.now;

  function tryParseImage(pid: number, image: Buffer): ParsedPe | null {
    try {
      return parsePe(image);
    } catch (error) {
      deps.log?.warn({ scope: 'live-source', event: 'hook_candidates.unparseable_image', pid, error: String(error) });
      return null;
    }
  }

  return {
    resolve(pid) {
      const image = deps.image.read(pid);
      const parsed = image ? tryParseImage(pid, image) : null;
      const buildId = parsed?.buildId ?? null;

      const cacheFile = readHookCacheFile(deps.cacheDir, deps.log);
      const cached = lookupHook(cacheFile, buildId, READ_HOOK_ANCHORS);
      if (cached) return { addresses: [cached.rva], fromCache: true, buildId };

      if (!parsed) return { addresses: [], fromCache: false, buildId };

      const ranked = discoverHookCandidates(parsed, READ_HOOK_ANCHORS).slice(0, maxCandidates);
      return { addresses: ranked.map((candidate) => candidate.rva), fromCache: false, buildId };
    },
    commit(_pid, address, buildId) {
      if (buildId === null) return;
      const cacheFile = readHookCacheFile(deps.cacheDir, deps.log);
      const updated = storeHook(cacheFile, buildId, {
        rva: address,
        anchors: [...READ_HOOK_ANCHORS],
        validatedAt: now(),
      });
      writeHookCacheFile(deps.cacheDir, updated);
    },
    invalidate(_pid, buildId) {
      if (buildId === null) return;
      const cacheFile = readHookCacheFile(deps.cacheDir, deps.log);
      const remainingBuilds = Object.fromEntries(
        Object.entries(cacheFile.builds).filter(([id]) => id !== buildId),
      );
      writeHookCacheFile(deps.cacheDir, { version: 1, builds: remainingBuilds });
    },
  };
}
