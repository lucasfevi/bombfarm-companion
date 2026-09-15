import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HoldingsViewProps } from '@bombfarm/account/holdings';
import { ITEM_KINDS, buildInventoryView, type InventoryView } from '@bombfarm/domain/inventory-view';
import type { MarketSnapshot } from '@bombfarm/pricing';
import { buildSnapshot, holdingsPrices, priceKey } from '@bombfarm/pricing';
import {
  accountHoldingsFrom,
  holdingsComponents,
  holdingsLabels,
} from '@/features/account/model/account-holdings';
import { InventoryCard } from '@/features/home/components/inventory-card';
import { STRINGS, formatMoney, formatPriceFreshness, sub, type Lang } from '@/shared/i18n';
import { resetPlannerStoreForTests, usePlannerStore, type PlannerStore } from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

vi.mock('@/shared/stores/planner-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/stores/planner-store')>();
  const live = Object.assign(
    (selector: (state: PlannerStore) => unknown) => selector(real.usePlannerStore.getState()),
    real.usePlannerStore,
  );
  return { ...real, usePlannerStore: live };
});

let inventoryView: InventoryView | null = null;
let snapshot: MarketSnapshot | null = null;
let holdings: Omit<HoldingsViewProps, 'inventoryLink' | 'className'> | null = null;

vi.mock('@/features/home/model/use-inventory-view-snapshot', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/features/home/model/use-inventory-view-snapshot')>();
  return { ...real, useInventoryViewSnapshot: () => inventoryView };
});
vi.mock('@/shared/hooks/use-market-snapshot', () => ({
  useMarketSnapshot: () => ({ snapshot, status: snapshot ? 'ready' : 'empty' }),
}));
vi.mock('@/features/account', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/features/account')>();
  return { ...real, useAccountHoldings: () => holdings };
});

const LANGS: readonly Lang[] = ['en', 'pt'];
const NOW = Date.parse('2026-09-13T12:00:00.000Z');
const QUOTED = '2026-09-01T00:00:00.000Z';
const STONE_CATEGORY = 5;

const SAVE_WITH_221_ITEMS = join(
  WEB_PACKAGE_ROOT,
  '../../packages/domain/tests/fixtures/sheet-math/save-20260823-13heroes-crit-points.json',
);

function rawItems(): { category: number }[] {
  return (JSON.parse(readFileSync(SAVE_WITH_221_ITEMS, 'utf8')) as { items: { category: number }[] }).items;
}

const SNAPSHOT = buildSnapshot({
  entries: [
    {
      name: 'Ember Weapon',
      key: priceKey('ember_arma', 2),
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
      lowestUsd: 2,
      listings: 1,
      iconUrl: null,
      fetchedUtc: QUOTED,
      hashName: 'Ember Weapon',
    },
  ],
  prior: null,
  catalog: {
    defs: [{ defId: 'ember_arma', set: 'ember', slot: 'arma', level: 10 }],
    rarityIdxs: [2],
    rarityTokens: { 2: 'raro' },
    defIdByHash: {},
  },
  fx: { USD: 1, BRL: 5 },
  anomalies: [],
  searchCalls: 1,
  enumerationComplete: true,
  now: () => NOW,
});

/** What the holdings hook hands the card, built the way the hook builds it. */
function holdingsFor(view: InventoryView, market: MarketSnapshot | null, lang: Lang, dated = true) {
  const raw = accountHoldingsFrom({ inventory: view.items, heroes: null, skinsWorn: null, snapshot: market });
  const footnote = dated ? formatPriceFreshness(holdingsPrices(raw), lang, NOW) : null;
  return {
    ...holdingsComponents(raw, null, lang),
    labels: holdingsLabels(STRINGS[lang], lang),
    footnote: footnote ?? undefined,
  };
}

const render = () => renderToStaticMarkup(createElement(InventoryCard));
const textOf = (html: string) => html.replace(/<[^>]+>/g, '');
const openingOf = (html: string, testId: string) =>
  html.lastIndexOf('<div', html.indexOf(`data-testid="${testId}"`));
const body = (html: string) =>
  html.slice(openingOf(html, 'home-card-body'), openingOf(html, 'home-card-footer'));
const footer = (html: string) => textOf(html.slice(openingOf(html, 'home-card-footer')));
const slot = (html: string, testId: string) =>
  new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? null;
const slots = (html: string, testId: string) =>
  [...html.matchAll(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`, 'g'))].map((match) => match[1]);

const SIX_KINDS = ITEM_KINDS.filter((kind) => kind !== 'other');
const GROUP_LABEL = {
  equipment: 'inventoryGroupEquipment',
  gem: 'inventoryGroupGem',
  key: 'inventoryGroupKey',
  time: 'inventoryGroupTime',
  stone: 'inventoryGroupStone',
  chest: 'inventoryGroupChest',
} as const;

describe('the front page inventory card', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    inventoryView = null;
    snapshot = null;
    holdings = null;
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('with 221 item rows and a snapshot the Inventory card prints six counts in kind order and the coverage footer', () => {
    const full = buildInventoryView(rawItems());
    const noStones = buildInventoryView(rawItems().filter((item) => item.category !== STONE_CATEGORY));
    expect(full.items).toHaveLength(221);
    expect(noStones.groups.some((group) => group.kind === 'stone')).toBe(false);

    for (const view of [full, noStones]) {
      for (const lang of LANGS) {
        usePlannerStore.setState({ lang });
        inventoryView = view;
        snapshot = SNAPSHOT;
        holdings = holdingsFor(view, SNAPSHOT, lang);
        const strings = STRINGS[lang];
        const html = render();
        const countOf = (kind: (typeof SIX_KINDS)[number]) =>
          String(view.groups.find((group) => group.kind === kind)?.count ?? 0);

        expect(html).toContain('data-home-card-state="ready"');
        expect(html).toContain(`>${strings.homeCardInventoryContext}<`);
        expect(holdings.inventory.priced).toBeGreaterThan(0);
        expect(slot(html, 'home-inventory-figure')).toBe(
          formatMoney(holdings.inventory.amount, lang, holdings.currency),
        );
        expect(slots(html, 'home-inventory-kind')).toEqual(SIX_KINDS.map((kind) => strings[GROUP_LABEL[kind]]));
        expect(slots(html, 'home-inventory-count')).toEqual(SIX_KINDS.map(countOf));
        expect(body(html)).not.toContain(strings.inventoryGroupOther);
        expect(holdings.footnote).toEqual(expect.stringContaining(strings.marketPricesOldest.split('{')[0]));
        expect(footer(html)).toBe(
          `${sub(strings.homeCardInventoryCoverage, {
            priced: holdings.inventory.priced,
            eligible: holdings.inventory.eligible,
          })} · ${holdings.footnote}`,
        );
      }
    }
    expect(slots(render(), 'home-inventory-count')).toContain('0');
  });

  it("with no snapshot the card reads 'not listed', prints no currency and omits the age segment", () => {
    const view = buildInventoryView(rawItems());

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      inventoryView = view;
      snapshot = null;
      holdings = holdingsFor(view, null, lang);
      const strings = STRINGS[lang];
      const html = render();

      expect(html).toContain('data-home-card-state="ready"');
      expect(slot(html, 'home-inventory-figure')).toBe(strings.accountHoldingsUnpriced);
      expect(html).not.toContain('R$');
      expect(slots(html, 'home-inventory-count')).toEqual(['137', '2', '6', '70', '4', '2']);
      expect(footer(html)).toBe(
        sub(strings.homeCardInventoryCoverage, {
          priced: holdings.inventory.priced,
          eligible: holdings.inventory.eligible,
        }),
      );
      expect(footer(html)).not.toContain(' · ');
    }
  });

  it('an oldest quote with no date drops the age segment only', () => {
    const view = buildInventoryView(rawItems());
    usePlannerStore.setState({ lang: 'en' });
    inventoryView = view;
    snapshot = SNAPSHOT;
    holdings = holdingsFor(view, SNAPSHOT, 'en', false);
    const html = render();

    expect(holdings.footnote).toBeUndefined();
    expect(slot(html, 'home-inventory-figure')).toBe(
      formatMoney(holdings.inventory.amount, 'en', holdings.currency),
    );
    expect(footer(html)).toBe(
      sub(STRINGS.en.homeCardInventoryCoverage, {
        priced: holdings.inventory.priced,
        eligible: holdings.inventory.eligible,
      }),
    );
  });

  it('without stored inventory rows the card is in its needs state', () => {
    const empty = buildInventoryView([]);

    inventoryView = null;
    snapshot = SNAPSHOT;
    holdings = holdingsFor(empty, SNAPSHOT, 'en');
    expect(footer(render())).toBe('');

    for (const view of [null, empty]) {
      for (const lang of LANGS) {
        usePlannerStore.setState({ lang, phase: 51 });
        inventoryView = view;
        snapshot = SNAPSHOT;
        holdings = holdingsFor(empty, SNAPSHOT, lang);
        const html = render();

        expect(html).toContain('data-home-card-state="needs"');
        expect(textOf(body(html))).toBe('');
        expect(footer(html)).toBe(STRINGS[lang].homeCardInventoryNeeds);
      }
    }
  });
});
