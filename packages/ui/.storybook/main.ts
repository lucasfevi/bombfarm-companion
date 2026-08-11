import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-links'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: [],
  // No `@bombfarm/domain` alias here — DS-09 forbids `packages/ui` importing domain.
  // `@bombfarm/ui` needs no alias either: stories live inside the package and resolve
  // relatively / via the workspace's own `@bombfarm/ui` -> `src` export map.
  async viteFinal(viteConfig) {
    // Dynamic `import()` (not a static top-level import) so this file — evaluated by
    // Storybook via esbuild-register's CJS bridge — resolves `@tailwindcss/vite` through
    // its ESM "import" export condition rather than a "require" condition it doesn't ship.
    const [{ mergeConfig }, { default: tailwindcss }] = await Promise.all([
      import('vite'),
      import('@tailwindcss/vite'),
    ]);
    return mergeConfig(viteConfig, {
      plugins: [tailwindcss()],
    });
  },
};

export default config;
