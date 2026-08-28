import { availableParallelism } from 'node:os';
import { cappedWorkers } from './tools/cpu-budget.mjs';

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
 *
 * Lowered 4 -> 3 to stop the 4th worker adding sustained load for no wall-time gain — the
 * analysis above already put the floor at 3. Re-measured on `--project @bombfarm/domain`
 * (827 tests): 41.4s wall / 105.2s test CPU at 4 workers, i.e. ~64% worker utilisation, so
 * the run was already critical-path-bound rather than worker-bound. Same run at 3 workers:
 * 41.5s wall — the predicted no-op on wall time, one fewer core held for the whole run.
 *
 * Going below 3 does cost real wall time (the 105s of CPU no longer fits under the ~41s
 * critical path), so 3 is the floor worth holding for a run that has the machine to itself.
 *
 * `cappedWorkers` is what makes "to itself" true rather than assumed. The 3 above bounds ONE
 * run; several suites running at once on one machine each took 3 and multiplied, which is the
 * load this cap was supposed to prevent. A lone run still gets 3 — the budget is wider than
 * that — and concurrent runs divide one budget instead of each claiming it whole.
 */
export const MAX_TEST_WORKERS = cappedWorkers(Math.min(3, availableParallelism()), 'vitest');
