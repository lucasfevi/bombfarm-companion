import { describe, expect, it } from 'vitest';
import { buildCollectionBoard, type CollectionBagItem } from '@bombfarm/domain/model';
import { initialCollectionFilters } from './collection-filters';
import {
  booksReadyCount,
  DEFAULT_BOOK_SORT,
  filterBooks,
  nextBookSort,
  nowOf,
  pageFill,
  readyGainOf,
  remainingOf,
  sortBooks,
  toggleSelection,
  weaponDefId,
} from './collections-rows';
import { collectionsSnapshotFixture, defined } from './collections-test-fixture';

const snapshot = collectionsSnapshotFixture();
const BAG: readonly CollectionBagItem[] = [
  { defId: 'gold_elmo', rarity: 3, free: true },
  { defId: 'gold_peito', rarity: 3, free: true },
  { defId: 'clay_peito', rarity: 0, free: true },
];
const board = buildCollectionBoard(snapshot, BAG);
const books = board.sets;
const codes = (list: readonly { code: string }[]) => list.map((book) => book.code);
const bookOf = (code: string) => defined(books.find((book) => book.code === code), code);

describe('filterBooks', () => {
  it('keeps all thirty books under the default filters', () => {
    expect(filterBooks(books, initialCollectionFilters)).toHaveLength(30);
  });

  it('keeps the books that grant the chosen bonus, the three-effect book among them', () => {
    const damage = filterBooks(books, { ...initialCollectionFilters, axis: 'damage' });
    expect(codes(damage)).toEqual(['ember', 'steel', 'toxic', 'sunfire', 'void']);
    const cooldown = filterBooks(books, { ...initialCollectionFilters, axis: 'cooldown' });
    expect(codes(cooldown)).toContain('void');
  });

  it('keeps only the books in the chosen progress state', () => {
    const complete = filterBooks(books, { ...initialCollectionFilters, status: 'complete' });
    expect(codes(complete)).toEqual(['ember', 'steel']);
    const untouched = filterBooks(books, { ...initialCollectionFilters, status: 'empty' });
    expect(untouched.every((book) => book.piecesSacrificed === 0)).toBe(true);
    const started = filterBooks(books, { ...initialCollectionFilters, status: 'started' });
    expect(started.some((book) => book.status === 'complete')).toBe(false);
    expect(started.length + complete.length + untouched.length).toBe(30);
  });

  it('keeps only the books with pieces ready in the bag when asked', () => {
    expect(codes(filterBooks(books, { ...initialCollectionFilters, readyOnly: true }))).toEqual(['gold', 'clay']);
  });

  it('combines the filters', () => {
    expect(codes(filterBooks(books, { axis: 'gold', status: 'started', readyOnly: true }))).toEqual(['gold']);
    expect(filterBooks(books, { axis: 'luck', status: 'all', readyOnly: true })).toEqual([]);
  });
});

describe('booksReadyCount', () => {
  it('counts books, not pieces', () => {
    expect(booksReadyCount(books)).toBe(2);
    expect(board.summary.readyInBag).toBeGreaterThan(2);
  });

  it('is zero with nothing in the bag', () => {
    expect(booksReadyCount(buildCollectionBoard(snapshot).sets)).toBe(0);
  });
});

describe('sortBooks', () => {
  it('lists the lowest level first by default', () => {
    expect(DEFAULT_BOOK_SORT).toEqual({ key: 'level', direction: 'asc' });
    const levels = sortBooks(books, DEFAULT_BOOK_SORT).map((book) => book.level);
    expect(levels).toEqual([...levels].sort((left, right) => left - right));
  });

  it('puts the book granting the most now first when sorting on now, descending', () => {
    const sorted = sortBooks(books, { key: 'now', direction: 'desc' });
    expect(sorted[0]?.code).toBe('steel');
    expect(nowOf(defined(sorted[0], 'a book'))).toBeCloseTo(15.1, 5);
  });

  it('sorts a multi-effect book by the sum of its effects', () => {
    const voidBook = bookOf('void');
    expect(nowOf(voidBook)).toBeCloseTo(1.53 + 2.31 + 1.17, 5);
    const sorted = sortBooks(books, { key: 'now', direction: 'desc' });
    const position = (code: string) => sorted.findIndex((book) => book.code === code);
    expect(position('void')).toBeLessThan(position('autumn'));
    expect(position('void')).toBeGreaterThan(position('ember'));
  });

  it('puts the book with the most still to gain first when sorting on what is left, descending', () => {
    const sorted = sortBooks(books, { key: 'remaining', direction: 'desc' });
    expect(remainingOf(defined(sorted[0], 'a book'))).toBeGreaterThanOrEqual(remainingOf(defined(sorted[1], 'a second book')));
    expect(sorted.at(-1)?.status).toBe('complete');
  });

  it('sorts on pieces sacrificed, and breaks a tie by the lower level', () => {
    const sorted = sortBooks(books, { key: 'pieces', direction: 'desc' });
    expect(sorted[0]?.code).toBe('ember');
    expect(sorted[1]?.code).toBe('steel');
    const untouched = sorted.filter((book) => book.piecesSacrificed === 0);
    expect(codes(untouched)).toEqual(codes(untouched).slice().sort((left, right) => {
      const level = (code: string) => bookOf(code).level;
      return level(left) - level(right);
    }));
  });

  it('sorts on pieces ready in the bag, then on the gain they would add', () => {
    const sorted = sortBooks(books, { key: 'ready', direction: 'desc' });
    expect(codes(sorted).slice(0, 2)).toEqual(['gold', 'clay']);
    expect(readyGainOf(defined(sorted[0], 'a book'))).toBeGreaterThan(0);
  });

  it('does not touch the list it was given', () => {
    const before = codes(books);
    sortBooks(books, { key: 'now', direction: 'desc' });
    expect(codes(books)).toEqual(before);
  });
});

describe('nextBookSort', () => {
  it('flips the sorted column on a second press', () => {
    expect(nextBookSort(DEFAULT_BOOK_SORT, 'level')).toEqual({ key: 'level', direction: 'desc' });
    expect(nextBookSort({ key: 'now', direction: 'desc' }, 'now')).toEqual({ key: 'now', direction: 'asc' });
  });

  it('opens a new figure column highest first and the level column lowest first', () => {
    expect(nextBookSort(DEFAULT_BOOK_SORT, 'remaining')).toEqual({ key: 'remaining', direction: 'desc' });
    expect(nextBookSort({ key: 'now', direction: 'desc' }, 'level')).toEqual({ key: 'level', direction: 'asc' });
  });
});

describe('toggleSelection', () => {
  it('opens a book, moves to another, and closes the open one when it is chosen again', () => {
    expect(toggleSelection(null, 'gold')).toBe('gold');
    expect(toggleSelection('gold', 'coal')).toBe('coal');
    expect(toggleSelection('gold', 'gold')).toBeNull();
  });
});

describe('weaponDefId', () => {
  it('takes the id from the book’s first slot', () => {
    expect(weaponDefId(bookOf('ember'))).toBe('ember_arma');
  });

  it('falls back to the catalog’s naming when the read carried no pieces for the set', () => {
    const bare = { ...bookOf('gold'), pieces: [] };
    expect(weaponDefId(bare)).toBe('gold_arma');
  });
});

describe('pageFill', () => {
  it('tells an untouched page from a partial one and from a full one', () => {
    expect(pageFill(0, 8)).toBe('empty');
    expect(pageFill(5, 8)).toBe('partial');
    expect(pageFill(8, 8)).toBe('full');
  });
});
