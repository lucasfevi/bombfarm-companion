import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountFidelity, AccountPayload, AccountView as AccountViewData } from '@bombfarm/contracts';
import type { MarketEntry, MarketSnapshot } from '@bombfarm/pricing';
import { SKIN_CATEGORY, categoryKey, heroPriceKey, priceKey } from '@bombfarm/pricing';
import { en } from '../../lib/copy/en';
import type { AccountViewState } from '../../lib/account/use-account-view';
import type { MarketState } from '../../lib/market/market-store';
import { AccountView } from './account-view';

// `useCopy()`/`useLocale()` are hooks over a context this test never mounts a provider for, and
// the two data seams reach a preload bridge that does not exist in a node-environment render.
// Every one of the four is replaced; `sub()` stays the real implementation so the age line and
// the coverage labels exercise genuine substitution.
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
const EARLIER = '2026-08-11T00:00:00.000Z';
const HERO_RARITY = 4;
/** A rarity the snapshot below quotes nothing for, so its hero is sellable and unpriced. */
const UNLISTED_HERO_RARITY = 2;
const ITEM_DEF = 'espada_ferro';
const ITEM_RARITY = 2;

function entry(key: string, hashName: string, lowestUsd: number): MarketEntry {
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
    listings: 3,
    iconUrl: null,
    fetchedUtc: CAPTURED_AT,
    nativeQuotedUtc: null,
  };
}

function snapshot(): MarketSnapshot {
  const entries = [
    entry(heroPriceKey(HERO_RARITY), 'Hero (Legendary)', 20),
    entry(categoryKey(SKIN_CATEGORY, 'Forest Warden Skin'), 'Forest Warden Skin', 7),
    entry(priceKey(ITEM_DEF, ITEM_RARITY), 'Iron Sword (Rare)', 3),
  ];
  const index: Record<string, number> = {};
  entries.forEach((row, position) => {
    index[row.key] = position;
  });
  return {
    schemaVersion: 3,
    generatedUtc: CAPTURED_AT,
    appId: 1,
    baseCurrency: 'USD',
    nativeCurrencies: [],
    fx: { USD: 1, BRL: 1 },
    entries,
    index,
    alternates: {},
    unlisted: [],
    anomalies: [],
    coverage: {
      marketRows: 3,
      keyedRows: 3,
      pricedRows: 3,
      unkeyedRows: 0,
      catalogKeys: 3,
      matchedCatalogKeys: 3,
      searchCalls: 1,
    },
  };
}

function resolvedFidelity(overrides: Partial<AccountFidelity> = {}): AccountFidelity {
  return {
    account: { status: 'resolved', capturedAt: CAPTURED_AT },
    heroes: { status: 'resolved', capturedAt: CAPTURED_AT },
    skills: { status: 'resolved', capturedAt: CAPTURED_AT },
    casa: { status: 'resolved', capturedAt: CAPTURED_AT },
    items: { status: 'resolved', capturedAt: CAPTURED_AT },
    ...overrides,
  };
}

function payloadOf(fidelity: AccountFidelity = resolvedFidelity()): AccountPayload {
  return {
    account: { phase: 60, max_phase: 88, player_name: 'Tester', account_id: 1 },
    heroes: [
      { id: 'h1', name: 'Vex', rarity: HERO_RARITY, skin: 4, marketable: true },
      { id: 'h2', name: 'Nim', rarity: UNLISTED_HERO_RARITY, skin: 0, marketable: true },
      { id: 'h3', name: 'Bound', rarity: HERO_RARITY, skin: 0, marketable: false },
    ],
    skills: {
      field_slots: 6,
      totals: {
        dmg_static: 1.5,
        crit_chance_add: 0.1,
        crit_dmg_add: 0.25,
        speed_add: 0.2,
        energia_add: 0.3,
        coin_add: 0.4,
        xp_mult: 1.25,
        luck_add: 0.05,
        team_dmg_add: 0.179,
        geo_mult: 1.0258,
        vagas_campo: 5,
        bag_tabs_bonus: 2,
      },
    },
    casa: { active_casa: 1, levels: [10], slots: 3, cycle_secs: 1168 },
    items: [{ id: 'i1', def_id: ITEM_DEF, rarity: ITEM_RARITY, category: 0, tradable: true }],
    fidelity,
  };
}

function loaded(payload: AccountPayload): AccountViewState {
  const view: AccountViewData = {
    payload,
    gameRunning: true,
    store: { status: 'ok', reason: null, binding: 'better-sqlite3' },
  };
  return { status: 'loaded', view, applied: 1, key: 'k' };
}

function html(): string {
  return renderToStaticMarkup(createElement(AccountView, { onOpenInventory: () => {} }));
}

/** Every occurrence of a repeated `data-testid` slot, in document order. */
function slots(markup: string, testId: string): string[] {
  return [...markup.matchAll(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`, 'g'))].map(
    (match) => match[1] ?? '',
  );
}

beforeEach(() => {
  accountState.current = loaded(payloadOf());
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

describe('the Account screen', () => {
  it('draws the holdings section, the identity panel, the House and the tree', () => {
    const markup = html();
    expect(markup).toContain('account-holdings');
    expect(markup).toContain(en.accountPanelTitle);
    expect(markup).toContain(en.accountHouse);
    expect(markup).toContain(en.accountTreePanelTitle);
  });

  it('leads with the holdings section, above the identity panel', () => {
    const markup = html();
    expect(markup.indexOf('data-testid="account-holdings"')).toBeLessThan(
      markup.indexOf(en.accountPanelTitle),
    );
  });

  it('prices the heroes the game marks sellable — the component the web planner cannot draw', () => {
    const markup = html();
    expect(markup).toContain('account-holdings-heroes-amount');
    expect(markup).not.toContain('account-holdings-heroes-withheld');
    expect(markup).toContain(en.accountHoldingsHeroesFloor);
  });

  it('claims the whole account only while every component was read', () => {
    expect(html()).toContain(en.accountHoldingsTotal);
  });

  it('stops claiming the whole account, and names what is missing, once a component is unread', () => {
    accountState.current = loaded(payloadOf(resolvedFidelity({ items: { status: 'missing' } })));
    const markup = html();
    expect(markup).toContain(en.accountHoldingsPartialTotal);
    expect(markup).not.toContain(en.accountHoldingsTotal);
    expect(markup).toContain('account-holdings-inventory-withheld');
  });
});

describe('the things each holdings component is made of', () => {
  it('lists every sellable hero by name, beside the rarity the market quotes it on', () => {
    const markup = html();
    expect(slots(markup, 'account-holdings-heroes-entry-name')).toEqual(['Vex', 'Nim']);
    expect(slots(markup, 'account-holdings-heroes-entry-detail')).toEqual(['Legendary', 'Rare']);
  });

  it('leaves the hero the game forbids selling out of the list, as it is out of the figure', () => {
    const markup = html();
    expect(markup).not.toContain('>Bound<');
    expect(slots(markup, 'account-holdings-heroes-entry')).toHaveLength(2);
  });

  it('keeps a sellable hero the market lists nothing for, and marks it rather than dropping it', () => {
    // The coverage line reads "1 of 2 sellable heroes priced"; the marked entry is what says
    // WHICH of the two the figure left out.
    const markup = html();
    expect(slots(markup, 'account-holdings-heroes-entry-amount')).toEqual(['R$20.00']);
    expect(slots(markup, 'account-holdings-heroes-entry-unpriced')).toEqual([
      en.accountHoldingsUnpriced,
    ]);
  });

  it('names a hero the roster carried no name for rather than drawing an empty row', () => {
    accountState.current = loaded({
      ...payloadOf(),
      heroes: [{ id: 'h1', rarity: HERO_RARITY, skin: 0, marketable: true }],
    });
    expect(slots(html(), 'account-holdings-heroes-entry-name')).toEqual(['—']);
  });

  it('lists a bought skin by the listing it appears under, with nothing to tell two apart', () => {
    const markup = html();
    expect(slots(markup, 'account-holdings-skins-entry-name')).toEqual(['Forest Warden Skin']);
    expect(slots(markup, 'account-holdings-skins-entry-detail')).toEqual([]);
    expect(slots(markup, 'account-holdings-skins-entry-amount')).toEqual(['R$7.00']);
  });

  it('leaves the inventory column its figure and its link, and no list of dozens of rows', () => {
    const markup = html();
    expect(slots(markup, 'account-holdings-inventory-entry')).toEqual([]);
    expect(markup).not.toContain('account-holdings-inventory-entries');
    expect(markup).toContain('account-holdings-inventory-amount');
    expect(markup).toContain('account-holdings-inventory-link');
    expect(markup).toContain(en.accountHoldingsInventoryLink);
  });
});

describe('the account-read age, which is a different clock from the price age', () => {
  it('prints how old the account read is, beside the price age inside the holdings section', () => {
    const markup = html();
    expect(markup).toContain('account-read-age');
    expect(markup).toContain('account-holdings-footnote');
  });

  it('dates the line from the stalest section, not the freshest', () => {
    accountState.current = loaded(
      payloadOf(resolvedFidelity({ casa: { status: 'stale', capturedAt: EARLIER } })),
    );
    const days = Math.round((Date.now() - Date.parse(EARLIER)) / 86_400_000);
    expect(html()).toContain(en.ageDays.replace('{n}', String(days)));
  });

  it('prints no age line at all when nothing carries a capture time', () => {
    const allMissing = {
      account: { status: 'missing' },
      heroes: { status: 'missing' },
      skills: { status: 'missing' },
      casa: { status: 'missing' },
      items: { status: 'missing' },
    } as const satisfies AccountFidelity;
    accountState.current = loaded(payloadOf(allMissing));
    expect(html()).not.toContain('account-read-age');
  });
});

describe('a panel whose sections were not read is not drawn', () => {
  it('drops the House and keeps the tree when the house section is unread', () => {
    accountState.current = loaded(payloadOf(resolvedFidelity({ casa: { status: 'missing' } })));
    const markup = html();
    expect(markup).not.toContain(en.accountHouseCycle);
    expect(markup).toContain(en.accountTreePanelTitle);
  });

  it('drops the tree and keeps the House when the skill section is unread', () => {
    accountState.current = loaded(payloadOf(resolvedFidelity({ skills: { status: 'missing' } })));
    const markup = html();
    expect(markup).not.toContain(en.accountTreeGroupRewards);
    expect(markup).toContain(en.accountHouseCycle);
  });

  it('says so once no panel can be drawn at all', () => {
    accountState.current = loaded(
      payloadOf(
        resolvedFidelity({
          account: { status: 'missing' },
          casa: { status: 'missing' },
          skills: { status: 'missing' },
        }),
      ),
    );
    const markup = html();
    expect(markup).toContain(en.accountUnavailableTitle);
    expect(markup).toContain('account-holdings');
  });

  it('keeps quiet about it while the panels are there', () => {
    expect(html()).not.toContain(en.accountUnavailableTitle);
  });
});

describe('the account-read states every screen shares', () => {
  it('shows the loading state before anything has arrived', () => {
    accountState.current = { status: 'loading', applied: 0, key: null };
    expect(html()).toContain(en.accountLoadingTitle);
  });

  it('shows the bridge state when the preload bridge is not there', () => {
    accountState.current = { status: 'bridge-unavailable', applied: 0, key: null };
    expect(html()).toContain(en.emptyBridgeUnavailableTitle);
  });

  it('carries a failed read as diagnostic data and never as player-facing copy', () => {
    accountState.current = { status: 'error', message: 'ECONNRESET', applied: 0, key: null };
    const markup = html();
    expect(markup).toContain(en.errorAccountReadFailed);
    expect(markup).toContain('data-account-error-detail="ECONNRESET"');
  });
});
