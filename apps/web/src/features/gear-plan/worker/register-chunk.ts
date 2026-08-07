'use client';

/**
 * Keeps the gear-plan worker in the production module graph so webpack emits a
 * separate chunk under `out/_next/static/**` (T22). Never call at module load —
 * instantiation stays in `gear-plan-runner-core`.
 */
export function createGearPlanWorkerModule(): Worker {
  return new Worker(
    /* webpackChunkName: "gear-plan-worker" */ new URL('./gear-plan.worker.ts', import.meta.url),
    { type: 'module' },
  );
}
