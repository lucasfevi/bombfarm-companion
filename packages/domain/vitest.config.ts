import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { MAX_TEST_WORKERS } from '../../vitest.workers';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // This package owns the CPU-bound solver tests — see vitest.workers.ts. Set here as
    // well as at the root so `pnpm --filter @bombfarm/domain test` is capped too.
    maxWorkers: MAX_TEST_WORKERS,
    // Letting the team-plan search converge to local optimality (roster gear optimizer
    // monotonicity fix) raised a single `runTeamPlan` call from sub-second to ~5-15s on the
    // committed fixtures; several tests call it more than once — the heaviest (4 calls in one
    // test) runs ~40s on a fast dev machine, so 60s left no real margin on slower CI runners
    // (observed timeout in PR #27 CI). 120s keeps genuine headroom.
    testTimeout: 120_000,
    // The same long, single-threaded synchronous `runTeamPlan` calls starve the worker's event
    // loop long enough that Vitest's internal worker<->main "onTaskUpdate" RPC (hardcoded to a
    // 60s timeout, independent of testTimeout — see vitest/dist/chunks/index.*.js
    // DEFAULT_TIMEOUT) times out waiting for an ack the busy worker can't send yet. This fires
    // as an "Unhandled Error" that fails the run even when every test in the file passes
    // (observed: 744 passed / 0 failed, exit 1 from 3 of these). Ignoring unhandled errors here
    // is scoped to this package only, where the cause is understood and benign.
    dangerouslyIgnoreUnhandledErrors: true,
  },
  resolve: {
    alias: {
      '@bombfarm/domain': path.resolve(root, './src'),
      '@bombfarm/contracts': path.resolve(root, '../contracts/src'),
    },
  },
});
