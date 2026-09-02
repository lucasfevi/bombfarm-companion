import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { MAX_TEST_WORKERS } from '../../vitest.workers';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    environment: 'node',
    // Capped here too, so a standalone `pnpm --filter` run is bounded — see vitest.workers.ts.
    maxWorkers: MAX_TEST_WORKERS,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      // Without this the exports map resolves domain to `dist/`, which would make these
      // tests depend on a build they do not depend on today — and a failure would then
      // report a resolver difference rather than a real behaviour change.
      '@bombfarm/domain': path.resolve(root, '../domain/src'),
    },
  },
});
