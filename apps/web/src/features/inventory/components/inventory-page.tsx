'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InventoryLayout } from '@bombfarm/game-art';
import {
  InventoryGrid,
  InventoryLayoutToggle,
  InventoryTable,
  InventoryTotals,
} from '@bombfarm/game-art';
import { Panel, PanelHeader } from '@bombfarm/ui';
import type { InventoryView } from '@bombfarm/domain/inventory-view';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore } from '@/shared/stores';
import { inventoryViewFromStorage, loadInventoryView } from '@/shared/lib/inventory-view-storage';
import { formatPricesUpdated } from '@/shared/i18n';
import { inventoryLabels, inventoryTableLabels } from '../model/inventory-labels';
import { useInventoryPrices } from '../model/use-inventory-prices';
import { useFillsViewport } from '../model/use-fills-viewport';

const EMPTY_VIEW: InventoryView = { items: [], groups: [], skipped: 0 };

const LAYOUT_STORAGE_KEY = 'bf-inventory-layout';


/** Which layout a reader last chose. A preference, so a browser that refuses storage just
 *  defaults rather than breaking the page. */
function loadLayout(): InventoryLayout {
  try {
    return window.localStorage.getItem(LAYOUT_STORAGE_KEY) === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

function storeLayout(layout: InventoryLayout): void {
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
  const [layout, setLayout] = useState<InventoryLayout>('cards');

  const prices = useInventoryPrices(view);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelHeight = useFillsViewport(panelRef);

  useEffect(() => {
    setView(inventoryViewFromStorage(loadInventoryView()));
  }, [importedAt]);

  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  const chooseLayout = useCallback((next: InventoryLayout) => {
    setLayout(next);
    storeLayout(next);
  }, []);

  const labels = useMemo(() => inventoryLabels(t, lang, heroes), [t, lang, heroes]);
  const tableLabels = useMemo(() => inventoryTableLabels(t, lang, heroes), [t, lang, heroes]);

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

  // Both layouts take the same data and the same bounded box; only the labels differ.
  const shared = {
    view,
    priceOf: prices.priceOf,
    priceLabels: prices.priceOf == null ? undefined : prices.priceLabels,
    isPricedItem: prices.isPricedItem,
    toolbarActions: layoutToggle,
    className: 'min-h-0 flex-1',
  };

  return (
    <div
      ref={panelRef}
      className="mx-auto flex w-full max-w-app flex-col gap-4 p-4"
      style={panelHeight == null ? undefined : { height: panelHeight }}
    >
      <Panel className="flex min-h-0 flex-1 flex-col">
        <PanelHeader title={t.inventoryTitle} />
        <p className="pb-3 text-sm text-muted">{t.inventoryTip}</p>

        {/* No refresh control here: the planner has no way to ask Steam anything, so a button
            could only re-download the same six-hourly file and would promise a freshness it
            cannot deliver. The stamp says how old the prices are, which is the whole truth
            available. */}
        {prices.totals ? (
          <InventoryTotals
            total={prices.totals.total}
            currency={prices.currency}
            priced={prices.totals.priced}
            tradable={prices.totals.tradable}
            labels={prices.totalsLabels}
            className="mb-3"
            footnote={formatPricesUpdated(prices.generatedUtc, lang)}
          />
        ) : null}

        {layout === 'list' ? (
          <InventoryTable {...shared} labels={tableLabels} />
        ) : (
          <InventoryGrid {...shared} labels={labels} />
        )}
      </Panel>
    </div>
  );
}
