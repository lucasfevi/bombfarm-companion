'use client';

/**
 * The Inventory screen — every item the account carries, grouped by kind. Reads the account
 * through the shared `useAccountView()` seam, and hands the raw
 * `/inventory` rows straight to the domain's grouping. Nothing is recomputed in a component:
 * `buildInventoryView` is a `useMemo` over the `AccountView` reference — the IPC boundary
 * structurally clones on every push, so that reference is the only cheap identity to key on, and
 * the desktop renderer does not enable the React Compiler, so the hand memoisation is load-bearing.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banner, EmptyState, Panel, PanelHeader } from '@bombfarm/ui';
import {
  InventoryGrid,
  InventoryLayoutToggle,
  InventoryTable,
  InventoryTotals,
  type InventoryLayout,
} from '@bombfarm/game-art';
import {
  buildInventoryView,
  mapInventoryHeroes,
  type InventoryEntry,
  type InventoryViewItem,
} from '@bombfarm/domain/inventory-view';
import { resolveItemPrice } from '@bombfarm/pricing';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import { bagTotals } from '../../lib/account/account-holdings';
import { useMarketSnapshot } from '../../lib/market/use-market-snapshot';
import { inventoryLabels, inventoryTableLabels } from './inventory-labels';
import { marketPriceLabels } from './market-labels';
import { ItemPriceRefresh } from './item-price-refresh';

const LAYOUT_STORAGE_KEY = 'bfc-inventory-layout';


function loadLayout(): InventoryLayout {
  try {
    return window.localStorage.getItem(LAYOUT_STORAGE_KEY) === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

export function InventoryView() {
  const t = useCopy();
  const { lang, locale } = useLocale();
  const accountViewState = useAccountView();

  const view = accountViewState.status === 'loaded' ? accountViewState.view : null;
  // Keyed on the SECTIONS, not on the `AccountView` — `accountChangeKey` hashes every section's
  // whole body, so one gold tick mints a new view. Keyed on `view` these both re-derived, `labels`
  // became a new object, and every card re-rendered for a change to a number the screen does not
  // show. The IPC boundary structurally clones, so the section arrays are still the only cheap
  // identity to key on; they just move far less often than their container.
  const inventory = useMemo(() => buildInventoryView(view?.payload.items), [view?.payload.items]);
  const heroes = useMemo(() => mapInventoryHeroes(view?.payload.heroes), [view?.payload.heroes]);
  const labels = useMemo(() => inventoryLabels(t, lang, heroes), [t, lang, heroes]);
  const tableLabels = useMemo(() => inventoryTableLabels(t, lang, heroes), [t, lang, heroes]);

  const { snapshot, refreshItem } = useMarketSnapshot();
  const [layout, setLayout] = useState<InventoryLayout>('cards');

  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  const chooseLayout = useCallback((next: InventoryLayout) => {
    setLayout(next);
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      // A layout preference is not worth failing a render over.
    }
  }, []);

  const priceLabels = useMemo(() => marketPriceLabels(t, locale), [t, locale]);

  const priceOf = useMemo(
    () =>
      snapshot == null
        ? undefined
        : (entry: InventoryEntry) =>
            resolveItemPrice(
              {
                defId: entry.item.defId,
                rarity: entry.item.rarityIdx,
                tradable: entry.item.tradable,
              },
              snapshot,
              'BRL',
            ),
    [snapshot],
  );

  const priceOfItem = useMemo(
    () =>
      snapshot == null
        ? undefined
        : (item: InventoryViewItem) =>
            resolveItemPrice(
              { defId: item.defId, rarity: item.rarityIdx, tradable: item.tradable },
              snapshot,
              'BRL',
            ),
    [snapshot],
  );

  const isPricedItem = useMemo(
    () =>
      priceOfItem == null ? undefined : (item: InventoryViewItem) => priceOfItem(item).state === 'priced',
    [priceOfItem],
  );

  // Over the whole bag, not the filtered view — this is what it holds, not what is on screen.
  // Summed by the shared account-wide computation with the other components withheld, so this
  // header and the Account screen's bag row cannot disagree about the same bag.
  const totals = useMemo(() => bagTotals(inventory.items, snapshot), [inventory, snapshot]);

  const totalsLabels = useMemo(
    () => ({
      title: t.inventoryTotalsTitle,
      amount: priceLabels.amount,
      coverage: (priced: number, tradable: number) =>
        sub(t.inventoryTotalsCoverage, { priced, tradable }),
    }),
    [t, priceLabels],
  );

  const layoutToggle = (
    <InventoryLayoutToggle
      layout={layout}
      onChange={chooseLayout}
      labels={{
        group: t.inventoryViewLabel,
        cards: t.inventoryViewCards,
        list: t.inventoryViewList,
      }}
    />
  );

  const renderPriceAction = useMemo(
    () =>
      priceOf == null
        ? undefined
        : (entry: InventoryEntry) => {
            const price = priceOf(entry);
            // Nothing to refresh for an item the market cannot carry at all.
            if (price.state === 'not-tradable' || price.key == null) return null;
            const name = labels.itemName(entry.item);
            return (
              <ItemPriceRefresh
                target={{ kind: 'key', key: price.key }}
                itemName={name}
                label={sub(t.marketRefreshItem, { item: name })}
                onRefresh={refreshItem}
              />
            );
          },
    [priceOf, labels, t, refreshItem],
  );

  if (accountViewState.status === 'loading') {
    return (
      <div data-testid="inventory-view">
        <EmptyState title={t.accountLoadingTitle} />
      </div>
    );
  }

  if (accountViewState.status === 'bridge-unavailable') {
    return (
      <div data-testid="inventory-view">
        <EmptyState title={t.emptyBridgeUnavailableTitle} />
      </div>
    );
  }

  if (accountViewState.status === 'error') {
    // The raw message from main is untranslatable English, so it is carried as diagnostic data
    // only and never rendered as player-facing copy.
    return (
      <div data-testid="inventory-view">
        <Banner tone="warn" title={t.errorAccountReadFailed} data-account-error-detail={accountViewState.message}>
          {t.errorAccountReadFailedDescription}
        </Banner>
      </div>
    );
  }

  return (
    <div data-testid="inventory-view" className="flex min-h-0 flex-1 flex-col">
      <Panel className="flex min-h-0 flex-1 flex-col">
        <PanelHeader title={t.inventoryTitle} />
        {totals ? (
          <InventoryTotals
            total={totals.total}
            currency="BRL"
            priced={totals.priced}
            tradable={totals.tradable}
            labels={totalsLabels}
            className="mb-3"
          />
        ) : null}

        {layout === 'list' ? (
          <InventoryTable
            view={inventory}
            labels={tableLabels}
            priceOf={priceOf}
            priceLabels={priceOf == null ? undefined : priceLabels}
            renderPriceAction={renderPriceAction}
            isPricedItem={isPricedItem}
            toolbarActions={layoutToggle}
            className="min-h-0 flex-1"
          />
        ) : (
          <InventoryGrid
            view={inventory}
            labels={labels}
            priceOf={priceOf}
            priceLabels={priceOf == null ? undefined : priceLabels}
            renderPriceAction={renderPriceAction}
            isPricedItem={isPricedItem}
            toolbarActions={layoutToggle}
            className="min-h-0 flex-1"
          />
        )}
      </Panel>
    </div>
  );
}
