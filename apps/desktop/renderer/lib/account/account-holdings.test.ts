import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import type { HoldingsEntry } from '@bombfarm/account/holdings';
import type { MarketEntry, MarketSnapshot } from '@bombfarm/pricing';
import { SKIN_CATEGORY, categoryKey, heroPriceKey, priceKey } from '@bombfarm/pricing';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { AccountHoldingsFacts } from './account-facts';
import {
  HOLDINGS_CURRENCY,
  accountHoldingsFrom,
  holdingsComponents,
  inventoryTotals,
} from './account-holdings';

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

/** A snapshot quoting one rare hero, one bought skin and one inventory item, all in whole USD. */
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
/** A rarity the snapshot quotes nothing for, so its hero is sellable and unpriced. */
const UNLISTED_HERO_RARITY = 2;
const BOUGHT_SKIN = 4;
/** Named by the skin table, and deliberately absent from the snapshot. */
const UNLISTED_BOUGHT_SKIN = 5;
const ITEM_DEF = 'espada_ferro';
const ITEM_RARITY = 2;

const SNAPSHOT = snapshotOf([
  entry(heroPriceKey(HERO_RARITY), 'Hero (Legendary)', 20),
  entry(categoryKey(SKIN_CATEGORY, 'Forest Warden Skin'), 'Forest Warden Skin', 7),
  entry(priceKey(ITEM_DEF, ITEM_RARITY), 'Iron Sword (Rare)', 3),
]);

function facts(overrides: Partial<AccountHoldingsFacts> = {}): AccountHoldingsFacts {
  return {
    inventory: [{ defId: ITEM_DEF, rarity: ITEM_RARITY, tradable: true }],
    heroes: [{ name: 'Vex', rarity: HERO_RARITY, marketable: true }],
    skinsWorn: [BOUGHT_SKIN],
    ...overrides,
  };
}

function inventoryItem(overrides: Partial<InventoryViewItem> = {}): InventoryViewItem {
  return {
    id: 'i1',
    defId: ITEM_DEF,
    kind: 'equipment',
    categoryCode: 0,
    set: '',
    rarityIdx: ITEM_RARITY,
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
  it('quotes the inventory, the sellable heroes and the worn bought skins in one figure', () => {
    const holdings = accountHoldingsFrom(facts(), SNAPSHOT);
    expect(holdings.currency).toBe(HOLDINGS_CURRENCY);
    expect(holdings.inventory.amount).toBe(3);
    expect(holdings.heroes.amount).toBe(20);
    expect(holdings.skins.amount).toBe(7);
    expect(holdings.total).toBe(30);
    expect(holdings.complete).toBe(true);
  });

  it('prices the heroes the game marks sellable, and counts the others in neither figure', () => {
    const holdings = accountHoldingsFrom(
      facts({
        heroes: [
          { name: 'Vex', rarity: HERO_RARITY, marketable: true },
          { name: 'Ora', rarity: HERO_RARITY, marketable: true },
          { name: 'Bound', rarity: HERO_RARITY, marketable: false },
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
    const holdings = accountHoldingsFrom(facts({ inventory: [], skinsWorn: [] }), noListings);
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
    const holdings = accountHoldingsFrom(facts({ inventory: null }), SNAPSHOT);
    expect(holdings.inventory.withheld).toBe(true);
    expect(holdings.withheld).toEqual(['inventory']);
    expect(holdings.complete).toBe(false);
    expect(holdings.total).toBe(27);
  });
});

describe('the things each column lists under its figure', () => {
  const roster = [
    { name: 'Vex', rarity: HERO_RARITY, marketable: true, rank: 'S', level: 42, skin: BOUGHT_SKIN },
    { name: 'Nim', rarity: UNLISTED_HERO_RARITY, marketable: true },
    { name: 'Bound', rarity: HERO_RARITY, marketable: false },
  ];
  const columnsOf = (overrides: Partial<AccountHoldingsFacts> = {}) => {
    const built = facts({ heroes: roster, ...overrides });
    return holdingsComponents(accountHoldingsFrom(built, SNAPSHOT), built.heroes, 'en');
  };

  /** What the entry's leading cell was built from, so its depiction can be read as data. */
  function identityOf(entry: HoldingsEntry | undefined): Record<string, unknown> {
    const leading: unknown = entry?.leading;
    if (!isValidElement(leading)) {
      throw new Error(`the entry for "${entry?.name ?? 'nothing at all'}" carries no identity block`);
    }
    return leading.props as Record<string, unknown>;
  }

  it('hands each sellable hero over already depicted, rather than as a bare name', () => {
    const entries = columnsOf().heroes.entries;

    expect(entries.map((entry) => entry.name)).toEqual(['Vex', 'Nim']);
    expect(identityOf(entries[0])).toMatchObject({
      name: 'Vex',
      rank: 'S',
      rarityIdx: HERO_RARITY,
      level: 42,
      skin: BOUGHT_SKIN,
    });
  });

  it('lets a hero the roster told it less about show what it does know', () => {
    const nim = identityOf(columnsOf().heroes.entries[1]);

    expect(nim).toMatchObject({ name: 'Nim', rarityIdx: UNLISTED_HERO_RARITY });
    expect(nim.rank).toBeUndefined();
    expect(nim.level).toBeUndefined();
  });

  it('draws no depiction of its own for a skin, which has nothing but a listing name', () => {
    for (const skin of columnsOf().skins.entries) {
      expect(skin.leading).toBeUndefined();
    }
  });

  it('follows the language the rest of the screen speaks', () => {
    const built = facts({ heroes: roster });
    const columns = holdingsComponents(accountHoldingsFrom(built, SNAPSHOT), built.heroes, 'pt');

    expect(columns.heroes.entries.map((entry) => identityOf(entry).lang)).toEqual(['pt', 'pt']);
    expect(columnsOf().heroes.entries.map((entry) => identityOf(entry).lang)).toEqual(['en', 'en']);
  });

  it('pairs each hero with its own price rather than with the list as a whole', () => {
    // Two heroes of the SAME rarity carry the same figure, and one of a rarity nobody lists
    // carries none — an entry taking a neighbour's price would quote the unlisted one.
    const columns = columnsOf({
      heroes: [
        { name: 'Nim', rarity: UNLISTED_HERO_RARITY, marketable: true },
        { name: 'Vex', rarity: HERO_RARITY, marketable: true },
      ],
    });

    expect(
      columns.heroes.entries.map((entry) => ({
        depicted: identityOf(entry).name,
        amount: entry.amount,
      })),
    ).toEqual([
      { depicted: 'Nim', amount: null },
      { depicted: 'Vex', amount: 20 },
    ]);
  });

  it('keeps the unpriced entry, which is what makes the coverage line investigable', () => {
    const columns = columnsOf({ skinsWorn: [BOUGHT_SKIN, UNLISTED_BOUGHT_SKIN] });
    expect(columns.heroes.priced).toBe(1);
    expect(columns.heroes.eligible).toBe(2);
    expect(columns.skins.priced).toBe(1);
    expect(columns.skins.eligible).toBe(2);
    expect(columns.skins.entries).toEqual([
      { name: 'Forest Warden Skin', amount: 7 },
      { name: 'Shadow Hunter Skin', amount: null },
    ]);
  });

  it('names a skin by its listing and gives it nothing to tell two of them apart', () => {
    for (const skin of columnsOf().skins.entries) {
      expect(skin.detail).toBeUndefined();
    }
  });

  it('drops a worn skin index the table cannot name, which no price could exist for', () => {
    const columns = columnsOf({ skinsWorn: [BOUGHT_SKIN, 99] });
    expect(columns.skins.entries).toEqual([{ name: 'Forest Warden Skin', amount: 7 }]);
    expect(columns.skins.eligible).toBe(1);
  });

  it('lists nothing under the inventory, which holds more rows than a column can carry', () => {
    expect(columnsOf().inventory.entries).toEqual([]);
    expect(columnsOf().inventory.amount).toBe(3);
  });

  it('lists nothing for a component whose account data could not be read', () => {
    const columns = columnsOf({ heroes: null, skinsWorn: null });
    expect(columns.heroes).toEqual({
      amount: 0,
      priced: 0,
      eligible: 0,
      withheld: true,
      entries: [],
    });
    expect(columns.skins.entries).toEqual([]);
  });
});

describe('the inventory figure the Inventory header prints', () => {
  it('is the inventory component of the account-wide computation, over everything it holds', () => {
    const items = [inventoryItem(), inventoryItem({ id: 'i2' })];
    expect(inventoryTotals(items, SNAPSHOT)).toEqual({ total: 6, priced: 2, tradable: 2 });
    expect(inventoryTotals(items, SNAPSHOT)?.total).toBe(
      accountHoldingsFrom(
        facts({
          inventory: items.map((item) => ({
            defId: item.defId,
            rarity: item.rarityIdx,
            tradable: true,
          })),
        }),
        SNAPSHOT,
      ).inventory.amount,
    );
  });

  it('counts an item the game forbids selling in neither the figure nor the coverage', () => {
    const items = [inventoryItem(), inventoryItem({ id: 'i2', tradable: false })];
    expect(inventoryTotals(items, SNAPSHOT)).toEqual({ total: 3, priced: 1, tradable: 1 });
  });

  it('counts a tradable item the market is not quoting against the coverage but not the figure', () => {
    const items = [inventoryItem(), inventoryItem({ id: 'i2', defId: 'nao_listado' })];
    expect(inventoryTotals(items, SNAPSHOT)).toEqual({ total: 3, priced: 1, tradable: 2 });
  });

  it('has nothing to say with no snapshot in hand', () => {
    expect(inventoryTotals([inventoryItem()], null)).toBeNull();
  });
});
