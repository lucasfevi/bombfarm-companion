import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCollectionBoard } from '@bombfarm/domain/model';
import { COLLECTION_AXES } from '@bombfarm/contracts';
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

const { BonusesPanel } = await import('./bonuses-panel');

const board = buildCollectionBoard(collectionsSnapshotFixture());

function render(activeAxis: Parameters<typeof BonusesPanel>[0]['activeAxis'] = 'all', locale: 'en' | 'pt-BR' = 'en'): string {
  language.current = locale;
  return renderToStaticMarkup(createElement(BonusesPanel, { board, activeAxis, onToggleAxis: () => undefined }));
}

function tile(html: string, axis: string): string {
  const found = (html.match(/<button[^>]*data-testid="collections-axis"[\s\S]*?<\/button>/g) ?? []).find((button) =>
    button.includes(`data-axis="${axis}"`),
  );
  expect(found).toBeDefined();
  return found ?? '';
}

describe('BonusesPanel', () => {
  it('draws the ten axes in the game’s panel order', () => {
    const html = render();
    const order = [...html.matchAll(/data-axis="(\w+)"/g)].map((match) => match[1]);
    expect(order).toEqual([...COLLECTION_AXES]);
    expect(order).toEqual(['damage', 'critDamage', 'critChance', 'cooldown', 'cage', 'energy', 'gold', 'xp', 'luck', 'forge']);
  });

  it('prints each axis’s labelled bonus and cap from the server’s figures', () => {
    const html = render();
    const gold = tile(html, 'gold');
    expect(gold).toContain(en.collectionsAxisGold);
    expect(gold).toContain('+7.74%');
    expect(gold).toContain('cap 60%');
    expect(tile(html, 'damage')).toContain('+30%');
    expect(tile(html, 'critChance')).toContain('+11.4%');
    expect(tile(html, 'cooldown')).toContain('cap 22.5%');
    expect(tile(html, 'cage')).toContain('+10.9%');
  });

  it('marks only Damage as at its cap, since the fixture’s raw damage runs past 30', () => {
    const html = render();
    const flags = [...html.matchAll(/data-axis="(\w+)" data-at-cap="(\w+)"/g)].map((match) => [match[1], match[2]]);
    expect(flags.filter(([, atCap]) => atCap === 'true')).toEqual([['damage', 'true']]);
    expect(html.match(/data-testid="collections-axis-at-cap"/g)).toHaveLength(1);
    expect(tile(html, 'damage')).toContain(en.collectionsAxisAtCap);
    expect(tile(html, 'gold')).not.toContain(en.collectionsAxisAtCap);
  });

  it('fills each bar to the bonus over its cap', () => {
    const html = render();
    expect(tile(html, 'damage')).toMatch(/style="width:\s*100%"/);
    expect(tile(html, 'gold')).toMatch(/style="width:\s*12\.9\d*%"/);
    expect(tile(html, 'xp')).toMatch(/style="width:\s*0%"/);
  });

  it('draws an axis with nothing in it muted, and still draws it', () => {
    const xp = tile(render(), 'xp');
    expect(xp).toContain('data-empty="true"');
    expect(xp).toContain('+0%');
    expect(xp).toMatch(/text-muted[^"]*">\+0%/);
  });

  it('renders each tile as a real button that reports whether it is the active filter', () => {
    const html = render('luck');
    expect(html.match(/<button[^>]*data-testid="collections-axis"/g)).toHaveLength(10);
    expect(tile(html, 'luck')).toContain('aria-pressed="true"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(9);
  });

  it('summarises the books, pieces and, only when there are any, pieces ready in the bag', () => {
    const { summary } = board;
    expect(render()).toContain(
      `${String(summary.booksStarted)} of 30 books started · ${String(summary.booksComplete)} complete · ${String(summary.piecesSacrificed)} of 1,440 pieces sacrificed</p>`,
    );
    expect(summary.readyInBag).toBe(0);
    expect(render()).not.toContain('ready in your bag');
  });

  it('adds the ready count to the summary when the bag holds pieces', () => {
    language.current = 'en';
    const withBag = buildCollectionBoard(collectionsSnapshotFixture(), [{ defId: 'gold_elmo', rarity: 3, free: true }]);
    const html = renderToStaticMarkup(
      createElement(BonusesPanel, { board: withBag, activeAxis: 'all', onToggleAxis: () => undefined }),
    );
    expect(html).toContain('· 1 ready in your bag</p>');
  });

  it('counts a started book among the started ones even when it is complete', () => {
    expect(board.summary.booksComplete).toBe(2);
    expect(board.summary.booksStarted).toBeGreaterThan(board.summary.booksComplete);
  });

  it('renders in Portuguese with the game’s own words and decimal comma', () => {
    const html = render('all', 'pt-BR');
    expect(html).toContain(ptBR.collectionsBonusesTitle);
    expect(tile(html, 'critDamage')).toContain('Dano crítico');
    expect(tile(html, 'cage')).toContain('Jaula e chefe');
    expect(tile(html, 'gold')).toContain('+7,74%');
    expect(tile(html, 'cooldown')).toContain('teto 22,5%');
    expect(tile(html, 'damage')).toContain('No teto');
    expect(html).toContain('livros iniciados');
  });

  it('keeps the tile grid at two columns until the window is wide, then five', () => {
    expect(render()).toContain('grid grid-cols-2 gap-2 lg:grid-cols-5');
  });
});
