import eslint from '@eslint/js';
import path from 'node:path';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintPluginTailwindcss from 'eslint-plugin-tailwindcss';

/** Absolute Tailwind v4 entry — packages/ui lint cwd is not the repo root. */
const webTailwindCss = path.join(import.meta.dirname, 'apps/web/src/app/globals.css');

/** Companion-native packages keep the pre-merge strict typed lint bar. */
const companionNativePackages = [
  'packages/contracts/**/*.{ts,tsx}',
  'packages/game-api/**/*.{ts,tsx}',
  'packages/game-data/**/*.{ts,tsx}',
  'packages/pricing/**/*.{ts,tsx}',
  'packages/tap-runtime/**/*.{ts,tsx}',
];

/** Planner-origin packages (`domain`, `ui`) — recommendedTypeChecked; see docs/typescript-planner-origin.md */
const plannerOriginPackages = [
  'packages/domain/**/*.{ts,tsx}',
  'packages/ui/**/*.{ts,tsx}',
];

/**
 * `game-art` was extracted verbatim from `apps/web/src/shared/game-art/` (T5), which lints under
 * `recommendedTypeChecked` (`apps/web/eslint.config.mjs`) and never carried
 * `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` (`apps/web/tsconfig.json`). Same tier as
 * `plannerOriginPackages`, kept as its own list rather than folded in — that array is the literal
 * scope `docs/typescript-planner-origin.md` documents as exactly `domain`+`ui`, unchanged by T5.
 */
const gameArtPackage = ['packages/game-art/**/*.{ts,tsx}'];

/**
 * `farm` holds the shared farm screen, moved verbatim out of `apps/web/src/features/phases/` —
 * a tree that never carried `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess`. Same
 * relaxed tier as `gameArtPackage`, and its own list for the same reason.
 */
const farmPackage = ['packages/farm/**/*.{ts,tsx}'];

/** Ban raw react-icons / SVG imports outside the Icon seam (ICO-23, ICO-24, D12). */
const rawIconImportRule = [
  'error',
  {
    patterns: [
      {
        group: ['react-icons', 'react-icons/*'],
        message:
          'Import { Icon } from @bombfarm/ui instead (D12). react-icons is reachable only from packages/ui/src/icon/ui-registry.ts.',
      },
      {
        group: ['*.svg', '**/*.svg'],
        message:
          'Do not import SVG files into app/UI code. Use <Icon name="…" /> from @bombfarm/ui for chrome icons.',
      },
    ],
  },
];

/**
 * Ban the native `title` tooltip on DOM elements. `forbid-dom-props` and not a blanket prop ban:
 * `title` is a real prop on `PanelHeader`, `EmptyState`, `Banner` and `SettingsSection`.
 */
const nativeTooltipRule = [
  'error',
  {
    forbid: [
      {
        propName: 'title',
        message:
          'Native title tooltips are forbidden. Use the design-system Tooltip from @bombfarm/ui ' +
          '(Tooltip.Provider/Root/Trigger/Portal/Positioner/Popup) — the native one cannot be ' +
          'styled, ignores the theme, has an uncontrollable delay, and never appears on touch or ' +
          'for keyboard focus. See docs/design-system.md.',
      },
    ],
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/.next/**',
      '**/.next-dev/**',
      '**/release/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
      // Tests are excluded from package tsconfigs; lint via web Vitest instead.
      // Stories are excluded too, but stay linted — see the stories block below.
      'packages/ui/**/*.{test,spec}.{ts,tsx}',
      'packages/game-art/**/*.{test,spec}.{ts,tsx}',
      'packages/farm/**/*.{test,spec}.{ts,tsx}',
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
    files: gameArtPackage,
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: farmPackage,
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
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
    files: ['packages/ui/**/*.{ts,tsx}', 'packages/game-art/**/*.{ts,tsx}', 'packages/farm/**/*.{ts,tsx}', 'apps/desktop/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}', 'packages/game-art/**/*.{ts,tsx}', 'packages/farm/**/*.{ts,tsx}', 'apps/desktop/renderer/**/*.{ts,tsx}'],
    plugins: { react },
    rules: { 'react/forbid-dom-props': nativeTooltipRule },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}', 'packages/game-art/**/*.{ts,tsx}', 'packages/farm/**/*.{ts,tsx}'],
    plugins: { tailwindcss: eslintPluginTailwindcss },
    settings: {
      tailwindcss: {
        // Web app owns the Tailwind v4 entry; recipes in packages/ui, packages/game-art and
        // packages/farm are scanned from there.
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
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    ignores: ['packages/ui/src/icon/**'],
    rules: { 'no-restricted-imports': rawIconImportRule },
  },
  {
    files: ['apps/desktop/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': rawIconImportRule },
  },
  {
    files: ['packages/farm/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': rawIconImportRule },
  },
  // Stories sit outside packages/ui/tsconfig.json, so they cannot carry type-aware
  // rules — but the icon seam (D12) is syntactic and must hold for them too, or a raw
  // react-icons/SVG import lands in a story with only review to catch it. So stories
  // are linted (not ignored) with type checking off; the packages/ui blocks above,
  // including the raw-icon ban, apply to them.
  {
    files: ['packages/ui/**/*.stories.{ts,tsx}'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      // Stories size their demo frames to taste; arbitrary widths there are the point,
      // not drift from the token scale. Product code keeps this rule on.
      'tailwindcss/no-unnecessary-arbitrary-value': 'off',
    },
  },
);
