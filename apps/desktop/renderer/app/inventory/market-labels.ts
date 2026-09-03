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
 *
 * A quote that reads as later than `now` is the freshest one there is, not an undatable one: the
 * per-item refresh stamps the quote in the main process, and any renderer clock that trails it by
 * a millisecond would otherwise report a price fetched a moment ago as having no known time.
 */
export function quoteAge(quotedUtc: string | null, t: Copy, now = Date.now()): string {
  if (quotedUtc == null) return t.marketAgeUnknown;
  const parsed = Date.parse(quotedUtc);
  if (Number.isNaN(parsed)) return t.marketAgeUnknown;
  const elapsed = Math.max(0, now - parsed);
  if (elapsed < MINUTE) return t.marketAgeJustNow;
  if (elapsed < HOUR) return sub(t.marketAgeMinutes, { count: Math.floor(elapsed / MINUTE) });
  if (elapsed < DAY) return sub(t.marketAgeHours, { count: Math.floor(elapsed / HOUR) });
  return sub(t.marketAgeDays, { count: Math.floor(elapsed / DAY) });
}

/**
 * `now` is a clock, not a moment. Binding one moment here dates every quote against the render
 * that built the labels: ages freeze where they were, and a price refreshed after that render is
 * stamped in the future and reads as having no known time at all.
 */
export function marketPriceLabels(
  t: Copy,
  locale: AppLocale,
  now: () => number = Date.now,
): MarketPriceLabels {
  return {
    amount: (amount, currency) =>
      new Intl.NumberFormat(BCP47_BY_LOCALE[locale], {
        style: 'currency',
        currency,
      }).format(amount),
    title: (price: MarketPriceView) =>
      sub(price.basis === 'native' ? t.marketNativeTooltip : t.marketConvertedTooltip, {
        currency: price.currency,
        age: quoteAge(price.quotedUtc, t, now()),
      }),
    unpriced: (state) => (state === 'no-listing' ? t.marketNoListings : t.marketNotOnMarket),
  };
}
