'use client';

import { useSyncExternalStore } from 'react';
import { getTeamPlanSolver } from '@/shared/stores';

export function useTeamPlanSolver() {
  const solver = getTeamPlanSolver();
  const snapshot = useSyncExternalStore(solver.subscribe, solver.getSnapshot, solver.getSnapshot);
  return { ...snapshot, solve: solver.solve, cancel: solver.cancel, runner: solver.runner };
}
