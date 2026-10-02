import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCollectionBoard, type CollectionBagItem, type CollectionBoard } from '@bombfarm/domain/model';
import { initialCollectionFilters, type CollectionFilters } from '../../lib/collections/collection-filters';
import { collectionsSnapshotFixture } from '../../lib/collections/collections-test-fixture';
import type { CollectionFiltersHandle } from '../../lib/collections/use-collection-filters';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';

const language = vi.hoisted((): { current: 'en' | 'pt-BR' } => ({ current: 'en' }));

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return {
    ...actual,
    useCopy: () => actual.STRINGS[language.current],
    useLocale: () => ({
      locale: language.current,
      lang: language.current === 'en' ? 'en' : 'pt',
      bcp47: language.current === 'en' ? 'en-US' : 'pt-BR',
    }),
  };
});

const { BooksPanel } = await import('./books-panel');

const BAG: readonly CollectionBagItem[] = [
  { defId: 'gold_elmo', rarity: 3, free: true },
  { defId: 'gold_peito', rarity: 3, free: true },
];
const bareBoard = buildCollectionBoard(collectionsSnapshotFixture());
const bagBoard = buildCollectionBoard(collectionsSnapshotFixture(), BAG);

function handle(overrides: Partial<CollectionFilters> = {}): CollectionFiltersHandle {
  const nothing = () => undefined;
  return {
    ...initialCollectionFilters,
    ...overrides,
    setAxis: nothing,
    toggleAxis: nothing,
    setStatus: nothing,
    setReadyOnly: nothing,
    clear: nothing,
  };
}

function render(
  options: {
    board?: CollectionBoard;
    filters?: Partial<CollectionFilters>;
    bagAvailable?: boolean;
    selectedCode?: string | null;
    locale?: 'en' | 'pt-BR';
  } = {},
): string {
  language.current = options.locale ?? 'en';
  return renderToStaticMarkup(
    createElement(BooksPanel, {
      board: options.board ?? bareBoard,
      filters: handle(options.filters),
      bagAvailable: options.bagAvailable ?? false,
      selectedCode: options.selectedCode ?? null,
      onSelect: () => undefined,
    }),
  );
}

function rows(html: string): string[] {
  return html.match(/<tr [^>]*data-testid="collections-book-row"[\s\S]*?<\/tr>/g) ?? [];
}

function rowOf(html: string, code: string): string {
  const found = rows(html).find((row) => row.includes(`data-set="${code}"`));
  expect(found).toBeDefined();
  return found ?? '';
}

function codesOf(html: string): string[] {
  return rows(html).map((row) => /data-set="(\w+)"/.exec(row)?.[1] ?? '');
}

function cellOf(row: string, testId: string): string {
  return text(new RegExp(String.raw`<td[^>]*data-testid="${testId}"[\s\S]*?</td>`).exec(row)?.[0] ?? '');
}

function text(fragment: string): string {
  return fragment.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('BooksPanel', () => {
  it('draws one row per book, lowest level first, and counts them', () => {
    const html = render();
    const codes = codesOf(html);
    expect(codes).toHaveLength(30);
    expect(codes.slice(0, 3)).toEqual(['ember', 'gold', 'coal']);
    expect(codes.at(-1)).toBe('void');
    expect(html).toContain('data-testid="collections-books-count">30 of 30<');
  });

  it('prints a book’s name, level, bonus, what it grants now, at most and still to gain', () => {
    const gold = rowOf(render(), 'gold');
    expect(text(gold)).toContain('Gold');
    expect(text(gold)).toContain('Lv 20');
    expect(cellOf(gold, 'collections-book-bonus')).toBe('Gold');
    expect(cellOf(gold, 'collections-book-now')).toBe('+7.74%');
    expect(cellOf(gold, 'collections-book-max')).toBe('+26%');
    expect(cellOf(gold, 'collections-book-left')).toBe('+18.26%');
  });

  it('draws the book’s weapon at common rarity as its icon', () => {
    expect(rowOf(render(), 'ember')).toContain('/items/lvl10_weapon_ember.png');
    expect(rowOf(render(), 'ember')).toContain('slot_background_common');
  });

  it('draws the three-effect book with three bonuses, three figures to each column', () => {
    const voidRow = rowOf(render(), 'void');
    expect(cellOf(voidRow, 'collections-book-bonus')).toBe('Damage Critical damage Cooldown');
    expect(cellOf(voidRow, 'collections-book-now')).toBe('+1.53% +2.31% +1.17%');
    expect(cellOf(voidRow, 'collections-book-max')).toBe('+9.4% +14.1% +7%');
  });

  it('draws six page cells per book with each page’s pieces, full pages and empty pages told apart', () => {
    const gold = rowOf(render(), 'gold');
    const cells = gold.match(/<span[^>]*data-testid="collections-page-cell"[^>]*>/g) ?? [];
    expect(cells).toHaveLength(6);
    expect(cells.map((cell) => /data-fill="(\w+)"/.exec(cell)?.[1])).toEqual(['full', 'full', 'partial', 'empty', 'empty', 'empty']);
    expect(cells.map((cell) => /data-pieces="(\d)"/.exec(cell)?.[1])).toEqual(['8', '8', '5', '0', '0', '0']);
    expect(text(gold)).toContain('8/8 8/8 5/8 0/8 0/8 0/8');
  });

  it('colours each page by its rarity and names each page for a screen reader', () => {
    const gold = rowOf(render(), 'gold');
    for (const rarity of [0, 1, 2]) expect(gold).toContain(`text-rar-${String(rarity)}`);
    expect(gold).not.toMatch(/text-rar-[345]/);
    expect(gold).toContain('aria-label="Common page: 8 of 8 pieces"');
    expect(gold).toContain('aria-label="Rare page: 5 of 8 pieces"');
  });

  it('prints pieces sacrificed over the book’s 48 with a bar', () => {
    const gold = rowOf(render(), 'gold');
    expect(cellOf(gold, 'collections-book-pieces')).toBe('21/48');
    expect(gold).toMatch(/style="width:\s*43\.75%"/);
  });

  it('draws an em dash in Ready when no bag was read, and for books with nothing ready', () => {
    const html = render();
    expect(html).not.toContain('data-testid="collections-ready"');
    expect(text(rowOf(html, 'gold'))).toContain('—');
  });

  it('draws a chip with the ready count and the gain it would add when the bag holds pieces', () => {
    const gold = rowOf(render({ board: bagBoard, bagAvailable: true }), 'gold');
    const ready = text(/<span [^>]*data-testid="collections-ready"[\s\S]*?<\/span><\/span>/.exec(gold)?.[0] ?? '');
    expect(ready).toMatch(/^2 in bag \+\d+(\.\d+)?%$/);
  });

  it('marks the selected row and no other, and makes every row reachable by keyboard', () => {
    const html = render({ selectedCode: 'gold' });
    expect(rowOf(html, 'gold')).toContain('aria-selected="true"');
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/aria-selected="false"/g)).toHaveLength(29);
    expect(rows(html).every((row) => row.includes('tabindex="0"'))).toBe(true);
  });

  it('offers the sort on book, now, left, pieces and ready, with the level column ascending to start', () => {
    const html = render();
    const headers = html.match(/<th [^>]*aria-sort="(\w+)"/g) ?? [];
    expect(headers.map((header) => /aria-sort="(\w+)"/.exec(header)?.[1])).toEqual(['ascending', 'none', 'none', 'none', 'none']);
    for (const label of [en.collectionsColumnBook, en.collectionsColumnNow, en.collectionsColumnLeft, en.collectionsColumnPieces, en.collectionsColumnReady]) {
      expect(html).toMatch(new RegExp(`<button[^>]*><span>${label}</span>`));
    }
  });

  it('keeps only the books that grant the chosen bonus', () => {
    const html = render({ filters: { axis: 'gold' } });
    expect(codesOf(html)).toEqual(['gold', 'desert', 'silver']);
    expect(html).toContain('data-testid="collections-books-count">3 of 30<');
  });

  it('keeps only the books in the chosen progress state', () => {
    expect(codesOf(render({ filters: { status: 'complete' } }))).toEqual(['ember', 'steel']);
  });

  it('keeps only the books with pieces ready when the switch is on and the bag was read', () => {
    expect(codesOf(render({ board: bagBoard, bagAvailable: true, filters: { readyOnly: true } }))).toEqual(['gold']);
  });

  it('ignores the ready switch when no bag was read, rather than emptying the list', () => {
    expect(codesOf(render({ bagAvailable: false, filters: { readyOnly: true } }))).toHaveLength(30);
  });

  it('draws the ready switch with its book count, and disabled when the bag is unavailable', () => {
    const available = render({ board: bagBoard, bagAvailable: true });
    expect(available).toContain('data-available="true"');
    expect(available).toMatch(/data-testid="collections-ready-count">1</);
    const unavailable = render();
    expect(unavailable).toContain('data-available="false"');
    expect(unavailable).not.toContain('data-testid="collections-ready-count"');
    expect(unavailable).toMatch(/role="switch"[^>]*disabled=""|disabled=""[^>]*role="switch"/);
  });

  it('reflects the filters in the toolbar controls', () => {
    const html = render({ filters: { status: 'started' } });
    expect(html).toMatch(new RegExp(`aria-pressed="true"[^>]*>${en.collectionsStatusStarted}<`));
    expect(html).toContain(`aria-label="${en.collectionsFilterBonusLabel}"`);
  });

  it('shows an empty state with a way back when the filters match no book', () => {
    const html = render({ filters: { axis: 'luck', status: 'complete' } });
    expect(html).toContain('data-state="no-match"');
    expect(html).toContain(en.collectionsNoMatchTitle);
    expect(html).toContain('data-testid="collections-clear-filters"');
    expect(html).toContain(en.collectionsClearFilters);
    expect(rows(html)).toHaveLength(0);
  });

  it('renders in Portuguese with the game’s own words', () => {
    const html = render({ locale: 'pt-BR', board: bagBoard, bagAvailable: true });
    expect(html).toContain(ptBR.collectionsBooksTitle);
    expect(html).toContain(ptBR.collectionsStatusStarted);
    expect(html).toContain(ptBR.collectionsFilterReady);
    expect(text(rowOf(html, 'gold'))).toContain('2 na mochila');
    expect(text(rowOf(html, 'gold'))).toContain('+7,74%');
    expect(rowOf(html, 'gold')).toContain('aria-label="Página Comum: 8 de 8 peças"');
  });
});
