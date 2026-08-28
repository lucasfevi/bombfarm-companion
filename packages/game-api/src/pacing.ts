import type { RequestOutcome } from './request.js';

/**
 * Read pacing — single-flight with a min gap and cycle interval, cooldown getting bounded
 * backoff instead of a storm, and 401/403 halting into a distinct terminal state. Every value
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

/** Thrown by `nextCycleDelayMs` while halted — the cycle must not schedule itself again until
 *  `resetAuth()` is called. */
export class PacingHaltedError extends Error {
  constructor() {
    super('PacingHaltedError: the cycle is halted on an unresolved unauthorized response');
    this.name = 'PacingHaltedError';
  }
}

export interface PacingGate {
  /** Serialises every call through one queue, enforcing `minRequestGapMs` between starts.
   *  A repeat of the same `key` while a prior call for that key is still in flight is coalesced
   *  into it — one underlying call, every caller resolves to the same result. */
  run<T>(key: string, fn: () => Promise<T>): Promise<T>;
  /** Feeds a request's outcome back into the ladder: `cooldown` trips backoff, `ok` resets it,
   *  `unauthorized` halts the gate. Every other kind leaves pacing state untouched. */
  observe(outcome: Pick<RequestOutcome, 'kind'>): void;
  readonly state: PacingState;
  /** Throws `PacingHaltedError` while halted. Otherwise the configured cycle interval, or the
   *  remaining backoff window if that is longer. */
  nextCycleDelayMs(focused: boolean): number;
  /** The only two legitimate callers: a changed token file, or an explicit user
   *  retry. Never a timer. */
  resetAuth(): void;
}

export function createPacingGate(clock: PacingClock, cfg: typeof READ_PACING = READ_PACING): PacingGate {
  let chain: Promise<void> = Promise.resolve();
  let lastStart: number | null = null;
  let consecutiveCooldowns = 0;
  let backoffUntil: number | null = null;
  let halted = false;
  const inFlightByKey = new Map<string, Promise<unknown>>();

  function computeState(): PacingState {
    if (halted) return 'halted';
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
        halted = true;
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
      }
    },

    get state(): PacingState {
      return computeState();
    },

    nextCycleDelayMs(focused: boolean): number {
      if (halted) {
        throw new PacingHaltedError();
      }
      const base = focused ? cfg.cycleForegroundMs : cfg.cycleBackgroundMs;
      if (backoffUntil !== null) {
        const remaining = backoffUntil - clock.now();
        if (remaining > base) return remaining;
      }
      return base;
    },

    resetAuth(): void {
      halted = false;
    },
  };
}
