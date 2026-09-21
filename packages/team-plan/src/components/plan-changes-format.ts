/**
 * How a tree-axis figure reads in the ledger — the same signed, rounded style the Skill Tree tab
 * uses for its own totals, not the raw float the account stores. `treeDanoTotal`/`treeXpMult` are
 * multipliers on the underlying stat; every other axis is already a percentage-point figure (the
 * account stores `crit_chance_add × 100`, not the fraction), so it prints with a `%` and no second
 * multiply.
 */
import { formatNumber, type Lang } from '@bombfarm/ui';
import type { TreeAxis } from '../core/plan-changes';

const MINUS_SIGN = '−';

function signed(magnitude: string, value: number): string {
  return `${value < 0 ? MINUS_SIGN : '+'}${magnitude}`;
}

/** A tree axis already expressed in percentage points: `33.4076577825` → `+33.41%`. */
export function treeAxisPercent(value: number, lang: Lang): string {
  return signed(`${formatNumber(Math.abs(value), lang, 2)}%`, value);
}

/** A tree axis expressed as a raw multiplier: `1.234567` → `×1.235`, trailing zeros dropped. */
export function treeAxisMultiplier(value: number, lang: Lang): string {
  return `×${formatNumber(value, lang, 3).replace(/([.,]\d*?)0+$/, '$1').replace(/[.,]$/, '')}`;
}

const MULTIPLIER_AXES: ReadonlySet<TreeAxis> = new Set(['treeDanoTotal', 'treeXpMult']);

/** Which of the two shapes above a given axis reads as. */
export function formatTreeAxisValue(axis: TreeAxis, value: number, lang: Lang): string {
  return MULTIPLIER_AXES.has(axis) ? treeAxisMultiplier(value, lang) : treeAxisPercent(value, lang);
}
