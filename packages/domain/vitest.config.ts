import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import { SOLVER_TEST_FILES } from '../../vitest.solver-files.mjs';
import { MAX_TEST_WORKERS } from '../../vitest.workers';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    environment: 'node',
    setupFiles: ['tests/helpers/yield-between-tests.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: [...configDefaults.exclude, ...SOLVER_TEST_FILES],
    // This package owns the CPU-bound solver tests — see vitest.workers.ts. Set here as
    // well as at the root so `pnpm --filter @bombfarm/domain test` is capped too.
    maxWorkers: MAX_TEST_WORKERS,
    // Letting the team-plan search converge to local optimality (roster gear optimizer
    // monotonicity fix) raised a single `runTeamPlan` call from sub-second to ~5-15s on the
    // committed fixtures; several tests call it more than once — the heaviest (4 calls in one
    // test) runs ~40s on a fast dev machine, so 60s left no real margin on slower CI runners
    // (observed timeout in PR #27 CI). 120s keeps genuine headroom.
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@bombfarm/domain': path.resolve(root, './src'),
      '@bombfarm/contracts': path.resolve(root, '../contracts/src'),
    },
  },
});
