'use client';

/**
 * The Farm screen — the ranking board over every phase, and the explorer for the one phase the
 * player has selected. Both views are `@bombfarm/farm`'s; this file is their connector, the way
 * `apps/web`'s two connectors are theirs.
 *
 * Nothing here recomputes on a live tick. The board is computed from the account as it stood when
 * the screen opened, and the only things that move it are the two compute inputs and an explicit
 * Refresh — see `lib/farm/farm-snapshot-store.ts`. A snapshot the live account has moved past is
 * LABELLED and left alone; an unlabelled stale number is the failure this screen exists to avoid.
 * That label is a state of the always-present refresh control beside the board's heading, so the
 * age of the numbers is readable before they go out of date rather than only after.
 *
 * Every compute is scheduled off the paint, so the frame BEFORE it — the loading state on a first
 * open, the board already in hand on a recompute — is committed and visible rather than skipped
 * over by a main thread that then blocks. A recompute never blanks the screen: the board stays
 * mounted and is marked busy, which is also what keeps the filters and column sort it holds.
 *
 * The hand memoisation below is load-bearing: the desktop renderer does not enable the React
 * Compiler, and a freshly-allocated prop bag on every render reaches a 600-row table.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner, EmptyState, colClass } from '@bombfarm/ui';
import { scheduleAfterPaint } from '@bombfarm/farm';
import {
  FarmRankingBoardView,
  PhasesExplorerView,
  type FarmRankingBoardActions,
  type FarmRankingBoardData,
  type FarmRankingBoardSlots,
  type FarmStatLabels,
} from '@bombfarm/farm/components';
import { HeroPickerDialogView, type HeroPickerSlotProps } from '@bombfarm/hero/components';
import {
  buildAccount,
  deriveFarmPoolEntries,
  type FarmInputs,
  type FarmRankingResult,
} from '@bombfarm/farm/core';
import { statLabel } from '@bombfarm/domain/game-labels';
import { SHEET_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { ReturnBonusMode, SquadFarmFacts } from '@bombfarm/domain/farm-rate';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import { DEFAULT_FARM_CONTROLS, type FarmControls } from '../../lib/farm/farm-inputs';
import { loadFarmView, saveFarmView } from '../../lib/farm/farm-view-storage';
import { settledBoard, type FarmSettledBoard } from '../../lib/farm/farm-snapshot-store';
import { freshProposal, reRankActive, type FarmRespecState } from '../../lib/farm/farm-respec-store';
import { useFarmSnapshot } from '../../lib/farm/use-farm-snapshot';
import { useFarmTableHeight } from '../../lib/farm/use-farm-table-height';
import { farmScreenCopy, useFarmCopy } from './farm-copy';
import { FarmRefreshControl } from './farm-refresh-control';

const DEFAULT_PHASE = 1;

export function FarmView() {
  const t = useCopy();
  const account = useAccountView();
  const {
    state,
    respec,
    stale,
    hasAccount,
    open,
    refresh,
    setControls,
    setRespecPanelOpen,
    setRespecReRank,
    runRespec,
    proposedRows,
  } = useFarmSnapshot();

  const [controls, setLocalControls] = useState<FarmControls>(DEFAULT_FARM_CONTROLS);
  const [phase, setPhase] = useState(DEFAULT_PHASE);
  const [phaseChosen, setPhaseChosen] = useState(false);
  const [activeHeroId, setActiveHeroId] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const stored = loadFarmView();
    setLocalControls({
      farmPoolOverrides: stored.farmPoolOverrides,
      farmReturnBonus: stored.farmReturnBonus,
    });
    if (stored.selectedPhase !== null) {
      setPhase(stored.selectedPhase);
      setPhaseChosen(true);
    }
    setStorageReady(true);
  }, []);

  // A phase the board picked for the player is deliberately not written back: it is re-derived
  // from the best map on every load, and persisting it would freeze today's best as tomorrow's.
  useEffect(() => {
    if (!storageReady) return;
    saveFarmView({ ...controls, selectedPhase: phaseChosen ? phase : null });
  }, [storageReady, controls, phase, phaseChosen]);

  // `open` is re-created whenever the LIVE account moves, which is every few seconds. Read
  // through a ref so the effect below is not woken by a tick it must not act on.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const openedRef = useRef(false);
  useEffect(() => {
    if (!storageReady || !hasAccount) return;
    if (openedRef.current) {
      scheduleAfterPaint(() => {
        setControls(controls);
      });
      return;
    }
    openedRef.current = true;
    scheduleAfterPaint(() => {
      openRef.current(controls);
    });
  }, [storageReady, hasAccount, controls, setControls]);

  const onRefresh = useCallback(() => {
    scheduleAfterPaint(() => {
      refresh(controls);
    });
  }, [refresh, controls]);

  const setFarmHeroEnabled = useCallback((heroId: string, enabled: boolean) => {
    setLocalControls((previous) =>
      previous.farmPoolOverrides[heroId] === enabled
        ? previous
        : {
            ...previous,
            farmPoolOverrides: { ...previous.farmPoolOverrides, [heroId]: enabled },
          },
    );
  }, []);

  const setFarmReturnBonus = useCallback((mode: ReturnBonusMode) => {
    setLocalControls((previous) =>
      previous.farmReturnBonus === mode ? previous : { ...previous, farmReturnBonus: mode },
    );
  }, []);

  const setPhasesViewPhase = useCallback((next: number) => {
    setPhase(next);
    setPhaseChosen(true);
  }, []);

  const syncDefaultPhaseSelection = useCallback((next: number) => {
    setPhase(next);
  }, []);

  const onSelectHero = useCallback((hero: HeroRecord) => {
    setActiveHeroId(hero.id);
  }, []);

  // One stable bag, so the two prop bags built from it below survive a re-render of this screen.
  const screenActions = useMemo<FarmScreenActions>(
    () => ({
      setPhasesViewPhase,
      syncDefaultPhaseSelection,
      setFarmHeroEnabled,
      setFarmReturnBonus,
      onSelectHero,
      setRespecPanelOpen,
      setRespecReRank,
      runRespec,
      proposedRows,
    }),
    [
      setPhasesViewPhase,
      syncDefaultPhaseSelection,
      setFarmHeroEnabled,
      setFarmReturnBonus,
      onSelectHero,
      setRespecPanelOpen,
      setRespecReRank,
      runRespec,
      proposedRows,
    ],
  );

  const tableScrollportHeightPx = useFarmTableHeight();
  const settled = useMemo(() => settledBoard(state), [state]);
  const busy = state.status === 'computing';
  const refreshBag = useMemo<FarmScreenRefresh>(
    () => ({ stale, busy, onRefresh }),
    [stale, busy, onRefresh],
  );

  if (account.status === 'bridge-unavailable') {
    return (
      <div data-testid="farm-view">
        <EmptyState title={t.emptyBridgeUnavailableTitle} />
      </div>
    );
  }

  if (account.status === 'loading') {
    return (
      <div data-testid="farm-view">
        <EmptyState title={t.shellLoadingLabel} />
      </div>
    );
  }

  // The raw message from main is untranslatable English, so it is carried as diagnostic data
  // only and never rendered as player-facing copy — same treatment the Inventory screen gives it.
  if (account.status === 'error') {
    return (
      <div data-testid="farm-view">
        <Banner tone="warn" title={t.errorAccountReadFailed} data-account-error-detail={account.message}>
          {t.errorAccountReadFailedDescription}
        </Banner>
      </div>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <div data-testid="farm-view">
        <EmptyState title={t.farmUnavailableTitle} description={t.farmUnavailableDescription} />
      </div>
    );
  }

  // Only the FIRST compute has nothing to show. Every later one keeps the board it already has
  // on screen and marks it busy below: unmounting the board would take the filters and the
  // column sort down with it, and toggling one hero in the rotation pool would silently reset
  // both.
  if (settled === null) {
    return (
      <div data-testid="farm-view">
        <EmptyState title={t.shellLoadingLabel} />
      </div>
    );
  }

  return (
    <div
      data-testid="farm-view"
      className={colClass}
      aria-busy={busy}
    >
      <FarmScreen
        snapshot={settled}
        view={{ phase, phaseChosen, activeHeroId, tableScrollportHeightPx }}
        respec={respec}
        refresh={refreshBag}
        actions={screenActions}
      />
    </div>
  );
}

/** What the board's refresh control reads and writes — the screen's only recompute path. */
type FarmScreenRefresh = {
  stale: boolean;
  busy: boolean;
  onRefresh: () => void;
};

type FarmScreenActions = {
  setPhasesViewPhase: (phase: number) => void;
  syncDefaultPhaseSelection: (phase: number) => void;
  setFarmHeroEnabled: (heroId: string, enabled: boolean) => void;
  setFarmReturnBonus: (mode: ReturnBonusMode) => void;
  onSelectHero: (hero: HeroRecord) => void;
  setRespecPanelOpen: (open: boolean) => void;
  setRespecReRank: (active: boolean) => void;
  runRespec: () => void;
  proposedRows: (inputs: FarmInputs, proposedSquad: SquadFarmFacts) => FarmRankingResult;
};

/**
 * The two views over a settled snapshot. Split out so every derivation below runs against
 * non-null rows rather than being written twice for the ladder's benefit, and grouped into three
 * bags for the same reason the package's own views group theirs.
 */
function FarmScreen({
  snapshot,
  view,
  respec,
  refresh,
  actions,
}: {
  snapshot: FarmSettledBoard;
  view: {
    phase: number;
    phaseChosen: boolean;
    activeHeroId: string | null;
    tableScrollportHeightPx: number;
  };
  respec: FarmRespecState;
  refresh: FarmScreenRefresh;
  actions: FarmScreenActions;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const farmCopy = useFarmCopy();
  const { board, inputs, gate, capturedAt } = snapshot;

  const screenCopy = useMemo(() => farmScreenCopy(farmCopy, t), [farmCopy, t]);

  const statLabels = useMemo<FarmStatLabels>(() => {
    const full = {} as Record<SheetKey, string>;
    for (const key of SHEET_KEYS) {
      full[key] = key === 'luck' ? t.farmStatLuck : statLabel(key, lang);
    }
    return { column: t.farmStatColumn, full };
  }, [t, lang]);

  // One array per snapshot, shared by both views: the explorer's own contract asks for a mutable
  // one, and two copies would be two identities for the same roster on a screen whose memos are
  // all keyed by reference.
  const heroes = useMemo(() => [...inputs.heroes], [inputs]);

  const poolEntries = useMemo(
    () => deriveFarmPoolEntries(heroes, inputs.farmPoolOverrides),
    [heroes, inputs],
  );

  const account = useMemo(() => buildAccount(inputs), [inputs]);

  // Both read the proposal through the same freshness derivation, so the table can never be
  // captioned as showing a build the panel is no longer allowed to describe.
  const proposal = useMemo(() => freshProposal(respec, inputs), [respec, inputs]);
  const reRanking = reRankActive(respec, inputs);

  // Only computed on the re-ranked branch, and memoized inside the store, so leaving the toggle
  // on costs one table rather than one per render.
  const rows = useMemo(
    () =>
      proposal && reRanking ? actions.proposedRows(inputs, proposal.result.proposedSquad) : board,
    [proposal, reRanking, actions, inputs, board],
  );

  const boardData = useMemo<FarmRankingBoardData>(
    () => ({
      result: rows,
      reRankActive: reRanking,
      heroes,
      poolEntries,
      returnBonus: inputs.farmReturnBonus,
      maxPhase: inputs.maxPhase,
      fieldSlots: inputs.fieldSlots,
      currentPhase: view.phase,
      phasesViewPhaseChosen: view.phaseChosen,
      statLabels,
      respec: { gate, view: proposal, status: respec.status, panelOpen: respec.panelOpen },
      tableScrollportHeightPx: view.tableScrollportHeightPx,
    }),
    [
      rows,
      reRanking,
      heroes,
      inputs,
      poolEntries,
      view.phase,
      view.phaseChosen,
      view.tableScrollportHeightPx,
      statLabels,
      gate,
      proposal,
      respec.status,
      respec.panelOpen,
    ],
  );

  const boardActions = useMemo<FarmRankingBoardActions>(
    () => ({
      setPhasesViewPhase: actions.setPhasesViewPhase,
      syncDefaultPhaseSelection: actions.syncDefaultPhaseSelection,
      setFarmHeroEnabled: actions.setFarmHeroEnabled,
      setFarmReturnBonus: actions.setFarmReturnBonus,
      setFarmRespecPanelOpen: actions.setRespecPanelOpen,
      setFarmRespecReRank: actions.setRespecReRank,
      runFarmRespec: actions.runRespec,
    }),
    [actions],
  );

  const boardSlots = useMemo<FarmRankingBoardSlots>(
    () => ({
      headerOverlay: (
        <FarmRefreshControl
          capturedAt={capturedAt}
          stale={refresh.stale}
          busy={refresh.busy}
          onRefresh={refresh.onRefresh}
        />
      ),
    }),
    [capturedAt, refresh],
  );

  const explorerData = useMemo(
    () => ({
      phase: view.phase,
      heroes,
      activeHeroId: view.activeHeroId,
      account,
      farmRows: board,
    }),
    [view.phase, view.activeHeroId, heroes, account, board],
  );

  const explorerActions = useMemo(
    () => ({
      setPhasesViewPhase: actions.setPhasesViewPhase,
      onSelectHero: actions.onSelectHero,
    }),
    [actions],
  );

  /**
   * The picker with no enable/disable switch in it. `onSetBattleAllowed` is what draws that
   * column, and this app has no roster of its own to persist it to — so the column is absent
   * rather than present and inert, and what is left is a way to choose which hero to look at.
   */
  const explorerSlots = useMemo(
    () => ({
      renderPicker: (picker: HeroPickerSlotProps) => (
        <HeroPickerDialogView
          open={picker.open}
          onOpenChange={picker.onOpenChange}
          lang={lang}
          t={screenCopy}
          data={{
            heroes: picker.heroes,
            heroId: picker.heroId,
            formatNumber: picker.formatNumber,
          }}
          actions={{ onSelectHero: picker.onSelectHero }}
        />
      ),
    }),
    [lang, screenCopy],
  );

  return (
    <>
      <FarmRankingBoardView
        t={farmCopy}
        lang={lang}
        data={boardData}
        actions={boardActions}
        slots={boardSlots}
      />
      <PhasesExplorerView
        t={screenCopy}
        lang={lang}
        data={explorerData}
        actions={explorerActions}
        slots={explorerSlots}
      />
    </>
  );
}
