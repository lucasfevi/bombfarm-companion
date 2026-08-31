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
 *
 * Every compute is scheduled off the paint so the loading state is a committed frame rather than
 * a skipped one, and the hand memoisation below is load-bearing: the desktop renderer does not
 * enable the React Compiler, and a freshly-allocated prop bag on every render reaches a 600-row
 * table.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner, Button, EmptyState, colClass } from '@bombfarm/ui';
import { scheduleAfterPaint } from '@bombfarm/farm';
import {
  FarmRankingBoardView,
  PhasesExplorerView,
  type FarmRankingBoardActions,
  type FarmRankingBoardData,
  type FarmRespecBoardData,
  type FarmStatLabels,
} from '@bombfarm/farm/components';
import {
  buildAccount,
  deriveFarmPoolEntries,
  type FarmInputs,
  type FarmRankingResult,
} from '@bombfarm/farm/core';
import { statLabel } from '@bombfarm/domain/game-labels';
import { SHEET_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import type { ReturnBonusMode } from '@bombfarm/domain/farm-rate';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import { DEFAULT_FARM_CONTROLS, type FarmControls } from '../../lib/farm/farm-inputs';
import { loadFarmView, saveFarmView } from '../../lib/farm/farm-view-storage';
import { useFarmSnapshot } from '../../lib/farm/use-farm-snapshot';
import { farmScreenCopy, useFarmCopy } from './farm-copy';

const DEFAULT_PHASE = 1;

/**
 * The desktop offers no respec advisor: it has no build editor to spend the proposal in, and the
 * toolbar renders nothing at all unless the gate surfaces. A gate that never surfaces is the
 * honest way to say so — the alternative is an Optimize button that does nothing when pressed.
 */
const NO_RESPEC: FarmRespecBoardData = Object.freeze({
  gate: Object.freeze({ result: null, reason: null, shouldSurface: false }),
  view: null,
  status: 'idle',
  panelOpen: false,
});

/** Unreachable while {@link NO_RESPEC} never surfaces, and typed rather than left undefined so
 *  that stays a fact about this screen instead of a crash if it ever changes. */
function ignore(): void {}

export function FarmView() {
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
    }),
    [
      setPhasesViewPhase,
      syncDefaultPhaseSelection,
      setFarmHeroEnabled,
      setFarmReturnBonus,
      onSelectHero,
    ],
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

  if (state.status === 'idle' || state.status === 'computing') {
    return (
      <div data-testid="farm-view">
        <EmptyState title={t.shellLoadingLabel} />
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

  return (
    <div data-testid="farm-view" className={colClass}>
      {stale ? (
        <Banner tone="warn" title={t.farmStaleTitle}>
          <span className="flex flex-wrap items-center gap-3">
            <span>{t.farmStaleDescription}</span>
            <Button type="button" variant="primary" data-testid="farm-refresh" onClick={onRefresh}>
              {t.farmRefresh}
            </Button>
          </span>
        </Banner>
      ) : null}
      <FarmScreen
        snapshot={{ board: state.board, inputs: state.inputs }}
        view={{ phase, phaseChosen, activeHeroId }}
        actions={screenActions}
      />
    </div>
  );
}

type FarmScreenActions = {
  setPhasesViewPhase: (phase: number) => void;
  syncDefaultPhaseSelection: (phase: number) => void;
  setFarmHeroEnabled: (heroId: string, enabled: boolean) => void;
  setFarmReturnBonus: (mode: ReturnBonusMode) => void;
  onSelectHero: (hero: HeroRecord) => void;
};

/**
 * The two views over a settled snapshot. Split out so every derivation below runs against
 * non-null rows rather than being written twice for the ladder's benefit, and grouped into three
 * bags for the same reason the package's own views group theirs.
 */
function FarmScreen({
  snapshot,
  view,
  actions,
}: {
  snapshot: { board: FarmRankingResult; inputs: FarmInputs };
  view: { phase: number; phaseChosen: boolean; activeHeroId: string | null };
  actions: FarmScreenActions;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const farmCopy = useFarmCopy();
  const { board, inputs } = snapshot;

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

  const boardData = useMemo<FarmRankingBoardData>(
    () => ({
      result: board,
      reRankActive: false,
      heroes,
      poolEntries,
      returnBonus: inputs.farmReturnBonus,
      maxPhase: inputs.maxPhase,
      fieldSlots: inputs.fieldSlots,
      currentPhase: view.phase,
      phasesViewPhaseChosen: view.phaseChosen,
      statLabels,
      respec: NO_RESPEC,
    }),
    [board, heroes, inputs, poolEntries, view.phase, view.phaseChosen, statLabels],
  );

  const boardActions = useMemo<FarmRankingBoardActions>(
    () => ({
      setPhasesViewPhase: actions.setPhasesViewPhase,
      syncDefaultPhaseSelection: actions.syncDefaultPhaseSelection,
      setFarmHeroEnabled: actions.setFarmHeroEnabled,
      setFarmReturnBonus: actions.setFarmReturnBonus,
      setFarmRespecPanelOpen: ignore,
      setFarmRespecReRank: ignore,
      runFarmRespec: ignore,
    }),
    [actions],
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

  return (
    <>
      <FarmRankingBoardView t={farmCopy} lang={lang} data={boardData} actions={boardActions} />
      <PhasesExplorerView t={screenCopy} lang={lang} data={explorerData} actions={explorerActions} />
    </>
  );
}
