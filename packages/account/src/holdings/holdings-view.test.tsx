import { describe, expect, it } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Accordion } from '@bombfarm/ui';
import { HoldingsView, type HoldingsLabels, type HoldingsViewProps } from './holdings-view';
import {
  HOLDINGS_COMPONENTS,
  HoldingsRow,
  type HoldingsComponentId,
  type HoldingsComponentView,
} from './holdings-row';

/**
 * The inventory holds more things than a disclosure can carry, so it lists nothing and leads out to
 * the screen that does. Heroes and skins list what they are made of, unpriced entries included.
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
    title: `${voice} what this account could sell`,
    partial: `${voice} part of the account only`,
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

/**
 * One row with its disclosure already open — the state a reader reaches by clicking the trigger.
 * A static render never clicks, so the open state is supplied by the accordion the row sits in,
 * which is where the view itself keeps it.
 */
function openRow(
  id: HoldingsComponentId,
  {
    component = EN[id],
    labels = LABELS,
    currency = 'USD',
    action,
  }: {
    component?: HoldingsComponentView;
    labels?: HoldingsLabels;
    currency?: string;
    action?: ReactNode;
  } = {},
): string {
  return renderToStaticMarkup(
    createElement(Accordion.Root, {
      multiple: true,
      defaultValue: [id],
      children: createElement(HoldingsRow, {
        id,
        component,
        currency,
        labels: labels.components[id],
        amount: labels.amount,
        unpriced: labels.unpriced,
        action,
      }),
    }),
  );
}

function withhold(...ids: readonly HoldingsComponentId[]): Partial<HoldingsViewProps> {
  const components: Partial<HoldingsViewProps> = { ...EN };
  for (const id of ids) components[id] = unread(EN[id]);
  return components;
}

/** Unread, and still carrying the entries it would have listed had anything read it. */
function unread(component: HoldingsComponentView): HoldingsComponentView {
  return { ...component, amount: 0, priced: 0, eligible: 0, withheld: true };
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

/** Everything one row's markup covers, which ends where the next row's marker begins. */
function rowMarkup(html: string, id: HoldingsComponentId): string {
  const next = HOLDINGS_COMPONENTS[HOLDINGS_COMPONENTS.indexOf(id) + 1];
  const start = html.indexOf(`data-testid="account-holdings-${id}"`);
  const end = next === undefined ? html.length : html.indexOf(`data-testid="account-holdings-${next}"`);
  return html.slice(start, end);
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
});

describe('HoldingsView — three rows, whatever the width', () => {
  it('draws each component once, and nothing else that could be taken for a fourth', () => {
    const html = render();

    for (const id of HOLDINGS_COMPONENTS) {
      expect(slots(html, `account-holdings-${id}`)).toHaveLength(1);
    }
  });

  it('keeps the three in the order they are summed in', () => {
    const html = render();
    const at = (id: HoldingsComponentId) => html.indexOf(`data-testid="account-holdings-${id}"`);

    expect(at('inventory')).toBeLessThan(at('heroes'));
    expect(at('heroes')).toBeLessThan(at('skins'));
  });

  it('stacks them, so no width can put two of them side by side or wrap the third', () => {
    const html = render();

    // The three were columns an auto-fit grid sized: narrowing the window wrapped the third under
    // a component it has nothing to do with, and the figures stopped reading as belonging to
    // anything. A single flex column cannot reflow, at any measure.
    expect(html).toContain('class="flex flex-col gap-1"');
    expect(html).not.toContain('grid');
    expect(html).not.toContain('auto-fit');
  });

  it('sits under a section title of its own, as the panels beside it do', () => {
    const html = render();

    expect(html).toContain(`<h2 class="m-0 text-[13px] font-bold tracking-[0.04em] uppercase">${LABELS.title}</h2>`);
    expect(html.indexOf(LABELS.title)).toBeLessThan(html.indexOf('data-testid="account-holdings-total"'));
  });
});

describe('HoldingsView — what a component is made of, behind its own disclosure', () => {
  it('lists nothing until its disclosure is opened', () => {
    const html = render();

    for (const id of ['heroes', 'skins'] as const) {
      expect(slots(html, `account-holdings-${id}-entry-name`)).toEqual([]);
      expect(slot(html, `account-holdings-${id}-entries`)).toBeNull();
    }
  });

  it('offers every component that holds entries a disclosure to open', () => {
    const html = render();

    for (const id of ['heroes', 'skins'] as const) {
      expect(rowMarkup(html, id)).toContain('aria-expanded="false"');
    }
  });

  it('offers no disclosure on the inventory, which has no list to reveal', () => {
    const html = render({ inventoryLink: createElement('a', { href: '/inventory' }, 'open it') });
    const inventory = rowMarkup(html, 'inventory');

    // An empty disclosure that opens onto nothing is worse than none: the inventory holds more
    // things than a list here could carry, and the link is what stands in for that list.
    expect(inventory).not.toContain('aria-expanded');
    expect(inventory).toContain('href="/inventory"');
    expect(slot(html, 'account-holdings-inventory-amount')).toBe('en USD 12.50');
  });

  it('reveals that component entries once opened, and only that component', () => {
    const html = openRow('heroes');

    expect(slots(html, 'account-holdings-heroes-entry-name')).toEqual([
      'en Kendo',
      'en Dano',
      'en Folego',
    ]);
    expect(slots(html, 'account-holdings-skins-entry-name')).toEqual([]);
  });

  it('lists every entry it was handed, in the order it was handed them', () => {
    expect(slots(openRow('skins'), 'account-holdings-skins-entry-name')).toEqual([
      'en Royal Sentinel',
      'en Deep Diver',
    ]);
  });

  it('keeps a reordered list in its new order rather than one of its own', () => {
    const [first, second, third] = EN.heroes.entries;
    const reversed = { ...EN.heroes, entries: [third, second, first] };

    expect(
      slots(openRow('heroes', { component: reversed }), 'account-holdings-heroes-entry-name'),
    ).toEqual(['en Folego', 'en Dano', 'en Kendo']);
  });

  it('prices each entry through the label bag, in the order the names run', () => {
    expect(slots(openRow('heroes'), 'account-holdings-heroes-entry-amount')).toEqual([
      'en USD 6.00',
      'en USD 2.00',
    ]);
  });

  it('prints the detail beside an entry that carries one', () => {
    expect(slots(openRow('heroes'), 'account-holdings-heroes-entry-detail')).toEqual([
      'en rare',
      'en rare',
      'en common',
    ]);
  });

  it('prints no detail for entries that carry none, rather than an empty one', () => {
    const html = openRow('skins');

    expect(slots(html, 'account-holdings-skins-entry-detail')).toEqual([]);
    expect(slots(html, 'account-holdings-skins-entry-name')).toHaveLength(2);
  });

  it('shows an entry the market is listing nothing for, and marks it as unpriced', () => {
    expect(slots(openRow('skins'), 'account-holdings-skins-entry-name')).toContain('en Deep Diver');
    expect(slots(openRow('skins'), 'account-holdings-skins-entry-unpriced')).toEqual([
      'en nothing listed',
    ]);
    expect(slots(openRow('heroes'), 'account-holdings-heroes-entry-unpriced')).toEqual([
      'en nothing listed',
    ]);
  });

  it('leaves an unpriced entry without a figure rather than printing a zero for it', () => {
    const html = openRow('skins');

    expect(slots(html, 'account-holdings-skins-entry-amount')).toEqual(['en USD 4.25']);
    expect(html).not.toContain('en USD 0.00');
  });

  it('lists as many entries as the component calls eligible, so its coverage can be investigated', () => {
    for (const id of ['heroes', 'skins'] as const) {
      expect(slots(openRow(id), `account-holdings-${id}-entry-name`)).toHaveLength(EN[id].eligible);
    }
  });

  it('offers no disclosure for a component handed no entries, and keeps its figures', () => {
    const html = render();

    expect(rowMarkup(html, 'inventory')).not.toContain('aria-expanded');
    expect(slot(html, 'account-holdings-inventory-entries')).toBeNull();
    expect(slot(html, 'account-holdings-inventory-amount')).toBe('en USD 12.50');
  });

  it('reveals nothing for a component it could not read, whatever entries came with it', () => {
    const html = openRow('heroes', { component: unread(EN.heroes) });

    expect(slots(html, 'account-holdings-heroes-entry-name')).toEqual([]);
    expect(html).not.toContain('aria-expanded');
    expect(slot(html, 'account-holdings-heroes-withheld')).toBe('en heroes could not be read');
  });
});

describe('HoldingsView — an entry whose leading cell the host drew itself', () => {
  const drawn = (position: number) =>
    createElement('span', { 'data-testid': `drawn-${String(position)}` }, `drawn ${String(position)}`);

  /** Each hero arrives already depicted; the skins beside them stay plain names. */
  const heroesDrawn: HoldingsComponentView = {
    ...EN.heroes,
    entries: EN.heroes.entries.map((entry, position) => ({ ...entry, leading: drawn(position) })),
  };

  const renderDrawn = () => openRow('heroes', { component: heroesDrawn });

  /** The markup of one entry, which `split` ends at the next entry marker. */
  function entryChunks(html: string, testId: string): string[] {
    return html
      .split(`data-testid="${testId}-entry"`)
      .slice(1)
      .map((chunk) => chunk.split('</ul>')[0] ?? chunk);
  }

  it('renders the node it was handed', () => {
    const html = renderDrawn();

    expect(slots(html, 'drawn-0')).toEqual(['drawn 0']);
    expect(slots(html, 'drawn-1')).toEqual(['drawn 1']);
    expect(slots(html, 'drawn-2')).toEqual(['drawn 2']);
  });

  it('drops the plain name and detail it would otherwise have printed, rather than doubling them', () => {
    const html = renderDrawn();

    expect(slots(html, 'account-holdings-heroes-entry-name')).toEqual([]);
    expect(slots(html, 'account-holdings-heroes-entry-detail')).toEqual([]);
    expect(html).not.toContain('en Kendo');
  });

  it('keeps the plain pair for the entries of a component that handed over no node', () => {
    const html = openRow('skins');

    expect(slots(html, 'account-holdings-skins-entry-name')).toEqual([
      'en Royal Sentinel',
      'en Deep Diver',
    ]);
    expect(slots(html, 'account-holdings-skins-entry-leading')).toEqual([]);
  });

  it('pairs each drawn entry with its own price, in the order the entries run', () => {
    const chunks = entryChunks(renderDrawn(), 'account-holdings-heroes');

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toContain('drawn 0');
    expect(chunks[0]).toContain('en USD 6.00');
    expect(chunks[1]).toContain('drawn 1');
    expect(chunks[1]).toContain('en USD 2.00');
    expect(chunks[2]).toContain('drawn 2');
    expect(chunks[2]).toContain('en nothing listed');
    expect(chunks[2]).not.toContain('en USD');
  });

  it('still lists an entry the market is quoting nothing for, node and marker both', () => {
    const html = renderDrawn();

    expect(slots(html, 'drawn-2')).toEqual(['drawn 2']);
    expect(slots(html, 'account-holdings-heroes-entry-unpriced')).toEqual(['en nothing listed']);
  });

  it('lists nothing at all for a component it could not read, nodes included', () => {
    const html = openRow('heroes', { component: unread(heroesDrawn) });

    expect(html).not.toContain('drawn-0');
    expect(slot(html, 'account-holdings-heroes-withheld')).toBe('en heroes could not be read');
  });
});

describe('HoldingsView — a component that could not be read', () => {
  it('qualifies the figure itself for every combination of withheld components', () => {
    expect(slot(render(), 'account-holdings-partial')).toBeNull();
    for (const missing of EVERY_WITHHOLDING) {
      const html = renderWithholding(missing);
      const qualifier = slot(html, 'account-holdings-partial');

      expect(qualifier, `withholding ${missing.join('+')} left the figure claiming the account`).toBe(
        LABELS.partial,
      );
      // Against the number it qualifies, ahead of the coverage line — a title cannot carry this,
      // because the title is the same whatever was read.
      expect(html.indexOf(LABELS.partial)).toBeGreaterThan(
        html.indexOf('data-testid="account-holdings-total"'),
      );
      expect(html.indexOf(LABELS.partial)).toBeLessThan(
        html.indexOf('data-testid="account-holdings-inventory"'),
      );
    }
  });

  it('keeps the section title the same whatever was read, so only the figure is qualified', () => {
    for (const missing of EVERY_WITHHOLDING) {
      expect(renderWithholding(missing)).toContain(LABELS.title);
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

  it('offers no disclosure on a row it could not read', () => {
    expect(rowMarkup(renderWithholding(['heroes']), 'heroes')).not.toContain('aria-expanded');
  });

  it('leaves the components it did read untouched', () => {
    const html = renderWithholding(['heroes']);

    expect(slot(html, 'account-holdings-inventory-amount')).toBe('en USD 12.50');
    expect(slot(html, 'account-holdings-skins-amount')).toBe('en USD 4.25');
    expect(rowMarkup(html, 'skins')).toContain('aria-expanded="false"');
  });

  it('drops a withheld component from the headline coverage rather than counting it as zero', () => {
    expect(renderWithholding(['inventory'])).toContain(
      `en ${EN.heroes.priced + EN.skins.priced} of ${EN.heroes.eligible + EN.skins.eligible} priced overall`,
    );
  });

  it('keeps the figure on screen when everything is withheld, qualified rather than disowned', () => {
    const html = render({ ...withhold(...HOLDINGS_COMPONENTS), total: 0 });

    expect(slot(html, 'account-holdings-partial')).toBe(LABELS.partial);
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

  it('leaves the inventory row whole when no link is given', () => {
    const html = render();

    expect(html).not.toContain('inventory-link');
    expect(slot(html, 'account-holdings-inventory-amount')).toBe('en USD 12.50');
    expect(slot(html, 'account-holdings-inventory-coverage')).toBe('en 12 of 47 inventory priced');
  });

  it('hangs the link on the inventory row and on no other', () => {
    const html = render({ inventoryLink: link() });

    expect(rowMarkup(html, 'inventory')).toContain('data-testid="inventory-link"');
    expect(rowMarkup(html, 'heroes')).not.toContain('data-testid="inventory-link"');
    expect(rowMarkup(html, 'skins')).not.toContain('data-testid="inventory-link"');
  });

  it('keeps the link on a row that reveals nothing — the link is what stands in for the list', () => {
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
  const PT = labelsSpeaking('pt');

  const inPortuguese = () => {
    const pt = componentsSpeaking('pt');
    return renderToStaticMarkup(
      createElement(HoldingsView, {
        total: TOTAL,
        currency: 'BRL',
        inventory: pt.inventory,
        heroes: pt.heroes,
        skins: pt.skins,
        labels: PT,
      }),
    );
  };

  it('speaks entirely in the wording of the bag it was handed', () => {
    const html = inPortuguese();

    expect(html).toContain(PT.title);
    expect(slot(html, 'account-holdings-total')).toBe('pt BRL 24.75');
    expect(slot(html, 'account-holdings-inventory-coverage')).toBe('pt 12 of 47 inventory priced');
    expect(slot(html, 'account-holdings-heroes-floor')).toBe(
      'pt a hero quote knows only its rarity, so this is a floor',
    );
    expect(visibleText(html).filter((text) => !text.startsWith('pt '))).toEqual([]);
  });

  it('takes the unpriced marker from the bag rather than wording it itself', () => {
    const html = openRow('skins', {
      component: componentsSpeaking('pt').skins,
      labels: PT,
      currency: 'BRL',
    });

    expect(slots(html, 'account-holdings-skins-entry-unpriced')).toEqual(['pt nothing listed']);
  });

  it('formats no number itself — every figure arrives through a label callback', () => {
    const labels: HoldingsLabels = { ...LABELS, amount: () => 'no figure here' };
    const html = renderToStaticMarkup(
      createElement(HoldingsView, {
        total: TOTAL,
        currency: 'USD',
        inventory: EN.inventory,
        heroes: EN.heroes,
        skins: EN.skins,
        labels,
      }),
    );

    expect(slot(html, 'account-holdings-total')).toBe('no figure here');
    for (const id of HOLDINGS_COMPONENTS) {
      expect(slot(html, `account-holdings-${id}-amount`)).toBe('no figure here');
    }
    expect(
      slots(openRow('heroes', { labels }), 'account-holdings-heroes-entry-amount'),
    ).toEqual(['no figure here', 'no figure here']);
  });
});
