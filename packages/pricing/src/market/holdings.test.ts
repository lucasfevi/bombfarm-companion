import { describe, expect, it } from 'vitest';
import { accountHoldings, boughtSkinsWorn } from './holdings.js';
import type { CatalogView } from './reconcile.js';
import { buildSnapshot } from './snapshot.js';
import type { MarketEntry } from './types.js';
import { categoryKey, heroPriceKey, priceKey } from './types.js';

const CATALOG: CatalogView = {
  defs: [{ defId: 'ember_arma', set: 'ember', slot: 'arma', level: 10 }],
  rarityIdxs: [1, 2],
  rarityTokens: { 1: 'incomum', 2: 'raro' },
  defIdByHash: {},
};

function marketEntry(overrides: Partial<MarketEntry> & { hashName: string; key: string }): MarketEntry {
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
    fetchedUtc: '2026-08-29T00:00:00.000Z',
    ...overrides,
  };
}

const SNAPSHOT = buildSnapshot({
  entries: [
    marketEntry({
      hashName: 'Ember Weapon',
      key: priceKey('ember_arma', 1),
      defId: 'ember_arma',
      kind: 'equipment',
      category: 'equip',
      set: 'ember',
      slot: 'arma',
      rarityIdx: 1,
      level: 10,
      lowestUsd: 2.5,
    }),
    marketEntry({
      hashName: 'Ember Weapon (Rare)',
      key: priceKey('ember_arma', 2),
      defId: 'ember_arma',
      kind: 'equipment',
      category: 'equip',
      set: 'ember',
      slot: 'arma',
      rarityIdx: 2,
      level: 10,
      lowestUsd: null,
      listings: 0,
    }),
    marketEntry({
      hashName: 'Hero (Rare)',
      key: heroPriceKey(2),
      category: 'hero',
      rarityIdx: 2,
      lowestUsd: 10,
    }),
    marketEntry({
      hashName: 'Royal Sentinel Skin',
      key: categoryKey('skin', 'Royal Sentinel Skin'),
      category: 'skin',
      lowestUsd: 48.14,
    }),
  ],
  prior: null,
  catalog: CATALOG,
  fx: { USD: 1, BRL: 5 },
  anomalies: [],
  searchCalls: 1,
  enumerationComplete: true,
  now: () => Date.parse('2026-08-29T12:00:00.000Z'),
});

const PRICED_ITEM = { defId: 'ember_arma', rarity: 1, tradable: true };
const UNLISTED_ITEM = { defId: 'ember_arma', rarity: 2, tradable: true };
const UNKNOWN_ITEM = { defId: 'void_arma', rarity: 5, tradable: true };
const BOUND_ITEM = { defId: 'ember_arma', rarity: 1, tradable: false };
const PRICED_HERO = { rarity: 2, marketable: true };
const BOUND_HERO = { rarity: 2, marketable: false };
const ROYAL_SENTINEL = 8;

const holdingsOf = (
  inventory: { defId: string; rarity: number; tradable: boolean }[] | null,
  heroes: { rarity: number; marketable: boolean }[] | null,
  skinsWorn: number[] | null,
  currency?: string,
) =>
  accountHoldings({
    inventory,
    heroes,
    skinsWorn,
    snapshot: SNAPSHOT,
    ...(currency == null ? {} : { currency }),
  });

describe('boughtSkinsWorn', () => {
  it('holds one skin however many heroes are wearing it', () => {
    expect(boughtSkinsWorn([8, 8, 8])).toEqual([8]);
  });

  it('sorts the distinct bought skins it found', () => {
    expect(boughtSkinsWorn([8, 5, 8, 4])).toEqual([4, 5, 8]);
  });

  it('drops the birth skins, which cost nothing and are not held', () => {
    expect(boughtSkinsWorn([0, 1, 2, 3])).toEqual([]);
    expect(boughtSkinsWorn([3, 4])).toEqual([4]);
  });

  it('has nothing to report for an empty roster', () => {
    expect(boughtSkinsWorn([])).toEqual([]);
  });
});

describe('accountHoldings', () => {
  it('sums the inventory, the heroes and the worn skins into one figure', () => {
    const holdings = holdingsOf([PRICED_ITEM], [PRICED_HERO], [ROYAL_SENTINEL]);

    expect(holdings.inventory).toMatchObject({
      amount: 2.5,
      priced: 1,
      eligible: 1,
      withheld: false,
    });
    expect(holdings.heroes).toMatchObject({ amount: 10, priced: 1, eligible: 1, withheld: false });
    expect(holdings.skins).toMatchObject({
      amount: 48.14,
      priced: 1,
      eligible: 1,
      withheld: false,
    });
    expect(holdings.total).toBeCloseTo(60.64);
    expect(holdings).toMatchObject({ priced: 3, eligible: 3, currency: 'USD', complete: true });
    expect(holdings.withheld).toEqual([]);
  });

  it('converts every component into the currency asked for', () => {
    const holdings = holdingsOf([PRICED_ITEM], [PRICED_HERO], [ROYAL_SENTINEL], 'brl');

    expect(holdings.currency).toBe('BRL');
    expect(holdings.total).toBeCloseTo(60.64 * 5);
  });

  it('leaves what the game forbids selling out of the value and out of the denominator alike', () => {
    const withBound = holdingsOf([PRICED_ITEM, BOUND_ITEM], [PRICED_HERO, BOUND_HERO], [ROYAL_SENTINEL]);
    const sellableOnly = holdingsOf([PRICED_ITEM], [PRICED_HERO], [ROYAL_SENTINEL]);

    expect(withBound.total).toBeCloseTo(sellableOnly.total);
    expect(withBound.priced).toBe(sellableOnly.priced);
    expect(withBound.eligible).toBe(3);
  });

  it('counts something sellable that nobody is listing toward coverage, never toward the value', () => {
    const holdings = holdingsOf([PRICED_ITEM, UNLISTED_ITEM, UNKNOWN_ITEM], [], []);

    expect(holdings.inventory).toMatchObject({
      amount: 2.5,
      priced: 1,
      eligible: 3,
      withheld: false,
    });
  });

  it('holds one skin however many heroes wear it, and prices it once', () => {
    const dressed = holdingsOf([], [], [ROYAL_SENTINEL, ROYAL_SENTINEL, ROYAL_SENTINEL]);

    expect(dressed.skins).toMatchObject({
      amount: 48.14,
      priced: 1,
      eligible: 1,
      withheld: false,
    });
    expect(dressed).toEqual(holdingsOf([], [], [ROYAL_SENTINEL]));
  });

  it('counts a skin index the table cannot name nowhere at all', () => {
    const unnamed = holdingsOf([], [], [ROYAL_SENTINEL, 9]);
    const named = holdingsOf([], [], [ROYAL_SENTINEL]);

    expect(unnamed.skins.eligible).toBe(1);
    expect(unnamed.total).toBeCloseTo(named.total);
  });

  it('prices heroes on rarity alone, so a rarity the market never carried only counts as eligible', () => {
    const holdings = holdingsOf([], [PRICED_HERO, { rarity: 4, marketable: true }], []);

    expect(holdings.heroes).toMatchObject({ amount: 10, priced: 1, eligible: 2, withheld: false });
  });

  it('contributes nothing for a withheld component and says which one it was', () => {
    const withoutRoster = holdingsOf([PRICED_ITEM], null, [ROYAL_SENTINEL]);

    expect(withoutRoster.heroes).toEqual({
      amount: 0,
      priced: 0,
      eligible: 0,
      withheld: true,
      prices: [],
    });
    expect(withoutRoster.withheld).toEqual(['heroes']);
    expect(withoutRoster.complete).toBe(false);
    expect(withoutRoster.total).toBeCloseTo(50.64);
  });

  it('never reports a withheld account as a complete total', () => {
    const nothing = holdingsOf(null, null, null);

    expect(nothing.withheld).toEqual(['inventory', 'heroes', 'skins']);
    expect(nothing.complete).toBe(false);
    expect(nothing.total).toBe(0);
  });

  it('reads an empty component as an empty account, not as a withheld one', () => {
    const empty = holdingsOf([], [], []);

    expect(empty.complete).toBe(true);
    expect(empty.withheld).toEqual([]);
    expect(empty.total).toBe(0);
  });

  it('prices nothing without a snapshot, and still counts what could be priced', () => {
    const holdings = accountHoldings({
      inventory: [PRICED_ITEM],
      heroes: [PRICED_HERO],
      skinsWorn: [ROYAL_SENTINEL],
      snapshot: null,
    });

    expect(holdings.total).toBe(0);
    expect(holdings.priced).toBe(0);
    expect(holdings.eligible).toBe(3);
    expect(holdings.complete).toBe(true);
  });
});

describe('accountHoldings — the price behind every figure', () => {
  it('answers for each item in the order the inventory was given', () => {
    const holdings = holdingsOf([UNLISTED_ITEM, PRICED_ITEM, BOUND_ITEM], [], []);

    expect(holdings.inventory.prices.map((price) => price.state)).toEqual([
      'no-listing',
      'priced',
      'not-tradable',
    ]);
    expect(holdings.inventory.prices.map((price) => price.amount)).toEqual([null, 2.5, null]);
  });

  it('answers for each hero in the order the roster was given', () => {
    const holdings = holdingsOf([], [BOUND_HERO, PRICED_HERO, { rarity: 4, marketable: true }], []);

    expect(holdings.heroes.prices.map((price) => price.state)).toEqual([
      'not-tradable',
      'priced',
      'unknown',
    ]);
    expect(holdings.heroes.prices.map((price) => price.amount)).toEqual([null, 10, null]);
  });

  it('answers per distinct bought skin, and names which skin each answer is for', () => {
    const holdings = holdingsOf([], [], [9, ROYAL_SENTINEL, ROYAL_SENTINEL, 0]);

    expect(holdings.skins.skinIndexes).toEqual([ROYAL_SENTINEL, 9]);
    expect(holdings.skins.prices).toHaveLength(2);
    expect(holdings.skins.prices.map((price) => price.amount)).toEqual([48.14, null]);
  });

  it('converts every answer into the currency asked for, as the totals are', () => {
    const holdings = holdingsOf([PRICED_ITEM], [PRICED_HERO], [ROYAL_SENTINEL], 'brl');

    expect(holdings.inventory.prices[0]?.amount).toBeCloseTo(2.5 * 5);
    expect(holdings.heroes.prices[0]?.amount).toBeCloseTo(10 * 5);
    expect(holdings.skins.prices[0]?.amount).toBeCloseTo(48.14 * 5);
  });

  it('answers for nothing in a component it could not read', () => {
    const nothing = holdingsOf(null, null, null);

    expect(nothing.inventory.prices).toEqual([]);
    expect(nothing.heroes.prices).toEqual([]);
    expect(nothing.skins.prices).toEqual([]);
    expect(nothing.skins.skinIndexes).toEqual([]);
  });

  it('sums exactly the answers it hands back, so no figure is made of anything unlisted', () => {
    const holdings = holdingsOf([PRICED_ITEM, UNLISTED_ITEM, BOUND_ITEM], [PRICED_HERO], [ROYAL_SENTINEL]);
    const summed = [holdings.inventory, holdings.heroes, holdings.skins].flatMap(
      (component) => component.prices,
    );

    expect(summed.reduce((running, price) => running + (price.amount ?? 0), 0)).toBeCloseTo(
      holdings.total,
    );
    expect(summed.filter((price) => price.amount != null)).toHaveLength(holdings.priced);
  });
});
