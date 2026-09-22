import { defineConfig } from 'vitest/config';
import { MAX_TEST_WORKERS } from './vitest.workers';

export default defineConfig({
  test: {
    // See vitest.workers.ts — the critical path is one long solver file, so extra
    // workers past this cap burn cores without shortening the run.
    maxWorkers: MAX_TEST_WORKERS,
    projects: [
      'packages/account/vitest.config.ts',
      'packages/contracts/vitest.config.ts',
      'packages/domain/vitest.config.ts',
      'packages/farm/vitest.config.ts',
      'packages/game-api/vitest.config.ts',
      'packages/game-art/vitest.config.ts',
      'packages/game-data/vitest.config.ts',
      'packages/hero/vitest.config.ts',
      'packages/pricing/vitest.config.ts',
      'packages/tap-runtime/vitest.config.ts',
      'packages/team-plan/vitest.config.ts',
      'packages/ui/vitest.config.ts',
      'apps/web/vitest.config.ts',
      'apps/desktop/vitest.config.ts',
      'tools/vitest.config.ts',
    ],
  },
});
