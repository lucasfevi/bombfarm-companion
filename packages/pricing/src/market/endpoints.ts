import type { AppFilters, SearchFilters, SearchPage, SearchRow } from './types.js';

const COMMUNITY = 'https://steamcommunity.com/market';

/**
 * Steam caps `search/render` at 10 rows per page regardless of the `count` asked for
 * (measured 2026-08-28: count=10/20/50/100 all return pagesize 10). Paging therefore costs one
 * call per 10 rows, which is what makes facet-narrowed queries cheaper than a flat sweep.
 */
export const SEARCH_PAGE_SIZE = 10;

export function appFiltersUrl(appId: number): string {
  return `${COMMUNITY}/appfilters/${String(appId)}`;
}

export function listingUrl(appId: number, hashName: string): string {
  return `${COMMUNITY}/listings/${String(appId)}/${encodeURIComponent(hashName)}`;
}

/**
 * A `search/render` URL narrowed to `filters`. The facet parameter is the market UI's own
 * `category_<appid>_<facet>[]=tag_<value>` form, which is what lets a row's tags be known by
 * construction instead of parsed out of its name.
 */
export function searchRenderUrl(
  appId: number,
  filters: SearchFilters,
  start: number,
  count = SEARCH_PAGE_SIZE,
): string {
  const params = new URLSearchParams({
    appid: String(appId),
    norender: '1',
    start: String(start),
    count: String(count),
    country: 'US',
    language: 'english',
    currency: '1',
    sort_column: 'name',
    sort_dir: 'asc',
  });
  for (const [facet, tag] of Object.entries(filters) as [string, string | undefined][]) {
    if (tag != null) params.append(`category_${String(appId)}_${facet}[]`, `tag_${tag}`);
  }
  return `${COMMUNITY}/search/render/?${params.toString()}`;
}

interface RawAppFilters {
  success?: boolean;
  facets?: Record<string, { name?: string; tags?: Record<string, unknown> } | undefined>;
}

/**
 * Facet name -> its tag values. Keys arrive prefixed with the appid (`4892010_rarity`); the
 * inner `name` is the bare facet, which is what `searchRenderUrl` needs.
 */
export function parseAppFilters(payload: unknown): AppFilters {
  const raw = payload as RawAppFilters | null;
  if (raw?.success !== true || raw.facets == null) return {};
  const filters: AppFilters = {};
  for (const facet of Object.values(raw.facets)) {
    if (typeof facet?.name !== 'string' || facet.tags == null) continue;
    filters[facet.name] = Object.keys(facet.tags);
  }
  return filters;
}

interface RawSearchRow {
  name?: unknown;
  hash_name?: unknown;
  sell_listings?: unknown;
  sell_price?: unknown;
  asset_description?: { icon_url?: unknown; type?: unknown };
}

interface RawSearchPage {
  success?: boolean;
  total_count?: unknown;
  results?: unknown;
}

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function parseSearchPage(payload: unknown): SearchPage {
  const raw = payload as RawSearchPage | null;
  if (raw?.success !== true || !Array.isArray(raw.results)) return { totalCount: 0, rows: [] };
  const rows: SearchRow[] = [];
  for (const entry of raw.results as (RawSearchRow | null)[]) {
    const hashName = asString(entry?.hash_name);
    if (hashName == null) continue;
    rows.push({
      hashName,
      name: asString(entry?.name) ?? hashName,
      sellPriceCents: asNumber(entry?.sell_price),
      listings: asNumber(entry?.sell_listings) ?? 0,
      iconUrl: asString(entry?.asset_description?.icon_url),
      type: asString(entry?.asset_description?.type),
    });
  }
  return { totalCount: asNumber(raw.total_count) ?? 0, rows };
}
