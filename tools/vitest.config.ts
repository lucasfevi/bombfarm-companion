import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.mjs'],
    // NO globalSetup here, deliberately — unlike apps/desktop and packages/game-api, which do
    // run tools/require-workspace-dist.mjs project-wide. This project's guard is PER-FILE, on
    // tools/advice-change-key-coverage.test.mjs and tools/derived-fixture-drift.test.mjs, for two
    // reasons that only hold here:
    //
    //   1. .github/workflows/line-endings.yml runs `pnpm vitest run --project tools line-endings`
    //      with no build step, on purpose (read its header: the job is intentionally cheap, and
    //      the guard it runs shells out to `git ls-files --eol` and imports no workspace package).
    //      globalSetup runs once per PROJECT before collection, regardless of the filename
    //      filter, so a project-wide guard here throws in a job that never needed a build.
    //   2. Measured: of this project's 37 files, exactly two need a workspace package built —
    //      advice-change-key-coverage.test.mjs needs packages/domain/dist (it pulls in
    //      apps/desktop/renderer/lib/planning/hero-advice.ts and through it the @bombfarm/domain
    //      subpaths that resolve via the real exports map), and derived-fixture-drift.test.mjs
    //      needs packages/game-api/dist (and, transitively, packages/domain/dist too). Project-wide
    //      is the wrong granularity for either.
    //
    // The guard is not weakened, only relocated: both files call assertWorkspaceDistBuilt('tools')
    // at top level, before their dynamic import, so an unbuilt package still fails loudly with the
    // module's actionable message instead of dying at collection under a summary reading "N
    // passed" with zero failures. tools/require-workspace-dist.test.mjs asserts both halves of
    // that arrangement for both files, so deleting either per-file call turns it red.
  },
});
