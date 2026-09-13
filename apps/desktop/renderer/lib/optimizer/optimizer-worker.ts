/**
 * The desktop's injectable worker factory for the optimizer's search, and the e2e seam that
 * switches it off.
 *
 * The package's runner treats a throwing `createWorker` as "no worker available" and falls back
 * to running the same search on the main thread, labelled. That is the whole mechanism the smoke
 * needs to prove the fallback path works: it never has to simulate a real worker failure, only
 * set a `localStorage` flag before pressing Optimize.
 */
import { createTeamPlanWorkerModule } from '@bombfarm/team-plan/runner';
import type { TeamPlanWorkerLike } from '@bombfarm/team-plan/runner';

/** Prefixed `bfc-` to sit beside this app's other e2e-only storage keys, never `bf-` (the web's
 *  own knobs, which read from the SAME `localStorage` the desktop renderer runs in). */
export const E2E_NO_WORKER_KEY = 'bfc-e2e-optimizer-no-worker';

function e2eWorkerDisabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(E2E_NO_WORKER_KEY) === '1';
}

export function createOptimizerWorker(): TeamPlanWorkerLike {
  if (e2eWorkerDisabled()) {
    throw new Error('worker construction disabled by the smoke');
  }
  return createTeamPlanWorkerModule();
}
