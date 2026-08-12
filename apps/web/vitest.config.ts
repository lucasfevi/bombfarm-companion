import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { MAX_TEST_WORKERS } from '../../vitest.workers';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // team-plan-runner.test.ts calls the real solver — see vitest.workers.ts. Set here as
    // well as at the root so `pnpm --filter @bombfarm/web test` is capped too.
    maxWorkers: MAX_TEST_WORKERS,
    // team-plan-runner.test.ts calls the real solver — letting the team-plan search converge
    // to local optimality (roster gear optimizer monotonicity fix) raised a single
    // `runTeamPlan` call from sub-second to several seconds on the committed fixtures.
    testTimeout: 60_000,
  },
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
      '@bombfarm/domain': path.resolve(root, '../../packages/domain/src'),
      '@bombfarm/ui': path.resolve(root, '../../packages/ui/src'),
      '@bombfarm/contracts': path.resolve(root, '../../packages/contracts/src'),
    },
  },
});
