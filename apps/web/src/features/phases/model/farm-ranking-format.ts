/**
 * Rate / duration / sign / label formatting for the Farm Ranking board — PURE, no React, no
 * math. Wraps the shipped `format-number.ts` and `phases-page.ts`'s `formatClearTime`; composes
 * the phase label from the shipped `formatPhaseCoord` / `phaseMapDisplayName` (`ASM-C16`,
 * `R-C29`). Does not re-implement anything item B already computed — comparison, slicing and
 * string composition only.
 */
import { phaseMapDisplayName } from '@bombfarm/domain/phase-wiki';
import type { Lang } from '@/shared/i18n';
import { formatCompactNumber, formatNumber } from '@/shared/lib/format-number';

/** A non-negative rate (gold/hr, chests/hr, gems/hr, time-pieces/hr, xp/hr). */
export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return formatCompactNumber(value, 1);
}

/**
 * Keys/hr is SIGNED: `>= 0` a gain on non-gate rows, `<= 0` a cost on gate rows (`AD-PFR-08`).
 * The sign is rendered as text — never colour alone. `+`/`-` prefix plus the magnitude.
 */
export function formatSignedRate(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatCompactNumber(Math.abs(value), 1)}`;
}

/** Mitigation percent — one decimal, plain number (the `%` sign is the column header's job). */
export function formatMitigationPct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return formatNumber(value, 1);
}

/** The item-level drop band — B's own `itemLevelLabel` is already display-ready; passthrough. */
export function formatBand(itemLevelLabel: string): string {
  return itemLevelLabel === '' ? '—' : itemLevelLabel;
}

export function formatOneShot(oneShot: boolean, labels: { yes: string; no: string }): string {
  return oneShot ? labels.yes : labels.no;
}

/**
 * Composes the phase label from the shipped `phaseMapDisplayName` — the same helper
 * `phase-fact-items.tsx`'s `mapName` already uses to produce `First Strike · #1`, so the board
 * and the existing explorer/picker cannot drift (`ASM-C16`).
 */
export function formatPhaseLabel(phase: number, lang: Lang): string {
  return `${phaseMapDisplayName(phase, lang)} · #${phase}`;
}
