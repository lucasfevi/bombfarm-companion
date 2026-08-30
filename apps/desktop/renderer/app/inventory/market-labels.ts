import type { MarketPriceLabels, MarketPriceView } from '@bombfarm/game-art';
import { BCP47_BY_LOCALE, type AppLocale } from '@bombfarm/contracts';
import { sub, type Copy } from '../../lib/copy';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How old the quote behind a figure is, in the shell's own four buckets.
 *
 * Dated by the quote rather than by the snapshot that carried it: a rate-limited run republishes
 * the file while leaving an individual quote hours older, so reading the file's timestamp would
 * claim a freshness the number does not have.
 */
export function quoteAge(quotedUtc: string | null, t: Copy, now = Date.now()): string {
  if (quotedUtc == null) return t.marketAgeUnknown;
  const elapsed = now - Date.parse(quotedUtc);
  if (!Number.isFinite(elapsed) || elapsed < 0) return t.marketAgeUnknown;
  if (elapsed < MINUTE) return t.marketAgeJustNow;
  if (elapsed < HOUR) return sub(t.marketAgeMinutes, { count: Math.floor(elapsed / MINUTE) });
  if (elapsed < DAY) return sub(t.marketAgeHours, { count: Math.floor(elapsed / HOUR) });
  return sub(t.marketAgeDays, { count: Math.floor(elapsed / DAY) });
}

export function marketPriceLabels(t: Copy, locale: AppLocale, now = Date.now()): MarketPriceLabels {
  return {
    amount: (amount, currency) =>
      new Intl.NumberFormat(BCP47_BY_LOCALE[locale], {
        style: 'currency',
        currency,
      }).format(amount),
    title: (price: MarketPriceView) =>
      sub(price.basis === 'native' ? t.marketNativeTooltip : t.marketConvertedTooltip, {
        currency: price.currency,
        age: quoteAge(price.quotedUtc, t, now),
      }),
    unpriced: (state) => (state === 'no-listing' ? t.marketNoListings : t.marketNotOnMarket),
  };
}
