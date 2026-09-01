/**
 * Number formatting for the Farm Respec Advisor — PURE, no React, no rate math. Wraps
 * `@bombfarm/ui`'s `formatNumber` exactly the way `farm-ranking-format.ts` does: every function
 * returns a bare number string (no unit, no sign of the ranking board's own kind of glyph), so
 * the surrounding `t.*` string supplies the unit and any surrounding words. Locale-independent
 * digit formatting (`,`/`.`) is `formatNumber`'s own deliberate choice, kept here unchanged.
 */
import { formatNumber } from '@bombfarm/ui';
import type { Lang } from '../copy';

/** A percent gain, one decimal — e.g. `12.8`. */
export function formatGainPct(value: number, lang: Lang): string {
  if (!Number.isFinite(value)) return '—';
  return formatNumber(value, lang, 1);
}

/** A gold amount, whole numbers only (in-game gold has no fractional unit). */
export function formatGold(value: number, lang: Lang): string {
  if (!Number.isFinite(value)) return '—';
  return formatNumber(value, lang, 0);
}

/** A duration in hours, one decimal. */
export function formatHours(value: number, lang: Lang): string {
  if (!Number.isFinite(value)) return '—';
  return formatNumber(value, lang, 1);
}

/** A signed percent change, one decimal — `+12.8`, `-5.3`, or `0.0` (no sign on zero). */
export function formatSignedPct(value: number, lang: Lang): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatNumber(Math.abs(value), lang, 1)}`;
}
