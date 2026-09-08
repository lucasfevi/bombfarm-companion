import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { marketPriceLabels, priceFreshness, quoteAge } from './market-labels';
import type { MarketPriceView } from '@bombfarm/game-art';
import type { ResolvedPrice } from '@bombfarm/pricing';

const NOW = Date.parse('2026-09-02T12:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const nativePrice = (quotedUtc: string | null): MarketPriceView => ({
  state: 'priced',
  amount: 2.49,
  currency: 'BRL',
  basis: 'native',
  listingUrl: 'https://steamcommunity.com/market/listings/1/Item',
  quotedUtc,
  listings: 3,
});

describe('quoteAge', () => {
  it('buckets a past quote by minutes, hours and days', () => {
    expect(quoteAge(at(-30_000), en, NOW)).toBe('just now');
    expect(quoteAge(at(-45 * 60_000), en, NOW)).toBe('45 min ago');
    expect(quoteAge(at(-6 * 3_600_000), en, NOW)).toBe('6 h ago');
    expect(quoteAge(at(-3 * 86_400_000), en, NOW)).toBe('3 d ago');
  });

  it('reads a quote stamped after the clock as the freshest one, not an undatable one', () => {
    expect(quoteAge(at(1), en, NOW)).toBe('just now');
    expect(quoteAge(at(3_600_000), en, NOW)).toBe('just now');
  });

  it('gives up only on an absent or unparseable stamp', () => {
    expect(quoteAge(null, en, NOW)).toBe('at an unknown time');
    expect(quoteAge('whenever', en, NOW)).toBe('at an unknown time');
  });
});

describe('marketPriceLabels', () => {
  it('dates each tooltip against the clock at the moment it is asked, not at build time', () => {
    const clock = vi.fn(() => NOW);
    const labels = marketPriceLabels(en, 'en', clock);

    expect(labels.title(nativePrice(at(-45 * 60_000)))).toBe(
      'Lowest listing on Steam, in BRL — quoted 45 min ago',
    );

    clock.mockReturnValue(NOW + 2 * 3_600_000);
    expect(labels.title(nativePrice(at(-45 * 60_000)))).toBe(
      'Lowest listing on Steam, in BRL — quoted 2 h ago',
    );
  });

  it('dates a quote taken after the labels were built rather than calling its time unknown', () => {
    const labels = marketPriceLabels(en, 'en', () => NOW);

    expect(labels.title(nativePrice(at(5_000)))).toBe(
      'Lowest listing on Steam, in BRL — quoted just now',
    );
  });
});

describe('priceFreshness', () => {
  const quoted = (quotedUtc: string | null): ResolvedPrice => ({
    state: quotedUtc == null ? 'no-listing' : 'priced',
    key: 'iron_sword:2',
    hashName: 'Iron Sword (Rare)',
    listingUrl: null,
    lowestUsd: quotedUtc == null ? null : 3,
    amount: quotedUtc == null ? null : 3,
    currency: 'BRL',
    basis: 'converted',
    quotedUtc,
    listings: 1,
    alternateHashNames: [],
  });

  it('dates the line by the oldest price it covers, not the newest and not the typical', () => {
    const mostlyFresh = [
      quoted(at(-12 * 60_000)),
      quoted(at(-12 * 60_000)),
      quoted(at(-397 * 60_000)),
    ];

    expect(priceFreshness(mostlyFresh, en, NOW)).toBe('oldest price 6 h ago');
  });

  it('says nothing at all rather than a claim about prices none of which is dated', () => {
    expect(priceFreshness([], en, NOW)).toBeNull();
    expect(priceFreshness([quoted(null), quoted('whenever')], en, NOW)).toBeNull();
  });

  it('will not accept the timestamp of the file the prices arrived in', () => {
    const publishedUtc = at(-12 * 60_000);

    // What the Account screen used to pass. `tsc` is the assertion here: make this call legal and
    // the directive becomes unused, which is itself a compile error.
    // @ts-expect-error a summary is dated by the prices it summarises or not at all
    priceFreshness(publishedUtc, en, NOW);

    // And the two claims are not interchangeable — the file's age is the shape production was in.
    expect(quoteAge(publishedUtc, en, NOW)).toBe('12 min ago');
    expect(priceFreshness([quoted(at(-397 * 60_000))], en, NOW)).toBe('oldest price 6 h ago');
  });
});
