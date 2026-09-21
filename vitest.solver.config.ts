// Vitest's worker-to-main "onTaskUpdate" RPC has a hardcoded 60 s timeout, independent of
// testTimeout. A test whose body is one synchronous block longer than that starves the worker's
// event loop past the window, and the run fails with every test passing, reporting
// `Unhandled Error: [vitest-worker]: Timeout calling "onTaskUpdate"`. The domain solver suites
// listed in vitest.solver-files.mjs are the ones that do this, so this config runs exactly
// those files with unhandled errors ignored — and nowhere else is the flag set, so every other
// project keeps failing on a real unhandled rejection or async throw. The domain project
// excludes the same list, and `pnpm test` runs both passes. A domain test whose synchronous
// body approaches the window is added to vitest.solver-files.mjs; the flag is never restored
// in another config.
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
