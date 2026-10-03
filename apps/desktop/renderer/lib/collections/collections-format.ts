import { BCP47_BY_LOCALE, type AppLocale } from '@bombfarm/contracts';

const MAX_FRACTION_DIGITS = 2;
const PERCENT = 100;

function percentFormat(locale: AppLocale, signed: boolean): Intl.NumberFormat {
  return new Intl.NumberFormat(BCP47_BY_LOCALE[locale], {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: MAX_FRACTION_DIGITS,
    ...(signed ? { signDisplay: 'always' as const } : {}),
  });
}

/** A bonus the way the whole screen prints one: its sign, up to two decimals with the trailing
 *  zeros dropped, in the chosen language's separators — `+13.65%`, `+30%`, `+0%`. */
export function formatBonus(percent: number, locale: AppLocale): string {
  return percentFormat(locale, true).format(percent / PERCENT);
}

/** The same figure without a sign, for a limit rather than a gain: `75%`. */
export function formatLimit(percent: number, locale: AppLocale): string {
  return percentFormat(locale, false).format(percent / PERCENT);
}

/** How full a bar is: `value` against `limit`, held inside the track, empty when there is no limit. */
export function fillPercent(value: number, limit: number): number {
  if (!(limit > 0) || !(value > 0)) return 0;
  return Math.min(PERCENT, (value / limit) * PERCENT);
}
