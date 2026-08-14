import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Type-level assertion files (*.type.test.ts) are executed here too — the `it` blocks with
    // runtime assertions run only under Vitest, while the `@ts-expect-error` directives are
    // enforced only by `pnpm --filter @bombfarm/game-api typecheck:tests` (tsconfig.typecheck.json).
    server: {
      deps: {
        // AD-033 (MP5 F4, AD-086): packages/domain/dist is a BUNDLER-target artifact, not
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
