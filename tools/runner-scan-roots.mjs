/**
 * One derivation of "everywhere a test can live", shared by the two halves of the skip family:
 * the static directive census (`fixture-corpus-parity.test.mjs`) and the runtime regime-hold
 * manifest (`held-suite-manifest.test.mjs`). They used to hand-list their roots separately, and a
 * suite held in a package only one of them reached fell between them, invisible to both.
 *
 * Node builtins only, so both consumers import it without a build step.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const CODE_FILE = /\.(ts|tsx|mts|cts|mjs|cjs|js)$/;
export const TS_SOURCE_FILE = /\.tsx?$/;

export function trackedFiles(...pathspecs) {
  return execFileSync('git', ['ls-files', '--', ...pathspecs], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

function containingDir(repoPath) {
  const dir = posix.dirname(repoPath);
  if (dir === '.' || dir === '/' || dir === repoPath) {
    throw new Error(`${repoPath}: expected a path with a containing directory, got none`);
  }
  return dir;
}

export function deriveVitestRoots() {
  const source = readFileSync(join(REPO_ROOT, 'vitest.config.ts'), 'utf8');
  const projects = /projects:\s*\[([^\]]*)\]/.exec(source);
  if (!projects) {
    throw new Error('vitest.config.ts no longer has a projects: [ ... ] array, so the scan roots cannot be derived');
  }
  const entries = projects[1]
    .split(',')
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
  if (entries.length === 0) throw new Error('vitest.config.ts: the projects array parsed as empty');
  return [...new Set(entries.map(containingDir))].sort();
}

export function derivePlaywrightTestDirs() {
  const configs = trackedFiles('*playwright.config.ts');
  if (configs.length === 0) throw new Error('no tracked playwright.config.ts, so no e2e root can be derived');
  const found = [];
  for (const config of configs) {
    const source = readFileSync(join(REPO_ROOT, config), 'utf8');
    const dirs = [...source.matchAll(/testDir:\s*'([^']+)'/g)].map((match) => match[1]);
    if (dirs.length === 0) throw new Error(`${config} declares no testDir, so its suites would go unscanned`);
    for (const dir of dirs) found.push({ config, dir: posix.normalize(posix.join(containingDir(config), dir)) });
  }
  return found;
}

export function isUnder(path, dir) {
  return path === dir || path.startsWith(`${dir}/`);
}

/**
 * Tracked only: a sibling guard writes an untracked probe spec mid-run, and a concurrent guard's
 * scratch file is neither census offender nor held suite.
 */
export function trackedFilesUnderRunnerRoots(pattern = CODE_FILE, roots = deriveVitestRoots()) {
  return trackedFiles(...roots).filter((file) => pattern.test(file));
}
