import type { ResolvedPrice } from '@bombfarm/pricing';
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

export function formatMoney(amount: number, lang: Lang, currency = 'BRL'): string {
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
 * The staleness line reads the quote's own timestamp, not the snapshot's `generatedUtc`: a
 * rate-limited run republishes the file while leaving an individual quote hours older.
 */
export function formatPricesUpdated(
  quotedUtc: string | null,
  lang: Lang,
  now = Date.now(),
): string {
  return sub(STRINGS[lang].marketPricesUpdated, { age: formatQuoteAge(quotedUtc, lang, now) });
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
