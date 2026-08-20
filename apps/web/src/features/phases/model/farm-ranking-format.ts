/**
 * Rate / duration / sign / label formatting for the Farm Ranking board — PURE, no React, no
 * math. Wraps the shipped `format-number.ts` and `phases-page.ts`'s `formatClearTime`; composes
 * the phase label from the shipped `formatPhaseCoord`.
 * Does not re-implement anything `@bombfarm/domain` already computed — comparison, slicing and
 * string composition only.
 */
import { formatPhaseCoord } from '@bombfarm/domain/phase-wiki';
import type { Lang } from '@/shared/i18n';
import { formatCompactNumber, formatNumber } from '@/shared/lib/format-number';

/** A non-negative rate (gold/hr, chests/hr, gems/hr, time-pieces/hr, xp/hr). */
export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return formatCompactNumber(value, 1);
}

/**
 * Keys/hr is SIGNED: `>= 0` a gain on non-gate rows, `<= 0` a cost on gate rows.
 * The sign is rendered as text — never colour alone. `+`/`-` prefix plus the magnitude.
 */
export function formatSignedRate(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatCompactNumber(Math.abs(value), 1)}`;
}

/**
 * The Farm Ranking table's own cell variant: {@link formatRate} with a trailing `/h` — the
 * column headers no longer carry "/ hr" themselves, so each rate cell states its own unit. Not a
 * change to `formatRate` itself: `farm-respec-metrics.tsx` prints the same values as a
 * current-to-proposed delta ("X → Y"), a context where restating "/h" on every number reads as
 * noise rather than a unit. A non-finite value stays the bare em dash — no unit on "no data".
 */
export function formatRatePerHour(value: number): string {
  const formatted = formatRate(value);
  return formatted === '—' ? formatted : `${formatted}/h`;
}

/** {@link formatSignedRate} with the same trailing `/h` as {@link formatRatePerHour}, for the
 *  signed keys/hr column — the suffix follows the magnitude, after the sign. */
export function formatSignedRatePerHour(value: number): string {
  const formatted = formatSignedRate(value);
  return formatted === '—' ? formatted : `${formatted}/h`;
}

/**
 * Mitigation percent — one decimal, plain number. No `%` sign here: this same formatter also
 * renders `expectedHtk`, a hit count, at the one-shot tooltip's call site — the `%` belongs to
 * whichever call site is actually printing a percentage (the mitigation cell).
 */
export function formatMitigationPct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return formatNumber(value, 1);
}

/** The item-level drop band — `@bombfarm/domain`'s own `itemLevelLabel` is already display-ready; passthrough. */
export function formatBand(itemLevelLabel: string): string {
  return itemLevelLabel === '' ? '—' : itemLevelLabel;
}

export function formatOneShot(oneShot: boolean, labels: { yes: string; no: string }): string {
  return oneShot ? labels.yes : labels.no;
}

/**
 * Composes the phase label from the shipped `formatPhaseCoord`, e.g. `Normal 1-1 (#51)` — the
 * in-game difficulty + map coordinate, not the wiki flavour name `phase-fact-items.tsx`'s
 * `mapName` shows. `@bombfarm/domain`'s own `formatPhaseLabel` renders the phase number without
 * the `#` (`Hard 1-1 (151)`); this wraps the same `formatPhaseCoord` rather than that helper so
 * the board can keep the `#`.
 */
export function formatPhaseLabel(phase: number, lang: Lang): string {
  return `${formatPhaseCoord(phase, lang)} (#${phase})`;
}
