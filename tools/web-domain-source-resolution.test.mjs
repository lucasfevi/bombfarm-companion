import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TSCONFIG_PATH = resolve(root, 'apps/web/tsconfig.json');
const VITEST_CONFIG_PATH = resolve(root, 'apps/web/vitest.config.ts');
const NEXT_CONFIG_PATH = resolve(root, 'apps/web/next.config.ts');

/**
 * `AD-032` flips `@bombfarm/domain`'s own `exports` map to `dist/`. `AD-034` keeps `apps/web`
 * on **source** resolution instead — the public planner's production build runs on Vercel,
 * which (`AD-020`) never builds workspace packages, and `dist/` is gitignored. Web reaches
 * domain source through three independent entries that shadow the package's own `exports` map
 * entirely: `apps/web/tsconfig.json`'s `paths` (TypeScript, and — via `JsConfigPathsPlugin` —
 * Next's webpack/Turbopack too), `apps/web/vitest.config.ts`'s `resolve.alias`, and
 * `apps/web/next.config.ts`'s `transpilePackages`.
 *
 * Before F1 these were a convenience. After F1 they are the ONLY thing standing between an
 * `exports`-map change and a broken production deploy — removing any one of them silently
 * moves the public planner onto `packages/domain/dist`, a directory Vercel's build never
 * produces. This guard exists so that removal fails a check instead of a deploy.
 *
 * Source-text assertions, not a tsconfig/AST parse — matches the existing convention in
 * `tools/design-system-gate.test.mjs` and `tools/ci-desktop-paths.test.mjs`.
 */
const REMOVAL_WARNING =
  'Removing this entry moves the PUBLIC PLANNER onto packages/domain/dist, a directory ' +
  "Vercel's production build (AD-020) never produces — dist/ is gitignored and Vercel runs a " +
  'plain `next build` with no workspace-package build step. See AD-032 (the exports flip that ' +
  "made these entries load-bearing) and AD-034 (the decision to keep apps/web on domain's " +
  'source instead of migrating it to dist).';

describe('apps/web stays on @bombfarm/domain SOURCE resolution (AD-034)', () => {
  it(`apps/web/tsconfig.json's "paths" still maps @bombfarm/domain to packages/domain/src. ${REMOVAL_WARNING}`, () => {
    const text = readFileSync(TSCONFIG_PATH, 'utf8');
    const tsconfig = JSON.parse(text);
    const paths = tsconfig.compilerOptions?.paths ?? {};

    expect(paths['@bombfarm/domain']).toBeDefined();
    expect(paths['@bombfarm/domain'][0]).toContain('packages/domain/src');
    expect(paths['@bombfarm/domain/*']).toBeDefined();
    expect(paths['@bombfarm/domain/*'][0]).toContain('packages/domain/src');
  });

  it(`apps/web/vitest.config.ts's resolve.alias still maps @bombfarm/domain to packages/domain/src. ${REMOVAL_WARNING}`, () => {
    const text = readFileSync(VITEST_CONFIG_PATH, 'utf8');
    // Source-text assertion (not an AST parse): the alias key/value pair must both be present,
    // literally, in the file — matching the repo's existing tools/*.test.mjs convention.
    expect(text).toMatch(/['"]@bombfarm\/domain['"]\s*:\s*path\.resolve\([^)]*\)/);
    const aliasLineMatch = text.match(/['"]@bombfarm\/domain['"]\s*:\s*path\.resolve\(([^)]*)\)/);
    expect(aliasLineMatch, 'expected an @bombfarm/domain alias entry').not.toBeNull();
    expect(aliasLineMatch[1]).toContain('packages/domain/src');
  });

  it(`apps/web/next.config.ts's transpilePackages still lists @bombfarm/domain. ${REMOVAL_WARNING}`, () => {
    const text = readFileSync(NEXT_CONFIG_PATH, 'utf8');
    const transpileMatch = text.match(/transpilePackages:\s*\[([^\]]*)\]/);
    expect(transpileMatch, 'expected a transpilePackages array in apps/web/next.config.ts').not.toBeNull();
    expect(transpileMatch[1]).toMatch(/['"]@bombfarm\/domain['"]/);
  });
});
