import { SEARCH_PAGE_SIZE } from '../endpoints.js';
import type { SearchFetchResult } from '../discover.js';
import type { FacetName } from '../types.js';

export type FakeItem = { hash: string; priceCents: number | null; listings: number } & Partial<
  Record<FacetName, string>
>;

export function item(hash: string, tags: Partial<Record<FacetName, string>> = {}): FakeItem {
  return { hash, priceCents: 100, listings: 1, ...tags };
}

export interface FakeMarket {
  fetchAppFilters: () => Promise<unknown>;
  fetchSearchPage: (url: string) => Promise<SearchFetchResult>;
  /** Every search URL requested, in order. */
  calls: string[];
  /** Facet signatures requested — `''` for the unfiltered enumeration. */
  queries: string[];
}

/**
 * A stand-in for `steamcommunity.com/market` that answers both the unfiltered enumeration and
 * facet-narrowed queries out of a fixed item list, paging exactly the way Steam does. Tests
 * assert against the queries the sweep chooses to make, which is the part that has to be right.
 */
export function fakeMarket(
  appId: number,
  items: FakeItem[],
  facets: Partial<Record<FacetName, string[]>>,
  options: { failures?: Map<number, { rateLimited: boolean }> } = {},
): FakeMarket {
  const calls: string[] = [];
  const queries: string[] = [];
  const failures = options.failures ?? new Map<number, { rateLimited: boolean }>();

  const appFilters = {
    success: true,
    facets: Object.fromEntries(
      Object.entries(facets).map(([name, tags]) => [
        `${String(appId)}_${name}`,
        {
          appid: appId,
          name,
          tags: Object.fromEntries(tags.map((tag) => [tag, { matches: '1' }])),
        },
      ]),
    ),
  };

  const fetchSearchPage = (url: string): Promise<SearchFetchResult> => {
    const failure = failures.get(calls.length);
    calls.push(url);
    if (failure != null) return Promise.resolve({ ok: false, rateLimited: failure.rateLimited });

    const parsed = new URL(url);
    const narrow: Partial<Record<string, string>> = {};
    for (const [key, value] of parsed.searchParams) {
      const facet = key.match(new RegExp(`^category_${String(appId)}_(.+)\\[\\]$`))?.[1];
      if (facet != null) narrow[facet] = value.replace(/^tag_/, '');
    }
    queries.push(
      Object.entries(narrow)
        .map(([facet, tag]) => `${facet}=${String(tag)}`)
        .join('&'),
    );

    const matching = items.filter((candidate) =>
      Object.entries(narrow).every(([facet, tag]) => candidate[facet as FacetName] === tag),
    );
    const start = Number(parsed.searchParams.get('start') ?? '0');
    return Promise.resolve({
      ok: true,
      page: {
        totalCount: matching.length,
        rows: matching.slice(start, start + SEARCH_PAGE_SIZE).map((match) => ({
          hashName: match.hash,
          name: match.hash,
          sellPriceCents: match.priceCents,
          listings: match.listings,
          iconUrl: `icon/${match.hash}`,
          type: null,
        })),
      },
    });
  };

  return { fetchAppFilters: () => Promise.resolve(appFilters), fetchSearchPage, calls, queries };
}
