import { priceOverviewUrl, type PriceQuote } from './endpoints.js';
import type { Anomaly } from './types.js';

export type QuoteFetchResult =
  /** `quote` is null when Steam answered nothing at all, which is not "unlisted". */
  | { ok: true; quote: PriceQuote | null }
  | { ok: false; rateLimited: boolean };

export interface QuoteDeps {
  fetchPriceOverview: (url: string) => Promise<QuoteFetchResult>;
  sleep: (ms: number) => Promise<void>;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Stop the pass after this many consecutive rate limits — the IP quota is spent. */
  maxConsecutiveRateLimits?: number;
  now?: () => number;
  log?: (message: string) => void;
}

export interface QuoteResult {
  /** hash name -> ISO currency -> what Steam quoted, in major units. Sparse; see `quoteNative`. */
  quotes: Map<string, Record<string, PriceQuote>>;
  quotedUtc: string;
  /** Currencies this pass asked for, whether or not any came back. */
  currencies: string[];
  calls: number;
  /** How many (hash, currency) pairs produced no usable price, answered or not. */
  unquoted: number;
  /**
   * The pairs Steam answered *for* and carried no price on, with what the answer did hold.
   *
   * A reading, not a gap. `{"success":true}` with no `lowest_price` is the endpoint saying it has
   * nothing to quote, which is a fact about the item worth keeping; a request that failed, was
   * rate limited, or was never reached says nothing about the item and appears nowhere here.
   *
   * Deliberately not folded into `quotes`: a priceless entry there would set `nativeQuotedUtc` on
   * the snapshot and defeat the inheritance a rate-limited pass depends on.
   */
  answeredUnpriced: { hashName: string; currency: string; quote: PriceQuote }[];
  /** False when the circuit breaker tripped; the caller keeps the previous run's quotes. */
  complete: boolean;
  anomalies: Anomaly[];
}

const DEFAULT_BASE_DELAY_MS = 1500;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_MAX_CONSECUTIVE_RATE_LIMITS = 6;

class RateLimitedOut extends Error {}

/**
 * Ask Steam for each item's price in a currency it quotes itself.
 *
 * This exists because `search/render` — the endpoint the enumeration uses — ignores its own
 * `currency` parameter. Measured 2026-08-29: asking it for BRL returned `$3.65 USD`, labelled as
 * dollars. `priceoverview` honours the parameter, so it is the only way to show the number that
 * appears on the page an item links to, and Steam prices regions independently rather than
 * converting: native BRL ran 0.6-1.2% above the day's converted figure, per item.
 *
 * The cost is one call per item per currency, against an endpoint with a tighter quota than the
 * search one. That buys exactness on a number the user can click through and check, which a
 * forex conversion cannot give at any call count.
 *
 * It supplements the enumeration and never replaces it. `priceoverview` under-reports: measured
 * the same day, `Gold Gloves (Legendary)` answered `{"success":true}` with no price in either
 * currency while the search endpoint carried it at $14.99 with a live listing. So a missing quote
 * is recorded as absent and the caller converts from USD, rather than reading it as no supply.
 */
export async function quoteNative(
  appId: number,
  hashNames: readonly string[],
  currencies: readonly string[],
  deps: QuoteDeps,
): Promise<QuoteResult> {
  const baseDelayMs = deps.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = deps.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const maxConsecutiveRateLimits =
    deps.maxConsecutiveRateLimits ?? DEFAULT_MAX_CONSECUTIVE_RATE_LIMITS;
  const now = deps.now ?? Date.now;

  const quotes = new Map<string, Record<string, PriceQuote>>();
  const answeredUnpriced: QuoteResult['answeredUnpriced'] = [];
  const anomalies: Anomaly[] = [];
  let calls = 0;
  let unquoted = 0;
  let complete = true;
  let delayMs = baseDelayMs;
  let consecutiveRateLimits = 0;

  /** `answered` separates "the endpoint said nothing to quote" from "the request got nowhere". */
  const fetchOne = async (
    hashName: string,
    currency: string,
  ): Promise<{ answered: boolean; quote: PriceQuote | null }> => {
    for (;;) {
      calls += 1;
      const result = await deps.fetchPriceOverview(priceOverviewUrl(appId, hashName, currency));

      if (result.ok) {
        consecutiveRateLimits = 0;
        delayMs = baseDelayMs;
        await deps.sleep(delayMs);
        return { answered: true, quote: result.quote };
      }

      if (!result.rateLimited) {
        await deps.sleep(delayMs);
        return { answered: false, quote: null };
      }

      consecutiveRateLimits += 1;
      if (consecutiveRateLimits >= maxConsecutiveRateLimits) throw new RateLimitedOut();
      delayMs = Math.min(delayMs * 2, maxDelayMs);
      deps.log?.(`rate limited on ${hashName} (${currency}); waiting ${String(delayMs)}ms`);
      await deps.sleep(delayMs);
    }
  };

  try {
    for (const hashName of hashNames) {
      const byCurrency: Record<string, PriceQuote> = {};
      for (const currency of currencies) {
        const { answered, quote } = await fetchOne(hashName, currency);
        // Absent rather than null: a null would be indistinguishable from "quoted as unlisted",
        // and `resolveKey` treats an absent key as "convert from USD" instead of showing nothing.
        if (quote?.lowest != null) {
          byCurrency[currency] = quote;
          continue;
        }
        unquoted += 1;
        if (answered && quote != null) answeredUnpriced.push({ hashName, currency, quote });
      }
      if (Object.keys(byCurrency).length > 0) quotes.set(hashName, byCurrency);
    }
  } catch (error) {
    if (!(error instanceof RateLimitedOut)) throw error;
    complete = false;
    anomalies.push({
      kind: 'rate-limited',
      detail: `native quote pass stopped after ${String(calls)} calls; ${String(quotes.size)} of ${String(hashNames.length)} items quoted`,
    });
    deps.log?.('native quote pass rate limited out; keeping the previous run\'s quotes');
  }

  return {
    quotes,
    quotedUtc: new Date(now()).toISOString(),
    currencies: [...currencies],
    calls,
    unquoted,
    answeredUnpriced,
    complete,
    anomalies,
  };
}
