import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  HOLDINGS_COMPONENTS,
  HoldingsView,
  type HoldingsComponentId,
  type HoldingsLabels,
  type HoldingsViewProps,
} from './holdings-view';
import type { HoldingsComponentView } from './holdings-column';

/**
 * The inventory holds more rows than a column can carry, so it lists nothing and leads out to the
 * screen that does. Heroes and skins list what they are made of, unpriced entries included.
 */
function componentsSpeaking(voice: string): Record<HoldingsComponentId, HoldingsComponentView> {
  return {
    inventory: { amount: 12.5, priced: 12, eligible: 47, withheld: false, entries: [] },
    heroes: {
      amount: 8,
      priced: 2,
      eligible: 3,
      withheld: false,
      entries: [
        { name: `${voice} Kendo`, detail: `${voice} rare`, amount: 6 },
        { name: `${voice} Dano`, detail: `${voice} rare`, amount: 2 },
        { name: `${voice} Folego`, detail: `${voice} common`, amount: null },
      ],
    },
    skins: {
      amount: 4.25,
      priced: 1,
      eligible: 2,
      withheld: false,
      entries: [
        { name: `${voice} Royal Sentinel`, amount: 4.25 },
        { name: `${voice} Deep Diver`, amount: null },
      ],
    },
  };
}

const EN = componentsSpeaking('en');
const TOTAL = EN.inventory.amount + EN.heroes.amount + EN.skins.amount;

/**
 * Every string the view can print carries `voice`, so an assertion can tell one wording from
 * another and no test can pass by matching a string the view hardcoded.
 */
function labelsSpeaking(voice: string): HoldingsLabels {
  const component = (name: string) => ({
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
    components: {
      inventory: component('inventory'),
      heroes: component('heroes'),
      skins: component('skins'),
    },
    unpriced: `${voice} nothing listed`,
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
      inventory: EN.inventory,
      heroes: EN.heroes,
      skins: EN.skins,
      labels: LABELS,
      ...overrides,
    }),
  );
}

function withhold(...ids: readonly HoldingsComponentId[]): Partial<HoldingsViewProps> {
  const unread: HoldingsComponentView = {
    amount: 0,
    priced: 0,
    eligible: 0,
    withheld: true,
    entries: [],
  };
  const components: Partial<HoldingsViewProps> = { ...EN };
  for (const id of ids) components[id] = unread;
  return components;
}

function renderWithholding(ids: readonly HoldingsComponentId[]): string {
  return render(withhold(...ids));
}

/** The text of one `data-testid` slot, or null when the view did not render it at all. */
function slot(html: string, testId: string): string | null {
  return new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? null;
}

/** The text of every `data-testid` slot of that name, in the order the markup carries them. */
function slots(html: string, testId: string): string[] {
  return [...html.matchAll(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`, 'g'))].map(
    (match) => match[1] ?? '',
  );
}

/** Every string the markup actually puts in front of a reader, tags and attributes dropped. */
function visibleText(html: string): string[] {
  return html
    .split(/<[^>]*>/)
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
}

function everyNonEmptySubset(ids: readonly HoldingsComponentId[]): HoldingsComponentId[][] {
  const all = ids.reduce<HoldingsComponentId[][]>(
    (found, id) => [...found, ...found.map((subset) => [...subset, id])],
    [[]],
  );
  return all.slice(1);
}

const EVERY_WITHHOLDING = everyNonEmptySubset(HOLDINGS_COMPONENTS);

describe('HoldingsView — the three components and their coverage', () => {
  it('prints each component amount beside the count that amount reaches', () => {
    const html = render();

    expect(slot(html, 'account-holdings-inventory-amount')).toBe('en USD 12.50');
    expect(slot(html, 'account-holdings-inventory-coverage')).toBe('en 12 of 47 inventory priced');
    expect(slot(html, 'account-holdings-heroes-amount')).toBe('en USD 8.00');
    expect(slot(html, 'account-holdings-heroes-coverage')).toBe('en 2 of 3 heroes priced');
    expect(slot(html, 'account-holdings-skins-amount')).toBe('en USD 4.25');
    expect(slot(html, 'account-holdings-skins-coverage')).toBe('en 1 of 2 skins priced');
  });

  it('names every component, so a reader knows what the three figures are', () => {
    const html = render();

    for (const title of ['en inventory', 'en heroes', 'en skins']) expect(html).toContain(title);
  });

  it('prints no component figure without its coverage beside it', () => {
    const html = render();

    for (const id of HOLDINGS_COMPONENTS) {
      expect(slot(html, `account-holdings-${id}-amount`)).not.toBeNull();
      expect(slot(html, `account-holdings-${id}-coverage`)).not.toBeNull();
    }
  });

  it('still prints a coverage line for a component nothing is quoted for', () => {
    const nothingQuoted: HoldingsComponentView = {
      amount: 0,
      priced: 0,
      eligible: 5,
      withheld: false,
      entries: [],
    };

    expect(slot(render({ skins: nothingQuoted }), 'account-holdings-skins-coverage')).toBe(
      'en 0 of 5 skins priced',
    );
  });

  it('heads the components with the total it was given', () => {
    expect(slot(render(), 'account-holdings-total')).toBe('en USD 24.75');
  });

  it('sums the headline coverage from the component counts rather than taking its own', () => {
    const priced = EN.inventory.priced + EN.heroes.priced + EN.skins.priced;
    const eligible = EN.inventory.eligible + EN.heroes.eligible + EN.skins.eligible;

    expect(render()).toContain(`en ${priced} of ${eligible} priced overall`);
  });

  it('lays the three side by side under a grid the available width sizes, never a stack', () => {
    const html = render();

    expect(html).toMatch(/class="grid grid-cols-\[repeat\(auto-fit,minmax\([^)]+,1fr\)\)\]/);
    expect(html).not.toContain('divide-y');
  });
});

describe('HoldingsView — what a component is made of', () => {
  it('lists every entry it was handed, in the order it was handed them', () => {
    const html = render();

    expect(slots(html, 'account-holdings-heroes-entry-name')).toEqual([
      'en Kendo',
      'en Dano',
      'en Folego',
    ]);
    expect(slots(html, 'account-holdings-skins-entry-name')).toEqual([
      'en Royal Sentinel',
      'en Deep Diver',
    ]);
  });

  it('keeps a reordered list in its new order rather than one of its own', () => {
    const [first, second, third] = EN.heroes.entries;
    const reversed = { ...EN.heroes, entries: [third, second, first] };

    expect(slots(render({ heroes: reversed }), 'account-holdings-heroes-entry-name')).toEqual([
      'en Folego',
      'en Dano',
      'en Kendo',
    ]);
  });

  it('prices each entry through the label bag, in the order the names run', () => {
    expect(slots(render(), 'account-holdings-heroes-entry-amount')).toEqual([
      'en USD 6.00',
      'en USD 2.00',
    ]);
  });

  it('prints the detail beside an entry that carries one', () => {
    expect(slots(render(), 'account-holdings-heroes-entry-detail')).toEqual([
      'en rare',
      'en rare',
      'en common',
    ]);
  });

  it('prints no detail for entries that carry none, rather than an empty one', () => {
    const html = render();

    expect(slots(html, 'account-holdings-skins-entry-detail')).toEqual([]);
    expect(slots(html, 'account-holdings-skins-entry-name')).toHaveLength(2);
  });

  it('shows an entry the market is listing nothing for, and marks it as unpriced', () => {
    const html = render();

    expect(slots(html, 'account-holdings-skins-entry-name')).toContain('en Deep Diver');
    expect(slots(html, 'account-holdings-skins-entry-unpriced')).toEqual(['en nothing listed']);
    expect(slots(html, 'account-holdings-heroes-entry-unpriced')).toEqual(['en nothing listed']);
  });

  it('leaves an unpriced entry without a figure rather than printing a zero for it', () => {
    const html = render();

    expect(slots(html, 'account-holdings-skins-entry-amount')).toEqual(['en USD 4.25']);
    expect(html).not.toContain('en USD 0.00');
  });

  it('lists as many entries as the component calls eligible, so its coverage can be investigated', () => {
    const html = render();

    for (const id of ['heroes', 'skins'] as const) {
      expect(slots(html, `account-holdings-${id}-entry-name`)).toHaveLength(EN[id].eligible);
    }
  });

  it('lists nothing for a component handed no entries, and keeps that component figures', () => {
    const html = render();

    expect(slots(html, 'account-holdings-inventory-entry-name')).toEqual([]);
    expect(slot(html, 'account-holdings-inventory-entries')).toBeNull();
    expect(slot(html, 'account-holdings-inventory-amount')).toBe('en USD 12.50');
  });

  it('lists nothing for a component it could not read, whatever entries came with it', () => {
    const html = render({ heroes: { ...EN.heroes, withheld: true } });

    expect(slots(html, 'account-holdings-heroes-entry-name')).toEqual([]);
    expect(slot(html, 'account-holdings-heroes-withheld')).toBe('en heroes could not be read');
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

  it('prints the notice in place of a figure, so an unread component is not worth zero', () => {
    const html = renderWithholding(['heroes']);

    expect(slot(html, 'account-holdings-heroes-withheld')).toBe('en heroes could not be read');
    expect(slot(html, 'account-holdings-heroes-amount')).toBeNull();
    expect(slot(html, 'account-holdings-heroes-coverage')).toBeNull();
  });

  it('leaves the components it did read untouched', () => {
    const html = renderWithholding(['heroes']);

    expect(slot(html, 'account-holdings-inventory-amount')).toBe('en USD 12.50');
    expect(slot(html, 'account-holdings-skins-amount')).toBe('en USD 4.25');
    expect(slots(html, 'account-holdings-skins-entry-name')).toHaveLength(2);
  });

  it('drops a withheld component from the headline coverage rather than counting it as zero', () => {
    expect(renderWithholding(['inventory'])).toContain(
      `en ${EN.heroes.priced + EN.skins.priced} of ${EN.heroes.eligible + EN.skins.eligible} priced overall`,
    );
  });

  it('keeps the figure on screen when everything is withheld, under a caption that disowns it', () => {
    const html = render({ ...withhold(...HOLDINGS_COMPONENTS), total: 0 });

    expect(slot(html, 'account-holdings-caption')).toBe(LABELS.partialTotal);
    expect(slot(html, 'account-holdings-missing')).toBe('en missing inventory and heroes and skins');
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

describe('HoldingsView — the inventory link', () => {
  const link = () => createElement('span', { 'data-testid': 'inventory-link' }, 'open it');

  it('renders whatever the host hands it, knowing nothing about routes or tabs', () => {
    const html = render({
      inventoryLink: createElement('a', { href: '/inventory' }, 'open the inventory'),
    });

    expect(html).toContain('<a href="/inventory">open the inventory</a>');
  });

  it('leaves the inventory column whole when no link is given', () => {
    const html = render();

    expect(html).not.toContain('inventory-link');
    expect(slot(html, 'account-holdings-inventory-amount')).toBe('en USD 12.50');
    expect(slot(html, 'account-holdings-inventory-coverage')).toBe('en 12 of 47 inventory priced');
  });

  it('hangs the link on the inventory column and on no other', () => {
    const html = render({ inventoryLink: link() });
    const columnStart = (id: HoldingsComponentId) =>
      html.indexOf(`data-testid="account-holdings-${id}"`);

    const linkAt = html.indexOf('data-testid="inventory-link"');
    expect(linkAt).toBeGreaterThan(columnStart('inventory'));
    expect(linkAt).toBeLessThan(columnStart('heroes'));
  });

  it('keeps the link on a column that lists nothing — the link is what stands in for the list', () => {
    const html = render({ inventoryLink: link() });

    expect(html).toContain('data-testid="inventory-link"');
    expect(slots(html, 'account-holdings-inventory-entry-name')).toEqual([]);
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
    expect(html).toContain('en 15 of 52 priced overall');
  });
});

describe('HoldingsView — every string comes from the label bag', () => {
  const inPortuguese = () => {
    const pt = componentsSpeaking('pt');
    return renderToStaticMarkup(
      createElement(HoldingsView, {
        total: TOTAL,
        currency: 'BRL',
        inventory: pt.inventory,
        heroes: pt.heroes,
        skins: pt.skins,
        labels: labelsSpeaking('pt'),
      }),
    );
  };

  it('speaks entirely in the wording of the bag it was handed', () => {
    const html = inPortuguese();

    expect(slot(html, 'account-holdings-caption')).toBe('pt what this account could sell');
    expect(slot(html, 'account-holdings-total')).toBe('pt BRL 24.75');
    expect(slot(html, 'account-holdings-inventory-coverage')).toBe('pt 12 of 47 inventory priced');
    expect(slot(html, 'account-holdings-heroes-floor')).toBe(
      'pt a hero quote knows only its rarity, so this is a floor',
    );
    expect(visibleText(html).filter((text) => !text.startsWith('pt '))).toEqual([]);
  });

  it('takes the unpriced marker from the bag rather than wording it itself', () => {
    expect(slots(inPortuguese(), 'account-holdings-skins-entry-unpriced')).toEqual([
      'pt nothing listed',
    ]);
  });

  it('formats no number itself — every figure arrives through a label callback', () => {
    const html = renderToStaticMarkup(
      createElement(HoldingsView, {
        total: TOTAL,
        currency: 'USD',
        inventory: EN.inventory,
        heroes: EN.heroes,
        skins: EN.skins,
        labels: { ...LABELS, amount: () => 'no figure here' },
      }),
    );

    expect(slot(html, 'account-holdings-total')).toBe('no figure here');
    for (const id of HOLDINGS_COMPONENTS) {
      expect(slot(html, `account-holdings-${id}-amount`)).toBe('no figure here');
    }
    expect(slots(html, 'account-holdings-heroes-entry-amount')).toEqual([
      'no figure here',
      'no figure here',
    ]);
  });
});
