import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

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
