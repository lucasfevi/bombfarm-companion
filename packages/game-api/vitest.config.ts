import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Type-level assertion files (*.type.test.ts) are executed here too — the `it` blocks with
    // runtime assertions run under Vitest, while the `@ts-expect-error` directives are enforced
    // only by `pnpm --filter @bombfarm/game-api typecheck:tests` (tsconfig.typecheck.json).
  },
});
