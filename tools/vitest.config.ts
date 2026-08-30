import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.mjs'],
    // NO globalSetup here, deliberately — unlike apps/desktop and packages/game-api, which do
    // run tools/require-workspace-dist.mjs project-wide. This project's guard is PER-FILE, on
    // tools/derived-fixture-drift.test.mjs, for two reasons that only hold here:
    //
    //   1. .github/workflows/line-endings.yml runs `pnpm vitest run --project tools line-endings`
    //      with no build step, on purpose (read its header: the job is intentionally cheap, and
    //      the guard it runs shells out to `git ls-files --eol` and imports no workspace package).
    //      globalSetup runs once per PROJECT before collection, regardless of the filename
    //      filter, so a project-wide guard here throws in a job that never needed a build.
    //   2. Measured: of this project's files, exactly one needs a workspace package built —
    //      derived-fixture-drift.test.mjs needs packages/game-api/dist (and, transitively,
    //      packages/domain/dist too). Project-wide is the wrong granularity for it.
    //
    // The guard is not weakened, only relocated: that file calls assertWorkspaceDistBuilt at top
    // level, before its dynamic import, on its OWN key (not a shared 'tools' key — a second
    // build-dependent file would not need the same packages, and a shared list would then over-
    // or under-demand for one of them) — see tools/require-workspace-dist.mjs's
    // REQUIRED_DIST_PACKAGES. An unbuilt package still fails loudly with the module's actionable
    // message instead of dying at collection under a summary reading "N passed" with zero
    // failures. tools/require-workspace-dist.test.mjs asserts both halves of that arrangement, so
    // deleting the per-file call turns it red.
  },
});
