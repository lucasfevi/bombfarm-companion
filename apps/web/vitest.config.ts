import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // gear-plan-runner.test.ts calls the real solver — letting the gear-plan search converge
    // to local optimality (roster gear optimizer monotonicity fix) raised a single
    // `runGearPlan` call from sub-second to several seconds on the committed fixtures.
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
    },
  },
});
