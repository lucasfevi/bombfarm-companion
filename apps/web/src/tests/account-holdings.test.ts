import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HoldingsView } from '@bombfarm/account/holdings';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { RarityKey } from '@bombfarm/domain/model';
import type {
  CatalogView,
  MarketEntry,
  MarketSnapshot,
  PriceableHero,
} from '@bombfarm/pricing';
import {
  buildSnapshot,
  categoryKey,
  heroPriceKey,
  priceKey,
  resolveItemPrice,
} from '@bombfarm/pricing';
import { AccountHoldingsSection } from '@/features/account/components/account-holdings-section';
import {
  accountHoldingsFrom,
  bagFromStorage,
  holdingsLabels,
  holdingsRows,
  priceableHeroes,
  skinsWornBy,
} from '@/features/account/model/account-holdings';
import { bagTotals } from '@/features/inventory/model/use-inventory-prices';
import { INVENTORY_VIEW_KEY, loadInventoryView } from '@/shared/lib/inventory-view-storage';
import { STRINGS } from '@/shared/i18n';

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

function bagItem(overrides: Partial<InventoryViewItem> = {}): InventoryViewItem {
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
const BAG = [
  bagItem({ id: 'priced' }),
  bagItem({ id: 'unlisted', rarityIdx: 2 }),
  bagItem({ id: 'bound', tradable: false }),
];

const ROYAL_SENTINEL = 8;

/** One hero the snapshot quotes, one the account binds, one of a rarity nobody is listing. */
const ROSTER: { rarity: RarityKey; marketable?: boolean; skin: number }[] = [
  { rarity: 'Raro', marketable: true, skin: ROYAL_SENTINEL },
  { rarity: 'Raro', marketable: false, skin: ROYAL_SENTINEL },
  { rarity: 'Incomum', marketable: true, skin: 0 },
];

const holdingsOf = (
  bag: readonly InventoryViewItem[] | null,
  skinsWorn: readonly number[] | null,
  snapshot: MarketSnapshot | null = SNAPSHOT,
  heroes: readonly PriceableHero[] | null = null,
) => accountHoldingsFrom({ bag, heroes, skinsWorn, snapshot });

/** The text of one `data-testid` slot, or null when the view did not render it at all. */
function slot(html: string, testId: string): string | null {
  return new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? null;
}

function renderSection(
  bag: readonly InventoryViewItem[] | null,
  skinsWorn: readonly number[] | null,
  heroes: readonly PriceableHero[] | null = null,
): string {
  return renderToStaticMarkup(
    createElement(HoldingsView, {
      ...holdingsRows(holdingsOf(bag, skinsWorn, SNAPSHOT, heroes)),
      labels: holdingsLabels(STRINGS.en, 'en'),
    }),
  );
}

describe('account holdings — the three components the section reads', () => {
  it('prices the bag in the snapshot currency, over the items the game permits selling', () => {
    expect(holdingsOf(BAG, ROSTER.map((hero) => hero.skin)).bag).toEqual({
      amount: 10,
      priced: 1,
      eligible: 2,
      withheld: false,
    });
  });

  it('holds one bought skin however many heroes wear it, and drops the birth ones', () => {
    expect(holdingsOf([], ROSTER.map((hero) => hero.skin)).skins).toEqual({
      amount: 30,
      priced: 1,
      eligible: 1,
      withheld: false,
    });
  });

  it('prices the heroes the game permits selling, and leaves the bound ones out of both counts', () => {
    const holdings = holdingsOf(
      BAG,
      ROSTER.map((hero) => hero.skin),
      SNAPSHOT,
      priceableHeroes(ROSTER),
    );

    expect(holdings.heroes).toEqual({ amount: 50, priced: 1, eligible: 2, withheld: false });
    expect(holdings.withheld).toEqual([]);
    expect(holdings.total).toBe(90);
  });

  it('still withholds heroes for a roster stored before anything read the flag', () => {
    const stale = ROSTER.map(({ rarity, skin }) => ({ rarity, skin }));
    const holdings = holdingsOf(
      BAG,
      stale.map((hero) => hero.skin),
      SNAPSHOT,
      priceableHeroes(stale),
    );

    expect(holdings.heroes).toEqual({ amount: 0, priced: 0, eligible: 0, withheld: true });
    expect(holdings.withheld).toEqual(['heroes']);
    // The snapshot does quote a rarity-2 hero, so the zero is a decision and not an empty market.
    expect(holdings.total).toBe(40);
  });

  it('answers zero for a roster where every hero is bound, rather than calling it unread', () => {
    const allBound = ROSTER.map(({ rarity, skin }) => ({ rarity, skin, marketable: false }));
    const holdings = holdingsOf(
      BAG,
      allBound.map((hero) => hero.skin),
      SNAPSHOT,
      priceableHeroes(allBound),
    );

    // The same zero as the roster above, and a different KIND of zero: every hero answered, and
    // every answer was no. Withholding here would report an answered question as unasked.
    expect(holdings.heroes).toEqual({ amount: 0, priced: 0, eligible: 0, withheld: false });
    expect(holdings.withheld).toEqual([]);
  });

  it('reads an empty roster as no save rather than as a player wearing nothing bought', () => {
    expect(skinsWornBy([])).toBeNull();
    expect(skinsWornBy([{ skin: ROYAL_SENTINEL }, {}])).toEqual([ROYAL_SENTINEL, 0]);
    expect(holdingsOf(BAG, skinsWornBy([])).skins.withheld).toBe(true);
  });
});

describe('account holdings — what reaches the view', () => {
  const html = renderSection(BAG, ROSTER.map((hero) => hero.skin));

  it('puts each row amount beside the count that amount reaches', () => {
    expect(slot(html, 'account-holdings-bag-amount')).toBe('R$10.00');
    expect(slot(html, 'account-holdings-bag-coverage')).toBe('1 of 2 tradable items priced');
    expect(slot(html, 'account-holdings-skins-amount')).toBe('R$30.00');
    expect(slot(html, 'account-holdings-skins-coverage')).toBe('1 of 1 bought skins priced');
  });

  it('heads the rows with their sum and disowns it while heroes cannot be read', () => {
    expect(slot(html, 'account-holdings-total')).toBe('R$40.00');
    expect(slot(html, 'account-holdings-caption')).toBe(STRINGS.en.accountHoldingsPartialTotal);
    expect(slot(html, 'account-holdings-missing')).toBe(
      `Not counted here: ${STRINGS.en.accountHoldingsHeroes}.`,
    );
  });

  it('prints the heroes notice in place of a figure, so an unread row is not worth zero', () => {
    expect(slot(html, 'account-holdings-heroes-withheld')).toBe(
      STRINGS.en.accountHoldingsHeroesWithheld,
    );
    expect(slot(html, 'account-holdings-heroes-amount')).toBeNull();
  });

  it('names an unimported bag as unread, and drops it from the headline coverage', () => {
    const unimported = renderSection(null, ROSTER.map((hero) => hero.skin));

    expect(slot(unimported, 'account-holdings-bag-withheld')).toBe(
      STRINGS.en.accountHoldingsBagWithheld,
    );
    expect(slot(unimported, 'account-holdings-bag-amount')).toBeNull();
    expect(slot(unimported, 'account-holdings-total')).toBe('R$30.00');
    expect(unimported).toContain('1 of 1 sellable things priced right now');
  });

  it('speaks Portuguese when the app does', () => {
    const portuguese = renderToStaticMarkup(
      createElement(HoldingsView, {
        ...holdingsRows(holdingsOf(BAG, ROSTER.map((hero) => hero.skin))),
        labels: holdingsLabels(STRINGS.pt, 'pt'),
      }),
    );

    expect(slot(portuguese, 'account-holdings-caption')).toBe(
      STRINGS.pt.accountHoldingsPartialTotal,
    );
    expect(slot(portuguese, 'account-holdings-total')).toBe('R$ 40,00');
    expect(slot(portuguese, 'account-holdings-bag-coverage')).toBe(
      '1 de 2 itens negociáveis com preço',
    );
  });
});

describe('the bag figure is one computation on both screens', () => {
  it('agrees with the Inventory screen over the same items', () => {
    const fromAccount = holdingsOf(BAG, null).bag;
    const fromInventory = bagTotals(BAG, SNAPSHOT);

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
    for (const item of BAG) {
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

    expect(bagTotals(BAG, SNAPSHOT)).toEqual({ total, priced, tradable });
  });

  it('has nothing to report on either screen without a snapshot', () => {
    expect(bagTotals(BAG, null)).toBeNull();
    expect(holdingsOf(BAG, null, null).bag.amount).toBe(0);
  });
});

describe('the section drawn with nothing imported', () => {
  const html = renderToStaticMarkup(createElement(AccountHoldingsSection));

  it('withholds every row rather than reporting an empty account as worth nothing', () => {
    for (const component of ['bag', 'heroes', 'skins']) {
      expect(slot(html, `account-holdings-${component}-withheld`)).not.toBeNull();
      expect(slot(html, `account-holdings-${component}-coverage`)).toBeNull();
    }
    expect(slot(html, 'account-holdings-caption')).toBe(STRINGS.pt.accountHoldingsPartialTotal);
  });

  it('still says both things a reader would otherwise get wrong', () => {
    expect(slot(html, 'account-holdings-heroes-floor')).toBe(STRINGS.pt.accountHoldingsHeroesFloor);
    expect(slot(html, 'account-holdings-skins-worn')).toBe(STRINGS.pt.accountHoldingsSkinsWorn);
  });
});

describe('the bag row link opens the Inventory as the player left it', () => {
  const writes: string[] = [];
  const stored = JSON.stringify({
    version: 1,
    importedAt: 1_700_000_000_000,
    items: BAG,
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

  it('hangs that link on the bag row and nowhere else', () => {
    const html = renderToStaticMarkup(createElement(AccountHoldingsSection));
    const rowStart = (component: string) =>
      html.indexOf(`data-testid="account-holdings-${component}"`);

    expect(html.indexOf('<a ')).toBeGreaterThan(rowStart('bag'));
    expect(html.indexOf('<a ')).toBeLessThan(rowStart('heroes'));
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it('writes nothing while drawing the section', () => {
    renderToStaticMarkup(createElement(AccountHoldingsSection));

    expect(writes).toEqual([]);
    expect(globalThis.localStorage.getItem(INVENTORY_VIEW_KEY)).toBe(stored);
  });

  it('reads the bag off the stored view without disturbing it', () => {
    const bag = bagFromStorage(loadInventoryView());

    expect(bag).toHaveLength(BAG.length);
    expect(writes).toEqual([]);
    expect(globalThis.localStorage.getItem(INVENTORY_VIEW_KEY)).toBe(stored);
  });

  it('reads a bag nothing has ever written as unread rather than as empty', () => {
    globalThis.localStorage.clear();

    expect(bagFromStorage(loadInventoryView())).toBeNull();
    expect(bagFromStorage({ version: 1, importedAt: 1, items: [] })).toEqual([]);
  });
});
