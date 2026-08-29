import type { RotationSnapshot } from './rotation-snapshot.js';

/**
 * `loot` and `hits` are per-tick event channels: they carry only what happened on THIS tick and
 * are empty on most ticks. A consumer that samples the newest {@link LiveTick} instead of taking
 * every one silently misses most of them. That is why this seam is event-shaped ({@link
 * LiveEvent}) and a latest-value view ({@link LiveView}) is derived from the event stream, not
 * the other way round.
 */

export interface LiveTickHero {
  readonly id: string;
  /** Energy as the stream carries it: a fraction in [0, 1] of the hero's own maximum.
   *  The maximum itself is not on this wire — it comes from the rotation projection. */
  readonly energyFraction?: number;
  readonly x?: number;
  readonly y?: number;
}

export interface LiveLootPop {
  /** Index of the map cell the destroyed prop stood in. */
  readonly cell: number;
  readonly gold?: number;
}

export interface LiveHit {
  readonly cell: number;
  /** The wire's own name for this value. */
  readonly damage: number;
  readonly critical?: boolean;
}

export interface LiveTick {
  /** Every hero currently standing on the field. A hero's absence from this list IS its
   *  departure from the field — there is no separate leave event. */
  readonly heroes: readonly LiveTickHero[];
  readonly phase?: number;
  readonly wave?: number;
  readonly gold?: number;
  /** On the wire's own 0-255 scale, not a [0, 1] fraction. */
  readonly roomHp?: number;
  /** The server's own "nothing is being fought" flag. */
  readonly idle?: boolean;
  /** Props that paid out on THIS tick. Empty on most ticks. */
  readonly loot?: readonly LiveLootPop[];
  /** Damage landed on THIS tick. */
  readonly hits?: readonly LiveHit[];
  readonly bonusSeconds?: number;
  readonly bonusMultiplier?: number;
  /** Parallel array over the map's slots, index-for-index with {@link hps}; `-1` marks an empty or
   *  cleared slot. Values on occupied slots index the prop catalogue. */
  readonly kinds?: readonly number[];
  /** Parallel array over the map's slots, index-for-index with {@link kinds}; `-1` marks an empty
   *  or cleared slot. No consumer interprets the values on occupied slots. */
  readonly hps?: readonly number[];
}

/**
 * `LiveFrame` deliberately does NOT carry the raw JSON the tick arrived as. Per-tick fields that
 * no current consumer reads still travel — that is why {@link LiveTick} names all of them — but a
 * raw payload riding this seam is how a session token reaches a log file, and redaction is owned
 * elsewhere.
 */
export interface LiveFrame {
  /** ISO 8601. */
  readonly at: string;
  /** Monotonic, from the first frame of the process. Lets a consumer detect a miss. */
  readonly sequence: number;
  readonly tick: LiveTick;
}

/** The renderer's own display cadence, and — per {@link LiveEvent}'s `fastUpdate` variant — the
 *  rate the main process paces the fast channel to before it ever reaches IPC. One constant, so
 *  the two sides cannot drift onto different numbers. */
export const LIVE_DISPLAY_REFRESH_MS = 250;

export type LiveEvent =
  | { readonly type: 'frame'; readonly frame: LiveFrame }
  | { readonly type: 'currency'; readonly currency: LiveCurrency }
  /**
   * The fast channel: field/recovery countdowns and the live on-field id set, folded once in the
   * main process and paced to {@link LIVE_DISPLAY_REFRESH_MS} before crossing IPC — never one of
   * these per tap frame. Superset of `frame` for what the renderer actually needs, so `frame`
   * itself never has to reach the renderer at all.
   */
  | {
      readonly type: 'fastUpdate';
      readonly field: readonly FieldCountdown[];
      readonly recovery: readonly RecoveryCountdown[];
      readonly onFieldHeroIds: readonly string[];
      readonly earnings: LiveEarnings | null;
    };

/**
 * Whose gap this is, not just that there is one.
 *
 * - `clientNotStreaming` — the game is closed, logged out, or sitting in a menu. Nothing to fix.
 * - `neverAttached` — the app has not attached yet this session.
 * - `consentMissing` — the player has not granted the app permission to attach.
 * - `runtimeUnavailable` — the instrumentation runtime could not be loaded: no build for this
 *   platform, or it was removed from disk.
 * - `attachFailed` — attach was attempted and failed.
 * - `detached` — the app was attached and the target went away.
 * - `hookSilent` — the read path proved itself with real traffic and then went quiet, without the
 *   target process ever exiting.
 */
export type LiveGapReason =
  | 'clientNotStreaming'
  | 'neverAttached'
  | 'consentMissing'
  | 'runtimeUnavailable'
  | 'attachFailed'
  | 'detached'
  | 'hookSilent';

/**
 * A UI that offers "reconnect" for a gap caused by the game sitting idle is lying to the player,
 * and a UI that offers nothing for a read path that died is unhelpful. The seam has to carry
 * which one it is. `clientNotStreaming` is the only reason with nothing to fix; every other
 * reason names something the app or the player could act on.
 */
export function isActionableGap(reason: LiveGapReason): boolean {
  return reason !== 'clientNotStreaming';
}

/** The one `kind === 'live'` check — callers compare against this instead of the literal, so a
 *  future third `LiveCurrency` variant can't leave one call site silently treating it as live. */
export function isLiveCurrency(currency: LiveCurrency): boolean {
  return currency.kind === 'live';
}

/** Whether the app is still in touch with the game at all, for a clock that runs on the server's
 *  own timer rather than on combat frames (recovery, not the field countdown). `clientNotStreaming`
 *  is a gap in the combat stream alone — the hook is still proven live by other traffic, per its
 *  own doc comment on {@link LiveGapReason} — so it counts as connected here even though it is a
 *  gap; every other gap reason means the read path itself is down. */
export function isConnectedCurrency(currency: LiveCurrency): boolean {
  return currency.kind === 'live' || !currency.actionable;
}

export type LiveCurrency =
  | { readonly kind: 'live'; readonly lastFrameAt: string; readonly sinceAt: string }
  | {
      readonly kind: 'gap';
      readonly reason: LiveGapReason;
      readonly actionable: boolean;
      readonly sinceAt: string;
      /** Only meaningful for `runtimeUnavailable`: the runtime loaded earlier in this session
       *  and then stopped loading, which is what a quarantine looks like from here. */
      readonly likelyQuarantine?: boolean;
    };

/**
 * The one constructor for the `gap` variant — `actionable` is always derived from {@link
 * isActionableGap} here, so no caller can set the two inconsistently.
 */
export function liveGap(
  reason: LiveGapReason,
  sinceAt: string,
  extra?: { readonly likelyQuarantine?: boolean },
): LiveCurrency {
  return {
    kind: 'gap',
    reason,
    actionable: isActionableGap(reason),
    sinceAt,
    ...(extra?.likelyQuarantine !== undefined ? { likelyQuarantine: extra.likelyQuarantine } : {}),
  };
}

/** Where a number came from. A modelled number is never presented as an observed one:
 *  the two differ by up to 6.25% for a hero carrying both drain-reduction effects even
 *  with the corrected law, and by more if an effect's rank is wrong. */
export type CountdownBasis = 'observed' | 'modelled';

export interface FieldCountdown {
  readonly heroId: string;
  /** Seconds of field time left before this hero walks off to rest. */
  readonly secondsRemaining: number;
  /** Energy per second. Fitted from observed frames when `basis` is `observed`. */
  readonly drainPerSecond: number;
  readonly basis: CountdownBasis;
}

export interface RecoveryCountdown {
  readonly heroId: string;
  readonly secondsRemaining: number;
  /** False when frames have stopped. The renderer must read this rather than running its
   *  own clock: the world does not advance while the client is not streaming, so a
   *  wall-clock timer would count down through time that never happened. */
  readonly advancing: boolean;
}

/**
 * Measured gold- and XP-per-hour, folded entirely in the main process from the live tick stream —
 * the renderer receives only these finished values, never the raw ticks or any of the arithmetic
 * over them. `null` on every rate field means no streamed time has accrued to divide by yet, not a
 * zero rate.
 */
export interface LiveEarnings {
  readonly goldBalance: number | null;
  /** When {@link goldBalance} came from the most recent stored account reading rather than a live
   *  tick — `null` whenever the stream supplied it (or there is no balance at all), so the
   *  renderer shows an age next to the balance only for the fallback, never for a tick-frozen one. */
  readonly goldBalanceCapturedAt: string | null;
  /** Per hour, over the last 10 real minutes (or less — see {@link coverageSeconds}). */
  readonly gold10: number | null;
  /** Per hour, over the whole session. */
  readonly goldSession: number | null;
  /** Per hour, over the last 10 real minutes. */
  readonly xp10: number | null;
  /** Per hour, over the whole session. */
  readonly xpSession: number | null;
  /** The real-time span the 10-minute figures actually cover — less than 600 immediately after a
   *  session starts, or after a long enough stream gap has aged old samples out. */
  readonly coverageSeconds: number;
  /** Streamed seconds since the session started (or was last reset), never real elapsed time. */
  readonly sessionSeconds: number;
}

export interface LiveView {
  readonly currency: LiveCurrency;
  readonly field: readonly FieldCountdown[];
  readonly recovery: readonly RecoveryCountdown[];
  /** The slower authenticated projection this view is built on. Null before the first read. */
  readonly rotation: RotationSnapshot | null;
  /** Every hero the live tap most recently showed standing on the field — the REST-derived
   *  on-field set when no tap frame has arrived yet, so this is always the best on-field reading
   *  available, never merely "absent because nothing is live". Authoritative over `rotation`'s own
   *  per-hero activity for field membership the moment the two disagree. */
  readonly onFieldHeroIds: readonly string[];
  /** `null` before the first tap frame of the session has arrived. */
  readonly earnings: LiveEarnings | null;
  readonly updatedAt: string;
}

/** `no-source` covers the frame ring itself never having been constructed (no tap has attached
 *  yet), distinct from the ring existing but declining the write (`rate-limited`/`write-failed`). */
export type LiveDiagnosticsDumpReason = 'rate-limited' | 'write-failed' | 'no-source';

export type LiveDiagnosticsDumpOutcome =
  | { readonly written: true; readonly path: string }
  | { readonly written: false; readonly reason: LiveDiagnosticsDumpReason };
