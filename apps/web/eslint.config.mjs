import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactCompiler from 'eslint-plugin-react-compiler';
import unicorn from 'eslint-plugin-unicorn';
import boundaries from 'eslint-plugin-boundaries';
import eslintPluginTailwindcss from 'eslint-plugin-tailwindcss';

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
      '**/.next/**',
      '**/.next-dev/**',
      '**/node_modules/**',
      '**/out/**',
      '**/next-env.d.ts',
      '**/coverage/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-compiler': reactCompiler,
      unicorn,
      boundaries,
      tailwindcss: eslintPluginTailwindcss,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
      },
      tailwindcss: {
        // Tailwind v4 entry — required by eslint-plugin-tailwindcss@4.
        cssConfigPath: './src/app/globals.css',
      },
      // Folder-mode patterns match the element folder (right-to-left); children inherit.
      // Use path suffixes without requiring a full-root match (plugin default).
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        {
          type: 'feature',
          pattern: 'src/features/*',
          capture: ['feature'],
        },
        // Design-system + domain live in workspace packages (@bombfarm/ui, @bombfarm/domain)
        // and are treated as external modules (see allow external policy below). CIV-DEBT-02.
        { type: 'shared-game-art', pattern: 'src/shared/game-art' },
        { type: 'shared-context', pattern: 'src/shared/context' },
        { type: 'shared-stores', pattern: 'src/shared/stores' },
        { type: 'shared-i18n', pattern: 'src/shared/i18n' },
        { type: 'shared-lib', pattern: 'src/shared/lib' },
        { type: 'shared-hooks', pattern: 'src/shared/hooks' },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactCompiler.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      'react-hooks/exhaustive-deps': 'warn',
      // Prefer named Tailwind utilities over equivalent arbitrary values
      // (e.g. tracking-[0.05em] → tracking-wider). Autofixable.
      'tailwindcss/no-unnecessary-arbitrary-value': 'error',
      // W6: no component defined inside another component's render.
      'react/no-unstable-nested-components': 'error',
      'react/forbid-dom-props': nativeTooltipRule,
      // W4: bare usePlannerStore() subscribes to the entire store — always pass a selector.
      // selectAdvisorPipeline is intentionally used WITHOUT useShallow — it returns
      // stable identity on cache hits; shallow compare would defeat it.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='usePlannerStore'][arguments.length=0]",
          message:
            'Bare usePlannerStore() is forbidden. Pass a selector, e.g. usePlannerStore(selectHeroes).',
        },
      ],
      // W1 guardrail — warn in W1; W7 flips to error.
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
      // W1 guardrail — warn in W1; W7 flips to error.
      // W7 id-length exceptions (reviewed, minimal — see size-ledger/spec):
      //   'cn'  — classnames-merge helper (@/shared/lib/cn); clsx/tailwind-merge-ecosystem
      //           convention, imported at 60+ call sites across every component tree level.
      //           Renaming the export is pure mechanical churn with no readability gain and
      //           would touch nearly every design-system/feature component for zero benefit.
      //   'en', 'pt' — i18n namespace language exports (shared/i18n/namespaces/*, strings.ts);
      //           these ARE the `Lang` codes ('pt' | 'en') the whole i18n module is keyed by —
      //           already fully self-documenting in context, and renaming would touch every
      //           mirrored namespace file's declaration plus every aggregation site in
      //           strings.ts for the same zero-benefit trade as `cn`.
      'id-length': [
        'error',
        {
          min: 3,
          properties: 'never',
          exceptions: ['_', 'cn', 'en', 'pt'],
        },
      ],
      // A companion guardrail. `id-length` uses min:3, so it is blind to 3-letter
      // abbreviations like `fmt`/`idx`/`cmp` — which the spec named ("`fmt` →
      // spelled format helpers", "loop counters → `index`") but no rule caught.
      // Each name below is at zero occurrences in non-test `src/`; the denylist
      // keeps it that way. Declarations only, so external data fields such as
      // the JSON catalog's `rarity.idx` are unaffected.
      'id-denylist': [
        'error',
        'fmt',
        'idx',
        'cmp',
        'mul',
        'dir',
        'tmp',
        'res',
        'req',
        'cfg',
        'cnt',
        'acc',
        'amt',
        'qty',
        'tot',
        'lbl',
        'txt',
        'ctx',
        'prev',
        'def',
        'cur',
        'opts',
        'avg',
        'str',
        'arr',
        'val',
        'msg',
        'img',
        'btn',
        'elem',
        'obj',
        'num',
        'len',
        'pos',
        'evt',
        'attr',
        'desc',
        'src',
        'dst',
        'buf',
      ],
      // W1 guardrail — warn in W1; W7 flips to error (residuals allowlisted below).
      'max-lines': [
        'error',
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      // W5: ≤8 props — enforced by src/tests/mod-17-max-props.test.ts
      // (warn-equivalent allowlist for DS Switch/Select; W7 burns allowlist).
      // Cross-feature allowlist is four dated edges only (Approach A / Q-1).
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          policies: [
            // app → features → shared (+ workspace packages via external)
            {
              from: { element: { type: 'app' } },
              allow: {
                to: {
                  element: {
                    type: [
                      'feature',
                      'shared-game-art',
                      'shared-context',
                      'shared-stores',
                      'shared-i18n',
                      'shared-lib',
                      'shared-hooks',
                    ],
                  },
                },
              },
            },
            // feature → shared only (cross-feature denied by default)
            {
              from: { element: { type: 'feature' } },
              allow: {
                to: {
                  element: {
                    type: [
                      'shared-game-art',
                      'shared-context',
                      'shared-stores',
                      'shared-i18n',
                      'shared-lib',
                      'shared-hooks',
                    ],
                  },
                },
              },
            },
            // Allowlisted cross-feature edge — retires in W5/W6 (build-column → SlotEditor)
            {
              from: { element: { type: 'feature', captured: { feature: 'planner' } } },
              allow: {
                to: { element: { type: 'feature', captured: { feature: 'gear' } } },
              },
            },
            // Allowlisted cross-feature edge — retires in W5/W6 (build-column/tabs → AccountColumn)
            {
              from: { element: { type: 'feature', captured: { feature: 'planner' } } },
              allow: {
                to: { element: { type: 'feature', captured: { feature: 'account' } } },
              },
            },
            // Allowlisted cross-feature edge — retires in W6 (hero-strip → HeroPickerDialog)
            {
              from: { element: { type: 'feature', captured: { feature: 'planner' } } },
              allow: {
                to: { element: { type: 'feature', captured: { feature: 'roster' } } },
              },
            },
            // Allowlisted cross-feature edge (phases-explorer connector → HeroPickerDialog): the
            // explorer's hero panel takes the picker as a slot, and this app fills it with the
            // same connector the planner strip opens.
            {
              from: { element: { type: 'feature', captured: { feature: 'phases' } } },
              allow: {
                to: { element: { type: 'feature', captured: { feature: 'roster' } } },
              },
            },
            // game-art → i18n / lib (DS + domain via @bombfarm/* externals)
            {
              from: { element: { type: 'shared-game-art' } },
              allow: {
                to: {
                  element: {
                    type: ['shared-game-art', 'shared-i18n', 'shared-lib'],
                  },
                },
              },
            },
            {
              from: { element: { type: 'shared-context' } },
              allow: {
                to: {
                  element: {
                    type: [
                      'shared-context',
                      'shared-stores',
                      'shared-i18n',
                      'shared-lib',
                    ],
                  },
                },
              },
            },
            {
              from: { element: { type: 'shared-stores' } },
              allow: {
                to: {
                  element: {
                    type: ['shared-stores', 'shared-i18n', 'shared-lib'],
                  },
                },
              },
            },
            {
              from: { element: { type: 'shared-i18n' } },
              allow: {
                to: {
                  element: { type: ['shared-i18n', 'shared-lib'] },
                },
              },
            },
            {
              from: { element: { type: 'shared-lib' } },
              allow: {
                to: {
                  element: { type: ['shared-lib'] },
                },
              },
            },
            {
              from: { element: { type: 'shared-hooks' } },
              allow: {
                to: {
                  element: {
                    type: ['shared-hooks', 'shared-stores', 'shared-i18n', 'shared-lib'],
                  },
                },
              },
            },
            // Workspace packages (@bombfarm/ui, @bombfarm/domain) + npm deps
            {
              allow: { to: { module: { origin: 'external' } } },
            },
          ],
        },
      ],
      // Public API barrels + the design-system recipe carve-out (Q-5).
      'boundaries/entry-point': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              target: { element: { type: 'feature' } },
              allow: 'index.{ts,tsx}',
            },
            {
              // The recipe and every component now live in @bombfarm/game-art (a workspace
              // package, reached as an external module); this folder is just the re-export barrel.
              target: { element: { type: 'shared-game-art' } },
              allow: 'index.{ts,tsx}',
            },
            {
              target: {
                element: {
                  type: [
                    'shared-i18n',
                    'shared-lib',
                    'shared-context',
                    'shared-stores',
                    'shared-hooks',
                  ],
                },
              },
              allow: '**',
            },
            {
              target: { element: { type: 'app' } },
              allow: '*',
            },
          ],
        },
      ],
    },
  },
  // Tests excluded from id-length.
  // Tests may deep-import internals under frozen assertions; stories too.
  {
    files: [
      'src/**/__tests__/**',
      'src/tests/**',
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.stories.{ts,tsx}',
    ],
    rules: {
      'id-length': 'off',
      // The same scope carve-out as `id-length`: conventions apply to non-test `src/`.
      'id-denylist': 'off',
      'boundaries/element-types': 'off',
      'boundaries/entry-point': 'off',
    },
  },
  // Feature/UI components ≤200 (tighter than the 300 hard cap).
  {
    files: ['src/features/**/components/**/*.{ts,tsx}', 'src/app/_shell/**/*.{ts,tsx}'],
    ignores: ['src/**/use-*.ts'],
    rules: {
      'max-lines': [
        'error',
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  // Hooks ≤150.
  {
    files: ['src/**/use-*.ts'],
    rules: {
      'max-lines': [
        'error',
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  // W7 max-lines allowlist (error-flip residual, reviewed historically):
  //
  // src/tests/** — Vitest suites for gear/import-save/model/stat-breakdown/storage-i18n
  // legitimately run long (comprehensive fixture-driven assertions covering every branch
  // of the domain math they lock down). Splitting a test file is not W7 scope (no task
  // covers it) and touching assertions to "shrink" a suite is forbidden. Current max
  // observed (ESLint count, skipBlank/skipComments): storage-i18n.test.ts at 644 lines.
  // Raised cap, not disabled — a genuinely runaway test file still trips this.
  {
    files: ['src/tests/**'],
    rules: {
      'max-lines': ['error', { max: 650, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['*.{mjs,js}', 'vitest.config.ts', 'next.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Grandfathered native `title` tooltips, all of them predating the ban. Burn-down: delete an
  // entry once that file shows the same text through the DS Tooltip instead. Any NEW web file
  // errors. The overflow-reveal ones (`truncate` / `whitespace-nowrap` spans showing a hero,
  // ability or map name) and the exact-figure ones in hero-strip-metrics — which is what
  // `AbbreviatedNumber` already does properly — are the whole list.
  {
    files: [
      'src/app/_shell/site-header.tsx',
      'src/features/planner/components/hero-abilities-tab.tsx',
      'src/features/planner/components/hero-strip-identity.tsx',
      'src/features/planner/components/hero-strip-metrics.tsx',
    ],
    rules: { 'react/forbid-dom-props': 'off' },
  },
  // Grandfathered raw react-icons call sites. Burn-down: delete
  // entries as planner features migrate to <Icon />. Any NEW web file errors.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/app/_shell/site-header.tsx',
      'src/app/_shell/footer.tsx',
      'src/features/gear/components/slot-editor.tsx',
      'src/features/import/components/import-heroes-dialog.tsx',
      'src/features/planner/components/hero-strip.tsx',
      'src/features/planner/components/hero-strip-identity.tsx',
    ],
    rules: {
      'no-restricted-imports': [
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
      ],
    },
  },
);
