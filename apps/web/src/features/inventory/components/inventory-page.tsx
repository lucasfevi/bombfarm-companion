'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { InventoryGrid, InventoryTable, type MarketPriceLabels } from '@bombfarm/game-art';
import { Button, Panel, PanelHeader } from '@bombfarm/ui';
import type { InventoryEntry, InventoryView } from '@bombfarm/domain/inventory-view';
import { resolveItemPrice } from '@bombfarm/pricing';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore } from '@/shared/stores';
import { inventoryViewFromStorage, loadInventoryView } from '@/shared/lib/inventory-view-storage';
import { useMarketSnapshot } from '@/shared/hooks/use-market-snapshot';
import {
  formatMoney,
  formatPricesUpdated,
  formatQuoteTooltip,
  formatUnpricedLabel,
} from '@/shared/i18n';
import { inventoryLabels, inventoryTableLabels } from '../model/inventory-labels';

const EMPTY_VIEW: InventoryView = { items: [], groups: [], skipped: 0 };

type Layout = 'cards' | 'list';

const LAYOUT_STORAGE_KEY = 'bf-inventory-layout';

/** Which layout a reader last chose. A preference, so a browser that refuses storage just
 *  defaults rather than breaking the page. */
function loadLayout(): Layout {
  try {
    return window.localStorage.getItem(LAYOUT_STORAGE_KEY) === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

function storeLayout(layout: Layout): void {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  } catch {
    // A preference is not worth failing a render over.
  }
}

export function InventoryPage() {
  const { t, lang } = useAppLang();
  // The store's import stamp is the change signal, not the data: a save import writes both the
  // optimizer snapshot (which moves this) and the display list, so re-reading on it keeps the two
  // in step without a second store slice. Read in an effect, never during render — this route
  // prerenders to static HTML, where `localStorage` does not exist.
  const importedAt = usePlannerStore((state) => state.inventory.importedAt);
  const heroes = usePlannerStore((state) => state.heroes);
  const [view, setView] = useState<InventoryView>(EMPTY_VIEW);
  const [layout, setLayout] = useState<Layout>('cards');

  const { snapshot, generatedUtc, refresh, isRefreshing } = useMarketSnapshot();

  useEffect(() => {
    setView(inventoryViewFromStorage(loadInventoryView()));
  }, [importedAt]);

  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  const chooseLayout = useCallback((next: Layout) => {
    setLayout(next);
    storeLayout(next);
  }, []);

  const labels = useMemo(() => inventoryLabels(t, lang, heroes), [t, lang, heroes]);
  const tableLabels = useMemo(() => inventoryTableLabels(t, lang, heroes), [t, lang, heroes]);

  const priceLabels = useMemo<MarketPriceLabels>(
    () => ({
      amount: (amount, currency) => formatMoney(amount, lang, currency),
      title: (price) => formatQuoteTooltip(price, lang),
      unpriced: (state) => formatUnpricedLabel(state, lang),
    }),
    [lang],
  );

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

  const showPrices = priceOf != null;

  return (
    <div className="mx-auto flex w-full max-w-app flex-col gap-4 p-4">
      <Panel>
        <PanelHeader title={t.inventoryTitle} />
        <p className="pb-3 text-sm text-muted">{t.inventoryTip}</p>

        <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-1" role="group" aria-label={t.inventoryViewLabel}>
            <Button
              variant={layout === 'cards' ? 'primary' : 'ghost'}
              aria-pressed={layout === 'cards'}
              onClick={() => {
                chooseLayout('cards');
              }}
            >
              {t.inventoryViewCards}
            </Button>
            <Button
              variant={layout === 'list' ? 'primary' : 'ghost'}
              aria-pressed={layout === 'list'}
              onClick={() => {
                chooseLayout('list');
              }}
            >
              {t.inventoryViewList}
            </Button>
          </div>

          {showPrices ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{formatPricesUpdated(generatedUtc, lang)}</span>
              <Button
                variant="ghost"
                onClick={refresh}
                disabled={isRefreshing}
                aria-label={t.marketRefreshName}
              >
                {t.marketRefreshLabel}
              </Button>
            </div>
          ) : null}
        </div>

        {layout === 'list' ? (
          <InventoryTable
            view={view}
            labels={tableLabels}
            priceOf={priceOf}
            priceLabels={showPrices ? priceLabels : undefined}
          />
        ) : (
          <InventoryGrid
            view={view}
            labels={labels}
            priceOf={priceOf}
            priceLabels={showPrices ? priceLabels : undefined}
          />
        )}
      </Panel>
    </div>
  );
}
