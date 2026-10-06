import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCollectionBoard } from '@bombfarm/domain/model';
import { COLLECTION_AXES } from '@bombfarm/contracts';
import { COLLECTION_AXIS_COLOUR } from '../../lib/collections/collections-axis-colour';
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

function text(fragment: string): string {
  return fragment.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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

  it('prints each axis’s labelled bonus from the server’s figures', () => {
    const html = render();
    const gold = tile(html, 'gold');
    expect(gold).toContain(en.collectionsAxisGold);
    expect(gold).toContain('+7.74%');
    expect(tile(html, 'damage')).toContain('+30%');
    expect(tile(html, 'critChance')).toContain('+11.4%');
    expect(tile(html, 'cage')).toContain('+10.9%');
  });

  const progressOf = (html: string, axis: string) =>
    text(/<div[^>]*data-testid="collections-axis-cap"[^>]*>[\s\S]*?<\/div>/.exec(tile(html, axis))?.[0] ?? '');

  it('shows progress to the cap as "to cap" over a plain count, never as a second percentage', () => {
    const html = render();
    expect(progressOf(html, 'gold')).toBe('to cap 7.74 / 60');
    expect(progressOf(html, 'cooldown')).toBe('to cap 1.17 / 22.5');
    expect(progressOf(html, 'xp')).toBe('to cap 0 / 75');
    for (const row of tiles(html)) {
      expect(text(/<div[^>]*data-testid="collections-axis-cap"[^>]*>[\s\S]*?<\/div>/.exec(row)?.[0] ?? '')).not.toContain('%');
    }
    expect(html).not.toMatch(/of cap|% of/);
  });

  it('reads 30 / 30 at the cap and keeps the At cap chip', () => {
    expect(progressOf(render(), 'damage')).toBe('to cap 30 / 30');
    expect(tile(render(), 'damage')).toContain(en.collectionsAxisAtCap);
  });

  it('gives every tile its axis hue as a custom property, and uses it for the figure, the bar and the top rule', () => {
    const html = render();
    for (const axis of COLLECTION_AXES) {
      const hue = COLLECTION_AXIS_COLOUR[axis];
      const markup = tile(html, axis);
      expect(markup, axis).toContain(`style="--axis-colour:${hue}"`);
    }
    const gold = tile(html, 'gold');
    expect(gold).toContain('text-[var(--axis-colour)]');
    expect(gold).toMatch(/class="h-full bg-\[var\(--axis-colour\)\]"/);
    expect(gold).toContain('border-t-[var(--axis-colour)]');
  });

  it('draws an empty axis’s figure muted rather than in its hue', () => {
    expect(tile(render(), 'xp')).not.toMatch(/axis-total"[^>]*text-\[var\(--axis-colour\)\]/);
  });

  it('lists the books that grant each axis under the bar, names of books that grant something in ink and the rest muted', () => {
    const html = render();
    const line = (axis: string) => /<p data-testid="collections-axis-sets"[\s\S]*?<\/p>/.exec(tile(html, axis))?.[0] ?? '';
    expect(text(line('gold'))).toBe('Gold · Desert · Silver');
    const grants = [...line('gold').matchAll(/data-grants="(\w+)"/g)].map((match) => match[1]);
    expect(grants).toEqual(['true', 'false', 'false']);
    expect(line('gold')).toContain('class="text-ink" data-grants="true"');
    expect(line('gold')).toContain('class="text-muted" data-grants="false"');
    expect(line('gold')).toContain('truncate');
  });

  it('shows the first few names and a +N marker when the list does not fit, and the whole list in the tooltip source', () => {
    const html = render();
    const damage = /<p data-testid="collections-axis-sets"[\s\S]*?<\/p>/.exec(tile(html, 'damage'))?.[0] ?? '';
    expect(text(damage)).toBe('Ember · Steel · Toxic · +2');
    expect(damage).toContain('data-testid="collections-axis-sets-more"');
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
    expect(tile(html, 'gold')).toContain('aria-label="Gold, +7.74%, 7.74 of 60 to the cap"');
    expect(tile(html, 'damage')).toContain('aria-label="Damage, +30%, 30 of 30 to the cap"');
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
    expect(container).toContain('has-[[aria-pressed=true]]:bg-[color-mix(in_oklch,var(--axis-colour)_12%,var(--surface))]');
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
    expect(render()).not.toContain('ready in inventory');
  });

  it('adds the ready count to the summary when the bag holds pieces', () => {
    language.current = 'en';
    const withBag = buildCollectionBoard(collectionsSnapshotFixture(), [{ defId: 'gold_elmo', rarity: 3, free: true }]);
    const html = renderToStaticMarkup(
      createElement(BonusesPanel, { board: withBag, activeAxis: 'all', onToggleAxis: () => undefined }),
    );
    expect(html).toContain('· 1 ready in inventory</p>');
  });

  it('renders in Portuguese with the game’s own words and decimal comma', () => {
    const html = render('all', 'pt-BR');
    expect(html).toContain(ptBR.collectionsBonusesTitle);
    expect(tile(html, 'critDamage')).toContain('Dano crítico');
    expect(tile(html, 'cage')).toContain('Jaula e chefe');
    expect(tile(html, 'gold')).toContain('+7,74%');
    expect(progressOf(html, 'cooldown')).toBe('até o teto 1,17 / 22,5');
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
