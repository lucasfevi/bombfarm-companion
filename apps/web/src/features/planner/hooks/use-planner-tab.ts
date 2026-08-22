'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  isPlannerTabId,
  loadPlannerTab,
  savePlannerTab,
  type PlannerTabId,
} from '../model/planner-tab';

export function usePlannerTab(setupReady: boolean) {
  const [tab, setTabState] = useState<PlannerTabId>(() => loadPlannerTab(setupReady));

  useEffect(() => {
    savePlannerTab(tab);
  }, [tab]);

  const setTab = useCallback((next: string) => {
    if (isPlannerTabId(next)) setTabState(next);
  }, []);

  return { tab, setTab };
}
