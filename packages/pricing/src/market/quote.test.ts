import { describe, expect, it, vi } from 'vitest';
import {
  parseMoneyAmount,
  parsePriceOverview,
  priceOverviewUrl,
  type PriceQuote,
} from './endpoints.js';
import { quoteNative, type QuoteFetchResult } from './quote.js';

const APP_ID = 4892010;
const noSleep = () => Promise.resolve();
const at = (iso: string) => () => Date.parse(iso);
const quote = (lowest: number): PriceQuote => ({ lowest, median: lowest + 1, volume: 7 });

function fetcherFrom(answers: Record<string, QuoteFetchResult>) {
  const calls: string[] = [];
  const fetchPriceOverview = vi.fn((url: string): Promise<QuoteFetchResult> => {
    calls.push(url);
    const hashName = decodeURIComponent(new URL(url).searchParams.get('market_hash_name') ?? '');
    return Promise.resolve<QuoteFetchResult>(answers[hashName] ?? { ok: true, quote: null });
  });
  return { calls, fetchPriceOverview };
}

describe('parseMoneyAmount', () => {
  it('reads both separator conventions from the same function', () => {
    expect(parseMoneyAmount('$4.80')).toBe(4.8);
    expect(parseMoneyAmount('R$ 25,00')).toBe(25);
    expect(parseMoneyAmount('R$ 1.234,56')).toBe(1234.56);
    expect(parseMoneyAmount('$1,234.56')).toBe(1234.56);
  });

  it('treats a trailing group of exactly three digits as grouping, not a decimal', () => {
    expect(parseMoneyAmount('R$ 1.234')).toBe(1234);
    expect(parseMoneyAmount('1,500')).toBe(1500);
    expect(parseMoneyAmount('R$ 0,17')).toBe(0.17);
  });

  it('is null for a string carrying no number', () => {
    expect(parseMoneyAmount('')).toBeNull();
    expect(parseMoneyAmount('R$')).toBeNull();
  });
});

describe('parsePriceOverview', () => {
  it('reads the lowest listing, the median and the 24h volume from one answer', () => {
    expect(
      parsePriceOverview({
        success: true,
        lowest_price: 'R$ 25,00',
        median_price: 'R$ 26,50',
        volume: '1,234',
      }),
    ).toEqual({ lowest: 25, median: 26.5, volume: 1234 });
  });

  it('leaves a field Steam omitted null rather than zero', () => {
    expect(parsePriceOverview({ success: true, lowest_price: 'R$ 25,00' })).toEqual({
      lowest: 25,
      median: null,
      volume: null,
    });
  });

  it('is null for a volume that is not a number', () => {
    expect(parsePriceOverview({ success: true, volume: 'many' })?.volume).toBeNull();
  });

  it('carries no price when Steam succeeds without quoting one', () => {
    // Measured live: this is what a genuinely listed item can answer, so it cannot mean unlisted.
    expect(parsePriceOverview({ success: true })).toEqual({
      lowest: null,
      median: null,
      volume: null,
    });
  });

  it('is null overall when Steam did not answer', () => {
    expect(parsePriceOverview({ success: false, lowest_price: 'R$ 25,00' })).toBeNull();
  });
});

describe('quoteNative', () => {
  it('quotes each hash in each requested currency', async () => {
    const { fetchPriceOverview } = fetcherFrom({
      'Coal Boots Lv 30 (Rare)': { ok: true, quote: quote(25) },
    });

    const result = await quoteNative(APP_ID, ['Coal Boots Lv 30 (Rare)'], ['BRL'], {
      fetchPriceOverview,
      sleep: noSleep,
      now: at('2026-08-29T18:00:00.000Z'),
    });

    expect(result.quotes.get('Coal Boots Lv 30 (Rare)')).toEqual({ BRL: quote(25) });
    expect(result.quotedUtc).toBe('2026-08-29T18:00:00.000Z');
    expect(result.currencies).toEqual(['BRL']);
    expect(result.complete).toBe(true);
  });

  it('asks the currency-honouring endpoint, not the search one', async () => {
    const { calls, fetchPriceOverview } = fetcherFrom({});
    await quoteNative(APP_ID, ['Gold Ring Lv 20 (Rare)'], ['BRL'], {
      fetchPriceOverview,
      sleep: noSleep,
    });

    expect(calls).toEqual([priceOverviewUrl(APP_ID, 'Gold Ring Lv 20 (Rare)', 'BRL')]);
    expect(calls[0]).toContain('currency=7');
  });

  it('leaves an unquoted hash absent rather than recording it as zero or null', async () => {
    const { fetchPriceOverview } = fetcherFrom({
      'Gold Gloves (Legendary)': { ok: true, quote: { lowest: null, median: 14.5, volume: 3 } },
    });

    const result = await quoteNative(APP_ID, ['Gold Gloves (Legendary)'], ['BRL'], {
      fetchPriceOverview,
      sleep: noSleep,
    });

    expect(result.quotes.has('Gold Gloves (Legendary)')).toBe(false);
    expect(result.unquoted).toBe(1);
    expect(result.complete).toBe(true);
  });

  /**
   * Absent from `quotes` and present here are the same answer read two ways. The snapshot must not
   * see it — a priceless entry there would date the row and defeat the inheritance a rate-limited
   * pass depends on — while a caller keeping history has a reading worth writing down: the market
   * saying it has nothing to quote for this item.
   */
  it('reports a priceless answer as a reading, with what the answer did hold', async () => {
    const { fetchPriceOverview } = fetcherFrom({
      'Gold Gloves (Legendary)': { ok: true, quote: { lowest: null, median: 14.5, volume: 3 } },
    });

    const result = await quoteNative(APP_ID, ['Gold Gloves (Legendary)'], ['BRL'], {
      fetchPriceOverview,
      sleep: noSleep,
    });

    expect(result.answeredUnpriced).toEqual([
      {
        hashName: 'Gold Gloves (Legendary)',
        currency: 'BRL',
        quote: { lowest: null, median: 14.5, volume: 3 },
      },
    ]);
  });

  it('reports nothing for a hash the endpoint did not answer for at all', async () => {
    const { fetchPriceOverview } = fetcherFrom({
      'Never Answered (Rare)': { ok: true, quote: null },
      'Request Failed (Rare)': { ok: false, rateLimited: false },
    });

    const result = await quoteNative(
      APP_ID,
      ['Never Answered (Rare)', 'Request Failed (Rare)'],
      ['BRL'],
      { fetchPriceOverview, sleep: noSleep },
    );

    expect(result.unquoted).toBe(2);
    expect(result.answeredUnpriced).toEqual([]);
  });

  it('reports nothing for the hashes the breaker stopped it reaching', async () => {
    const fetchPriceOverview = vi.fn((url: string) => {
      const hashName = decodeURIComponent(new URL(url).searchParams.get('market_hash_name') ?? '');
      return Promise.resolve<QuoteFetchResult>(
        hashName === 'Priceless (Rare)'
          ? { ok: true, quote: { lowest: null, median: null, volume: null } }
          : { ok: false, rateLimited: true },
      );
    });

    const result = await quoteNative(
      APP_ID,
      ['Priceless (Rare)', 'Never Reached (Rare)'],
      ['BRL'],
      { fetchPriceOverview, sleep: noSleep, baseDelayMs: 1, maxConsecutiveRateLimits: 3 },
    );

    expect(result.complete).toBe(false);
    expect(result.answeredUnpriced.map((answer) => answer.hashName)).toEqual(['Priceless (Rare)']);
  });

  it('backs off on a rate limit and then continues', async () => {
    const waits: number[] = [];
    let limited = false;
    const fetchPriceOverview = vi.fn(() => {
      if (!limited) {
        limited = true;
        return Promise.resolve<QuoteFetchResult>({ ok: false, rateLimited: true });
      }
      return Promise.resolve<QuoteFetchResult>({ ok: true, quote: quote(12) });
    });

    const result = await quoteNative(APP_ID, ['Ember Ring Lv 10 (Rare)'], ['BRL'], {
      fetchPriceOverview,
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
      baseDelayMs: 100,
    });

    expect(waits[0]).toBe(200);
    expect(result.quotes.get('Ember Ring Lv 10 (Rare)')).toEqual({ BRL: quote(12) });
    expect(result.complete).toBe(true);
  });

  it('stops the pass once the quota is spent, keeping what it already quoted', async () => {
    const quoted = 'Coal Boots Lv 30 (Rare)';
    const fetchPriceOverview = vi.fn((url: string) => {
      const hashName = decodeURIComponent(new URL(url).searchParams.get('market_hash_name') ?? '');
      return Promise.resolve<QuoteFetchResult>(
        hashName === quoted ? { ok: true, quote: quote(25) } : { ok: false, rateLimited: true },
      );
    });

    const result = await quoteNative(APP_ID, [quoted, 'Gold Ring Lv 20 (Rare)'], ['BRL'], {
      fetchPriceOverview,
      sleep: noSleep,
      baseDelayMs: 1,
      maxConsecutiveRateLimits: 3,
    });

    expect(result.complete).toBe(false);
    expect(result.quotes.get(quoted)).toEqual({ BRL: quote(25) });
    expect(result.anomalies.map((anomaly) => anomaly.kind)).toEqual(['rate-limited']);
  });
});
