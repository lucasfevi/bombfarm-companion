import eslint from '@eslint/js';
import path from 'node:path';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintPluginTailwindcss from 'eslint-plugin-tailwindcss';

/** Absolute Tailwind v4 entry — packages/ui lint cwd is not the repo root. */
const webTailwindCss = path.join(import.meta.dirname, 'apps/web/src/app/globals.css');

/** Companion-native packages keep the pre-merge strict typed lint bar. */
const companionNativePackages = [
  'packages/contracts/**/*.{ts,tsx}',
  'packages/game-data/**/*.{ts,tsx}',
  'packages/pricing/**/*.{ts,tsx}',
];

/** Planner-origin packages (`domain`, `ui`) — recommendedTypeChecked; see docs/typescript-planner-origin.md */
const plannerOriginPackages = [
  'packages/domain/**/*.{ts,tsx}',
  'packages/ui/**/*.{ts,tsx}',
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/.next/**',
      '**/release/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
      // Stories/tests are excluded from package tsconfigs; lint via Storybook/web Vitest instead.
      'packages/ui/**/*.stories.{ts,tsx}',
      'packages/ui/**/*.{test,spec}.{ts,tsx}',
    ],
  },
  eslint.configs.recommended,
  {
    files: companionNativePackages,
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: plannerOriginPackages,
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/desktop/src/**/*.ts', 'apps/desktop/renderer/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './apps/desktop/tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}', 'apps/desktop/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    plugins: { tailwindcss: eslintPluginTailwindcss },
    settings: {
      tailwindcss: {
        // Web app owns the Tailwind v4 entry; recipes in packages/ui are scanned from there.
        cssConfigPath: webTailwindCss,
      },
    },
    rules: {
      // Prefer named Tailwind utilities over equivalent arbitrary values
      // (e.g. tracking-[0.05em] → tracking-wider). Autofixable.
      'tailwindcss/no-unnecessary-arbitrary-value': 'error',
    },
  },
  {
    files: ['apps/desktop/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['apps/desktop/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
