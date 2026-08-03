import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/nextjs';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const uiSrc = path.resolve(webRoot, '../../../packages/ui/src');

const config: StorybookConfig = {
  stories: [
    {
      directory: uiSrc,
      files: '**/*.stories.@(ts|tsx)',
    },
  ],
  addons: ['@storybook/addon-essentials', '@storybook/addon-links'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: [],
  webpackFinal: async (webpackConfig) => {
    webpackConfig.resolve = webpackConfig.resolve ?? {};
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      '@bombfarm/ui': uiSrc,
      '@bombfarm/domain': path.resolve(webRoot, '../../../packages/domain/src'),
      '@/shared/design-system': uiSrc,
      '@/shared/lib/cn': path.join(uiSrc, 'cn.ts'),
      '@/shared/lib/escape-reg-exp': path.join(uiSrc, 'escape-reg-exp.ts'),
      '@/shared/lib/mask-reveal': path.join(uiSrc, 'mask-reveal.ts'),
    };
    return webpackConfig;
  },
};

export default config;
