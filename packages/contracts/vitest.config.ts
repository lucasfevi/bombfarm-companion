import { defineConfig } from 'vitest/config';
import { MAX_TEST_WORKERS } from '../../vitest.workers';

export default defineConfig({
  test: {
    // Capped here too, so a standalone `pnpm --filter` run is bounded — see vitest.workers.ts.
    maxWorkers: MAX_TEST_WORKERS,
    include: ['src/**/*.test.ts'],
  },
});
