'use client';

import { useCallback, useEffect, useState } from 'react';
import {
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
    if (next === 'hero' || next === 'gear' || next === 'account' || next === 'points') {
      setTabState(next);
    }
  }, []);

  return { tab, setTab };
}
