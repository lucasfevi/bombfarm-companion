import { SEARCH_PAGE_SIZE, searchRenderUrl } from './endpoints.js';
import type { Anomaly, SearchPage, SearchRow } from './types.js';

export type SearchFetchResult =
  | { ok: true; page: SearchPage }
  | { ok: false; rateLimited: boolean };

export interface DiscoverDeps {
  fetchSearchPage: (url: string) => Promise<SearchFetchResult>;
  sleep: (ms: number) => Promise<void>;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Stop the walk after this many consecutive rate limits — the IP quota is spent. */
  maxConsecutiveRateLimits?: number;
  log?: (message: string) => void;
}

export interface DiscoveryResult {
  rows: SearchRow[];
  /** True when the flat enumeration finished, making the row set authoritative. */
  enumerationComplete: boolean;
  anomalies: Anomaly[];
  searchCalls: number;
  /** False when the circuit breaker tripped. */
  complete: boolean;
}

const DEFAULT_BASE_DELAY_MS = 1500;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_MAX_CONSECUTIVE_RATE_LIMITS = 6;

class RateLimitedOut extends Error {}

/**
 * Enumerate the whole market: a flat paged walk of `search/render` with no filters, and nothing
 * else.
 *
 * That is the only way to be sure nothing is missed — the market carries things the catalog cannot
 * ask for, skins and hero cages and item chests among them — and it is the cheap pass, ten rows a
 * call for the entire app.
 *
 * It is also the whole pass now. A row's identity comes from matching its hash against the names
 * the committed catalog says this app can carry, which costs nothing upstream, so there is no
 * second pass to pay for. The burst of facet-narrowed queries that used to do that job asked around
 * 150 calls against a per-IP ceiling near 105, and had been failing outright.
 */
export async function discoverMarket(appId: number, deps: DiscoverDeps): Promise<DiscoveryResult> {
  const baseDelayMs = deps.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = deps.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const maxConsecutiveRateLimits =
    deps.maxConsecutiveRateLimits ?? DEFAULT_MAX_CONSECUTIVE_RATE_LIMITS;

  const anomalies: Anomaly[] = [];
  const byHash = new Map<string, SearchRow>();
  let searchCalls = 0;
  let delayMs = baseDelayMs;
  // Consecutive across the whole walk: the quota Steam enforces is on the IP.
  let consecutiveRateLimits = 0;
  let complete = true;
  let enumerationComplete = false;

  const walk = async (): Promise<boolean> => {
    let start = 0;
    let totalCount = Number.POSITIVE_INFINITY;

    while (start < totalCount) {
      const result = await deps.fetchSearchPage(searchRenderUrl(appId, start));
      searchCalls += 1;

      if (!result.ok) {
        if (!result.rateLimited) {
          deps.log?.(`search failed at start=${String(start)}; the walk stops here`);
          return false;
        }
        consecutiveRateLimits += 1;
        if (consecutiveRateLimits >= maxConsecutiveRateLimits) {
          anomalies.push({
            kind: 'rate-limited',
            detail: `quota spent after ${String(searchCalls)} search calls at start=${String(start)}`,
          });
          throw new RateLimitedOut();
        }
        delayMs = Math.min(delayMs * 2, maxDelayMs);
        deps.log?.(
          `rate-limited at start=${String(start)}; backing off ${String(Math.round(delayMs / 1000))}s ` +
            `(${String(consecutiveRateLimits)}/${String(maxConsecutiveRateLimits)})`,
        );
        await deps.sleep(delayMs);
        continue;
      }

      consecutiveRateLimits = 0;
      delayMs = baseDelayMs;
      totalCount = result.page.totalCount;
      for (const row of result.page.rows) {
        if (!byHash.has(row.hashName)) byHash.set(row.hashName, row);
      }

      if (result.page.rows.length === 0) break;
      start += SEARCH_PAGE_SIZE;
      await deps.sleep(delayMs);
    }
    return true;
  };

  try {
    enumerationComplete = await walk();
    deps.log?.(
      `enumerated ${String(byHash.size)} rows in ${String(searchCalls)} calls` +
        (enumerationComplete ? '' : ' (INCOMPLETE)'),
    );
  } catch (err) {
    if (!(err instanceof RateLimitedOut)) throw err;
    complete = false;
    deps.log?.('circuit breaker tripped; returning partial discovery');
  }

  return {
    rows: [...byHash.values()],
    enumerationComplete,
    anomalies,
    searchCalls,
    complete,
  };
}
