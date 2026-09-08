import type { ResolvedPrice } from '@bombfarm/pricing';
import { oldestQuotedUtc } from '@bombfarm/pricing';
import { sub } from './format';
import type { Lang } from './lang';
import { STRINGS } from './strings';

const LOCALES: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US' };

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** ICU separates the currency symbol with U+00A0; normalize so rendered text stays predictable. */
function normalizeSpaces(text: string): string {
  return text.replace(/[\u00A0\u202F]/g, ' ');
}

/**
 * The currency the published market snapshot quotes in, and so the one every price this app shows
 * is read in. `@bombfarm/contracts` owns the canonical value, but this app's tsconfig aliases that
 * package to its source, whose Node-style specifiers the bundler cannot resolve — so the web names
 * it here rather than dragging that barrel into the browser bundle.
 */
export const MARKET_CURRENCY = 'BRL';

export function formatMoney(amount: number, lang: Lang, currency: string = MARKET_CURRENCY): string {
  return normalizeSpaces(
    new Intl.NumberFormat(LOCALES[lang], { style: 'currency', currency }).format(amount),
  );
}

export function formatQuoteAge(quotedUtc: string | null, lang: Lang, now = Date.now()): string {
  const strings = STRINGS[lang];
  if (quotedUtc == null) return strings.marketAgeUnknown;
  const quoted = Date.parse(quotedUtc);
  if (Number.isNaN(quoted)) return strings.marketAgeUnknown;

  const elapsed = Math.max(0, now - quoted);
  if (elapsed < MINUTE_MS) return strings.marketAgeJustNow;
  if (elapsed < HOUR_MS) {
    return sub(strings.marketAgeMinutes, { value: Math.floor(elapsed / MINUTE_MS) });
  }
  if (elapsed < DAY_MS) {
    return sub(strings.marketAgeHours, { value: Math.floor(elapsed / HOUR_MS) });
  }
  return sub(strings.marketAgeDays, { value: Math.floor(elapsed / DAY_MS) });
}

/**
 * How old the prices behind a summary are, dated by the oldest of them, or null when not one of
 * them is dated and there is nothing honest to say.
 *
 * It takes the prices rather than a timestamp on purpose. Saying so in prose did not work: the
 * snapshot's `generatedUtc` is in reach at every call site and reads like the answer, and all
 * three call sites passed it. It is not the answer — a rate-limited run republishes the file while
 * leaving individual quotes hours older, so the file's age is the age of the publish and not of
 * any price shown. Given only resolved prices, that number is not one this can be handed.
 *
 * The oldest rather than the newest or the typical: it is the only age true of every row the line
 * sits above, and a summary that contradicts the rows beneath it is the defect this replaced.
 */
export function formatPriceFreshness(
  prices: readonly ResolvedPrice[],
  lang: Lang,
  now = Date.now(),
): string | null {
  const oldest = oldestQuotedUtc(prices);
  if (oldest == null) return null;
  return sub(STRINGS[lang].marketPricesOldest, { age: formatQuoteAge(oldest, lang, now) });
}

export function formatQuoteTooltip(
  price: Pick<ResolvedPrice, 'basis' | 'currency' | 'quotedUtc'>,
  lang: Lang,
  now = Date.now(),
): string {
  const strings = STRINGS[lang];
  const template =
    price.basis === 'native'
      ? strings.marketQuoteNativeTooltip
      : strings.marketQuoteConvertedTooltip;
  return sub(template, {
    currency: price.currency,
    age: formatQuoteAge(price.quotedUtc, lang, now),
  });
}

export function formatUnpricedLabel(
  state: Exclude<ResolvedPrice['state'], 'priced'>,
  lang: Lang,
): string {
  const strings = STRINGS[lang];
  switch (state) {
    case 'not-tradable': {
      return strings.marketNotTradable;
    }
    case 'unknown': {
      return strings.marketNotOnMarket;
    }
    default: {
      return strings.marketNoListings;
    }
  }
}
