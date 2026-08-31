'use client';

import { useMemo } from 'react';
import { FarmRankingBoardView } from '@bombfarm/farm/components';
import type { Lang, Strings } from '@/shared/i18n';
import {
  deriveFarmPoolEntries,
  selectFarmBoardRows,
  selectFarmReRankActive,
  selectFarmRespecGate,
  selectFarmRespecView,
  selectFarmReturnBonus,
  selectFieldSlots,
  selectHeroes,
  selectMaxPhase,
  selectPhasesViewPhase,
  selectPhasesViewPhaseChosen,
  usePlannerStore,
} from '@/shared/stores';

/**
 * This app's connector for the shared board. Every store read the screen needs happens here and
 * nowhere below: `@bombfarm/farm/components` is prop-driven so the desktop app can render the
 * identical screen from its own state, and a second connector per component would put four
 * subscriptions where this one already carries them.
 *
 * `selectFarmBoardRows`, `selectFarmRespecGate` and `selectFarmRespecView` are read WITHOUT
 * `useShallow` — each returns a stable identity on a cache hit, and shallow-comparing 600 rows on
 * every write would defeat the memo they exist to protect.
 */
export function FarmRankingBoard({ t, lang }: { t: Strings; lang: Lang }) {
  const result = usePlannerStore(selectFarmBoardRows);
  const reRankActive = usePlannerStore(selectFarmReRankActive);
  const heroes = usePlannerStore(selectHeroes);
  const farmPoolOverrides = usePlannerStore((state) => state.farmPoolOverrides);
  const poolEntries = useMemo(
    () => deriveFarmPoolEntries(heroes, farmPoolOverrides),
    [heroes, farmPoolOverrides],
  );
  const returnBonus = usePlannerStore(selectFarmReturnBonus);
  const maxPhase = usePlannerStore(selectMaxPhase);
  const fieldSlots = usePlannerStore(selectFieldSlots);
  const currentPhase = usePlannerStore(selectPhasesViewPhase);
  const phasesViewPhaseChosen = usePlannerStore(selectPhasesViewPhaseChosen);
  const respecGate = usePlannerStore(selectFarmRespecGate);
  const respecView = usePlannerStore(selectFarmRespecView);
  const respecStatus = usePlannerStore((state) => state.farmRespecStatus);
  const respecPanelOpen = usePlannerStore((state) => state.farmRespecPanelOpen);
  const setPhasesViewPhase = usePlannerStore((state) => state.setPhasesViewPhase);
  const syncDefaultPhaseSelection = usePlannerStore((state) => state.syncDefaultPhaseSelection);
  const setFarmHeroEnabled = usePlannerStore((state) => state.setFarmHeroEnabled);
  const setFarmReturnBonus = usePlannerStore((state) => state.setFarmReturnBonus);
  const setFarmRespecPanelOpen = usePlannerStore((state) => state.setFarmRespecPanelOpen);
  const setFarmRespecReRank = usePlannerStore((state) => state.setFarmRespecReRank);
  const runFarmRespec = usePlannerStore((state) => state.runFarmRespec);

  return (
    <FarmRankingBoardView
      t={t}
      lang={lang}
      data={{
        result,
        reRankActive,
        heroes,
        poolEntries,
        returnBonus,
        maxPhase,
        fieldSlots,
        currentPhase,
        phasesViewPhaseChosen,
        statLabels: { column: t.colStat, full: t.statFull },
        respec: {
          gate: respecGate,
          view: respecView,
          status: respecStatus,
          panelOpen: respecPanelOpen,
        },
      }}
      actions={{
        setPhasesViewPhase,
        syncDefaultPhaseSelection,
        setFarmHeroEnabled,
        setFarmReturnBonus,
        setFarmRespecPanelOpen,
        setFarmRespecReRank,
        runFarmRespec,
      }}
    />
  );
}
