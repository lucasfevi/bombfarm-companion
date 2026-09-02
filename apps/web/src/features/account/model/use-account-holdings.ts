'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HoldingsViewProps } from '@bombfarm/account/holdings';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { useAppLang } from '@/shared/context/app-lang';
import { useMarketSnapshot } from '@/shared/hooks/use-market-snapshot';
import { formatPricesUpdated } from '@/shared/i18n';
import { loadInventoryView } from '@/shared/lib/inventory-view-storage';
import { selectHeroes, usePlannerStore } from '@/shared/stores';
import {
  accountHoldingsFrom,
  holdingsComponents,
  holdingsLabels,
  inventoryFromStorage,
  priceableHeroes,
  skinsWornBy,
} from './account-holdings';

/**
 * What the Account page's holdings section renders.
 *
 * Lives beside the page rather than inside it because the figure is three separate account reads
 * against one market snapshot, and each read has its own answer for "could this be read at all" —
 * the page's job is layout.
 */
export function useAccountHoldings(): Omit<HoldingsViewProps, 'inventoryLink' | 'className'> {
  const { t, lang } = useAppLang();
  const { snapshot, generatedUtc } = useMarketSnapshot();
  const heroes = usePlannerStore(selectHeroes);
  // The store's import stamp is the change signal, not the data: an import writes both the store
  // and the stored inventory, so re-reading on it keeps the two in step. Read in an effect, never
  // during render — this route prerenders to static HTML, where `localStorage` does not exist.
  const importedAt = usePlannerStore((state) => state.inventory.importedAt);
  const [inventory, setInventory] = useState<InventoryViewItem[] | null>(null);

  useEffect(() => {
    setInventory(inventoryFromStorage(loadInventoryView()));
  }, [importedAt]);

  const skinsWorn = useMemo(() => skinsWornBy(heroes), [heroes]);
  const sellable = useMemo(() => priceableHeroes(heroes), [heroes]);
  const holdings = useMemo(
    () => accountHoldingsFrom({ inventory, heroes: sellable, skinsWorn, snapshot }),
    [inventory, sellable, skinsWorn, snapshot],
  );
  const labels = useMemo(() => holdingsLabels(t, lang), [t, lang]);

  return {
    ...holdingsComponents(holdings, sellable, lang),
    labels,
    footnote: generatedUtc == null ? undefined : formatPricesUpdated(generatedUtc, lang),
  };
}
