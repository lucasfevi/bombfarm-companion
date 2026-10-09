import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCollectionBoard, type CollectionBagItem, type CollectionBoard } from '@bombfarm/domain/model';
import { effectiveFilters, initialCollectionFilters, type CollectionFilters } from '../../lib/collections/collection-filters';
import { filterBooks } from '../../lib/collections/collections-rows';
import { COLLECTION_AXIS_COLOUR } from '../../lib/collections/collections-axis-colour';
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
  const board = options.board ?? bareBoard;
  const filters = handle(options.filters);
  const bagAvailable = options.bagAvailable ?? false;
  return renderToStaticMarkup(
    createElement(BooksPanel, {
      board,
      books: filterBooks(board.sets, effectiveFilters(filters, bagAvailable)),
      filters,
      bagAvailable,
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

  it('draws the book’s weapon at its highest unbroken completed rarity', () => {
    expect(rowOf(render(), 'ember')).toContain('/items/lvl10_weapon_ember.png');
    expect(rowOf(render(), 'ember')).toContain('slot_background_mythic');
    expect(rowOf(render(), 'gold')).toContain('slot_background_uncommon');
  });

  it('draws the three-effect book with three bonuses, three figures to each column', () => {
    const voidRow = rowOf(render(), 'void');
    expect(cellOf(voidRow, 'collections-book-bonus')).toBe('Damage Critical damage Cooldown');
    expect(cellOf(voidRow, 'collections-book-now')).toBe('+1.53% +2.31% +1.17%');
    expect(cellOf(voidRow, 'collections-book-max')).toBe('+9.4% +14.1% +7%');
  });

  it('gives each effect exactly one line in Bonus, Now, Max and Left, in both languages', () => {
    for (const locale of ['en', 'pt-BR'] as const) {
      const voidRow = rowOf(render({ locale }), 'void');
      const lines = (testId: string) => (new RegExp(String.raw`<td[^>]*data-testid="${testId}"[\s\S]*?</td>`).exec(voidRow)?.[0].match(/<span (?:data-axis="\w+" style="[^"]*" )?class="(?:block truncate text-\[var\(--axis-colour\)\]|text-ink|text-muted)">/g) ?? []).length;
      expect([lines('collections-book-bonus'), lines('collections-book-now'), lines('collections-book-max'), lines('collections-book-left')]).toEqual([3, 3, 3, 3]);
    }
  });

  it('draws each bonus label in its own axis hue, as the tile does', () => {
    const cell = /<td[^>]*data-testid="collections-book-bonus"[\s\S]*?<\/td>/.exec(rowOf(render(), 'void'))?.[0] ?? '';
    const hues = [...cell.matchAll(/data-axis="(\w+)" style="--axis-colour:([^;"]+)/g)].map((match) => [match[1], match[2]]);
    expect(hues).toEqual([
      ['damage', COLLECTION_AXIS_COLOUR.damage],
      ['critDamage', COLLECTION_AXIS_COLOUR.critDamage],
      ['cooldown', COLLECTION_AXIS_COLOUR.cooldown],
    ]);
  });

  it('keeps the bonus labels on one line, truncated rather than wrapped, with the full name still in the cell', () => {
    const cell = /<td[^>]*data-testid="collections-book-bonus"[\s\S]*?<\/td>/.exec(rowOf(render(), 'void'))?.[0] ?? '';
    expect(cell).not.toContain('whitespace-normal');
    expect(cell.match(/class="block truncate text-\[var\(--axis-colour\)\]"/g)).toHaveLength(3);
    expect(text(cell)).toBe('Damage Critical damage Cooldown');
    expect(cell).toContain('leading-5');
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

  it('draws a dash in Ready for a book with nothing ready once the bag was read', () => {
    const html = render({ board: bagBoard, bagAvailable: true });
    expect(text(rowOf(html, 'ember'))).toContain('—');
    expect(html).not.toContain('data-testid="collections-ready-unknown"');
  });

  it('draws an unknown marker, not a dash, in every Ready cell while the bag has not been read', () => {
    const html = render();
    expect(html.match(/data-testid="collections-ready-unknown"/g)).toHaveLength(30);
    expect(html).not.toContain('data-testid="collections-ready"');
    expect(rowOf(html, 'gold')).not.toContain('—');
    expect(rowOf(html, 'gold')).toContain('aria-label="Needs your inventory, which has not been read yet."');
    expect(text(rowOf(html, 'gold'))).toContain('?');
  });

  it('draws a chip with the ready count and the gain it would add when the bag holds pieces', () => {
    const gold = rowOf(render({ board: bagBoard, bagAvailable: true }), 'gold');
    const ready = text(/<span [^>]*data-testid="collections-ready"[\s\S]*?<\/span><\/span>/.exec(gold)?.[0] ?? '');
    expect(ready).toMatch(/^2 in inventory \+\d+(\.\d+)?%$/);
  });

  it('makes each book’s button the one tab stop and the activation target, named for the set', () => {
    const html = render({ selectedCode: 'gold' });
    const buttons = html.match(/<button[^>]*data-testid="collections-book-button"[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(30);
    const gold = buttons.find((button) => button.includes('data-set="gold"')) ?? '';
    expect(gold).toContain('aria-label="Gold"');
    expect(gold).toContain('aria-expanded="true"');
    expect(gold).toContain('aria-controls="collections-book-detail"');
    expect(buttons.filter((button) => button.includes('aria-expanded="true"'))).toHaveLength(1);
    expect(buttons.filter((button) => button.includes('aria-expanded="false"'))).toHaveLength(29);
  });

  it('leaves the rows themselves out of the tab order and does not claim a selection on a plain table row', () => {
    const html = render({ selectedCode: 'gold' });
    expect(rows(html).some((row) => /^<tr [^>]*tabindex/.test(row))).toBe(false);
    expect(html).not.toContain('aria-selected');
    expect(html).not.toContain('aria-rowcount');
    expect(rowOf(html, 'gold')).toContain('data-selected="true"');
    expect(html.match(/data-selected="true"/g)).toHaveLength(1);
  });

  it('puts the set’s level under its name in the book cell', () => {
    const button = /<button[^>]*data-set="gold"[\s\S]*?<\/button>/.exec(render())?.[0] ?? '';
    expect(button.indexOf('collections-book-name')).toBeLessThan(button.indexOf('Lv 20'));
    expect(button).toContain('flex-col');
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
    expect(available).toMatch(/data-testid="collections-ready-count">1 book</);
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
