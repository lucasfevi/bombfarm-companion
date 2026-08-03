import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@/shared/domain': path.resolve(root, './src'),
      '@/shared/lib/storage': path.resolve(root, './src/shims/storage.ts'),
      '@/shared/i18n': path.resolve(root, './src/shims/i18n.ts'),
      '@/tests': path.resolve(root, './tests'),
    },
  },
});
