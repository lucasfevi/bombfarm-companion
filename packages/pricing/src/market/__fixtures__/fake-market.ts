import { SEARCH_PAGE_SIZE } from '../endpoints.js';
import type { SearchFetchResult } from '../discover.js';

export interface FakeItem {
  hash: string;
  priceCents: number | null;
  listings: number;
  /** Steam's own `type` for the row, which the reconciliation cross-checks against the name. */
  type: string | null;
}

export function item(hash: string, overrides: Partial<Omit<FakeItem, 'hash'>> = {}): FakeItem {
  return { hash, priceCents: 100, listings: 1, type: null, ...overrides };
}

export interface FakeMarket {
  fetchSearchPage: (url: string) => Promise<SearchFetchResult>;
  /** Every search URL requested, in order. */
  calls: string[];
}

/**
 * A stand-in for `steamcommunity.com/market/search/render` that answers the unfiltered enumeration
 * out of a fixed item list, paging exactly the way Steam does.
 *
 * It answers a narrowed query the same way it answers the flat one, on purpose: a test that
 * asserted no facet query was issued would otherwise be asserting against a fake that cannot
 * answer one, which proves nothing. The assertion that matters is on `calls`.
 */
export function fakeMarket(
  items: FakeItem[],
  options: { failures?: Map<number, { rateLimited: boolean }> } = {},
): FakeMarket {
  const calls: string[] = [];
  const failures = options.failures ?? new Map<number, { rateLimited: boolean }>();

  const fetchSearchPage = (url: string): Promise<SearchFetchResult> => {
    const failure = failures.get(calls.length);
    calls.push(url);
    if (failure != null) return Promise.resolve({ ok: false, rateLimited: failure.rateLimited });

    const start = Number(new URL(url).searchParams.get('start') ?? '0');
    return Promise.resolve({
      ok: true,
      page: {
        totalCount: items.length,
        rows: items.slice(start, start + SEARCH_PAGE_SIZE).map((match) => ({
          hashName: match.hash,
          name: match.hash,
          sellPriceCents: match.priceCents,
          listings: match.listings,
          iconUrl: `icon/${match.hash}`,
          type: match.type,
        })),
      },
    });
  };

  return { fetchSearchPage, calls };
}

/** True when a search URL narrows by a market facet, which nothing in the sweep does any more. */
export function narrowsByFacet(appId: number, url: string): boolean {
  return [...new URL(url).searchParams.keys()].some((key) =>
    key.startsWith(`category_${String(appId)}_`),
  );
}
