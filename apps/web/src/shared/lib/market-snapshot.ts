import { readMarketSnapshot, type MarketSnapshot } from '@bombfarm/pricing';

/**
 * The published snapshot is served with `Access-Control-Allow-Origin: *`, which is what lets a
 * static export read it from the browser with no proxy of its own. Steam itself sends no CORS
 * header, so shipped web code can never go there directly.
 */
export const MARKET_SNAPSHOT_URL =
  'https://raw.githubusercontent.com/lucasfevi/bombfarm-companion/market-data/market-prices.json';

export const MARKET_SNAPSHOT_CACHE_KEY = 'bf-market-snapshot-v1';

export type MarketSnapshotErrorKind = 'network' | 'http' | 'malformed';

export interface CachedMarketSnapshot {
  etag: string | null;
  snapshot: MarketSnapshot;
}

export interface MarketSnapshotLoad {
  snapshot: MarketSnapshot | null;
  etag: string | null;
  error: MarketSnapshotErrorKind | null;
}

export function readCachedMarketSnapshot(): CachedMarketSnapshot | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(MARKET_SNAPSHOT_CACHE_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as { etag?: unknown; snapshot?: unknown };
    // A cache written before native quotes existed outlives the rollout, so it is upgraded on
    // read rather than left for every price lookup to defend against.
    const snapshot = readMarketSnapshot(parsed.snapshot);
    if (snapshot == null) return null;
    return {
      etag: typeof parsed.etag === 'string' ? parsed.etag : null,
      snapshot,
    };
  } catch {
    return null;
  }
}

/** Returns false on any storage throw — quota, private mode, or a prerender with no `window`. */
export function writeCachedMarketSnapshot(entry: CachedMarketSnapshot): boolean {
  try {
    localStorage.setItem(MARKET_SNAPSHOT_CACHE_KEY, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

export function clearCachedMarketSnapshot(): void {
  try {
    localStorage.removeItem(MARKET_SNAPSHOT_CACHE_KEY);
  } catch {
    /* private mode */
  }
}

function keepCached(
  cached: CachedMarketSnapshot | null,
  error: MarketSnapshotErrorKind,
): MarketSnapshotLoad {
  return { snapshot: cached?.snapshot ?? null, etag: cached?.etag ?? null, error };
}

/**
 * The conditional request below is inert in a browser today, and kept anyway.
 *
 * Measured 2026-08-29 against the live asset: the response carries an `ETag`, but the host sends
 * no `Access-Control-Expose-Headers`, so a cross-origin read sees only the four safelisted headers
 * (`cache-control`, `content-length`, `content-type`, `expires`). `response.headers.get('ETag')`
 * is therefore always null here, nothing is ever stored to send back, and the 304 branch cannot
 * be reached from the planner — every refresh downloads the whole file, which at ~45 KB is a cost
 * worth naming rather than a problem worth solving.
 *
 * It stays because it is correct the moment the header is exposed, and because the desktop shell
 * runs the same conditional from Node, where no CORS rule applies and the 304 does fire.
 */
async function fetchSnapshot(cacheMode: RequestCache): Promise<MarketSnapshotLoad> {
  const cached = readCachedMarketSnapshot();
  const headers: Record<string, string> = {};
  if (cached?.etag != null) headers['If-None-Match'] = cached.etag;

  let response: Response;
  try {
    response = await fetch(MARKET_SNAPSHOT_URL, { cache: cacheMode, headers });
  } catch {
    return keepCached(cached, 'network');
  }

  if (response.status === 304) {
    return cached == null
      ? { snapshot: null, etag: null, error: 'http' }
      : { snapshot: cached.snapshot, etag: cached.etag, error: null };
  }
  if (!response.ok) return keepCached(cached, 'http');

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return keepCached(cached, 'malformed');
  }
  const snapshot = readMarketSnapshot(body);
  if (snapshot == null) return keepCached(cached, 'malformed');

  const etag = response.headers.get('ETag');
  writeCachedMarketSnapshot({ etag, snapshot });
  return { snapshot, etag, error: null };
}

export function loadMarketSnapshot(): Promise<MarketSnapshotLoad> {
  return fetchSnapshot('default');
}

export function refreshMarketSnapshot(): Promise<MarketSnapshotLoad> {
  return fetchSnapshot('reload');
}
