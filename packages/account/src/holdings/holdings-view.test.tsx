import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  HOLDINGS_ROWS,
  HoldingsView,
  type HoldingsRowId,
  type HoldingsLabels,
  type HoldingsViewProps,
} from './holdings-view';
import type { HoldingsRowView } from './holdings-row';

const BAG: HoldingsRowView = { amount: 12.5, priced: 12, eligible: 47, withheld: false };
const HEROES: HoldingsRowView = { amount: 8, priced: 3, eligible: 9, withheld: false };
const SKINS: HoldingsRowView = { amount: 4.25, priced: 2, eligible: 5, withheld: false };
const TOTAL = BAG.amount + HEROES.amount + SKINS.amount;

/**
 * Every string the view can print carries `voice`, so an assertion can tell one wording from
 * another and no test can pass by matching a string the view hardcoded.
 */
function labelsSpeaking(voice: string): HoldingsLabels {
  const row = (name: string) => ({
    title: `${voice} ${name}`,
    coverage: (priced: number, eligible: number) =>
      `${voice} ${priced} of ${eligible} ${name} priced`,
    withheld: `${voice} ${name} could not be read`,
  });
  return {
    total: `${voice} what this account could sell`,
    partialTotal: `${voice} part of what this account could sell`,
    amount: (value, currency) => `${voice} ${currency} ${value.toFixed(2)}`,
    coverage: (priced, eligible) => `${voice} ${priced} of ${eligible} priced overall`,
    missing: (ids) => `${voice} missing ${ids.join(' and ')}`,
    rows: { bag: row('bag'), heroes: row('heroes'), skins: row('skins') },
    heroesAreAFloor: `${voice} a hero quote knows only its rarity, so this is a floor`,
    skinsCountedWhileWorn: `${voice} a skin counts only while a hero is wearing it`,
  };
}

const LABELS = labelsSpeaking('en');

function render(overrides: Partial<HoldingsViewProps> = {}): string {
  return renderToStaticMarkup(
    createElement(HoldingsView, {
      total: TOTAL,
      currency: 'USD',
      bag: BAG,
      heroes: HEROES,
      skins: SKINS,
      labels: LABELS,
      ...overrides,
    }),
  );
}

function withhold(...components: readonly HoldingsRowId[]): Partial<HoldingsViewProps> {
  const unread: HoldingsRowView = { amount: 0, priced: 0, eligible: 0, withheld: true };
  const rows: Partial<HoldingsViewProps> = { bag: BAG, heroes: HEROES, skins: SKINS };
  for (const component of components) rows[component] = unread;
  return rows;
}

function renderWithholding(components: readonly HoldingsRowId[]): string {
  return render(withhold(...components));
}

/** The text of one `data-testid` slot, or null when the view did not render it at all. */
function slot(html: string, testId: string): string | null {
  return new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? null;
}

/** Every string the markup actually puts in front of a reader, tags and attributes dropped. */
function visibleText(html: string): string[] {
  return html
    .split(/<[^>]*>/)
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
}

function everyNonEmptySubset(components: readonly HoldingsRowId[]): HoldingsRowId[][] {
  const all = components.reduce<HoldingsRowId[][]>(
    (found, component) => [...found, ...found.map((subset) => [...subset, component])],
    [[]],
  );
  return all.slice(1);
}

const EVERY_WITHHOLDING = everyNonEmptySubset(HOLDINGS_ROWS);

describe('HoldingsView — the three components and their coverage', () => {
  it('prints each component amount beside the count that amount reaches', () => {
    const html = render();

    expect(slot(html, 'account-holdings-bag-amount')).toBe('en USD 12.50');
    expect(slot(html, 'account-holdings-bag-coverage')).toBe('en 12 of 47 bag priced');
    expect(slot(html, 'account-holdings-heroes-amount')).toBe('en USD 8.00');
    expect(slot(html, 'account-holdings-heroes-coverage')).toBe('en 3 of 9 heroes priced');
    expect(slot(html, 'account-holdings-skins-amount')).toBe('en USD 4.25');
    expect(slot(html, 'account-holdings-skins-coverage')).toBe('en 2 of 5 skins priced');
  });

  it('names every component, so a reader knows what the three figures are', () => {
    const html = render();

    for (const title of ['en bag', 'en heroes', 'en skins']) expect(html).toContain(title);
  });

  it('prints no component figure without its coverage beside it', () => {
    const html = render();

    for (const component of HOLDINGS_ROWS) {
      expect(slot(html, `account-holdings-${component}-amount`)).not.toBeNull();
      expect(slot(html, `account-holdings-${component}-coverage`)).not.toBeNull();
    }
  });

  it('still prints a coverage line for a component nothing is quoted for', () => {
    const nothingQuoted: HoldingsRowView = { amount: 0, priced: 0, eligible: 5, withheld: false };

    expect(slot(render({ skins: nothingQuoted }), 'account-holdings-skins-coverage')).toBe(
      'en 0 of 5 skins priced',
    );
  });

  it('heads the rows with the total it was given', () => {
    expect(slot(render(), 'account-holdings-total')).toBe('en USD 24.75');
  });

  it('sums the headline coverage from the component counts rather than taking its own', () => {
    const priced = BAG.priced + HEROES.priced + SKINS.priced;
    const eligible = BAG.eligible + HEROES.eligible + SKINS.eligible;

    expect(render()).toContain(`en ${priced} of ${eligible} priced overall`);
  });
});

describe('HoldingsView — a component that could not be read', () => {
  it('re-captions the headline for every combination of withheld components', () => {
    const complete = slot(render(), 'account-holdings-caption');

    expect(complete).toBe(LABELS.total);
    for (const missing of EVERY_WITHHOLDING) {
      const caption = slot(renderWithholding(missing), 'account-holdings-caption');
      expect(caption, `withholding ${missing.join('+')} left the headline claiming the account`)
        .not.toBe(complete);
      expect(caption).toBe(LABELS.partialTotal);
    }
  });

  it('names exactly the components it could not read, and only those', () => {
    for (const missing of EVERY_WITHHOLDING) {
      expect(slot(renderWithholding(missing), 'account-holdings-missing')).toBe(
        `en missing ${missing.join(' and ')}`,
      );
    }
  });

  it('says nothing is missing while every component was read', () => {
    expect(slot(render(), 'account-holdings-missing')).toBeNull();
  });

  it('prints the row notice in place of a figure, so an unread component is not worth zero', () => {
    const html = renderWithholding(['heroes']);

    expect(slot(html, 'account-holdings-heroes-withheld')).toBe('en heroes could not be read');
    expect(slot(html, 'account-holdings-heroes-amount')).toBeNull();
    expect(slot(html, 'account-holdings-heroes-coverage')).toBeNull();
  });

  it('leaves the components it did read untouched', () => {
    const html = renderWithholding(['heroes']);

    expect(slot(html, 'account-holdings-bag-amount')).toBe('en USD 12.50');
    expect(slot(html, 'account-holdings-skins-amount')).toBe('en USD 4.25');
  });

  it('drops a withheld component from the headline coverage rather than counting it as zero', () => {
    expect(renderWithholding(['bag'])).toContain(
      `en ${HEROES.priced + SKINS.priced} of ${HEROES.eligible + SKINS.eligible} priced overall`,
    );
  });

  it('keeps the figure on screen when everything is withheld, under a caption that disowns it', () => {
    const html = render({ ...withhold(...HOLDINGS_ROWS), total: 0 });

    expect(slot(html, 'account-holdings-caption')).toBe(LABELS.partialTotal);
    expect(slot(html, 'account-holdings-missing')).toBe('en missing bag and heroes and skins');
    expect(slot(html, 'account-holdings-total')).toBe('en USD 0.00');
    expect(html).toContain('en 0 of 0 priced overall');
  });
});

describe('HoldingsView — the two things a reader would otherwise get wrong', () => {
  const everyState = () => [render(), ...EVERY_WITHHOLDING.map(renderWithholding)];

  it('says the heroes figure is a floor, as text, in every withholding state', () => {
    for (const html of everyState()) {
      expect(slot(html, 'account-holdings-heroes-floor')).toBe(LABELS.heroesAreAFloor);
    }
  });

  it('says a skin counts only while worn, as text, in every withholding state', () => {
    for (const html of everyState()) {
      expect(slot(html, 'account-holdings-skins-worn')).toBe(LABELS.skinsCountedWhileWorn);
    }
  });

  it('puts both sentences on the screen rather than behind a pointer', () => {
    const html = render();

    expect(html).not.toContain('title=');
    for (const testId of ['account-holdings-heroes-floor', 'account-holdings-skins-worn']) {
      const opening = new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '';
      expect(opening).not.toContain('sr-only');
      expect(opening).not.toContain('hidden');
    }
  });
});

describe('HoldingsView — the bag row link', () => {
  const link = () => createElement('span', { 'data-testid': 'bag-link' }, 'open the bag');

  it('renders whatever the host hands it, knowing nothing about routes or tabs', () => {
    const html = render({ bagLink: createElement('a', { href: '/inventory' }, 'open the bag') });

    expect(html).toContain('<a href="/inventory">open the bag</a>');
  });

  it('leaves the bag row whole when no link is given', () => {
    const html = render();

    expect(html).not.toContain('bag-link');
    expect(slot(html, 'account-holdings-bag-amount')).toBe('en USD 12.50');
    expect(slot(html, 'account-holdings-bag-coverage')).toBe('en 12 of 47 bag priced');
  });

  it('hangs the link on the bag row and on no other', () => {
    const html = render({ bagLink: link() });
    const rowStart = (component: HoldingsRowId) =>
      html.indexOf(`data-testid="account-holdings-${component}"`);

    const linkAt = html.indexOf('data-testid="bag-link"');
    expect(linkAt).toBeGreaterThan(rowStart('bag'));
    expect(linkAt).toBeLessThan(rowStart('heroes'));
  });
});

describe('HoldingsView — the price-age footnote', () => {
  it('sits beside the headline coverage when given', () => {
    expect(slot(render({ footnote: 'quoted 3 hours ago' }), 'account-holdings-footnote')).toBe(
      'quoted 3 hours ago',
    );
  });

  it('is absent, and the coverage still printed, when none is given', () => {
    const html = render();

    expect(slot(html, 'account-holdings-footnote')).toBeNull();
    expect(html).toContain('en 17 of 61 priced overall');
  });
});

describe('HoldingsView — every string comes from the label bag', () => {
  it('speaks entirely in the wording of the bag it was handed', () => {
    const html = renderToStaticMarkup(
      createElement(HoldingsView, {
        total: TOTAL,
        currency: 'BRL',
        bag: BAG,
        heroes: HEROES,
        skins: SKINS,
        labels: labelsSpeaking('pt'),
      }),
    );

    expect(slot(html, 'account-holdings-caption')).toBe('pt what this account could sell');
    expect(slot(html, 'account-holdings-total')).toBe('pt BRL 24.75');
    expect(slot(html, 'account-holdings-bag-coverage')).toBe('pt 12 of 47 bag priced');
    expect(slot(html, 'account-holdings-heroes-floor')).toBe(
      'pt a hero quote knows only its rarity, so this is a floor',
    );
    expect(visibleText(html).filter((text) => !text.startsWith('pt '))).toEqual([]);
  });

  it('formats no number itself — every figure arrives through a label callback', () => {
    const html = renderToStaticMarkup(
      createElement(HoldingsView, {
        total: TOTAL,
        currency: 'USD',
        bag: BAG,
        heroes: HEROES,
        skins: SKINS,
        labels: { ...LABELS, amount: () => 'no figure here' },
      }),
    );

    expect(slot(html, 'account-holdings-total')).toBe('no figure here');
    for (const component of HOLDINGS_ROWS) {
      expect(slot(html, `account-holdings-${component}-amount`)).toBe('no figure here');
    }
  });
});
