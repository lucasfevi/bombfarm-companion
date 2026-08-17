import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.mjs'],
    // Fail once, before collection, when packages/domain/dist is missing — measured:
    // advice-change-key-coverage.test.mjs imports apps/desktop/renderer/lib/planning/hero-advice.ts,
    // which imports @bombfarm/domain subpaths that resolve through the real exports map, so
    // without the build that file dies at collection (34 tests never run) while the summary
    // reads "450 passed" with zero failures. Shared with apps/desktop and packages/game-api;
    // the module keys the required list off this project's vitest name.
    globalSetup: ['./require-workspace-dist.mjs'],
  },
});
