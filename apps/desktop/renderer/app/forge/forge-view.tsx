'use client';

/**
 * The Forge screen as a planner: pick a piece, pick a target, see what the climb buys its wearer
 * and what it should cost. Reads the account through the shared `useAccountView()` seam and pins
 * the first read it sees, the way the Farm board does — a plan must not move under the player as
 * the live account ticks, so a newer read is adopted only through the toolbar's refresh, and the
 * age line under it dates the read the screen is drawn from. Nothing here writes.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { canonicalStringify, type AccountSource, type AccountView } from '@bombfarm/contracts';
import { FORGE_MAX } from '@bombfarm/domain/forge';
import { SLOTS } from '@bombfarm/domain/gear';
import { buildInventoryView, mapInventoryHeroes, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { Banner, EmptyState, Panel, PanelHeader } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { oldestCaptureOf } from '../../lib/account/account-facts';
import { useAccountView } from '../../lib/account/use-account-view';
import { createForgeDpsEvaluator } from '../../lib/forge/forge-dps';
import {
  DEFAULT_FORGE_SORT,
  EMPTY_FORGE_FILTER,
  capForgeRows,
  filterForgeItems,
  forgeHeroIds,
  forgeRarities,
  forgeSlots,
  gearOf,
  isEmptyForgeFilter,
  sortForgeRows,
  type ForgeFilter,
  type ForgeRow,
  type ForgeSort,
} from '../../lib/forge/forge-rows';
import { useForgePlan } from '../../lib/forge/use-forge-plan';
import { ForgeItemPanel } from './forge-item-panel';
import { forgeButtonReason, forgeLabels } from './forge-labels';
import { ForgePlanPanel } from './forge-plan-panel';
import { ForgeRail } from './forge-rail';
import { ForgeTable } from './forge-table';
import { ForgeToolbar, type ForgeHeroOption } from './forge-toolbar';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Hero ids the save marks as deployed on the field. */
function fieldHeroIds(rawHeroes: readonly unknown[] | undefined): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(rawHeroes)) return ids;
  for (const raw of rawHeroes) {
    if (isObject(raw) && raw.in_field === true && typeof raw.id === 'string') ids.add(raw.id);
  }
  return ids;
}

/** The bag's capacity is per tab; the count the account reports is across all of them. */
function bagOf(account: Record<string, unknown> | undefined): { free: number; capacity: number } | null {
  if (!account) return null;
  const perTab = finiteNumber(account.bag_capacity);
  const tabs = finiteNumber(account.bag_tabs);
  const count = finiteNumber(account.items_count);
  if (perTab === null || tabs === null || count === null) return null;
  const capacity = perTab * tabs;
  return { free: Math.max(0, capacity - count), capacity };
}

/** What a refresh would change: the sections the screen draws from, compared as values. The
 *  gold balance is left out on purpose — it moves every few seconds and would keep the line red. */
function sectionsKey(view: AccountView | null): string | null {
  return view === null ? null : canonicalStringify([view.payload.items ?? null, view.payload.heroes ?? null]);
}

const NO_RUNS = { lastRun: null, totals: null };

export function ForgeView({
  forgeWritesEnabled,
  accountSource,
}: {
  forgeWritesEnabled: boolean;
  accountSource: AccountSource | null;
}) {
  const t = useCopy();
  const { lang, locale } = useLocale();
  const accountViewState = useAccountView();

  const live = accountViewState.status === 'loaded' ? accountViewState.view : null;
  const [pinned, setPinned] = useState<AccountView | null>(null);
  useEffect(() => {
    if (pinned === null && live !== null) setPinned(live);
  }, [pinned, live]);
  const view = pinned ?? live;

  const liveKey = useMemo(() => sectionsKey(live), [live]);
  const pinnedKey = useMemo(() => sectionsKey(view), [view]);
  const stale = liveKey !== null && pinnedKey !== null && liveKey !== pinnedKey;
  const refresh = useCallback(() => {
    if (live !== null) setPinned(live);
  }, [live]);

  const items = view?.payload.items;
  const rawHeroes = view?.payload.heroes;
  const inventory = useMemo(() => buildInventoryView(items), [items]);
  const heroes = useMemo(() => mapInventoryHeroes(rawHeroes), [rawHeroes]);
  const inField = useMemo(() => fieldHeroIds(rawHeroes), [rawHeroes]);
  const gear = useMemo(() => gearOf(inventory.items), [inventory]);
  const labels = useMemo(() => forgeLabels(t, lang, locale), [t, lang, locale]);
  const evaluator = useMemo(() => createForgeDpsEvaluator(view), [view]);

  const allRows = useMemo<ForgeRow[]>(
    () =>
      gear.map((item) => ({
        item,
        buys:
          evaluator !== null && item.equippedBy !== null && item.upgrade < FORGE_MAX
            ? evaluator.deltaAt(item.equippedBy, item, item.upgrade + 1)
            : null,
      })),
    [gear, evaluator],
  );

  const [filter, setFilter] = useState<ForgeFilter>(EMPTY_FORGE_FILTER);
  const [sort, setSort] = useState<ForgeSort>(DEFAULT_FORGE_SORT);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const heroName = useCallback((heroId: string) => heroes.get(heroId)?.name ?? heroId, [heroes]);
  const heroOptions = useMemo<ForgeHeroOption[]>(
    () =>
      forgeHeroIds(gear, (heroId) => inField.has(heroId), heroName).map((id) => {
        const hero = heroes.get(id);
        return {
          id,
          name: hero?.name ?? id,
          rank: hero?.rank ?? '',
          rarityIdx: hero?.rarityIdx ?? -1,
          skin: hero?.skin ?? 0,
          level: hero ? sub(t.inventoryDetailLevel, { level: hero.level }) : '',
          inField: inField.has(id),
        };
      }),
    [gear, heroes, inField, heroName, t],
  );
  const slots = useMemo(() => forgeSlots(gear, SLOTS), [gear]);
  const rarities = useMemo(() => forgeRarities(gear), [gear]);

  const shown = useMemo(() => {
    const kept = new Set(filterForgeItems(gear, filter, labels.searchText).map((item) => item.id));
    const sorted = sortForgeRows(
      allRows.filter((row) => kept.has(row.item.id)),
      sort,
      labels.itemName,
      (item) => labels.slotName(item.slot),
    );
    return capForgeRows(sorted);
  }, [gear, allRows, filter, sort, labels]);

  const selected = useMemo(
    () => (selectedId === null ? null : (gear.find((item) => item.id === selectedId) ?? null)),
    [gear, selectedId],
  );
  const onSelect = useCallback((item: InventoryViewItem) => {
    setSelectedId(item.id);
  }, []);
  const clearFilter = useCallback(() => {
    setFilter(EMPTY_FORGE_FILTER);
  }, []);

  const plan = useForgePlan(selected);
  const wearerId = selected?.equippedBy ?? null;
  const wearerName = wearerId === null ? null : (heroes.get(wearerId)?.name ?? t.inventoryEquippedByUnknown);
  const deltaToTarget =
    selected !== null && wearerId !== null && evaluator !== null && selected.upgrade < FORGE_MAX
      ? evaluator.deltaAt(wearerId, selected, plan.plan.target)
      : null;
  const reason = forgeButtonReason({ upgrade: selected?.upgrade ?? 0, accountSource, forgeWritesEnabled });

  const account = view?.payload.account;
  const bag = useMemo(() => bagOf(account), [account]);
  const walletGold = finiteNumber(account?.gold);
  const capturedAt = view === null ? null : oldestCaptureOf(view.payload);
  const heroHint = filter.heroId === null ? null : sub(t.forgeHeroHint, { hero: heroName(filter.heroId) });

  if (accountViewState.status === 'bridge-unavailable') {
    return (
      <div data-testid="forge-view">
        <EmptyState title={t.emptyBridgeUnavailableTitle} />
      </div>
    );
  }

  if (accountViewState.status === 'error') {
    return (
      <div data-testid="forge-view">
        <Banner tone="warn" title={t.errorAccountReadFailed} data-account-error-detail={accountViewState.message}>
          {t.errorAccountReadFailedDescription}
        </Banner>
      </div>
    );
  }

  if (view === null) {
    return (
      <div data-testid="forge-view">
        <EmptyState title={t.accountLoadingTitle} />
      </div>
    );
  }

  return (
    <div data-testid="forge-view" className="flex min-h-0 flex-1 flex-col gap-3">
      <Panel>
        <PanelHeader title={t.forgeTitle} />
        <ForgeToolbar
          heroes={heroOptions}
          filter={filter}
          onFilterChange={setFilter}
          slots={slots}
          rarities={rarities}
          shown={shown.rows.length + shown.hidden}
          total={gear.length}
          heroHint={heroHint}
          bag={bag}
          capturedAt={capturedAt}
          stale={stale}
          onRefresh={refresh}
          labels={labels}
        />
      </Panel>

      <ForgeRail idle={NO_RUNS} gold={labels.gold} />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_372px] gap-3">
        <Panel className="flex min-h-0 flex-col">
          <ForgeTable
            rows={shown.rows}
            hidden={shown.hidden}
            sort={sort}
            onSortChange={setSort}
            selectedId={selectedId}
            onSelect={onSelect}
            labels={labels}
            filtered={!isEmptyForgeFilter(filter)}
            onClearFilter={clearFilter}
            className="min-h-0 flex-1"
          />
        </Panel>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <ForgeItemPanel item={selected} wearerName={wearerName} target={plan.plan.target} labels={labels} />
          {selected === null ? null : (
            <ForgePlanPanel
              item={selected}
              plan={plan.plan}
              forecast={plan.forecast}
              wearerName={wearerName}
              deltaToTarget={deltaToTarget}
              walletGold={walletGold}
              reason={reason}
              labels={labels}
              onStepTarget={plan.stepTarget}
              onMaxGoldChange={plan.setMaxGold}
              onAttemptsChange={plan.setAttempts}
            />
          )}
        </div>
      </div>
    </div>
  );
}
