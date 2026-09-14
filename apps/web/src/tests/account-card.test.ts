import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HoldingsViewProps } from '@bombfarm/account/holdings';
import { houseLabel } from '@bombfarm/domain/game-labels';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { HOUSES, HOUSE_MAX_LEVEL, resolveHouseRestSeconds } from '@bombfarm/domain/model';
import { formatPhaseLabel } from '@bombfarm/farm/model/farm-ranking-format';
import type { MarketSnapshot } from '@bombfarm/pricing';
import { buildSnapshot, categoryKey, heroPriceKey, priceKey } from '@bombfarm/pricing';
import { formatHouseRest, formatLuckPoints, formatTreePercent } from '@/features/account';
import {
  accountHoldingsFrom,
  holdingsComponents,
  holdingsLabels,
  priceableHeroes,
  type HoldingsHero,
} from '@/features/account/model/account-holdings';
import { AccountCard } from '@/features/home/components/account-card';
import { STRINGS, formatMoney, sub, type Lang } from '@/shared/i18n';
import { resetPlannerStoreForTests, usePlannerStore, type PlannerStore } from '@/shared/stores';

vi.mock('@/shared/stores/planner-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/stores/planner-store')>();
  const live = Object.assign(
    (selector: (state: PlannerStore) => unknown) => selector(real.usePlannerStore.getState()),
    real.usePlannerStore,
  );
  return { ...real, usePlannerStore: live };
});

let snapshot: MarketSnapshot | null = null;
let holdings: Omit<HoldingsViewProps, 'inventoryLink' | 'className'> | null = null;

vi.mock('@/shared/hooks/use-market-snapshot', () => ({
  useMarketSnapshot: () => ({ snapshot, status: snapshot ? 'ready' : 'empty' }),
}));
vi.mock('@/features/account', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/features/account')>();
  return { ...real, useAccountHoldings: () => holdings };
});

const LANGS: readonly Lang[] = ['en', 'pt'];
const ROYAL_SENTINEL = 8;

const entry = (hashName: string, key: string, lowestUsd: number) => ({
  name: hashName,
  hashName,
  key,
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
  lowestUsd,
  listings: 1,
  iconUrl: null,
  fetchedUtc: '2026-09-01T00:00:00.000Z',
});

/** USD prices at a BRL rate of 5: one item, one hero rarity and one skin the market quotes. */
const SNAPSHOT = buildSnapshot({
  entries: [
    entry('Ember Weapon', priceKey('ember_arma', 1), 2),
    entry('Hero (Rare)', heroPriceKey(2), 10),
    entry('Royal Sentinel Skin', categoryKey('skin', 'Royal Sentinel Skin'), 6),
  ],
  prior: null,
  catalog: {
    defs: [{ defId: 'ember_arma', set: 'ember', slot: 'arma', level: 10 }],
    rarityIdxs: [1, 2],
    rarityTokens: { 1: 'incomum', 2: 'raro' },
    defIdByHash: {},
  },
  fx: { USD: 1, BRL: 5 },
  anomalies: [],
  searchCalls: 1,
  enumerationComplete: true,
  now: () => Date.parse('2026-09-01T12:00:00.000Z'),
});

const INVENTORY: InventoryViewItem[] = [
  {
    id: 'priced',
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
  },
];

const ROSTER = [
  { name: 'Aria', rarity: 'Raro' as const, marketable: true, skin: ROYAL_SENTINEL },
  { name: 'Bran', rarity: 'Raro' as const, marketable: false, skin: 0 },
];

function holdingsFor(
  market: MarketSnapshot | null,
  lang: Lang,
  heroes: HoldingsHero[] | null = priceableHeroes(ROSTER),
  inventory: InventoryViewItem[] | null = INVENTORY,
) {
  const raw = accountHoldingsFrom({
    inventory,
    heroes,
    skinsWorn: ROSTER.map((hero) => hero.skin),
    snapshot: market,
  });
  return { ...holdingsComponents(raw, heroes, lang), labels: holdingsLabels(STRINGS[lang], lang) };
}

const ACCOUNT = {
  phase: 51,
  maxPhase: 137,
  houseIdx: 2,
  houseLevel: 7,
  slots: 3,
  fieldSlots: 6,
  houseCycleSecs: 913,
  houseCycleSecsHouseIdx: 2,
  houseCycleSecsLevel: 7,
  treeSquadDmgPct: 12.345,
  treeLuckFlatPct: 3.5,
  missingRequiredFields: [],
} satisfies Partial<PlannerStore>;

const render = () => renderToStaticMarkup(createElement(AccountCard));
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
const escaped = (text: string) => text.replace(/'/g, '&#x27;');

describe('the front page account card', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    snapshot = null;
    holdings = null;
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it("prints the eight account rows in order with the Account page's labels and formatters", () => {
    for (const lang of LANGS) {
      usePlannerStore.setState({ ...ACCOUNT, lang });
      snapshot = SNAPSHOT;
      holdings = holdingsFor(SNAPSHOT, lang);
      const strings = STRINGS[lang];
      const html = render();
      const rest = resolveHouseRestSeconds(913, 2, 7, 2, 7);

      expect(html).toContain('data-home-card-state="ready"');
      expect(html).toContain(`>${strings.homeCardAccountContext}<`);
      expect(slots(html, 'home-account-label')).toEqual([
        strings.accountCurrentPhase,
        strings.accountMaxPhase,
        strings.house,
        strings.accountHouseCycle,
        strings.accountCasaSlots,
        strings.accountFieldSlots,
        strings.accountSquadDmg,
        strings.accountLuckFlat,
      ]);
      expect(slots(html, 'home-account-value')).toEqual([
        formatPhaseLabel(51, lang),
        formatPhaseLabel(137, lang),
        `${houseLabel(2, lang)} · ${sub(strings.homeCardAccountHouseLevel, { level: 7, max: HOUSE_MAX_LEVEL })}`,
        formatHouseRest(rest),
        '3',
        '6',
        formatTreePercent(12.345, lang),
        formatLuckPoints(3.5, lang),
      ]);
      expect(formatHouseRest(rest)).toBe('15 min 13 s');
      expect(footer(html)).toBe(sub(strings.accountNextHouse, { house: houseLabel(3, lang) }));
    }

    usePlannerStore.setState({ lang: 'en', fieldSlots: null, houseIdx: HOUSES.length - 1 });
    const maxed = render();
    expect(slots(maxed, 'home-account-value')[5]).toBe('—');
    expect(footer(maxed)).toBe(sub(STRINGS.en.homeCardAccountHouseMaxed, { house: houseLabel(HOUSES.length - 1, 'en') }));
  });

  it("the Account card's total equals the holdings hook's total, formatted the way the panel formats it", () => {
    for (const lang of LANGS) {
      usePlannerStore.setState({ ...ACCOUNT, lang });
      snapshot = SNAPSHOT;
      holdings = holdingsFor(SNAPSHOT, lang);
      const html = render();

      expect(holdings.total).toBe(90);
      expect(html).toContain(`>${STRINGS[lang].accountHoldingsTotal}<`);
      expect(slot(html, 'home-account-total')).toBe(holdings.labels.amount(90, holdings.currency));
      expect(slot(html, 'home-account-total')).toBe(formatMoney(90, lang, 'BRL'));
      expect(slot(html, 'home-account-partial')).toBeNull();
      expect(slot(html, 'home-account-inventory')).toBe(formatMoney(10, lang, 'BRL'));
      expect(slot(html, 'home-account-heroes')).toBe(formatMoney(50, lang, 'BRL'));
      expect(slot(html, 'home-account-skins')).toBe(formatMoney(30, lang, 'BRL'));
      expect(body(html)).toContain(`>${STRINGS[lang].accountHoldingsInventory}<`);
      expect(body(html)).toContain(`>${STRINGS[lang].accountHoldingsHeroes}<`);
      expect(body(html)).toContain(`>${STRINGS[lang].accountHoldingsSkins}<`);
    }
  });

  it('a heroes component the market cannot price shows its withheld label', () => {
    for (const lang of LANGS) {
      usePlannerStore.setState({ ...ACCOUNT, lang });
      snapshot = SNAPSHOT;
      holdings = holdingsFor(SNAPSHOT, lang, null);
      const strings = STRINGS[lang];
      const html = render();

      expect(holdings.heroes.withheld).toBe(true);
      expect(slot(html, 'home-account-heroes')).toBe(strings.accountHoldingsHeroesWithheld);
      expect(slot(html, 'home-account-partial')).toBe(strings.accountHoldingsPartial);
      expect(slot(html, 'home-account-total')).toBe(formatMoney(holdings.total, lang, 'BRL'));
      expect(slot(html, 'home-account-inventory')).toBe(formatMoney(10, lang, 'BRL'));
    }

    holdings = holdingsFor(SNAPSHOT, 'en', priceableHeroes(ROSTER), null);
    usePlannerStore.setState({ lang: 'en' });
    expect(slot(render(), 'home-account-inventory')).toBe(STRINGS.en.accountHoldingsInventoryWithheld);
  });

  it("with no snapshot every money slot reads 'not listed' and no currency string appears", () => {
    for (const lang of LANGS) {
      usePlannerStore.setState({ ...ACCOUNT, lang });
      snapshot = null;
      holdings = holdingsFor(null, lang);
      const unpriced = STRINGS[lang].accountHoldingsUnpriced;
      const html = render();

      expect(html).toContain('data-home-card-state="ready"');
      expect(slot(html, 'home-account-total')).toBe(unpriced);
      expect(slot(html, 'home-account-inventory')).toBe(unpriced);
      expect(slot(html, 'home-account-heroes')).toBe(unpriced);
      expect(slot(html, 'home-account-skins')).toBe(unpriced);
      expect(html).not.toContain('R$');
      expect(slots(html, 'home-account-value')).toHaveLength(8);
    }
  });

  it('without a usable account the card is in its needs state', () => {
    const expectNeeds = (lang: Lang) => {
      const html = render();
      expect(html).toContain('data-home-card-state="needs"');
      expect(textOf(body(html))).toBe('');
      expect(textOf(body(html))).not.toMatch(/\d/);
      expect(html).not.toContain('home-account-value');
      expect(footer(html)).toBe(escaped(STRINGS[lang].homeCardAccountNeeds));
    };

    snapshot = SNAPSHOT;
    holdings = holdingsFor(SNAPSHOT, 'en');
    expect(footer(render())).toBe('');

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang, phase: 51 });
      snapshot = SNAPSHOT;
      holdings = holdingsFor(SNAPSHOT, lang);
      expectNeeds(lang);
    }

    usePlannerStore.setState({ ...ACCOUNT, lang: 'en', maxPhase: null });
    expectNeeds('en');

    usePlannerStore.setState({ ...ACCOUNT, missingRequiredFields: ['tree'] });
    expectNeeds('en');

    usePlannerStore.setState({ ...ACCOUNT });
    expect(render()).toContain('data-home-card-state="ready"');
  });
});
