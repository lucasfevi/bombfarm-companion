/**
 * Which packages a diff reaches, for `check-changed.mjs`. Pure, so the decision is testable
 * without a git repository behind it.
 */

/**
 * A change to any of these reaches every package, so the diff says nothing about which ones to
 * skip. Everything else outside a workspace package (docs, workflows, `.changeset`) is covered by
 * the `tools` guards or by nothing at all.
 */
export const WIDENS_TO_EVERYTHING = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  'tsconfig.base.json',
  'eslint.config.mjs',
  'vitest.config.ts',
  'vitest.workers.ts',
  'tools/cpu-budget.mjs',
  'tools/require-workspace-dist.mjs',
];

/**
 * @param {string[]} files repo-relative, forward slashes
 * @param {string[]} packageDirs repo-relative workspace package directories, e.g. `packages/farm`
 */
export function scopeOfChange(files, packageDirs) {
  const widened = files.filter((file) => WIDENS_TO_EVERYTHING.includes(file));
  const changedPackageDirs = packageDirs.filter((dir) => files.some((file) => file.startsWith(`${dir}/`)));
  return { everything: widened.length > 0, widened, changedPackageDirs };
}

/** pnpm's "this package and everything that depends on it" selector, one per changed package. */
export function dependentsFilters(packageDirs) {
  return packageDirs.map((dir) => `--filter "...{${dir}}"`).join(' ');
}
