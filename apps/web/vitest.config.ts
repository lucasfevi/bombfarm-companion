import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
      '@bombfarm/domain': path.resolve(root, '../../packages/domain/src'),
      '@bombfarm/ui': path.resolve(root, '../../packages/ui/src'),
    },
  },
});
