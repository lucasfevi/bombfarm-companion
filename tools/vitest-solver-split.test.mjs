/**
 * The domain test suite is split into two Vitest passes: the domain project, and the solver pass
 * (`vitest.solver.config.ts`) for the files with a SINGLE synchronous test body long enough to
 * cross Vitest's 60 s worker RPC window, with unhandled errors ignored — the config's own comment
 * says why. A file that is merely long in TOTAL is handled differently: the domain project yields
 * to the event loop after every test (`tests/helpers/yield-between-tests.ts`), so the window
 * applies per test body rather than per file. Four ways this silently stops working, each guarded
 * here:
 *
 * 1. The partition drifts — a file listed in both, in neither, or listed but gone from disk.
 * 2. `dangerouslyIgnoreUnhandledErrors` creeps back into another config, hiding real unhandled
 *    rejections there, or leaves the solver config, where the split needs it.
 * 3. A runner (`pnpm test`, the domain package script, `check-changed`, CI) runs the first pass
 *    and never the second, so the solver files stop executing while everything stays green.
 * 4. The per-test yield is unwired, or its behavioural guard inside the domain project is deleted.
 *
 * Deliberately dumb text slicing over the config sources and real `fs` walks, the
 * `tools/vitest-worker-cap.test.mjs` convention.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SOLVER_TEST_FILES } from '../vitest.solver-files.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SOLVER_CONFIG = 'vitest.solver.config.ts';
const SOLVER_FILES_MODULE = 'vitest.solver-files.mjs';
const DOMAIN_TESTS_DIR = 'packages/domain/tests';
const DOMAIN_TEST_FILES_FLOOR = 150;
const VITEST_CONFIGS_FLOOR = 15;
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'out', '.claude']);

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function walk(dir, keep, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) walk(join(dir, entry.name), keep, found);
    } else if (keep(entry.name)) {
      found.push(relative(root, join(dir, entry.name)).replaceAll('\\', '/'));
    }
  }
  return found.sort();
}

function domainTestFilesOnDisk() {
  return walk(join(root, DOMAIN_TESTS_DIR), (name) => name.endsWith('.test.ts')).map((file) =>
    file.slice('packages/domain/'.length),
  );
}

function vitestConfigsOnDisk() {
  return walk(root, (name) => /^vitest\.(?:[^.]+\.)?config\.[cm]?[jt]s$/.test(name));
}

function symmetricDifference(a, b) {
  return {
    onlyInFirst: a.filter((item) => !b.includes(item)),
    onlyInSecond: b.filter((item) => !a.includes(item)),
  };
}

/** Same slicing as `tools/ci-desktop-paths.test.mjs`: the quoted `- '…'` items after an anchor line. */
function quotedListAfter(text, anchorLine) {
  const lines = text.split('\n');
  const anchorIndex = lines.findIndex((line) => line.trim() === anchorLine);
  if (anchorIndex === -1) return null;
  const items = [];
  for (let i = anchorIndex + 1; i < lines.length; i += 1) {
    const match = lines[i].match(/^\s*-\s*'([^']+)'\s*$/);
    if (!match) break;
    items.push(match[1]);
  }
  return items;
}

describe('the domain tests are partitioned between the domain project and the solver pass', () => {
  const onDisk = domainTestFilesOnDisk();
  const solverFiles = [...SOLVER_TEST_FILES];

  it(`finds at least ${DOMAIN_TEST_FILES_FLOOR} domain test files on disk`, () => {
    expect(onDisk.length, `only ${onDisk.length} test files under ${DOMAIN_TESTS_DIR}`).toBeGreaterThanOrEqual(
      DOMAIN_TEST_FILES_FLOOR,
    );
  });

  it('the solver list is non-empty, has no duplicates, and every entry exists on disk', () => {
    expect(solverFiles.length, `${SOLVER_FILES_MODULE} lists no files`).toBeGreaterThan(0);

    const duplicates = solverFiles.filter((file, index) => solverFiles.indexOf(file) !== index);
    expect(duplicates, `${SOLVER_FILES_MODULE} lists these more than once: ${duplicates.join(', ')}`).toEqual([]);

    const missing = solverFiles.filter((file) => !existsSync(join(root, 'packages/domain', file)));
    expect(
      missing,
      `${SOLVER_FILES_MODULE} lists files that do not exist under packages/domain: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('the solver list is a subset of the files on disk and the rest is the domain project', () => {
    const domainProject = onDisk.filter((file) => !solverFiles.includes(file));
    const union = [...domainProject, ...solverFiles].sort();
    const { onlyInFirst, onlyInSecond } = symmetricDifference(union, onDisk);
    expect(
      onlyInFirst,
      `in a pass but not on disk (a solver entry naming a file that no longer exists): ${onlyInFirst.join(', ')}`,
    ).toEqual([]);
    expect(onlyInSecond, `on disk but in neither pass: ${onlyInSecond.join(', ')}`).toEqual([]);
  });

  it('the wiring is real: the domain project excludes the list and the solver project includes it', () => {
    expect(
      read('packages/domain/vitest.config.ts'),
      `packages/domain/vitest.config.ts must exclude the solver files with ` +
        `\`exclude: [...configDefaults.exclude, ...SOLVER_TEST_FILES]\`, or both passes run them`,
    ).toContain('exclude: [...configDefaults.exclude, ...SOLVER_TEST_FILES]');

    const solverConfig = read(SOLVER_CONFIG);
    expect(solverConfig, `${SOLVER_CONFIG} must run exactly the list: \`include: [...SOLVER_TEST_FILES]\``).toContain(
      'include: [...SOLVER_TEST_FILES]',
    );
    expect(
      solverConfig,
      `${SOLVER_CONFIG} spreads the domain config, whose \`exclude\` names the solver files; the ` +
        `project must reset it with \`exclude: configDefaults.exclude\` or it excludes its own suite`,
    ).toContain('exclude: configDefaults.exclude');
  });
});

describe('dangerouslyIgnoreUnhandledErrors lives in the solver config only', () => {
  const configs = vitestConfigsOnDisk();

  it(`finds at least ${VITEST_CONFIGS_FLOOR} vitest configs on disk`, () => {
    expect(configs.length, `only found: ${configs.join(', ')}`).toBeGreaterThanOrEqual(VITEST_CONFIGS_FLOOR);
    expect(configs, `the walk did not reach ${SOLVER_CONFIG}`).toContain(SOLVER_CONFIG);
  });

  it('the solver config sets the flag — the split does nothing without it', () => {
    expect(read(SOLVER_CONFIG)).toMatch(/dangerouslyIgnoreUnhandledErrors:\s*true/);
  });

  it('no other vitest config mentions the flag', () => {
    const offenders = configs.filter((file) => file !== SOLVER_CONFIG && read(file).includes('dangerouslyIgnoreUnhandledErrors'));
    expect(
      offenders,
      `these configs set or mention dangerouslyIgnoreUnhandledErrors, which hides real unhandled ` +
        `rejections in their projects: ${offenders.join(', ')}. A long synchronous domain test belongs in ` +
        `${SOLVER_FILES_MODULE} instead.`,
    ).toEqual([]);
  });

  it('the solver config caps its workers like every other project', () => {
    const solverConfig = read(SOLVER_CONFIG);
    expect(solverConfig).toContain("import { MAX_TEST_WORKERS } from './vitest.workers'");
    expect(solverConfig).toMatch(/maxWorkers:\s*MAX_TEST_WORKERS/);
  });
});

describe('the domain project yields to the event loop between tests', () => {
  const YIELD_HELPER = 'packages/domain/tests/helpers/yield-between-tests.ts';
  const YIELD_GUARD = 'packages/domain/tests/event-loop-yields-between-tests.test.ts';

  it('the domain config wires the yield helper through setupFiles', () => {
    expect(
      read('packages/domain/vitest.config.ts'),
      `packages/domain/vitest.config.ts must set \`setupFiles: ['tests/helpers/yield-between-tests.ts']\`, ` +
        `or a domain file past 60 s in total fails the run with every test passing`,
    ).toMatch(/^\s*setupFiles: \['tests\/helpers\/yield-between-tests\.ts'\]/m);
  });

  it('the helper exists and yields one macrotask after each test', () => {
    expect(existsSync(join(root, YIELD_HELPER)), `${YIELD_HELPER} is missing`).toBe(true);
    const helper = read(YIELD_HELPER);
    expect(helper, `${YIELD_HELPER} no longer registers an afterEach hook`).toContain('afterEach(');
    expect(helper, `${YIELD_HELPER} no longer yields a macrotask via setImmediate`).toContain('setImmediate(');
  });

  it('the behavioural guard inside the domain project still exists', () => {
    expect(
      existsSync(join(root, YIELD_GUARD)),
      `${YIELD_GUARD} is missing — it is the only check that the yield actually runs between tests`,
    ).toBe(true);
  });
});

describe('every runner reaches both passes', () => {
  const rootPass = /\bvitest run\b(?!\s+--config)/;
  const solverPass = 'vitest run --config vitest.solver.config.ts';

  it('root `pnpm test` runs the workspace projects and then the solver pass', () => {
    const script = JSON.parse(read('package.json')).scripts.test;
    expect(script, `root scripts.test never runs the workspace projects: ${script}`).toMatch(rootPass);
    expect(script, `root scripts.test never runs the solver pass: ${script}`).toContain(solverPass);
  });

  it('`pnpm --filter @bombfarm/domain test` runs the domain project and then the solver pass', () => {
    const script = JSON.parse(read('packages/domain/package.json')).scripts.test;
    expect(script, `domain scripts.test never runs the domain project: ${script}`).toMatch(rootPass);
    expect(script, `domain scripts.test never runs the solver pass: ${script}`).toContain(
      'vitest run --config ../../vitest.solver.config.ts',
    );
  });

  it('check-changed runs the solver pass in both its widened and its scoped branch', () => {
    const source = read('tools/check-changed.mjs');
    expect(source, 'the widened branch never runs the solver pass').toContain(
      `run('node tools/with-heavy-slot.mjs pnpm exec vitest run --config vitest.solver.config.ts')`,
    );
    expect(source, 'the scoped branch never runs the solver pass').toContain(
      'run(`pnpm exec vitest run --config vitest.solver.config.ts --changed ${sha}`)',
    );
  });

  it('a change to the solver config or its file list widens check-changed to everything', () => {
    const source = read('tools/check-changed-scope.mjs');
    const missing = [SOLVER_CONFIG, SOLVER_FILES_MODULE].filter((file) => !source.includes(`'${file}'`));
    expect(missing, `WIDENS_TO_EVERYTHING in tools/check-changed-scope.mjs lacks: ${missing.join(', ')}`).toEqual([]);
  });

  it('ci-desktop.yml runs the solver pass as its own step', () => {
    expect(read('.github/workflows/ci-desktop.yml')).toMatch(/^\s*run:\s*pnpm vitest run --config vitest\.solver\.config\.ts\s*$/m);
  });

  it.each([
    ['ci-desktop.yml', 'desktop:'],
    ['ci-web.yml', 'web:'],
    ['ci-fidelity.yml', 'fidelity:'],
  ])('%s lists the solver config and its file list in both path-filter lists', (workflow, filterAnchor) => {
    const text = read(`.github/workflows/${workflow}`);
    const lists = { 'on.push.paths': quotedListAfter(text, 'paths:'), [`filters ${filterAnchor}`]: quotedListAfter(text, filterAnchor) };
    for (const [name, list] of Object.entries(lists)) {
      expect(list, `${workflow}: could not slice the ${name} list`).not.toBeNull();
      const missing = [SOLVER_CONFIG, SOLVER_FILES_MODULE].filter((file) => !list.includes(file));
      expect(missing, `${workflow} ${name} lacks: ${missing.join(', ')}`).toEqual([]);
    }
  });
});
