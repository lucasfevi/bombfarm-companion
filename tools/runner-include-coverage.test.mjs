/**
 * The newest instance of this repo's green-without-executing family, and the one that needs no
 * mistake to trigger: a `*.test.*` file that no runner's include glob reaches simply never runs.
 * Nothing fails, nothing is reported, and the file reads as covered forever. Two did exactly that
 * — `apps/web/e2e/perf/aggregate.test.ts` and a sibling that imported a helper this repo has
 * never contained — because `apps/web/vitest.config.ts` includes only `src/`, and no other config
 * picks up `e2e/`. A test that never ran is not evidence.
 *
 * This guard owns the `*.test.*` half of the family. `playwright-spec-enumeration.test.mjs` owns
 * the `*.spec.*` half: Playwright specs are enumerated in `testMatch` or swept by a `testDir`, a
 * different mechanism with a different failure, and that guard asserts the enumeration equals the
 * directory listing. Neither widens into the other's half; a spec that is in neither guard's reach
 * is a gap to report, not to quietly absorb here.
 *
 * The derivation lives in `runner-scan-roots.mjs`, with the scan-root derivation its two sibling
 * guards already share, so the runner configs are parsed once for all three.
 */
import { describe, expect, it } from 'vitest';
import {
  collectingRunners,
  deriveRunnerIncludes,
  globToRegExp,
  parseIncludeGlobs,
  parseProjectList,
  trackedTestFiles,
} from './runner-scan-roots.mjs';

/**
 * Floors, not counts. A count would red on every added test file and be bumped without reading,
 * which is how a non-vacuity assertion becomes a chore; a floor only reds when the derivation has
 * stopped finding things, which is the failure worth catching. 891 tracked `*.test.*` files and 16
 * runners today — the file floor sits below that with room for ordinary deletion, the runner floor
 * sits exactly at it because every one of the sixteen is load-bearing and dropping one must red.
 */
const TRACKED_TEST_FILE_FLOOR = 850;
const RUNNER_FLOOR = 16;

const runners = deriveRunnerIncludes();
const testFiles = trackedTestFiles();

describe('every tracked test file is collected by some runner', () => {
  it('non-vacuity: the tracked-test-file sweep finds files, not an empty set', () => {
    expect(
      testFiles.length,
      `tracked *.test.* files found: ${testFiles.length}. A floor, not a count — well below it means ` +
        `the git sweep or the filename pattern has stopped working, and a guard that matches nothing passes.`,
    ).toBeGreaterThanOrEqual(TRACKED_TEST_FILE_FLOOR);
  });

  it('non-vacuity: the fifteen projects and the solver pass are all derived', () => {
    const configs = runners.map((runner) => runner.config);
    expect(
      configs.length,
      `derived runners: ${configs.join(', ')}. The solver pass is not optional — packages/domain ` +
        `excludes the solver file list, so those files are collected by vitest.solver.config.ts alone ` +
        `and dropping it returns them as false orphans.`,
    ).toBeGreaterThanOrEqual(RUNNER_FLOOR);
    expect(new Set(configs).size, `a runner is derived twice: ${configs.join(', ')}`).toBe(configs.length);
  });

  it('every runner contributes at least one collected file', () => {
    const collectsNothing = runners
      .filter((runner) => !testFiles.some((file) => collectingRunners(file, [runner]).length > 0))
      .map((runner) => `${runner.config} (base ${runner.base}, globs ${runner.include.join(' ')})`);
    expect(
      collectsNothing,
      `a runner whose include globs match no tracked test file — either its globs were mis-parsed or ` +
        `its project has no tests left: ${collectsNothing.join('; ')}`,
    ).toEqual([]);
  });

  it('no tracked test file falls outside every runner include', () => {
    const orphans = testFiles.filter((file) => collectingRunners(file, runners).length === 0);
    expect(
      orphans,
      `these tracked test files are matched by no runner's include glob, so they never run anywhere ` +
        `and report nothing: ${orphans.join(', ')}. Either add a glob that reaches them, move them under ` +
        `one that does, or delete them — a test that never ran is not evidence. Runners checked: ` +
        `${runners.map((runner) => runner.config).join(', ')}.`,
    ).toEqual([]);
  });
});

describe('the derivation fails loudly rather than narrowing', () => {
  it('a root config with no parseable projects array throws instead of returning nothing', () => {
    expect(() => parseProjectList('export default defineConfig({ test: { maxWorkers: 2 } });')).toThrow(
      /projects: \[ \.\.\. \] array/,
    );
    expect(() => parseProjectList('export default defineConfig({ test: { projects: [] } });')).toThrow(
      /parsed as empty/,
    );
  });

  it('a project config with no parseable include throws instead of being skipped', () => {
    expect(() => parseIncludeGlobs('packages/x/vitest.config.ts', 'export default defineConfig({ test: {} });')).toThrow(
      /declares no include/,
    );
    expect(() => parseIncludeGlobs('packages/x/vitest.config.ts', 'include: [],')).toThrow(/parsed as empty/);
  });

  it('a comment between two include globs does not swallow the glob after it', () => {
    const globs = parseIncludeGlobs(
      'packages/x/vitest.config.ts',
      "include: [\n  'src/**/*.test.ts',\n  // a note about the next one\n  'renderer/lib/**/*.test.ts',\n],",
    );
    expect(globs).toEqual(['src/**/*.test.ts', 'renderer/lib/**/*.test.ts']);
  });

  it('a recursive wildcard matches zero intervening segments as well as several', () => {
    const pattern = globToRegExp('src/**/*.test.ts');
    expect(pattern.test('src/thing.test.ts')).toBe(true);
    expect(pattern.test('src/a/b/thing.test.ts')).toBe(true);
    expect(pattern.test('src/thing.test.tsx')).toBe(false);
    expect(pattern.test('e2e/thing.test.ts')).toBe(false);
  });

  it('glob syntax this translator does not implement throws rather than being approximated', () => {
    expect(() => globToRegExp('**/*.{test,spec}.ts')).toThrow(/not translated here/);
  });

  it('red state demonstrated: a path under a runner root that no glob reaches is reported', () => {
    expect(collectingRunners('packages/domain/src/not-collected-anywhere.test.ts', runners)).toEqual([]);
    expect(collectingRunners('apps/web/src/tests/derive.test.ts', runners)).toEqual(['apps/web/vitest.config.ts']);
  });
});
