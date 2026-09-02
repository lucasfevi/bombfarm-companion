import { describe, expect, it } from 'vitest';
import type { MarketEntry, MarketSnapshot } from '@bombfarm/pricing';
import { SKIN_CATEGORY, categoryKey, heroPriceKey, priceKey } from '@bombfarm/pricing';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { AccountHoldingsFacts } from './account-facts';
import { HOLDINGS_CURRENCY, accountHoldingsFrom, bagTotals } from './account-holdings';

const QUOTED = '2026-08-12T00:00:00.000Z';

function entry(key: string, hashName: string, lowestUsd: number | null): MarketEntry {
  return {
    hashName,
    name: hashName,
    key,
    defId: null,
    kind: null,
    category: null,
    set: null,
    slot: null,
    rarityIdx: null,
    level: null,
    act: null,
    lowestUsd,
    lowestNative: {},
    listings: lowestUsd === null ? 0 : 3,
    iconUrl: null,
    fetchedUtc: QUOTED,
    nativeQuotedUtc: null,
  };
}

/** A snapshot quoting one rare hero, one bought skin and one bag item, all in whole USD. */
function snapshotOf(entries: MarketEntry[]): MarketSnapshot {
  const index: Record<string, number> = {};
  entries.forEach((row, position) => {
    index[row.key] = position;
  });
  return {
    schemaVersion: 3,
    generatedUtc: QUOTED,
    appId: 1,
    baseCurrency: 'USD',
    nativeCurrencies: [],
    // One BRL per USD, so every figure below is the listing price unchanged and the assertions
    // read as prices rather than as conversions.
    fx: { USD: 1, BRL: 1 },
    entries,
    index,
    alternates: {},
    unlisted: [],
    anomalies: [],
    coverage: {
      marketRows: entries.length,
      keyedRows: entries.length,
      pricedRows: entries.length,
      unkeyedRows: 0,
      catalogKeys: entries.length,
      matchedCatalogKeys: entries.length,
      searchCalls: 1,
    },
  };
}

const HERO_RARITY = 4;
const BOUGHT_SKIN = 4;
const BAG_DEF = 'espada_ferro';
const BAG_RARITY = 2;

const SNAPSHOT = snapshotOf([
  entry(heroPriceKey(HERO_RARITY), 'Hero (Legendary)', 20),
  entry(categoryKey(SKIN_CATEGORY, 'Forest Warden Skin'), 'Forest Warden Skin', 7),
  entry(priceKey(BAG_DEF, BAG_RARITY), 'Iron Sword (Rare)', 3),
]);

function facts(overrides: Partial<AccountHoldingsFacts> = {}): AccountHoldingsFacts {
  return {
    bag: [{ defId: BAG_DEF, rarity: BAG_RARITY, tradable: true }],
    heroes: [{ rarity: HERO_RARITY, marketable: true }],
    skinsWorn: [BOUGHT_SKIN],
    ...overrides,
  };
}

function bagItem(overrides: Partial<InventoryViewItem> = {}): InventoryViewItem {
  return {
    id: 'i1',
    defId: BAG_DEF,
    kind: 'equipment',
    categoryCode: 0,
    set: '',
    rarityIdx: BAG_RARITY,
    rarityCode: null,
    slot: null,
    level: 1,
    upgrade: 0,
    power: 0,
    sellValueGold: 0,
    sellable: true,
    tradable: true,
    marketBlocked: false,
    locked: false,
    equipped: false,
    equippedBy: null,
    inStash: false,
    stats: [],
    defResolved: false,
    ...overrides,
  };
}

describe('what the account could sell', () => {
  it('quotes the bag, the sellable heroes and the worn bought skins in one figure', () => {
    const holdings = accountHoldingsFrom(facts(), SNAPSHOT);
    expect(holdings.currency).toBe(HOLDINGS_CURRENCY);
    expect(holdings.bag.amount).toBe(3);
    expect(holdings.heroes.amount).toBe(20);
    expect(holdings.skins.amount).toBe(7);
    expect(holdings.total).toBe(30);
    expect(holdings.complete).toBe(true);
  });

  it('prices the heroes the game marks sellable, and counts the others in neither figure', () => {
    const holdings = accountHoldingsFrom(
      facts({
        heroes: [
          { rarity: HERO_RARITY, marketable: true },
          { rarity: HERO_RARITY, marketable: true },
          { rarity: HERO_RARITY, marketable: false },
        ],
      }),
      SNAPSHOT,
    );
    expect(holdings.heroes.amount).toBe(40);
    expect(holdings.heroes.priced).toBe(2);
    expect(holdings.heroes.eligible).toBe(2);
  });

  it('reports a sellable hero the market is not quoting as eligible but unpriced', () => {
    const noListings = snapshotOf([entry(heroPriceKey(HERO_RARITY), 'Hero (Legendary)', null)]);
    const holdings = accountHoldingsFrom(facts({ bag: [], skinsWorn: [] }), noListings);
    expect(holdings.heroes.amount).toBe(0);
    expect(holdings.heroes.priced).toBe(0);
    expect(holdings.heroes.eligible).toBe(1);
  });

  it('counts a bought skin once however many heroes are wearing it', () => {
    const holdings = accountHoldingsFrom(
      facts({ skinsWorn: [BOUGHT_SKIN, BOUGHT_SKIN, BOUGHT_SKIN] }),
      SNAPSHOT,
    );
    expect(holdings.skins.amount).toBe(7);
    expect(holdings.skins.eligible).toBe(1);
  });

  it('drops birth skins, which cost nothing and are not holdings at all', () => {
    const holdings = accountHoldingsFrom(facts({ skinsWorn: [0, 1, 2, 3] }), SNAPSHOT);
    expect(holdings.skins.amount).toBe(0);
    expect(holdings.skins.eligible).toBe(0);
  });

  it('withholds a component whose account data could not be read, rather than calling it zero', () => {
    const holdings = accountHoldingsFrom(facts({ bag: null }), SNAPSHOT);
    expect(holdings.bag.withheld).toBe(true);
    expect(holdings.withheld).toEqual(['bag']);
    expect(holdings.complete).toBe(false);
    expect(holdings.total).toBe(27);
  });
});

describe('the bag figure the Inventory header prints', () => {
  it('is the bag component of the account-wide computation, over the whole bag', () => {
    const items = [bagItem(), bagItem({ id: 'i2' })];
    expect(bagTotals(items, SNAPSHOT)).toEqual({ total: 6, priced: 2, tradable: 2 });
    expect(bagTotals(items, SNAPSHOT)?.total).toBe(
      accountHoldingsFrom(
        facts({ bag: items.map((item) => ({ defId: item.defId, rarity: item.rarityIdx, tradable: true })) }),
        SNAPSHOT,
      ).bag.amount,
    );
  });

  it('counts an item the game forbids selling in neither the figure nor the coverage', () => {
    const items = [bagItem(), bagItem({ id: 'i2', tradable: false })];
    expect(bagTotals(items, SNAPSHOT)).toEqual({ total: 3, priced: 1, tradable: 1 });
  });

  it('counts a tradable item the market is not quoting against the coverage but not the figure', () => {
    const items = [bagItem(), bagItem({ id: 'i2', defId: 'nao_listado' })];
    expect(bagTotals(items, SNAPSHOT)).toEqual({ total: 3, priced: 1, tradable: 2 });
  });

  it('has nothing to say with no snapshot in hand', () => {
    expect(bagTotals([bagItem()], null)).toBeNull();
  });
});
