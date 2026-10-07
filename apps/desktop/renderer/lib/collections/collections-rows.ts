import type { CollectionSetRow } from '@bombfarm/domain/model';
import type { CollectionBonusFilter, CollectionFilters } from './collection-filters';

export type BookSortKey = 'level' | 'now' | 'remaining' | 'pieces' | 'ready';

export interface BookSort {
  readonly key: BookSortKey;
  readonly direction: 'asc' | 'desc';
}

/** Lowest-level book first: the order the game lists the sets in. */
export const DEFAULT_BOOK_SORT: BookSort = { key: 'level', direction: 'asc' };

type EffectRow = CollectionSetRow['effects'][number];

/** One book's figure for a column. With a bonus filter set it is that bonus's effect alone; with
 *  none it is the book's largest single effect — percentages on different axes are not summed,
 *  since a point of gold and a point of experience are not the same thing. */
function figureOf(book: CollectionSetRow, read: (effect: EffectRow) => number, axis: CollectionBonusFilter): number {
  const effects = axis === 'all' ? book.effects : book.effects.filter((effect) => effect.axis === axis);
  return effects.reduce((largest, effect) => Math.max(largest, read(effect)), 0);
}

export function filterBooks(books: readonly CollectionSetRow[], filters: CollectionFilters): CollectionSetRow[] {
  return books.filter(
    (book) =>
      (filters.axis === 'all' || book.effects.some((effect) => effect.axis === filters.axis)) &&
      (filters.status === 'all' || book.status === filters.status) &&
      (!filters.readyOnly || book.readyInBag > 0),
  );
}

export function booksReadyCount(books: readonly CollectionSetRow[]): number {
  return books.filter((book) => book.readyInBag > 0).length;
}

/** A second press on the sorted column flips it; a new column opens lowest level first and every
 *  figure highest first. */
export function nextBookSort(sort: BookSort, key: BookSortKey): BookSort {
  if (sort.key === key) return { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
  return { key, direction: key === 'level' ? 'asc' : 'desc' };
}

function compareOn(left: CollectionSetRow, right: CollectionSetRow, key: BookSortKey, axis: CollectionBonusFilter): number {
  switch (key) {
    case 'level':
      return left.level - right.level;
    case 'now':
      return figureOf(left, (effect) => effect.now, axis) - figureOf(right, (effect) => effect.now, axis);
    case 'remaining':
      return figureOf(left, (effect) => effect.remaining, axis) - figureOf(right, (effect) => effect.remaining, axis);
    case 'pieces':
      return left.piecesSacrificed - right.piecesSacrificed;
    case 'ready':
      return (
        left.readyInBag - right.readyInBag ||
        figureOf(left, (effect) => effect.readyGain, axis) - figureOf(right, (effect) => effect.readyGain, axis)
      );
  }
}

/** Ties fall to the lower level, whichever way the column runs, so equal books keep the game's order. */
export function sortBooks(
  books: readonly CollectionSetRow[],
  sort: BookSort,
  axis: CollectionBonusFilter = 'all',
): CollectionSetRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...books].sort((left, right) => sign * compareOn(left, right, sort.key, axis) || left.level - right.level);
}

export interface BookSelection {
  readonly open: string | null;
  /** The book whose button should take focus back, when closing a book hands it back. */
  readonly restoreFocusTo: string | null;
}

/** Pressing the open book's button closes it and hands focus back to that button; pressing another opens it. */
export function pressBook(open: string | null, pressed: string): BookSelection {
  return open === pressed ? { open: null, restoreFocusTo: pressed } : { open: pressed, restoreFocusTo: null };
}

export function closeBook(open: string | null): BookSelection {
  return { open: null, restoreFocusTo: open };
}

/** The open book, or none when a filter hides it or the board no longer has it. */
export function visibleSelection(selected: string | null, shown: readonly CollectionSetRow[]): string | null {
  return selected !== null && shown.some((book) => book.code === selected) ? selected : null;
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
