'use client';

/**
 * Keeps the team-plan worker in the production module graph so webpack emits a
 * separate chunk under `out/_next/static/**` (T22). Never call at module load —
 * instantiation stays in `team-plan-runner-core`.
 */
export function createTeamPlanWorkerModule(): Worker {
  return new Worker(
    /* webpackChunkName: "team-plan-worker" */ new URL('./team-plan.worker.ts', import.meta.url),
    { type: 'module' },
  );
}
