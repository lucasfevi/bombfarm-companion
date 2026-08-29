/**
 * The languages a number can be written in.
 *
 * Declared here rather than imported: this is a design-system package and cannot reach an app's
 * i18n layer at all, and the union is the same two literals. `i18n-lang-parity.test.ts`
 * fails if the two unions ever stop matching, so adding a language cannot silently leave numbers
 * behind.
 */
export type Lang = 'pt' | 'en';

/**
 * Display numbers in the reader's own separator convention: `1.234,5` in Portuguese, `1,234.5` in
 * English.
 *
 * This used to be fixed to the English convention for every reader, which is wrong in the language
 * most of them use — `9,000` reads as nine, not nine thousand. It became visibly wrong once prices
 * arrived: `Intl` formats a currency in the reader's locale, so a card footer showed `R$ 29,85`
 * directly above a gold value written `9,000`, two conventions in the same column.
 *
 * `lang` is required rather than defaulted. A default is what let the old behaviour survive
 * unnoticed at over a hundred call sites; making the compiler name every one of them is the only
 * way to know they were all considered.
 */
export function formatNumber(value: number, lang: Lang, decimals = 1): string {
  return value.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Drop a redundant zero fraction before a unit suffix (`90,0k` → `90k`), in either convention. */
function trimCompactFraction(text: string): string {
  return text.replace(/[.,]0+$/, '');
}

/**
 * Compact metric display for dense chrome (hero strip, team plan): `90200` → `90.2k`,
 * `1_200_000` → `1.2m`, `24_000_000_000` → `24bi`. Values under 1k render with `formatNumber`.
 */
export function formatCompactNumber(value: number, lang: Lang, decimals = 1): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  const compact = (unit: number, suffix: string): string =>
    `${sign}${trimCompactFraction(formatNumber(abs / unit, lang, decimals))}${suffix}`;

  if (abs >= 1_000_000_000) return compact(1_000_000_000, 'bi');
  if (abs >= 1_000_000) return compact(1_000_000, 'm');
  if (abs >= 1_000) return compact(1_000, 'k');
  if (Number.isInteger(value)) return String(value);
  return formatNumber(value, lang, decimals);
}

/** A number formatter with one signature: `(n, decimals?)`. */
export type BoundNumberFormat = (value: number, decimals?: number) => string;

/**
 * Binds a language into a formatter for the components and label builders that take one injected.
 *
 * That injection is what keeps those files free of i18n entirely — they render whatever they are
 * handed — so the language is bound here, at the one place that knows it, rather than threaded
 * into every component that draws a number.
 *
 * Memoise it at the call site: it is passed as a prop, and a fresh identity every render defeats
 * the memoisation the receiving components rely on.
 */
export function numberFormatterFor(lang: Lang): BoundNumberFormat {
  return (value, decimals) => formatNumber(value, lang, decimals);
}

/** The compact form of {@link numberFormatterFor}, for the dense chrome that takes one injected. */
export function compactNumberFormatterFor(lang: Lang): BoundNumberFormat {
  return (value, decimals) => formatCompactNumber(value, lang, decimals);
}
