'use client';

/**
 * The Forge screen: pick a piece, pick a target, see what the climb should cost — then forge it.
 * Reads the account through the shared `useAccountView()` seam and pins the first read it sees,
 * the way the Farm board does — a plan must not move under the player as the live account ticks,
 * so a newer read is adopted only through the toolbar's refresh, and once more the moment a run
 * finishes, so the bag shows the level the server just returned. The run itself lives in main;
 * this screen asks for it, watches it, and draws it.
 *
 * The filter, the order, the piece in hand and the plan live in the screen's store rather than in
 * this component: the shell unmounts a tab the player leaves, and none of that should be lost by
 * looking at another screen.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  canonicalStringify,
  EMPTY_FORGE_HISTORY,
  type AccountSource,
  type AccountView,
  type ForgeEvent,
  type ForgeHistoryResult,
  type ForgeStartReason,
} from '@bombfarm/contracts';
import { SLOTS } from '@bombfarm/domain/gear';
import {
  buildInventoryView,
  groupInventoryByKind,
  mapInventoryHeroes,
  type InventoryView,
  type InventoryViewItem,
} from '@bombfarm/domain/inventory-view';
import { InventoryTable } from '@bombfarm/game-art';
import { Banner, ConfirmDialog, EmptyState, motionTokens, Panel, PanelHeader } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { oldestCaptureOf } from '../../lib/account/account-facts';
import { useAccountView } from '../../lib/account/use-account-view';
import {
  EMPTY_FORGE_FILTER,
  filterForgeItems,
  forgeHeroIds,
  forgeRarities,
  forgeSlots,
  gearOf,
  isEmptyForgeFilter,
} from '../../lib/forge/forge-rows';
import {
  forgeRunReducer,
  IDLE_FORGE_RUN,
  shouldAdoptLiveAfter,
  type ForgeRunAdoption,
  type ForgeRunPlan,
  type ForgeRunState,
} from '../../lib/forge/forge-run-reducer';
import {
  resolveForgeScreen,
  selectForgePiece,
  setForgeFilter,
  setForgePlan,
  setForgeSort,
  useForgeScreen,
} from '../../lib/forge/forge-store';
import { useForgePlan } from '../../lib/forge/use-forge-plan';
import { ForgeItemPanel } from './forge-item-panel';
import { forgeButtonReason, forgeLabels } from './forge-labels';
import { ForgeLedger } from './forge-ledger';
import { ForgePlanPanel } from './forge-plan-panel';
import { ForgeRail } from './forge-rail';
import { FORGE_TABLE_COLUMNS, forgeTableLabels } from './forge-table-labels';
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
  const tableLabels = useMemo(() => forgeTableLabels(t, lang, heroes), [t, lang, heroes]);

  const screen = useForgeScreen();
  const { filter, sort } = screen;
  const { selected, plan } = useMemo(() => resolveForgeScreen(screen, gear), [screen, gear]);

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

  // Filtered here, ordered and windowed by the table — which mounts only the rows on screen, so
  // the whole bag can be handed over rather than capped at a row count nobody chose.
  const shown = useMemo(() => filterForgeItems(gear, filter, labels.searchText), [gear, filter, labels]);
  const tableView = useMemo<InventoryView>(
    () => ({ items: shown, groups: groupInventoryByKind(shown), skipped: 0 }),
    [shown],
  );
  const filterActive = !isEmptyForgeFilter(filter);

  const onSelect = useCallback((item: InventoryViewItem) => {
    selectForgePiece(item.id);
  }, []);
  const clearFilter = useCallback(() => {
    setForgeFilter(EMPTY_FORGE_FILTER);
  }, []);

  const planControls = useForgePlan(selected, plan, setForgePlan);
  const wearerId = selected?.equippedBy ?? null;
  const wearerName = wearerId === null ? null : (heroes.get(wearerId)?.name ?? t.inventoryEquippedByUnknown);

  const [run, dispatchRun] = useReducer(forgeRunReducer, IDLE_FORGE_RUN);
  const runRef = useRef<ForgeRunState>(run);
  runRef.current = run;
  const selectionRef = useRef<ForgeRunAdoption | null>(null);
  selectionRef.current = selected === null ? null : { itemId: selected.id, plan: { forecast: planControls.forecast } };

  const [history, setHistory] = useState<ForgeHistoryResult>(EMPTY_FORGE_HISTORY);
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

  const previousStatus = useRef(run.status);
  useEffect(() => {
    const before = previousStatus.current;
    previousStatus.current = run.status;
    if (!shouldAdoptLiveAfter(before, run.status) || run.status !== 'done') return;
    setPinned(liveRef.current);
    loadHistory();
  }, [run, loadHistory]);

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
  }, [screen.selectedId]);

  const onForge = useCallback(() => {
    const bridge = bridgeOf();
    if (!bridge || selected === null) return;
    const request = { itemId: selected.id, target: plan.target, maxGold: plan.maxGold, maxAttempts: plan.attempts };
    const planNow: ForgeRunPlan = { forecast: planControls.forecast };
    void bridge.invoke('forge:start', request).then((result) => {
      if (result.ok) {
        setStartRefusal(null);
        dispatchRun({ kind: 'start', runId: result.runId, itemId: selected.id, target: request.target, from: selected.upgrade, plan: planNow });
      } else {
        setStartRefusal(result.reason);
      }
    });
  }, [selected, plan, planControls.forecast]);

  // Main honours a cancel between rolls, so the roll in flight has to settle first — the flag
  // goes down here, on the press, or the screen would look inert for a second or two and invite
  // a second press.
  const onCancel = useCallback(() => {
    const bridge = bridgeOf();
    const current = runRef.current;
    if (!bridge || current.status !== 'running' || current.run.cancelRequested) return;
    dispatchRun({ kind: 'cancel' });
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
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  const openClear = useCallback(() => {
    setClearOpen(true);
  }, []);

  const running = run.status === 'running';
  const cancelRequested = run.status === 'running' && run.run.cancelRequested;
  const reason = forgeButtonReason({
    upgrade: selected?.upgrade ?? 0,
    accountSource,
    forgeWritesEnabled,
    running,
    cancelRequested,
  });

  const account = view?.payload.account;
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
      <Panel className="shrink-0">
        <PanelHeader title={t.forgeTitle} />
        <ForgeToolbar
          heroes={heroOptions}
          filter={filter}
          onFilterChange={setForgeFilter}
          sort={sort}
          onSortChange={setForgeSort}
          slots={slots}
          rarities={rarities}
          shown={shown.length}
          total={gear.length}
          heroHint={heroHint}
          capturedAt={capturedAt}
          stale={stale}
          onRefresh={refresh}
          labels={labels}
        />
      </Panel>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={t.forgeLedgerClearTitle}
        description={t.forgeLedgerClearDescription}
        confirmLabel={t.forgeLedgerClearConfirm}
        cancelLabel={t.forgeLedgerClearCancel}
        onConfirm={onClearHistory}
      />

      <ForgeRail run={run} gold={labels.gold} labels={labels} onCancel={onCancel} onDone={onDone} />

      {/* `grid-rows-[minmax(0,1fr)]` is what actually bounds this. A grid row is `auto` by
          default, so it sizes to its tallest item and overflows the grid's own box — visibly,
          which is enough to grow the scroll region above it and hand the whole screen a
          scrollbar. Pinning the row to the container's height is what pushes the overflow down
          into the table and the right-hand column, where each has a scroller of its own. */}
      <div
        data-testid="forge-split"
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_372px] grid-rows-[minmax(0,1fr)] gap-3"
      >
        <Panel className="relative flex min-h-0 flex-col">
          <InventoryTable
            view={tableView}
            labels={tableLabels}
            columns={FORGE_TABLE_COLUMNS}
            showToolbar={false}
            sort={sort}
            onSortChange={setForgeSort}
            selectedItemId={screen.selectedId}
            onSelectRow={onSelect}
            onClearFilter={filterActive ? clearFilter : undefined}
            className="min-h-0 flex-1"
          />
        </Panel>
        {/* `relative` is doing the same job it does on the shell's `<main>`, one level down.
            `sr-only` is `position: absolute`, so a table caption in here resolves its containing
            block to the nearest positioned ancestor — with none, that was `<main>`, and the
            caption sat below this column's own bottom edge where no `overflow` on the column
            could clip it. `<main>` then grew 13px to reach it and the whole screen scrolled. */}
        <div className="relative flex min-h-0 flex-col gap-3 overflow-y-auto">
          <ForgeItemPanel item={selected} wearerName={wearerName} target={plan.target} labels={labels} />
          {selected === null ? null : (
            <ForgePlanPanel
              item={selected}
              plan={plan}
              forecast={planControls.forecast}
              walletGold={walletGold}
              reason={reason}
              startRefusal={startRefusal}
              labels={labels}
              onStepTarget={planControls.stepTarget}
              onMaxGoldChange={planControls.setMaxGold}
              onAttemptsChange={planControls.setAttempts}
              onForge={onForge}
              onCancel={onCancel}
            />
          )}
        </div>
      </div>

      <ForgeLedger history={history} labels={labels} onClearHistory={openClear} />
    </div>
  );
}
