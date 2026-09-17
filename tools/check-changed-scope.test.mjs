import { describe, expect, it } from 'vitest';
import { WIDENS_TO_EVERYTHING, dependentsFilters, scopeOfChange } from './check-changed-scope.mjs';

const PACKAGE_DIRS = ['apps/desktop', 'apps/web', 'packages/domain', 'packages/farm'];

describe('scopeOfChange', () => {
  it('names the packages the diff touches and leaves dependents to pnpm', () => {
    const scope = scopeOfChange(['packages/farm/src/index.ts', 'packages/farm/README.md'], PACKAGE_DIRS);
    expect(scope).toEqual({ everything: false, widened: [], changedPackageDirs: ['packages/farm'] });
  });

  it('does not mistake a sibling with a shared prefix for the changed package', () => {
    const scope = scopeOfChange(['packages/farm-extras/src/index.ts'], [...PACKAGE_DIRS, 'packages/farm-extras']);
    expect(scope.changedPackageDirs).toEqual(['packages/farm-extras']);
  });

  it('reaches no package for a docs-only or workflow-only diff', () => {
    const scope = scopeOfChange(['docs/machine-load.md', '.github/workflows/ci-web.yml', '.changeset/x.md'], PACKAGE_DIRS);
    expect(scope).toEqual({ everything: false, widened: [], changedPackageDirs: [] });
  });

  it.each(WIDENS_TO_EVERYTHING)('widens to every package when %s changes', (file) => {
    const scope = scopeOfChange([file, 'packages/farm/src/index.ts'], PACKAGE_DIRS);
    expect(scope.everything).toBe(true);
    expect(scope.widened).toEqual([file]);
  });

  it('does not widen on a package-local file that shares a root config name', () => {
    const scope = scopeOfChange(['apps/web/package.json', 'packages/domain/vitest.config.ts'], PACKAGE_DIRS);
    expect(scope.everything).toBe(false);
    expect(scope.changedPackageDirs).toEqual(['apps/web', 'packages/domain']);
  });
});

describe('dependentsFilters', () => {
  it('asks pnpm for each changed package and everything that depends on it', () => {
    expect(dependentsFilters(['packages/farm', 'apps/web'])).toBe('--filter "...{packages/farm}" --filter "...{apps/web}"');
  });
});
