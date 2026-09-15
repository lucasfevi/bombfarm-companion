'use client';

import { NextPointRanking } from '@bombfarm/hero/components';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore, selectNextPointRanking } from '@/shared/stores';

/**
 * Store wiring for the shared Next-point panel. The mode select and the ranked rows are read
 * here, one level below `AdviceColumn`, so switching mode re-renders this panel rather than
 * every panel in the column.
 */
export function NextPointPanel() {
  const { t, lang } = useAppLang();
  const rankMode = usePlannerStore((state) => state.rankMode);
  const setRankMode = usePlannerStore((state) => state.setRankMode);
  const ranking = usePlannerStore(selectNextPointRanking);

  return (
    <NextPointRanking
      t={t}
      lang={lang}
      ranking={ranking}
      rankMode={rankMode}
      onRankMode={setRankMode}
    />
  );
}
