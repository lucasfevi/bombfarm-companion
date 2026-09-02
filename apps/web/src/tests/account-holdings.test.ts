import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HoldingsView } from '@bombfarm/account/holdings';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { RarityKey } from '@bombfarm/domain/model';
import type { CatalogView, HoldingsTally, MarketEntry, MarketSnapshot } from '@bombfarm/pricing';
import {
  buildSnapshot,
  categoryKey,
  heroPriceKey,
  priceKey,
  resolveItemPrice,
} from '@bombfarm/pricing';
import { AccountHoldingsSection } from '@/features/account/components/account-holdings-section';
import type { HoldingsHero } from '@/features/account/model/account-holdings';
import {
  accountHoldingsFrom,
  holdingsComponents,
  holdingsLabels,
  inventoryFromStorage,
  priceableHeroes,
  skinsWornBy,
} from '@/features/account/model/account-holdings';
import { inventoryTotals } from '@/features/inventory/model/use-inventory-prices';
import { INVENTORY_VIEW_KEY, loadInventoryView } from '@/shared/lib/inventory-view-storage';
import { STRINGS } from '@/shared/i18n';
import type { Lang } from '@/shared/i18n';

const CATALOG: CatalogView = {
  defs: [{ defId: 'ember_arma', set: 'ember', slot: 'arma', level: 10 }],
  rarityIdxs: [1, 2],
  rarityTokens: { 1: 'incomum', 2: 'raro' },
  defIdByHash: {},
};

function marketEntry(
  overrides: Partial<MarketEntry> & { hashName: string; key: string },
): MarketEntry {
  return {
    name: overrides.hashName,
    defId: null,
    kind: null,
    category: null,
    set: null,
    slot: null,
    rarityIdx: null,
    level: null,
    act: null,
    lowestNative: {},
    nativeQuotedUtc: null,
    lowestUsd: 1,
    listings: 1,
    iconUrl: null,
    fetchedUtc: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

/** USD prices with a BRL rate of 5, so a converted figure is visibly not its USD source. */
const SNAPSHOT: MarketSnapshot = buildSnapshot({
  entries: [
    marketEntry({ hashName: 'Ember Weapon', key: priceKey('ember_arma', 1), lowestUsd: 2 }),
    marketEntry({
      hashName: 'Ember Weapon (Rare)',
      key: priceKey('ember_arma', 2),
      lowestUsd: null,
      listings: 0,
    }),
    marketEntry({ hashName: 'Hero (Rare)', key: heroPriceKey(2), lowestUsd: 10 }),
    marketEntry({
      hashName: 'Royal Sentinel Skin',
      key: categoryKey('skin', 'Royal Sentinel Skin'),
      lowestUsd: 6,
    }),
  ],
  prior: null,
  catalog: CATALOG,
  fx: { USD: 1, BRL: 5 },
  anomalies: [],
  searchCalls: 1,
  enumerationComplete: true,
  now: () => Date.parse('2026-09-01T12:00:00.000Z'),
});

function inventoryItem(overrides: Partial<InventoryViewItem> = {}): InventoryViewItem {
  return {
    id: 'i1',
    defId: 'ember_arma',
    kind: 'equipment',
    categoryCode: 1,
    set: 'ember',
    rarityIdx: 1,
    rarityCode: 'incomum',
    slot: 'arma',
    level: 10,
    upgrade: 0,
    power: 1,
    sellValueGold: 0,
    sellable: true,
    tradable: true,
    marketBlocked: false,
    locked: false,
    equipped: false,
    equippedBy: null,
    inStash: false,
    stats: [],
    defResolved: true,
    ...overrides,
  };
}

/** One priced item, one sellable-but-unlisted item, one the game forbids selling. */
const INVENTORY = [
  inventoryItem({ id: 'priced' }),
  inventoryItem({ id: 'unlisted', rarityIdx: 2 }),
  inventoryItem({ id: 'bound', tradable: false }),
];

const ROYAL_SENTINEL = 8;
/** Named by the skin table, and deliberately absent from the snapshot above. */
const FOREST_WARDEN = 4;

/** One hero the snapshot quotes, one the account binds, one of a rarity nobody is listing. */
const ROSTER: {
  name: string;
  rarity: RarityKey;
  marketable?: boolean;
  skin: number;
  rank?: string;
  level?: number;
}[] = [
  { name: 'Aria', rarity: 'Raro', marketable: true, skin: ROYAL_SENTINEL, rank: 'S', level: 42 },
  { name: 'Bran', rarity: 'Raro', marketable: false, skin: ROYAL_SENTINEL },
  { name: 'Cyra', rarity: 'Incomum', marketable: true, skin: 0 },
];

const wornBy = (roster: readonly { skin: number }[]) => roster.map((hero) => hero.skin);

const holdingsOf = (
  inventory: readonly InventoryViewItem[] | null,
  skinsWorn: readonly number[] | null,
  snapshot: MarketSnapshot | null = SNAPSHOT,
  heroes: readonly HoldingsHero[] | null = null,
) => accountHoldingsFrom({ inventory, heroes, skinsWorn, snapshot });

/** The four figures a component reports, without the per-thing prices they were summed from. */
const tallyOf = ({ amount, priced, eligible, withheld }: HoldingsTally) => ({
  amount,
  priced,
  eligible,
  withheld,
});

/** The text of one `data-testid` slot, or null when the view did not render it at all. */
function slot(html: string, testId: string): string | null {
  return new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? null;
}

/** Every occurrence of a repeated `data-testid` slot, in document order. */
function slots(html: string, testId: string): string[] {
  return [...html.matchAll(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`, 'g'))].map(
    (match) => match[1] ?? '',
  );
}

/** One entry's own markup, which `split` ends where the next entry begins. */
function entryChunks(html: string, component: string): string[] {
  return html
    .split(`data-testid="account-holdings-${component}-entry"`)
    .slice(1)
    .map((chunk) => chunk.split('</ul>')[0] ?? chunk);
}

function renderSection(
  inventory: readonly InventoryViewItem[] | null,
  skinsWorn: readonly number[] | null,
  heroes: readonly HoldingsHero[] | null = null,
  lang: Lang = 'en',
): string {
  return renderToStaticMarkup(
    createElement(HoldingsView, {
      ...holdingsComponents(holdingsOf(inventory, skinsWorn, SNAPSHOT, heroes), heroes, lang),
      labels: holdingsLabels(STRINGS[lang], lang),
    }),
  );
}

describe('account holdings — the three components the section reads', () => {
  it('prices the inventory in the snapshot currency, over the items the game permits selling', () => {
    expect(tallyOf(holdingsOf(INVENTORY, wornBy(ROSTER)).inventory)).toEqual({
      amount: 10,
      priced: 1,
      eligible: 2,
      withheld: false,
    });
  });

  it('holds one bought skin however many heroes wear it, and drops the birth ones', () => {
    expect(tallyOf(holdingsOf([], wornBy(ROSTER)).skins)).toEqual({
      amount: 30,
      priced: 1,
      eligible: 1,
      withheld: false,
    });
  });

  it('prices the heroes the game permits selling, and leaves the bound ones out of both counts', () => {
    const holdings = holdingsOf(INVENTORY, wornBy(ROSTER), SNAPSHOT, priceableHeroes(ROSTER));

    expect(tallyOf(holdings.heroes)).toEqual({
      amount: 50,
      priced: 1,
      eligible: 2,
      withheld: false,
    });
    expect(holdings.withheld).toEqual([]);
    expect(holdings.total).toBe(90);
  });

  it('still withholds heroes for a roster stored before anything read the flag', () => {
    const stale = ROSTER.map(({ name, rarity, skin }) => ({ name, rarity, skin }));
    const holdings = holdingsOf(INVENTORY, wornBy(stale), SNAPSHOT, priceableHeroes(stale));

    expect(tallyOf(holdings.heroes)).toEqual({
      amount: 0,
      priced: 0,
      eligible: 0,
      withheld: true,
    });
    expect(holdings.withheld).toEqual(['heroes']);
    // The snapshot does quote a rarity-2 hero, so the zero is a decision and not an empty market.
    expect(holdings.total).toBe(40);
  });

  it('answers zero for a roster where every hero is bound, rather than calling it unread', () => {
    const allBound = ROSTER.map(({ name, rarity, skin }) => ({
      name,
      rarity,
      skin,
      marketable: false,
    }));
    const holdings = holdingsOf(INVENTORY, wornBy(allBound), SNAPSHOT, priceableHeroes(allBound));

    // The same zero as the roster above, and a different KIND of zero: every hero answered, and
    // every answer was no. Withholding here would report an answered question as unasked.
    expect(tallyOf(holdings.heroes)).toEqual({
      amount: 0,
      priced: 0,
      eligible: 0,
      withheld: false,
    });
    expect(holdings.withheld).toEqual([]);
  });

  it('reads an empty roster as no save rather than as a player wearing nothing bought', () => {
    expect(skinsWornBy([])).toBeNull();
    expect(skinsWornBy([{ skin: ROYAL_SENTINEL }, {}])).toEqual([ROYAL_SENTINEL, 0]);
    expect(holdingsOf(INVENTORY, skinsWornBy([])).skins.withheld).toBe(true);
  });
});

describe('account holdings — what reaches the view', () => {
  const html = renderSection(INVENTORY, wornBy(ROSTER));

  it('puts each component amount beside the count that amount reaches', () => {
    expect(slot(html, 'account-holdings-inventory-amount')).toBe('R$10.00');
    expect(slot(html, 'account-holdings-inventory-coverage')).toBe('1 of 2 tradable items priced');
    expect(slot(html, 'account-holdings-skins-amount')).toBe('R$30.00');
    expect(slot(html, 'account-holdings-skins-coverage')).toBe('1 of 1 bought skins priced');
  });

  it('heads the components with their sum and disowns it while heroes cannot be read', () => {
    expect(slot(html, 'account-holdings-total')).toBe('R$40.00');
    expect(slot(html, 'account-holdings-caption')).toBe(STRINGS.en.accountHoldingsPartialTotal);
    expect(slot(html, 'account-holdings-missing')).toBe(
      `Not counted here: ${STRINGS.en.accountHoldingsHeroes}.`,
    );
  });

  it('prints the heroes notice in place of a figure, so an unread component is not worth zero', () => {
    expect(slot(html, 'account-holdings-heroes-withheld')).toBe(
      STRINGS.en.accountHoldingsHeroesWithheld,
    );
    expect(slot(html, 'account-holdings-heroes-amount')).toBeNull();
  });

  it('names an unimported inventory as unread, and drops it from the headline coverage', () => {
    const unimported = renderSection(null, wornBy(ROSTER));

    expect(slot(unimported, 'account-holdings-inventory-withheld')).toBe(
      STRINGS.en.accountHoldingsInventoryWithheld,
    );
    expect(slot(unimported, 'account-holdings-inventory-amount')).toBeNull();
    expect(slot(unimported, 'account-holdings-total')).toBe('R$30.00');
    expect(unimported).toContain('1 of 1 sellable things priced right now');
  });

  it('speaks Portuguese when the app does', () => {
    const portuguese = renderSection(INVENTORY, wornBy(ROSTER), null, 'pt');

    expect(slot(portuguese, 'account-holdings-caption')).toBe(
      STRINGS.pt.accountHoldingsPartialTotal,
    );
    expect(slot(portuguese, 'account-holdings-total')).toBe('R$ 40,00');
    expect(slot(portuguese, 'account-holdings-inventory-coverage')).toBe(
      '1 de 2 itens negociáveis com preço',
    );
  });
});

describe('account holdings — what each component is made of', () => {
  const heroes = priceableHeroes(ROSTER);
  const html = renderSection(INVENTORY, [ROYAL_SENTINEL, FOREST_WARDEN], heroes);

  it('depicts a hero the way the rest of the planner depicts one', () => {
    const [aria, cyra] = entryChunks(html, 'heroes');

    expect(aria).toContain('alt="Aria"');
    expect(aria).toContain('>S<');
    expect(aria).toContain('Rare');
    expect(aria).toContain('Lv 42');
    expect(cyra).toContain('alt="Cyra"');
    expect(cyra).toContain('Uncommon');
  });

  it('shows what it knows about a hero the roster told it less about, and crashes on none of it', () => {
    const [, cyra] = entryChunks(html, 'heroes');

    expect(cyra).toContain('alt="Cyra"');
    expect(cyra).not.toContain('Lv 42');
  });

  it('pairs each depicted hero with its own price, not with the list as a whole', () => {
    const [aria, cyra] = entryChunks(html, 'heroes');

    expect(aria).toContain('R$50.00');
    expect(aria).not.toContain(STRINGS.en.accountHoldingsUnpriced);
    expect(cyra).toContain(STRINGS.en.accountHoldingsUnpriced);
    expect(cyra).not.toContain('R$50.00');
  });

  it('leaves the hero the game forbids selling out of the list, as it is out of the figure', () => {
    expect(html).not.toContain('Bran');
    expect(slots(html, 'account-holdings-heroes-entry')).toHaveLength(2);
  });

  it('pairs each hero with its own price, so two identical figures are still two heroes', () => {
    expect(slots(html, 'account-holdings-heroes-entry-amount')).toEqual(['R$50.00']);
    expect(slot(html, 'account-holdings-heroes-amount')).toBe('R$50.00');
    expect(slot(html, 'account-holdings-heroes-coverage')).toBe('1 of 2 sellable heroes priced');
  });

  it('keeps an entry the market is listing nothing for, and marks it rather than dropping it', () => {
    // "1 of 2 sellable heroes priced" is only investigable if the unpriced one is on screen: Cyra
    // is the second entry, and the marker is what says which of the two the figure left out.
    expect(slots(html, 'account-holdings-heroes-entry-unpriced')).toEqual([
      STRINGS.en.accountHoldingsUnpriced,
    ]);
    expect(slots(html, 'account-holdings-skins-entry-unpriced')).toEqual([
      STRINGS.en.accountHoldingsUnpriced,
    ]);
    expect(slot(html, 'account-holdings-skins-coverage')).toBe('1 of 2 bought skins priced');
  });

  it('lists a skin by the listing it appears under, and depicts nothing for it', () => {
    expect(slots(html, 'account-holdings-skins-entry-name')).toEqual([
      'Forest Warden Skin',
      'Royal Sentinel Skin',
    ]);
    expect(slots(html, 'account-holdings-skins-entry-detail')).toEqual([]);
    expect(slots(html, 'account-holdings-skins-entry-leading')).toEqual([]);
    expect(slots(html, 'account-holdings-skins-entry-amount')).toEqual(['R$30.00']);
  });

  it('drops a worn skin index the table cannot name, which no price could exist for', () => {
    const unnamed = renderSection(INVENTORY, [ROYAL_SENTINEL, 99], heroes);

    expect(slots(unnamed, 'account-holdings-skins-entry-name')).toEqual(['Royal Sentinel Skin']);
    expect(slot(unnamed, 'account-holdings-skins-coverage')).toBe('1 of 1 bought skins priced');
  });

  it('leaves the inventory column its figure and its link, and no list of dozens of rows', () => {
    const withLink = renderToStaticMarkup(
      createElement(HoldingsView, {
        ...holdingsComponents(
          holdingsOf(INVENTORY, wornBy(ROSTER), SNAPSHOT, heroes),
          heroes,
          'en',
        ),
        labels: holdingsLabels(STRINGS.en, 'en'),
        inventoryLink: createElement('a', { href: '/inventory' }, 'Open the inventory'),
      }),
    );

    expect(slots(withLink, 'account-holdings-inventory-entry')).toEqual([]);
    expect(slot(withLink, 'account-holdings-inventory-entries')).toBeNull();
    expect(slot(withLink, 'account-holdings-inventory-amount')).toBe('R$10.00');
    expect(withLink).toContain('href="/inventory"');
  });

  it('says the same things in Portuguese, down to the rarity and the unpriced marker', () => {
    const portuguese = renderSection(INVENTORY, [ROYAL_SENTINEL, FOREST_WARDEN], heroes, 'pt');
    const [aria, cyra] = entryChunks(portuguese, 'heroes');

    expect(aria).toContain('Raro');
    expect(cyra).toContain('Incomum');
    expect(portuguese).not.toContain('Uncommon');
    expect(slots(portuguese, 'account-holdings-heroes-entry-unpriced')).toEqual([
      STRINGS.pt.accountHoldingsUnpriced,
    ]);
  });
});

describe('the inventory figure is one computation on both screens', () => {
  it('agrees with the Inventory screen over the same items', () => {
    const fromAccount = holdingsOf(INVENTORY, null).inventory;
    const fromInventory = inventoryTotals(INVENTORY, SNAPSHOT);

    expect(fromInventory).toEqual({
      total: fromAccount.amount,
      priced: fromAccount.priced,
      tradable: fromAccount.eligible,
    });
  });

  it('still reports the figures the Inventory screen printed before it shared the computation', () => {
    // The header's original arithmetic, restated: every tradable item counts toward the
    // denominator, only a quoted one toward the money.
    let total = 0;
    let priced = 0;
    let tradable = 0;
    for (const item of INVENTORY) {
      if (!item.tradable) continue;
      tradable += 1;
      const price = resolveItemPrice(
        { defId: item.defId, rarity: item.rarityIdx, tradable: item.tradable },
        SNAPSHOT,
        'BRL',
      );
      if (price.state !== 'priced' || price.amount == null) continue;
      priced += 1;
      total += price.amount;
    }

    expect(inventoryTotals(INVENTORY, SNAPSHOT)).toEqual({ total, priced, tradable });
  });

  it('has nothing to report on either screen without a snapshot', () => {
    expect(inventoryTotals(INVENTORY, null)).toBeNull();
    expect(holdingsOf(INVENTORY, null, null).inventory.amount).toBe(0);
  });
});

describe('the section drawn with nothing imported', () => {
  const html = renderToStaticMarkup(createElement(AccountHoldingsSection));

  it('withholds every component rather than reporting an empty account as worth nothing', () => {
    for (const component of ['inventory', 'heroes', 'skins']) {
      expect(slot(html, `account-holdings-${component}-withheld`)).not.toBeNull();
      expect(slot(html, `account-holdings-${component}-coverage`)).toBeNull();
      expect(slot(html, `account-holdings-${component}-entries`)).toBeNull();
    }
    expect(slot(html, 'account-holdings-caption')).toBe(STRINGS.pt.accountHoldingsPartialTotal);
  });

  it('still says both things a reader would otherwise get wrong', () => {
    expect(slot(html, 'account-holdings-heroes-floor')).toBe(STRINGS.pt.accountHoldingsHeroesFloor);
    expect(slot(html, 'account-holdings-skins-worn')).toBe(STRINGS.pt.accountHoldingsSkinsWorn);
  });
});

describe('the inventory column link opens the Inventory as the player left it', () => {
  const writes: string[] = [];
  const stored = JSON.stringify({
    version: 1,
    importedAt: 1_700_000_000_000,
    items: INVENTORY,
  });

  beforeEach(() => {
    const store = new Map<string, string>([[INVENTORY_VIEW_KEY, stored]]);
    writes.length = 0;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          writes.push(key);
          store.set(key, value);
        },
        removeItem: (key: string) => {
          writes.push(key);
          store.delete(key);
        },
        clear: () => store.clear(),
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('leads to the bare Inventory route, with no filter, sort or layout of its own', () => {
    const html = renderToStaticMarkup(createElement(AccountHoldingsSection));
    const href = /<a[^>]*href="([^"]*)"/.exec(html)?.[1];

    expect(href).toBe('/inventory');
    expect(href).not.toContain('?');
    expect(href).not.toContain('#');
  });

  it('hangs that link on the inventory column and nowhere else', () => {
    const html = renderToStaticMarkup(createElement(AccountHoldingsSection));
    const columnStart = (component: string) =>
      html.indexOf(`data-testid="account-holdings-${component}"`);

    expect(html.indexOf('<a ')).toBeGreaterThan(columnStart('inventory'));
    expect(html.indexOf('<a ')).toBeLessThan(columnStart('heroes'));
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it('writes nothing while drawing the section', () => {
    renderToStaticMarkup(createElement(AccountHoldingsSection));

    expect(writes).toEqual([]);
    expect(globalThis.localStorage.getItem(INVENTORY_VIEW_KEY)).toBe(stored);
  });

  it('reads the inventory off the stored view without disturbing it', () => {
    const stock = inventoryFromStorage(loadInventoryView());

    expect(stock).toHaveLength(INVENTORY.length);
    expect(writes).toEqual([]);
    expect(globalThis.localStorage.getItem(INVENTORY_VIEW_KEY)).toBe(stored);
  });

  it('reads an inventory nothing has ever written as unread rather than as empty', () => {
    globalThis.localStorage.clear();

    expect(inventoryFromStorage(loadInventoryView())).toBeNull();
    expect(inventoryFromStorage({ version: 1, importedAt: 1, items: [] })).toEqual([]);
  });
});
