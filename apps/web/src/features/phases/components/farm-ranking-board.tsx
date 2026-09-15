'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FarmRankingBoardView } from '@bombfarm/farm/components';
import type { Lang, Strings } from '@/shared/i18n';
import { SITE_SECTION_HREF } from '@/shared/lib/site-sections';
import {
  deriveFarmPoolEntries,
  selectFarmRankingRows,
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
 * `selectFarmRankingRows` is read WITHOUT `useShallow` — it returns a stable identity on a cache
 * hit, and shallow-comparing 600 rows on every write would defeat the memo it exists to protect.
 *
 * The Optimize button is this app's route to the Optimizer page; the desktop app switches a tab
 * instead, which is why the board takes a callback rather than an href.
 */
export function FarmRankingBoard({ t, lang }: { t: Strings; lang: Lang }) {
  const router = useRouter();
  const result = usePlannerStore(selectFarmRankingRows);
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
  const setPhasesViewPhase = usePlannerStore((state) => state.setPhasesViewPhase);
  const syncDefaultPhaseSelection = usePlannerStore((state) => state.syncDefaultPhaseSelection);
  const setFarmHeroEnabled = usePlannerStore((state) => state.setFarmHeroEnabled);
  const setFarmReturnBonus = usePlannerStore((state) => state.setFarmReturnBonus);
  const openOptimizer = useCallback(() => {
    router.push(SITE_SECTION_HREF.optimizer);
  }, [router]);

  return (
    <FarmRankingBoardView
      t={t}
      lang={lang}
      data={{
        result,
        heroes,
        poolEntries,
        returnBonus,
        maxPhase,
        fieldSlots,
        currentPhase,
        phasesViewPhaseChosen,
      }}
      actions={{
        setPhasesViewPhase,
        syncDefaultPhaseSelection,
        setFarmHeroEnabled,
        setFarmReturnBonus,
        openOptimizer,
      }}
    />
  );
}
