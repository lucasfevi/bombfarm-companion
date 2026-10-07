/**
 * One derivation of "everywhere a test can live", shared by the two halves of the skip family:
 * the static directive census (`fixture-corpus-parity.test.mjs`) and the runtime regime-hold
 * manifest (`held-suite-manifest.test.mjs`). They used to hand-list their roots separately, and a
 * suite held in a package only one of them reached fell between them, invisible to both.
 *
 * `deriveRunnerIncludes` answers the sharper question the roots cannot: not "which directories
 * could hold a test" but "which files does a runner actually collect". A directory can be a
 * derived root and still contain a test file no include glob reaches — that file runs nowhere
 * and reports nothing, which is how two perf suites sat uncollected since the monorepo merge.
 * It lives here rather than in its guard so the roots and the globs come from one parse of the
 * same configs; `runner-include-coverage.test.mjs` consumes it.
 *
 * Node builtins only, so every consumer imports it without a build step.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOLVER_TEST_FILES } from '../vitest.solver-files.mjs';

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

/**
 * Quoted string literals, not comma-separated fields: `apps/desktop/vitest.config.ts` keeps a
 * `//` comment line between two of its include globs, and splitting on commas glues that comment
 * onto the glob after it — which silently drops four real globs and makes their files look
 * uncollected. Comments are skipped by scanning OUTSIDE string literals rather than by stripping
 * them first, because a recursive-wildcard glob contains a slash-star-star-slash run that a
 * comment-stripping pass reads as an empty block comment — measured: it truncated every
 * `src/<recursive>/*.test.ts` glob to `src*.test.ts` and produced 820 false orphans.
 */
function quotedStrings(arrayBody) {
  const found = [];
  for (let i = 0; i < arrayBody.length; i += 1) {
    const char = arrayBody[i];
    if (char === '/' && arrayBody[i + 1] === '/') {
      const lineEnd = arrayBody.indexOf('\n', i);
      if (lineEnd === -1) break;
      i = lineEnd;
    } else if (char === '/' && arrayBody[i + 1] === '*') {
      const blockEnd = arrayBody.indexOf('*/', i + 2);
      if (blockEnd === -1) break;
      i = blockEnd + 1;
    } else if (char === "'" || char === '"') {
      const close = arrayBody.indexOf(char, i + 1);
      if (close === -1) throw new Error(`unterminated string literal in: ${arrayBody.trim()}`);
      found.push(arrayBody.slice(i + 1, close));
      i = close;
    }
  }
  return found.filter(Boolean);
}

export function parseProjectList(source) {
  const projects = /projects:\s*\[([^\]]*)\]/.exec(source);
  if (!projects) {
    throw new Error('vitest.config.ts no longer has a projects: [ ... ] array, so the scan roots cannot be derived');
  }
  const entries = quotedStrings(projects[1]);
  if (entries.length === 0) throw new Error('vitest.config.ts: the projects array parsed as empty');
  return entries;
}

function vitestProjectConfigs() {
  return parseProjectList(readFileSync(join(REPO_ROOT, 'vitest.config.ts'), 'utf8'));
}

export function deriveVitestRoots() {
  return [...new Set(vitestProjectConfigs().map(containingDir))].sort();
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

export const TEST_FILE = /\.test\.[a-z]+$/;

export function trackedTestFiles() {
  return trackedFiles().filter((file) => TEST_FILE.test(file));
}

/**
 * Only the glob syntax the configs actually use, and anything else throws rather than being
 * approximated: a brace set or an extglob silently mis-translated here would hand the coverage
 * guard a glob that matches too much, and over-matching is the one failure mode that looks green.
 * A recursive wildcard followed by a slash collapses to ZERO or more segments, not one or more:
 * 85 of the repo's test files sit directly in a `src/` whose only include glob is the recursive
 * one, and requiring a segment there reports every one of them as an orphan.
 */
export function globToRegExp(glob) {
  if (/[{}()[\]!]/.test(glob)) {
    throw new Error(`${glob}: brace, extglob and character-class syntax are not translated here — teach this function before using one`);
  }
  let pattern = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*' && glob[i + 2] === '/') {
      pattern += '(?:[^/]+/)*';
      i += 2;
    } else if (char === '*' && glob[i + 1] === '*') {
      pattern += '.*';
      i += 1;
    } else if (char === '*') {
      pattern += '[^/]*';
    } else if (char === '?') {
      pattern += '[^/]';
    } else {
      pattern += char.replace(/[.+^$|\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function parseIncludeGlobs(config, source) {
  const include = /include:\s*\[([\s\S]*?)\]/.exec(source);
  if (!include) {
    throw new Error(
      `${config} declares no include: [ ... ], so vitest's own default include applies and this derivation does not know it — declare the globs in the config, or teach this function the default`,
    );
  }
  const globs = quotedStrings(include[1]);
  if (globs.length === 0) throw new Error(`${config}: the include array parsed as empty`);
  return globs;
}

/**
 * `exclude` is honoured, not just `include`, because an exclusion is the quieter way for a file to
 * stop running: `packages/domain/vitest.config.ts` excludes the solver list, and those four files
 * are collected by `vitest.solver.config.ts` alone. An include-only derivation would call them
 * covered by the domain project that in fact skips them, and would stay green if the solver pass
 * ever left `pnpm test`.
 *
 * `configDefaults.exclude` is the one spread deliberately not expanded: it names only vendor and
 * build directories and config filenames, none of which a tracked `*.test.*` path can be. Any
 * other unresolved spread throws rather than being dropped, because a dropped exclusion widens
 * the derived coverage and a guard that over-counts coverage passes while guarding nothing.
 */
export function parseExcludeGlobs(config, source) {
  const exclude = /exclude:\s*\[([\s\S]*?)\]/.exec(source);
  if (!exclude) return [];
  const globs = quotedStrings(exclude[1]);
  for (const [, spread] of exclude[1].matchAll(/\.\.\.([A-Za-z_$][\w$.]*)/g)) {
    if (spread === 'configDefaults.exclude') continue;
    if (spread === 'SOLVER_TEST_FILES') {
      globs.push(...SOLVER_TEST_FILES);
      continue;
    }
    throw new Error(`${config}: exclude spreads ${spread}, which this derivation cannot resolve — teach it before relying on it`);
  }
  return globs;
}

/**
 * The solver pass is a sixteenth runner, not an optional extra. `packages/domain/vitest.config.ts`
 * EXCLUDES the solver file list, so those files are collected by `vitest.solver.config.ts` alone —
 * leave it out and they come back as orphans that in fact run on every `pnpm test`. Its include is
 * the imported list rather than literals, so the shape is asserted and the list imported.
 */
function solverRunner() {
  const config = 'vitest.solver.config.ts';
  const source = readFileSync(join(REPO_ROOT, config), 'utf8');
  if (!/include:\s*\[\.\.\.SOLVER_TEST_FILES\]/.test(source)) {
    throw new Error(`${config}: include is no longer [...SOLVER_TEST_FILES], so its files cannot be derived from the list`);
  }
  const domainConfig = /import domainConfig from '([^']+)'/.exec(source);
  if (!domainConfig) throw new Error(`${config}: no domainConfig import, so the root its globs are relative to is unknown`);
  if (SOLVER_TEST_FILES.length === 0) throw new Error('the solver file list is empty');
  return {
    config,
    base: containingDir(posix.normalize(domainConfig[1].replace(/^\.\//, ''))),
    include: [...SOLVER_TEST_FILES],
    exclude: [],
  };
}

/**
 * One entry per runner: `{ config, base, include, exclude }`, every glob relative to `base`. A
 * project config's base is its own directory, which is where vitest roots a project that does not
 * set `root` and where every config that does set one points it anyway.
 */
export function deriveRunnerIncludes() {
  const projects = vitestProjectConfigs().map((config) => {
    const source = readFileSync(join(REPO_ROOT, config), 'utf8');
    return {
      config,
      base: containingDir(config),
      include: parseIncludeGlobs(config, source),
      exclude: parseExcludeGlobs(config, source),
    };
  });
  return [...projects, solverRunner()];
}

function collects(runner, file) {
  if (!isUnder(file, runner.base)) return false;
  const relative = file.slice(runner.base.length + 1);
  if (!runner.include.some((glob) => globToRegExp(glob).test(relative))) return false;
  return !runner.exclude.some((glob) => globToRegExp(glob).test(relative));
}

export function collectingRunners(file, runners = deriveRunnerIncludes()) {
  return runners.filter((runner) => collects(runner, file)).map((runner) => runner.config);
}
