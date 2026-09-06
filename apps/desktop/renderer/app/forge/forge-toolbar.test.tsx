import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import { EMPTY_FORGE_FILTER, type ForgeFilter } from '../../lib/forge/forge-rows';
import { forgeLabels } from './forge-labels';
import { ForgeToolbar } from './forge-toolbar';

const labels = forgeLabels(en, 'en', 'en');

function renderToolbar(overrides: { filter?: ForgeFilter; stale?: boolean } = {}): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ForgeToolbar, {
        heroes: [],
        filter: overrides.filter ?? EMPTY_FORGE_FILTER,
        onFilterChange: () => {},
        slots: ['arma'],
        rarities: [2],
        shown: 3,
        total: 9,
        heroHint: null,
        capturedAt: new Date().toISOString(),
        stale: overrides.stale ?? false,
        onRefresh: () => {},
        labels,
      }),
    }),
  );
}

function tagOf(html: string, testid: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`).exec(html)?.[0] ?? '';
}

describe('ForgeToolbar', () => {
  it('offers no ordering of its own — the bag table\'s headers are the whole of it', () => {
    const html = renderToolbar();
    expect(html).not.toContain(en.inventorySortLabel);
    expect(html).not.toContain(en.inventorySortAscending);
    expect(html).not.toContain(en.inventorySortDescending);
  });

  // The select's options live in a portal that only exists once it is open, so what a rendered
  // toolbar can be asked is which band it is standing on. The seven options themselves are the
  // smoke suite's, in a launched app that can open the list.
  it('opens on the band that filters nothing out, and names whichever band is chosen', () => {
    expect(renderToolbar()).toContain(`aria-label="${en.forgeBandLabel}"`);
    expect(renderToolbar()).toContain('Any forge');
    expect(renderToolbar({ filter: { ...EMPTY_FORGE_FILTER, forge: '12to14' } })).toContain('+12 to +14');
  });

  it('shows the clear control only once a filter is on, and gives it the accent fill and the field height', () => {
    expect(renderToolbar()).not.toContain('data-testid="forge-clear-filter"');
    const clear = tagOf(renderToolbar({ filter: { ...EMPTY_FORGE_FILTER, forge: 'at8' } }), 'forge-clear-filter');
    expect(clear).toContain('bg-accent');
    expect(clear).toContain('h-[30px]');
  });

  it('says nothing above the Refresh button while the read is current, and still prints its age', () => {
    const html = renderToolbar();
    expect(html).not.toContain('data-testid="forge-stale-label"');
    expect(tagOf(html, 'forge-refresh')).not.toContain('border-warn');
    expect(html).toContain('Account read');
  });

  it('hangs an out-of-date label over the Refresh button and borders the button itself when the read is stale', () => {
    const html = renderToolbar({ stale: true });
    const label = tagOf(html, 'forge-stale-label');
    // Absolute so the row keeps one baseline whether the label is there or not.
    expect(label).toContain('absolute');
    expect(label).toContain('uppercase');
    expect(label).toContain('font-bold');
    expect(tagOf(html, 'forge-refresh')).toContain('border-warn');
    expect(html).toContain(en.farmRefreshStale);
    // The read age stays where it was — the stale treatment is beside it, not instead of it.
    expect(html).toContain('Account read');
  });

  it('shouts through CSS, so the Portuguese label is a sentence in the copy file', () => {
    for (const copy of [en, ptBR]) {
      expect(copy.farmRefreshStale).toBe(copy.farmRefreshStale.toLowerCase());
    }
  });
});
