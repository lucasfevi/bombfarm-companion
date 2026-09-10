'use client';

import { SheetTable } from '@bombfarm/hero/components';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore, selectAdvisorPipeline } from '@/shared/stores';

/**
 * Store wiring for the shared Sheet panel. Reading the birth roll, level, stars, loadout and
 * points here keeps a change to any of them inside this panel instead of waking the whole
 * advice column.
 */
export function SheetPanel() {
  const { t, lang } = useAppLang();
  const birth = usePlannerStore((state) => state.birth);
  const level = usePlannerStore((state) => state.level);
  const stars = usePlannerStore((state) => state.stars);
  const loadout = usePlannerStore((state) => state.loadout);
  const pts = usePlannerStore((state) => state.pts);
  const { sheetOther, treeSheet } = usePlannerStore(selectAdvisorPipeline);

  return (
    <SheetTable
      t={t}
      lang={lang}
      input={{ birth, level, stars, sheetOther, loadout, pts, tree: treeSheet }}
    />
  );
}
