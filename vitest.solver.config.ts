// Vitest's worker-to-main "onTaskUpdate" RPC has a hardcoded 60 s timeout, independent of
// testTimeout. A test whose body is one synchronous block longer than that starves the worker's
// event loop past the window, and the run fails with every test passing, reporting
// `Unhandled Error: [vitest-worker]: Timeout calling "onTaskUpdate"`. The files listed in
// vitest.solver-files.mjs are the ones with a SINGLE synchronous test body long enough to cross
// it (one farm-points test runs several minutes), so this config runs exactly those files with
// unhandled errors ignored — and nowhere else is the flag set, so every other project keeps
// failing on a real unhandled rejection or async throw. Every other domain file is protected by
// the per-test yield in tests/helpers/yield-between-tests.ts, which makes the window apply per
// test body rather than per file. The domain project excludes this list and `pnpm test` runs
// both passes. A domain test whose single synchronous body approaches the window goes on the
// list; a file that is merely long in total does not; the flag is never restored elsewhere.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import domainConfig from './packages/domain/vitest.config';
import { SOLVER_TEST_FILES } from './vitest.solver-files.mjs';
import { MAX_TEST_WORKERS } from './vitest.workers';

export default defineConfig({
  root: path.dirname(fileURLToPath(import.meta.url)),
  test: {
    maxWorkers: MAX_TEST_WORKERS,
    dangerouslyIgnoreUnhandledErrors: true,
    projects: [
      {
        ...domainConfig,
        test: {
          ...domainConfig.test,
          name: '@bombfarm/domain-solver',
          include: [...SOLVER_TEST_FILES],
          exclude: configDefaults.exclude,
        },
      },
    ],
  },
});
