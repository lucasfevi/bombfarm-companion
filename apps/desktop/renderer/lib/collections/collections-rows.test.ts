import { describe, expect, it } from 'vitest';
import { buildCollectionBoard, type CollectionBagItem, type CollectionSetRow } from '@bombfarm/domain/model';
import { initialCollectionFilters } from './collection-filters';
import {
  booksReadyCount,
  DEFAULT_BOOK_SORT,
  filterBooks,
  closeBook,
  nextBookSort,
  pageFill,
  pressBook,
  sortBooks,
  visibleSelection,
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
    expect(sorted[0]?.effects[0]?.now).toBeCloseTo(15.1, 5);
  });

  it('puts the book with the most still to gain first when sorting on what is left, descending', () => {
    const sorted = sortBooks(books, { key: 'remaining', direction: 'desc' });
    const firstLeft = Math.max(...defined(sorted[0], 'a book').effects.map((effect) => effect.remaining));
    const secondLeft = Math.max(...defined(sorted[1], 'a second book').effects.map((effect) => effect.remaining));
    expect(firstLeft).toBeGreaterThanOrEqual(secondLeft);
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
    expect(defined(sorted[0], 'a book').effects[0]?.readyGain).toBeGreaterThan(0);
  });

  it('does not touch the list it was given', () => {
    const before = codes(books);
    sortBooks(books, { key: 'now', direction: 'desc' });
    expect(codes(books)).toEqual(before);
  });
});

function twoAxisBook(code: string, level: number, figures: Record<string, number>): CollectionSetRow {
  const effects = Object.entries(figures).map(([axis, now]) => ({
    axis: axis as CollectionSetRow['effects'][number]['axis'],
    now,
    max: 50,
    remaining: 50 - now,
    readyGain: now / 10,
  }));
  return { ...bookOf('gold'), code, level, effects, readyInBag: 1 };
}

describe('sortBooks across axes', () => {
  const mixed = twoAxisBook('mixed', 10, { gold: 5, xp: 10 });
  const plain = twoAxisBook('plain', 20, { gold: 8 });

  it('never adds percentages of different axes: with no bonus filter a book ranks by its largest single effect', () => {
    expect(codes(sortBooks([plain, mixed], { key: 'now', direction: 'desc' }))).toEqual(['mixed', 'plain']);
    const sumWouldWin = twoAxisBook('sum', 30, { gold: 4, xp: 4, luck: 4 });
    expect(codes(sortBooks([sumWouldWin, plain], { key: 'now', direction: 'desc' }))).toEqual(['plain', 'sum']);
  });

  it('ranks by the filtered bonus alone when a bonus filter is set', () => {
    expect(codes(sortBooks([mixed, plain], { key: 'now', direction: 'desc' }, 'gold'))).toEqual(['plain', 'mixed']);
    expect(codes(sortBooks([mixed, plain], { key: 'now', direction: 'desc' }, 'xp'))).toEqual(['mixed', 'plain']);
  });

  it('applies the same rule to what is left and to the gain from the bag', () => {
    expect(codes(sortBooks([mixed, plain], { key: 'remaining', direction: 'desc' }, 'gold'))).toEqual(['mixed', 'plain']);
    const gainOnly = (book: CollectionSetRow) => ({ ...book, readyInBag: 1 });
    expect(codes(sortBooks([gainOnly(mixed), gainOnly(plain)], { key: 'ready', direction: 'desc' }, 'gold'))).toEqual(['plain', 'mixed']);
    expect(codes(sortBooks([gainOnly(mixed), gainOnly(plain)], { key: 'ready', direction: 'desc' }))).toEqual(['mixed', 'plain']);
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

describe('pressBook and closeBook', () => {
  it('opens a book and moves to another without handing focus back', () => {
    expect(pressBook(null, 'gold')).toEqual({ open: 'gold', restoreFocusTo: null });
    expect(pressBook('gold', 'coal')).toEqual({ open: 'coal', restoreFocusTo: null });
  });

  it('closes the open book when its button is pressed again and returns focus to that button', () => {
    expect(pressBook('gold', 'gold')).toEqual({ open: null, restoreFocusTo: 'gold' });
  });

  it('returns focus to the open book’s button when the detail is closed', () => {
    expect(closeBook('gold')).toEqual({ open: null, restoreFocusTo: 'gold' });
    expect(closeBook(null)).toEqual({ open: null, restoreFocusTo: null });
  });
});

describe('visibleSelection', () => {
  it('keeps the open book while it is among those shown', () => {
    expect(visibleSelection('gold', books)).toBe('gold');
  });

  it('drops the open book when a filter hides it', () => {
    const shown = filterBooks(books, { ...initialCollectionFilters, axis: 'luck' });
    expect(visibleSelection('gold', shown)).toBeNull();
    expect(visibleSelection('autumn', shown)).toBe('autumn');
  });

  it('drops a book the board no longer has, and has nothing to keep when nothing is open', () => {
    expect(visibleSelection('retired', books)).toBeNull();
    expect(visibleSelection(null, books)).toBeNull();
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
