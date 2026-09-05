/**
 * Rate / duration / sign / label formatting for the Farm Ranking board — PURE, no React, no
 * math. Wraps `@bombfarm/ui`'s number formatters and `@bombfarm/hero/model`'s `formatClearTime`,
 * and re-exports the shared phase label.
 * Does not re-implement anything `@bombfarm/domain` already computed — comparison, slicing and
 * string composition only.
 */
import { formatCompactNumber, formatNumber } from '@bombfarm/ui';
import type { Lang } from '@bombfarm/hero/copy';

/** A non-negative rate (gold/hr, chests/hr, gems/hr, time-pieces/hr, xp/hr). */
export function formatRate(value: number, lang: Lang): string {
  if (!Number.isFinite(value)) return '—';
  return formatCompactNumber(value, lang, 1);
}

/**
 * Keys/hr is SIGNED: `>= 0` a gain on non-gate rows, `<= 0` a cost on gate rows.
 * The sign is rendered as text — never colour alone. `+`/`-` prefix plus the magnitude.
 */
export function formatSignedRate(value: number, lang: Lang): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatCompactNumber(Math.abs(value), lang, 1)}`;
}

/**
 * The Farm Ranking table's own cell variant: {@link formatRate} with a trailing `/h` — the
 * column headers no longer carry "/ hr" themselves, so each rate cell states its own unit. Not a
 * change to `formatRate` itself: `farm-respec-metrics.tsx` prints the same values as a
 * current-to-proposed delta ("X → Y"), a context where restating "/h" on every number reads as
 * noise rather than a unit. A non-finite value stays the bare em dash — no unit on "no data".
 */
export function formatRatePerHour(value: number, lang: Lang): string {
  const formatted = formatRate(value, lang);
  return formatted === '—' ? formatted : `${formatted}/h`;
}

/** {@link formatSignedRate} with the same trailing `/h` as {@link formatRatePerHour}, for the
 *  signed keys/hr column — the suffix follows the magnitude, after the sign. */
export function formatSignedRatePerHour(value: number, lang: Lang): string {
  const formatted = formatSignedRate(value, lang);
  return formatted === '—' ? formatted : `${formatted}/h`;
}

/**
 * Mitigation percent — one decimal, plain number. No `%` sign here: this same formatter also
 * renders `expectedHtk`, a hit count, at the one-shot tooltip's call site — the `%` belongs to
 * whichever call site is actually printing a percentage (the mitigation cell).
 */
export function formatMitigationPct(value: number, lang: Lang): string {
  if (!Number.isFinite(value)) return '—';
  return formatNumber(value, lang, 1);
}

/** The item-level drop band — `@bombfarm/domain`'s own `itemLevelLabel` is already display-ready; passthrough. */
export function formatBand(itemLevelLabel: string): string {
  return itemLevelLabel === '' ? '—' : itemLevelLabel;
}

export function formatOneShot(oneShot: boolean, labels: { yes: string; no: string }): string {
  return oneShot ? labels.yes : labels.no;
}

/**
 * Re-exported, not defined here: the host app's Account page prints the same label, so the
 * definition sits in its own module and is reachable from this package's root. Kept as a
 * re-export so this module stays the board's one import surface for its formatters.
 */
export { formatPhaseLabel } from './phase-label';
