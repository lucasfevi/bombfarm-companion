import type { CollectionSetRow } from '@bombfarm/domain/model';
import type { CollectionFilters } from './collection-filters';

export type BookSortKey = 'level' | 'now' | 'remaining' | 'pieces' | 'ready';

export interface BookSort {
  readonly key: BookSortKey;
  readonly direction: 'asc' | 'desc';
}

/** Lowest-level book first: the order the game lists the sets in. */
export const DEFAULT_BOOK_SORT: BookSort = { key: 'level', direction: 'asc' };

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function nowOf(book: CollectionSetRow): number {
  return sum(book.effects.map((effect) => effect.now));
}

export function remainingOf(book: CollectionSetRow): number {
  return sum(book.effects.map((effect) => effect.remaining));
}

export function readyGainOf(book: CollectionSetRow): number {
  return sum(book.effects.map((effect) => effect.readyGain));
}

export function filterBooks(books: readonly CollectionSetRow[], filters: CollectionFilters): CollectionSetRow[] {
  return books.filter(
    (book) =>
      (filters.axis === 'all' || book.effects.some((effect) => effect.axis === filters.axis)) &&
      (filters.status === 'all' || book.status === filters.status) &&
      (!filters.readyOnly || book.readyInBag > 0),
  );
}

/** How many books hold a piece the bag could add — the figure beside the bag switch. */
export function booksReadyCount(books: readonly CollectionSetRow[]): number {
  return books.filter((book) => book.readyInBag > 0).length;
}

/** A second press on the sorted column flips it; a new column opens lowest level first and every
 *  figure highest first. */
export function nextBookSort(sort: BookSort, key: BookSortKey): BookSort {
  if (sort.key === key) return { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
  return { key, direction: key === 'level' ? 'asc' : 'desc' };
}

function compareOn(left: CollectionSetRow, right: CollectionSetRow, key: BookSortKey): number {
  switch (key) {
    case 'level':
      return left.level - right.level;
    case 'now':
      return nowOf(left) - nowOf(right);
    case 'remaining':
      return remainingOf(left) - remainingOf(right);
    case 'pieces':
      return left.piecesSacrificed - right.piecesSacrificed;
    case 'ready':
      return left.readyInBag - right.readyInBag || readyGainOf(left) - readyGainOf(right);
  }
}

/** Ties fall to the lower level, whichever way the column runs, so equal books keep the game's order. */
export function sortBooks(books: readonly CollectionSetRow[], sort: BookSort): CollectionSetRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...books].sort((left, right) => sign * compareOn(left, right, sort.key) || left.level - right.level);
}

/** A second selection of the open book closes it. */
export function toggleSelection(current: string | null, code: string): string | null {
  return current === code ? null : code;
}

/** The weapon piece stands in for the whole set's art; the catalog names it `<set>_arma`. */
export function weaponDefId(book: CollectionSetRow): string {
  return book.pieces.find((piece) => piece.slot === 0)?.defId ?? `${book.code}_arma`;
}

export type PageFill = 'empty' | 'partial' | 'full';

export function pageFill(pieces: number, capacity: number): PageFill {
  if (pieces <= 0) return 'empty';
  return pieces >= capacity ? 'full' : 'partial';
}
