import { describe, expect, it } from 'vitest';
import { buildInventoryView, chanceStoneDefId } from '@bombfarm/domain/inventory-view';
import type { CatalogView, SearchRow } from '@bombfarm/pricing';
import { buildSnapshot, reconcile } from '@bombfarm/pricing';
import { inventoryTotals } from '@/features/inventory/model/use-inventory-prices';

const FETCHED = '2026-10-06T00:00:00.000Z';
const CHANCE_STONE_CATEGORY = 8;

/** The rarity tokens the snapshot builder derives from the catalog labels — `lendaria` included. */
const CATALOG: CatalogView = {
  defs: [],
  rarityIdxs: [0, 1, 2, 3, 4, 5],
  rarityTokens: { 0: 'comum', 1: 'incomum', 2: 'raro', 3: 'epico', 4: 'lendaria', 5: 'mitico' },
  gems: [],
};

const STONES = [
  { rarityIdx: 0, hashName: 'Chance Stone (Common)', cents: 3 },
  { rarityIdx: 1, hashName: 'Chance Stone (Uncommon)', cents: 4 },
  { rarityIdx: 2, hashName: 'Chance Stone (Rare)', cents: 5 },
  { rarityIdx: 3, hashName: 'Chance Stone (Epic)', cents: 7 },
  { rarityIdx: 4, hashName: 'Chance Stone (Legendary)', cents: 40 },
  { rarityIdx: 5, hashName: 'Chance Stone (Mythic)', cents: 300 },
];

const rows: SearchRow[] = STONES.map(({ hashName, cents }) => ({
  hashName,
  name: hashName,
  sellPriceCents: cents,
  listings: 1,
  iconUrl: null,
  type: null,
}));

const reconciled = reconcile(rows, CATALOG, FETCHED);
const snapshot = buildSnapshot({
  entries: reconciled.entries,
  prior: null,
  catalog: CATALOG,
  fx: { USD: 1, BRL: 5 },
  anomalies: reconciled.anomalies,
  searchCalls: 0,
  enumerationComplete: true,
  now: () => Date.parse(FETCHED),
});

const ownedStones = buildInventoryView(
  STONES.map(({ rarityIdx }) => ({
    id: `stone-${String(rarityIdx)}`,
    def_id: chanceStoneDefId(rarityIdx),
    category: CHANCE_STONE_CATEGORY,
    rarity: rarityIdx,
    tradable: true,
  })),
).items;

describe('an owned Chance Stone against the market', () => {
  it('links every listed rarity, raising nothing', () => {
    expect(reconciled.anomalies).toEqual([]);
  });

  it('reads each owned stone as its own kind and rarity', () => {
    expect(ownedStones.map((item) => [item.kind, item.rarityIdx])).toEqual(
      STONES.map(({ rarityIdx }) => ['chanceStone', rarityIdx]),
    );
  });

  it('prices each owned stone off the listing for its rarity, top two included', () => {
    const totals = inventoryTotals(ownedStones, snapshot);

    expect(totals?.prices.map((price) => [price.state, price.hashName])).toEqual(
      STONES.map(({ hashName }) => ['priced', hashName]),
    );
    expect(totals?.priced).toBe(STONES.length);
    expect(totals?.total).toBeCloseTo((3 + 4 + 5 + 7 + 40 + 300) / 100 * 5);
  });
});
