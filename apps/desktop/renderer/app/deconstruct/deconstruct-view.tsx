'use client';

/**
 * The Deconstruct page: filter every item the game would burn, tick up to a hundred of them, and
 * burn them for Forge Essence. Reads the account through the shared `useAccountView()` seam and
 * pins the first read it sees, the way the Forge bag does — a row must not move under the pointer
 * as the live account ticks, so a newer read is adopted only through the shell's refresh, and once
 * more the moment a burn settles, so the list shows what is left. The burn itself lives in main;
 * this page asks for it, watches it, and draws what came back.
 *
 * The filter, the order, the ticked batch and the burn's outcome live in the page's two stores
 * rather than in this component: the shell unmounts a tab the player leaves, and none of that
 * should be lost by looking at another screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canonicalStringify, type AccountSource, type AccountView } from '@bombfarm/contracts';
import { DECONSTRUCT_BATCH_MAX, deconstructBatchSummary, deconstructBlockReason } from '@bombfarm/domain/deconstruct';
import { SLOTS } from '@bombfarm/domain/gear';
import { buildInventoryView, mapInventoryHeroes, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { InventoryTable, type InventoryTableProps } from '@bombfarm/game-art';
import { Banner, ConfirmDialog, EmptyState, Panel, PanelHeader } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { oldestCaptureOf } from '../../lib/account/account-facts';
import { useAccountReadRequest } from '../../lib/account/use-account-read-request';
import { useAccountView } from '../../lib/account/use-account-view';
import {
  deconstructAccountKey,
  deconstructAnyInStash,
  deconstructCandidates,
  deconstructKinds,
  deconstructLevelBounds,
  deconstructOrder,
  deconstructRarities,
  deconstructSets,
  deconstructSlots,
  deconstructTableView,
  deconstructTopForge,
  EMPTY_DECONSTRUCT_FILTER,
  essenceSortValue,
  filterDeconstructItems,
  isEmptyDeconstructFilter,
} from '../../lib/deconstruct/deconstruct-rows';
import { isBurning, justSettled } from '../../lib/deconstruct/deconstruct-run-reducer';
import { burnDeconstruct, dismissDeconstructRun, useDeconstructRun } from '../../lib/deconstruct/deconstruct-run-store';
import {
  fillDeconstruct,
  pruneDeconstructSelection,
  selectedDeconstructItems,
  selectShownDeconstruct,
  shownAddable,
  toggleDeconstructSelection,
} from '../../lib/deconstruct/deconstruct-selection';
import {
  adoptDeconstructAccount,
  deconstructSelection,
  setDeconstructEssenceSort,
  setDeconstructFilter,
  setDeconstructSelection,
  setDeconstructSort,
  unselectDeconstruct,
  useDeconstructScreen,
} from '../../lib/deconstruct/deconstruct-store';
import { useForgeQueue } from '../../lib/forge/forge-queue-store';
import { useForgeRun } from '../../lib/forge/forge-run-store';
import { finiteNumber } from '../../lib/format';
import { useMediaQuery } from '../../lib/use-media-query';
import { useScreenRefreshRegistration } from '../../lib/refresh/screen-refresh-store';
import { DeconstructAside } from './deconstruct-aside';
import {
  DECONSTRUCT_NARROW_QUERY,
  DECONSTRUCT_NARROW_TABLE_COLUMNS,
  DECONSTRUCT_TABLE_COLUMNS,
  deconstructBlockText,
  deconstructAddAllBlock,
  deconstructButtonReason,
  deconstructLabels,
  deconstructTableLabels,
  deconstructWarnings,
  essenceCell,
  type DeconstructHint,
} from './deconstruct-labels';
import { DeconstructConfirmBody } from './deconstruct-confirm-body';
import { DeconstructResultBand } from './deconstruct-result-band';
import { DeconstructToolbar } from './deconstruct-toolbar';

/** The floor under the split, in px, for a window too short to give it more. Under the Forge bag's
 *  460: this page's batch column is what really sets the floor, and it fits in less. */
const SPLIT_MIN_HEIGHT = 400;

const NO_SELECTION: ReadonlySet<string> = new Set();

/** What a refresh would change: the sections the screen draws from, compared as values. The
 *  essence balance is left out on purpose — it moves with every burn and would keep the line red. */
function sectionsKey(view: AccountView | null): string | null {
  return view === null ? null : canonicalStringify([view.payload.items ?? null, view.payload.heroes ?? null]);
}

type ExtraColumn = NonNullable<InventoryTableProps['extraColumn']>;

export function DeconstructView({
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

  const adoptLive = useCallback(() => {
    setPinned(liveRef.current);
  }, []);
  const { state: refreshState, request: refresh } = useAccountReadRequest(adoptLive);

  const rawItems = view?.payload.items;
  const rawHeroes = view?.payload.heroes;
  const inventory = useMemo(() => buildInventoryView(rawItems), [rawItems]);
  const heroes = useMemo(() => mapInventoryHeroes(rawHeroes), [rawHeroes]);
  const candidates = useMemo(() => deconstructCandidates(inventory.items), [inventory]);
  const labels = useMemo(() => deconstructLabels(t, lang, locale), [t, lang, locale]);
  const tableLabels = useMemo(() => deconstructTableLabels(t, lang, heroes), [t, lang, heroes]);

  const narrow = useMediaQuery(DECONSTRUCT_NARROW_QUERY);
  const screen = useDeconstructScreen();
  const { filter, sort, essenceSort, selectedIds } = screen;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Ticks the bag no longer holds, or can no longer burn, leave the batch with every read the page
  // adopts. Held back until a read carrying items has arrived, or the first paint would empty it.
  useEffect(() => {
    if (rawItems === undefined) return;
    setDeconstructSelection(pruneDeconstructSelection(deconstructSelection(), candidates));
  }, [rawItems, candidates]);

  const kinds = useMemo(() => deconstructKinds(candidates), [candidates]);
  const rarities = useMemo(() => deconstructRarities(candidates), [candidates]);
  const sets = useMemo(() => deconstructSets(candidates), [candidates]);
  const slots = useMemo(() => deconstructSlots(candidates, SLOTS), [candidates]);
  const levelBounds = useMemo(() => deconstructLevelBounds(candidates), [candidates]);
  const topForge = useMemo(() => deconstructTopForge(candidates), [candidates]);
  const anyInStash = useMemo(() => deconstructAnyInStash(candidates), [candidates]);

  // The ticks reach the filter only when "selected only" asks for them. Handing them over always
  // would rebuild the list on every tick, and a tick changes nothing the filter would otherwise
  // read: a ticked row is never an unburnable one.
  const keep = filter.selectedOnly ? selectedSet : NO_SELECTION;
  const shown = useMemo(
    () => filterDeconstructItems(candidates, filter, labels.searchText, keep),
    [candidates, filter, labels, keep],
  );
  const tableView = useMemo(() => deconstructTableView(shown), [shown]);
  const filterActive = !isEmptyDeconstructFilter(filter);

  const selectedItems = useMemo(() => selectedDeconstructItems(selectedIds, candidates), [selectedIds, candidates]);
  const summary = useMemo(() => deconstructBatchSummary(selectedItems), [selectedItems]);
  const addable = useMemo(() => shownAddable(shown, selectedIds), [shown, selectedIds]);
  const hiddenSelected = useMemo(() => {
    const shownIds = new Set(shown.map((item) => item.id));
    return selectedItems.filter((item) => !shownIds.has(item.id)).length;
  }, [selectedItems, shown]);
  const warnings = deconstructWarnings(summary, t, labels);

  const [hint, setHint] = useState<DeconstructHint | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const liveAccountKey = deconstructAccountKey(live?.payload.account);
  useEffect(() => {
    if (!adoptDeconstructAccount(liveAccountKey)) return;
    setPinned(liveRef.current);
    setHint(null);
    dismissDeconstructRun();
  }, [liveAccountKey]);

  const onToggleRow = useCallback((item: InventoryViewItem) => {
    const change = toggleDeconstructSelection(deconstructSelection(), item.id, DECONSTRUCT_BATCH_MAX);
    setHint(change.refused ? { kind: 'cap' } : null);
    if (!change.refused) setDeconstructSelection(change.ids);
  }, []);

  const rowDisabledReason = useCallback(
    (item: InventoryViewItem) => {
      const reason = deconstructBlockReason(item);
      return reason === null ? null : deconstructBlockText(reason, t);
    },
    [t],
  );

  const essenceColumn = useMemo<ExtraColumn>(
    () => ({
      id: 'essence',
      header: t.deconstructColumnEssence,
      align: 'end',
      width: '6.5rem',
      numeric: true,
      after: 'hero',
      render: (item) => essenceCell(item, labels),
      sortValue: essenceSortValue,
    }),
    [t, labels],
  );

  const onSelectShown = useCallback(() => {
    const ordered = deconstructOrder(shown, sort, labels.itemName, essenceSort);
    const change = selectShownDeconstruct(ordered, deconstructSelection(), DECONSTRUCT_BATCH_MAX);
    setDeconstructSelection(change.ids);
    if (change.overflow > 0) setHint({ kind: 'overflow', count: change.overflow });
    else setHint(null);
  }, [shown, sort, essenceSort, labels]);

  const onFill = useCallback(() => {
    const ids = deconstructSelection();
    if (ids.length >= DECONSTRUCT_BATCH_MAX) {
      setHint({ kind: 'cap' });
      return;
    }
    const change = fillDeconstruct(shown, ids, DECONSTRUCT_BATCH_MAX);
    setDeconstructSelection(change.ids);
    setHint(change.added === 0 ? { kind: 'fill-none' } : null);
  }, [shown]);

  const onRemove = useCallback((itemId: string) => {
    unselectDeconstruct([itemId]);
    setHint(null);
  }, []);

  const onClear = useCallback(() => {
    setDeconstructSelection([]);
    setHint(null);
  }, []);

  const clearFilter = useCallback(() => {
    setDeconstructFilter(EMPTY_DECONSTRUCT_FILTER);
  }, []);

  const run = useDeconstructRun();
  const forgeRun = useForgeRun();
  const queue = useForgeQueue();
  const burning = isBurning(run);
  const forgeBusy = forgeRun.status === 'running' || queue.status === 'running' || queue.active !== null;
  const reason = deconstructButtonReason({
    accountSource,
    forgeWritesEnabled,
    burning,
    forgeBusy,
    selected: selectedItems.length,
  });

  const previousStatus = useRef(run.status);
  useEffect(() => {
    const before = previousStatus.current;
    previousStatus.current = run.status;
    if (justSettled(before, run.status)) setPinned(liveRef.current);
  }, [run.status]);

  const burnIds = useMemo(() => selectedItems.map((item) => item.id), [selectedItems]);
  const onBurn = useCallback(() => {
    const latest = liveRef.current;
    const latestItems = latest?.payload.items;
    if (latest !== null && latestItems !== undefined) setPinned(latest);
    const current = latestItems === undefined ? candidates : deconstructCandidates(buildInventoryView(latestItems).items);
    const before = deconstructSelection();
    const kept = pruneDeconstructSelection(before, current);
    setDeconstructSelection(kept);
    const dropped = before.length - kept.length;
    setHint(dropped > 0 ? { kind: 'pruned', count: dropped } : null);
    if (kept.length > 0) setConfirmOpen(true);
  }, [candidates]);
  const onConfirm = useCallback(() => {
    burnDeconstruct(burnIds);
  }, [burnIds]);

  const balance = finiteNumber(view?.payload.account?.essence);
  const capturedAt = view === null ? null : oldestCaptureOf(view.payload);
  useScreenRefreshRegistration('forge', { capturedAt, stale, busy: false, readState: refreshState, onRefresh: refresh });

  if (accountViewState.status === 'bridge-unavailable') {
    return (
      <div data-testid="deconstruct-view">
        <EmptyState title={t.emptyBridgeUnavailableTitle} />
      </div>
    );
  }

  if (accountViewState.status === 'error') {
    return (
      <div data-testid="deconstruct-view">
        <Banner tone="warn" title={t.errorAccountReadFailed} data-account-error-detail={accountViewState.message}>
          {t.errorAccountReadFailedDescription}
        </Banner>
      </div>
    );
  }

  if (view === null) {
    return (
      <div data-testid="deconstruct-view">
        <EmptyState title={t.accountLoadingTitle} />
      </div>
    );
  }

  return (
    <div data-testid="deconstruct-view" className="flex flex-1 flex-col gap-3">
      <Panel className="shrink-0">
        <PanelHeader title={t.deconstructTitle} />
        <DeconstructToolbar
          filter={filter}
          onFilterChange={setDeconstructFilter}
          kinds={kinds}
          rarities={rarities}
          sets={sets}
          slots={slots}
          levelBounds={levelBounds}
          topForge={topForge}
          anyInStash={anyInStash}
          shown={shown.length}
          total={candidates.length}
          addAll={{ count: addable.addable, block: deconstructAddAllBlock(addable), busy: burning, onPress: onSelectShown }}
          labels={labels}
        />
      </Panel>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t.deconstructConfirmTitle}
        size="wide"
        confirmLabel={sub(t.deconstructConfirmAction, { count: labels.count(summary.count) })}
        cancelLabel={t.deconstructConfirmCancel}
        closeLabel={t.confirmDialogClose}
        onConfirm={onConfirm}
      >
        <DeconstructConfirmBody
          items={selectedItems}
          summary={summary}
          hidden={hiddenSelected}
          balance={balance}
          warnings={warnings}
          labels={labels}
        />
      </ConfirmDialog>

      {/* The row takes whatever height the bands around it leave, floored by `SPLIT_MIN_HEIGHT`.
          The list Panel is taken out of flow so the whole list cannot contribute its height to
          the row, which is then measured by the batch column beside it; being absolute also gives
          the Panel a definite height to bound the table's own scroller against.

          The batch column takes the width the table can spare: the table needs 738px to print the
          longest forged name the game can show without clipping, and with the 12px gap that is the
          750 the column subtracts, between 372px and 540px (seven to eleven tile columns). */}
      <div
        data-testid="deconstruct-split"
        className="grid shrink-0 grow grid-cols-[minmax(0,1fr)_clamp(372px,calc(100%_-_750px),540px)] gap-3 max-compact:grid-cols-[minmax(0,1fr)_316px]"
        style={{ gridTemplateRows: `minmax(${String(SPLIT_MIN_HEIGHT)}px, auto)` }}
      >
        <div className="relative">
          <Panel data-testid="deconstruct-list-panel" className="absolute inset-0 flex min-h-0 flex-col">
            <InventoryTable
              view={tableView}
              labels={tableLabels}
              columns={narrow ? DECONSTRUCT_NARROW_TABLE_COLUMNS : DECONSTRUCT_TABLE_COLUMNS}
              showToolbar={false}
              sort={sort}
              onSortChange={setDeconstructSort}
              extraSort={essenceSort}
              onExtraSortChange={setDeconstructEssenceSort}
              onToggleRow={onToggleRow}
              selectedItemIds={selectedSet}
              rowDisabledReason={rowDisabledReason}
              extraColumn={essenceColumn}
              onClearFilter={filterActive && candidates.length > 0 ? clearFilter : undefined}
              className="min-h-0 flex-1"
            />
          </Panel>
        </div>
        {/* `relative` keeps `sr-only` table captions in here resolving against this column rather
            than against the shell's `<main>`. */}
        <div data-testid="deconstruct-aside" className="@container relative flex flex-col">
          <DeconstructAside
            items={selectedItems}
            summary={summary}
            hidden={hiddenSelected}
            balance={balance}
            reason={reason}
            hint={hint}
            burning={burning}
            labels={labels}
            onFill={onFill}
            onClear={onClear}
            onBurn={onBurn}
            onRemove={onRemove}
            result={
              <DeconstructResultBand
                outcome={run.status === 'result' ? run.outcome : null}
                labels={labels}
                onDone={dismissDeconstructRun}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
