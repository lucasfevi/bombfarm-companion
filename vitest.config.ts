import { defineConfig } from 'vitest/config';
import { MAX_TEST_WORKERS } from './vitest.workers';

export default defineConfig({
  test: {
    // See vitest.workers.ts — the critical path is one long solver file, so extra
    // workers past this cap burn cores without shortening the run.
    maxWorkers: MAX_TEST_WORKERS,
    // packages/domain's team-plan tests run long, single-threaded synchronous solver calls
    // that starve the worker's event loop past Vitest's hardcoded 60s worker<->main
    // "onTaskUpdate" RPC timeout (independent of testTimeout). That surfaces as an Unhandled
    // Error that fails the run even when every test passes. Setting this per-project
    // (packages/domain/vitest.config.ts) isn't enough — the root `pnpm test` run (this file,
    // via the `projects` workspace) has its own top-level unhandled-error handling, so the
    // flag needs to be set here too.
    dangerouslyIgnoreUnhandledErrors: true,
    projects: [
      'packages/contracts/vitest.config.ts',
      'packages/domain/vitest.config.ts',
      'packages/game-api/vitest.config.ts',
      'packages/game-data/vitest.config.ts',
      'packages/pricing/vitest.config.ts',
      'packages/tap-runtime/vitest.config.ts',
      'packages/ui/vitest.config.ts',
      'apps/web/vitest.config.ts',
      'apps/desktop/vitest.config.ts',
      'tools/vitest.config.ts',
    ],
  },
});
