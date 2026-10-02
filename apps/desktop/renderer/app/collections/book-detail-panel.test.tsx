import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CollectionsSnapshot } from '@bombfarm/contracts';
import { buildCollectionBoard, type CollectionBagItem, type CollectionSetRow } from '@bombfarm/domain/model';
import { collectionsSnapshotFixture } from '../../lib/collections/collections-test-fixture';
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

const { BookDetailPanel } = await import('./book-detail-panel');

const fixture = collectionsSnapshotFixture();

/** gold_peito is still arriving on the Legendary page, and gold_anel is a Rare in the bag. */
const withArrival: CollectionsSnapshot = {
  ...fixture,
  pieces: fixture.pieces.map((piece) => (piece.defId === 'gold_peito' ? { ...piece, pendingMask: 16 } : piece)),
};
const BAG: readonly CollectionBagItem[] = [
  { defId: 'gold_anel', rarity: 2, free: true },
  { defId: 'gold_elmo', rarity: 3, free: true },
  { defId: 'gold_luva', rarity: 2, free: false },
];
const board = buildCollectionBoard(withArrival, BAG);

function book(code: string, from = board): CollectionSetRow {
  const found = from.sets.find((row) => row.code === code);
  expect(found).toBeDefined();
  return found as CollectionSetRow;
}

function render(row: CollectionSetRow | null, locale: 'en' | 'pt-BR' = 'en'): string {
  language.current = locale;
  return renderToStaticMarkup(createElement(BookDetailPanel, { book: row, onClose: () => undefined }));
}

function text(fragment: string): string {
  return fragment.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pageRows(html: string): string[] {
  return html.match(/<tr [^>]*data-testid="collections-detail-page"[\s\S]*?<\/tr>/g) ?? [];
}

function cellOf(row: string, testId: string): string {
  return text(new RegExp(String.raw`<td[^>]*data-testid="${testId}"[\s\S]*?</td>`).exec(row)?.[0] ?? '');
}

function pieceCells(html: string): string[] {
  return html.match(/<span [^>]*data-testid="collections-piece"[^>]*>/g) ?? [];
}

function pieceAt(html: string, slot: number, rarity: number): string {
  const found = pieceCells(html).find((cell) => cell.includes(`data-slot="${String(slot)}"`) && cell.includes(`data-rarity="${String(rarity)}"`));
  expect(found).toBeDefined();
  return found ?? '';
}

describe('BookDetailPanel', () => {
  it('draws nothing while no book is selected', () => {
    expect(render(null)).toBe('');
  });

  it('heads the panel with the book’s icon, name and level, and gives it a close button', () => {
    const html = render(book('gold'));
    expect(html).toContain('data-testid="collections-book-detail" data-set="gold"');
    expect(html).toMatch(/<h2[^>]*>Gold<\/h2>/);
    expect(html).toContain('Lv 20');
    expect(html).toContain('/items/lvl20_weapon_gold.png');
    expect(html).toMatch(/<button[^>]*aria-label="Close"[^>]*data-testid="collections-detail-close"/);
  });

  it('prints what the effect grants now, at most, and has left to gain', () => {
    const html = render(book('gold'));
    const effect = /data-testid="collections-detail-effect"[\s\S]*?(?=<h3)/.exec(html)?.[0] ?? '';
    expect(text(effect)).toContain('Gold');
    expect(text(effect)).toContain('+7.74%');
    expect(text(effect)).toContain('+26%');
    expect(text(effect)).toContain('+18.26%');
  });

  it('draws one block per effect for the three-effect book', () => {
    const html = render(book('void'));
    expect(html.match(/data-testid="collections-detail-effect"/g)).toHaveLength(3);
    expect(html).toContain('data-axis="critDamage"');
    expect(html).toContain('data-axis="cooldown"');
  });

  it('lists the six pages in rarity order with their pieces', () => {
    const rows = pageRows(render(book('gold')));
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => cellOf(row, 'collections-detail-page-pieces'))).toEqual(['8/8', '8/8', '5/8', '0/8', '0/8', '0/8']);
    expect(text(rows[0] ?? '')).toMatch(/^Common/);
    expect(text(rows[5] ?? '')).toMatch(/^Mythic/);
  });

  it('reads a complete page as complete rather than as 8/8 with nothing left', () => {
    const rows = pageRows(render(book('gold')));
    expect(cellOf(rows[0] ?? '', 'collections-detail-page-full')).toBe(en.collectionsPageComplete);
    expect(cellOf(rows[1] ?? '', 'collections-detail-page-full')).toBe(en.collectionsPageComplete);
    expect(cellOf(rows[2] ?? '', 'collections-detail-page-full')).not.toBe(en.collectionsPageComplete);
    expect(rows[0]).toContain('data-complete="true"');
    expect(rows[2]).toContain('data-complete="false"');
  });

  it('prints what each page grants now against what it grants complete', () => {
    const rows = pageRows(render(book('gold')));
    expect(cellOf(rows[0] ?? '', 'collections-detail-page-now')).toBe('+3.3%');
    expect(cellOf(rows[2] ?? '', 'collections-detail-page-now')).toBe('+1.24%');
    expect(cellOf(rows[2] ?? '', 'collections-detail-page-full')).toBe('+3.3%');
    expect(cellOf(rows[3] ?? '', 'collections-detail-page-now')).toBe('+0%');
    expect(cellOf(rows[3] ?? '', 'collections-detail-page-full')).toBe('+4.8%');
  });

  it('counts the pieces in the bag that would fill each page, and leaves a dash elsewhere', () => {
    const rows = pageRows(render(book('gold')));
    expect(rows.map((row) => cellOf(row, 'collections-detail-page-ready'))).toEqual(['—', '—', '1', '1', '—', '—']);
  });

  it('names each effect on a multi-effect book’s page lines and not on a single-effect one’s', () => {
    const voidRows = pageRows(render(book('void')));
    expect(cellOf(voidRows[0] ?? '', 'collections-detail-page-now')).toContain('Critical damage');
    const goldRows = pageRows(render(book('gold')));
    expect(cellOf(goldRows[0] ?? '', 'collections-detail-page-now')).not.toContain('Gold');
  });

  it('draws the eight slots by six rarities, forty-eight pieces in all', () => {
    const html = render(book('gold'));
    expect(pieceCells(html)).toHaveLength(48);
    expect(html.match(/data-testid="collections-piece-row"/g)).toHaveLength(8);
    for (const slot of ['Weapon', 'Helm', 'Chest', 'Legs', 'Boots', 'Gloves', 'Ring', 'Amulet']) expect(html).toContain(`>${slot}<`);
  });

  it('marks a sacrificed piece, a missing one, one ready in the bag and one still arriving', () => {
    const html = render(book('gold'));
    expect(pieceAt(html, 0, 0)).toContain('data-state="sacrificed"');
    expect(pieceAt(html, 5, 2)).toContain('data-state="missing"');
    expect(pieceAt(html, 6, 2)).toContain('data-state="ready"');
    expect(pieceAt(html, 1, 3)).toContain('data-state="ready"');
    expect(pieceAt(html, 2, 4)).toContain('data-state="pending"');
    const states = pieceCells(html).map((cell) => /data-state="(\w+)"/.exec(cell)?.[1]);
    expect(states.filter((state) => state === 'ready')).toHaveLength(2);
    expect(states.filter((state) => state === 'pending')).toHaveLength(1);
  });

  it('does not count a piece the bag holds but cannot sacrifice as ready', () => {
    expect(pieceAt(render(book('gold')), 5, 2)).not.toContain('data-state="ready"');
  });

  it('names every piece cell for a screen reader with the piece, its rarity and its state', () => {
    const html = render(book('gold'));
    expect(pieceAt(html, 1, 0)).toContain('aria-label="Gold Helm, Common — sacrificed"');
    expect(pieceAt(html, 6, 2)).toContain('aria-label="Gold Ring, Rare — in your bag, ready to sacrifice"');
    expect(pieceAt(html, 2, 4)).toContain('aria-label="Gold Chest, Legendary — arriving"');
    expect(pieceAt(html, 5, 2)).toContain('aria-label="Gold Gloves, Rare — not sacrificed"');
  });

  it('draws each piece’s art at the cell’s rarity with the set’s level and no forge glyph', () => {
    const html = render(book('gold'));
    expect(html).toContain('/items/lvl20_helmet_gold.png');
    expect(html).not.toContain('data-slot="item-upgrade"');
    expect(html).toContain('data-slot="item-level"');
  });

  it('dresses each state differently: a ready piece ringed, a missing one dimmed, an arriving one dashed', () => {
    const html = render(book('gold'));
    expect(pieceAt(html, 6, 2)).toContain('outline-accent');
    expect(pieceAt(html, 5, 2)).toContain('opacity-35');
    expect(pieceAt(html, 2, 4)).toContain('outline-dashed');
    expect(pieceAt(html, 0, 0)).not.toMatch(/opacity-35|outline-accent|outline-dashed/);
  });

  it('draws a one-line legend for the four states', () => {
    const legend = text(/<p [^>]*data-testid="collections-piece-legend"[\s\S]*?<\/p>/.exec(render(book('gold')))?.[0] ?? '');
    expect(legend).toBe(
      [en.collectionsLegendSacrificed, en.collectionsLegendReady, en.collectionsLegendPending, en.collectionsLegendMissing].join(' '),
    );
  });

  it('says in one line that pieces are sacrificed in the game and the app only reads', () => {
    expect(render(book('gold'))).toContain(en.collectionsGuidance);
  });

  it('replaces the grid with a note when the read carried no pieces for the set', () => {
    const bare = { ...book('gold'), pieces: [] };
    const html = render(bare);
    expect(html).toContain('data-testid="collections-no-pieces"');
    expect(html).toContain(en.collectionsNoPieces);
    expect(html).not.toContain('data-testid="collections-piece-grid"');
  });

  it('shows a finished book as finished: every page complete, nothing ready, every piece sacrificed', () => {
    const html = render(book('ember'));
    const rows = pageRows(html);
    expect(rows.every((row) => row.includes('data-complete="true"'))).toBe(true);
    expect(rows.map((row) => cellOf(row, 'collections-detail-page-full'))).toEqual(Array(6).fill(en.collectionsPageComplete));
    expect(pieceCells(html).every((cell) => cell.includes('data-state="sacrificed"'))).toBe(true);
    expect(text(/data-testid="collections-detail-effect"[\s\S]*?(?=<h3)/.exec(html)?.[0] ?? '')).toContain('+0%');
  });

  it('renders in Portuguese with the game’s own words', () => {
    const html = render(book('gold'), 'pt-BR');
    expect(html).toMatch(/<h2[^>]*>Ouro<\/h2>/);
    expect(html).toContain(ptBR.collectionsGuidance);
    expect(html).toContain(ptBR.collectionsPageComplete);
    expect(html).toContain('>Elmo<');
    expect(html).toContain('>Calça<');
    expect(pieceAt(html, 6, 2)).toContain('na mochila, pronta para queimar');
    expect(pieceAt(html, 2, 4)).toContain('a caminho');
    expect(cellOf(pageRows(html)[2] ?? '', 'collections-detail-page-now')).toBe('+1,24%');
  });
});
