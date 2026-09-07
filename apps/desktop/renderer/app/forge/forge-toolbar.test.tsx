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

const HERO = {
  id: 'h1',
  name: 'Bellatrix',
  rank: 'A',
  rarityIdx: 3,
  skin: 0,
  level: 'Level 106',
  inField: true,
};

function renderToolbar(overrides: { filter?: ForgeFilter; anyEquipped?: boolean } = {}): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ForgeToolbar, {
        heroes: [HERO],
        filter: overrides.filter ?? EMPTY_FORGE_FILTER,
        onFilterChange: () => {},
        slots: ['arma'],
        rarities: [2],
        anyEquipped: overrides.anyEquipped ?? true,
        shown: 3,
        total: 9,
        heroHint: null,
        labels,
      }),
    }),
  );
}

/** Where each control opens in the row, by the order its markup comes in. */
function positionOf(html: string, needle: string): number {
  const at = html.indexOf(needle);
  expect(at, `"${needle}" is not in the toolbar at all`).toBeGreaterThan(-1);
  return at;
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

  it('is filters only — Refresh acts on the read behind the bag and stands over the bag instead', () => {
    const html = renderToolbar({ filter: { ...EMPTY_FORGE_FILTER, forge: 'at8' } });
    expect(html).not.toContain('data-testid="forge-refresh"');
    expect(html).not.toContain('data-testid="forge-stale-label"');
    expect(html).not.toContain('data-testid="forge-read-age"');
    expect(html).not.toContain('Account read');
    expect(html).not.toContain(en.farmRefresh);
  });

  it('opens on the search field alone, then the dropdowns, then the chips', () => {
    const html = renderToolbar({ filter: { ...EMPTY_FORGE_FILTER, forge: 'at8' } });
    const order = [
      en.forgeSearchLabel,
      en.inventoryFilterHeroLabel,
      en.forgeSlotLabel,
      en.forgeBandLabel,
    ].map((label) => positionOf(html, `aria-label="${label}"`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // The count and Clear close the dropdown row; the chips come after all of it.
    const clear = positionOf(html, 'data-testid="forge-clear-filter"');
    expect(clear).toBeGreaterThan(positionOf(html, 'data-testid="forge-result-count"'));
    expect(positionOf(html, 'data-testid="forge-equipped-chip"')).toBeGreaterThan(clear);
  });

  it('gives the search field the whole of its own row, and every field one height', () => {
    const html = renderToolbar();
    const search = new RegExp(`<input[^>]*aria-label="${en.forgeSearchLabel}"[^>]*>`).exec(html)?.[0] ?? '';
    expect(search).toContain('w-full');
    expect(search).toContain('h-[30px]');
    for (const label of [en.inventoryFilterHeroLabel, en.forgeSlotLabel, en.forgeBandLabel]) {
      expect(new RegExp(`<[a-z]+[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0] ?? '').toContain('h-[30px]');
    }
  });

  it('collapses who-wears-it into one chip, pressed or not, and offers none where nothing is worn', () => {
    const off = renderToolbar();
    expect(tagOf(off, 'forge-equipped-chip')).toContain('aria-pressed="false"');
    expect(off).toContain(en.inventoryFilterEquipped);
    const on = renderToolbar({ filter: { ...EMPTY_FORGE_FILTER, worn: true } });
    expect(tagOf(on, 'forge-equipped-chip')).toContain('aria-pressed="true"');
    expect(renderToolbar({ anyEquipped: false })).not.toContain('data-testid="forge-equipped-chip"');
  });

  it('drops the chip once a hero is chosen, because every row is then one they wear', () => {
    const html = renderToolbar({ filter: { ...EMPTY_FORGE_FILTER, heroId: HERO.id } });
    expect(html).not.toContain('data-testid="forge-equipped-chip"');
    expect(html).toContain(`aria-label="${en.inventoryFilterHeroLabel}"`);
  });

  it('offers no third state that could only ever empty the table', () => {
    const html = renderToolbar();
    expect(html).not.toContain('Nobody wearing it');
    expect(html).not.toContain('data-testid="forge-worn-implied"');
  });

  it('shouts through CSS, so the Portuguese label is a sentence in the copy file', () => {
    for (const copy of [en, ptBR]) {
      expect(copy.farmRefreshStale).toBe(copy.farmRefreshStale.toLowerCase());
    }
  });
});
