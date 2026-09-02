/**
 * The Inventory header names the BAG and prints the bag component of the account-wide holdings
 * computation, so this screen and the Account screen cannot disagree about the same bag. Rendered
 * rather than asserted on the call, because what matters is the figure that reaches the screen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountFidelity, AccountPayload, AccountView as AccountViewData } from '@bombfarm/contracts';
import type { MarketEntry, MarketSnapshot } from '@bombfarm/pricing';
import { priceKey } from '@bombfarm/pricing';
import { buildInventoryView } from '@bombfarm/domain/inventory-view';
import { en } from '../../lib/copy/en';
import type { AccountViewState } from '../../lib/account/use-account-view';
import type { MarketState } from '../../lib/market/market-store';
import { bagTotals } from '../../lib/account/account-holdings';
import { formatMoney } from '../../lib/format';
import { InventoryView } from './inventory-view';

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return { ...actual, useCopy: () => en, useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }) };
});

const accountState = vi.hoisted(() => ({ current: null as unknown as AccountViewState }));
const marketState = vi.hoisted(() => ({ current: null as unknown as MarketState }));

vi.mock('../../lib/account/use-account-view', () => ({
  useAccountView: () => accountState.current,
}));

vi.mock('../../lib/market/use-market-snapshot', () => ({
  useMarketSnapshot: () => ({
    state: marketState.current,
    snapshot: marketState.current.status === 'ready' ? marketState.current.view.snapshot : null,
    refreshItem: () => Promise.resolve(),
  }),
}));

const CAPTURED_AT = '2026-08-12T00:00:00.000Z';
const PRICED_DEF = 'espada_ferro';
const RARITY = 2;

function snapshot(): MarketSnapshot {
  const entries: MarketEntry[] = [
    {
      hashName: 'Iron Sword (Rare)',
      name: 'Iron Sword (Rare)',
      key: priceKey(PRICED_DEF, RARITY),
      defId: PRICED_DEF,
      kind: null,
      category: null,
      set: null,
      slot: null,
      rarityIdx: RARITY,
      level: null,
      act: null,
      lowestUsd: 3,
      lowestNative: {},
      listings: 4,
      iconUrl: null,
      fetchedUtc: CAPTURED_AT,
      nativeQuotedUtc: null,
    },
  ];
  return {
    schemaVersion: 3,
    generatedUtc: CAPTURED_AT,
    appId: 1,
    baseCurrency: 'USD',
    nativeCurrencies: [],
    fx: { USD: 1, BRL: 1 },
    entries,
    index: { [priceKey(PRICED_DEF, RARITY)]: 0 },
    alternates: {},
    unlisted: [],
    anomalies: [],
    coverage: {
      marketRows: 1,
      keyedRows: 1,
      pricedRows: 1,
      unkeyedRows: 0,
      catalogKeys: 1,
      matchedCatalogKeys: 1,
      searchCalls: 1,
    },
  };
}

const RAW_ITEMS = [
  { id: 'i1', def_id: PRICED_DEF, rarity: RARITY, category: 0, tradable: true },
  { id: 'i2', def_id: PRICED_DEF, rarity: RARITY, category: 0, tradable: true },
  { id: 'i3', def_id: PRICED_DEF, rarity: RARITY, category: 0, tradable: false },
  { id: 'i4', def_id: 'nao_listado', rarity: RARITY, category: 0, tradable: true },
];

const FIDELITY: AccountFidelity = {
  account: { status: 'resolved', capturedAt: CAPTURED_AT },
  heroes: { status: 'resolved', capturedAt: CAPTURED_AT },
  skills: { status: 'resolved', capturedAt: CAPTURED_AT },
  casa: { status: 'resolved', capturedAt: CAPTURED_AT },
  items: { status: 'resolved', capturedAt: CAPTURED_AT },
};

const PAYLOAD: AccountPayload = { heroes: [], items: RAW_ITEMS, fidelity: FIDELITY };

function loaded(payload: AccountPayload): AccountViewState {
  const view: AccountViewData = {
    payload,
    gameRunning: true,
    store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
  };
  return { status: 'loaded', view, applied: 1, key: 'k' };
}

function html(): string {
  return renderToStaticMarkup(createElement(InventoryView));
}

beforeEach(() => {
  accountState.current = loaded(PAYLOAD);
  marketState.current = {
    status: 'ready',
    applied: 1,
    view: {
      snapshot: snapshot(),
      source: 'cache',
      publishedUtc: CAPTURED_AT,
      adoptedUtc: CAPTURED_AT,
      checkedUtc: CAPTURED_AT,
      lastError: null,
    },
  };
});

describe('the Inventory header', () => {
  it('prints exactly what the shared bag computation returns, and the coverage that goes with it', () => {
    const totals = bagTotals(buildInventoryView(RAW_ITEMS).items, snapshot());
    if (totals === null) throw new Error('the snapshot is in hand, so the bag has a figure');
    expect(totals).toEqual({ total: 6, priced: 2, tradable: 3 });

    const markup = html();
    expect(markup).toContain(formatMoney(totals.total, 'en', 'BRL'));
    expect(markup).toContain(
      en.inventoryTotalsCoverage
        .replace('{priced}', String(totals.priced))
        .replace('{tradable}', String(totals.tradable)),
    );
  });

  it('names the bag rather than the whole account, which is a different figure on another screen', () => {
    expect(html()).toContain(en.inventoryTotalsTitle);
    expect(en.inventoryTotalsTitle).not.toBe(en.accountHoldingsTotal);
  });

  it('shows no figure at all with no snapshot in hand, rather than a zero', () => {
    marketState.current = { status: 'unavailable', applied: 0, view: null };
    expect(html()).not.toContain('inventory-totals');
  });
});
