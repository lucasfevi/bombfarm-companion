import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { marketPriceLabels, quoteAge } from './market-labels';
import type { MarketPriceView } from '@bombfarm/game-art';

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
