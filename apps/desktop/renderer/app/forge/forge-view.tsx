'use client';

/**
 * The Forge screen: pick a piece, pick a target, see what the climb buys its wearer and what it
 * should cost — then forge it. Reads the account through the shared `useAccountView()` seam and
 * pins the first read it sees, the way the Farm board does — a plan must not move under the
 * player as the live account ticks, so a newer read is adopted only through the toolbar's
 * refresh, and once more the moment a run finishes, so the bag shows the level the server just
 * returned. The run itself lives in main; this screen asks for it, watches it, and draws it.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  canonicalStringify,
  EMPTY_FORGE_HISTORY,
  type AccountSource,
  type AccountView,
  type ForgeEvent,
  type ForgeHistoryResult,
  type ForgeHistoryRow,
  type ForgeStartReason,
} from '@bombfarm/contracts';
import { FORGE_MAX } from '@bombfarm/domain/forge';
import { SLOTS } from '@bombfarm/domain/gear';
import { buildInventoryView, mapInventoryHeroes, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { Banner, ConfirmDialog, EmptyState, motionTokens, Panel, PanelHeader } from '@bombfarm/ui';
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
import {
  forgeRunReducer,
  IDLE_FORGE_RUN,
  shouldAdoptLiveAfter,
  type ForgeRunAdoption,
  type ForgeRunPlan,
  type ForgeRunState,
} from '../../lib/forge/forge-run-reducer';
import { useForgePlan } from '../../lib/forge/use-forge-plan';
import { ForgeItemPanel } from './forge-item-panel';
import { forgeButtonReason, forgeLabels } from './forge-labels';
import { ForgePlanPanel } from './forge-plan-panel';
import { ForgeRail, type ForgeRailIdle, type ForgeRailLastRun } from './forge-rail';
import { ForgeTable } from './forge-table';
import { ForgeToolbar, type ForgeHeroOption } from './forge-toolbar';

type Bridge = NonNullable<Window['bfc']>;

function bridgeOf(): Bridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { bfc?: Bridge }).bfc ?? null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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
  const liveRef = useRef(live);
  liveRef.current = live;

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

  const [run, dispatchRun] = useReducer(forgeRunReducer, IDLE_FORGE_RUN);
  const runRef = useRef<ForgeRunState>(run);
  runRef.current = run;
  const selectionRef = useRef<ForgeRunAdoption | null>(null);
  selectionRef.current = selected === null ? null : { itemId: selected.id, plan: { forecast: plan.forecast, deltaToTarget } };

  const [history, setHistory] = useState<ForgeHistoryResult>(EMPTY_FORGE_HISTORY);
  const [lastFinished, setLastFinished] = useState<ForgeRailLastRun | null>(null);
  const [startRefusal, setStartRefusal] = useState<ForgeStartReason | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const loadHistory = useCallback(() => {
    const bridge = bridgeOf();
    if (!bridge) return;
    void bridge
      .invoke('forge:history')
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const bridge = bridgeOf();
    if (!bridge) return;
    loadHistory();
    return bridge.on('forge:event', (event: ForgeEvent) => {
      if (event.type === 'done') dispatchRun({ kind: 'done', event });
      else dispatchRun({ kind: 'step', event, adopt: selectionRef.current });
    });
  }, [loadHistory]);

  const itemLabelFor = useCallback(
    (itemId: string, fallback: string) => {
      const item = gear.find((candidate) => candidate.id === itemId);
      return item ? labels.itemName(item) : fallback;
    },
    [gear, labels],
  );

  const previousStatus = useRef(run.status);
  useEffect(() => {
    const before = previousStatus.current;
    previousStatus.current = run.status;
    if (!shouldAdoptLiveAfter(before, run.status) || run.status !== 'done') return;
    setPinned(liveRef.current);
    setLastFinished({
      itemLabel: itemLabelFor(run.result.itemId, run.result.itemId),
      fromUpgrade: run.result.from,
      toUpgrade: run.result.to,
      rolls: run.result.rolls,
      fails: run.result.fails,
      spent: run.result.spent,
      at: new Date().toISOString(),
    });
    loadHistory();
  }, [run, itemLabelFor, loadHistory]);

  useEffect(() => {
    if (run.status !== 'dismissed') return;
    const timer = setTimeout(
      () => {
        dispatchRun({ kind: 'settle' });
      },
      prefersReducedMotion() ? 0 : motionTokens.panelMs,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [run.status]);

  useEffect(() => {
    setStartRefusal(null);
  }, [selectedId]);

  const onForge = useCallback(() => {
    const bridge = bridgeOf();
    if (!bridge || selected === null) return;
    const request = { itemId: selected.id, target: plan.plan.target, maxGold: plan.plan.maxGold, maxAttempts: plan.plan.attempts };
    const planNow: ForgeRunPlan = { forecast: plan.forecast, deltaToTarget };
    void bridge.invoke('forge:start', request).then((result) => {
      if (result.ok) {
        setStartRefusal(null);
        dispatchRun({ kind: 'start', runId: result.runId, itemId: selected.id, target: request.target, from: selected.upgrade, plan: planNow });
      } else {
        setStartRefusal(result.reason);
      }
    });
  }, [selected, plan.plan, plan.forecast, deltaToTarget]);

  const onCancel = useCallback(() => {
    const bridge = bridgeOf();
    const current = runRef.current;
    if (!bridge || current.status !== 'running') return;
    void bridge.invoke('forge:cancel', current.run.runId);
  }, []);

  const onDone = useCallback(() => {
    dispatchRun({ kind: 'dismiss' });
  }, []);

  const onClearHistory = useCallback(() => {
    const bridge = bridgeOf();
    if (!bridge) return;
    void bridge
      .invoke('forge:clearHistory')
      .then((result) => {
        setHistory(result);
        setLastFinished(null);
      })
      .catch(() => undefined);
  }, []);

  const running = run.status === 'running';
  const reason = forgeButtonReason({ upgrade: selected?.upgrade ?? 0, accountSource, forgeWritesEnabled, running });

  const idle = useMemo<ForgeRailIdle>(() => {
    const latest: ForgeHistoryRow | undefined = history.rows[0];
    const fromHistory: ForgeRailLastRun | null = latest
      ? {
          itemLabel: itemLabelFor(latest.itemId, latest.defId),
          fromUpgrade: latest.fromUpgrade,
          toUpgrade: latest.toUpgrade,
          rolls: latest.rolls,
          fails: latest.fails,
          spent: latest.spent,
          at: latest.finishedAt,
        }
      : null;
    const lastRun = lastFinished !== null && (fromHistory === null || lastFinished.at >= fromHistory.at) ? lastFinished : fromHistory;
    const totals = history.totals.runs > 0 ? { runs: history.totals.runs, spent: history.totals.spent } : null;
    return { lastRun, totals };
  }, [history, lastFinished, itemLabelFor]);

  const runItem = run.status === 'running' || run.status === 'done' ? run.run.itemId : null;
  const runWearerName = runItem !== null && selected?.id === runItem ? wearerName : null;
  const realisedDelta = useMemo(() => {
    if (run.status !== 'done' || evaluator === null || selected === null || selected.id !== run.result.itemId) return null;
    if (selected.equippedBy === null) return null;
    return evaluator.deltaAt(
      selected.equippedBy,
      { slot: selected.slot, defId: selected.defId, upgrade: run.result.from },
      run.result.to,
    );
  }, [run, evaluator, selected]);

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

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={t.forgeRailClearTitle}
        description={t.forgeRailClearDescription}
        confirmLabel={t.forgeRailClearConfirm}
        cancelLabel={t.forgeRailClearCancel}
        onConfirm={onClearHistory}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_372px] gap-3">
        <div className="flex min-h-0 flex-col gap-3">
          <ForgeRail
            idle={idle}
            run={run}
            gold={labels.gold}
            labels={labels}
            wearerName={runWearerName}
            realisedDelta={realisedDelta}
            onCancel={onCancel}
            onDone={onDone}
            onClearHistory={() => {
              setClearOpen(true);
            }}
          />
          <Panel className="flex min-h-0 flex-1 flex-col">
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
        </div>
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
              startRefusal={startRefusal}
              labels={labels}
              onStepTarget={plan.stepTarget}
              onMaxGoldChange={plan.setMaxGold}
              onAttemptsChange={plan.setAttempts}
              onForge={onForge}
              onCancel={onCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
