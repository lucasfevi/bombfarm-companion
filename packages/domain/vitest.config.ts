import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Letting the gear-plan search converge to local optimality (roster gear optimizer
    // monotonicity fix) raised a single `runGearPlan` call from sub-second to ~5-15s on the
    // committed fixtures; several tests call it more than once. 60s keeps a generous margin.
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@bombfarm/domain': path.resolve(root, './src'),
    },
  },
});
