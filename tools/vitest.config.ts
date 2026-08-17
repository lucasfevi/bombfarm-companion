import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.mjs'],
    // NO globalSetup here, deliberately — unlike apps/desktop and packages/game-api, which do
    // run tools/require-workspace-dist.mjs project-wide. This project's guard is PER-FILE, in
    // tools/advice-change-key-coverage.test.mjs, for two reasons that only hold here:
    //
    //   1. .github/workflows/line-endings.yml runs `pnpm vitest run --project tools line-endings`
    //      with no build step, on purpose (read its header: the job is intentionally cheap, and
    //      the guard it runs shells out to `git ls-files --eol` and imports no workspace package).
    //      globalSetup runs once per PROJECT before collection, regardless of the filename
    //      filter, so a project-wide guard here throws in a job that never needed a build.
    //   2. Measured: exactly one of this project's 33 files needs packages/domain/dist —
    //      advice-change-key-coverage.test.mjs, which pulls in
    //      apps/desktop/renderer/lib/planning/hero-advice.ts and through it the @bombfarm/domain
    //      subpaths that resolve via the real exports map. Project-wide is the wrong granularity.
    //
    // The guard is not weakened, only relocated: that file calls assertWorkspaceDistBuilt('tools')
    // at top level, before the dynamic import, so an unbuilt domain still fails loudly with the
    // module's actionable message instead of dying at collection (34 tests never run) under a
    // summary reading "450 passed" with zero failures. tools/require-workspace-dist.test.mjs
    // asserts both halves of that arrangement, so deleting the per-file call turns it red.
  },
});
