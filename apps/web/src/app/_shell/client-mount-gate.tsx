'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  attachPlannerPersistence,
  attachTeamPlanRunnerSync,
  ensureTeamPlanSolver,
  hydratePlannerStore,
  usePlannerStore,
} from '@/shared/stores';
import { createShellTeamPlanSolver } from './create-shell-team-plan-solver';

/** Inline dark shell so a CSS/HMR glitch never flashes a white loading page. */
const loadingShellStyle = {
  minHeight: '100vh',
  background: 'oklch(18% 0.015 48)',
} as const;

/**
 * Single client mount gate for the app shell — hydrates the planner store before
 * children render. Do **not** use `next/dynamic(..., { ssr: false })`
 * (Next 15.5 `BAILOUT_TO_CLIENT_SIDE_RENDERING`).
 */
export function ClientMountGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydratePlannerStore();
    const detach = attachPlannerPersistence(usePlannerStore);
    const solver = ensureTeamPlanSolver(createShellTeamPlanSolver);
    const detachSync = attachTeamPlanRunnerSync(usePlannerStore, solver);
    setReady(true);
    return () => {
      detachSync();
      detach();
    };
  }, []);

  if (!ready) {
    return <div style={loadingShellStyle} aria-busy="true" />;
  }

  return children;
}
