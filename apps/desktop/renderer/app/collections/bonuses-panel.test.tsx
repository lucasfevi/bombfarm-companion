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

function tiles(html: string): string[] {
  return html.split('<div data-testid="collections-axis"').slice(1);
}

function tile(html: string, axis: string): string {
  const found = tiles(html).find((candidate) => candidate.includes(`data-axis="${axis}"`));
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

  it('makes the tile a plain container and its label the one real button, so the bar is not inside a button', () => {
    const html = render('luck');
    expect(html.match(/<button[^>]*data-testid="collections-axis-button"/g)).toHaveLength(10);
    expect(html.match(/<button[^>]*data-testid="collections-axis"/g)).toBeNull();
    expect(tiles(html)).toHaveLength(10);
    for (const button of html.match(/<button[\s\S]*?<\/button>/g) ?? []) expect(button).not.toContain('<div');
  });

  it('reports on the label button whether the tile is the active filter, and only for the pressed one', () => {
    const html = render('luck');
    expect(tile(html, 'luck')).toMatch(/aria-pressed="true"/);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(9);
  });

  it('names each tile button for a screen reader with the axis, its figure and its cap', () => {
    const html = render();
    expect(tile(html, 'gold')).toContain('aria-label="Gold, +7.74%, cap 60%"');
    expect(tile(html, 'damage')).toContain('aria-label="Damage, +30%, cap 30%"');
  });

  it('stretches the label button over the whole tile and truncates the label to one line', () => {
    const button = /<button[^>]*data-testid="collections-axis-button"[^>]*>/.exec(tile(render(), 'gold'))?.[0] ?? '';
    expect(button).toContain('after:absolute after:inset-0');
    expect(button).toContain('truncate');
  });

  it('shows the tile’s focus ring and pressed state on the tile, not on the button', () => {
    const container = /^[^>]*class="([^"]*)"/.exec(tile(render(), 'gold'))?.[1] ?? '';
    expect(container).toContain('relative');
    expect(container).toContain('has-[:focus-visible]:outline-accent');
    expect(container).toContain('has-[[aria-pressed=true]]:border-accent');
  });

  it('puts the at-cap chip on the value line, after the figure, and not in the label button', () => {
    const damage = tile(render(), 'damage');
    const label = /<button[\s\S]*?<\/button>/.exec(damage)?.[0] ?? '';
    expect(label).not.toContain(en.collectionsAxisAtCap);
    const total = damage.indexOf('data-testid="collections-axis-total"');
    const chip = damage.indexOf('data-testid="collections-axis-at-cap"');
    expect(total).toBeGreaterThan(-1);
    expect(chip).toBeGreaterThan(total);
    expect(damage.slice(total, chip)).not.toContain('</div>');
  });

  it('partitions the books by the progress filter’s words, and says nothing of the bag when nothing is ready', () => {
    const { summary } = board;
    const inProgress = summary.booksStarted - summary.booksComplete;
    const untouched = summary.booksTotal - summary.booksStarted;
    expect(render()).toContain(
      `${String(inProgress)} in progress · ${String(summary.booksComplete)} complete · ${String(untouched)} not started · ${String(summary.piecesSacrificed)} of 1,440 pieces sacrificed</p>`,
    );
    expect(inProgress + summary.booksComplete + untouched).toBe(30);
    expect(summary.readyInBag).toBe(0);
    expect(render()).not.toContain('ready in bag');
  });

  it('adds the ready count to the summary when the bag holds pieces', () => {
    language.current = 'en';
    const withBag = buildCollectionBoard(collectionsSnapshotFixture(), [{ defId: 'gold_elmo', rarity: 3, free: true }]);
    const html = renderToStaticMarkup(
      createElement(BonusesPanel, { board: withBag, activeAxis: 'all', onToggleAxis: () => undefined }),
    );
    expect(html).toContain('· 1 ready in bag</p>');
  });

  it('renders in Portuguese with the game’s own words and decimal comma', () => {
    const html = render('all', 'pt-BR');
    expect(html).toContain(ptBR.collectionsBonusesTitle);
    expect(tile(html, 'critDamage')).toContain('Dano crítico');
    expect(tile(html, 'cage')).toContain('Jaula e chefe');
    expect(tile(html, 'gold')).toContain('+7,74%');
    expect(tile(html, 'cooldown')).toContain('teto 22,5%');
    expect(tile(html, 'damage')).toContain('No teto');
    expect(html).toContain('em andamento');
  });

  it('keeps the tiles at five columns at every width, two rows of five', () => {
    const html = render();
    expect(html).toContain('data-testid="collections-axes"');
    expect(html).toContain('class="grid grid-cols-5 gap-2"');
    expect(html).not.toMatch(/(?:sm|md|lg|xl|wide):grid-cols/);
  });
});
