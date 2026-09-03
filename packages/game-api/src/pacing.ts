import type { RequestOutcome } from './request.js';

/**
 * Read pacing — single-flight with a min gap and cycle interval, and two bounded backoff ladders
 * instead of a storm: one for cooldown, one for 401/403. Every value
 * here is **unmeasured** — the
 * server's actual read-rate tolerance has never been measured (spec.md, Assumptions & Open
 * Questions). Each constant below carries its own provenance comment for exactly that reason: a
 * bare number here is how an invented figure becomes folklore (`pacing.test.ts` reads this
 * source and fails if any value loses its comment).
 *
 * Reused from the internal automation prototype's rate-limit module: the cooldown-detection shape (see
 * `request.ts`'s `COOLDOWN_BODY_PATTERN`) and the 429/503 checks. The *write*-pacing half
 * (`beforeWrite`, `dryRun`, `min_write_interval_ms`) is not ported — it guards a surface this
 * package does not have (`D24`: no writes).
 */
export const READ_PACING = {
  /** Unmeasured. 1.1s is the only inter-GET spacing ever exercised against these routes (the
   *  2026-08-12 anchor calibration paced its five reads 1.1s apart and saw no throttle) —
   *  evidence of safety at that spacing, NOT a measured limit. */
  minRequestGapMs: 1_100,

  /** Unmeasured. One 5-route cycle per minute while the app is foregrounded — below what a
   *  player generates just by navigating game screens, which issue these same GETs on every
   *  screen open. */
  cycleForegroundMs: 60_000,

  /** Unmeasured. Five times slower than foreground while backgrounded — nothing the player
   *  isn't looking at needs fresher data than this. */
  cycleBackgroundMs: 300_000,

  /** Unmeasured. Floor for a player-triggered manual refresh, per route — stops a double-click
   *  from doubling the request rate. */
  manualRefreshFloorMs: 10_000,

  /** Unmeasured. First cooldown backoff step. */
  backoffStartMs: 60_000,

  /** Unmeasured. Doubling factor applied per consecutive cooldown trip. */
  backoffFactor: 2,

  /** Unmeasured. Backoff ceiling — never wait longer than 15 minutes between retries. */
  backoffCapMs: 900_000,

  /** Unmeasured. First wait after a 401/403 before the same credentials are tried again — one
   *  ordinary cycle, so a transient rejection costs a single skipped read rather than every read
   *  until the app is relaunched. */
  authRetryStartMs: 60_000,

  /** Unmeasured. Ceiling for the 401/403 ladder. A session the server keeps rejecting is retried
   *  four times an hour, which is the whole difference between a stall that ends by itself and
   *  one that ends only when the player notices and restarts. */
  authRetryCapMs: 900_000,

  /** Reused verbatim from the internal automation prototype's request timeout. */
  requestTimeoutMs: 15_000,
} as const;

export interface PacingClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export type PacingState = 'ready' | { readonly backoffUntil: number } | 'halted';

/** Thrown by `run()` when the gate refuses a request without ever invoking `fn` — the caller is
 *  either in a cooldown backoff window or halted on an unresolved 401/403. */
export class PacingRefusedError extends Error {
  constructor(public readonly gateState: PacingState) {
    super(`PacingRefusedError: request refused, gate state is ${JSON.stringify(gateState)}`);
    this.name = 'PacingRefusedError';
  }
}

export interface PacingGate {
  /** Serialises every call through one queue, enforcing `minRequestGapMs` between starts.
   *  A repeat of the same `key` while a prior call for that key is still in flight is coalesced
   *  into it — one underlying call, every caller resolves to the same result. */
  run<T>(key: string, fn: () => Promise<T>): Promise<T>;
  /** Feeds a request's outcome back into the two ladders: `cooldown` trips the backoff window,
   *  `unauthorized` trips the auth-retry window, `ok` clears both. Every other kind leaves
   *  pacing state untouched. */
  observe(outcome: Pick<RequestOutcome, 'kind'>): void;
  readonly state: PacingState;
  /** Never throws, and never answers "not ever": the configured cycle interval, or whichever
   *  open window — cooldown or auth-retry — outlasts it. A gate that refused to schedule at all
   *  is what turned one rejected request into a stall only relaunching the app could end. */
  nextCycleDelayMs(focused: boolean): number;
  /** Clears the auth-retry window immediately, ahead of its own expiry. The two legitimate
   *  callers are a changed token file and an explicit user retry — never a timer, which is what
   *  the ladder itself is for. */
  resetAuth(): void;
}

export function createPacingGate(clock: PacingClock, cfg: typeof READ_PACING = READ_PACING): PacingGate {
  let chain: Promise<void> = Promise.resolve();
  let lastStart: number | null = null;
  let consecutiveCooldowns = 0;
  let backoffUntil: number | null = null;
  let consecutiveUnauthorized = 0;
  let authRetryAt: number | null = null;
  const inFlightByKey = new Map<string, Promise<unknown>>();

  /** Whichever of the two windows is still open reads as remaining milliseconds; a closed one
   *  reads as zero. Expiry is read from the clock rather than cleared by a timer, so a window
   *  that nobody looked at while it lapsed has still lapsed. */
  function remaining(until: number | null): number {
    if (until === null) return 0;
    return Math.max(0, until - clock.now());
  }

  function computeState(): PacingState {
    if (remaining(authRetryAt) > 0) return 'halted';
    if (backoffUntil !== null && clock.now() < backoffUntil) return { backoffUntil };
    return 'ready';
  }

  function schedule<T>(fn: () => Promise<T>): Promise<T> {
    const previous = chain;
    const runPromise: Promise<T> = previous.then(async () => {
      if (lastStart !== null) {
        const wait = cfg.minRequestGapMs - (clock.now() - lastStart);
        if (wait > 0) await clock.sleep(wait);
      }
      lastStart = clock.now();
      return fn();
    });
    chain = runPromise.then(
      () => undefined,
      () => undefined,
    );
    return runPromise;
  }

  return {
    async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const existing = inFlightByKey.get(key);
      if (existing) return existing as Promise<T>;

      const currentState = computeState();
      if (currentState !== 'ready') {
        throw new PacingRefusedError(currentState);
      }

      const promise = schedule(fn);
      inFlightByKey.set(key, promise);
      promise.finally(() => inFlightByKey.delete(key)).catch(() => undefined);
      return promise;
    },

    observe(outcome: Pick<RequestOutcome, 'kind'>): void {
      if (outcome.kind === 'unauthorized') {
        consecutiveUnauthorized += 1;
        const step = cfg.authRetryStartMs * cfg.backoffFactor ** (consecutiveUnauthorized - 1);
        authRetryAt = clock.now() + Math.min(step, cfg.authRetryCapMs);
        return;
      }
      if (outcome.kind === 'cooldown') {
        consecutiveCooldowns += 1;
        const step = cfg.backoffStartMs * cfg.backoffFactor ** (consecutiveCooldowns - 1);
        backoffUntil = clock.now() + Math.min(step, cfg.backoffCapMs);
        return;
      }
      if (outcome.kind === 'ok') {
        consecutiveCooldowns = 0;
        backoffUntil = null;
        // A read the server answered is proof the credentials are live, so the auth ladder starts
        // over rather than carrying a streak from a rejection the session has since recovered from.
        consecutiveUnauthorized = 0;
        authRetryAt = null;
      }
    },

    get state(): PacingState {
      return computeState();
    },

    nextCycleDelayMs(focused: boolean): number {
      const base = focused ? cfg.cycleForegroundMs : cfg.cycleBackgroundMs;
      return Math.max(base, remaining(backoffUntil), remaining(authRetryAt));
    },

    resetAuth(): void {
      consecutiveUnauthorized = 0;
      authRetryAt = null;
    },
  };
}
