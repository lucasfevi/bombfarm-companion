import { STEAM_CURRENCY_IDS, steamCurrencyFor } from './currencies.js';
import type { SearchPage, SearchRow } from './types.js';

const COMMUNITY = 'https://steamcommunity.com/market';

/**
 * Steam caps `search/render` at 10 rows per page regardless of the `count` asked for
 * (measured 2026-08-28: count=10/20/50/100 all return pagesize 10). Paging therefore costs one
 * call per 10 rows, which is what puts a walk of the whole market at a couple of dozen calls.
 */
export const SEARCH_PAGE_SIZE = 10;

export function listingUrl(appId: number, hashName: string): string {
  return `${COMMUNITY}/listings/${String(appId)}/${encodeURIComponent(hashName)}`;
}

/**
 * `search/render` ignores the currency parameter — measured 2026-08-29, `currency=7` came back
 * `$3.65 USD` — but `priceoverview` honours it, which is the whole reason a second endpoint is
 * worth the per-item call. The id table lives in `currencies.ts`.
 */
export function priceOverviewUrl(appId: number, hashName: string, currency: string): string {
  const params = new URLSearchParams({
    appid: String(appId),
    currency: String(STEAM_CURRENCY_IDS[currency.toUpperCase()] ?? 1),
    market_hash_name: hashName,
  });
  return `${COMMUNITY}/priceoverview/?${params.toString()}`;
}

const UNKNOWN_CURRENCY_MINOR_UNITS = 2;

function minorUnitsOf(currency: string | undefined): number {
  if (currency === undefined) return UNKNOWN_CURRENCY_MINOR_UNITS;
  return steamCurrencyFor(currency)?.minorUnits ?? UNKNOWN_CURRENCY_MINOR_UNITS;
}

function separatorIsGrouping(fraction: string, minorUnits: number): boolean {
  if (minorUnits === 0) return true;
  if (minorUnits === 3) return false;
  return fraction.length === 3;
}

/**
 * Reads an amount out of one of Steam's locale-formatted price strings — `$4.80`, `R$ 25,00`,
 * `R$ 1.234,56`. There is no machine-readable field on this endpoint; the formatted string is
 * all it returns, and neither separator character says which job it is doing: BRL uses each one
 * for the opposite job to USD.
 *
 * How many digits the currency's minor unit has settles it, so the currency decides the parse.
 * A three-decimal currency reads a trailing group of three digits as its fraction (`1.234` is
 * 1.234 KWD, and `1.234.567` is 1234.567); a currency with no minor unit can never take a
 * fraction, so every separator in it is grouping. With no currency to go on, a trailing group
 * of exactly three digits is read as grouping, which keeps `R$ 1.234` at 1234 while still
 * reading `R$ 0,17` as 0.17.
 */
export function parseMoneyAmount(text: string, currency?: string): number | null {
  const digits = text.replace(/[^\d.,]/g, '');
  if (digits === '') return null;

  const lastSeparator = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','));
  if (lastSeparator === -1) {
    const whole = Number(digits);
    return Number.isFinite(whole) ? whole : null;
  }

  const fraction = digits.slice(lastSeparator + 1);
  const normalized = separatorIsGrouping(fraction, minorUnitsOf(currency))
    ? digits.replace(/[.,]/g, '')
    : `${digits.slice(0, lastSeparator).replace(/[.,]/g, '')}.${fraction}`;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

interface RawPriceOverview {
  success?: unknown;
  lowest_price?: unknown;
  median_price?: unknown;
  volume?: unknown;
}

export interface PriceQuote {
  lowest: number | null;
  median: number | null;
  /** 24h units sold, as Steam reports it — `"1,234"` on the wire. */
  volume: number | null;
}

function parseVolume(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const units = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(units) ? units : null;
}

/**
 * What Steam quotes for one item in one currency, or null when it did not answer at all.
 *
 * Each field is independently absent, and a null `lowest` is not the same statement as
 * `search/render`'s null. Measured 2026-08-29, `Gold Gloves (Legendary)` answered
 * `{"success":true}` with no price in either currency while the search endpoint carried it at
 * $14.99 with a live listing — so this endpoint under-reports, and a caller must fall back rather
 * than conclude the item is unlisted.
 */
export function parsePriceOverview(payload: unknown, currency?: string): PriceQuote | null {
  const raw = payload as RawPriceOverview | null;
  if (raw?.success !== true) return null;
  return {
    lowest:
      typeof raw.lowest_price === 'string' ? parseMoneyAmount(raw.lowest_price, currency) : null,
    median:
      typeof raw.median_price === 'string' ? parseMoneyAmount(raw.median_price, currency) : null,
    volume: parseVolume(raw.volume),
  };
}

/**
 * One page of the unfiltered `search/render` walk.
 *
 * It takes no facet narrowing, because nothing asks for any: a row's identity comes from matching
 * its hash against the names the committed catalog can generate, so the only query the sweep makes
 * is this one.
 */
export function searchRenderUrl(
  appId: number,
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
  return `${COMMUNITY}/search/render/?${params.toString()}`;
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
