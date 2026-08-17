import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'scripts/**/*.test.mjs',
      // MP3 F2 (design hazard 9, T2) — renderer pure modules and presentational components,
      // run node-env with `renderToStaticMarkup` (the `packages/ui/vitest.config.ts` precedent).
      'renderer/lib/**/*.test.ts',
      'renderer/lib/**/*.test.tsx',
      'renderer/app/**/*.test.tsx',
    ],
    // Fail once, before collection, when any of the workspace dist builds this project resolves
    // through (contracts, domain, game-api, game-data) is missing — see the module's comment.
    // Without it the same missing build surfaces as dozens of opaque "Cannot find package
    // '@bombfarm/<pkg>/<subpath>'" collection errors that point nowhere near the fix. Scoped to
    // this project because apps/web and packages/domain alias @bombfarm/domain to src/ and need
    // no build — NOT because this is the only exposed project. packages/game-api resolves domain
    // through the same exports map and is still unguarded; see the module's comment.
    globalSetup: ['./scripts/require-workspace-dist.mjs'],
    server: {
      deps: {
        // AD-033: packages/domain/dist is a BUNDLER-target artifact, not Node-native ESM.
        // domain's source uses 278 extensionless/directory-index relative imports (B7,
        // design.md), and tsc emits dist/**/*.js with the same specifiers verbatim. Every
        // bundler resolves them; Node's native ESM loader does not (measured: 47/56 subpaths
        // fail to load — ERR_UNSUPPORTED_DIR_IMPORT / ERR_MODULE_NOT_FOUND). Vitest
        // externalises node_modules deps by default and loads them with native Node ESM —
        // exactly the failing path. Inlining moves domain onto Vite's own resolver instead,
        // which (like every bundler) handles the extensionless/directory specifiers fine.
        // Do NOT delete this line — without it the desktop suite fails at collection with a
        // "Cannot find module" error that does not obviously point back here.
        inline: [/@bombfarm\/domain/],
      },
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
});
