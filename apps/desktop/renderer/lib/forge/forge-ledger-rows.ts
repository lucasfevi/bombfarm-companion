/**
 * The order of the ledger's table. Pure, no React import — the words two of the columns sort by
 * are the caller's, because only the caller has a locale.
 */
import type { ForgeHistoryRow } from '@bombfarm/contracts';

export type ForgeLedgerSortKey =
  | 'when'
  | 'item'
  | 'climb'
  | 'outcome'
  | 'rolls'
  | 'fails'
  | 'crits'
  | 'safeJumps'
  | 'spent'
  | 'duration';

export type ForgeLedgerSortDirection = 'asc' | 'desc';
export type ForgeLedgerSort = { readonly key: ForgeLedgerSortKey; readonly direction: ForgeLedgerSortDirection };

export const DEFAULT_FORGE_LEDGER_SORT: ForgeLedgerSort = { key: 'when', direction: 'desc' };

const TEXT_KEYS: ReadonlySet<ForgeLedgerSortKey> = new Set<ForgeLedgerSortKey>(['item', 'outcome']);

/** Re-picking the leading column flips it; a new column opens the way a reader expects — words
 *  smallest-first, numbers largest-first. */
export function nextForgeLedgerSort(sort: ForgeLedgerSort, key: ForgeLedgerSortKey): ForgeLedgerSort {
  if (sort.key === key) return { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
  return { key, direction: TEXT_KEYS.has(key) ? 'asc' : 'desc' };
}

/** The rows arrive newest first, so a row id is a clock the ledger can always read — including
 *  for a `finishedAt` an older build wrote in a shape `Date.parse` cannot take. */
function whenOf(row: ForgeHistoryRow): number {
  const parsed = Date.parse(row.finishedAt);
  return Number.isFinite(parsed) ? parsed : row.id;
}

function numberOf(row: ForgeHistoryRow, key: ForgeLedgerSortKey): number {
  switch (key) {
    case 'when':
      return whenOf(row);
    case 'climb':
      return row.toUpgrade;
    case 'rolls':
      return row.rolls;
    case 'fails':
      return row.fails;
    case 'crits':
      return row.crits;
    case 'safeJumps':
      return row.safeJumps;
    case 'spent':
      return row.spent;
    case 'duration':
      return row.durationMs;
    case 'item':
    case 'outcome':
      return 0;
  }
}

/** Equal rows keep the newest first and never reshuffle: the id descends whichever way the
 *  column is pointing. */
function tieBreak(a: ForgeHistoryRow, b: ForgeHistoryRow): number {
  return b.id - a.id;
}

export function sortForgeLedgerRows(
  rows: readonly ForgeHistoryRow[],
  sort: ForgeLedgerSort,
  itemNameOf: (row: ForgeHistoryRow) => string,
  outcomeNameOf: (row: ForgeHistoryRow) => string,
): ForgeHistoryRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const compare = (a: ForgeHistoryRow, b: ForgeHistoryRow): number => {
    if (TEXT_KEYS.has(sort.key)) {
      const text = sort.key === 'item' ? itemNameOf : outcomeNameOf;
      return sign * text(a).localeCompare(text(b)) || tieBreak(a, b);
    }
    return sign * (numberOf(a, sort.key) - numberOf(b, sort.key)) || tieBreak(a, b);
  };
  return [...rows].sort(compare);
}
