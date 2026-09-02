import { defineConfig } from 'vitest/config';
import { MAX_TEST_WORKERS } from '../../vitest.workers';

export default defineConfig({
  test: {
    // Capped here too, so a standalone `pnpm --filter` run is bounded — see vitest.workers.ts.
    maxWorkers: MAX_TEST_WORKERS,
    include: ['src/**/*.test.ts'],
    // Fail once, before collection, when packages/domain/dist is missing — measured: without it
    // five of this project's files (client, domain-edge, fingerprints, routes, shape) die at
    // collection with opaque "Cannot find package '@bombfarm/domain/<subpath>'" errors while the
    // summary still reads "131 passed" with zero failures. Shared with apps/desktop and tools/;
    // the module keys the required list off this project's vitest name.
    globalSetup: ['../../tools/require-workspace-dist.mjs'],
    // Type-level assertion files (*.type.test.ts) are executed here too — the `it` blocks with
    // runtime assertions run only under Vitest, while the `@ts-expect-error` directives are
    // enforced only by `pnpm --filter @bombfarm/game-api typecheck:tests` (tsconfig.typecheck.json).
    server: {
      deps: {
        // packages/domain/dist is a BUNDLER-target artifact, not
        // Node-native ESM. domain's source uses extensionless/directory-index relative imports
        // and tsc emits dist/**/*.js with the same specifiers verbatim. Every bundler resolves
        // them; Node's native ESM loader does not (measured: 47/56 subpaths fail to load —
        // ERR_UNSUPPORTED_DIR_IMPORT / ERR_MODULE_NOT_FOUND). Vitest externalises node_modules
        // deps by default and loads them with native Node ESM — exactly the failing path.
        // Inlining moves domain onto Vite's own resolver instead, which (like every bundler)
        // handles the extensionless/directory specifiers fine.
        // Do NOT delete this line — without it this suite fails at collection with a
        // "Cannot find module" error that does not obviously point back here.
        inline: [/@bombfarm\/domain/],
      },
    },
  },
});
