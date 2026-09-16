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
  FarmAuraCapField,
  FarmRankingBoardView,
  PhasesExplorerView,
  type FarmRankingBoardActions,
  type FarmRankingBoardData,
  type FarmRankingBoardSlots,
} from '@bombfarm/farm/components';
import { HeroPickerDialogView, type HeroPickerSlotProps } from '@bombfarm/hero/components';
import { buildRosterAccount, deriveFarmPoolEntries } from '@bombfarm/farm/core';
import type { ReturnBonusMode } from '@bombfarm/domain/farm-rate';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { TeamAuraId } from '@bombfarm/domain/team-buffs';
import { withAuraAtCap } from '@bombfarm/team-plan/core';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import { buildAccountRoster } from '../../lib/account/account-roster';
import {
  useAccountReadRequest,
  type AccountReadRequestState,
} from '../../lib/account/use-account-read-request';
import { DEFAULT_FARM_CONTROLS, type FarmControls } from '../../lib/farm/farm-inputs';
import { loadFarmView, saveFarmView } from '../../lib/farm/farm-view-storage';
import { settledBoard, type FarmSettledBoard } from '../../lib/farm/farm-snapshot-store';
import { useFarmSnapshot } from '../../lib/farm/use-farm-snapshot';
import { useFarmTableHeight } from '../../lib/farm/use-farm-table-height';
import { farmScreenCopy, useFarmCopy } from '../screen-copy';
import { AccountRefreshControl } from '../account-refresh-control';

const DEFAULT_PHASE = 1;

/** `onOpenOptimizer` is the shell's tab switch: the board's Optimize button is a way to the
 *  Optimizer tab, and which tab is showing is the shell's state, not this screen's. */
export function FarmView({ onOpenOptimizer }: { onOpenOptimizer: () => void }) {
  const t = useCopy();
  const account = useAccountView();
  const { state, stale, hasAccount, open, refresh, setControls } = useFarmSnapshot();

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
      aurasAtCap: stored.aurasAtCap,
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

  // Re-solving alone would answer the press from the account the renderer already holds, which
  // the background cycle need not have moved since the board last took it. So the press also asks
  // main to go and read — and re-solves either way, because the board can be behind an account
  // that is already committed even when no new read is allowed to start.
  const adoptLive = useCallback(() => {
    scheduleAfterPaint(() => {
      refresh(controls);
    });
  }, [refresh, controls]);
  const { state: readState, request: onRefresh } = useAccountReadRequest(adoptLive);

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

  const setAuraAtCap = useCallback((auraId: TeamAuraId, atCap: boolean) => {
    setLocalControls((previous) => {
      const aurasAtCap = withAuraAtCap(previous.aurasAtCap, auraId, atCap);
      return aurasAtCap === previous.aurasAtCap ? previous : { ...previous, aurasAtCap };
    });
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
      setAuraAtCap,
      onSelectHero,
      onOpenOptimizer,
    }),
    [
      setPhasesViewPhase,
      syncDefaultPhaseSelection,
      setFarmHeroEnabled,
      setFarmReturnBonus,
      setAuraAtCap,
      onSelectHero,
      onOpenOptimizer,
    ],
  );

  // Named above the board rather than priced on it: a hero whose spent points could not be read
  // is left out by `buildFarmInputs`, and a row that silently vanished would read as an account
  // that lost a hero. Read off the live account, not the snapshot — the roster is what says so.
  const leftOut = useMemo(
    () => (account.status === 'loaded' ? (buildAccountRoster(account.view)?.pointsUnrecovered ?? []) : []),
    [account],
  );

  const tableScrollportHeightPx = useFarmTableHeight();
  const settled = useMemo(() => settledBoard(state), [state]);
  const busy = state.status === 'computing';
  const refreshBag = useMemo<FarmScreenRefresh>(
    () => ({ stale, busy, readState, onRefresh }),
    [stale, busy, readState, onRefresh],
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
      {leftOut.length > 0 ? (
        <Banner tone="warn" title={t.farmLeftOutTitle} data-testid="farm-left-out">
          {sub(t.farmLeftOutBody, { heroes: leftOut.map((hero) => hero.name).join(', ') })}
        </Banner>
      ) : null}
      <FarmScreen
        snapshot={settled}
        view={{ phase, phaseChosen, activeHeroId, tableScrollportHeightPx }}
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
  readState: AccountReadRequestState;
  onRefresh: () => void;
};

type FarmScreenActions = {
  setPhasesViewPhase: (phase: number) => void;
  syncDefaultPhaseSelection: (phase: number) => void;
  setFarmHeroEnabled: (heroId: string, enabled: boolean) => void;
  setFarmReturnBonus: (mode: ReturnBonusMode) => void;
  setAuraAtCap: (auraId: TeamAuraId, atCap: boolean) => void;
  onSelectHero: (hero: HeroRecord) => void;
  onOpenOptimizer: () => void;
};

/**
 * The two views over a settled snapshot. Split out so every derivation below runs against
 * non-null rows rather than being written twice for the ladder's benefit, and grouped into three
 * bags for the same reason the package's own views group theirs.
 */
function FarmScreen({
  snapshot,
  view,
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
  refresh: FarmScreenRefresh;
  actions: FarmScreenActions;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const farmCopy = useFarmCopy();
  const { board, inputs, capturedAt } = snapshot;

  const screenCopy = useMemo(() => farmScreenCopy(farmCopy, t), [farmCopy, t]);

  // One array per snapshot, shared by both views: the explorer's own contract asks for a mutable
  // one, and two copies would be two identities for the same roster on a screen whose memos are
  // all keyed by reference.
  const heroes = useMemo(() => [...inputs.heroes], [inputs]);

  const poolEntries = useMemo(
    () => deriveFarmPoolEntries(heroes, inputs.farmPoolOverrides),
    [heroes, inputs],
  );

  // The explorer's squad ranking prices team auras the way the board beside it does: every pooled
  // carrier weighted by its predicted uptime.
  const account = useMemo(() => buildRosterAccount(inputs), [inputs]);

  const boardData = useMemo<FarmRankingBoardData>(
    () => ({
      result: board,
      heroes,
      poolEntries,
      returnBonus: inputs.farmReturnBonus,
      maxPhase: inputs.maxPhase,
      fieldSlots: inputs.fieldSlots,
      currentPhase: view.phase,
      phasesViewPhaseChosen: view.phaseChosen,
      tableScrollportHeightPx: view.tableScrollportHeightPx,
    }),
    [board, heroes, inputs, poolEntries, view.phase, view.phaseChosen, view.tableScrollportHeightPx],
  );

  const boardActions = useMemo<FarmRankingBoardActions>(
    () => ({
      setPhasesViewPhase: actions.setPhasesViewPhase,
      syncDefaultPhaseSelection: actions.syncDefaultPhaseSelection,
      setFarmHeroEnabled: actions.setFarmHeroEnabled,
      setFarmReturnBonus: actions.setFarmReturnBonus,
      openOptimizer: actions.onOpenOptimizer,
    }),
    [actions],
  );

  const boardSlots = useMemo<FarmRankingBoardSlots>(
    () => ({
      headerOverlay: (
        <AccountRefreshControl
          capturedAt={capturedAt}
          stale={refresh.stale}
          busy={refresh.busy}
          readState={refresh.readState}
          onRefresh={refresh.onRefresh}
        />
      ),
      // The board's own assumption about the auras, beside the Return Bonus it already owns.
      // Reads the settled snapshot's list, as the Return Bonus select reads its mode.
      controls: (
        <FarmAuraCapField
          label={t.farmAurasAtCapLabel}
          hint={t.farmAurasAtCapHint}
          value={inputs.aurasAtCap}
          onToggle={actions.setAuraAtCap}
          lang={lang}
          testId="farm-auras-at-cap"
        />
      ),
    }),
    [capturedAt, refresh, t, lang, inputs.aurasAtCap, actions.setAuraAtCap],
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
