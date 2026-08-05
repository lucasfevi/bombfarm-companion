import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/contracts/vitest.config.ts',
      'packages/domain/vitest.config.ts',
      'packages/game-data/vitest.config.ts',
      'packages/pricing/vitest.config.ts',
      'packages/ui/vitest.config.ts',
      'apps/web/vitest.config.ts',
      'tools/vitest.config.ts',
    ],
  },
});
