'use client';

import { useMemo } from 'react';
import type { MarketPriceLabels, InventoryTotalsLabels } from '@bombfarm/game-art';
import type { InventoryEntry, InventoryView, InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { MarketSnapshot } from '@bombfarm/pricing';
import { accountHoldings, resolveItemPrice } from '@bombfarm/pricing';
import { useAppLang } from '@/shared/context/app-lang';
import { useMarketSnapshot } from '@/shared/hooks/use-market-snapshot';
import {
  formatMoney,
  formatQuoteTooltip,
  formatUnpricedLabel,
  sub,
} from '@/shared/i18n';

/** The currency the market snapshot is quoted in. One for now, so it is stated once. */
const CURRENCY = 'BRL';

export interface InventoryTotals {
  /** Summed price of every item quoted right now. */
  total: number;
  priced: number;
  /** Items the game permits selling — the only ones that could ever carry a price. */
  tradable: number;
}

/**
 * What the inventory alone could sell, taken from the shared account-wide computation so this
 * screen and the Account page cannot disagree about the component they share. `eligible` is what
 * the game permits selling, which is what the header counts its coverage against.
 */
export function inventoryTotals(
  items: readonly InventoryViewItem[],
  snapshot: MarketSnapshot | null,
): InventoryTotals | null {
  if (snapshot == null) return null;
  const { inventory } = accountHoldings({
    inventory: items.map((item) => ({
      defId: item.defId,
      rarity: item.rarityIdx,
      tradable: item.tradable,
    })),
    heroes: null,
    skinsWorn: null,
    snapshot,
    currency: CURRENCY,
  });
  return { total: inventory.amount, priced: inventory.priced, tradable: inventory.eligible };
}

/**
 * Everything the Inventory screen needs to price what it draws.
 *
 * Lives beside the page rather than inside it because pricing is four related derivations over one
 * snapshot — a per-entry price for the cards and the table, a per-item predicate for the `Priced`
 * filter, the totals header, and the labels all three render through — and the page's job is
 * layout.
 */
export function useInventoryPrices(view: InventoryView) {
  const { t, lang } = useAppLang();
  const { snapshot, generatedUtc, refresh, isRefreshing } = useMarketSnapshot();

  const priceOfItem = useMemo(
    () =>
      snapshot == null
        ? undefined
        : (item: InventoryViewItem) =>
            resolveItemPrice(
              { defId: item.defId, rarity: item.rarityIdx, tradable: item.tradable },
              snapshot,
              CURRENCY,
            ),
    [snapshot],
  );

  const priceOf = useMemo(
    () => (priceOfItem == null ? undefined : (entry: InventoryEntry) => priceOfItem(entry.item)),
    [priceOfItem],
  );

  const isPricedItem = useMemo(
    () =>
      priceOfItem == null
        ? undefined
        : (item: InventoryViewItem) => priceOfItem(item).state === 'priced',
    [priceOfItem],
  );

  /**
   * Summed over the whole inventory, never the filtered view: narrowing to one set must not
   * restate what it holds as a smaller fortune.
   */
  const totals = useMemo(() => inventoryTotals(view.items, snapshot), [snapshot, view]);

  const priceLabels = useMemo<MarketPriceLabels>(
    () => ({
      amount: (amount, currency) => formatMoney(amount, lang, currency),
      title: (price) => formatQuoteTooltip(price, lang),
      unpriced: (state) => formatUnpricedLabel(state, lang),
    }),
    [lang],
  );

  const totalsLabels = useMemo<InventoryTotalsLabels>(
    () => ({
      title: t.inventoryTotalsTitle,
      amount: (value, currency) => formatMoney(value, lang, currency),
      coverage: (priced, tradable) => sub(t.inventoryTotalsCoverage, { priced, tradable }),
    }),
    [t, lang],
  );

  return {
    currency: CURRENCY,
    priceOf,
    isPricedItem,
    totals,
    priceLabels,
    totalsLabels,
    generatedUtc,
    refresh,
    isRefreshing,
  };
}
