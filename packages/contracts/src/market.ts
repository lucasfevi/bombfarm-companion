/**
 * The desktop app's market-price seam.
 *
 * The snapshot body is left opaque (`unknown` by default) rather than named here: its structural
 * type lives in the pricing package, which depends on this one, so importing it back would close
 * a cycle. Main validates every body with `isMarketSnapshot` before it crosses the bridge, which
 * is what makes narrowing the type parameter on the far side sound.
 */

export const MARKET_QUOTE_CURRENCY = 'BRL';

export type MarketQuoteCurrency = typeof MARKET_QUOTE_CURRENCY;

export type MarketSnapshotSource = 'none' | 'cache' | 'network';

export type MarketSnapshotError = 'network' | 'rate-limited' | 'malformed';

export interface MarketSnapshotView<TSnapshot = unknown> {
  snapshot: TSnapshot | null;
  source: MarketSnapshotSource;
  /** The snapshot's own `generatedUtc`. */
  publishedUtc: string | null;
  /** When this process last accepted a snapshot body, from disk or the network. */
  adoptedUtc: string | null;
  /** When the published file was last checked, whether or not it had changed. */
  checkedUtc: string | null;
  /** Why the last check produced no new snapshot; null when it produced one. */
  lastError: MarketSnapshotError | null;
}

/** One item to re-quote: its snapshot key when the caller has one, else the Steam hash. */
export type MarketQuoteTarget =
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'hashName'; readonly hashName: string };

/**
 * `not-quoted` is Steam declining to answer, which is not the same statement as "unlisted" — the
 * per-item endpoint has been measured answering with no price for an item that had a live
 * listing. Every failure leaves the snapshot's own price standing.
 */
export type MarketQuoteFailureReason = 'not-quoted' | 'rate-limited' | 'network' | 'unknown-item';

export type MarketQuoteResult =
  | {
      readonly ok: true;
      readonly key: string | null;
      readonly hashName: string;
      readonly currency: MarketQuoteCurrency;
      readonly amount: number;
      readonly quotedUtc: string;
    }
  | {
      readonly ok: false;
      readonly key: string | null;
      readonly hashName: string | null;
      readonly reason: MarketQuoteFailureReason;
      /** The amount the snapshot still carries, which a failed refresh never replaces. */
      readonly keptAmount: number | null;
      readonly at: string;
    };

/** Validates the one IPC argument the renderer sends, before main acts on it. */
export function isMarketQuoteTarget(value: unknown): value is MarketQuoteTarget {
  if (typeof value !== 'object' || value === null) return false;
  const target = value as { kind?: unknown; key?: unknown; hashName?: unknown };
  if (target.kind === 'key') return typeof target.key === 'string' && target.key.length > 0;
  if (target.kind === 'hashName') return typeof target.hashName === 'string' && target.hashName.length > 0;
  return false;
}

export function emptyMarketSnapshotView<TSnapshot = unknown>(): MarketSnapshotView<TSnapshot> {
  return {
    snapshot: null,
    source: 'none',
    publishedUtc: null,
    adoptedUtc: null,
    checkedUtc: null,
    lastError: null,
  };
}
