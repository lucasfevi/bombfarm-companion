import type { LiveTick } from '@bombfarm/contracts';
import type { LogPort } from './log-port.js';

/**
 * Folds the live tick stream into measured gold- and XP-per-hour, entirely in the main process —
 * the renderer is forbidden from doing any of this arithmetic itself. Pure and dependency-injected:
 * every timestamp comes from `deps.now()`, never from a timer this class owns, so a test can drive
 * the clock deterministically and a caller controls exactly when a tick is considered to have
 * arrived.
 */

const MS_PER_HOUR = 3_600_000;

/** ~10 frames/second cadence, so a single missed tick is ~100ms. Capping a gap's contribution at
 *  2 seconds — about 20 ticks' worth of generous jitter — is what freezes the streamed clock across
 *  a real interruption (a tab-out, a reconnect): a multi-minute gap still only ever adds 2 seconds,
 *  never the whole gap, so a rate computed across it does not collapse toward zero. */
export const MAX_TICK_GAP_MS = 2_000;

const BUCKET_SPAN_MS = 1_000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
/** 600 one-second buckets to cover the 10-minute rolling window, plus the one still filling — a
 *  hard cap so a long session's ring cannot grow without bound even if eviction were ever skipped. */
const RING_CAPACITY = TEN_MINUTES_MS / BUCKET_SPAN_MS + 1;

interface Bucket {
  startedAtMs: number;
  gold: number;
  props: number;
  xp: number;
  streamedMs: number;
}

export interface EarningsFoldDeps {
  readonly now: () => number;
  readonly xpPerProp: (phase: number) => number;
  readonly log: LogPort;
}

/**
 * Absent, non-finite, and a literal `0` all mean "no boost" — the same normalization
 * `packages/domain/src/import-save.ts` applies to `xp_mult` twice, so a boost multiplier can never
 * silently zero every XP figure it touches.
 */
function normalizedXpMult(value: number | undefined): number {
  return (typeof value === 'number' && Number.isFinite(value) ? value : 1) || 1;
}

export class EarningsFold {
  readonly #deps: EarningsFoldDeps;

  #lastSequence = Number.NEGATIVE_INFINITY;
  #lastTickAt: number | null = null;

  #goldTotal = 0;
  #xpTotal = 0;
  #streamedMs = 0;

  #buckets: Bucket[] = [];

  #payoutProps = 0;
  #gridClears = 0;
  #divergenceLogged = false;
  #lastKinds: readonly number[] | undefined;
  #lastWave: number | undefined;

  constructor(deps: EarningsFoldDeps) {
    this.#deps = deps;
  }

  /**
   * `sequence` is the frame's own monotonic counter, not derived from `now()` — a tick whose
   * sequence does not advance past the last one consumed is ignored outright, which is the real
   * defence against the offline replay loop restarting the capture from its first record.
   */
  consumeTick(tick: LiveTick, sequence: number, xpMult?: number): void {
    if (sequence <= this.#lastSequence) return;
    this.#lastSequence = sequence;

    const now = this.#deps.now();
    const gapMs = this.#lastTickAt === null ? 0 : now - this.#lastTickAt;
    this.#lastTickAt = now;
    const streamedDelta = Math.max(0, Math.min(gapMs, MAX_TICK_GAP_MS));
    this.#streamedMs += streamedDelta;

    const bucket = this.#bucketFor(now);
    bucket.streamedMs += streamedDelta;

    let propsThisTick = 0;
    for (const pop of tick.loot ?? []) {
      if (pop.gold === undefined || !Number.isFinite(pop.gold)) continue;
      this.#goldTotal += pop.gold;
      bucket.gold += pop.gold;
      propsThisTick += 1;
    }
    bucket.props += propsThisTick;
    this.#payoutProps += propsThisTick;

    if (propsThisTick > 0 && tick.phase !== undefined) {
      const xp = propsThisTick * this.#deps.xpPerProp(tick.phase) * normalizedXpMult(xpMult);
      this.#xpTotal += xp;
      bucket.xp += xp;
    }

    this.#crossCheckGrid(tick);
  }

  /**
   * A second, independent count of prop destructions — via the map's own `kinds` array going from
   * occupied to cleared — that the XP figure's "every destroyed prop pays out exactly once"
   * assumption can be checked against, without ever feeding back into a displayed rate.
   *
   * The wave guard is load-bearing: a wave rollover replaces the whole grid, so diffing a fresh
   * map's layout against the old one reads unrelated cells as spawns and clears that never
   * happened, rather than the one real prop the old map's last frame never got to report cleared.
   */
  #crossCheckGrid(tick: LiveTick): void {
    if (tick.kinds && this.#lastKinds && tick.wave === this.#lastWave) {
      let clears = 0;
      for (let i = 0; i < this.#lastKinds.length; i += 1) {
        if ((this.#lastKinds[i] ?? -1) >= 0 && tick.kinds[i] === -1) clears += 1;
      }
      this.#gridClears += clears;
    }
    this.#lastKinds = tick.kinds;
    this.#lastWave = tick.wave;

    if (!this.#divergenceLogged && this.#gridClears !== this.#payoutProps) {
      this.#deps.log.warn({
        scope: 'live-source',
        event: 'earnings.grid_payout_divergence',
        gridClears: this.#gridClears,
        payoutProps: this.#payoutProps,
      });
      this.#divergenceLogged = true;
    }
  }

  /** One bucket per wall-clock second, keyed by its own start — reused across every tick that
   *  lands in the same second, appended for the first tick of a new one. Capacity is enforced here
   *  rather than only by the real-time eviction {@link #windowBuckets} does, so the ring is bounded
   *  even across a session long enough that eviction alone would not have caught up yet. */
  #bucketFor(now: number): Bucket {
    const startedAtMs = Math.floor(now / BUCKET_SPAN_MS) * BUCKET_SPAN_MS;
    const last = this.#buckets[this.#buckets.length - 1];
    if (last && last.startedAtMs === startedAtMs) return last;

    const bucket: Bucket = { startedAtMs, gold: 0, props: 0, xp: 0, streamedMs: 0 };
    this.#buckets.push(bucket);
    if (this.#buckets.length > RING_CAPACITY) this.#buckets.shift();
    return bucket;
  }

  /** Evicts by real time, not streamed time — a long real-world break ages a bucket out on its own
   *  even though no tick has arrived to observe it, which is what lets {@link coverageSeconds}
   *  shrink between ticks and keeps a resumed session from diluting `gold10`/`xp10` with minutes
   *  the player was not actually away for. */
  #windowBuckets(): readonly Bucket[] {
    const cutoff = this.#deps.now() - TEN_MINUTES_MS;
    while (this.#buckets.length > 0 && this.#buckets[0]!.startedAtMs < cutoff) this.#buckets.shift();
    return this.#buckets;
  }

  #windowRate(pick: (bucket: Bucket) => number): number | null {
    const buckets = this.#windowBuckets();
    let sum = 0;
    let streamedMs = 0;
    for (const bucket of buckets) {
      sum += pick(bucket);
      streamedMs += bucket.streamedMs;
    }
    if (streamedMs === 0) return null;
    return (sum / streamedMs) * MS_PER_HOUR;
  }

  #sessionRate(total: number): number | null {
    if (this.#streamedMs === 0) return null;
    return (total / this.#streamedMs) * MS_PER_HOUR;
  }

  get gold10(): number | null {
    return this.#windowRate((bucket) => bucket.gold);
  }

  get xp10(): number | null {
    return this.#windowRate((bucket) => bucket.xp);
  }

  get goldSession(): number | null {
    return this.#sessionRate(this.#goldTotal);
  }

  get xpSession(): number | null {
    return this.#sessionRate(this.#xpTotal);
  }

  /** The real-time span the surviving buckets actually cover, so the UI can say what the 10-minute
   *  figure really represents instead of always claiming a full 10 minutes. */
  get coverageSeconds(): number {
    const buckets = this.#windowBuckets();
    const oldest = buckets[0];
    if (!oldest) return 0;
    return (this.#deps.now() - oldest.startedAtMs) / 1000;
  }

  get sessionSeconds(): number {
    return this.#streamedMs / 1000;
  }
}
