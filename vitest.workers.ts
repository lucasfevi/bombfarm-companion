import { availableParallelism } from 'node:os';

/**
 * Worker cap shared by the root run and the heavy per-package configs.
 *
 * Vitest defaults to roughly one worker per core. On a many-core dev machine that pegs
 * every core for the whole run, because the team-plan solver tests are long, synchronous
 * and CPU-bound — they do not yield, so each worker holds a core outright.
 *
 * Measured on this suite (24 cores, vitest 3.2.7): tests total ~132s of CPU time, and the
 * longest single file (`team-plan-step-monotonicity.test.ts`) runs ~43.5s on its own. A file
 * never splits across workers, so that file is the critical path and wall time cannot drop
 * below it. ceil(132 / 43.5) ≈ 3 workers already reaches that floor; measured wall time was
 * 44.6s uncapped vs 46.9s at 4 workers — within noise, for a fraction of the CPU.
 *
 * Capped rather than left to scale with core count: the ceiling comes from the critical-path
 * file, not from the machine, so more cores buy nothing here and only add heat.
 */
export const MAX_TEST_WORKERS = Math.max(1, Math.min(4, availableParallelism()));
