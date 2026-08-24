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
  readonly amount: number;
  readonly critical?: boolean;
}

export interface LiveTick {
  /** Every hero currently standing on the field. A hero's absence from this list IS its
   *  departure from the field — there is no separate leave event. */
  readonly heroes: readonly LiveTickHero[];
  readonly phase?: number;
  readonly wave?: number;
  readonly gold?: number;
  readonly roomHp?: number;
  /** The server's own "nothing is being fought" flag. */
  readonly idle?: boolean;
  /** Props that paid out on THIS tick. Empty on most ticks. */
  readonly loot?: readonly LiveLootPop[];
  /** Damage landed on THIS tick. */
  readonly hits?: readonly LiveHit[];
  readonly bonusSeconds?: number;
  readonly bonusMultiplier?: number;
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

export type LiveEvent =
  | { readonly type: 'frame'; readonly frame: LiveFrame }
  | { readonly type: 'currency'; readonly currency: LiveCurrency };

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

export interface LiveView {
  readonly currency: LiveCurrency;
  readonly field: readonly FieldCountdown[];
  readonly recovery: readonly RecoveryCountdown[];
  /** The slower authenticated projection this view is built on. Null before the first read. */
  readonly rotation: RotationSnapshot | null;
  readonly updatedAt: string;
}
