import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LiveMap, LiveMapEconomy } from '@bombfarm/contracts';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import { MapPanel } from './map-panel';

// Same reason as `earnings-panel.test.tsx`: `useCopy()`/`useLocale()` are hooks, and these render
// the panel outside a `CopyProvider`. Both read `activeLocale` rather than a fixed language, so
// the pt-BR assertion below exercises the real Portuguese path instead of restating the English
// one under a Portuguese-sounding name.
let activeLocale: 'en' | 'pt-BR' = 'en';

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return {
    ...actual,
    useCopy: () => (activeLocale === 'en' ? en : ptBR),
    useLocale: () =>
      activeLocale === 'en'
        ? { locale: 'en' as const, lang: 'en' as const, bcp47: 'en-US' }
        : { locale: 'pt-BR' as const, lang: 'pt' as const, bcp47: 'pt-BR' },
  };
});

afterEach(() => {
  activeLocale = 'en';
});

const ECONOMY: LiveMapEconomy = { xpPerProp: 310, averageGoldPerProp: 1_337, averageGoldPerClear: 100_275 };

function liveMap(overrides: Partial<LiveMap> = {}): LiveMap {
  return { phase: 61, healthFraction: 0.5, propsAlive: 22, propsTotal: 75, economy: ECONOMY, ...overrides };
}

function html(map: LiveMap | null): string {
  return renderToStaticMarkup(createElement(MapPanel, { map }));
}

/** The rendered text of one `data-testid`, tags stripped. */
function textOf(markup: string, testId: string): string {
  const match = new RegExp(`data-testid="${testId}"[^>]*>(.*?)</span>`, 's').exec(markup);
  return (match?.[1] ?? '').replace(/<[^>]*>/g, '');
}

describe('MapPanel names the map the way the game does', () => {
  it('prints the in-game difficulty coordinate, not the wiki flavour name, as the headline', () => {
    expect(textOf(html(liveMap({ phase: 51 })), 'live-map-coord')).toBe('Normal 1-1');
  });

  it('prints the phase number as an identifier, with no thousands grouping', () => {
    expect(textOf(html(liveMap({ phase: 600 })), 'live-map-phase')).toBe('#600');
  });

  it('carries the flavour name too, so the coordinate is not the only thing naming the map', () => {
    expect(textOf(html(liveMap({ phase: 61 })), 'live-map-name').length).toBeGreaterThan(0);
  });

  it('renders the difficulty coordinate in the active language — the coordinate is localised copy, not an id', () => {
    expect(textOf(html(liveMap({ phase: 151 })), 'live-map-coord')).toBe('Hard 1-1');

    activeLocale = 'pt-BR';
    expect(textOf(html(liveMap({ phase: 151 })), 'live-map-coord')).toBe('Difícil 1-1');
  });

  it('renders the flavour name in the active language too', () => {
    const english = textOf(html(liveMap({ phase: 71 })), 'live-map-name');
    activeLocale = 'pt-BR';
    const portuguese = textOf(html(liveMap({ phase: 71 })), 'live-map-name');
    expect(english).not.toBe(portuguese);
  });
});

describe('MapPanel readings', () => {
  it('prints map health as a whole percent, the precision a 0-255 byte actually carries', () => {
    expect(textOf(html(liveMap({ healthFraction: 0.5 })), 'live-map-health')).toBe('50%');
    expect(textOf(html(liveMap({ healthFraction: 1 })), 'live-map-health')).toBe('100%');
    expect(textOf(html(liveMap({ healthFraction: 0 })), 'live-map-health')).toBe('0%');
  });

  it('prints props alive over the map’s own total', () => {
    expect(textOf(html(liveMap({ propsAlive: 22, propsTotal: 75 })), 'live-map-props')).toBe('22/75');
  });

  it('prints a bare count when the phase has no wiki total, rather than inventing a denominator', () => {
    expect(textOf(html(liveMap({ propsAlive: 22, propsTotal: null })), 'live-map-props')).toBe('22');
  });

  it('prints zero props alive as a real reading, not as a dash', () => {
    expect(textOf(html(liveMap({ propsAlive: 0, propsTotal: 75 })), 'live-map-props')).toBe('0/75');
  });

  it('prints zero health as a real reading, not as a dash', () => {
    expect(textOf(html(liveMap({ healthFraction: 0 })), 'live-map-health')).not.toBe('—');
  });
});

describe('MapPanel distinguishes "not sent" from zero', () => {
  it('dashes an absent health reading', () => {
    expect(textOf(html(liveMap({ healthFraction: null })), 'live-map-health')).toBe('—');
  });

  it('dashes an absent prop count, and does not print the total on its own', () => {
    const markup = html(liveMap({ propsAlive: null, propsTotal: 75 }));
    expect(textOf(markup, 'live-map-props')).toBe('—');
    expect(markup).not.toContain('75');
  });

  it('renders with no map at all, naming neither a phase nor a coordinate it was never told', () => {
    const markup = html(null);
    expect(textOf(markup, 'live-map-coord')).toBe(en.liveMapUnknownName);
    expect(markup).not.toContain('data-testid="live-map-phase"');
    expect(markup).not.toContain('data-testid="live-map-name"');
    expect(textOf(markup, 'live-map-health')).toBe('—');
    expect(textOf(markup, 'live-map-props')).toBe('—');
  });

  it('still draws the health track with no map, so the panel does not change height once one arrives', () => {
    expect(html(null)).toContain('width:0%');
  });
});

describe('MapPanel economy figures', () => {
  it('prints XP per prop, gold per prop and gold per clear', () => {
    const markup = html(liveMap());
    expect(textOf(markup, 'live-map-xp-per-prop')).toBe('310');
    expect(textOf(markup, 'live-map-gold-per-prop')).toBe('1.3k');
    expect(textOf(markup, 'live-map-gold-per-clear')).toBe('100.3k');
  });

  it('dashes all three when the phase has no wiki row, rather than printing zeros', () => {
    const markup = html(liveMap({ economy: null }));
    for (const testId of ['live-map-xp-per-prop', 'live-map-gold-per-prop', 'live-map-gold-per-clear']) {
      expect(textOf(markup, testId)).toBe('—');
    }
  });

  it('dashes all three with no map at all', () => {
    const markup = html(null);
    for (const testId of ['live-map-xp-per-prop', 'live-map-gold-per-prop', 'live-map-gold-per-clear']) {
      expect(textOf(markup, testId)).toBe('—');
    }
  });

  it('marks them as estimates — they sit beside measured rates and must not read as the same kind of number', () => {
    const markup = html(liveMap());
    expect(markup).toContain('data-testid="live-map-estimate-trigger"');
    expect(markup).toContain(en.liveMapEstimateNote);
    expect(markup).toContain(en.liveMapEstimateBody);
  });

  it('says in the estimate note that the figures are averages, not what was earned', () => {
    // The claim the note has to carry: these are modelled, and the panel next door is measured.
    expect(en.liveMapEstimateBody.toLowerCase()).toContain('average');
    expect(ptBR.liveMapEstimateBody.toLowerCase()).toContain('média');
  });

  it('labels the three figures in the active language', () => {
    const english = html(liveMap());
    activeLocale = 'pt-BR';
    const portuguese = html(liveMap());
    expect(english).toContain(en.liveMapGoldPerClearLabel);
    expect(portuguese).toContain(ptBR.liveMapGoldPerClearLabel);
    expect(en.liveMapGoldPerClearLabel).not.toBe(ptBR.liveMapGoldPerClearLabel);
  });
});

describe('MapPanel copy', () => {
  it('labels both readings from the copy table, in both languages', () => {
    for (const table of [en, ptBR]) {
      expect(table.liveMapHealthLabel.length).toBeGreaterThan(0);
      expect(table.liveMapPropsLabel.length).toBeGreaterThan(0);
      expect(table.liveMapUnknownName.length).toBeGreaterThan(0);
    }
    expect(en.liveMapHealthLabel).not.toBe(ptBR.liveMapHealthLabel);
  });

  it('names the panel for assistive tech', () => {
    expect(html(liveMap())).toContain(`aria-label="${en.liveMapTitle}"`);
  });
});
