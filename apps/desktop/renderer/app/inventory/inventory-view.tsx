'use client';

/**
 * The Inventory screen — every item the account carries, grouped by kind. Reads the account
 * through the same `useAccountView()` seam the Planning screen uses, and hands the raw
 * `/inventory` rows straight to the domain's grouping. Nothing is recomputed in a component:
 * `buildInventoryView` is a `useMemo` over the `AccountView` reference — the IPC boundary
 * structurally clones on every push, so that reference is the only cheap identity to key on, and
 * the desktop renderer does not enable the React Compiler, so the hand memoisation is load-bearing.
 */
import { useMemo } from 'react';
import { Banner, EmptyState, Panel, PanelHeader } from '@bombfarm/ui';
import { InventoryGrid } from '@bombfarm/game-art';
import { buildInventoryView, mapInventoryHeroes } from '@bombfarm/domain/inventory-view';
import { useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/planning/use-account-view';
import { inventoryLabels } from './inventory-labels';

export function InventoryView() {
  const t = useCopy();
  const { lang } = useLocale();
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

  if (accountViewState.status === 'loading') {
    return (
      <div data-testid="inventory-view">
        <EmptyState title={t.planningLoadingTitle} />
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
    // Same posture as the Planning screen: the raw message from main is untranslatable English,
    // so it is carried as diagnostic data only and never rendered as player-facing copy.
    return (
      <div data-testid="inventory-view">
        <Banner tone="warn" title={t.errorAccountReadFailed} data-account-error-detail={accountViewState.message}>
          {t.errorAccountReadFailedDescription}
        </Banner>
      </div>
    );
  }

  return (
    <div data-testid="inventory-view">
      <Panel>
        <PanelHeader title={t.inventoryTitle} />
        <InventoryGrid view={inventory} labels={labels} />
      </Panel>
    </div>
  );
}
