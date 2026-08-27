'use client';

import { useEffect, useMemo, useState } from 'react';
import { InventoryGrid } from '@bombfarm/game-art';
import { Panel, PanelHeader } from '@bombfarm/ui';
import type { InventoryView } from '@bombfarm/domain/inventory-view';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore } from '@/shared/stores';
import { inventoryViewFromStorage, loadInventoryView } from '@/shared/lib/inventory-view-storage';
import { inventoryLabels } from '../model/inventory-labels';

const EMPTY_VIEW: InventoryView = { items: [], groups: [], skipped: 0 };

export function InventoryPage() {
  const { t, lang } = useAppLang();
  // The store's import stamp is the change signal, not the data: a save import writes both the
  // optimizer snapshot (which moves this) and the display list, so re-reading on it keeps the two
  // in step without a second store slice. Read in an effect, never during render — this route
  // prerenders to static HTML, where `localStorage` does not exist.
  const importedAt = usePlannerStore((state) => state.inventory.importedAt);
  const heroes = usePlannerStore((state) => state.heroes);
  const [view, setView] = useState<InventoryView>(EMPTY_VIEW);

  useEffect(() => {
    setView(inventoryViewFromStorage(loadInventoryView()));
  }, [importedAt]);

  const labels = useMemo(() => inventoryLabels(t, lang, heroes), [t, lang, heroes]);

  return (
    <div className="mx-auto flex w-full max-w-app flex-col gap-4 p-4">
      <Panel>
        <PanelHeader title={t.inventoryTitle} />
        <p className="pb-3 text-sm text-muted">{t.inventoryTip}</p>
        <InventoryGrid view={view} labels={labels} />
      </Panel>
    </div>
  );
}
