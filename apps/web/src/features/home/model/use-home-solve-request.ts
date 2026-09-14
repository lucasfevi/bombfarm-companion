'use client';

import { useEffect } from 'react';
import {
  getLastRequestedSignature,
  noteSolveRequested,
  shouldRequestSolve,
} from '@/features/home/model/home-solve-request';
import {
  getTeamPlanSolver,
  selectTeamPlanInputsUsable,
  selectTeamPlanIsStale,
  usePlannerStore,
} from '@/shared/stores';
import { selectLiveTeamPlanInputSignature } from '@/shared/stores/slices/team-plan-slice';

export function useHomeSolveRequest(): void {
  const booted = usePlannerStore((state) => state.booted);
  const inputsUsable = usePlannerStore(selectTeamPlanInputsUsable);
  const plan = usePlannerStore((state) => state.plan);
  const runStatus = usePlannerStore((state) => state.runStatus);
  const stale = usePlannerStore(selectTeamPlanIsStale);
  const liveSignature = usePlannerStore(selectLiveTeamPlanInputSignature);

  useEffect(() => {
    const wanted = shouldRequestSolve({
      booted,
      inputsUsable,
      plan,
      runStatus,
      stale,
      liveSignature,
      lastRequestedSignature: getLastRequestedSignature(),
    });
    if (!wanted) return;
    noteSolveRequested(liveSignature);
    getTeamPlanSolver().solve();
  }, [booted, inputsUsable, plan, runStatus, stale, liveSignature]);
}
