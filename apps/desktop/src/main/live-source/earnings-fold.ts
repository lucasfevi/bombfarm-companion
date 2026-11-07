import type { LiveTick } from '@bombfarm/contracts';
import { countLootPayouts, GridClearCounter } from '@bombfarm/domain/live';
import type { LogPort } from './log-port.js';

/**
 * Folds the live tick stream into measured gold- and XP-per-hour, entirely in the main process —
 * both summed from what the server says it paid, gold per prop and XP per tick, with a model only
 * for a loot tick that arrives without its XP —
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

export const BUCKET_SPAN_MS = 1_000;
export const TEN_MINUTES_MS = 10 * 60 * 1000;
const MS_PER_MINUTE = 60_000;

/** How many slices the rolling window is reported as. Chosen for what a trend line can actually
 *  show — one slice per ten seconds is fine enough to see a rate turn and coarse enough that a
 *  single unlucky second cannot spike it. */
export const EARNINGS_SERIES_POINTS = 60;
const SERIES_SLICE_MS = TEN_MINUTES_MS / EARNINGS_SERIES_POINTS;
/** 600 one-second buckets to cover the 10-minute rolling window, plus the one still filling — a
 *  hard cap so a long session's ring cannot grow without bound even if eviction were ever skipped. */
const RING_CAPACITY = TEN_MINUTES_MS / BUCKET_SPAN_MS + 1;

interface Bucket {
  startedAtMs: number;
  gold: number;
  props: number;
  xp: number;
  /** The share of {@link xp} paid on a frame that also paid props — what XP per prop divides. */
  xpWithProps: number;
  streamedMs: number;
}

/** How often the measured XP per prop is logged against the model's, so a multiplier the model
 *  does not know about shows up as a ratio drifting away from 1 rather than going unnoticed. */
export const XP_MODEL_RATIO_LOG_INTERVAL_MS = 5 * MS_PER_MINUTE;

export interface EarningsFoldDeps {
  readonly now: () => number;
  /** The modelled XP one prop pays on this tick's phase, every multiplier the model knows already
   *  applied; `null` when it cannot say. Only a fallback and a cross-check — the server's own
   *  per-tick XP is what the fold counts. */
  readonly modelXpPerProp: (tick: LiveTick) => number | null;
  readonly log: LogPort;
}

/**
 * `reset` is "start counting this session again" — the rolling 10-minute window is defined by the
 * clock, not by a start point, so it is left alone. `accountChange` means the samples gathered so
 * far are about a different player; a window blending two accounts would show a figure belonging
 * to neither, so it is cleared along with the session totals.
 */
export type EarningsResetTrigger = 'reset' | 'accountChange';

export class EarningsFold {
  readonly #deps: EarningsFoldDeps;

  #lastSequence = Number.NEGATIVE_INFINITY;
  #lastTickAt: number | null = null;

  #goldTotal = 0;
  #xpTotal = 0;
  #propsTotal = 0;
  #streamedMs = 0;

  #buckets: Bucket[] = [];

  /** Its payout total covers only ticks where the grid diff also ran, so the two counts it compares
   *  always cover an identical set of ticks. */
  readonly #gridCounter = new GridClearCounter();
  #divergenceLogged = false;
  #missingXpLogged = false;
  #ratioWindow: { phase: number; startedAtMs: number; props: number; xp: number } | null = null;

  constructor(deps: EarningsFoldDeps) {
    this.#deps = deps;
  }

  /**
   * `sequence` is the process-level frame counter the caller stamps on every frame it hands over,
   * never one tap's own count and not derived from `now()` — a tick whose counter does not advance
   * past the last one consumed is ignored outright, so a repeated or older frame is never folded
   * twice.
   */
  consumeTick(tick: LiveTick, sequence: number): void {
    if (sequence <= this.#lastSequence) return;
    this.#lastSequence = sequence;

    const now = this.#deps.now();
    const gapMs = this.#lastTickAt === null ? 0 : now - this.#lastTickAt;
    this.#lastTickAt = now;
    const streamedDelta = Math.max(0, Math.min(gapMs, MAX_TICK_GAP_MS));
    this.#streamedMs += streamedDelta;

    const bucket = this.#bucketFor(now);
    bucket.streamedMs += streamedDelta;

    const { props: propsThisTick, gold } = countLootPayouts(tick);
    this.#goldTotal += gold;
    bucket.gold += gold;
    bucket.props += propsThisTick;
    this.#propsTotal += propsThisTick;

    const xp = this.#xpFor(tick, propsThisTick, now);
    this.#xpTotal += xp;
    bucket.xp += xp;
    // Rarely the server pays XP on a frame that reports no prop; it is real XP, but counting it
    // per prop would credit it to props that paid their own.
    if (propsThisTick > 0) bucket.xpWithProps += xp;

    this.#crossCheckGrid(tick, propsThisTick);
  }

  #xpFor(tick: LiveTick, props: number, now: number): number {
    if (tick.xpGained !== undefined) {
      this.#trackModelRatio(tick, props, tick.xpGained, now);
      return tick.xpGained;
    }
    if (props === 0) return 0;
    if (!this.#missingXpLogged) {
      this.#deps.log.warn({ scope: 'live-source', event: 'earnings.xp_gained_missing', phase: tick.phase ?? null, props });
      this.#missingXpLogged = true;
    }
    return props * (this.#deps.modelXpPerProp(tick) ?? 0);
  }

  #trackModelRatio(tick: LiveTick, props: number, xp: number, now: number): void {
    if (tick.phase === undefined) return;
    if (this.#ratioWindow?.phase !== tick.phase) {
      this.#ratioWindow = { phase: tick.phase, startedAtMs: now, props: 0, xp: 0 };
    }
    const window = this.#ratioWindow;
    if (props === 0) return;
    window.props += props;
    window.xp += xp;
    if (now - window.startedAtMs < XP_MODEL_RATIO_LOG_INTERVAL_MS) return;

    const measured = window.xp / window.props;
    const model = this.#deps.modelXpPerProp(tick);
    this.#deps.log.debug?.({
      scope: 'live-source',
      event: 'earnings.xp_model_ratio',
      phase: window.phase,
      props: window.props,
      measuredXpPerProp: measured,
      modelXpPerProp: model,
      ratio: model === null || model <= 0 ? null : measured / model,
    });
    this.#ratioWindow = { phase: tick.phase, startedAtMs: now, props: 0, xp: 0 };
  }

  reset(trigger: EarningsResetTrigger): void {
    this.#goldTotal = 0;
    this.#xpTotal = 0;
    this.#propsTotal = 0;
    this.#streamedMs = 0;
    this.#gridCounter.reset();
    this.#divergenceLogged = false;
    this.#ratioWindow = null;
    if (trigger === 'accountChange') this.#buckets = [];
  }

  /** Cross-checks the grid's own clear count against the payouts; the rules live in the shared
   *  counter, only the one-shot divergence log stays here. */
  #crossCheckGrid(tick: LiveTick, propsThisTick: number): void {
    this.#gridCounter.observe(tick, propsThisTick);
    const { gridClears, payoutProps } = this.#gridCounter.totals;

    if (!this.#divergenceLogged && gridClears !== payoutProps) {
      this.#deps.log.warn({ scope: 'live-source', event: 'earnings.grid_payout_divergence', gridClears, payoutProps });
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

    const bucket: Bucket = { startedAtMs, gold: 0, props: 0, xp: 0, xpWithProps: 0, streamedMs: 0 };
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
    for (let oldest = this.#buckets[0]; oldest && oldest.startedAtMs < cutoff; oldest = this.#buckets[0]) {
      this.#buckets.shift();
    }
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

  #windowSum(pick: (bucket: Bucket) => number): number {
    let sum = 0;
    for (const bucket of this.#windowBuckets()) sum += pick(bucket);
    return sum;
  }

  /**
   * The window resolved into fixed slices, oldest first. Slices are placed by each bucket's age
   * against `now()` rather than by its position in the ring, so the newest slice is always the one
   * ending at this instant and the line does not slide sideways when eviction happens to lag.
   *
   * A slice no bucket streamed into is `null` rather than `0`: dividing no gold by no time is not
   * a rate of zero, and drawing it as one turns a stream gap into a visible collapse in income.
   *
   * Slices before the oldest surviving bucket are dropped rather than reported as gaps, so the
   * series starts where the readings do and covers {@link coverageSeconds}, not always ten
   * minutes. A gap inside the covered span is a stream that stopped and is kept as one; the
   * stretch before a session was old enough to fill the window is not a gap in anything and would
   * otherwise pin every reading of a young session into the last tenth of whatever draws it.
   */
  get gold10Series(): readonly (number | null)[] {
    const now = this.#deps.now();
    const gold = new Array<number>(EARNINGS_SERIES_POINTS).fill(0);
    const streamedMs = new Array<number>(EARNINGS_SERIES_POINTS).fill(0);
    for (const bucket of this.#windowBuckets()) {
      const index = EARNINGS_SERIES_POINTS - 1 - Math.floor((now - bucket.startedAtMs) / SERIES_SLICE_MS);
      if (index < 0 || index >= EARNINGS_SERIES_POINTS) continue;
      gold[index] = (gold[index] ?? 0) + bucket.gold;
      streamedMs[index] = (streamedMs[index] ?? 0) + bucket.streamedMs;
    }
    const series = gold.map((sum, index) => {
      const streamed = streamedMs[index] ?? 0;
      return streamed === 0 ? null : (sum / streamed) * MS_PER_HOUR;
    });
    const oldestReading = series.findIndex((value) => value !== null);
    return oldestReading === -1 ? [] : series.slice(oldestReading);
  }

  /** Gold divided by the props that paid it, over the window — a per-prop figure measured from
   *  what actually dropped, with no wiki value anywhere in it. Gated on the prop count rather than
   *  on streamed time: streamed seconds in which nothing broke are not a gold-per-prop of zero. */
  get goldPerProp10(): number | null {
    const props = this.#windowSum((bucket) => bucket.props);
    if (props === 0) return null;
    return this.#windowSum((bucket) => bucket.gold) / props;
  }

  /** The server's own XP over the props it was paid for, in the window — gated on the prop count
   *  for the same reason {@link goldPerProp10} is. */
  get xpPerProp10(): number | null {
    const props = this.#windowSum((bucket) => bucket.props);
    if (props === 0) return null;
    return this.#windowSum((bucket) => bucket.xpWithProps) / props;
  }

  get propsPerMinute10(): number | null {
    const streamedMs = this.#windowSum((bucket) => bucket.streamedMs);
    if (streamedMs === 0) return null;
    return (this.#windowSum((bucket) => bucket.props) / streamedMs) * MS_PER_MINUTE;
  }

  /** Shares {@link goldSessionTotal}'s null gate so every session figure agrees on when the
   *  session has anything to report at all. */
  get propsSessionTotal(): number | null {
    return this.#streamedMs === 0 ? null : this.#propsTotal;
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

  /** The raw sum {@link goldSession} divides by streamed time — a total, not a rate. Shares
   *  {@link goldSession}'s own null gate so the two agree on when the session has anything to
   *  report at all. */
  get goldSessionTotal(): number | null {
    return this.#streamedMs === 0 ? null : this.#goldTotal;
  }

  /** The raw sum {@link xpSession} divides by streamed time — a total, not a rate. Shares
   *  {@link xpSession}'s own null gate so the two agree on when the session has anything to
   *  report at all. */
  get xpSessionTotal(): number | null {
    return this.#streamedMs === 0 ? null : this.#xpTotal;
  }

  /** The real-time span the surviving buckets actually cover, so the UI can say what the 10-minute
   *  figure really represents instead of always claiming a full 10 minutes. Measured from the
   *  oldest surviving bucket's own start plus one full bucket-width: that bucket's start is only
   *  where its one-second span *began*, so counting from there alone always reads one bucket-width
   *  short of the span the window actually covers — which is why a full window otherwise tops out
   *  just under 600 rather than reaching it. */
  get coverageSeconds(): number {
    const buckets = this.#windowBuckets();
    const oldest = buckets[0];
    if (!oldest) return 0;
    return (this.#deps.now() - oldest.startedAtMs + BUCKET_SPAN_MS) / 1000;
  }

  get sessionSeconds(): number {
    return this.#streamedMs / 1000;
  }
}
