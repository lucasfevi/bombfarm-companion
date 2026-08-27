/**
 * The one number/date formatter for the renderer (design.md §6, TD-12). MP3 F4 (`AD-054`): every
 * formatter now follows the chosen language — this file owns no words of its own. The five
 * relative-age strings and the two short-age suffixes render through `sub()` against copy keys
 * the caller supplies (`en.ts`'s `age*` keys); the number formatters take the locale and resolve
 * it through `BCP47_BY_LOCALE` for `Intl`/`toLocaleString`, replacing the hardcoded `'en-US'`.
 *
 * What this file deliberately does not become (design §2.3, §9): a general formatting layer, an
 * `Intl.RelativeTimeFormat` wrapper, or a plural-rule engine. Four buckets is the shell's whole
 * relative-age need, and the `age*` copy keys are singular/plural-agnostic by construction.
 */
import { BCP47_BY_LOCALE, type AppLocale } from '@bombfarm/contracts';
import { sub, type Copy } from './copy';

/** The exact slice of `Copy` these two formatters depend on — narrower than the full `Copy`
 *  object, so the dependency is documented at the type level, not just in prose. */
type AgeCopy = Pick<Copy, 'ageJustNow' | 'ageMinutes' | 'ageHours' | 'ageDays' | 'ageShortSeconds' | 'ageShortMinutes'>;

/** Short seconds/minutes age label for `StatusChip.ageLabel` — same shape as the deleted inline `formatAgeLabel`. */
export function formatAge(staleAgeMs: number, t: AgeCopy): string {
  const seconds = Math.max(0, Math.round(staleAgeMs / 1000));
  return seconds < 60
    ? sub(t.ageShortSeconds, { n: seconds })
    : sub(t.ageShortMinutes, { n: Math.round(seconds / 60) });
}

/**
 * Human-relative age of an ISO-8601 `capturedAt` timestamp (MPV-04 — restored data is stamped
 * with its capture time, never presented as current). `now` defaults to `Date.now()` and is
 * otherwise injectable for tests.
 */
export function formatCapturedAt(capturedAt: string, t: AgeCopy, now: number = Date.now()): string {
  const capturedMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedMs)) return capturedAt;
  const ageMs = Math.max(0, now - capturedMs);
  const seconds = Math.round(ageMs / 1000);
  if (seconds < 60) return t.ageJustNow;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return sub(t.ageMinutes, { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return sub(t.ageHours, { n: hours });
  const days = Math.round(hours / 24);
  return sub(t.ageDays, { n: days });
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

/** Whole-number DPS, thousands-grouped per locale. */
export function formatDps(dps: number, locale: AppLocale): string {
  return Math.round(dps).toLocaleString(BCP47_BY_LOCALE[locale]);
}

/** Thousands-grouped integer count (e.g. gear/warning counts), per locale. */
export function formatCount(count: number, locale: AppLocale): string {
  return Math.round(count).toLocaleString(BCP47_BY_LOCALE[locale]);
}

/**
 * A hero's energy as a whole percentage, FLOORED rather than rounded: only a hero at exactly full
 * energy may read 100%. A hero at 99.6% is still waiting, and "100%" beside one that has not left
 * for the field is the reading this bar exists to prevent.
 *
 * The epsilon is load-bearing, not defensive. `energyFractionOf` derives the fraction as
 * `energy / energyMax`, and an exact hundredth does not survive the multiply: `0.29 * 100` is
 * `28.999999999999996`, which floors to 28. Without it, 29%, 57% and 58% each render a point low.
 */
const FLOOR_EPSILON = 1e-9;

export function energyPercent(fraction: number): number {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return Math.floor(clamped * 100 + FLOOR_EPSILON);
}

export function formatEnergyPercent(fraction: number, locale: AppLocale): string {
  return new Intl.NumberFormat(BCP47_BY_LOCALE[locale], {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(energyPercent(fraction) / 100);
}
