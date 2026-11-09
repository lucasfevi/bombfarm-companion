/**
 * The one number/date formatter for the renderer. Every formatter follows the chosen language —
 * this file owns no words of its own. Relative ages come from the design system's `formatAge` /
 * `formatTimeAgo`, so every consumer prints one spelling; the number formatters take the locale
 * and resolve it through `BCP47_BY_LOCALE` for `Intl`/`toLocaleString`.
 *
 * What this file deliberately does not become: a general formatting layer.
 */
import { BCP47_BY_LOCALE, energyDisplayPercent, type AppLocale } from '@bombfarm/contracts';
import { formatTimeAgo, type Lang } from '@bombfarm/ui';

/**
 * Human-relative age of an ISO-8601 `capturedAt` timestamp (restored data is stamped
 * with its capture time, never presented as current). `now` defaults to `Date.now()` and is
 * otherwise injectable for tests.
 */
export function formatCapturedAt(capturedAt: string, lang: Lang, now: number = Date.now()): string {
  const capturedMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedMs)) return capturedAt;
  return formatTimeAgo(now - capturedMs, lang);
}

/**
 * Signed percentage gain, one decimal place — used for next-point ranking rows. `Intl`'s own
 * `signDisplay: 'exceptZero'` replaces the hand-rolled `'+'` prefix, so the sign AND the
 * decimal/grouping separators all follow the locale: `+4.6%` in English, `+4,6%` in PT-BR.
 */
export function formatGainPct(gainPct: number, locale: AppLocale): string {
  return new Intl.NumberFormat(BCP47_BY_LOCALE[locale], {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(gainPct / 100);
}

/** A calendar date from an ISO-8601 instant, spelled out per locale; anything unparsable is printed as given. */
export function formatDate(iso: string, locale: AppLocale): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleDateString(BCP47_BY_LOCALE[locale], { dateStyle: 'long' });
}

/** Whole-number DPS, thousands-grouped per locale. */
export function formatDps(dps: number, locale: AppLocale): string {
  return Math.round(dps).toLocaleString(BCP47_BY_LOCALE[locale]);
}

/** Thousands-grouped integer count (e.g. gear/warning counts), per locale. */
export function formatCount(count: number, locale: AppLocale): string {
  return Math.round(count).toLocaleString(BCP47_BY_LOCALE[locale]);
}

/** A field the account payload carries as either a number or a numeric string (or not at all) —
 *  `null` for anything that is not a finite number, never a coerced `NaN`/`Infinity`. */
export function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** A market amount in its own currency, symbol and separators both following the chosen language. */
export function formatMoney(amount: number, locale: AppLocale, currency: string): string {
  return new Intl.NumberFormat(BCP47_BY_LOCALE[locale], { style: 'currency', currency }).format(amount);
}

/** Re-exported rather than reimplemented: this is the same rule the main process uses to decide
 *  whether a new energy reading is worth sending at all, and a second copy of it here is how the
 *  two would drift into disagreeing about what a change is. */
export const energyPercent = energyDisplayPercent;

export function formatEnergyPercent(fraction: number, locale: AppLocale): string {
  return new Intl.NumberFormat(BCP47_BY_LOCALE[locale], {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(energyPercent(fraction) / 100);
}
