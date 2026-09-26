'use client';

import { useMemo, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { heroPeekStatsResolver } from '@bombfarm/hero/model';
import { HeroPeekStatsProvider } from '@/shared/game-art';
import { selectTreeSheetTotals, usePlannerStore } from '@/shared/stores';

/** Every hero hover card on the site prints the sheet the hero panel totals, against the planner's own tree. */
export function PlannerHeroPeekStats({ children }: { children: ReactNode }) {
  const tree = usePlannerStore(useShallow(selectTreeSheetTotals));
  const resolve = useMemo(() => heroPeekStatsResolver({ tree }), [tree]);
  return <HeroPeekStatsProvider resolve={resolve}>{children}</HeroPeekStatsProvider>;
}
