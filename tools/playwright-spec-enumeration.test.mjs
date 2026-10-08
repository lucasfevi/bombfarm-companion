/**
 * The sixth instance of this repo's green-without-executing family:
 * `apps/desktop/playwright.config.ts` enumerates its spec files in per-project `testMatch`
 * arrays, so a new `*.spec.mjs` dropped into a project's directory without a matching entry is
 * silently never run — `pnpm test` and even `pnpm --filter @bombfarm/desktop test:smoke` stay
 * green while the new spec never executes. A smoke that never ran is not evidence.
 *
 * This guard derives the expected list from each project's own directory and asserts that
 * project's `testMatch` is exactly that set — same members, either direction. It is parameterised
 * over EVERY `{ testDir, testMatch }` project pair in every tracked Playwright config, not the
 * first `testMatch` in each file: the desktop config declares two projects, and comparing only
 * the first left `render-count-instrument`'s single-file list measured against nothing — the exact
 * failure this guard exists to prevent, one directory over. A project that declares no `testDir`
 * of its own inherits the config's top-level one, which is how `electron-smoke` is addressed.
 *
 * Deliberately dumb text slicing over the config (the `tools/design-system-gate.test.mjs` /
 * `ci-desktop-paths.test.mjs` convention), not a TypeScript parse — but bracket-matched and
 * comment-aware, and the shapes it cannot read throw instead of narrowing. Two it reads loosely
 * rather than refusing: a double-quoted `testDir` falls through to the inherited one, and a
 * backtick `testMatch` entry is dropped — both then red on the wrong directory or a missing
 * filename rather than passing, and prettier's single-quote rule keeps either out of these
 * configs. A parse that silently finds no project compares nothing and passes, so floors sit
 * under each derived set.
 *
 * Scope: explicit-filename-list projects only. A project whose `testMatch` is a glob (or which
 * declares none at all and is swept by its `testDir`) has no enumeration to drift out of date —
 * `apps/web/playwright.config.ts`'s projects are all of that kind, and forcing one into a
 * filename-set comparison it cannot satisfy would red on every spec the glob already reaches.
 * Which projects fall on which side is asserted as an exact set below, so a future project that
 * does carry a filename list is not silently exempt.
 *
 * The last block below covers the same family from the other end: a committed `.only`
 * narrows a suite to one test and still reports green, so every Playwright config in the repo
 * must set `forbidOnly` on CI.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { basename, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FORBID_ONLY = /forbidOnly:\s*!!process\.env\.CI\s*,/;
const GLOB_SYNTAX = /[*?[\]{}]/;

/**
 * Floors, not counts. A count would red on every added spec and be bumped without reading; a
 * floor only reds when the derivation has stopped finding things. Two configs, four projects
 * between them and 27 specs on disk today — the spec floor sits below that with room for ordinary
 * deletion, the project floors sit exactly at the count because each one is load-bearing and
 * losing one from the parse must red rather than quietly shrink what is compared.
 */
const CONFIG_FLOOR = 2;
const PROJECT_FLOOR = 4;
const ENUMERATED_PROJECT_FLOOR = 2;
const SPEC_FILE_FLOOR = 24;

const ENUMERATED_PROJECTS = [
  'apps/desktop/playwright.config.ts :: electron-smoke',
  'apps/desktop/playwright.config.ts :: render-count-instrument',
];
const GLOB_SWEPT_PROJECTS = ['apps/web/playwright.config.ts :: perf', 'apps/web/playwright.config.ts :: smoke'];

function matchingClose(text, openIndex) {
  const open = text[openIndex];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];
    if (char === '/' && text[i + 1] === '/') {
      const lineEnd = text.indexOf('\n', i);
      if (lineEnd === -1) break;
      i = lineEnd;
    } else if (char === '/' && text[i + 1] === '*') {
      const blockEnd = text.indexOf('*/', i + 2);
      if (blockEnd === -1) break;
      i = blockEnd + 1;
    } else if (char === "'" || char === '"' || char === '`') {
      const stringEnd = text.indexOf(char, i + 1);
      if (stringEnd === -1) break;
      i = stringEnd;
    } else if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`unbalanced ${open} ... ${close} starting at: ${text.slice(openIndex, openIndex + 60).trim()}`);
}

/**
 * Quoted string literals, not comma-separated fields: a comment line between two entries glues
 * itself onto the entry after it when the body is split on commas, which drops a real entry and
 * makes its file look unregistered.
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

function objectBodies(arrayBody) {
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
    } else if (char === "'" || char === '"' || char === '`') {
      const stringEnd = arrayBody.indexOf(char, i + 1);
      if (stringEnd === -1) throw new Error(`unterminated string literal in: ${arrayBody.trim()}`);
      i = stringEnd;
    } else if (char === '{') {
      const close = matchingClose(arrayBody, i);
      found.push(arrayBody.slice(i + 1, close));
      i = close;
    }
  }
  return found;
}

function stringField(source, field) {
  const match = new RegExp(`(?:^|[\\s,{])${field}:\\s*'([^']*)'`).exec(source);
  return match ? match[1] : null;
}

export function parseTestMatch(label, objectBody) {
  const at = /(?:^|[\s,{])testMatch:\s*/.exec(objectBody);
  if (!at) return null;
  const valueStart = at.index + at[0].length;
  if (objectBody[valueStart] === '[') {
    const entries = quotedStrings(objectBody.slice(valueStart + 1, matchingClose(objectBody, valueStart)));
    if (entries.length === 0) throw new Error(`${label}: the testMatch array parsed as empty`);
    return entries;
  }
  const literal = /^'([^']*)'/.exec(objectBody.slice(valueStart));
  if (!literal) {
    throw new Error(
      `${label}: testMatch is neither an array nor a single-quoted string, so what it registers cannot be read — teach this parse before relying on it`,
    );
  }
  return [literal[1]];
}

function isFilenameList(testMatch) {
  return testMatch !== null && testMatch.every((entry) => !GLOB_SYNTAX.test(entry) && !entry.includes('/'));
}

function readPlaywrightConfigPaths() {
  let output;
  try {
    output = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    throw new Error(
      `could not list tracked files to discover Playwright configs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return output
    .split('\n')
    .map((line) => line.replace(/\r$/, '').trim())
    .filter((line) => basename(line) === 'playwright.config.ts')
    .sort();
}

export function parseProjects(config, source) {
  const projectsAt = /projects:\s*\[/.exec(source);
  if (!projectsAt) {
    throw new Error(`${config} declares no projects: [ ... ] array, so its spec enumeration cannot be derived`);
  }
  const open = projectsAt.index + projectsAt[0].length - 1;
  const bodies = objectBodies(source.slice(open + 1, matchingClose(source, open)));
  if (bodies.length === 0) throw new Error(`${config}: the projects array parsed as empty`);
  const inheritedTestDir = stringField(source.slice(0, projectsAt.index), 'testDir');
  if (!inheritedTestDir) {
    throw new Error(`${config} declares no top-level testDir, so a project without its own sweeps an unknown directory`);
  }
  return bodies.map((body) => {
    const name = stringField(body, 'name');
    if (!name) throw new Error(`${config}: a project declares no name, so its testMatch cannot be attributed`);
    const label = `${config} :: ${name}`;
    const testMatch = parseTestMatch(label, body);
    const testDir = stringField(body, 'testDir') ?? inheritedTestDir;
    return {
      label,
      dir: posix.normalize(posix.join(posix.dirname(config), testDir)),
      testMatch,
      enumerated: isFilenameList(testMatch),
    };
  });
}

function derivePlaywrightProjects() {
  const configs = readPlaywrightConfigPaths();
  if (configs.length === 0) throw new Error('no tracked playwright.config.ts, so no spec enumeration can be derived');
  return configs.flatMap((config) => parseProjects(config, readFileSync(join(root, config), 'utf8')));
}

function readSpecFiles(project) {
  return readdirSync(join(root, project.dir)).filter((name) => name.endsWith('.spec.mjs'));
}

const projects = derivePlaywrightProjects();
const enumerated = projects.filter((project) => project.enumerated);

describe('every enumerated testMatch equals its own project directory listing', () => {
  it('non-vacuity: both configs and every project they declare are derived', () => {
    const configs = readPlaywrightConfigPaths();
    expect(
      configs.length,
      `discovery of tracked playwright.config.ts files found {${configs.join(', ')}} — fewer than the ` +
        `two apps that have one. A guard that globs and finds nothing passes while guarding nothing.`,
    ).toBeGreaterThanOrEqual(CONFIG_FLOOR);
    expect(
      projects.length,
      `derived projects: {${projects.map((project) => project.label).join(', ')}}. A floor, not a count — ` +
        `below it means the projects array parse has stopped seeing a project, and a project nobody ` +
        `compares is a project whose specs can go missing unnoticed.`,
    ).toBeGreaterThanOrEqual(PROJECT_FLOOR);
    expect(new Set(projects.map((project) => project.label)).size).toBe(projects.length);
  });

  it('non-vacuity: every enumerated project is derived, and its directory holds specs', () => {
    expect(
      enumerated.length,
      `projects with an explicit testMatch filename list: {${enumerated.map((project) => project.label).join(', ')}}`,
    ).toBeGreaterThanOrEqual(ENUMERATED_PROJECT_FLOOR);

    const specCount = enumerated.reduce((total, project) => total + readSpecFiles(project).length, 0);
    expect(
      specCount,
      `spec files found across {${enumerated.map((project) => project.dir).join(', ')}}: ${specCount}. ` +
        `Well below the floor means the directory sweep or the filename pattern has stopped working, ` +
        `and a set comparison between two empty sets passes.`,
    ).toBeGreaterThanOrEqual(SPEC_FILE_FLOOR);

    const empty = enumerated.filter((project) => readSpecFiles(project).length === 0).map((project) => project.label);
    expect(empty, `an enumerated project whose directory holds no spec at all: ${empty.join(', ')}`).toEqual([]);
  });

  it('this guard covers explicit-filename-list projects only, and these are exactly those', () => {
    expect(
      enumerated.map((project) => project.label).sort(),
      `the set of projects carrying an explicit testMatch filename list has changed. A new one is in ` +
        `this guard's scope and belongs in the list; one that became glob-swept has no enumeration left ` +
        `to drift. Decide which, then update the list — do not let a filename list go uncompared.`,
    ).toEqual(ENUMERATED_PROJECTS);
    expect(
      projects
        .filter((project) => !project.enumerated)
        .map((project) => project.label)
        .sort(),
      `these projects are swept by a testDir or a testMatch glob, so there is no filename list to ` +
        `compare and this guard deliberately leaves them alone.`,
    ).toEqual(GLOB_SWEPT_PROJECTS);
  });

  it('same members, either direction, per project — a spec that never ran is not evidence', () => {
    const registeredButMissing = [];
    const onDiskButUnregistered = [];
    for (const project of enumerated) {
      const onDisk = readSpecFiles(project);
      for (const name of project.testMatch) {
        if (!onDisk.includes(name)) registeredButMissing.push(`${project.label} -> ${name}`);
      }
      for (const name of onDisk) {
        if (!project.testMatch.includes(name)) onDiskButUnregistered.push(`${project.label} -> ${name}`);
      }
    }

    expect(
      registeredButMissing,
      `testMatch registers a spec file that does not exist in that project's testDir: ` +
        `${registeredButMissing.join(', ')}`,
    ).toEqual([]);
    expect(
      onDiskButUnregistered,
      `a project's testDir holds a *.spec.mjs its testMatch does not register, so it silently never ` +
        `runs: ${onDiskButUnregistered.join(', ')}. A spec that never ran is not evidence — add it to ` +
        `that project's testMatch array.`,
    ).toEqual([]);
  });

  it('red state demonstrated: an unregistered probe spec in each enumerated directory is caught, then removed', () => {
    const probes = enumerated.map((project) => ({ project, path: join(root, project.dir, 'zz-probe.spec.mjs') }));
    try {
      for (const probe of probes) {
        writeFileSync(probe.path, "import { test } from '@playwright/test';\ntest.skip('probe', () => {});\n");
      }
      for (const probe of probes) {
        const unregistered = readSpecFiles(probe.project).filter((name) => !probe.project.testMatch.includes(name));
        expect(unregistered, `${probe.project.label} did not report its own unregistered probe`).toEqual([
          'zz-probe.spec.mjs',
        ]);
      }
    } finally {
      for (const probe of probes) if (existsSync(probe.path)) rmSync(probe.path);
    }
    for (const probe of probes) expect(existsSync(probe.path)).toBe(false);
  });
});

describe('the derivation fails loudly rather than narrowing', () => {
  it('a config with no parseable projects array throws instead of comparing nothing', () => {
    expect(() => parseProjects('apps/x/playwright.config.ts', 'export default defineConfig({ workers: 1 });')).toThrow(
      /declares no projects: \[ \.\.\. \] array/,
    );
    expect(() =>
      parseProjects('apps/x/playwright.config.ts', "testDir: './t',\nprojects: [\n  ...spread,\n],"),
    ).toThrow(/projects array parsed as empty/);
  });

  it('a project without its own testDir inherits the top-level one rather than being skipped', () => {
    const parsed = parseProjects(
      'apps/x/playwright.config.ts',
      "testDir: './tests/smoke',\nprojects: [\n  { name: 'a', testMatch: ['one.spec.mjs'] },\n  { name: 'b', testDir: './tests/other', testMatch: ['two.spec.mjs'] },\n],",
    );
    expect(parsed.map((project) => [project.label, project.dir, project.enumerated])).toEqual([
      ['apps/x/playwright.config.ts :: a', 'apps/x/tests/smoke', true],
      ['apps/x/playwright.config.ts :: b', 'apps/x/tests/other', true],
    ]);
  });

  it('a top-level testDir is required, since a project without one would sweep an unknown directory', () => {
    expect(() => parseProjects('apps/x/playwright.config.ts', "projects: [{ name: 'a' }],")).toThrow(
      /declares no top-level testDir/,
    );
  });

  it('a nested testMatch array does not end the projects array early, so later projects are still seen', () => {
    const parsed = parseProjects(
      'apps/x/playwright.config.ts',
      "testDir: './t',\nprojects: [\n  { name: 'first', testMatch: ['a.spec.mjs', 'b.spec.mjs'] },\n  // a note between them\n  { name: 'second', testMatch: ['c.spec.mjs'] },\n],",
    );
    expect(parsed.map((project) => project.testMatch)).toEqual([['a.spec.mjs', 'b.spec.mjs'], ['c.spec.mjs']]);
  });

  it('a comment between two testMatch entries does not swallow the entry after it', () => {
    expect(
      parseTestMatch('x :: y', "testMatch: [\n  'one.spec.mjs',\n  // a note about the next one\n  'two.spec.mjs',\n],"),
    ).toEqual(['one.spec.mjs', 'two.spec.mjs']);
  });

  it('a glob testMatch is classified as swept, not measured against a filename set it cannot satisfy', () => {
    const parsed = parseProjects(
      'apps/x/playwright.config.ts',
      "testDir: 'e2e',\nprojects: [\n  { name: 'glob', testMatch: '**/perf/*.spec.ts' },\n  { name: 'sweep', testIgnore: ['**/perf/**'] },\n],",
    );
    expect(parsed.map((project) => [project.testMatch, project.enumerated])).toEqual([
      [['**/perf/*.spec.ts'], false],
      [null, false],
    ]);
  });

  it('a testMatch shape this parse cannot read throws rather than being dropped', () => {
    expect(() => parseTestMatch('x :: y', 'testMatch: SPEC_FILES,')).toThrow(/neither an array nor a single-quoted/);
    expect(() => parseTestMatch('x :: y', 'testMatch: [],')).toThrow(/parsed as empty/);
  });
});

describe('every Playwright config sets forbidOnly on CI', () => {
  it('discovers at least the web and desktop configs from the tracked file list', () => {
    const configs = readPlaywrightConfigPaths();

    expect(
      configs.length,
      `discovery of tracked playwright.config.ts files found {${configs.join(', ')}} — fewer than the ` +
        `two apps that have one. A guard that globs and finds nothing passes while guarding nothing.`,
    ).toBeGreaterThanOrEqual(CONFIG_FLOOR);
  });

  it('a committed .only would otherwise reduce a suite to one test and still report green', () => {
    const configs = readPlaywrightConfigPaths();
    const withForbidOnly = configs.filter((path) => FORBID_ONLY.test(readFileSync(join(root, path), 'utf8')));
    const missing = configs.filter((path) => !withForbidOnly.includes(path));

    expect(
      missing,
      `these Playwright configs do not set \`forbidOnly: !!process.env.CI\`: ${missing.join(', ')}. ` +
        `A committed \`.only\` in one of their specs silently narrows the suite to that one test and ` +
        `still reports green. Configs checked: {${configs.join(', ')}}.`,
    ).toEqual([]);
  });

  it('red state demonstrated: a config text without the option is reported as an offender', () => {
    const withoutOption = 'export default defineConfig({\n  workers: 1,\n  retries: 0,\n});\n';

    expect(FORBID_ONLY.test(withoutOption)).toBe(false);
    expect(FORBID_ONLY.test(withoutOption.replace('  workers: 1,\n', '  forbidOnly: !!process.env.CI,\n'))).toBe(true);
  });
});
