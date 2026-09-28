/**
 * No package narrows its own lint run from its `package.json` script.
 *
 * A file excluded in `eslint.config.mjs` is excluded where reviewers read exclusions, next to the
 * comment saying why. A file excluded by `--ignore-pattern` on a package's own `lint` script is
 * excluded somewhere nobody looks, and the lint run still reports success over the smaller set —
 * the failure shape this repo keeps meeting: a check that quietly stops checking and stays green.
 *
 * It happened here. `packages/ui`'s DOM test harness is excluded from that package's `tsconfig.json`
 * so it cannot reach `dist/`, which left it in no TypeScript project, which made the type-aware
 * rules fail to parse it — and the repair was `--ignore-pattern src/dom-test-harness.ts` on the
 * `lint` script. Nothing failed, the harness was simply never linted. Giving the package a
 * `tsconfig.eslint.json` that includes the harness fixed it properly and immediately found a real
 * unnecessary type assertion inside it. This guard is what stops the shortcut coming back.
 *
 * Two legitimate routes remain, and both are visible: a package-level `tsconfig.eslint.json` so the
 * file lints with type information, or the repo-wide `ignores` list in `eslint.config.mjs`.
 *
 * Deliberately dumb reading of `package.json` scripts, the `tools/vitest-worker-cap.test.mjs`
 * convention — its subject is what a package owes the root TEST run, so this lives beside it
 * rather than inside it.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const PACKAGE_PARENTS = ['packages', 'apps'];

/**
 * Flags that remove files from a lint run. Only these: a flag that changes reporting or applies
 * fixes (`--max-warnings`, `--cache`, `--fix`) leaves coverage intact, so forbidding it would be
 * noise rather than a guard.
 */
const SCOPE_NARROWING_FLAGS = ['--ignore-pattern', '--ignore-path'];

/** The narrowing flags one script carries, in the order this guard names them. */
export function lintScopeNarrowingFlags(script) {
  return SCOPE_NARROWING_FLAGS.filter((flag) => new RegExp(`${flag}(?=[\\s=]|$)`).test(script));
}

function packageDirs() {
  const dirs = ['.'];
  for (const parent of PACKAGE_PARENTS) {
    for (const name of readdirSync(join(root, parent))) {
      if (existsSync(join(root, parent, name, 'package.json'))) dirs.push(`${parent}/${name}`);
    }
  }
  return dirs;
}

function lintScriptsOf(dir) {
  const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
  return Object.entries(manifest.scripts ?? {}).filter(([name]) => name === 'lint' || name.startsWith('lint:'));
}

/**
 * Every package that lints today. Asserted as a set rather than counted: a discovery walk that
 * stops matching, or a package that quietly loses its `lint` script, then fails here instead of
 * reporting zero offenders over nothing. A new package lints too — add it deliberately.
 */
const PACKAGES_THAT_LINT = [
  '.',
  'apps/desktop',
  'apps/web',
  'packages/account',
  'packages/contracts',
  'packages/domain',
  'packages/farm',
  'packages/game-api',
  'packages/game-art',
  'packages/game-data',
  'packages/hero',
  'packages/pricing',
  'packages/tap-runtime',
  'packages/team-plan',
  'packages/ui',
];

const scanned = packageDirs()
  .map((dir) => ({ dir, scripts: lintScriptsOf(dir) }))
  .filter((entry) => entry.scripts.length > 0);

describe('lint-scope hygiene — no package excludes files from its own lint run', () => {
  it('the scan found the lint scripts it should have (a green result over nothing proves nothing)', () => {
    expect(scanned.length).toBeGreaterThan(12);
    expect(scanned.map((entry) => entry.dir).sort()).toEqual([...PACKAGES_THAT_LINT].sort());
  });

  it('every package named here still exists and still carries a lint script', () => {
    const missing = PACKAGES_THAT_LINT.filter((dir) => !existsSync(join(root, dir, 'package.json')));
    expect(missing, 'named as linting but has no package.json').toEqual([]);
  });

  it('no lint script carries a flag that shrinks the file set it checks', () => {
    const offenders = scanned
      .flatMap(({ dir, scripts }) =>
        scripts.flatMap(([name, script]) =>
          lintScopeNarrowingFlags(script).map((flag) => `${dir} — "${name}": ${script}  [${flag}]`),
        ),
      )
      .sort();
    expect(
      offenders,
      'A lint script hides an exclusion where nobody reads it, and the run still passes over the ' +
        'smaller set. Put the exclusion where it is visible instead: give the package a ' +
        '`tsconfig.eslint.json` that includes the file (it then lints WITH type information), or ' +
        'add it to the `ignores` list in eslint.config.mjs with a comment saying why.',
    ).toEqual([]);
  });
});

describe('lint-scope hygiene — the scan discriminates', () => {
  it('red state: the exact shape it must catch', () => {
    expect(lintScopeNarrowingFlags('eslint src --ignore-pattern src/dom-test-harness.ts')).toEqual([
      '--ignore-pattern',
    ]);
    expect(lintScopeNarrowingFlags('eslint src --ignore-path .eslintignore')).toEqual(['--ignore-path']);
  });

  it('green state: a plain run, and flags that change reporting rather than coverage', () => {
    for (const script of [
      'eslint src',
      'eslint src --max-warnings 0',
      'eslint src --cache --fix',
      'pnpm --dir ../.. exec eslint apps/desktop/src apps/desktop/renderer',
      'node tools/with-cpu-budget.mjs pnpm -r lint && pnpm run lint:tools',
    ]) {
      expect(lintScopeNarrowingFlags(script), script).toEqual([]);
    }
  });

  it('a longer flag that merely starts with a forbidden one is not mistaken for it', () => {
    expect(lintScopeNarrowingFlags('eslint src --ignore-patterns-are-not-a-flag')).toEqual([]);
  });
});
